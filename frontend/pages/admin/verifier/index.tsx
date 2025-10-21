import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startTransition, useRef } from "react";
import { Link } from "react-router-dom";
import usePageMeta from "@/src/lib/usePageMeta";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";


/* ===================== Types ===================== */
type Order = {
  id: number;
  title: string;
  notes?: string | null;
  product_type?: string | null;
  material?: string | null;
  vendor_choice?: string | null; // <- nama vendor client

  width_cm?: number | null;
  height_cm?: number | null;
  quantity?: number | null;

  unit_price?: number | null;
  pricing_basis?: "cm2" | "item" | string | null;
  amount_subtotal?: number | null;
  tax_ppn?: number | null;
  amount_total?: number | null;

  status: "pending" | "verifikasi" | "cancel" | "approved" | "done" | string;
  completed_at?: string | null;
  completed_by?: number | null;

  vendor_whitelisted?: number | boolean;
  payment_required?: number | boolean;
  payment_deadline?: string | null;
  payment_url?: string | null;
  paid_at?: string | null;

  approved_at?: string | null;
  approved_by?: number | null;

  client_id?: number;
  client_name?: string | null;
  client_email?: string | null;
  created_at: string;

  design_files?: DesignFile[] | null;
};

type DesignFile = {
  name?: string;
  url: string;
  size?: number;
  mime?: string;
};

/* ===================== Utils ===================== */
const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

const fmtIDR = (n?: number | null) =>
  typeof n === "number"
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(Math.round(n))
    : "-";

