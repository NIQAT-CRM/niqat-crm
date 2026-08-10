"use client";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Appeal = {
  id: string; customer: string; source_type: string; reason: string;
  status: string; assignee_id: string | null; assignee: string | null;
  response: string | null; created_at: string;
};
type Member = { id: string; name: string; role: string };

export default function AppealsManager({ appeals, members }: { appeals: Appeal[]; members: Member[] }) {
  const tr = useT();
  const supabase = createClient();
  const [rows, setRows] = useState<Appeal[]>(appeals);
  const [busy, setBusy] = useState<string | null>(null);
  const [resp, setResp] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");

  const statusLabel = (s: string) => ({ open: tr("eduAppealOpen"), under_review: tr("eduAppealReview"), upheld: tr("eduAppealUpheld"), rejected: tr("eduAppealRejected") } as any)[s] || s;
  const statusColor = (s: string): [string, string] => ({ upheld: ["#18794e", "#e7f7ec"], rejected: ["#b42318", "#fdecea"], under_review: ["#8a5a00", "#fdf0d8"], open: ["#8a5a00", "#fdf0d8"] } as any)[s] || ["var(--muted)", "var(--muted-soft)"];

  const shown = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "decided") return rows.filter((a) => a.status === "upheld" || a.status === "rejected");
    return rows.filter((a) => a.status === filter);
  }, [rows, filter]);

  async function assign(a: Appeal, memberId: string) {
    setBusy(a.id);
    const { error } = await supabase.rpc("edu_assign_appeal", { p_appeal: a.id, p_assignee: memberId });
    setBusy(null);
    if (error) { toast(error.message); return; }
    const m = members.find((x) => x.id === memberId);
    setRows((r) => r.map((x) => x.id === a.id ? { ...x, assignee_id: memberId, assignee: m?.name || "—", status: x.status === "open" ? "under_review" : x.status } : x));
    toast(tr("eduAppealAssigned"));
  }

  async function decide(a: Appeal, decision: "upheld" | "rejected") {
    setBusy(a.id);
    const { error } = await supabase.rpc("edu_decide_appeal", { p_appeal: a.id, p_decision: decision, p_response: (resp[a.id] || "").trim() });
    setBusy(null);
    if (error) { toast(error.message); return; }
    setRows((r) => r.map((x) => x.id === a.id ? { ...x, status: decision, response: (resp[a.id] || "").trim() } : x));
    toast(tr("eduAppealDecided"));
  }

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ flex: 1 }}>{tr("eduAppeals")}</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={sel}>
          <option value="all">{tr("eduAllStatuses")}</option>
          <option value="open">{tr("eduAppealOpen")}</option>
          <option value="under_review">{tr("eduAppealReview")}</option>
          <option value="decided">{tr("eduDecided")}</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <div style={{ marginTop: 18, fontSize: 13, color: "var(--muted)" }}>{tr("eduNoAppeals")}</div>
      ) : (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((a) => {
            const decided = a.status === "upheld" || a.status === "rejected";
            const bk = busy === a.id;
            return (
              <div key={a.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{a.customer}</span>
                  <span className="chip" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}>
                    {a.source_type === "exam" ? tr("eduAccredsSec") : tr("eduDiplomaResult")}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="chip" style={{ background: statusColor(a.status)[1], color: statusColor(a.status)[0] }}>{statusLabel(a.status)}</span>
                </div>

                {a.reason && <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 8 }}><b style={{ color: "var(--muted)", fontWeight: 700 }}>{tr("eduAppealReason")}: </b>{a.reason}</div>}
                <div className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }} dir="ltr">{String(a.created_at).slice(0, 10)}</div>

                {!decided ? (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("eduAssignTo")}:</span>
                      <select value={a.assignee_id || ""} onChange={(e) => e.target.value && assign(a, e.target.value)} style={sel} disabled={bk}>
                        <option value="">{tr("eduUnassigned")}</option>
                        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <textarea value={resp[a.id] || ""} onChange={(e) => setResp((s) => ({ ...s, [a.id]: e.target.value }))}
                      placeholder={tr("eduResponsePh")} rows={2} style={ta} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn sm" disabled={bk} onClick={() => decide(a, "upheld")} style={{ background: "#18794e", borderColor: "#18794e", color: "#fff" }}>{tr("eduUphold")}</button>
                      <button className="btn ghost sm" disabled={bk} onClick={() => decide(a, "rejected")}>{tr("eduReject")}</button>
                    </div>
                  </div>
                ) : (
                  a.response && <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>{a.response}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const sel: CSSProperties = { height: 38, padding: "0 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13, fontWeight: 600 };
const ta: CSSProperties = { padding: "10px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13, resize: "vertical", fontFamily: "inherit" };
