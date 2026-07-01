"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabaseRef = useRef<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
  }, []);

  async function signIn() {
    if (!supabaseRef.current) { setErr("جارٍ التحميل…"); return; }
    setErr(""); setLoading(true);
    const { error } = await supabaseRef.current.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr("بيانات الدخول غير صحيحة"); return; }
    router.push("/"); router.refresh();
  }

  return (
    <div className="login">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="logo"><img src="/logo.png" alt="NIQAT" /></div>
        <div className="appname">CRM-NIQAT</div>
        <div className="appname-sub">نظام إدارة العملاء</div>
        <h2>تسجيل الدخول</h2>
        <p className="sub">ادخل بياناتك للمتابعة</p>

        <div className="fld">
          <label>البريد الإلكتروني</label>
          <input className="inp num" type="email" dir="ltr" placeholder="name@niqat.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label>كلمة المرور</label>
          <input className="inp" type="password" dir="ltr" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") signIn(); }} />
        </div>

        {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <button onClick={signIn} disabled={loading} className="btn" style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "..." : "تسجيل الدخول"}
        </button>
      </div>
    </div>
  );
}
