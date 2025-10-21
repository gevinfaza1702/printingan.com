import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ============ Types & Utils ============ */
type Client = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  vendor_choice?: string | null; // kubus | fma | lainnya | none | <nama lain>
  vendor_other?: string | null;
  created_at?: string;
  is_approved?: number | boolean | "0" | "1" | "true" | "false";
  deleted_at?: string | null;
};

type VendorRow = {
  id?: number;
  name?: string;
  vendor_name?: string;
  is_whitelisted?: number | string | boolean;
  whitelisted?: number | string | boolean;
  is_whitelist?: number | string | boolean;
};

const isApproved = (c: Client) =>
  c.is_approved === 1 ||
  c.is_approved === true ||
  c.is_approved === "1" ||
  c.is_approved === "true";

const isTruthyFlag = (v: unknown) =>
  v === undefined || v === 1 || v === "1" || v === true || v === "true";

const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

/* ============ Page ============ */
export default function AdminClientsPage() {
  const token = localStorage.getItem("admin_verifier_token");
  const headers = { Authorization: `Bearer ${token}` };
  const approveClient = async (id: number, approved: boolean) => {
    const r = await fetch(`${baseURL}/api/admin/clients/${id}/approval`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ approved }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error((e as any).error || r.statusText);
    }
  };

  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetDelete, setTargetDelete] = useState<Client | null>(null);
  const [deletingNow, setDeletingNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false); // toggle tampilkan yang dihapus
  const [restoringId, setRestoringId] = useState<number | null>(null); // loading tombol Pulihkan

  // dialog Add/Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formVendorPick, setFormVendorPick] = useState<
    "none" | "lainnya" | string
  >("none");
  const [formVendorOther, setFormVendorOther] = useState("");

  // dialog Ubah vendor (quick change)
  const [vendorDlgOpen, setVendorDlgOpen] = useState(false);
  const [vendorList, setVendorList] = useState<string[]>([]);
  const [pickVendor, setPickVendor] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [targetClient, setTargetClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!token) {
      window.location.href = "/admin/verifier/login";
    }
  }, [token]);

  // ------- helpers -------
  const extractWhitelistedNames = (raw: unknown): string[] => {
    const pickArray = (r: unknown): any[] => {
      if (Array.isArray(r)) return r;
      if (r && typeof r === "object") {
        const o = r as Record<string, unknown>;
        return pickArray(
          (o.vendors as unknown) ??
            o.rows ??
            o.data ??
            o.result ??
            o.items ??
            o.list ??
            []
        );
      }
      return [];
    };
    return pickArray(raw)
      .flatMap((it: unknown) => {
        if (typeof it === "string") return [it.trim()];
        if (it && typeof it === "object") {
          const row = it as VendorRow;
          const flag =
            row.is_whitelisted ?? row.whitelisted ?? row.is_whitelist ?? 1;
          if (!isTruthyFlag(flag)) return [];
          const name = String(row.name ?? row.vendor_name ?? "").trim();
          return name ? [name] : [];
        }
        return [];
      })
      .filter(Boolean)
      .sort((a: string, b: string) => a.localeCompare(b));
  };

  const loadVendors = async () => {
    try {
      const r = await fetch(`${baseURL}/api/admin/vendors`, { headers });
      const raw = await r.json().catch(() => []);
      setVendorList(extractWhitelistedNames(raw));
    } catch {
      setVendorList([]);
    }
  };

  const fetchClients = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = new URL(`${baseURL}/api/admin/clients`);
      if (q.trim()) url.searchParams.set("search", q.trim());
      if (showDeleted) url.searchParams.set("include_deleted", "1");
      const r = await fetch(url.toString(), { headers });
      const data = await r.json().catch(() => []);
      if (Array.isArray(data)) setClients(data as Client[]);
      else
        setClients(
          Array.isArray((data as any)?.clients) ? (data as any).clients : []
        );
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick, showDeleted]);

  // -------- Add/Edit dialog helpers --------
  const openAdd = async () => {
    setEditing(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormVendorPick("none");
    setFormVendorOther("");
    await loadVendors();
    setEditOpen(true);
  };

  const openEdit = async (c: Client) => {
    setEditing(c);
    setFormName(c.full_name || "");
    setFormEmail(c.email || "");
    setFormPhone(c.phone || "");

    const v = (c.vendor_choice || "none").toLowerCase();
    if (v === "lainnya") {
      setFormVendorPick("lainnya");
      setFormVendorOther(c.vendor_other || "");
    } else {
      setFormVendorPick(v || "none");
      setFormVendorOther("");
    }

    await loadVendors();
    setEditOpen(true);
  };

  const saveClient = async () => {
    const name = formName.trim();
    const email = formEmail.trim().toLowerCase();
    const phone = formPhone.trim() || null;

    if (!name || !email.includes("@")) {
      alert("Nama/Email belum valid");
      return;
    }

    // Kalau admin ketik vendor baru → whitelist-kan dulu
    if (formVendorPick === "lainnya" && formVendorOther.trim()) {
      const vname = formVendorOther.trim();
      await fetch(`${baseURL}/api/admin/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ name: vname, is_whitelisted: true }),
      });
    }

    const vendor_choice =
      formVendorPick === "lainnya" && formVendorOther.trim()
        ? formVendorOther.trim() // nama vendor baru
        : formVendorPick || "none"; // nama whitelist atau "none"

    const body: any = {
      full_name: name,
      email,
      phone,
      vendor_choice,
    };
    if (formVendorPick === "lainnya") {
      body.vendor_other = formVendorOther.trim();
    }

    const url = editing
      ? `${baseURL}/api/admin/clients/${editing.id}`
      : `${baseURL}/api/admin/clients`;

    const r = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(`Gagal menyimpan: ${(e as any)?.error || r.statusText}`);
      return;
    }

    setEditOpen(false);
    setEditing(null);
    setRefreshTick((prev: number) => prev + 1);
  };

  const doDeleteClient = async (mode: "soft" | "hard") => {
    if (!targetDelete) return;
    setDeletingNow(true);
    try {
      const r = await fetch(
        `${baseURL}/api/admin/clients/${targetDelete.id}?hard=${
          mode === "hard" ? "1" : "0"
        }`,
        { method: "DELETE", headers }
      );

      if (!r.ok) {
        const j = await r.json().catch(() => ({} as any));
        toast({
          variant: "destructive",
          title: mode === "hard" ? "Gagal hard delete" : "Gagal soft delete",
          description: j?.error || r.statusText,
        });
        return;
      }

      const j = await r.json().catch(() => ({} as any));
      toast({
        title:
          j?.mode === "hard"
            ? "Client dihapus permanen"
            : "Client dihapus (soft)",
        description: targetDelete.full_name,
      });
      setRefreshTick((p: number) => p + 1);
    } finally {
      setDeletingNow(false);
      setConfirmOpen(false);
      setTargetDelete(null);
    }
  };

  const restoreClient = async (id: number) => {
    setRestoringId(id);
    try {
      const r = await fetch(`${baseURL}/api/admin/clients/${id}/restore`, {
        method: "PATCH",
        headers,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as any));
        toast({
          variant: "destructive",
          title: "Gagal memulihkan",
          description: j?.error || r.statusText,
        });
        return;
      }
      toast({ title: "Client dipulihkan" });
      setRefreshTick((p: number) => p + 1);
    } finally {
      setRestoringId(null);
    }
  };

  // -------- Vendor dialog helpers --------
  const openVendorDialog = async (c: Client) => {
    setTargetClient(c);
    setPickVendor("");
    setNewVendor("");
    await loadVendors();
    setVendorDlgOpen(true);
  };

  const saveVendor = async () => {
    if (!targetClient) return;

    if (newVendor.trim()) {
      const vname = newVendor.trim();
      await fetch(`${baseURL}/api/admin/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ name: vname, is_whitelisted: true }),
      });
      await fetch(`${baseURL}/api/admin/clients/${targetClient.id}/vendor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ vendor_name: vname }),
      });
    } else if (pickVendor) {
      await fetch(`${baseURL}/api/admin/clients/${targetClient.id}/vendor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ vendor_name: pickVendor }),
      });
    }

    setVendorDlgOpen(false);
    setTargetClient(null);
    setRefreshTick((prev: number) => prev + 1);
  };

  // -------- Filtered view --------
  const list: Client[] = useMemo(() => {
    if (!q.trim()) return clients;
    const kw = q.trim().toLowerCase();
    return clients.filter((c: Client) => {
      return (
        c.full_name?.toLowerCase().includes(kw) ||
        c.email?.toLowerCase().includes(kw) ||
        (c.phone || "").toLowerCase().includes(kw) ||
        (c.vendor_choice || "").toLowerCase().includes(kw)
      );
    });
  }, [clients, q]);

  const vendorLabel = (c: Client) => {
    const v = (c.vendor_choice || "none").toLowerCase();
    if (v === "none") return "none";
    if (v === "lainnya") return c.vendor_other || "lainnya";
    return v;
  };

  const logout = () => {
    localStorage.removeItem("admin_verifier_token");
    window.location.href = "/admin/verifier/login";
  };

  /* ============ UI ============ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Topbar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold">Kelola Client</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/verifier">← Kembali</a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshTick((prev: number) => prev + 1)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            <CardTitle className="text-lg">Daftar Client</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <label className="text-xs flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                Tampilkan yang dihapus
              </label>
              <Button onClick={openAdd}>Tambah Client</Button>
            </div>

            <div className="mt-4">
              {list.length === 0 ? (
                <div className="text-sm text-slate-500">
                  {loading ? "Memuat..." : "Belum ada data."}
                </div>
              ) : (
                <div className="divide-y rounded-xl border bg-white overflow-hidden">
                  {list.map((c: Client) => (
                    <div
                      key={c.id}
                      className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:shadow-sm transition"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{c.full_name}</div>
                        <div className="text-xs text-slate-500">
                          {c.email}
                          {c.phone ? ` • ${c.phone}` : ""}
                          {" • "}Vendor: <b>{vendorLabel(c)}</b>
                        </div>
                        <div className="mt-1">
                          {isApproved(c) ? (
                            <Badge>Approved</Badge>
                          ) : (
                            <Badge variant="destructive">Pending</Badge>
                          )}
                          {c.deleted_at && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-red-600 border-red-300"
                            >
                              Deleted
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.deleted_at ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => restoreClient(c.id)}
                            disabled={restoringId === c.id}
                            title="Pulihkan client yang di-soft delete"
                          >
                            {restoringId === c.id
                              ? "Memulihkan..."
                              : "Pulihkan"}
                          </Button>
                        ) : (
                          <>
                            {!isApproved(c) ? (
                              <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await approveClient(c.id, true);
                                    setRefreshTick((p: number) => p + 1);
                                  } catch (e: any) {
                                    alert(`Gagal ACC: ${e?.message || e}`);
                                  }
                                }}
                              >
                                ACC
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await approveClient(c.id, false);
                                    setRefreshTick((p: number) => p + 1);
                                  } catch (e: any) {
                                    alert(
                                      `Gagal batalkan ACC: ${e?.message || e}`
                                    );
                                  }
                                }}
                              >
                                Batalkan ACC
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openVendorDialog(c)}
                              title="Pindah ke vendor whitelist / ganti vendor"
                            >
                              Ubah vendor
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(c)}
                            >
                              Edit
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setTargetDelete(c);
                                setConfirmOpen(true);
                              }}
                            >
                              Hapus
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Tambah/Ubah Client */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah Client" : "Tambah Client"}
            </DialogTitle>
            <DialogDescription>Isi data dasar client.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Nama Lengkap</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label>No. HP (opsional)</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>

            <div className="grid gap-1">
              <Label>Vendor</Label>
              <Select
                value={formVendorPick}
                onValueChange={(v: string) => setFormVendorPick(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendorList.map((name: string) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                  <SelectItem value="lainnya">lainnya (buat baru)</SelectItem>
                  <SelectItem value="none">none (non-vendor)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formVendorPick === "lainnya" && (
              <div className="grid gap-1">
                <Label>Vendor baru (akan di-whitelist)</Label>
                <Input
                  value={formVendorOther}
                  onChange={(e) => setFormVendorOther(e.target.value)}
                  placeholder="Nama vendor baru"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={saveClient}
              disabled={!formName.trim() || !formEmail.includes("@")}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Ubah Vendor (quick) */}
      <Dialog open={vendorDlgOpen} onOpenChange={setVendorDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah vendor client</DialogTitle>
            <DialogDescription>
              Pilih vendor whitelist yang ada ATAU buat vendor baru (otomatis
              whitelist).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Vendor whitelist</Label>
              <Select
                value={pickVendor}
                onValueChange={(v: string) => setPickVendor(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendorList.map((name: string) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-center text-xs text-slate-500">— atau —</div>

            <div>
              <Label>Vendor baru (akan di-whitelist)</Label>
              <Input
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                placeholder="Nama vendor baru"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorDlgOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={saveVendor}
              disabled={!newVendor.trim() && !pickVendor}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus client?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Tindakan ini tidak bisa dibatalkan.</p>
                <p>
                  <b>Soft delete</b> akan menyembunyikan client tetapi riwayat
                  order tetap ada.
                  <br />
                  <b>Hard delete</b> akan{" "}
                  <u>menghapus SEMUA order milik client ini</u> dan akunnya
                  secara permanen.
                </p>
                <p className="mt-2">
                  Target: <b>{targetDelete?.full_name}</b>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="gap-2 sm:justify-between">
            <AlertDialogCancel disabled={deletingNow}>Batal</AlertDialogCancel>

            <div className="flex gap-2">
              {/* SOFT DELETE */}
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={deletingNow}
                  onClick={(e) => {
                    e.preventDefault();
                    doDeleteClient("soft");
                  }}
                >
                  {deletingNow ? "Menghapus..." : "Soft delete"}
                </Button>
              </AlertDialogAction>

              {/* HARD DELETE */}
              <AlertDialogAction asChild>
                <Button
                  className="bg-red-700 hover:bg-red-800"
                  disabled={deletingNow}
                  onClick={(e) => {
                    e.preventDefault();
                    doDeleteClient("hard");
                  }}
                >
                  {deletingNow ? "Menghapus..." : "Hard delete"}
                </Button>
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
