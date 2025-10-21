import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Save, Trash2, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Purchase = {
  id?: number;
  purchased_at?: string;
  supplier_name: string;
  supplier_code?: string;
  material_name: string;
  material_code?: string;
  unit: "roll" | "liter" | "pcs" | "cm" | string;
  qty?: number;
  price: number;
  notes?: string;
};

const SUPPLIERS = [
  { name: "PT. Sahabat", code: "SBH" },
  { name: "PT. Multi", code: "MLT" },
];

const MATERIALS = [
  { name: "Flexi China 280", code: "FC280" },
  { name: "Korcin410", code: "KOR410" },
];

const UNITS = ["roll", "liter", "pcs", "cm"] as const;
const PPN = 0.11;

const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

// Helpers
const fmt = (n?: number) =>
  Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function Purchases() {
  const invoiceToken = localStorage.getItem("admin_invoice_token");
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${invoiceToken}`,
  };

  // Filters
  const [fSupplier, setFSupplier] = useState<string | undefined>(undefined);
  const [fMaterial, setFMaterial] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState<string>("");

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    if (fSupplier) q.set("supplier_code", fSupplier);
    if (fMaterial) q.set("material_code", fMaterial);
    if (keyword.trim()) q.set("q", keyword.trim());
    return q.toString() ? `?${q.toString()}` : "";
  }, [fSupplier, fMaterial, keyword]);

  // List
  const { data, isLoading } = useQuery<Purchase[]>({
    queryKey: ["purchases", queryString],
    queryFn: async () => {
      const r = await fetch(
        `${baseURL}/api/admin/invoice/purchases${queryString}`,
        { headers }
      );
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        return [];
      }
      return (await r.json()) as Purchase[];
    },
  });

  // Summary (total pengeluaran)
  const { data: summary } = useQuery<{ count: number; total_spend: number }>({
    queryKey: ["purchases-summary"],
    queryFn: async () => {
      const r = await fetch(`${baseURL}/api/admin/invoice/purchases/summary`, {
        headers,
      });
      return (await r.json()) as any;
    },
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: async (p: Purchase) => {
      const r = await fetch(`${baseURL}/api/admin/invoice/purchases`, {
        method: "POST",
        headers,
        body: JSON.stringify(p),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchases-summary"] });
      toast({ title: "Baris pembelian ditambahkan" });
    },
    onError: () => toast({ title: "Gagal menambah", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async (p: Purchase) => {
      const r = await fetch(`${baseURL}/api/admin/invoice/purchases/${p.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(p),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchases-summary"] });
      toast({ title: "Perubahan disimpan" });
    },
    onError: () => toast({ title: "Gagal menyimpan", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${baseURL}/api/admin/invoice/purchases/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchases-summary"] });
      toast({ title: "Baris dihapus" });
    },
    onError: () => toast({ title: "Gagal hapus", variant: "destructive" }),
  });

  // State baris baru (untuk add cepat ala Excel)
  const [draft, setDraft] = useState<Purchase>({
    supplier_name: SUPPLIERS[0].name,
    supplier_code: SUPPLIERS[0].code,
    material_name: MATERIALS[0].name,
    material_code: MATERIALS[0].code,
    unit: "roll",
    qty: 1,
    price: 0,
    notes: "",
  });

  const addRow = () => {
    if (!draft.price || draft.price <= 0) {
      toast({ title: "Harga harus > 0", variant: "destructive" });
      return;
    }
    createMut.mutate(draft);
    setDraft({ ...draft, price: 0, notes: "" }); // reset sebagian
  };

  const totalInclPPN = useMemo(
    () => Math.round((summary?.total_spend ?? 0) * (1 + PPN)),
    [summary]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-2 justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Pembelian Bahan</h1>
          <p className="text-sm text-gray-600">
            Input cepat ala “excel”: edit sel, enter untuk simpan, + untuk
            tambah baris.
          </p>
        </div>
        <Card className="border-0 shadow-md">
          <CardContent className="p-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-600">
                Total Pengeluaran (incl PPN 11%):
              </span>
              <span className="font-bold">Rp {fmt(totalInclPPN)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select
            value={fSupplier}
            onValueChange={(v) => setFSupplier(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Kode Suplier" />
            </SelectTrigger>
            <SelectContent>
              {/* ganti value="" -> "all" */}
              <SelectItem value="all">Semua</SelectItem>
              {SUPPLIERS.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={fMaterial}
            onValueChange={(v) => setFMaterial(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Kode Bahan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {MATERIALS.map((m) => (
                <SelectItem key={m.code} value={m.code}>
                  {m.code} — {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Cari suplier/bahan…"
            className="w-56"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Tabel “Excel-like” */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardTitle className="text-base">Tabel Pembelian</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-2">Tanggal</th>
                  <th className="text-left p-2">Suplier</th>
                  <th className="text-left p-2">Kode Suplier</th>
                  <th className="text-left p-2">Bahan</th>
                  <th className="text-left p-2">Kode Bahan</th>
                  <th className="text-left p-2">Satuan</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Harga</th>
                  <th className="text-right p-2">Harga + PPN</th>
                  <th className="text-left p-2">Catatan</th>
                  <th className="text-center p-2 w-24">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {/* Row input (tambah cepat) */}
                <tr className="bg-green-50/60 border-b">
                  <td className="p-2 text-gray-500">auto</td>

                  <td className="p-2">
                    <Select
                      value={draft.supplier_name}
                      onValueChange={(val) => {
                        const found = SUPPLIERS.find((s) => s.name === val)!;
                        setDraft((d) => ({
                          ...d,
                          supplier_name: found.name,
                          supplier_code: found.code,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPLIERS.map((s) => (
                          <SelectItem key={s.code} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="p-2">
                    <Input
                      value={draft.supplier_code || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          supplier_code: e.target.value,
                        }))
                      }
                    />
                  </td>

                  <td className="p-2">
                    <Select
                      value={draft.material_name}
                      onValueChange={(val) => {
                        const found = MATERIALS.find((m) => m.name === val)!;
                        setDraft((d) => ({
                          ...d,
                          material_name: found.name,
                          material_code: found.code,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIALS.map((m) => (
                          <SelectItem key={m.code} value={m.name}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="p-2">
                    <Input
                      value={draft.material_code || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          material_code: e.target.value,
                        }))
                      }
                    />
                  </td>

                  <td className="p-2">
                    <Select
                      value={draft.unit}
                      onValueChange={(val) =>
                        setDraft((d) => ({ ...d, unit: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="p-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      value={draft.qty ?? 1}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, qty: Number(e.target.value) }))
                      }
                    />
                  </td>

                  <td className="p-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      value={draft.price}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          price: Math.max(0, Number(e.target.value)),
                        }))
                      }
                    />
                  </td>
                  <td className="p-2 text-right text-gray-700">
                    <div className="tabular-nums">
                      Rp {fmt(Math.round((draft.price || 0) * (1 + PPN)))}
                    </div>
                  </td>

                  <td className="p-2">
                    <Input
                      value={draft.notes || ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, notes: e.target.value }))
                      }
                    />
                  </td>

                  <td className="p-2 text-center">
                    <Button size="sm" onClick={addRow}>
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah
                    </Button>
                  </td>
                </tr>

                {/* Row data */}
                {isLoading && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={11}>
                      Memuat…
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  (data ?? []).map((row) => (
                    <PurchaseRow
                      key={row.id}
                      row={row}
                      onSave={(payload) => updateMut.mutate(payload)}
                      onDelete={() => deleteMut.mutate(row.id!)}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Row terpisah supaya state input per-baris rapi
function PurchaseRow({
  row,
  onSave,
  onDelete,
}: {
  row: Purchase;
  onSave: (p: Purchase) => void;
  onDelete: () => void;
}) {
  const [edit, setEdit] = useState<Purchase>({ ...row });
  const fmtDate = (s?: string) =>
    s ? new Date(s.replace(" ", "T") + "Z").toLocaleString("id-ID") : "-";

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="p-2 text-gray-600">{fmtDate(row.purchased_at)}</td>

      <td className="p-2">
        <Input
          value={edit.supplier_name}
          onChange={(e) =>
            setEdit((d) => ({ ...d, supplier_name: e.target.value }))
          }
        />
      </td>

      <td className="p-2">
        <Input
          value={edit.supplier_code || ""}
          onChange={(e) =>
            setEdit((d) => ({ ...d, supplier_code: e.target.value }))
          }
        />
      </td>

      <td className="p-2">
        <Input
          value={edit.material_name}
          onChange={(e) =>
            setEdit((d) => ({ ...d, material_name: e.target.value }))
          }
        />
      </td>

      <td className="p-2">
        <Input
          value={edit.material_code || ""}
          onChange={(e) =>
            setEdit((d) => ({ ...d, material_code: e.target.value }))
          }
        />
      </td>

      <td className="p-2">
        <Select
          value={edit.unit}
          onValueChange={(val) => setEdit((d) => ({ ...d, unit: val }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="p-2 text-right">
        <Input
          type="number"
          min={0}
          value={edit.qty ?? 1}
          onChange={(e) =>
            setEdit((d) => ({ ...d, qty: Number(e.target.value) }))
          }
        />
      </td>

      <td className="p-2 text-right">
        <Input
          type="number"
          min={0}
          value={edit.price}
          onChange={(e) =>
            setEdit((d) => ({
              ...d,
              price: Math.max(0, Number(e.target.value)),
            }))
          }
        />
      </td>
      <td className="p-2 text-right text-gray-700">
        <div className="tabular-nums">
          Rp{" "}
          {Number.isFinite(edit.price)
            ? fmt(Math.round((edit.price || 0) * (1 + PPN)))
            : "0"}
        </div>
      </td>

      <td className="p-2">
        <Input
          value={edit.notes || ""}
          onChange={(e) => setEdit((d) => ({ ...d, notes: e.target.value }))}
        />
      </td>

      <td className="p-2 text-center">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSave({ ...edit, id: row.id })}
          className="mr-2"
        >
          <Save className="h-4 w-4 mr-1" />
          Simpan
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
