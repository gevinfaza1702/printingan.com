import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Calendar, User, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

/** 3 status */
type InvoiceStatus = "paid" | "unpaid" | "cancel";
const ALLOWED: InvoiceStatus[] = ["paid", "unpaid", "cancel"];

/** (opsional) supaya tidak any-any lagi */
type InvoiceRow = {
  id: number;
  invoice_number: string;
  customer: { name: string };
  issue_date: string | null;
  due_date: string | null;
  total_amount: number;
  paid_at?: string | null;
  order_status?: string | null;
  invoice_status: InvoiceStatus;
  status: InvoiceStatus;
  client_id?: number;
  day?: string;
  order_count?: number;
};

const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

// helper nomor invoice untuk hasil grouped (client per hari)
const invNumberFor = (clientId?: number, day?: string) =>
  clientId && day
    ? `INV-${day.replace(/-/g, "")}-${String(clientId).padStart(4, "0")}`
    : "-";

/* ===== Helper tanggal aman ===== */
function fmtDate(d: any) {
  try {
    const dt = d ? new Date(d) : null;
    return dt && !isNaN(dt.getTime()) ? dt.toLocaleDateString("id-ID") : "-";
  } catch {
    return "-";
  }
}

/* ===== Normalisasi row invoice agar field selalu ada ===== */
function normalize(inv: any): InvoiceRow {
  const rawId = inv?.id;
  const idNum =
    rawId != null && !Number.isNaN(Number(rawId)) ? Number(rawId) : undefined;

  const statusRaw = String(
    inv?.invoice_status ?? inv?.status ?? "unpaid"
  ).toLowerCase();
  const status: InvoiceStatus = (
    ["paid", "unpaid", "cancel"] as const
  ).includes(statusRaw as InvoiceStatus)
    ? (statusRaw as InvoiceStatus)
    : "unpaid";

  const issue = inv?.issue_date || inv?.created_at || new Date().toISOString();
  const due = inv?.due_date || inv?.payment_deadline || issue;

  const customer =
    inv?.customer && typeof inv.customer === "object"
      ? inv.customer
      : {
          name:
            inv?.client_name ||
            inv?.customer_name ||
            "Pelanggan Tidak Diketahui",
        };

  const invoice_number =
    inv?.invoice_number ||
    (idNum != null
      ? `INV-${String(idNum).padStart(5, "0")}`
      : invNumberFor(Number(inv?.client_id), inv?.day));

  return {
    ...inv,
    id: idNum,
    client_id: inv?.client_id != null ? Number(inv.client_id) : undefined,
    day: inv?.day,
    invoice_number,
    issue_date: issue,
    due_date: due,
    total_amount: Number(inv?.total_amount ?? inv?.amount ?? 0),
    customer,
    paid_at: inv?.paid_at ?? null,
    order_status: inv?.order_status ?? null,
    invoice_status: status,
    status,
  };
}

