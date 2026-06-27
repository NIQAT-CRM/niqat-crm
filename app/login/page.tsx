"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setErr(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr("بيانات الدخول غير صحيحة"); return; }
    router.push("/"); router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-line p-7">
        <div className="text-center mb-6">
          <div className="text-2xl font-extrabold text-brand">نقاط</div>
          <div className="text-sm text-muted mt-1">نظام إدارة العملاء</div>
        </div>
        <label className="block text-sm font-bold mb-1">البريد الإلكتروني</label>
        <input className="w-full border border-line rounded-lg px-3 py-2 mb-3 outline-none focus:border-brand"
          type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} />
        <label className="block text-sm font-bold mb-1">كلمة المرور</label>
        <input className="w-full border border-line rounded-lg px-3 py-2 mb-4 outline-none focus:border-brand"
          type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") signIn(); }} />
        {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
        <button onClick={signIn} disabled={loading}
          className="w-full bg-brand text-white rounded-lg py-2.5 font-bold hover:bg-brand-dark transition disabled:opacity-60">
          {loading ? "..." : "دخول"}
        </button>
      </div>
    </div>
  );
}
