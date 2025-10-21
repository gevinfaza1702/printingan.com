import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import usePageMeta from "@/src/lib/usePageMeta";
import BrandLogo from "@/src/assets/brand-logo.png";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function AdminVerifierLogin() {
  usePageMeta({ title: "Login Admin Verifikasi", brand: "" });

  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const baseURL =
    (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const resp = await fetch(`${baseURL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        toast({
          title: "Login gagal",
          description: j?.error || "Cek email atau password.",
          variant: "destructive",
        });
        return;
      }

      const data = await resp.json();
      if (data?.admin?.role !== "verifier") {
        toast({
          title: "Akses ditolak",
          description: "Akun ini bukan admin verifikasi.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("admin_verifier_token", data.token);
      window.location.href = "/admin/verifier";
    } catch (err: any) {
      toast({
        title: "Terjadi kesalahan",
        description: String(err?.message || err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* background gradient + soft blobs */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-indigo-50 to-fuchsia-50" />
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-[26rem] w-[26rem] rounded-full bg-fuchsia-300/20 blur-3xl" />

      {/* center container */}
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 place-items-center px-6 md:grid-cols-2">
        {/* Left: brand / hero */}
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
                  Verifikasi Pesanan
                </h1>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p className="leading-relaxed">
                Akses dashboard verifikasi untuk menyetujui pesanan, cek
                whitelist vendor, dan pantau nominal tertahan.
              </p>
              <ul className="grid grid-cols-2 gap-2 text-xs">
                <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                  ✅ Alur cepat
                </li>
                <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                  🔒 Aman & terkontrol
                </li>
                <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                  🧾 Riwayat jelas
                </li>
                <li className="rounded-xl bg-white/70 px-3 py-2 shadow-sm backdrop-blur">
                  📊 Insight realtime
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: glass card login */}
        <Card className="w-full max-w-md border-0 bg-white/70 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-500 px-5 py-3 text-white">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-semibold">Login Admin Verifikasi</p>
            </div>
            <img
              src={BrandLogo}
              alt="Brand"
              className="h-6 w-6 rounded-md bg-white/20 p-0.5"
            />
          </div>

          <CardContent className="space-y-5 p-6">
            <form onSubmit={submit} className="space-y-4">
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
                    placeholder="verifier@admin.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    autoFocus
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

              <div className="flex items-center justify-between text-xs text-slate-500">
                <a href="/admin/invoice/login" className="hover:underline">
                  Login admin invoice
                </a>
                <a href="/client/login" className="hover:underline">
                  Login client
                </a>
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
