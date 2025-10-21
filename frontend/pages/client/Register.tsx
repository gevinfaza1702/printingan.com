import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BrandLogo from "@/src/assets/brand-logo.png";
import usePageMeta from "@/src/lib/usePageMeta";
import { Link, useNavigate } from "react-router-dom";

export default function ClientRegister() {
  usePageMeta({ title: "Daftar Client", brand: "Printingan.com" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vendorChoice, setVendorChoice] = useState<string>("");
  const [vendorOther, setVendorOther] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const baseURL = (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

  const isValid = fullName && email.includes("@") && password.length >= 6 && password === confirm;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast({ title: "Data belum lengkap atau tidak valid" });
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${baseURL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          vendor_choice: vendorChoice,
          vendor_other: vendorOther,
          password,
          confirm_password: confirm,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast({ title: "Registrasi gagal", description: data?.error });
        return;
      }
      toast({ title: "Berhasil daftar!" });
      localStorage.setItem("client_token", data.token);
      navigate("/client", { replace: true });
    } catch (err: any) {
      toast({ title: "Terjadi kesalahan", description: String(err.message) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      {/* === Background hitam + efek garis bergerak === */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#0b0b10]" />
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_70%_40%,rgba(124,58,237,0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_30%_60%,rgba(14,165,233,0.16),transparent_60%)]" />
        <svg className="absolute inset-0 opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="g1" x1="0" x2="1">
              <stop stopColor="#a855f7" />
              <stop offset="1" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="g2" x1="0" x2="1">
              <stop stopColor="#22d3ee" />
              <stop offset="1" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="g3" x1="0" x2="1">
              <stop stopColor="#f472b6" />
              <stop offset="1" stopColor="#c084fc" />
            </linearGradient>
          </defs>
          {Array.from({ length: 28 }).map((_, i) => {
            const y = i * (100 / 28) + (i % 2 ? 2 : -2);
            const angles = [-25, -15, -8, -4, 0, 4, 8, 12, 18, 25];
            const angle = angles[i % angles.length];
            const grad = i % 3 === 0 ? "url(#g1)" : i % 3 === 1 ? "url(#g2)" : "url(#g3)";
            const width = 0.18 + (i % 5) * 0.02;
            const dur = 10 + (i % 6) * 2;
            const dashStart = (i * 17) % 200;
            return (
              <g key={i} transform={`rotate(${angle} 50 50)`} style={{ mixBlendMode: "screen" }}>
                <line x1={-20} y1={y} x2={120} y2={y} stroke={grad} strokeWidth={width} strokeLinecap="round" strokeDasharray="6 18" strokeDashoffset={dashStart}>
                  <animate attributeName="stroke-dashoffset" values={`${dashStart}; ${dashStart - 200}`} dur={`${dur}s`} repeatCount="indefinite" />
                </line>
              </g>
            );
          })}
        </svg>
      </div>

      {/* === Layout utama === */}
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
        {/* === Left section === */}
        <div className="hidden md:block animate-fade-in-left">
          <div className="mx-auto w-12 md:mx-0">
            <div className="rounded-2xl bg-white/10 p-3 shadow-lg ring-1 ring-white/10 backdrop-blur">
              <img src={BrandLogo} alt="Printingan Logo" className="h-6 w-6" />
            </div>
          </div>
          <h1
            className="mt-6 text-4xl md:text-5xl font-extrabold tracking-tight
             bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent
             leading-[1.15] md:leading-[1.12]"
          >
            Gabung ke Printingan.com
          </h1>

          <p className="mt-3 max-w-md text-white/70">Buat akun untuk kelola pesanan cetak Anda—spanduk, stiker, banner, brosur, dan lainnya.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/80">
            {["🧵 Banyak material", "⚡ Proses cepat", "🎯 Hasil presisi", "💳 Bayar aman"].map((t) => (
              <span key={t} className="rounded-xl bg-white/10 px-3 py-2 shadow-sm ring-1 ring-white/10 backdrop-blur">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* === Right section (Form) === */}
        <div className="relative animate-fade-in-up">
          <div className="pointer-events-none absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 opacity-80 blur-md" />
          <Card className="relative w-full max-w-md border-0 bg-white/95 text-black shadow-2xl backdrop-blur-xl">
            <CardHeader className="p-0">
              <div className="flex items-center gap-2 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-pink-500 px-5 py-3 text-white">
                <img src={BrandLogo} alt="Logo" className="h-5 w-5 rounded" />
                <CardTitle className="text-base">Daftar Akun Client</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="px-6 py-6">
              <form onSubmit={onSubmit} className="grid gap-5">
                {/* Nama Lengkap – floating label */}
                <div className="relative">
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    placeholder=" " /* penting untuk :placeholder-shown */
                    className="peer h-12 rounded-xl pl-3.5 pr-3 bg-white/70 ring-1 ring-slate-200
                   placeholder-transparent transition-shadow
                   focus:bg-white focus:ring-2 focus:ring-indigo-400/80
                   focus:shadow-[0_0_0_6px_rgba(99,102,241,0.08)]"
                    required
                  />
                  <Label
                    htmlFor="full_name"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                   text-base text-slate-500 transition-all duration-200
                   peer-focus:-top-2 peer-focus:translate-y-0 peer-focus:text-xs
                   peer-focus:text-indigo-600 peer-focus:px-1 peer-focus:bg-white
                   peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:translate-y-0
                   peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:px-1
                   peer-not-placeholder-shown:bg-white rounded"
                  >
                    Nama Lengkap
                  </Label>
                </div>

                {/* Email – floating label */}
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder=" "
                    className="peer h-12 rounded-xl pl-3.5 pr-12 bg-white/70 ring-1 ring-slate-200
                   placeholder-transparent transition-shadow
                   focus:bg-white focus:ring-2 focus:ring-indigo-400/80
                   focus:shadow-[0_0_0_6px_rgba(99,102,241,0.08)]"
                    required
                  />
                  <Label
                    htmlFor="email"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                   text-base text-slate-500 transition-all duration-200
                   peer-focus:-top-2 peer-focus:text-xs peer-focus:text-indigo-600
                   peer-focus:px-1 peer-focus:bg-white
                   peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:text-xs
                   peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white rounded"
                  >
                    Email
                  </Label>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60">📧</div>
                </div>

                {/* No. HP (opsional) – floating label */}
                <div className="relative">
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder=" "
                    className="peer h-12 rounded-xl pl-3.5 pr-3 bg-white/70 ring-1 ring-slate-200
                   placeholder-transparent transition-shadow
                   focus:bg-white focus:ring-2 focus:ring-indigo-400/80
                   focus:shadow-[0_0_0_6px_rgba(99,102,241,0.08)]"
                  />
                  <Label
                    htmlFor="phone"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                   text-base text-slate-500 transition-all duration-200
                   peer-focus:-top-2 peer-focus:text-xs peer-focus:text-indigo-600
                   peer-focus:px-1 peer-focus:bg-white
                   peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:text-xs
                   peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white rounded"
                  >
                    No. HP (opsional)
                  </Label>
                </div>

                {/* Vendor – tampil konsisten (label kecil tetap di atas) */}
                <div className="grid gap-1.5">
                  <Label className="text-xs text-slate-600">Vendor</Label>
                  <Select value={vendorChoice} onValueChange={setVendorChoice}>
                    <SelectTrigger
                      className="h-12 rounded-xl bg-white/70 ring-1 ring-slate-200
                                  focus:ring-2 focus:ring-indigo-400/80 focus:bg-white"
                    >
                      <SelectValue placeholder="Pilih vendor atau none" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendor">vendor</SelectItem>
                      <SelectItem value="none">none</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {vendorChoice === "vendor" && (
                  <div className="relative">
                    <Input
                      id="vendor_other"
                      value={vendorOther}
                      onChange={(e) => setVendorOther(e.target.value)}
                      placeholder=" "
                      className="peer h-12 rounded-xl pl-3.5 pr-3 bg-white/70 ring-1 ring-slate-200
                     placeholder-transparent transition-shadow
                     focus:bg-white focus:ring-2 focus:ring-indigo-400/80
                     focus:shadow-[0_0_0_6px_rgba(99,102,241,0.08)]"
                      required
                    />
                    <Label
                      htmlFor="vendor_other"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                     text-base text-slate-500 transition-all duration-200
                     peer-focus:-top-2 peer-focus:text-xs peer-focus:text-indigo-600
                     peer-focus:px-1 peer-focus:bg-white
                     peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:text-xs
                     peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white rounded"
                    >
                      Nama Vendor
                    </Label>
                  </div>
                )}

                {/* Password – floating + toggle */}
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder=" "
                    className="peer h-12 rounded-xl pl-3.5 pr-24 bg-white/70 ring-1 ring-slate-200
                   placeholder-transparent transition-shadow
                   focus:bg-white focus:ring-2 focus:ring-pink-400/80
                   focus:shadow-[0_0_0_6px_rgba(236,72,153,0.08)]"
                    required
                  />
                  <Label
                    htmlFor="password"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                   text-base text-slate-500 transition-all duration-200
                   peer-focus:-top-2 peer-focus:text-xs peer-focus:text-pink-600
                   peer-focus:px-1 peer-focus:bg-white
                   peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:text-xs
                   peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white rounded"
                  >
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-xs font-medium text-slate-600
                   hover:bg-slate-100 active:scale-[0.98] transition"
                  >
                    {showPass ? "Sembunyi" : "Lihat"}
                  </button>
                </div>

                {/* Konfirmasi Password – floating + toggle */}
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder=" "
                    className="peer h-12 rounded-xl pl-3.5 pr-24 bg-white/70 ring-1 ring-slate-200
                   placeholder-transparent transition-shadow
                   focus:bg-white focus:ring-2 focus:ring-pink-400/80
                   focus:shadow-[0_0_0_6px_rgba(236,72,153,0.08)]"
                    required
                  />
                  <Label
                    htmlFor="confirm"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                   text-base text-slate-500 transition-all duration-200
                   peer-focus:-top-2 peer-focus:text-xs peer-focus:text-pink-600
                   peer-focus:px-1 peer-focus:bg-white
                   peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:text-xs
                   peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white rounded"
                  >
                    Konfirmasi Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-xs font-medium text-slate-600
                   hover:bg-slate-100 active:scale-[0.98] transition"
                  >
                    {showConfirm ? "Sembunyi" : "Lihat"}
                  </button>
                  {confirm && confirm !== password && <p className="mt-1 text-xs text-rose-500">Konfirmasi password tidak cocok</p>}
                </div>

                {/* CTA sama seperti Login */}
                <Button
                  type="submit"
                  disabled={loading || !isValid}
                  className="group relative mt-1 h-12 w-full overflow-hidden rounded-2xl
                 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-500 text-white
                 shadow-lg transition hover:from-indigo-700 hover:via-fuchsia-700 hover:to-pink-600
                 active:scale-[0.99]"
                >
                  <span className="absolute inset-0 -translate-x-full bg-white/30 blur-sm transition-transform duration-700 group-hover:translate-x-0" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />}
                    {loading ? "Mendaftarkan…" : "Daftar"}
                  </span>
                </Button>

                <p className="text-center text-sm text-slate-700">
                  Sudah punya akun?{" "}
                  <Link to="/client/login" className="font-semibold text-indigo-600 hover:underline">
                    Masuk
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Animasi kecil */}
      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fade-in-left { from { opacity: 0; transform: translateX(-12px) } to { opacity: 1; transform: translateX(0) } }
        .animate-fade-in-up { animation: fade-in-up .6s ease-out both }
        .animate-fade-in-left { animation: fade-in-left .6s ease-out both }
      `}</style>
    </div>
  );
}
