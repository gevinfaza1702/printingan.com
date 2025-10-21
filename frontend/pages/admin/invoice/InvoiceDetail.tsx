import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  MessageCircle,
  Calendar,
  User,
  MapPin,
  Phone,
  FileText,
  Eye,
} from "lucide-react";

/* ===== Helpers & Types ===== */
const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

// token

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

type Customer = {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

type InvoiceItem = {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Invoice = {
  id: number;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string | Date;
  due_date: string | Date;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  customer?: Customer | number | string | null;
  invoice_status?: "paid" | "unpaid" | "cancel";
  order_status?: string;
  paid_at?: string | null;
};

const STATUS_CLASS: Record<InvoiceStatus, string> = {
  paid: "bg-green-100 text-green-800 border-green-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: "LUNAS",
  sent: "TERKIRIM",
  overdue: "TERLAMBAT",
  cancelled: "DIBATALKAN",
  draft: "DRAFT",
};

function getStatusColor(s?: string) {
  const k = (s as InvoiceStatus) ?? "draft";
  return STATUS_CLASS[k] ?? STATUS_CLASS.draft;
}

function getStatusText(s?: string) {
  const k = (s as InvoiceStatus) ?? "draft";
  return STATUS_LABEL[k] ?? STATUS_LABEL.draft;
}

/* ====== Konstanta Perusahaan (sesuai permintaan) ====== */
const COMPANY = {
  name: "printingan.com",
  address: "Jl. Sukanagara No. 96 Antapani, Bandung 40291",
};

function asCustomer(
  c: Customer | string | number | null | undefined
): Customer | undefined {
  if (!c) return undefined;
  if (typeof c === "object") return c as Customer;
  if (typeof c === "string") return { name: c };
  return undefined;
}

function safeDate(d: string | Date | undefined) {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("id-ID");
}

export default function InvoiceDetail() {
  const { id, clientId, day } = useParams<{
    id?: string;
    clientId?: string;
    day?: string;
  }>();
  const isGrouped = Boolean(clientId && day);
  const navigate = useNavigate();

  // ===== Guard: jika token hilang, arahkan ke login tanpa full reload
  const token = localStorage.getItem("admin_invoice_token");
  if (!token) return <Navigate to="/admin/invoice/login" replace />;

  // ===== Ambil detail invoice
  const { data, isLoading } = useQuery<Invoice | null>({
    queryKey: ["invoice-detail", id, clientId, day, token],
    enabled: Boolean(id || (clientId && day)),
    queryFn: async (): Promise<Invoice | null> => {
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const url = isGrouped
        ? `${baseURL}/api/admin/invoice/invoices/grouped/${clientId}/${day}`
        : `${baseURL}/api/admin/invoice/invoices/${id}`;

      const r = await fetch(url, { headers });
      if (r.status === 401) {
        localStorage.removeItem("admin_invoice_token");
        navigate("/admin/invoice/login", { replace: true });
        return null; // <- JANGAN return; (undefined)
      }

      const j = await r.json().catch(() => null);
      let inv: any = j?.invoice ?? j;
      if (!inv) return null;

      // --- Normalisasi status ---
      const invStatus = String(inv.invoice_status ?? "").toLowerCase();
      if (invStatus === "cancel") inv.status = "cancelled";
      else if (invStatus === "paid") inv.status = "paid";
      else if (invStatus === "unpaid") inv.status = "sent";
      else {
        const orderSt = String(
          inv.order_status ?? inv.status ?? ""
        ).toLowerCase();
        const paid = Boolean(inv.paid_at);
        inv.status =
          orderSt === "cancel" ? "cancelled" : paid ? "paid" : "sent";
      }

      // --- Normalisasi customer bila bukan object ---
      if (inv.customer && typeof inv.customer !== "object") {
        try {
          const cr = await fetch(`${baseURL}/api/customers`, { headers });
          if (cr.status === 401) {
            localStorage.removeItem("admin_invoice_token");
            navigate("/admin/invoice/login", { replace: true });
            return null;
          }
          const cj = await cr.json().catch(() => ({}));
          const customers: Customer[] = Array.isArray(cj?.customers)
            ? cj.customers
            : Array.isArray(cj)
            ? cj
            : [];
          const cid = Number(inv.customer);
          const found =
            customers.find((c) => Number(c.id) === cid) ??
            (typeof inv.customer === "string"
              ? { name: String(inv.customer) }
              : undefined);
          if (found) inv.customer = found;
        } catch {
          /* ignore */
        }
      }

      // --- Jaga-jaga items kosong ---
      if (!Array.isArray(inv.items) || inv.items.length === 0) {
        const total = Number(inv.total_amount || 0);
        inv.items = [
          {
            description: "Item",
            quantity: 1,
            unit_price: total,
            total_price: total,
          },
        ];
        inv.subtotal = total;
        inv.tax_amount = 0;
        inv.tax_rate = 0;
      }

      return inv as Invoice;
    },
  });

  // Hindari undefined di data
  const invoice = data ?? null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 text-base md:text-lg">
          Invoice tidak ditemukan
        </p>
        <div className="mt-4">
          <Link to="/admin/invoice/invoices">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali ke Daftar Invoice
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const cust = asCustomer(invoice.customer);

  const handlePrint = () => window.print();

  const formatPhoneForWhatsApp = (raw?: string) => {
    if (!raw) return undefined;
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "62" + digits.slice(1);
    return digits.length >= 8 ? digits : undefined;
  };

  const handleSendWhatsApp = () => {
    const invoiceUrl = isGrouped
      ? `${window.location.origin}/admin/invoice/invoices/grouped/${clientId}/${day}`
      : `${window.location.origin}/admin/invoice/invoices/${id}`;
    const phone = formatPhoneForWhatsApp(cust?.phone);
    const messageLines = [
      `Halo ${cust?.name || "Pelanggan"},`,
      `Berikut invoice ${invoice.invoice_number}.`,
      `Total: Rp ${Number(invoice.total_amount || 0).toLocaleString("id-ID")}`,
      `Jatuh tempo: ${safeDate(invoice.due_date)}`,
      `Link: ${invoiceUrl}`,
    ];
    const text = encodeURIComponent(messageLines.join("\n"));
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  return (
    <Layout>
      {/* Style khusus PRINT agar halaman center dan rapi */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Sembunyikan UI layar */
          .screen-only { display: none !important; }
          /* Tampilkan hanya lembar print */
          #print-sheet { display: block !important; }
        }
        /* Lembar print selalu center di layar juga (preview) */
        #print-sheet {
          display: none; /* hanya muncul saat print */
          width: 190mm;               /* sedikit lebih kecil dari A4 (210mm) agar tidak kepotong */
          margin: 0 auto;             /* CENTER */
          font: 12px/1.35 "Segoe UI", system-ui, Arial, sans-serif;
          color: #111;
        }
        #print-sheet h1, #print-sheet h2, #print-sheet h3, #print-sheet h4 { margin: 0; }
        #print-sheet .muted { color:#555; }
        #print-sheet table { width:100%; border-collapse: collapse; }
        #print-sheet th, #print-sheet td { border: 1px solid #dadada; padding: 6px 8px; }
        #print-sheet .no-border th, #print-sheet .no-border td { border: none; }
        #print-sheet .totals td { border: none; padding: 2px 0; }
        #print-sheet .hr { border-top:1px solid #ccc; margin: 12px 0; }
        #print-sheet .right { text-align:right; }
        #print-sheet .center { text-align:center; }
        #print-sheet .title { font-weight:700; font-size:13px; }
      `}</style>

      {/* ======== TAMPILAN LAYAR (normal) ======== */}
      <div className="space-y-6 md:space-y-8 screen-only">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/admin/invoice/invoices")}
              className="hover:bg-gray-100 self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali ke Invoice
            </Button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {invoice.invoice_number}
              </h1>
              <p className="text-gray-600 mt-2 text-base md:text-lg">
                Detail dan ringkasan invoice
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="hover:bg-blue-50 w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Cetak/Unduh
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 w-full sm:w-auto"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Kirim WhatsApp
            </Button>
          </div>
        </div>

        <div>
          <Card className="shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl md:text-2xl flex items-center">
                    <FileText className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                    <span className="truncate">{invoice.invoice_number}</span>
                  </CardTitle>
                  <p className="text-blue-100 mt-1 text-sm md:text-base">
                    Detail Invoice
                  </p>
                </div>
                <Badge
                  className={`${getStatusColor(
                    invoice.status
                  )} border text-sm px-3 py-1`}
                >
                  {getStatusText(invoice.status)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Info Invoice */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                    Informasi Invoice
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tanggal Terbit:</span>
                      <span className="font-semibold">
                        {safeDate(invoice.issue_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Jatuh Tempo:</span>
                      <span className="font-semibold">
                        {safeDate(invoice.due_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pelanggan */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <User className="h-4 w-4 mr-2 text-green-600" />
                    Tagihan Kepada
                  </h3>
                  {cust ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="font-semibold">{cust.name}</span>
                      </div>
                      {cust.email && (
                        <div className="flex items-center">
                          <MessageCircle className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="break-all">{cust.email}</span>
                        </div>
                      )}
                      {cust.phone && (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-500" />
                          <span>{cust.phone}</span>
                        </div>
                      )}
                      {cust.address && (
                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 mr-2 mt-0.5 text-gray-500" />
                          <span>{cust.address}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      Informasi pelanggan tidak tersedia
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="mt-6 shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <CardTitle>Item Invoice</CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">
                        Deskripsi
                      </th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">
                        Jumlah
                      </th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">
                        Harga Satuan
                      </th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((it: InvoiceItem, i: number) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3 px-3">{it.description}</td>
                        <td className="text-right py-3 px-3">{it.quantity}</td>
                        <td className="text-right py-3 px-3">
                          Rp {it.unit_price.toLocaleString("id-ID")}
                        </td>
                        <td className="text-right py-3 px-3 font-semibold">
                          Rp {it.total_price.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 space-y-2 max-w-md ml-auto">
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-bold">
                    Rp {invoice.subtotal.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium">
                    Pajak ({invoice.tax_rate}%):
                  </span>
                  <span className="font-bold text-blue-700">
                    Rp {invoice.tax_amount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t-2 pt-4 p-3 bg-green-50 rounded-lg">
                  <span>Total:</span>
                  <span className="text-green-700">
                    Rp {invoice.total_amount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {invoice.notes && (
                <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-yellow-600" />
                    Catatan:
                  </h4>
                  <p className="text-gray-700">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ======== LEMBAR CETAK (print only) ======== */}
      <div id="print-sheet" aria-hidden>
        {/* Header */}
        <table className="no-border">
          <tbody>
            <tr className="no-border">
              <td className="no-border" style={{ width: "50%" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {COMPANY.name.toUpperCase()}
                </div>
              </td>
              <td className="no-border right" style={{ width: "50%" }}>
                <div className="title">
                  Invoice #{" "}
                  {String(invoice.invoice_number).replace(/^INV-?/, "")}
                </div>
                <div className="muted">
                  Tanggal: {safeDate(invoice.issue_date)}
                </div>
                <div className="muted">
                  Jatuh tempo: {safeDate(invoice.due_date)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="hr" />

        {/* Info Pelanggan & Perusahaan */}
        <table className="no-border">
          <tbody>
            <tr className="no-border">
              <td
                className="no-border"
                style={{ verticalAlign: "top", width: "50%" }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  PELANGGAN
                </div>
                <div style={{ fontStyle: "italic" }}>{cust?.name || "-"}</div>
                {cust?.email && <div>{cust.email}</div>}
                {cust?.phone && <div>{cust.phone}</div>}
              </td>
              <td
                className="no-border right"
                style={{ verticalAlign: "top", width: "50%" }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {COMPANY.name}
                </div>
                <div className="muted">{COMPANY.address}</div>
                {/* telepon & bank DIHAPUS sesuai permintaan */}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tabel item */}
        <div style={{ marginTop: 16 }} />
        <table>
          <thead>
            <tr>
              <th className="center">NAMA</th>
              <th className="center" style={{ width: "70px" }}>
                JUMLAH
              </th>
              <th className="right" style={{ width: "120px" }}>
                HARGA SATUAN
              </th>
              <th className="right" style={{ width: "120px" }}>
                SUB TOTAL
              </th>
              <th className="right" style={{ width: "80px" }}>
                PPN
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it: InvoiceItem, idx: number) => (
              <tr key={idx}>
                <td>{it.description}</td>
                <td className="center">{it.quantity}</td>
                <td className="right">
                  Rp {Number(it.unit_price ?? 0).toLocaleString("id-ID")}
                </td>
                <td className="right">
                  Rp {Number(it.total_price ?? 0).toLocaleString("id-ID")}
                </td>
                <td className="right">
                  {invoice.tax_rate
                    ? `Rp ${Math.round(
                        it.total_price * (invoice.tax_rate / 100)
                      ).toLocaleString("id-ID")}`
                    : "Rp 0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <table className="no-border" style={{ marginTop: 8 }}>
          <tbody>
            <tr className="no-border">
              <td className="no-border" />
              <td className="no-border" style={{ width: "320px" }}>
                <table className="no-border totals" style={{ width: "100%" }}>
                  <tbody>
                    <tr>
                      <td className="right muted">SUB TOTAL</td>
                      <td className="right" style={{ width: "140px" }}>
                        Rp{" "}
                        {Number(
                          invoice.subtotal ?? invoice.total_amount ?? 0
                        ).toLocaleString("id-ID")}
                      </td>
                    </tr>
                    <tr>
                      <td className="right muted">PPN</td>
                      <td className="right">
                        Rp{" "}
                        {Number(invoice.tax_amount ?? 0).toLocaleString(
                          "id-ID"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="right" style={{ fontWeight: 700 }}>
                        Rp{" "}
                        {Number(invoice.total_amount ?? 0).toLocaleString(
                          "id-ID"
                        )}
                      </td>
                      <td className="right" style={{ fontWeight: 700 }}>
                        Rp {invoice.total_amount.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="hr" />

        {/* Footer — hanya nama & alamat perusahaan (tanpa telepon/bank) */}
        <table className="no-border">
          <tbody>
            <tr className="no-border">
              <td className="no-border" style={{ verticalAlign: "top" }}>
                <div style={{ fontWeight: 700 }}>{COMPANY.name}</div>
                <div className="muted">{COMPANY.address}</div>
              </td>
              <td className="no-border" />
            </tr>
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
