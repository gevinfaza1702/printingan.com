import React, { useEffect, useMemo, useState } from "react";
import brandLogo from "../../src/assets/brand-logo.png";
import usePageMeta from "@/src/lib/usePageMeta";
import {
  ShoppingBag,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  User,
  CreditCard,
  FileText,
  TrendingUp,
  Palette,
  Layers,
  Zap,
  ArrowRight,
  Plus,
  Search,
  Filter,
  RefreshCw,
  LogOut,
  AlertCircle,
  FileUp,
  X,
  ChevronRight,
  Timer,
  DollarSign,
  Ruler,
  Hash,
  Check,
} from "lucide-react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";


// ===================== Types =====================
interface ClientProfile {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  vendor_choice: string;
  vendor_other?: string | null;
  is_approved?: number | boolean | "0" | "1" | "true" | "false";
}

interface ClientOrder {
  id: number;
  title: string;
  notes?: string | null;
  status: "pending" | "verifikasi" | "approved" | "done" | "cancel" | string;
  vendor_whitelisted?: number | boolean;
  product_type?: string | null;
  material?: string | null;
  width_cm?: number | null;
  height_cm?: number | null;
  quantity?: number | null;
  unit_price?: number | null;
  pricing_basis?: "cm2" | "item" | string | null;
  amount_subtotal?: number | null;
  tax_ppn?: number | null;
  amount_total?: number | null;
  payment_required?: number | boolean;
  payment_deadline?: string | null;
  payment_url?: string | null;
  paid_at?: string | null;
  created_at: string;
  design_files?: Array<{
    name?: string;
    url: string;
    size?: number;
    mime?: string;
  }> | null;
}

type PricingRate = { per_cm2?: number; per_item?: number };
type CatalogResponse = {
  materials: Record<string, string[]>;
  pricing: Record<string, Record<string, PricingRate>>;
  ppn: number;
  currency: string;
  basis: { cm2: string; item: string };
};

// ===================== Formatters =====================
const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const fmtIDR2 = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