export default function Invoices() {
  const invoiceToken = localStorage.getItem("admin_invoice_token");
  if (!invoiceToken) return <Navigate to="/admin/invoice/login" replace />;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  headers.Authorization = `Bearer ${invoiceToken}`;

  // redirect kalau belum login
  const navigate = useNavigate();

  /* ===== LIST INVOICES — ADAPTER /api/invoices ===== */
  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const r = await fetch(
        `${baseURL}/api/admin/invoice/invoices?group_by=customer_day`,
        { headers }
      );
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        return { invoices: [] };
      }
      const j = await r.json().catch(() => []);
      const arr = Array.isArray(j) ? j : j?.invoices ?? [];
      return { invoices: arr.map(normalize) as InvoiceRow[] };
    },
  });

  /* ===== UPDATE STATUS — PATCH /api/invoices/:id/status ===== */

  /* ===== Tampilan status (badge) ===== */
  const getStatusColor = (status: InvoiceStatus) =>
    status === "paid"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "cancel"
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : "bg-amber-100 text-amber-700 border-amber-200";

  const getStatusText = (status: InvoiceStatus) =>
    status === "paid"
      ? "Lunas"
      : status === "cancel"
      ? "Cancel"
      : "Belum Lunas";

  const invoices = data?.invoices || [];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Invoice
          </h1>
          <p className="text-gray-600 mt-2 md:mt-3 text-base md:text-lg">
            Kelola invoice dan lacak pembayaran
          </p>
        </div>

        <Link to="/admin/invoice/invoices/new">
          <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Buat Invoice
          </Button>
        </Link>
      </div>

      {/* List */}
      <div className="grid gap-4 md:gap-6">
        {invoices.map((invoice: any, idx: number) => {
          const hasValidId =
            typeof invoice.id === "number" && Number.isFinite(invoice.id);
          const rowKey = hasValidId
            ? `id-${invoice.id}`
            : `grp-${invoice.client_id}-${invoice.day}-${idx}`;

          return (
            <Card
              key={rowKey}
              className="transition-all duration-300 hover:shadow-xl border-0 shadow-lg overflow-hidden"
            >
              {/* HEADER gradasi + fallback judul */}
              <CardHeader className="p-0">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 md:px-6 md:py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle className="text-lg md:text-xl flex items-center">
                      <FileText className="h-4 w-4 md:h-5 md:w-5 mr-2 flex-shrink-0" />
                      <span className="truncate">
                        {invoice.invoice_number ||
                          invNumberFor(invoice.client_id, invoice.day) ||
                          "-"}
                      </span>
                    </CardTitle>
                    <Badge
                      className={`${getStatusColor(
                        invoice.invoice_status
                      )} border text-xs md:text-sm self-start sm:self-center`}
                    >
                      {getStatusText(invoice.invoice_status)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {/* BODY kartu */}
              <CardContent className="p-4 md:p-6 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {/* Customer + Issue */}
                  <div className="space-y-2 md:space-y-3 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center text-xs md:text-sm text-gray-600 p-2 bg-blue-50 rounded-lg">
                      <User className="h-3 w-3 md:h-4 md:w-4 mr-2 text-blue-500 flex-shrink-0" />
                      <span className="font-medium truncate">
                        {invoice.customer?.name || "Pelanggan Tidak Diketahui"}
                      </span>
                    </div>
                    <div className="flex items-center text-xs md:text-sm text-gray-600 p-2 bg-green-50 rounded-lg">
                      <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-2 text-green-500 flex-shrink-0" />
                      <span>{fmtDate(invoice.issue_date)}</span>
                    </div>
                  </div>

                  {/* Due */}
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">
                      Jatuh Tempo
                    </p>
                    <p className="font-semibold text-gray-900 text-sm md:text-base">
                      {fmtDate(invoice.due_date)}
                    </p>
                  </div>

                  {/* Total */}
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs md:text-sm text-gray-600 mb-1">
                      Total
                    </p>
                    <p className="font-bold text-lg md:text-xl text-green-700 truncate">
                      Rp{" "}
                      {Number(invoice.total_amount ?? 0).toLocaleString(
                        "id-ID"
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch lg:items-end xl:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-2 lg:space-x-0 lg:space-y-2 xl:space-y-0 xl:space-x-2">
                    <Select value={invoice.invoice_status} disabled>
                      <SelectTrigger className="w-full sm:w-40 lg:w-full xl:w-40 text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Lunas</SelectItem>
                        <SelectItem value="unpaid">Belum Lunas</SelectItem>
                        <SelectItem value="cancel">Cancel</SelectItem>
                      </SelectContent>
                    </Select>

                    <Link
                      to={
                        invoice.client_id && invoice.day
                          ? `/admin/invoice/invoices/grouped/${invoice.client_id}/${invoice.day}`
                          : `/admin/invoice/invoices/${invoice.id}`
                      }
                    >
                      <Button variant="outline" className="w-full sm:w-auto">
                        <Eye className="h-4 w-4 mr-2" />
                        Lihat
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
      {invoices.length === 0 && (
        <Card className="shadow-xl border-0 overflow-hidden">
          <CardContent className="text-center py-12 md:py-16 bg-white px-4">
            <FileText className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-6 text-base md:text-lg">
              Belum ada invoice
            </p>
            <Link to="/admin/invoice/invoices/new">
              <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                Buat invoice pertama
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
