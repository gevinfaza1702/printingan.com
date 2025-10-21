import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Row = {
  id: number;
  invoice_number: string;
  issue_date?: string;
  paid_at?: string | null;
  status: "draft" | "sent" | "paid" | "cancelled";
  total_amount: number;
  customer_name?: string;
  vendor: string;
};

type SalesResp = {
  rows: Row[];
  summary: { count: number; total: number; paid: number; unpaid: number };
  by_vendor: { vendor: string; count: number; total: number; paid: number }[];
  by_day: { day: string; total: number; paid: number }[];
};

const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";
const fmt = (n?: number) =>
  Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default function SalesReport() {
  const token = localStorage.getItem("admin_invoice_token");
  const headers = { Authorization: `Bearer ${token}` };
  const navigate = useNavigate();
  const [payStatus, setPayStatus] = useState<
    "all" | "paid" | "unpaid" | "cancelled"
  >("all");

  // default 30 hari terakhir
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const d2 = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
    today.getDate()
  )}`;
  const d1Obj = new Date(today);
  d1Obj.setDate(today.getDate() - 29);
  const d1 = `${d1Obj.getFullYear()}-${pad(d1Obj.getMonth() + 1)}-${pad(
    d1Obj.getDate()
  )}`;

  const [from, setFrom] = useState(d1);
  const [to, setTo] = useState(d2);
  const [vendor, setVendor] = useState<string | undefined>(undefined);
  const [dateField, setDateField] = useState<"paid" | "created">("paid"); // filter berdasar apa

  // daftar vendor untuk filter
  const vendorsQ = useQuery<string[]>({
    queryKey: ["vendors-invoice"],
    queryFn: async () => {
      const r = await fetch(`${baseURL}/api/admin/invoice/vendors`, {
        headers,
      });
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        return;
      }
      return r.json();
    },
  });

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    q.set("from", from);
    q.set("to", to);
    q.set("date_field", dateField);
    if (vendor && vendor !== "all") q.set("vendor", vendor);
    if (payStatus !== "all") q.set("status", payStatus); // <— NEW
    return `?${q.toString()}`;
  }, [from, to, vendor, dateField, payStatus]); // <— NEW dep

  const salesQ = useQuery<SalesResp>({
    queryKey: ["sales-recap", qs],
    queryFn: async () => {
      const r = await fetch(`${baseURL}/api/admin/invoice/sales${qs}`, {
        headers,
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const vOptions = ["all", ...(vendorsQ.data ?? [])];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rekapan Penjualan</h1>
        <p className="text-sm text-gray-600">
          Filter berdasarkan rentang tanggal dan vendor.
        </p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-600">Dari tanggal</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Sampai tanggal</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Vendor</label>
            <Select
              value={vendor}
              onValueChange={(v) => setVendor(v === "all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua vendor" />
              </SelectTrigger>
              <SelectContent>
                {vOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v === "all" ? "Semua vendor" : v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Berdasarkan</label>
            <Select
              value={dateField}
              onValueChange={(v) => setDateField((v as any) ?? "paid")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Tanggal Dibayar</SelectItem>
                <SelectItem value="created">Tanggal Dibuat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* NEW: Status pembayaran */}
          <div>
            <label className="text-xs text-gray-600">Status pembayaran</label>
            <Select
              value={payStatus}
              onValueChange={(v) => {
                // jika pilih "Belum lunas" dan user sedang melihat "Tanggal Dibayar",
                // pindahkan ke "Tanggal Dibuat" agar hasilnya masuk akal
                if (
                  (v === "unpaid" || v === "cancelled") &&
                  dateField === "paid"
                ) {
                  setDateField("created");
                }
                setPayStatus(v as any);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="paid">Sudah dibayar</SelectItem>
                <SelectItem value="unpaid">Belum lunas</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => salesQ.refetch()} className="w-full">
              Terapkan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoice (periode)"
          value={salesQ.data?.summary.count ?? 0}
          icon={FileText}
        />
        <StatCard
          title="Omzet (total)"
          value={`Rp ${fmt(salesQ.data?.summary.total ?? 0)}`}
          icon={DollarSign}
        />
        <StatCard
          title="Sudah Dibayar"
          value={`Rp ${fmt(salesQ.data?.summary.paid ?? 0)}`}
          icon={CheckCircle}
        />
        <StatCard
          title="Belum Lunas"
          value={`Rp ${fmt(salesQ.data?.summary.unpaid ?? 0)}`}
          icon={AlertTriangle}
        />
      </div>

      {/* Tabel per vendor */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
          <CardTitle className="text-base">Rekap per Vendor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Vendor</th>
                  <th className="text-right p-2">Jumlah</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {(salesQ.data?.by_vendor ?? []).map((v) => (
                  <tr key={v.vendor} className="border-b">
                    <td className="p-2">{v.vendor}</td>
                    <td className="p-2 text-right tabular-nums">
                      {fmt(v.count)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      Rp {fmt(v.total)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      Rp {fmt(v.paid)}
                    </td>
                  </tr>
                ))}
                {(salesQ.data?.by_vendor ?? []).length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={4}>
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabel detail transaksi */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
          <CardTitle className="text-base">Detail Transaksi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Tanggal</th>
                  <th className="p-2 text-left">Invoice</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-left">Vendor</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {(salesQ.data?.rows ?? []).map((r) => {
                  const tgl =
                    (dateField === "paid" ? r.paid_at : r.issue_date) ||
                    r.issue_date;
                  const labelStatus =
                    r.status === "paid"
                      ? "Lunas"
                      : r.status === "sent"
                      ? "Terkirim"
                      : r.status === "cancelled"
                      ? "Dibatalkan"
                      : "Draft";
                  const badge =
                    r.status === "paid"
                      ? "bg-green-100 text-green-800"
                      : r.status === "sent"
                      ? "bg-blue-100 text-blue-800"
                      : r.status === "cancelled"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800";
                  return (
                    <tr key={r.id} className="border-b">
                      <td className="p-2">
                        {tgl ? new Date(tgl).toLocaleString("id-ID") : "-"}
                      </td>
                      <td className="p-2">{r.invoice_number}</td>
                      <td className="p-2">{r.customer_name}</td>
                      <td className="p-2">{r.vendor}</td>
                      <td className="p-2 text-right tabular-nums">
                        Rp {fmt(r.total_amount)}
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${badge}`}
                        >
                          {labelStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(salesQ.data?.rows ?? []).length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={6}>
                      Tidak ada transaksi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: any;
  icon: any;
}) {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-sm text-gray-600">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between">
        <div className="text-2xl font-bold">{value}</div>
        <div className="p-2 rounded-full bg-gray-100">
          <Icon className="h-5 w-5 text-gray-700" />
        </div>
      </CardContent>
    </Card>
  );
}
