import { useQuery } from "@tanstack/react-query";
import backend from "~backend/client";
import { useEffect } from "react";
import usePageMeta from "@/src/lib/usePageMeta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ===== Types ===== */
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

type Customer = {
  id?: number; // ← bikin optional, karena kadang backend kirim string nama saja
  name: string;
  email?: string;
  created_at?: string; // ← optional juga
};

type Invoice = {
  id: number;
  invoice_number: string;
  total_amount: number;
  status: InvoiceStatus;
  customer?: Customer;
  created_at?: string;
  issue_date?: string;
  due_date?: string;
};

export default function Dashboard() {
  usePageMeta({ title: "Admin Invoice Dashboard", brand: "" });
  const invoiceToken = localStorage.getItem("admin_invoice_token");
  const baseURL =
    (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";
  const headers = { Authorization: `Bearer ${invoiceToken}` };

  const { data: purchaseSummary } = useQuery<{
    count: number;
    total_spend: number;
  }>({
    queryKey: ["purchases-summary"],
    queryFn: async () => {
      const r = await fetch(`${baseURL}/api/admin/invoice/purchases/summary`, {
        headers,
      });
      if (!r.ok) return { count: 0, total_spend: 0 };
      return r.json();
    },
  });

  const navigate = useNavigate();
  useEffect(() => {
    if (!invoiceToken) navigate("/admin/invoice/login", { replace: true });
  }, [invoiceToken, navigate]);

  const mapStatus = (s?: string): InvoiceStatus => {
    if (!s) return "draft";
    if (["draft", "sent", "paid", "overdue", "cancelled"].includes(s))
      return s as InvoiceStatus;
    // kalau backend lama pernah pakai "unpaid"
    return s === "unpaid" ? "sent" : "draft";
  };

  const normalizeInvoice = (row: any): Invoice => ({
    id: Number(row.id),
    invoice_number:
      row.invoice_number || `INV-${String(row.id).padStart(5, "0")}`,
    total_amount: Number(row.total_amount ?? row.amount ?? 0),
    status: mapStatus(row.status),
    customer:
      typeof row.customer === "object"
        ? row.customer
        : row.customer
        ? { name: String(row.customer) }
        : undefined,
    issue_date:
      typeof row.issue_date === "string"
        ? row.issue_date
        : new Date().toISOString(),
    due_date:
      typeof row.due_date === "string"
        ? row.due_date
        : new Date().toISOString(),
  });

  /* ===== Query: Customers (pakai client baru) ===== */
  const { data: customersData } = useQuery<{ customers: Customer[] }>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await backend.invoice.listCustomers();
      const arr = Array.isArray((res as any)?.customers)
        ? (res as any).customers
        : Array.isArray(res)
        ? (res as any)
        : [];
      return { customers: arr as Customer[] };
    },
  });

  /* ===== Query: Invoices (pakai client baru) ===== */
  const { data: invoicesData } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await backend.invoice.listInvoices();
      const arr = Array.isArray((res as any)?.invoices)
        ? (res as any).invoices
        : Array.isArray(res)
        ? (res as any)
        : [];
      return { invoices: (arr as any[]).map(normalizeInvoice) };
    },
  });

  const customers: Customer[] = customersData?.customers ?? [];
  const invoices: Invoice[] = invoicesData?.invoices ?? [];

  const isIncome = (s: InvoiceStatus) => s === "paid";

  const totalRevenue = invoices.reduce((sum, inv) => {
    const val = Number(inv.total_amount ?? (inv as any).amount ?? 0);
    return sum + (isIncome(inv.status) ? val : 0);
  }, 0);

  const totalPengeluaran = purchaseSummary?.total_spend ?? 0;
  const totalBersih = Math.max(0, (totalRevenue ?? 0) - totalPengeluaran);
  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "sent" || invoice.status === "overdue"
  ).length;

  const stats = [
    {
      title: "Total Pelanggan",
      value: customers.length,
      icon: Users,
      bgColor: "bg-gradient-to-r from-blue-500 to-blue-600",
    },
    {
      title: "Total Invoice",
      value: invoices.length,
      icon: FileText,
      bgColor: "bg-gradient-to-r from-green-500 to-green-600",
    },
    {
      title: "Total Pendapatan",
      value: `Rp ${totalRevenue.toLocaleString("id-ID")}`,
      icon: DollarSign,
      bgColor: "bg-gradient-to-r from-yellow-500 to-yellow-600",
    },
    {
      title: "Invoice Tertunda",
      value: pendingInvoices,
      icon: Clock,
      bgColor: "bg-gradient-to-r from-red-500 to-red-600",
    },
    {
      title: "Total Pengeluaran",
      value: `Rp ${Number(totalPengeluaran).toLocaleString("id-ID")}`,
      icon: DollarSign,
      bgColor: "bg-gradient-to-r from-rose-500 to-rose-600",
    },
    {
      title: "Total Bersih",
      value: `Rp ${Number(totalBersih).toLocaleString("id-ID")}`,
      icon: DollarSign,
      bgColor: "bg-gradient-to-r from-indigo-500 to-indigo-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-gray-600 mt-3 text-base md:text-lg">
          Ringkasan sistem manajemen invoice Anda
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="transition-all duration-300 hover:shadow-xl hover:scale-105 border-0 shadow-lg overflow-hidden"
          >
            <CardHeader className={`${stat.bgColor} text-white`}>
              <CardTitle className="flex items-center justify-between text-xs sm:text-sm font-medium">
                <span className="truncate pr-2">{stat.title}</span>
                <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white p-4 md:p-6">
              <div className="text-xl md:text-2xl font-bold text-gray-900 mb-1 truncate">
                {stat.value}
              </div>
              <div className="flex items-center text-xs text-gray-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>Data terkini</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <Card className="shadow-xl border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardTitle className="flex items-center text-lg md:text-xl">
              <FileText className="h-5 w-5 mr-2" />
              Invoice Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 bg-white">
            <div className="space-y-3 md:space-y-4">
              {invoices.slice(0, 5).map((invoice) => {
                const invKey =
                  (invoice as any).id ??
                  (invoice as any).invoice_number ??
                  `${invoice.customer?.name ?? "no-name"}-${
                    invoice.issue_date ?? "no-date"
                  }`;

                return (
                  <div
                    key={String(invKey)}
                    className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm md:text-base truncate">
                        {invoice.invoice_number}
                      </p>
                      <p className="text-xs md:text-sm text-gray-600 flex items-center mt-1">
                        <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {invoice.customer?.name}
                        </span>
                      </p>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="font-bold text-gray-900 text-sm md:text-base">
                        Rp{" "}
                        {Number(invoice.total_amount ?? 0).toLocaleString(
                          "id-ID"
                        )}
                      </p>

                      <span
                        className={`inline-flex px-2 md:px-3 py-1 text-xs font-medium rounded-full mt-1 ${
                          invoice.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : invoice.status === "sent"
                            ? "bg-blue-100 text-blue-800"
                            : invoice.status === "overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {invoice.status === "paid"
                          ? "Lunas"
                          : invoice.status === "sent"
                          ? "Terkirim"
                          : invoice.status === "overdue"
                          ? "Terlambat"
                          : invoice.status === "cancelled"
                          ? "Dibatalkan"
                          : "Draft"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {invoices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm md:text-base">Belum ada invoice</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <CardTitle className="flex items-center text-lg md:text-xl">
              <Users className="h-5 w-5 mr-2" />
              Pelanggan Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 bg-white">
            <div className="space-y-3 md:space-y-4">
              {customers.slice(0, 5).map((customer) => {
                const created = customer.created_at
                  ? new Date(customer.created_at)
                  : new Date();
                const custKey = customer.id ?? customer.email ?? customer.name;

                return (
                  <div
                    key={String(custKey)}
                    className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-gray-50 to-green-50 rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm md:text-base truncate">
                        {customer.name}
                      </p>
                      <p className="text-xs md:text-sm text-gray-600 truncate">
                        {customer.email}
                      </p>
                    </div>
                    <div className="text-xs md:text-sm text-gray-500 flex items-center ml-2 flex-shrink-0">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">
                        {created.toLocaleDateString("id-ID")}
                      </span>
                      <span className="sm:hidden">
                        {created.toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
              {customers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm md:text-base">Belum ada pelanggan</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
