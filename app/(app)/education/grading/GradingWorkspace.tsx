"use client";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

type BatchOpt = { id: string; code: string; diploma: string };
type Sem = { id: string; title: string; sort: number };
type Task = { id: string; title: string; sort: number };
type Cust = { id: string; name: string };

export default function GradingWorkspace({ batches }: { batches: BatchOpt[] }) {
  const tr = useT();
  const supabase = createClient();

  const [batchId, setBatchId] = useState("");
  const [sems, setSems] = useState<Sem[]>([]);
  const [semId, setSemId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [custs, setCusts] = useState<Cust[]>([]);
  const [loading, setLoading] = useState(false);

  // نتائج: results[customerId][taskId] = 'pass'|'fail'; sem[customerId] = {pct,status}
  const [results, setResults] = useState<Record<string, Record<string, string>>>({});
  const [semState, setSemState] = useState<Record<string, { pct: number | null; status: string }>>({});
  const [openCust, setOpenCust] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  async function pickBatch(id: string) {
    setBatchId(id); setSemId(""); setTasks([]); setSems([]); setCusts([]);
    setResults({}); setSemState({}); setOpenCust(null);
    if (!id) return;
    setLoading(true);
    const [{ data: sm }, { data: enr }] = await Promise.all([
      supabase.from("edu_batch_semesters").select("id, title, sort").eq("batch_id", id).order("sort"),
      supabase.from("enrollments").select("customer_id").eq("batch_id", id).limit(1000),
    ]);
    const ids = [...new Set(((enr || []) as any[]).map((e) => e.customer_id).filter(Boolean))];
    let cs: Cust[] = [];
    if (ids.length) {
      const { data } = await supabase.from("edu_v_customers").select("id, name").in("id", ids);
      cs = ((data || []) as any[]).map((c) => ({ id: c.id, name: c.name }));
      cs.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }
    setSems(((sm || []) as any[]).map((s) => ({ id: s.id, title: s.title, sort: s.sort })));
    setCusts(cs);
    setLoading(false);
  }

  async function pickSem(id: string) {
    setSemId(id); setTasks([]); setResults({}); setSemState({}); setOpenCust(null);
    if (!id) return;
    setLoading(true);
    const { data: tk } = await supabase.from("edu_batch_tasks").select("id, title, sort").eq("batch_semester_id", id).order("sort");
    const taskList = ((tk || []) as any[]).map((t) => ({ id: t.id, title: t.title, sort: t.sort }));
    const taskIds = taskList.map((t) => t.id);

    const [{ data: trows }, { data: srows }] = await Promise.all([
      taskIds.length ? supabase.from("edu_task_results").select("customer_id, batch_task_id, result").in("batch_task_id", taskIds) : Promise.resolve({ data: [] }),
      supabase.from("edu_semester_results").select("customer_id, pct, status").eq("batch_semester_id", id),
    ]);
    const rmap: Record<string, Record<string, string>> = {};
    for (const r of (trows || []) as any[]) {
      (rmap[r.customer_id] = rmap[r.customer_id] || {})[r.batch_task_id] = r.result;
    }
    const smap: Record<string, { pct: number | null; status: string }> = {};
    for (const s of (srows || []) as any[]) smap[s.customer_id] = { pct: s.pct, status: s.status };

    setTasks(taskList); setResults(rmap); setSemState(smap);
    setLoading(false);
  }

  async function grade(custId: string, taskId: string, result: "pass" | "fail") {
    setBusy(custId + taskId);
    const { error } = await supabase.rpc("edu_grade_task", { p_customer: custId, p_batch_task: taskId, p_result: result });
    if (error) { toast(error.message); setBusy(null); return; }
    setResults((s) => ({ ...s, [custId]: { ...(s[custId] || {}), [taskId]: result } }));
    // تحديث نسبة السمستر
    const { data: pct } = await supabase.rpc("edu_semester_pct", { p_customer: custId, p_batch_semester: semId });
    if (typeof pct === "number") setSemState((s) => ({ ...s, [custId]: { pct, status: s[custId]?.status || "open" } }));
    setBusy(null);
  }

  async function lockSem(custId: string) {
    const ok = await confirmDialog({ message: tr("eduConfirmLock") });
    if (!ok) return;
    setBusy("lock" + custId);
    const { error } = await supabase.rpc("edu_lock_semester", { p_customer: custId, p_batch_semester: semId });
    setBusy(null);
    if (error) { toast(error.message); return; }
    setSemState((s) => ({ ...s, [custId]: { pct: s[custId]?.pct ?? null, status: "locked" } }));
    toast(tr("eduSemLocked"));
  }

  async function addComment(custId: string) {
    const body = (commentDraft[custId] || "").trim();
    if (!body) return;
    setBusy("cm" + custId);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("edu_comments").insert({
      customer_id: custId, target_type: "semester", target_id: semId, body,
      author_id: user?.id || null, visible_to_customer: true,
    });
    setBusy(null);
    if (error) { toast(error.message); return; }
    setCommentDraft((s) => ({ ...s, [custId]: "" }));
    toast(tr("eduCommentAdded"));
  }

  const batchesByDip = useMemo(() => {
    const m = new Map<string, BatchOpt[]>();
    for (const b of batches) { const k = b.diploma || tr("eduNoDiploma"); (m.get(k) || m.set(k, []).get(k))!.push(b); }
    return [...m.entries()];
  }, [batches, tr]);

  return (
    <div className="page-h" style={{ display: "block" }}>
      <h1>{tr("eduGrading")}</h1>

      {/* اختيار الباتش والسمستر */}
      <div className="card" style={{ padding: 16, marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={batchId} onChange={(e) => pickBatch(e.target.value)} style={sel}>
          <option value="">{tr("eduPickBatch")}</option>
          {batchesByDip.map(([dip, list]) => (
            <optgroup key={dip} label={dip}>
              {list.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
            </optgroup>
          ))}
        </select>
        <select value={semId} onChange={(e) => pickSem(e.target.value)} style={sel} disabled={!batchId || sems.length === 0}>
          <option value="">{sems.length ? tr("eduPickSemester") : tr("eduNoSemesters")}</option>
          {sems.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("eduLoading")}</span>}
      </div>

      {/* العملاء + التصحيح */}
      {semId && !loading && (
        custs.length === 0 ? (
          <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>{tr("noCustomersInBatch")}</div>
        ) : (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {custs.map((c) => {
              const st = semState[c.id];
              const locked = st?.status === "locked";
              const isOpen = openCust === c.id;
              return (
                <div key={c.id} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
                  <button onClick={() => setOpenCust(isOpen ? null : c.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", flex: 1 }}>{c.name}</span>
                    {st?.pct != null && <span className="chip" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}>{Math.round(st.pct)}%</span>}
                    {locked && <span className="chip" style={{ background: "var(--green-soft)", color: "var(--green)" }}>{tr("eduLocked")}</span>}
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--line)", padding: 14, background: "var(--card)", display: "flex", flexDirection: "column", gap: 10 }}>
                      {tasks.map((t) => {
                        const cur = results[c.id]?.[t.id];
                        const bk = busy === c.id + t.id;
                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={{ flex: "1 1 160px", fontSize: 13, color: "var(--ink)" }}>{t.title}</span>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button disabled={bk || locked} onClick={() => grade(c.id, t.id, "pass")}
                                style={pill(cur === "pass", "#18794e", "#e7f7ec")}>{tr("eduPass")}</button>
                              <button disabled={bk || locked} onClick={() => grade(c.id, t.id, "fail")}
                                style={pill(cur === "fail", "#b42318", "#fdecea")}>{tr("eduFail")}</button>
                            </div>
                          </div>
                        );
                      })}
                      {tasks.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("eduNoTasks")}</div>}

                      {/* كومنت */}
                      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                        <input value={commentDraft[c.id] || ""} onChange={(e) => setCommentDraft((s) => ({ ...s, [c.id]: e.target.value }))}
                          placeholder={tr("eduCommentPh")} style={{ ...inp, flex: "1 1 220px" }} />
                        <button className="btn ghost sm" disabled={busy === "cm" + c.id || !(commentDraft[c.id] || "").trim()} onClick={() => addComment(c.id)}>{tr("eduAddComment")}</button>
                      </div>

                      {/* اعتماد السمستر */}
                      {!locked && (
                        <div>
                          <button className="btn sm" disabled={busy === "lock" + c.id} onClick={() => lockSem(c.id)}>{tr("eduLockSemester")}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

const sel: CSSProperties = { height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13, fontWeight: 600, minWidth: 180 };
const inp: CSSProperties = { height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13 };
function pill(active: boolean, fg: string, bg: string): CSSProperties {
  return { padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer",
    border: "1px solid " + (active ? fg : "var(--line)"), background: active ? bg : "transparent", color: active ? fg : "var(--muted)" };
}
