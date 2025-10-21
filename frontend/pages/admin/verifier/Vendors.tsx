import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";

type Vendor = {
  id: number;
  name: string;
  is_whitelisted: number; // 1 / 0
  created_at?: string;
};

const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

export default function Vendors() {
  const nav = useNavigate();
  const token = localStorage.getItem("admin_verifier_token");
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  useEffect(() => {
    if (!token) window.location.href = "/admin/verifier/login";
  }, [token]);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addWL, setAddWL] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<Vendor | null>(null);
  const [editName, setEditName] = useState("");

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let arr = Array.isArray(vendors) ? [...vendors] : [];
    if (kw) arr = arr.filter((v) => v.name.toLowerCase().includes(kw));
    // whitelist di atas
    arr.sort(
      (a, b) =>
        b.is_whitelisted - a.is_whitelisted || a.name.localeCompare(b.name)
    );
    return arr;
  }, [vendors, q]);

  async function fetchVendors() {
    setLoading(true);
    try {
      const r = await fetch(`${baseURL}/api/admin/vendors`, {
        headers,
        cache: "no-store",
      });
      if (r.status === 401) {
        localStorage.removeItem("admin_verifier_token");
        window.location.href = "/admin/verifier/login";
        return;
      }
      const j = await r.json().catch(() => []);
      setVendors(Array.isArray(j) ? j : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============== Actions ============== */

  async function createVendor() {
    const name = addName.trim();
    if (!name) return;
    const r = await fetch(`${baseURL}/api/admin/vendors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name, is_whitelisted: addWL ? 1 : 0 }),
    });
    if (!r.ok) {
      alert(await r.text().catch(() => "Gagal menambah vendor"));
      return;
    }
    setAddOpen(false);
    setAddName("");
    setAddWL(true);
    fetchVendors();
  }

  async function toggleWhitelist(v: Vendor) {
    const r = await fetch(`${baseURL}/api/admin/vendors/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ is_whitelisted: v.is_whitelisted ? 0 : 1 }),
    });
    if (!r.ok) {
      alert(await r.text().catch(() => "Gagal menyimpan"));
      return;
    }
    fetchVendors();
  }

  function openEdit(v: Vendor) {
    setEditRow(v);
    setEditName(v.name);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editRow) return;
    const r = await fetch(`${baseURL}/api/admin/vendors/${editRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!r.ok) {
      alert(await r.text().catch(() => "Gagal menyimpan"));
      return;
    }
    setEditOpen(false);
    setEditRow(null);
    fetchVendors();
  }

  // cabut whitelist (soft) → sama dengan toggle jadi 0
  async function unwhitelist(v: Vendor) {
    if (!confirm(`Cabut whitelist untuk "${v.name}"?`)) return;
    const r = await fetch(`${baseURL}/api/admin/vendors/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ is_whitelisted: 0 }),
    });
    if (!r.ok) {
      alert(await r.text().catch(() => "Gagal mencabut whitelist"));
      return;
    }
    fetchVendors();
  }

  // hapus permanen — hanya jika tidak dipakai client
  async function deleteHard(v: Vendor) {
    if (
      !confirm(
        `Hapus permanen vendor "${v.name}"?\nAksi ini hanya berhasil bila vendor tidak dipakai oleh client mana pun.`
      )
    )
      return;
    const r = await fetch(`${baseURL}/api/admin/vendors/${v.id}?hard=1`, {
      method: "DELETE",
      headers,
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      alert(msg || "Gagal menghapus vendor (mungkin masih dipakai client).");
      return;
    }
    fetchVendors();
  }

  const Badge = ({ wl }: { wl: number }) => (
    <span
      className={
        wl
          ? "text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }
    >
      {wl ? "Whitelisted" : "Non-whitelist"}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Topbar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-bold">Kelola Vendor</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/verifier">Dashboard</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVendors}
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              + Tambah Vendor
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Search + Stats */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <Input
              placeholder="Cari vendor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-72"
            />
            <div className="text-sm text-slate-600">
              Total: <b>{vendors.length}</b> • Whitelist:{" "}
              <b>{vendors.filter((v) => v.is_whitelisted === 1).length}</b>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            <CardTitle className="text-lg">Daftar Vendor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm bg-slate-50 border-b">
                    <th className="p-3">Nama</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Dibuat</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={4}>
                        Tidak ada data.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((v) => (
                      <tr key={v.id} className="border-b hover:bg-slate-50/60">
                        <td className="p-3 font-medium">{v.name}</td>
                        <td className="p-3">
                          <Badge wl={v.is_whitelisted} />
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {v.created_at
                            ? new Date(v.created_at).toLocaleString("id-ID")
                            : "-"}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(v)}
                            >
                              Ubah Nama
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleWhitelist(v)}
                            >
                              {v.is_whitelisted
                                ? "Cabut Whitelist"
                                : "Jadikan Whitelist"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unwhitelist(v)}
                              disabled={!v.is_whitelisted}
                              title="Cabut whitelist (soft)"
                            >
                              Soft Remove
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteHard(v)}
                              title="Hapus permanen (hanya jika tidak dipakai client)"
                            >
                              Hapus Permanen
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Vendor</DialogTitle>
            <DialogDescription>
              Vendor baru bisa langsung di-whitelist agar klien vendor ini tidak
              perlu bayar di awal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Vendor</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="mis. Kubus, FMA, …"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addWL}
                onChange={(e) => setAddWL(e.target.checked)}
              />
              Jadikan whitelist
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Batal
            </Button>
            <Button onClick={createVendor} disabled={!addName.trim()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Nama Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveEdit} disabled={!editName.trim()}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