// ===================== Hooks =====================
function useCountdown(deadline?: string | null) {
  const [left, setLeft] = useState(0);

  const toUtcDate = (s?: string | null) => {
    if (!s) return null;
    const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  };

  useEffect(() => {
    const d = toUtcDate(deadline);
    if (!d) return;
    const tick = () => setLeft(d.getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const finished = !deadline || left <= 0;
  const mm = Math.max(0, Math.floor(left / 1000 / 60));
  const ss = Math.max(0, Math.floor((left / 1000) % 60));
  return { mm, ss, finished };
}

// ===================== Components =====================
function StatusBadge({
  status,
}: {
  status: "pending" | "verifikasi" | "approved" | "done" | "cancel" | string;
}) {
  const configs = {
    pending: {
      bg: "bg-gradient-to-r from-amber-500/10 to-orange-500/10",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: <Clock className="w-3 h-3" />,
      label: "Pending",
    },
    verifikasi: {
      bg: "bg-gradient-to-r from-emerald-500/10 to-teal-500/10",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: <FileText className="w-3 h-3" />,
      label: "Verifikasi",
    },
    approved: {
      bg: "bg-gradient-to-r from-blue-500/10 to-indigo-500/10",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Approved",
    },
    done: {
      bg: "bg-gradient-to-r from-green-500/10 to-emerald-500/10",
      border: "border-green-200",
      text: "text-green-700",
      icon: <Check className="w-3 h-3" />,
      label: "Selesai",
    },
    cancel: {
      bg: "bg-gradient-to-r from-red-500/10 to-rose-500/10",
      border: "border-red-200",
      text: "text-red-700",
      icon: <XCircle className="w-3 h-3" />,
      label: "Dibatalkan",
    },
  } as const;

  // aman untuk string apapun, fallback ke pending
  const config = configs[status as keyof typeof configs] ?? configs.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.border} ${config.text}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function OrderCard({ o, baseURL }: { o: ClientOrder; baseURL: string }) {
  const { mm, ss, finished } = useCountdown(o.payment_deadline);
  const requiresPay = o.payment_required === true || o.payment_required === 1;
  const canPayEarly = o.status === "pending" && requiresPay && !o.paid_at;
  const expired = finished;
  const isWhitelist =
    o.vendor_whitelisted === true || o.vendor_whitelisted === 1;
  const canPayAfter = isWhitelist && o.status === "done" && !o.paid_at;
  const payHref = o.payment_url || `${baseURL.replace(/\/$/, "")}/pay/${o.id}`;

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{o.title}</h3>
                <StatusBadge status={o.status} />
              </div>
            </div>

            {(o.product_type || o.material) && (
              <div className="flex flex-wrap gap-2">
                {o.product_type && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-lg text-xs">
                    <Layers className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-700">{o.product_type}</span>
                  </span>
                )}
                {o.material && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-lg text-xs">
                    <Palette className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-700">{o.material}</span>
                  </span>
                )}
              </div>
            )}

            {o.notes && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                {o.notes}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {new Date(o.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {typeof o.amount_total === "number" && o.amount_total > 0 && (
                <div className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {fmtIDR(o.amount_total)}
                </div>
              )}
            </div>

            {o.design_files && o.design_files.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <FileUp className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">
                    File Desain
                  </span>
                </div>
                <div className="space-y-1">
                  {o.design_files.map((f, idx) => (
                    <a
                      key={idx}
                      href={`${baseURL.replace(/\/$/, "")}${f.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <ChevronRight className="w-3 h-3" />
                      {f.name || f.url.split("/").pop()}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {requiresPay && o.status === "pending" && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  expired ? "bg-red-50" : "bg-amber-50"
                }`}
              >
                <Timer
                  className={`w-4 h-4 ${
                    expired ? "text-red-500" : "text-amber-500"
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    expired ? "text-red-700" : "text-amber-700"
                  }`}
                >
                  {expired
                    ? "Waktu pembayaran habis"
                    : `Bayar dalam ${String(mm).padStart(2, "0")}:${String(
                        ss
                      ).padStart(2, "0")}`}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {canPayEarly && (
              <a
                href={payHref}
                target="_blank"
                rel="noreferrer"
                onClick={expired ? (e) => e.preventDefault() : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                  expired
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:scale-105"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Bayar
              </a>
            )}

            {canPayAfter && (
              <a
                href={payHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:scale-105 transition-all"
              >
                <CreditCard className="w-4 h-4" />
                Bayar
              </a>
            )}

            {isWhitelist && o.status === "done" && o.paid_at && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  Lunas
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== Main Component =====================
export default function ClientDashboard() {
  usePageMeta({ title: "Dashboard Client", brand: "" });
  const [me, setMe] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingMe, setLoadingMe] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [productType, setProductType] = useState<string>("");
  const [material, setMaterial] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [widthCm, setWidthCm] = useState<number | string>("");
  const [heightCm, setHeightCm] = useState<number | string>("");
  const [qty, setQty] = useState<number | string>(1);

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [keyword, setKeyword] = useState("");

  const token = localStorage.getItem("client_token");
  const baseURL = "http://localhost:4000";

  const isApproved = (v: any) =>
    v?.is_approved === 1 ||
    v?.is_approved === true ||
    v?.is_approved === "1" ||
    v?.is_approved === "true";

  const vendorDisplay =
    (me?.vendor_choice || "").toLowerCase() === "lainnya" &&
    (me?.vendor_other || "").trim()
      ? (me!.vendor_other as string).trim()
      : me?.vendor_choice || "none";

  const blocked = loadingMe ? true : me ? !isApproved(me) : true;

  useEffect(() => setMaterial(""), [productType]);

  const fetchMe = async () => {
    try {
      const resp = await fetch(`${baseURL}/api/client/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setMe(await resp.json());
    } finally {
      setLoadingMe(false);
    }
  };

  const fetchOrders = async () => {
    const resp = await fetch(`${baseURL}/api/client/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) setOrders(await resp.json());
  };

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${baseURL}/api/catalog/pricing`);
        if (resp.ok) {
          const data = (await resp.json()) as CatalogResponse;
          setCatalog(data);
        }
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchMe();
    fetchOrders();
    const id = setInterval(fetchOrders, 10000);
    return () => clearInterval(id);
  }, []);

  const logout = () => {
    localStorage.removeItem("client_token");
    window.location.href = "/client/login";
  };

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    const next = [...files, ...picked].slice(0, 5);
    setFiles(next);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((arr) => arr.filter((_, i) => i !== idx));
  }

  // Catalog data
  const MATERIALS_MAP = catalog?.materials ?? {};
  const PRODUCT_OPTIONS = Object.keys(MATERIALS_MAP);
  const PPN = Number(catalog?.ppn ?? 0);
  const showTax = PPN > 0;
  const TAX_LABEL = `PPN ${Math.round(PPN * 100)}%`;

  // Pricing
  const rate: PricingRate | undefined =
    catalog?.pricing?.[productType]?.[material || ""];
  const isAreaBased = !!rate?.per_cm2;

  const pricePreview = useMemo(() => {
    if (!rate) return null;
    const q = Math.max(1, Number(qty || 1));
    const w = Math.max(0, Number(widthCm || 0));
    const h = Math.max(0, Number(heightCm || 0));
    let unit = 0,
      basis: "cm2" | "item" = "item",
      subtotal = 0,
      area = 0;

    if (rate.per_cm2 != null) {
      unit = rate.per_cm2;
      basis = "cm2";
      area = w * h;
      subtotal = unit * area * q;
    } else if (rate.per_item != null) {
      unit = rate.per_item;
      basis = "item";
      subtotal = unit * q;
    } else {
      return null;
    }

    const tax = subtotal * PPN;
    return { unit, basis, subtotal, tax, total: subtotal + tax, area, w, h, q };
  }, [rate, widthCm, heightCm, qty, PPN]);

  const isFormValid = useMemo(() => {
    if (!(title.trim() && productType && material && notes.trim()))
      return false;
    if (!rate) return false;

    const q = Math.max(1, Number(qty || 1));
    if (q <= 0) return false;

    if (rate.per_cm2 != null) {
      const w = Number(widthCm || 0);
      const h = Number(heightCm || 0);
      if (w <= 0 || h <= 0) return false;
    }
    return true;
  }, [title, productType, material, notes, widthCm, heightCm, qty, rate]);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setConfirmOpen(true);
  };

  const submitOrder = async () => {
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("notes", notes);
      fd.append("product_type", productType);
      fd.append("material", material);
      fd.append("width_cm", String(Number(widthCm) || 0));
      fd.append("height_cm", String(Number(heightCm) || 0));
      fd.append("quantity", String(Math.max(1, Number(qty) || 1)));

      files.forEach((f) => fd.append("design_files", f));

      const resp = await fetch(`${baseURL}/api/client/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (resp.ok) {
        setTitle("");
        setNotes("");
        setProductType("");
        setMaterial("");
        setWidthCm("");
        setHeightCm("");
        setQty(1);
        setFiles([]);
        setConfirmOpen(false);
        fetchOrders();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const s = {
      total: orders.length,
      pending: 0,
      verifikasi: 0,
      approved: 0,
      done: 0,
      cancel: 0,
    };
    for (const o of orders) {
      const st = String(o.status || "").toLowerCase();
      if (st in s) (s as any)[st] += 1;
    }
    return s;
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      const kw = keyword.trim().toLowerCase();
      if (!kw) return true;
      return (
        o.title.toLowerCase().includes(kw) ||
        (o.notes || "").toLowerCase().includes(kw) ||
        (o.product_type || "").toLowerCase().includes(kw) ||
        (o.material || "").toLowerCase().includes(kw)
      );
    });
  }, [orders, statusFilter, keyword]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Modern Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img
                src={brandLogo}
                alt="Printingan.com"
                className="h-10 w-10 rounded-2xl shadow-lg object-cover"
              />

              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Printingan.com
                </h1>
                <p className="text-xs text-gray-500">
                  Professional Printing Solutions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchMe();
                  fetchOrders();
                }}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section (Aurora) */}
      <section className="relative">
        <AuroraBackground className="opacity-90">
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">
                Welcome back, {me?.full_name || "User"}!
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-xl text-white/90">
                Kelola pesanan cetak Anda dengan mudah. Pilih produk, upload desain,
                dan pantau progress real-time.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                {[
                  { icon: <Zap className="h-4 w-4" />, label: "Proses Cepat" },
                  { icon: <Palette className="h-4 w-4" />, label: "Kualitas Premium" },
                  { icon: <TrendingUp className="h-4 w-4" />, label: "Harga Kompetitif" },
                  { icon: <CheckCircle2 className="h-4 w-4" />, label: "Garansi Kepuasan" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-white backdrop-blur-sm"
                  >
                    {item.icon}
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AuroraBackground>
      </section>


      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats & Profile Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Profil Saya
                  </h3>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {me ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Nama</p>
                      <p className="font-medium text-gray-900">
                        {me.full_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="font-medium text-gray-900 text-sm">
                        {me.email}
                      </p>
                    </div>
                    {me.phone && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Telepon</p>
                        <p className="font-medium text-gray-900">{me.phone}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Vendor</p>
                      <p className="font-medium text-gray-900">
                        {vendorDisplay}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards (Bento) */}
          <div className="lg:col-span-3">
            <BentoGrid>
              <BentoCard
                title="Total"
                value={stats.total}
                gradient="from-gray-400 to-gray-500"
                icon={<Package className="h-4 w-4" />}
              />
              <BentoCard
                title="Pending"
                value={stats.pending}
                gradient="from-amber-400 to-orange-500"
                icon={<Clock className="h-4 w-4" />}
              />
              <BentoCard
                title="Verifikasi"
                value={stats.verifikasi}
                gradient="from-emerald-400 to-teal-500"
                icon={<FileText className="h-4 w-4" />}
              />
              <BentoCard
                title="Approved"
                value={stats.approved}
                gradient="from-blue-400 to-indigo-500"
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
              <BentoCard
                title="Done"
                value={stats.done}
                gradient="from-green-400 to-emerald-500"
                icon={<Check className="h-4 w-4" />}
              />
              <BentoCard
                title="Cancel"
                value={stats.cancel}
                gradient="from-red-400 to-rose-500"
                icon={<XCircle className="h-4 w-4" />}
              />
            </BentoGrid>
          </div>

        </div>

        {/* Create Order Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6">
            <h3 className="text-xl font-semibold text-white">
              Buat Pesanan Baru
            </h3>
            <p className="text-white/90 text-sm mt-1">
              Isi form di bawah untuk membuat pesanan cetak baru
            </p>
          </div>

          <div className="p-6">
            {blocked && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900">
                      Menunggu Verifikasi
                    </h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Akun Anda sedang dalam proses verifikasi. Setelah
                      disetujui, Anda dapat membuat pesanan.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div onSubmit={handleOpenConfirm} className="space-y-6">
              <fieldset
                disabled={blocked || loadingCatalog}
                className={
                  blocked || loadingCatalog
                    ? "opacity-60 pointer-events-none"
                    : ""
                }
              >
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Form Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Judul Pesanan
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Contoh: Spanduk promo pembukaan toko"
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Jenis Produk
                        </label>
                        <select
                          value={productType}
                          onChange={(e) => setProductType(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Pilih produk</option>
                          {PRODUCT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Material
                        </label>
                        <select
                          value={material}
                          onChange={(e) => setMaterial(e.target.value)}
                          disabled={!productType}
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                        >
                          <option value="">
                            {productType
                              ? "Pilih material"
                              : "Pilih produk dulu"}
                          </option>
                          {(MATERIALS_MAP[productType] || []).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Lebar (cm)
                        </label>
                        <input
                          type="number"
                          value={widthCm}
                          onChange={(e) => setWidthCm(e.target.value)}
                          disabled={!isAreaBased}
                          placeholder="200"
                          min="0"
                          step="0.1"
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tinggi (cm)
                        </label>
                        <input
                          type="number"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          disabled={!isAreaBased}
                          placeholder="100"
                          min="0"
                          step="0.1"
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                          placeholder="1"
                          min="1"
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Catatan
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Finishing jahit & ring tiap 50cm"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload File Desain (Maks. 5 file)
                      </label>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.ai,.psd,.cdr,.svg,.jpg,.jpeg,.png,.zip,.rar,image/*"
                        onChange={onPickFiles}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 cursor-pointer transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Pilih File
                      </label>

                      {files.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {files.map((f, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                            >
                              <span className="text-sm text-gray-700 truncate">
                                {f.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFile(i)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Preview */}
                  <div className="lg:sticky lg:top-24 h-fit">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                      <h4 className="font-semibold text-gray-900 mb-4">
                        Estimasi Harga
                      </h4>

                      {pricePreview ? (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              Harga{" "}
                              {pricePreview.basis === "cm2"
                                ? "per cm²"
                                : "per item"}
                            </span>
                            <span className="font-medium">
                              {fmtIDR2(pricePreview.unit)}
                            </span>
                          </div>

                          {pricePreview.basis === "cm2" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Luas (cm²)</span>
                              <span className="font-medium">
                                {Math.round(pricePreview.area)}
                              </span>
                            </div>
                          )}

                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Quantity</span>
                            <span className="font-medium">
                              {pricePreview.q}
                            </span>
                          </div>

                          <div className="pt-3 border-t border-blue-100">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Subtotal</span>
                              <span className="font-medium">
                                {fmtIDR(pricePreview.subtotal)}
                              </span>
                            </div>

                            {showTax && (
                              <div className="flex justify-between text-sm mt-2">
                                <span className="text-gray-600">
                                  {TAX_LABEL}
                                </span>
                                <span className="font-medium">
                                  {fmtIDR(pricePreview.tax)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-blue-100">
                            <div className="flex justify-between">
                              <span className="font-semibold text-gray-900">
                                Total
                              </span>
                              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                {fmtIDR(pricePreview.total)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Pilih jenis produk & material untuk melihat estimasi
                          harga
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleOpenConfirm}
                    disabled={!isFormValid}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                      isFormValid
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:scale-105"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    Buat Pesanan
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Daftar Pesanan
            </h3>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Cari pesanan..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="verifikasi">Verifikasi</option>
                <option value="approved">Approved</option>
                <option value="done">Done</option>
                <option value="cancel">Cancel</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Tidak ada pesanan yang ditemukan</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((order) => (
                <OrderCard key={order.id} o={order} baseURL={baseURL} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setConfirmOpen(false)}
            />

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Konfirmasi Pesanan
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Pastikan semua detail pesanan sudah benar. Pesanan tidak dapat
                dibatalkan setelah dikonfirmasi.
              </p>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Judul:</span>
                  <span className="font-medium">{title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Produk:</span>
                  <span className="font-medium">{productType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Material:</span>
                  <span className="font-medium">{material}</span>
                </div>
                {pricePreview && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-blue-600">
                      {fmtIDR(pricePreview.total)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? "Memproses..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
