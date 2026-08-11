"use client";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

type Accred = { id: string; name: string };
type Q = { id: string; body: string; options: any; correct_key: string; active: boolean };
const LETTERS = "abcdefgh".split("");

export default function AccreditationsManager({ accreditations, settings }: { accreditations: Accred[]; settings: Record<string, any> }) {
  const tr = useT();
  const supabase = createClient();

  const [accId, setAccId] = useState("");
  const [num, setNum] = useState("50");
  const [dur, setDur] = useState("60");
  const [pass, setPass] = useState("60");
  const [savingSet, setSavingSet] = useState(false);

  const [questions, setQuestions] = useState<Q[]>([]);
  const [loading, setLoading] = useState(false);

  // بناء سؤال جديد
  const [qBody, setQBody] = useState("");
  const [opts, setOpts] = useState<string[]>(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [savingQ, setSavingQ] = useState(false);

  async function pickAccred(id: string) {
    setAccId(id); setQuestions([]);
    if (!id) return;
    const s = settings[id];
    setNum(String(s?.num_questions ?? 50)); setDur(String(s?.duration_minutes ?? 60)); setPass(String(s?.pass_pct ?? 60));
    setLoading(true);
    const { data } = await supabase.from("edu_questions").select("id, body, options, correct_key, active").eq("accreditation_id", id).order("created_at");
    setQuestions(((data as any[]) || []).map((q) => ({ id: q.id, body: q.body, options: q.options, correct_key: q.correct_key, active: q.active })));
    setLoading(false);
  }

  async function saveSettings() {
    setSavingSet(true);
    const { error } = await supabase.from("edu_exam_settings").upsert(
      { accreditation_id: accId, num_questions: parseInt(num) || 0, duration_minutes: parseInt(dur) || 0, pass_pct: parseFloat(pass) || 0, active: true },
      { onConflict: "accreditation_id" }
    );
    setSavingSet(false);
    if (error) { toast(error.message); return; }
    toast(tr("eduSettingsSaved"));
  }

  async function addQuestion() {
    const body = qBody.trim();
    const clean = opts.map((o) => o.trim());
    const valid = clean.filter(Boolean);
    if (!body || valid.length < 2 || !clean[correct]) { toast(tr("eduNeedValidQ")); return; }
    const options = clean.map((t, i) => ({ key: LETTERS[i], text: t })).filter((o) => o.text);
    const correct_key = LETTERS[correct];
    setSavingQ(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("edu_questions")
      .insert({ accreditation_id: accId, qtype: "mcq", body, options, correct_key, active: true, created_by: user?.id || null })
      .select("id, body, options, correct_key, active").single();
    setSavingQ(false);
    if (error) { toast(error.message); return; }
    setQuestions((q) => [...q, data as any]);
    setQBody(""); setOpts(["", "", "", ""]); setCorrect(0);
    toast(tr("eduQSaved"));
  }

  async function toggleQ(q: Q) {
    const { error } = await supabase.from("edu_questions").update({ active: !q.active }).eq("id", q.id);
    if (error) { toast(error.message); return; }
    setQuestions((list) => list.map((x) => x.id === q.id ? { ...x, active: !x.active } : x));
  }

  async function delQ(q: Q) {
    const ok = await confirmDialog({ message: tr("eduConfirmDelQ"), danger: true });
    if (!ok) return;
    const { error } = await supabase.from("edu_questions").delete().eq("id", q.id);
    if (error) { toast(error.message); return; }
    setQuestions((list) => list.filter((x) => x.id !== q.id));
  }

  const optText = (o: any) => Array.isArray(o) ? o : (o && typeof o === "object" ? Object.entries(o).map(([k, v]) => ({ key: k, text: v })) : []);
  const activeCount = questions.filter((q) => q.active).length;

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div>
        <h1>{tr("eduAccreditations")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{tr("eduAccredsManageDesc")}</p>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <select value={accId} onChange={(e) => pickAccred(e.target.value)} style={sel}>
          <option value="">{tr("eduPickAccred")}</option>
          {accreditations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {accreditations.length === 0 && <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>{tr("eduNoAccreds")}</p>}
      </div>

      {accId && !loading && (
        <>
          {/* إعدادات الاختبار */}
          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: "var(--ink)" }}>{tr("eduExamSettings")}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label={tr("eduNumQuestions")} v={num} on={setNum} />
              <Field label={tr("eduDuration")} v={dur} on={setDur} />
              <Field label={tr("eduPassPct")} v={pass} on={setPass} />
              <button className="btn" onClick={saveSettings} disabled={savingSet}>{tr("eduSaveSettings")}</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
              {tr("eduBankTotal")}: {questions.length} · {tr("eduStatusActive")}: {activeCount}
              {parseInt(num) > activeCount && ` · ⚠️ ${tr("eduBankWarn")}`}
            </p>
          </div>

          {/* إضافة سؤال */}
          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: "var(--ink)" }}>{tr("eduAddQuestion")}</div>
            <textarea value={qBody} onChange={(e) => setQBody(e.target.value)} placeholder={tr("eduQBody")} rows={2} style={{ ...inp, width: "100%", height: "auto", padding: 12, resize: "vertical" }} />
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {opts.map((o, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} title={tr("eduMarkCorrect")} style={{ accentColor: "var(--brand)", width: 18, height: 18 }} />
                  <span className="num" style={{ width: 18, color: "var(--muted)", fontWeight: 700 }} dir="ltr">{LETTERS[i]}</span>
                  <input value={o} onChange={(e) => setOpts((s) => s.map((x, xi) => xi === i ? e.target.value : x))} placeholder={`${tr("eduOption")} ${i + 1}`} style={{ ...inp, flex: 1 }} />
                  {opts.length > 2 && <button className="btn ghost sm" onClick={() => { setOpts((s) => s.filter((_, xi) => xi !== i)); if (correct >= opts.length - 1) setCorrect(0); }}>✕</button>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {opts.length < LETTERS.length && <button className="btn ghost sm" onClick={() => setOpts((s) => [...s, ""])}>+ {tr("eduAddOption")}</button>}
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={addQuestion} disabled={savingQ}>{tr("eduAddQuestion")}</button>
            </div>
          </div>

          {/* قائمة الأسئلة */}
          <div className="card" style={{ marginTop: 14, overflow: "hidden" }}>
            {questions.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>{tr("eduNoQuestions")}</div>
            ) : questions.map((q, qi) => (
              <div key={q.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", opacity: q.active ? 1 : 0.5 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--brand)", fontWeight: 800 }}>{qi + 1}.</span>
                  <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{q.body}</span>
                  <button className="btn ghost sm" onClick={() => toggleQ(q)}>{q.active ? tr("eduDeactivate") : tr("eduActivate")}</button>
                  <button className="btn ghost sm" onClick={() => delQ(q)}>✕</button>
                </div>
                <div style={{ marginTop: 6, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                  {optText(q.options).map((o: any, oi: number) => (
                    <div key={oi} style={{ fontSize: 12.5, color: o.key === q.correct_key ? "#18794e" : "var(--muted)", fontWeight: o.key === q.correct_key ? 700 : 400 }}>
                      {o.key === q.correct_key ? "✓ " : "• "}{o.text}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (s: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} inputMode="numeric" style={{ ...inp, width: 120 }} dir="ltr" />
    </label>
  );
}

const sel: CSSProperties = { height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13, fontWeight: 600, minWidth: 220 };
const inp: CSSProperties = { height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13 };
