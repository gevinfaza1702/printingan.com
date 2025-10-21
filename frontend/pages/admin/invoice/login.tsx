import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import usePageMeta from "@/src/lib/usePageMeta";
import BrandLogo from "@/src/assets/brand-logo.png";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";

const baseURL =
  (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

export default function AdminInvoiceLogin() {
  usePageMeta({ title: "Login Admin Invoice", brand: "" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // sudah login? lempar ke dashboard
  useEffect(() => {
    if (localStorage.getItem("admin_invoice_token")) {
      navigate("/admin/invoice", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`${baseURL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error || r.statusText);
      }

      if (data?.admin?.role !== "invoice") {
        toast({
          title: "Akses ditolak",
          description: "Akun ini bukan admin invoice.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("admin_invoice_token", data.token);
      localStorage.setItem("admin_invoice_profile", JSON.stringify(data.admin));
      navigate("/admin/invoice", { replace: true });
    } catch (err: any) {
      toast({
        title: "Login gagal",
        description: String(err?.message || err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-indigo-50 to-fuchsia-50" />
      <div className="pointer-events-none absolute -left-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-[24rem] w-[24rem] rounded-full bg-fuchsia-300/20 blur-3xl" />

      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 place-items-center px-6 md:grid-cols-2">
        {/* Left: hero */}
        <div className="hidden md:flex md:justify-center">
          <div className="max-w-sm">
            <div className="mb-5 flex items-center gap-3">
              <img
                src={BrandLogo}
                alt="Brand"
                className="h-10 w-10 rounded-xl shadow-sm"
              />
              <div>
                <p className="text-xs tracking-wider text-slate-500">Admin</p>
                <h1 className="bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-pink-600 bg-clip-text text-xl font-extrabold text-transparent">
                  Invoice Management
                </h1>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                🧾 Nomor otomatis
              </li>
              <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                💳 Total & PPN
              </li>
              <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                📤 Cetak & kirim
              </li>
              <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                🔒 Aman & cepat
              </li>
            </ul>
          </div>
        </div>

        {/* Right: login card */}
        <Card className="w-full max-w-md border-0 bg-white/70 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-500 px-5 py-3 text-white">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              <p className="text-sm font-semibold">Login Admin Invoice</p>
            </div>
            <img
              src={BrandLogo}
              alt="Brand"
              className="h-6 w-6 rounded-md bg-white/20 p-0.5"
            />
          </div>

          <CardContent className="space-y-5 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs text-slate-600">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="invoice@admin.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-xs text-slate-600">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-9"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                    aria-label={
                      showPwd ? "Sembunyikan password" : "Tampilkan password"
                    }
                  >
                    {showPwd ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-500 text-white hover:from-indigo-700 hover:via-fuchsia-700 hover:to-pink-600"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Masuk...
                  </span>
                ) : (
                  "Masuk"
                )}
              </Button>

              <div className="text-center text-xs text-slate-500">
                Masuk sebagai Verifier?{" "}
                <Link
                  to="/admin/verifier/login"
                  className="font-medium text-indigo-600 hover:underline"
                >
                  ke halaman Verifier
                </Link>
              </div>
            </form>

            <p className="text-center text-[11px] text-slate-400">
              Dengan masuk, Anda menyetujui ketentuan & kebijakan privasi.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