// gunakan generic agar hasilnya bertipe benar (Order[])
// 👇 letakkan bersama utils di file yang sama (atas file)
async function toArray<T = any>(resp: Response | null): Promise<T[]> {
  if (!resp) return [];
  if (resp.status === 304) return []; // abaikan cached
  try {
    const data = await resp.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

const VENDOR_LABELS: Record<string, string> = {
  kubus: "Kubus",
  fma: "FMA",
  none: "none",
  lainnya: "lainnya",
};
const fmtVendor = (v?: string | null) => {
  const key = String(v || "").toLowerCase();
  return (
    VENDOR_LABELS[key] || (key ? key[0].toUpperCase() + key.slice(1) : "none")
  );
};

const absUrl = (u: string) =>
  /^https?:\/\//i.test(u) ? u : `${baseURL.replace(/\/$/, "")}${u}`;

const parseDesignFiles = (v: any): DesignFile[] => {
  try {
    const raw = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const normalizeOrders = (arr: any[]): Order[] =>
  (Array.isArray(arr) ? arr : []).map((o) => ({
    ...o,
    design_files: parseDesignFiles(o?.design_files),
  }));

function useCountdown(deadline?: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const d = new Date(
      deadline.includes("T") ? deadline : deadline.replace(" ", "T") + "Z"
    );
    const tick = () => setLeft(d.getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const finished = !deadline || left <= 0;
  const mm = Math.max(0, Math.floor(left / 1000 / 60));
  const ss = Math.max(0, Math.floor((left / 1000) % 60));
  return { finished, mm, ss };
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 rounded-full text-xs",
    verifikasi:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full text-xs",
    approved:
      "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 px-2 py-0.5 rounded-full text-xs",
    cancel:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-2 py-0.5 rounded-full text-xs",
    done: "bg-teal-50 text-teal-700 ring-1 ring-teal-200 px-2 py-0.5 rounded-full text-xs",
  };
  return (
    <span className={map[status] || "px-2 py-0.5 rounded-full text-xs"}>
      {status}
    </span>
  );
}

/* ===================== Page ===================== */
export default function VerifierDashboard() {
  usePageMeta({ title: "Admin Verifikasi", brand: "" });
  const reqIdRef = useRef(0);
  const [orders, setOrders] = useState<Order[]>([]); // PENDING
  const [toApprove, setToApprove] = useState<Order[]>([]); // VERIFIKASI
  const [approved, setApproved] = useState<Order[]>([]); // APPROVED
  const [canceled, setCanceled] = useState<Order[]>([]); // CANCELED
  const [done, setDone] = useState<Order[]>([]); // COMPLETED
  const [loading, setLoading] = useState(false);
  const [vendorDlgOpen, setVendorDlgOpen] = useState(false);
  const [vendorList, setVendorList] = useState<
    { id: number; name: string; is_whitelisted: number }[]
  >([]);
  const [targetClient, setTargetClient] = useState<{
    id: number;
    name?: string;
  } | null>(null);
  const [pickVendor, setPickVendor] = useState<string>("");
  const [newVendor, setNewVendor] = useState("");

  // buka dialog (load vendor dari backend)
  const openVendorDialog = async (client: { id: number; name?: string }) => {
    setTargetClient(client);
    const r = await fetch(`${baseURL}/api/admin/vendors`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (r.ok) setVendorList(await r.json());
    setVendorDlgOpen(true);
  };

  const saveVendor = async () => {
    if (!targetClient) return;

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const bodyFor = (name: string) =>
      JSON.stringify({
        vendor_name: name,
        whitelist: true, // << penting
        apply_open_orders: true, // << penting
      });

    if (newVendor.trim()) {
      const name = newVendor.trim();

      // buat vendor baru + whitelist
      await fetch(`${baseURL}/api/admin/vendors`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, is_whitelisted: true }),
      });

      // tempel ke client + pindahkan order aktif
      await fetch(`${baseURL}/api/admin/clients/${targetClient.id}/vendor`, {
        method: "PATCH",
        headers,
        body: bodyFor(name),
      });
    } else if (pickVendor) {
      await fetch(`${baseURL}/api/admin/clients/${targetClient.id}/vendor`, {
        method: "PATCH",
        headers,
        body: bodyFor(pickVendor),
      });
    }

    setVendorDlgOpen(false);
    setPickVendor("");
    setNewVendor("");
    setTargetClient(null);
    fetchOrders();
  };

  // filters
  const [q, setQ] = useState("");
  const [vendorFilter, setVendorFilter] = useState<
    "all" | "whitelist" | "needpay"
  >("all");
  const [qApprove, setQApprove] = useState("");

  // auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);

  // selection (bulk)
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedApprove, setSelectedApprove] = useState<number[]>([]);

  // detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);

  // prevent double-click spam
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const token = localStorage.getItem("admin_verifier_token");

  const uniqById = (arr: Order[]) => {
    const m = new Map<number, Order>();
    arr.forEach((o) => m.set(o.id, o));
    return Array.from(m.values());
  };

  /* -------- fetch -------- */
  const safeFetchJson = async (url: string) => {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null; // 404/500 → anggap belum tersedia
      return await r.json();
    } catch {
      return null;
    }
  };

  const fetchOrders = async () => {
    if (!token) {
      window.location.href = "/admin/verifier/login";
      return;
    }

    const myId = ++reqIdRef.current; // ← id batch ini
    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [p1, p2, p3, p4, p5] = await Promise.all([
        fetch(`${baseURL}/api/admin/orders/pending`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${baseURL}/api/admin/orders/for-approval`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${baseURL}/api/admin/verify/orders?status=approved`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${baseURL}/api/admin/verify/orders?status=cancel`, {
          headers,
          cache: "no-store",
        }),
        fetch(`${baseURL}/api/admin/verify/orders?status=done`, {
          headers,
          cache: "no-store",
        }),
      ]);

      if (p1.status === 401 || p2.status === 401) {
        localStorage.removeItem("admin_verifier_token");
        window.location.href = "/admin/verifier/login";
        return;
      }

      // parse SEMUA dulu
      const [o1, o2, o3, o4, o5] = await Promise.all([
        toArray<Order>(p1),
        toArray<Order>(p2),
        toArray<Order>(p3),
        toArray<Order>(p4),
        toArray<Order>(p5),
      ]);

      // kalau sudah ada batch yang lebih baru, abaikan hasil ini
      if (myId !== reqIdRef.current) return;

      // update state sekali jalan (opsional pakai startTransition)
      startTransition(() => {
        setOrders(normalizeOrders(o1));
        setToApprove(normalizeOrders(o2));
        setApproved(normalizeOrders(o3));
        setCanceled(normalizeOrders(o4));
        setDone(normalizeOrders(o5));
        setSelected([]);
        setSelectedApprove([]);
      });
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  };

  // Load dari localStorage saat mount
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem("verifier_approved") || "[]");
      const c = JSON.parse(localStorage.getItem("verifier_canceled") || "[]");
      if (Array.isArray(a)) setApproved(a);
      if (Array.isArray(c)) setCanceled(c);
    } catch {}
  }, []);

  // Save setiap berubah
  useEffect(() => {
    localStorage.setItem("verifier_approved", JSON.stringify(approved));
  }, [approved]);

  useEffect(() => {
    localStorage.setItem("verifier_canceled", JSON.stringify(canceled));
  }, [canceled]);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchOrders, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const logout = () => {
    localStorage.removeItem("admin_verifier_token");
    window.location.href = "/admin/verifier/login";
  };

  /* -------- filtering -------- */
  const list = useMemo(() => {
    let arr = Array.isArray(orders) ? [...orders] : [];
    const kw = q.trim().toLowerCase();
    if (kw) {
      arr = arr.filter((o) => {
        return (
          o.title?.toLowerCase().includes(kw) ||
          (o.notes || "").toLowerCase().includes(kw) ||
          (o.product_type || "").toLowerCase().includes(kw) ||
          (o.material || "").toLowerCase().includes(kw) ||
          (o.client_name || "").toLowerCase().includes(kw) ||
          (o.client_email || "").toLowerCase().includes(kw)
        );
      });
    }
    if (vendorFilter !== "all") {
      arr = arr.filter((o) => {
        const needPay = o.payment_required === true || o.payment_required === 1;
        return vendorFilter === "needpay" ? needPay : !needPay;
      });
    }
    // butuh bayar & mepet deadline dinaikkan
    arr.sort((a, b) => {
      const aNeed = a.payment_required ? 1 : 0;
      const bNeed = b.payment_required ? 1 : 0;
      if (aNeed !== bNeed) return bNeed - aNeed;
      const at = a.payment_deadline
        ? new Date(a.payment_deadline.replace(" ", "T") + "Z").getTime()
        : 0;
      const bt = b.payment_deadline
        ? new Date(b.payment_deadline.replace(" ", "T") + "Z").getTime()
        : 0;
      return at - bt;
    });
    return arr;
  }, [orders, q, vendorFilter]);

  const pendingWhitelist = useMemo(
    () =>
      list.filter(
        (o) => !(o.payment_required === true || o.payment_required === 1)
      ),
    [list]
  );
  const pendingNeedPay = useMemo(
    () =>
      list.filter(
        (o) => o.payment_required === true || o.payment_required === 1
      ),
    [list]
  );

  const listApprove = useMemo(() => {
    let arr = Array.isArray(toApprove) ? [...toApprove] : [];
    const kw = qApprove.trim().toLowerCase();
    if (kw) {
      arr = arr.filter((o) => {
        return (
          o.title?.toLowerCase().includes(kw) ||
          (o.notes || "").toLowerCase().includes(kw) ||
          (o.product_type || "").toLowerCase().includes(kw) ||
          (o.material || "").toLowerCase().includes(kw) ||
          (o.client_name || "").toLowerCase().includes(kw) ||
          (o.client_email || "").toLowerCase().includes(kw)
        );
      });
    }
    return arr;
  }, [toApprove, qApprove]);

  const approvedWhitelist = useMemo(
    () =>
      (Array.isArray(approved) ? approved : []).filter(
        (o) => !(o.payment_required === true || o.payment_required === 1)
      ),
    [approved]
  );
  const approvedNeedPay = useMemo(
    () =>
      (Array.isArray(approved) ? approved : []).filter(
        (o) => o.payment_required === true || o.payment_required === 1
      ),
    [approved]
  );

  const doneWhitelist = useMemo(
    () =>
      (Array.isArray(done) ? done : []).filter(
        (o) => !(o.payment_required === true || o.payment_required === 1)
      ),
    [done]
  );
  const doneNeedPay = useMemo(
    () =>
      (Array.isArray(done) ? done : []).filter(
        (o) => o.payment_required === true || o.payment_required === 1
      ),
    [done]
  );

  /* -------- KPI -------- */
  const kpi = useMemo(() => {
    const totalPending = orders.length;
    const needPay = orders.filter((o) => o.payment_required).length;
    const whitelist = totalPending - needPay;
    const waitApproval = toApprove.length;

    const totalNominal =
      orders.reduce((s, o) => s + (o.amount_total || 0), 0) +
      toApprove.reduce((s, o) => s + (o.amount_total || 0), 0);
    return {
      totalPending,
      needPay,
      whitelist,
      waitApproval,
      totalNominal,
      approvedCount: approved.length,
      canceledCount: canceled.length,
    };
  }, [orders, toApprove, approved, canceled]);

  /* -------- selection helpers -------- */
  const toggleSelect = (id: number, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );
  };
  const selectAll = (checked: boolean) => {
    setSelected(checked ? list.map((o) => o.id) : []);
  };

  const toggleSelectApprove = (id: number, checked: boolean) => {
    setSelectedApprove((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );
  };
  const selectAllApprove = (checked: boolean) => {
    setSelectedApprove(checked ? listApprove.map((o) => o.id) : []);
  };

  /* === boleh verifikasi? (wajib bayar & belum bayar => false) === */
  const canVerify = (o: Order) => {
    const needPay = o.payment_required === true || o.payment_required === 1;
    return !needPay || !!o.paid_at;
  };

  // pilih semua untuk subset tertentu
  const selectAllSubset = (subset: Order[], checked: boolean) => {
    setSelected((prev) => {
      if (checked)
        return Array.from(new Set([...prev, ...subset.map((o) => o.id)]));
      const rm = new Set(subset.map((o) => o.id));
      return prev.filter((id) => !rm.has(id));
    });
  };

  /* -------- actions -------- */
  // ubah pending -> verifikasi / cancel (bulk)
  // ubah pending -> verifikasi / cancel (bulk) + guard belum bayar
  const patchStatus = async (
    ids: number[],
    status: "verifikasi" | "cancel"
  ) => {
    if (!ids.length) return;

    let targetIds = ids;

    // kalau verifikasi, saring hanya yang eligible (sudah bayar, atau whitelist)
    if (status === "verifikasi") {
      const eligibles = ids.filter((id) => {
        const o = orders.find((x) => x.id === id);
        return o ? canVerify(o) : false;
      });
      const skipped = ids.filter((id) => !eligibles.includes(id));

      if (!eligibles.length) {
        alert(
          "Semua pesanan yang dipilih belum dibayar. Tidak ada yang diverifikasi."
        );
        return;
      }
      if (skipped.length) {
        alert(`Dilewati karena belum dibayar: ${skipped.join(", ")}`);
      }
      targetIds = eligibles;
    }

    const sure = confirm(
      `${status === "verifikasi" ? "Verifikasi" : "Cancel"} ${
        targetIds.length
      } pesanan?`
    );
    if (!sure) return;

    for (const id of targetIds) {
      await fetch(`${baseURL}/api/admin/orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
    }
    await fetchOrders();
  };

  // approve / reject (verifikasi -> approved/cancel) dengan optimistic + dedupe + anti-spam
  const approveOrders = async (ids: number[]) => {
    if (!ids.length) return;
    const sure = confirm(`Approve ${ids.length} pesanan?`);
    if (!sure) return;

    setBusyIds((s) => new Set([...Array.from(s), ...ids]));

    setToApprove((prev) => {
      const moved = prev.filter((o) => ids.includes(o.id));
      setApproved((ap) =>
        uniqById([
          ...ap,
          ...moved.map((o) => ({
            ...o,
            status: "approved",
            approved_at: new Date().toISOString(),
          })),
        ])
      );
      return prev.filter((o) => !ids.includes(o.id));
    });

    for (const id of ids) {
      await fetch(`${baseURL}/api/admin/orders/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    setBusyIds((s) => {
      const t = new Set(Array.from(s));
      ids.forEach((id) => t.delete(id));
      return t;
    });

    await fetchOrders();
  };

  const rejectOrders = async (ids: number[]) => {
    if (!ids.length) return;
    const sure = confirm(`Reject ${ids.length} pesanan?`);
    if (!sure) return;

    setBusyIds((s) => new Set([...Array.from(s), ...ids]));

    setToApprove((prev) => {
      const moved = prev.filter((o) => ids.includes(o.id));
      setCanceled((cc) =>
        uniqById([
          ...cc,
          ...moved.map((o) => ({
            ...o,
            status: "cancel",
            canceled_at: new Date().toISOString(),
          })),
        ])
      );
      return prev.filter((o) => !ids.includes(o.id));
    });

    for (const id of ids) {
      await fetch(`${baseURL}/api/admin/orders/${id}/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    setBusyIds((s) => {
      const t = new Set(Array.from(s));
      ids.forEach((id) => t.delete(id));
      return t;
    });

    await fetchOrders();
  };

  // approve / reject sudah ada di atas

  const completeOrders = async (ids: number[]) => {
    if (!ids.length) return;
    const sure = confirm(`Tandai selesai ${ids.length} pesanan?`);
    if (!sure) return;

    setBusyIds((s) => new Set([...Array.from(s), ...ids]));

    // Optimistic: approved -> done
    setApproved((prev) => {
      const moved = prev.filter((o) => ids.includes(o.id));
      setDone((d) =>
        uniqById([
          ...d,
          ...moved.map((o) => ({
            ...o,
            status: "done",
            completed_at: new Date().toISOString(),
          })),
        ])
      );
      return prev.filter((o) => !ids.includes(o.id));
    });

    for (const id of ids) {
      await fetch(`${baseURL}/api/admin/orders/${id}/complete`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    setBusyIds((s) => {
      const t = new Set(Array.from(s));
      ids.forEach((id) => t.delete(id));
      return t;
    });

    await fetchOrders();
  };

  const openDetail = (o: Order) => {
    setDetail({
      ...o,
      design_files: parseDesignFiles((o as any).design_files),
    });
    setDetailOpen(true);
  };

  /* -------- UI -------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Topbar */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold">Admin Verifikasi</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/verifier/clients">Kelola Client</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/verifier/vendors">Kelola Vendor</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrders}
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
        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="text-xs text-slate-500">Pending</div>
              <div className="text-2xl font-bold">{kpi.totalPending}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="text-xs text-slate-500">Butuh Bayar</div>
              <div className="text-2xl font-bold">{kpi.needPay}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="text-xs text-slate-500">Vendor Whitelist</div>
              <div className="text-2xl font-bold">{kpi.whitelist}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="text-xs text-slate-500">Menunggu Approval</div>
              <div className="text-2xl font-bold">{kpi.waitApproval}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-5">
              <div className="text-xs text-slate-500">Nominal Tertahan</div>
              <div className="text-2xl font-bold">
                {fmtIDR(kpi.totalNominal)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PENDING */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            <CardTitle className="text-lg">Pesanan Pending</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Cari judul/nama/material"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-64"
                />
                <Select
                  value={vendorFilter}
                  onValueChange={(v: any) => setVendorFilter(v)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Filter vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua vendor</SelectItem>
                    <SelectItem value="needpay">Butuh bayar dulu</SelectItem>
                    <SelectItem value="whitelist">Vendor whitelist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-600">Auto-refresh</Label>
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh((s) => !s)}
                >
                  {autoRefresh ? "ON" : "OFF"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selected.length}
                  onClick={() => patchStatus(selected, "verifikasi")}
                >
                  Verifikasi ({selected.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selected.length}
                  onClick={() => patchStatus(selected, "cancel")}
                >
                  Cancel ({selected.length})
                </Button>
              </div>
            </div>

            <div className="mt-4">
              {list.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Tidak ada pesanan pending.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Kolom 1: Vendor Whitelist (bayar nanti) */}
                  <div className="rounded-xl border bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b flex items-center justify-between">
                      <div className="font-medium">
                        Vendor Whitelist (Bayar nanti)
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={
                            pendingWhitelist.length > 0 &&
                            pendingWhitelist.every((o) =>
                              selected.includes(o.id)
                            )
                          }
                          onChange={(e) =>
                            selectAllSubset(pendingWhitelist, e.target.checked)
                          }
                        />
                        <span>Pilih semua ({pendingWhitelist.length})</span>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {pendingWhitelist.length === 0 ? (
                        <div className="text-sm text-slate-500">
                          Tidak ada data.
                        </div>
                      ) : (
                        pendingWhitelist.map((o) => (
                          <PendingItem
                            key={o.id}
                            o={o}
                            checked={selected.includes(o.id)}
                            onToggle={(checked) => toggleSelect(o.id, checked)}
                            onDetail={() => openDetail(o)}
                            onVerify={() => patchStatus([o.id], "verifikasi")}
                            onCancel={() => patchStatus([o.id], "cancel")}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Kolom 2: Non-vendor / Wajib Bayar */}
                  <div className="rounded-xl border bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b flex items-center justify-between">
                      <div className="font-medium">
                        Non-vendor / Wajib bayar dulu
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={
                            pendingNeedPay.length > 0 &&
                            pendingNeedPay.every((o) => selected.includes(o.id))
                          }
                          onChange={(e) =>
                            selectAllSubset(pendingNeedPay, e.target.checked)
                          }
                        />
                        <span>Pilih semua ({pendingNeedPay.length})</span>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {pendingNeedPay.length === 0 ? (
                        <div className="text-sm text-slate-500">
                          Tidak ada data.
                        </div>
                      ) : (
                        pendingNeedPay.map((o) => (
                          <PendingItem
                            key={o.id}
                            o={o}
                            checked={selected.includes(o.id)}
                            onToggle={(checked) => toggleSelect(o.id, checked)}
                            onDetail={() => openDetail(o)}
                            onVerify={() => patchStatus([o.id], "verifikasi")}
                            onCancel={() => patchStatus([o.id], "cancel")}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MENUNGGU APPROVAL */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
            <CardTitle className="text-lg">Menunggu Approval</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <Input
                placeholder="Cari judul/nama/material"
                value={qApprove}
                onChange={(e) => setQApprove(e.target.value)}
                className="w-64"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedApprove.length}
                  onClick={() => approveOrders(selectedApprove)}
                >
                  Approve ({selectedApprove.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedApprove.length}
                  onClick={() => rejectOrders(selectedApprove)}
                >
                  Reject ({selectedApprove.length})
                </Button>
              </div>
            </div>

            <div className="mt-4">
              {listApprove.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Tidak ada pesanan menunggu approval.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedApprove.length === listApprove.length}
                      onChange={(e) => selectAllApprove(e.target.checked)}
                    />
                    <span className="text-sm text-slate-600">
                      Pilih semua ({listApprove.length})
                    </span>
                  </div>

                  <div className="space-y-3">
                    {listApprove.map((o) => (
                      <div
                        key={o.id}
                        className="rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:shadow-sm transition"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selectedApprove.includes(o.id)}
                            onChange={(e) =>
                              toggleSelectApprove(o.id, e.target.checked)
                            }
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-semibold">{o.title}</div>
                              <StatusChip status={o.status} />
                              {o.payment_required === true ||
                              o.payment_required === 1 ? (
                                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                                  Non-vendor
                                </span>
                              ) : (
                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                                  Whitelist
                                </span>
                              )}

                              {(() => {
                                const needPay =
                                  o.payment_required === true ||
                                  o.payment_required === 1;
                                return needPay ? (
                                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                                    Non-vendor
                                  </span>
                                ) : (
                                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                                    Whitelist
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="text-xs text-slate-500">
                              {o.product_type} • {o.material}
                              {o.client_name && <> • {o.client_name}</>}
                              {o.client_email && <> ({o.client_email})</>}
                            </div>
                            {typeof o.amount_total === "number" && (
                              <div className="text-sm font-semibold">
                                Total: {fmtIDR(o.amount_total)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(o)}
                          >
                            Detail
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyIds.has(o.id)}
                            onClick={() => completeOrders([o.id])}
                          >
                            {busyIds.has(o.id) ? "..." : "Selesai"}
                          </Button>

                          {o.client_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openVendorDialog({
                                  id: o.client_id!,
                                  name: o.client_name || undefined,
                                })
                              }
                              title="Pindahkan client ke vendor whitelist / ganti vendor"
                            >
                              Ubah vendor
                            </Button>
                          )}

                          <Button
                            size="sm"
                            disabled={busyIds.has(o.id)}
                            onClick={() => approveOrders([o.id])}
                          >
                            {busyIds.has(o.id) ? "..." : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyIds.has(o.id)}
                            onClick={() => rejectOrders([o.id])}
                          >
                            {busyIds.has(o.id) ? "..." : "Reject"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SIAP DIKERJAKAN (APPROVED) */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
            <CardTitle className="text-lg">
              Siap Dikerjakan (Approved)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {approved.length === 0 ? (
              <div className="text-sm text-slate-500">
                Belum ada pesanan approved.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kolom A: Whitelist / bayar nanti */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b font-medium">
                    Whitelist (Bayar nanti)
                  </div>
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                    {approvedWhitelist.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        Tidak ada data.
                      </div>
                    ) : (
                      approvedWhitelist.map((o) => {
                        const vendor = o.vendor_choice || "whitelist";
                        return (
                          <div
                            key={o.id}
                            className="rounded-xl border p-4 bg-white flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium">{o.title}</div>
                              <div className="text-xs text-slate-500">
                                {o.product_type} • {o.material}
                                {o.client_name && (
                                  <> • Pelanggan: {o.client_name}</>
                                )}
                                {" • "}Vendor:{" "}
                                <b>{fmtVendor(o.vendor_choice)}</b>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusChip status="approved" />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetail(o)}
                              >
                                Detail
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Kolom B: Non-vendor / Wajib bayar */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b font-medium">
                    Non-vendor / Wajib bayar dulu
                  </div>
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                    {approvedNeedPay.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        Tidak ada data.
                      </div>
                    ) : (
                      approvedNeedPay.map((o) => (
                        <div
                          key={o.id}
                          className="rounded-xl border p-4 bg-white flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{o.title}</div>
                            <div className="text-xs text-slate-500">
                              {o.product_type} • {o.material}
                              {o.client_name && (
                                <> • Pelanggan: {o.client_name}</>
                              )}
                              {" • "}Vendor: <b>{fmtVendor(o.vendor_choice)}</b>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status="approved" />
                            {o.client_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  openVendorDialog({
                                    id: o.client_id!,
                                    name: o.client_name || undefined,
                                  })
                                }
                                title="Pindahkan client ke vendor whitelist / ganti vendor"
                              >
                                Ubah vendor
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDetail(o)}
                            >
                              Detail
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SELESAI DIKERJAKAN (COMPLETED) */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
            <CardTitle className="text-lg">
              Selesai Dikerjakan (Completed)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {(done?.length ?? 0) === 0 ? (
              <div className="text-sm text-slate-500">
                Belum ada pesanan selesai.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kolom: Whitelist */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b font-medium">
                    Whitelist (Bayar nanti)
                  </div>
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                    {doneWhitelist.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        Tidak ada data.
                      </div>
                    ) : (
                      doneWhitelist.map((o) => (
                        <div
                          key={o.id}
                          className="rounded-xl border p-4 bg-white flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{o.title}</div>
                            <div className="text-xs text-slate-500">
                              {o.product_type} • {o.material}
                              {o.client_name && (
                                <> • Pelanggan: {o.client_name}</>
                              )}
                              {" • "}Vendor: <b>{fmtVendor(o.vendor_choice)}</b>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status="done" />
                            <Button
                              variant="outline"
                              onClick={() => openDetail(o)}
                            >
                              Detail
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Kolom: Non-vendor */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b font-medium">
                    Non-vendor / Wajib bayar dulu
                  </div>
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                    {doneNeedPay.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        Tidak ada data.
                      </div>
                    ) : (
                      doneNeedPay.map((o) => (
                        <div
                          key={o.id}
                          className="rounded-xl border p-4 bg-white flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{o.title}</div>
                            <div className="text-xs text-slate-500">
                              {o.product_type} • {o.material}
                              {o.client_name && (
                                <> • Pelanggan: {o.client_name}</>
                              )}
                              {" • "}Vendor: <b>{fmtVendor(o.vendor_choice)}</b>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip status="done" />
                            <Button
                              variant="outline"
                              onClick={() => openDetail(o)}
                            >
                              Detail
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DIBATALKAN (CANCELED) — section penuh */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-rose-600 to-pink-600 text-white">
            <CardTitle className="text-lg">Dibatalkan (Canceled)</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {canceled.length === 0 ? (
              <div className="text-sm text-slate-500">
                Belum ada pesanan canceled.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
                {canceled.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-xl border p-4 bg-white flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{o.title}</div>
                      <div className="text-xs text-slate-500">
                        {o.product_type} • {o.material}
                        {o.client_name && <> • {o.client_name}</>}
                        {o.client_email && <> ({o.client_email})</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status="cancel" />
                      <Button variant="outline" onClick={() => openDetail(o)}>
                        Detail
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Pesanan</DialogTitle>
            <DialogDescription className="text-slate-600">
              Rincian item & perhitungan harga.
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-slate-50 border p-3">
                <div className="font-semibold">{detail.title}</div>
                <div className="text-xs text-slate-500">
                  {detail.product_type} • {detail.material}
                  {detail.client_name && ` • ${detail.client_name}`}
                </div>
                {detail.notes && <div className="mt-1">{detail.notes}</div>}
                <div className="mt-1">
                  <StatusChip status={detail.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>Qty</div>
                <div className="text-right">{detail.quantity || 1}</div>
                <div>
                  Harga satuan{" "}
                  {detail.pricing_basis === "cm2" ? "(per cm²)" : "(per item)"}
                </div>
                <div className="text-right">
                  {fmtIDR(detail.unit_price || 0)}
                </div>
                {detail.pricing_basis === "cm2" && (
                  <>
                    <div>Ukuran (cm)</div>
                    <div className="text-right">
                      {detail.width_cm || 0} × {detail.height_cm || 0}
                    </div>
                  </>
                )}
                <div className="border-t pt-2">Sub-total</div>
                <div className="border-t pt-2 text-right">
                  {fmtIDR(detail.amount_subtotal || 0)}
                </div>
                <div>PPN</div>
                <div className="text-right">{fmtIDR(detail.tax_ppn || 0)}</div>
                <div className="border-t pt-2 font-semibold">Total</div>
                <div className="border-t pt-2 font-semibold text-right">
                  {fmtIDR(detail.amount_total || 0)}
                </div>
              </div>

              {/* ---------- START: Lampiran desain ---------- */}
              {(() => {
                const files = Array.isArray(detail.design_files)
                  ? detail.design_files
                  : parseDesignFiles((detail as any).design_files);

                return files.length > 0 ? (
                  <div className="pt-3 border-t">
                    <div className="font-semibold mb-2">File Desain</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {files.map((f, i) => {
                        const url = /^https?:\/\//i.test(f.url)
                          ? f.url
                          : `${baseURL.replace(/\/$/, "")}${f.url}`;
                        const isImg =
                          (f.mime && f.mime.startsWith("image/")) ||
                          /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || "");

                        return (
                          <div
                            key={i}
                            className="rounded-md border bg-slate-50 p-2 text-xs flex flex-col gap-2"
                          >
                            {isImg ? (
                              <a href={url} target="_blank" rel="noreferrer">
                                <img
                                  src={url}
                                  alt={f.name || "design"}
                                  className="w-full h-28 object-cover rounded"
                                />
                              </a>
                            ) : (
                              <div className="h-28 rounded flex items-center justify-center bg-white border">
                                <span className="text-slate-400">
                                  Bukan gambar
                                </span>
                              </div>
                            )}
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-indigo-600 hover:underline"
                              title={f.name || url}
                            >
                              {f.name || url.split("/").pop()}
                            </a>
                            {typeof f.size === "number" && (
                              <div className="text-[11px] text-slate-500">
                                {(f.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}
              {/* ---------- END: Lampiran desain ---------- */}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Tutup
                </Button>
                {detail &&
                  detail.status === "pending" &&
                  (() => {
                    const needPay =
                      detail.payment_required === true ||
                      detail.payment_required === 1;
                    const unpaid = needPay && !detail.paid_at;
                    return (
                      <>
                        <Button
                          onClick={() => patchStatus([detail.id], "verifikasi")}
                          disabled={unpaid}
                          title={unpaid ? "Belum dibayar" : ""}
                        >
                          Verifikasi
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => patchStatus([detail.id], "cancel")}
                        >
                          Cancel
                        </Button>
                      </>
                    );
                  })()}

                {detail && detail.status === "verifikasi" && (
                  <>
                    <Button
                      disabled={busyIds.has(detail.id)}
                      onClick={() => approveOrders([detail.id])}
                    >
                      {busyIds.has(detail.id) ? "..." : "Approve"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busyIds.has(detail.id)}
                      onClick={() => rejectOrders([detail.id])}
                    >
                      {busyIds.has(detail.id) ? "..." : "Reject"}
                    </Button>
                  </>
                )}
                {detail && detail.status === "approved" && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busyIds.has(detail.id)}
                      onClick={() => completeOrders([detail.id])}
                    >
                      {busyIds.has(detail.id) ? "..." : "Selesai"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <Select value={pickVendor} onValueChange={setPickVendor}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendorList
                    .filter((v) => v.is_whitelisted === 1)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.name}>
                        {v.name}
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
    </div>
  );
}

type PendingItemProps = {
  o: Order;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  onDetail: () => void;
  onVerify: () => void;
  onCancel: () => void;
};

function PendingItem({
  o,
  checked,
  onToggle,
  onDetail,
  onVerify,
  onCancel,
}: PendingItemProps) {
  const needPay = o.payment_required === true || o.payment_required === 1;
  const { finished, mm, ss } = useCountdown(o.payment_deadline);

  // ⬅️ baris tambahan: kalau wajib bayar & belum bayar → tombol verifikasi dimatikan
  const unpaid = needPay && !o.paid_at;

  return (
    <div className="rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold">{o.title}</div>
            <StatusChip status={o.status} />
            {needPay ? (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                Bayar dulu
              </span>
            ) : (
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
                Whitelist
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500">
            {o.product_type && <b>{o.product_type}</b>}{" "}
            {o.material && <>• {o.material}</>}
            {o.client_name && <> • {o.client_name}</>}
            {o.client_email && <> ({o.client_email})</>}
          </div>

          {o.notes && <div className="text-sm text-slate-600">{o.notes}</div>}

          <div className="text-xs text-slate-400">
            {new Date(o.created_at).toLocaleString()}
          </div>

          {typeof o.amount_total === "number" && (
            <div className="text-sm font-semibold">
              Total: {fmtIDR(o.amount_total)}
            </div>
          )}

          {needPay && o.status === "pending" && (
            <div className="text-xs">
              Batas bayar:{" "}
              <span className={finished ? "text-rose-600" : "text-amber-600"}>
                {finished
                  ? "waktu habis"
                  : `${String(mm).padStart(2, "0")}:${String(ss).padStart(
                      2,
                      "0"
                    )}`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDetail}>
          Detail
        </Button>
        {o.payment_url && needPay && (
          <a
            href={o.payment_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-2 rounded bg-slate-800 text-white hover:bg-slate-900"
          >
            Link Bayar
          </a>
        )}
        {/* ⬇️ tombol verifikasi dimatikan jika belum bayar */}
        <Button
          size="sm"
          onClick={onVerify}
          disabled={unpaid}
          title={unpaid ? "Belum dibayar" : ""}
        >
          Verifikasi
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
