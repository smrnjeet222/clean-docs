"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { email, name, password } : { email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/docs");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-[8px] border border-carbon/15 bg-newsprint px-3.5 py-2.5 text-[15px] text-press-black placeholder:text-smoke focus:bg-paper-white";

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-8 text-center">
        <p className="font-editorial text-[40px] leading-none">Folio</p>
        <p className="mt-3 text-[15px] text-graphite">A writer&rsquo;s drafting table.</p>
      </div>

      <div className="rounded-[16px] border border-carbon/10 bg-paper-white p-8 shadow-[var(--shadow-subtle)]">
        <h1 className="text-[17px] font-semibold text-press-black">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-[13px] text-graphite">
          {mode === "login" ? "Welcome back." : "Start writing in seconds."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "register" && (
            <input className={inputClass} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input
            className={inputClass}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={inputClass}
            type="password"
            placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === "register" ? 8 : undefined}
            required
          />
          {error && <p className="text-[13px] text-[#b00020]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[8px] bg-press-black px-3 py-2.5 text-[15px] font-semibold text-paper-white shadow-[var(--shadow-subtle)] transition-colors hover:bg-carbon disabled:opacity-50"
          >
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-[14px] text-graphite">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          className="font-medium text-ink-violet underline decoration-1 underline-offset-2 hover:text-electric-violet"
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
