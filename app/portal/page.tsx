"use client";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TOKEN_KEY = "edu_portal_token";
const BRAND = "#F08A24";

export default function PortalPage() {
  const supabase = createClient();
  const [phase, setPhase] = useState<"login" | "code" | "home" | "consent" | "exam" | "result">("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openDip, setOpenDip] = useState<number | null>(0);
  const [appealFor, setAppealFor] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState("");

  // الاختبار الآمن
  const [examItem, setExamItem] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);          // {attempt_id, deadline_at, questions:[{q,body,opts,selected}]}
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<number>(0); // ثواني
  const [examBusy, setExamBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const t = typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;
    if (t) { setToken(t); loadOverview(t); }
  }, []);

  async function loadOverview(t: string) {
    setLoading(true); setErr("");
    const { data: d, error } = await supabase.rpc("edu_portal_overview", { p_token: t });
    setLoading(false);
    if (error) { sessionStorage.removeItem(TOKEN_KEY); setToken(null); setPhase("login"); return; }
    setData(d); setPhase("home");
  }

  async function requestOtp() {
    if (!email.trim() || !phone.trim()) { setErr("اكتب الإيميل والتليفون"); return; }
    setLoading(true); setErr("");
    const { error } = await supabase.rpc("edu_portal_request_otp", { p_email: email.trim(), p_phone: phone.trim() });
    setLoading(false);
    if (error) { setErr("حصل خطأ، حاول تاني"); return; }
    setPhase("code");
  }

  async function verify() {
    if (!code.trim()) { setErr("اكتب الكود"); return; }
    setLoading(true); setErr("");
    const { data: r, error } = await supabase.rpc("edu_portal_verify_otp", { p_email: email.trim(), p_phone: phone.trim(), p_code: code.trim() });
    setLoading(false);
    if (error || !r?.ok) {
      const why = r?.why;
      setErr(why === "wrong" ? "الكود غلط" : why === "expired" ? "الكود انتهت صلاحيته" : why === "too_many" ? "محاولات كتير — اطلب كود جديد" : why === "no_code" ? "اطلب كود الأول" : "بيانات غير صحيحة");
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, r.token);
    setToken(r.token);
    loadOverview(r.token);
  }

  async function logout() {
    if (token) await supabase.rpc("edu_portal_logout", { p_token: token });
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null); setData(null); setPhase("login"); setCode("");
  }

  async function fileAppeal(attemptId: string) {
    if (!appealReason.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("edu_portal_file_appeal", { p_token: token, p_source: "accreditation", p_ref: attemptId, p_reason: appealReason.trim() });
    setLoading(false);
    if (error) { alert("تعذّر تقديم التظلم: " + error.message); return; }
    setAppealFor(null); setAppealReason("");
    if (token) loadOverview(token);
  }

  // مؤقّت الاختبار — بيعتمد على وقت السيرفر (offset) وبيقدّم تسليم أوتوماتيك عند الصفر
  useEffect(() => {
    if (phase !== "exam" || !exam?.deadline_at) return;
    const offset = Date.parse(exam.server_now || new Date().toISOString()) - Date.now();
    const tick = () => {
      const secs = Math.max(0, Math.round((Date.parse(exam.deadline_at) - (Date.now() + offset)) / 1000));
      setRemaining(secs);
      if (secs <= 0) doSubmit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exam]);

  function normOpts(options: any): { key: string; text: string }[] {
    if (Array.isArray(options)) return options.map((o: any, i: number) =>
      typeof o === "string" ? { key: String.fromCharCode(97 + i), text: o }
        : { key: String(o.key ?? o.k ?? o.value ?? o.id ?? String.fromCharCode(97 + i)), text: String(o.text ?? o.label ?? o.body ?? o.title ?? o.value ?? "") });
    if (options && typeof options === "object") return Object.entries(options).map(([k, v]) => ({ key: k, text: String(v) }));
    return [];
  }

  function openConsent(ex: any) { setExamItem(ex); setResult(null); setPhase("consent"); }

  async function startExam() {
    setExamBusy(true);
    const { data: r, error } = await supabase.rpc("edu_portal_start_exam", { p_token: token, p_attempt: examItem.attempt_id });
    setExamBusy(false);
    if (error || !r) { alert("تعذّر بدء الاختبار: " + (error?.message || "")); setPhase("home"); return; }
    const qs = (r.questions || []).map((q: any) => ({ q: q.q, body: q.body, opts: normOpts(q.options), selected: q.selected }));
    const init: Record<string, string> = {};
    for (const q of qs) if (q.selected) init[q.q] = q.selected;
    setAnswers(init);
    setExam({ attempt_id: r.attempt_id, deadline_at: r.deadline_at, server_now: r.server_now, questions: qs });
    setPhase("exam");
  }

  async function selectAnswer(qid: string, key: string) {
    setAnswers((s) => ({ ...s, [qid]: key }));
    supabase.rpc("edu_portal_save_answer", { p_token: token, p_attempt: exam.attempt_id, p_question: qid, p_key: key });
  }

  async function doSubmit(auto = false) {
    if (examBusy || phase !== "exam") return;
    if (!auto) { const ok = window.confirm("متأكد إنك عايز تسلّم؟ مفيش رجوع بعد التسليم."); if (!ok) return; }
    setExamBusy(true);
    const payload = Object.entries(answers).map(([q, k]) => ({ q, k }));
    const { data: r, error } = await supabase.rpc("edu_portal_submit_exam", { p_token: token, p_attempt: exam.attempt_id, p_answers: payload });
    setExamBusy(false);
    if (error) { alert("تعذّر التسليم: " + error.message); return; }
    setResult(r); setPhase("result");
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ===== واجهة =====
  const wrap: CSSProperties = { minHeight: "100vh", background: "var(--bg, #0f1419)", color: "var(--text, #e8eef5)", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" };
  const card: CSSProperties = { width: "100%", maxWidth: 560, background: "var(--card, #1a2230)", border: "1px solid var(--line, #2a3547)", borderRadius: 16, padding: 22 };
  const inp: CSSProperties = { width: "100%", height: 46, padding: "0 14px", borderRadius: 11, border: "1px solid var(--line, #2a3547)", background: "var(--surface, #131a26)", color: "var(--text, #e8eef5)", fontSize: 14, marginTop: 10 };
  const btn: CSSProperties = { width: "100%", height: 46, borderRadius: 11, border: "none", background: BRAND, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 14 };
  const chip = (fg: string, bg: string): CSSProperties => ({ fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 7, color: fg, background: bg });

  const issueChip = (s: string) => {
    const map: any = { issued: ["#7ee2a8", "#12351f"], eligible: ["#f0c674", "#3a2c0e"], issuing: ["#f0c674", "#3a2c0e"], failed: ["#f2a9a0", "#3a1512"], not_eligible: ["#9aa7b6", "#222c3a"] };
    const lbl: any = { issued: "تم الإصدار", eligible: "مستحق", issuing: "جاري الإصدار", failed: "فشل الإصدار", not_eligible: "غير مستحق" };
    const [fg, bg] = map[s] || map.not_eligible;
    return <span style={chip(fg, bg)}>{lbl[s] || s}</span>;
  };

  if (phase === "login" || phase === "code") {
    return (
      <div style={wrap}>
        <div style={{ ...card, marginTop: "8vh", textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: BRAND }}>نقاط</div>
          <div style={{ fontSize: 14, color: "var(--muted, #9aa7b6)", marginTop: 4 }}>بوابة الطالب</div>

          {phase === "login" ? (
            <>
              <div style={{ textAlign: "start", marginTop: 20 }}>
                <input style={inp} placeholder="الإيميل" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input style={inp} placeholder="رقم الموبايل" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
              </div>
              <button style={btn} onClick={requestOtp} disabled={loading}>{loading ? "..." : "إرسال كود الدخول"}</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "var(--muted, #9aa7b6)", marginTop: 18 }}>بعتنا كود مكوّن من ٦ أرقام على إيميلك</div>
              <input style={{ ...inp, textAlign: "center", letterSpacing: 6, fontSize: 20, fontWeight: 800 }} placeholder="------" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" maxLength={6} />
              <button style={btn} onClick={verify} disabled={loading}>{loading ? "..." : "دخول"}</button>
              <button onClick={() => { setPhase("login"); setCode(""); setErr(""); }} style={{ background: "none", border: "none", color: "var(--muted, #9aa7b6)", fontSize: 12.5, marginTop: 12, cursor: "pointer" }}>رجوع</button>
            </>
          )}
          {err && <div style={{ color: "#f2a9a0", fontSize: 13, marginTop: 12 }}>{err}</div>}
        </div>
      </div>
    );
  }

  // ===== شاشة الموافقة قبل الاختبار =====
  if (phase === "consent") {
    return (
      <div style={wrap}>
        <div style={{ ...card, marginTop: "6vh" }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: BRAND }}>{examItem?.accreditation || "اختبار الاعتماد"}</div>
          <div style={{ fontSize: 13.5, color: "var(--muted,#9aa7b6)", marginTop: 14, lineHeight: 1.9 }}>
            <div>• عدد الأسئلة: {examItem?.num_questions || "—"}.</div>
            <div>• التايمر بيبدأ أول ما تدوس «ابدأ»، ومبيقفش حتى لو خرجت أو قفلت الصفحة.</div>
            <div>• لو النت قطع، ارجع وكمّل — الوقت ماشي من مكانه.</div>
            <div>• مفيش إعادة، والنتيجة نهائية (الاعتراض بالتظلم خلال ٤٨ ساعة).</div>
            <div>• ممنوع النسخ أو تصوير الشاشة — الشاشة عليها بياناتك.</div>
          </div>
          <button style={btn} onClick={startExam} disabled={examBusy}>{examBusy ? "..." : "فهمت وأوافق، ابدأ"}</button>
          <button onClick={() => setPhase("home")} style={{ background: "none", border: "none", color: "var(--muted,#9aa7b6)", fontSize: 12.5, marginTop: 12, cursor: "pointer", width: "100%" }}>رجوع</button>
        </div>
      </div>
    );
  }

  // ===== شاشة الاختبار الآمن =====
  if (phase === "exam" && exam) {
    const wm = `${data?.name || ""} · ${email} · ${phone}`;
    const low = remaining <= 60;
    return (
      <div
        style={{ ...wrap, position: "relative", userSelect: "none", WebkitUserSelect: "none" }}
        onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}
      >
        {/* ووترمارك */}
        <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0, opacity: 0.06 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} style={{ position: "absolute", top: `${(i * 7) % 100}%`, insetInlineStart: `${(i * 13) % 90}%`, transform: "rotate(-30deg)", fontSize: 13, whiteSpace: "nowrap", color: "#fff", fontWeight: 700 }} dir="ltr">{wm}</div>
          ))}
        </div>

        {/* شريط علوي ثابت: تايمر + تسليم */}
        <div style={{ position: "sticky", top: 0, zIndex: 2, width: "100%", maxWidth: 620, display: "flex", alignItems: "center", gap: 12, background: "var(--card,#1a2230)", border: "1px solid var(--line,#2a3547)", borderRadius: 12, padding: "10px 14px" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{examItem?.accreditation || "الاختبار"}</span>
          <span style={{ flex: 1 }} />
          <span className="num" dir="ltr" style={{ fontWeight: 900, fontSize: 18, color: low ? "#f2a9a0" : BRAND }}>{fmt(remaining)}</span>
          <button onClick={() => doSubmit(false)} disabled={examBusy} style={{ background: BRAND, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontWeight: 800, cursor: "pointer" }}>تسليم</button>
        </div>

        {/* الأسئلة */}
        <div style={{ width: "100%", maxWidth: 620, marginTop: 14, position: "relative", zIndex: 1 }}>
          {exam.questions.map((q: any, qi: number) => (
            <div key={q.q} style={{ ...card, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}><span style={{ color: BRAND }}>{qi + 1}.</span> {q.body}</div>
              {q.opts.map((o: { key: string; text: string }) => {
                const sel = answers[q.q] === o.key;
                return (
                  <button key={o.key} onClick={() => selectAnswer(q.q, o.key)}
                    style={{ width: "100%", textAlign: "start", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", marginBottom: 8, borderRadius: 10, cursor: "pointer",
                      border: "1px solid " + (sel ? BRAND : "var(--line,#2a3547)"), background: sel ? BRAND + "22" : "var(--surface,#131a26)", color: "var(--text,#e8eef5)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid " + (sel ? BRAND : "var(--line,#2a3547)"), background: sel ? BRAND : "transparent", flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5 }}>{o.text}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <button onClick={() => doSubmit(false)} disabled={examBusy} style={{ ...btn, marginBottom: 30 }}>{examBusy ? "..." : "تسليم الاختبار"}</button>
        </div>
      </div>
    );
  }

  // ===== شاشة النتيجة =====
  if (phase === "result" && result) {
    const passed = result.passed;
    return (
      <div style={wrap}>
        <div style={{ ...card, marginTop: "8vh", textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>{passed ? "🎉" : "📄"}</div>
          <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8, color: passed ? "#7ee2a8" : "#f2a9a0" }}>{passed ? "مبروك، نجحت!" : "للأسف، مش مستحق"}</div>
          <div className="num" dir="ltr" style={{ fontSize: 32, fontWeight: 900, marginTop: 10 }}>{Math.round(result.score_pct)}%</div>
          <div style={{ fontSize: 13, color: "var(--muted,#9aa7b6)", marginTop: 6 }} dir="ltr">{result.correct} / {result.total}</div>
          {!passed && <div style={{ fontSize: 12.5, color: "var(--muted,#9aa7b6)", marginTop: 14 }}>تقدر تقدّم تظلم خلال ٤٨ ساعة من الصفحة الرئيسية.</div>}
          <button style={btn} onClick={() => { setExam(null); setResult(null); if (token) loadOverview(token); }}>رجوع للرئيسية</button>
        </div>
      </div>
    );
  }

  // ===== الرئيسية =====
  const diplomas: any[] = data?.diplomas || [];
  const exams: any[] = data?.exams || [];
  const appeals: any[] = data?.appeals || [];

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: BRAND }}>نقاط</div>
          <div style={{ fontSize: 13, color: "var(--muted, #9aa7b6)" }}>أهلاً {data?.name || ""}</div>
        </div>
        <span style={{ flex: 1 }} />
        <button onClick={logout} style={{ background: "none", border: "1px solid var(--line,#2a3547)", color: "var(--muted,#9aa7b6)", borderRadius: 9, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}>خروج</button>
      </div>

      {/* نتيجة الدبلومة */}
      {diplomas.length > 0 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>نتيجة الدبلومة</div>
          {diplomas.map((d, i) => (
            <div key={i} style={{ border: "1px solid var(--line,#2a3547)", borderRadius: 11, marginBottom: 8, overflow: "hidden" }}>
              <button onClick={() => setOpenDip(openDip === i ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: 12, background: "none", border: "none", color: "inherit", cursor: "pointer", textAlign: "start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{d.diploma}</div>
                  <div className="num" style={{ fontSize: 12, color: "var(--muted,#9aa7b6)" }} dir="ltr">{d.batch_code}</div>
                </div>
                {d.overall_pct != null && <span style={{ fontSize: 13, color: "var(--muted,#9aa7b6)" }}>{Math.round(d.overall_pct)}%</span>}
                {issueChip(d.issue_status)}
              </button>
              {openDip === i && (
                <div style={{ borderTop: "1px solid var(--line,#2a3547)", padding: 12 }}>
                  {(d.semesters || []).map((s: any, si: number) => (
                    <div key={si} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{s.title}</span>
                        {s.pct != null && <span style={{ fontSize: 12, color: "var(--muted,#9aa7b6)" }}>{Math.round(s.pct)}%</span>}
                        <span style={chip(...(s.status === "locked" ? ["#7ee2a8", "#12351f"] : ["#9aa7b6", "#222c3a"]) as [string, string])}>{s.status === "locked" ? "معتمد" : "قيد التصحيح"}</span>
                      </div>
                      {(s.tasks || []).map((t: any, ti: number) => (
                        <div key={ti} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0 0", fontSize: 12.5 }}>
                          <span style={{ color: t.result === "pass" ? "#7ee2a8" : "#f2a9a0", fontWeight: 800 }}>{t.result === "pass" ? "✓" : "✗"}</span>
                          <div style={{ flex: 1 }}>
                            <div>{t.title}</div>
                            {t.comment && <div style={{ color: "var(--muted,#9aa7b6)", fontSize: 11.5, marginTop: 2 }}>💬 {t.comment}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* الاختبارات / الاعتمادات */}
      {exams.length > 0 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>الاعتمادات والاختبارات</div>
          {exams.map((ex, i) => {
            const submitted = !!ex.submitted_at;
            const canAppeal = submitted && ex.passed === false && ex.appeal && (ex.appeal.can === true || ex.appeal.allowed === true);
            return (
              <div key={i} style={{ border: "1px solid var(--line,#2a3547)", borderRadius: 11, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>{ex.accreditation || "اعتماد"}</span>
                  {submitted ? (
                    <>
                      {ex.score_pct != null && <span style={{ fontSize: 13, color: "var(--muted,#9aa7b6)" }}>{Math.round(ex.score_pct)}%</span>}
                      <span style={chip(...(ex.passed ? ["#7ee2a8", "#12351f"] : ["#f2a9a0", "#3a1512"]) as [string, string])}>{ex.passed ? "ناجح" : "راسب"}</span>
                      {ex.issue_status && issueChip(ex.issue_status)}
                    </>
                  ) : (
                    <span style={chip("#f0c674", "#3a2c0e")}>متاح</span>
                  )}
                </div>

                {!submitted && (
                  <button onClick={() => openConsent(ex)} style={{ ...btn, marginTop: 10, height: 42 }}>ابدأ الاختبار</button>
                )}

                {canAppeal && (
                  appealFor === ex.attempt_id ? (
                    <div style={{ marginTop: 10 }}>
                      <textarea value={appealReason} onChange={(e) => setAppealReason(e.target.value)} rows={3} placeholder="اكتب سبب التظلم…" style={{ ...inp, height: "auto", padding: 12, resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={{ ...btn, marginTop: 0, height: 40, width: "auto", padding: "0 18px" }} onClick={() => fileAppeal(ex.attempt_id)} disabled={loading}>إرسال التظلم</button>
                        <button onClick={() => { setAppealFor(null); setAppealReason(""); }} style={{ background: "none", border: "1px solid var(--line,#2a3547)", color: "var(--muted,#9aa7b6)", borderRadius: 9, padding: "0 16px", cursor: "pointer" }}>إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAppealFor(ex.attempt_id)} style={{ marginTop: 10, background: "none", border: "1px solid " + BRAND, color: BRAND, borderRadius: 9, padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                      تقديم تظلم (خلال ٤٨ ساعة)
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* التظلمات */}
      {appeals.length > 0 && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>تظلماتك</div>
          {appeals.map((a, i) => {
            const lbl: any = { open: ["#f0c674", "#3a2c0e", "مفتوح"], under_review: ["#f0c674", "#3a2c0e", "قيد المراجعة"], upheld: ["#7ee2a8", "#12351f", "مقبول"], rejected: ["#f2a9a0", "#3a1512", "مرفوض"] };
            const [fg, bg, txt] = lbl[a.status] || ["#9aa7b6", "#222c3a", a.status];
            return (
              <div key={i} style={{ border: "1px solid var(--line,#2a3547)", borderRadius: 11, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, flex: 1 }}>{a.source === "accreditation" ? "اعتماد" : "دبلومة"}</span>
                  <span style={chip(fg, bg)}>{txt}</span>
                </div>
                {a.response && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--muted,#9aa7b6)" }}>{a.response}</div>}
              </div>
            );
          })}
        </div>
      )}

      {diplomas.length === 0 && exams.length === 0 && appeals.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: "var(--muted,#9aa7b6)", fontSize: 14 }}>لسه مفيش نتايج أو اختبارات.</div>
      )}
    </div>
  );
}
