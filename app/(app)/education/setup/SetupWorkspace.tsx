"use client";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

type Dip = { id: string; name: string };
type Bat = { id: string; code: string; diploma_id: string };
type Task = { id: string; title: string; description: string | null; sort: number };
type Sem = { id: string; title: string; sort: number; tasks: Task[] };

export default function SetupWorkspace({ diplomas, batches }: { diplomas: Dip[]; batches: Bat[] }) {
  const tr = useT();
  const supabase = createClient();

  const [dipId, setDipId] = useState("");
  const [sems, setSems] = useState<Sem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newSem, setNewSem] = useState("");
  const [taskDraft, setTaskDraft] = useState<Record<string, { t: string; d: string }>>({});

  const [cloneBatch, setCloneBatch] = useState("");
  const [cloning, setCloning] = useState(false);

  // قاعدة الاستحقاق (edu_diploma_rules)
  const [rule, setRule] = useState<{ pass_pct: string; method: string; locked: boolean } | null>(null);
  const [ruleSaving, setRuleSaving] = useState(false);
  const METHODS: [string, string][] = [["all_pass", "eduMethodAllPass"], ["avg_pct", "eduMethodAvg"], ["overall_pct", "eduMethodOverall"]];

  const batchesOfDip = useMemo(() => batches.filter((b) => b.diploma_id === dipId), [batches, dipId]);

  async function pickDiploma(id: string) {
    setDipId(id); setSems([]); setCloneBatch(""); setRule(null);
    if (!id) return;
    setLoading(true);
    const { data: rl } = await supabase.from("edu_diploma_rules").select("pass_pct, method, locked").eq("diploma_id", id).maybeSingle();
    setRule(rl ? { pass_pct: String(rl.pass_pct), method: rl.method, locked: !!rl.locked } : { pass_pct: "75", method: "all_pass", locked: false });
    const { data: sm } = await supabase.from("edu_diploma_semesters").select("id, title, sort").eq("diploma_id", id).order("sort");
    const semList = ((sm || []) as any[]).map((s) => ({ id: s.id, title: s.title, sort: s.sort, tasks: [] as Task[] }));
    const semIds = semList.map((s) => s.id);
    if (semIds.length) {
      const { data: tk } = await supabase.from("edu_diploma_tasks").select("id, semester_id, title, description, sort").in("semester_id", semIds).order("sort");
      const bySem = new Map<string, Task[]>();
      for (const t of (tk || []) as any[]) (bySem.get(t.semester_id) || bySem.set(t.semester_id, []).get(t.semester_id))!.push({ id: t.id, title: t.title, description: t.description, sort: t.sort });
      for (const s of semList) s.tasks = bySem.get(s.id) || [];
    }
    setSems(semList);
    setLoading(false);
  }

  async function addSemester() {
    const title = newSem.trim();
    if (!title) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("edu_diploma_semesters")
      .insert({ diploma_id: dipId, title, sort: sems.length, created_by: user?.id || null })
      .select("id, title, sort").single();
    setBusy(false);
    if (error) { toast(error.message); return; }
    setSems((s) => [...s, { id: (data as any).id, title, sort: (data as any).sort, tasks: [] }]);
    setNewSem("");
  }

  async function addTask(semId: string) {
    const d = taskDraft[semId] || { t: "", d: "" };
    const title = d.t.trim();
    if (!title) return;
    setBusy(true);
    const sem = sems.find((s) => s.id === semId);
    const { data, error } = await supabase.from("edu_diploma_tasks")
      .insert({ semester_id: semId, title, description: d.d.trim(), sort: sem?.tasks.length || 0 })
      .select("id, title, description, sort").single();
    setBusy(false);
    if (error) { toast(error.message); return; }
    setSems((list) => list.map((s) => s.id === semId ? { ...s, tasks: [...s.tasks, { id: (data as any).id, title, description: (data as any).description, sort: (data as any).sort }] } : s));
    setTaskDraft((s) => ({ ...s, [semId]: { t: "", d: "" } }));
  }

  async function delTask(semId: string, taskId: string) {
    const { error } = await supabase.from("edu_diploma_tasks").delete().eq("id", taskId);
    if (error) { toast(error.message); return; }
    setSems((list) => list.map((s) => s.id === semId ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s));
  }

  async function delSemester(semId: string) {
    const ok = await confirmDialog({ message: tr("eduConfirmDelSem"), danger: true });
    if (!ok) return;
    const { error } = await supabase.from("edu_diploma_semesters").delete().eq("id", semId);
    if (error) { toast(error.message); return; }
    setSems((list) => list.filter((s) => s.id !== semId));
  }

  async function saveRule() {
    if (!rule) return;
    if (rule.locked) {
      const ok = await confirmDialog({ message: tr("eduRuleLockedWarn"), danger: true });
      if (!ok) return;
    }
    setRuleSaving(true);
    const { error } = await supabase.from("edu_diploma_rules").upsert(
      { diploma_id: dipId, pass_pct: parseFloat(rule.pass_pct) || 0, method: rule.method },
      { onConflict: "diploma_id" }
    );
    setRuleSaving(false);
    if (error) { toast(error.message); return; }
    toast(tr("eduRuleSaved"));
  }

  async function cloneToBatch() {
    if (!cloneBatch) return;
    setCloning(true);
    const { data, error } = await supabase.rpc("edu_clone_template_to_batch", { p_batch_id: cloneBatch });
    setCloning(false);
    if (error) { toast(error.message); return; }
    toast(tr("eduCloned"));
  }

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div>
        <h1>{tr("eduSetupTitle")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{tr("eduSetupDesc")}</p>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <select value={dipId} onChange={(e) => pickDiploma(e.target.value)} style={sel}>
          <option value="">{tr("eduPickDiploma")}</option>
          {diplomas.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {loading && <span style={{ marginInlineStart: 10, fontSize: 12.5, color: "var(--muted)" }}>{tr("eduLoading")}</span>}
      </div>

      {dipId && !loading && (
        <>
          {/* قاعدة الاستحقاق */}
          {rule && (
            <div className="card" style={{ padding: 16, marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }}>{tr("eduEligRule")}</span>
                {rule.locked && <span className="chip" style={{ background: "#fdf0d8", color: "#8a5a00" }}>🔒 {tr("eduRuleLocked")}</span>}
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>{tr("eduEligRuleDesc")}</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{tr("eduPassPct")}</span>
                  <input value={rule.pass_pct} onChange={(e) => setRule((r) => r && { ...r, pass_pct: e.target.value })} inputMode="numeric" dir="ltr" style={{ ...inp, width: 110 }} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{tr("eduEligMethod")}</span>
                  <select value={rule.method} onChange={(e) => setRule((r) => r && { ...r, method: e.target.value })} style={{ ...sel, minWidth: 180 }}>
                    {METHODS.map(([v, k]) => <option key={v} value={v}>{tr(k)}</option>)}
                  </select>
                </label>
                <button className="btn" onClick={saveRule} disabled={ruleSaving}>{tr("eduSaveSettings")}</button>
              </div>
              {rule.locked && <p style={{ fontSize: 11.5, color: "#b06a00", marginTop: 10 }}>⚠️ {tr("eduRuleLockedNote")}</p>}
            </div>
          )}

          {/* السمسترات */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {sems.map((s) => (
              <div key={s.id} style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", flex: 1 }}>{s.title}</span>
                  <span className="chip" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}>{s.tasks.length}</span>
                  <button className="btn ghost sm" onClick={() => delSemester(s.id)}>✕</button>
                </div>
                {s.tasks.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderTop: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{t.title}</span>
                    {t.description && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.description}</span>}
                    <button className="btn ghost sm" onClick={() => delTask(s.id, t.id)}>✕</button>
                  </div>
                ))}
                {/* إضافة تاسك */}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <input value={(taskDraft[s.id]?.t) || ""} onChange={(e) => setTaskDraft((x) => ({ ...x, [s.id]: { t: e.target.value, d: x[s.id]?.d || "" } }))}
                    placeholder={tr("eduTaskName")} style={{ ...inp, flex: "1 1 160px" }} />
                  <input value={(taskDraft[s.id]?.d) || ""} onChange={(e) => setTaskDraft((x) => ({ ...x, [s.id]: { t: x[s.id]?.t || "", d: e.target.value } }))}
                    placeholder={tr("eduTaskDesc")} style={{ ...inp, flex: "1 1 160px" }} />
                  <button className="btn ghost sm" disabled={busy || !(taskDraft[s.id]?.t || "").trim()} onClick={() => addTask(s.id)}>{tr("eduAddTask")}</button>
                </div>
              </div>
            ))}
            {sems.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("eduNoSemsTemplate")}</div>}
          </div>

          {/* إضافة سمستر */}
          <div className="card" style={{ padding: 16, marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={newSem} onChange={(e) => setNewSem(e.target.value)} placeholder={tr("eduSemesterName")} style={{ ...inp, flex: "1 1 220px" }} />
            <button className="btn" disabled={busy || !newSem.trim()} onClick={addSemester}>{tr("eduAddSemester")}</button>
          </div>

          {/* نسخ لباتش */}
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)", marginBottom: 4 }}>{tr("eduCloneToBatch")}</div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>{tr("eduCloneHint")}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={cloneBatch} onChange={(e) => setCloneBatch(e.target.value)} style={sel} disabled={batchesOfDip.length === 0}>
                <option value="">{batchesOfDip.length ? tr("eduPickBatch") : tr("eduNoBatchesForDip")}</option>
                {batchesOfDip.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </select>
              <button className="btn" disabled={cloning || !cloneBatch || sems.length === 0} onClick={cloneToBatch}>{tr("eduCloneBtn")}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const sel: CSSProperties = { height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13, fontWeight: 600, minWidth: 200 };
const inp: CSSProperties = { height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13 };
