import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import BrandLogo from "@/src/assets/brand-logo.png";
import { Link, useNavigate } from "react-router-dom";
import usePageMeta from "@/src/lib/usePageMeta";

export default function ClientLogin() {
  usePageMeta({ title: "Login Client", brand: "Printingan.com" });
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const baseURL = (import.meta as any).env?.VITE_CLIENT_TARGET || "http://localhost:4000";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch(`${baseURL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast({ title: "Login gagal", description: data?.error || resp.statusText });
        return;
      }
      localStorage.setItem("client_token", data.token);
      toast({ title: "Berhasil masuk" });
      navigate("/client", { replace: true });
    } catch (err: any) {
      toast({ title: "Terjadi kesalahan", description: String(err?.message) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ===== Background gelap + garis ===== */}
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

      {/* ===== Layout ===== */}
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
        {/* Left: brand */}
        <div className="hidden md:block animate-fade-in-left">
          <div className="mx-auto w-12 md:mx-0 animate-float">
            <div className="rounded-2xl bg-white/10 p-3 shadow-lg ring-1 ring-white/10 backdrop-blur">
              <img src={BrandLogo} alt="Printingan Logo" className="h-6 w-6" />
            </div>
          </div>

          {/* judul aman (huruf g tdk kepotong) */}
          <h1 className="mt-6 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.3]">
            <span className="inline-block pb-1 bg-gradient-to-r from-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">Printingan.com</span>
          </h1>

          <p className="mt-3 max-w-md text-white/70">Cetak spanduk, stiker, banner, brosur, hingga kartu nama. Bahan premium • warna tajam • finishing presisi.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/80">
            {["🎯 Akurat & rapi", "⚡ Proses cepat", "🧾 Banyak material", "💳 Pembayaran mudah"].map((t, i) => (
              <span key={t} style={{ animationDelay: `${0.05 * i}s` }} className="animate-stagger rounded-xl bg-white/10 px-3 py-2 shadow-sm ring-1 ring-white/10 backdrop-blur">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: login card */}
        <div className="relative animate-pop">
          {/* glow breathing */}
          <div className="pointer-events-none absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-fuchsia-500 to-indigo-500 opacity-80 blur-md animate-glow" />
          <Card className="relative w-full max-w-md border-0 bg-white/95 shadow-2xl backdrop-blur-xl">
            <CardHeader className="p-0">
              {/* header gradient bergerak */}
              <div className="bg-[length:200%_200%] animate-gradient-x flex items-center gap-2 rounded-t-2xl bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-500 px-5 py-3 text-white">
                <img src={BrandLogo} alt="Logo" className="h-5 w-5 rounded" />
                <CardTitle className="text-base">Login Client</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="px-6 py-6">
              <form onSubmit={onSubmit} className="grid gap-5">
                {/* Email */}
                <div className="relative animate-stagger" style={{ animationDelay: ".05s" }}>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder=" "
                    className="peer h-12 rounded-xl pl-3.5 pr-12 bg-white/70 ring-1 ring-slate-200
                               transition-shadow placeholder-transparent
                               focus:bg-white focus:ring-2 focus:ring-indigo-400/80
                               focus:shadow-[0_0_0_6px_rgba(99,102,241,0.08)]
                               focus:animate-[inputPulse_.7s_ease-out]"
                    required
                  />
                  <Label
                    htmlFor="email"
                    className="pointer-events-none absolute left-3
                               top-1/2 -translate-y-1/2 text-base text-slate-500
                               transition-all duration-200
                               peer-focus:-top-2 peer-focus:translate-y-0 peer-focus:text-xs
                               peer-focus:text-indigo-600 peer-focus:px-1 peer-focus:bg-white/95
                               peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:translate-y-0
                               peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white/95
                               rounded"
                  >
                    Email
                  </Label>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60">📧</div>
                </div>

                {/* Password */}
                <div className="relative animate-stagger" style={{ animationDelay: ".1s" }}>
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder=" "
                    className="peer h-12 rounded-xl pl-3.5 pr-24 bg-white/70 ring-1 ring-slate-200
                               transition-shadow placeholder-transparent
                               focus:bg-white focus:ring-2 focus:ring-pink-400/80
                               focus:shadow-[0_0_0_6px_rgba(236,72,153,0.08)]
                               focus:animate-[inputPulse_.7s_ease-out]"
                    required
                  />
                  <Label
                    htmlFor="password"
                    className="pointer-events-none absolute left-3
                               top-1/2 -translate-y-1/2 text-base text-slate-500
                               transition-all duration-200
                               peer-focus:-top-2 peer-focus:translate-y-0 peer-focus:text-xs
                               peer-focus:text-pink-600 peer-focus:px-1 peer-focus:bg-white/95
                               peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:translate-y-0
                               peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white/95
                               rounded"
                  >
                    Password
                  </Label>

                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-xs font-medium text-slate-600
                               hover:bg-slate-100 active:scale-[0.98] transition"
                    aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPass ? "Sembunyi" : "Lihat"}
                  </button>
                </div>

                {/* Action row */}
                <div className="flex items-center justify-between text-xs text-slate-600 animate-stagger" style={{ animationDelay: ".15s" }}>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Ingat saya
                  </label>
                  <a className="text-indigo-600 hover:underline" href="#" onClick={(e) => e.preventDefault()}>
                    Lupa password?
                  </a>
                </div>

                {/* CTA */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="group relative mt-1 h-12 w-full overflow-hidden rounded-2xl
                             bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-pink-500
                             text-white shadow-lg transition active:scale-[0.99]
                             bg-[length:200%_200%] animate-gradient-x hover:from-indigo-700 hover:via-fuchsia-700 hover:to-pink-600"
                >
                  <span className="absolute inset-0 -translate-x-full bg-white/30 blur-sm transition-transform duration-700 group-hover:translate-x-0" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />}
                    {loading ? "Memproses…" : "Masuk"}
                  </span>
                </Button>

                <p className="animate-stagger text-center text-sm text-slate-700" style={{ animationDelay: ".25s" }}>
                  Belum punya akun?{" "}
                  <Link to="/client/register" className="font-semibold text-indigo-600 hover:underline">
                    Daftar
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Keyframes & util animasi */}
      <style>{`
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in-left { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes gradient-x { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
        @keyframes glow { 0%,100% { opacity:.65; filter: blur(22px) } 50% { opacity:.85; filter: blur(28px) } }
        @keyframes pop { 0% { opacity:0; transform: translateY(12px) scale(.98) } 100% { opacity:1; transform: translateY(0) scale(1) } }
        @keyframes stagger { 0% { opacity:0; transform: translateY(6px) } 100% { opacity:1; transform: translateY(0) } }
        @keyframes inputPulse { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,.0) }
                                 40% { box-shadow: 0 0 0 6px rgba(99,102,241,.08) }
                                 100% { box-shadow: 0 0 0 0 rgba(99,102,241,.0) } }

        .animate-fade-in-up { animation: fade-in-up .6s ease-out both; }
        .animate-fade-in-left { animation: fade-in-left .6s ease-out both; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-gradient-x { animation: gradient-x 8s ease-in-out infinite; }
        .animate-glow { animation: glow 4.5s ease-in-out infinite; }
        .animate-pop { animation: pop .5s ease-out both; }
        .animate-stagger { animation: stagger .45s ease-out both; }
      `}</style>
    </div>
  );
}