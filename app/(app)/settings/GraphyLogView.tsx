"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/client";

type Run = { id: string; created_at: string; actor?: { full_name?: string } | null; course_titles: string[]; customers_count: number; total: number; succeeded: number; failed: number };
type Item = { name: string; email: string; course_title: string; ok: boolean; reason: string };

export default function GraphyLogView({ runs }: { runs: Run[] }) {
  const lang = useLang();
  const supabase = createClient();
  const [open, setOpen] = useState<Run | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fmt = (iso: string) => iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

  async function openRun(r: Run) {
    setOpen(r); setItems(null); setLoading(true);
    const { data } = await supabase.from("graphy_run_items").select("name,email,course_title,ok,reason").eq("run_id", r.id).order("ok", { ascending: true });
    setItems((data as Item[]) || []); setLoading(false);
  }
  function exportCsv() {
    if (!items) return;
    const head = ["Name", "Email", "Course", "Result", "Reason"];
    const lines = items.map((r) => [r.name, r.email, r.course_title, r.ok ? "Success" : "Failed", r.reason || ""]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `graphy-run-${(open?.created_at || "").slice(0, 10)}.csv`; a.click();
  }

  const rowCols = "1.1fr 1.3fr 1.3fr 48px";
  if (open) {
    return (
      <div>
        <button className="btn ghost" style={{ marginBottom: 12 }} onClick={() => { setOpen(null); setItems(null); }}>← رجوع للسجل</button>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, color: "var(--ink)" }}>{fmt(open.created_at)}</span>
          <span style={{ color: "var(--green)", fontWeight: 700 }}>✅ {open.succeeded}</span>
          <span style={{ color: "var(--red)", fontWeight: 700 }}>❌ {open.failed}</span>
          <button className="btn" style={{ marginInlineStart: "auto" }} onClick={exportCsv} disabled={!items}>⬇ Excel</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>🎓 {(open.course_titles || []).join(" · ")}</div>
        {loading ? <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>...</div> : (
          <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "auto", maxHeight: "60vh" }}>
            {(items || []).map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: rowCols, gap: 8, padding: "9px 12px", borderBottom: "1px solid var(--line)", fontSize: 12.5, alignItems: "center", background: i % 2 ? "transparent" : "var(--muted-soft)" }}>
                <span style={{ fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name || "—"}</span>
                <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.course_title}>{r.course_title || "—"}</span>
                <span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.ok ? r.email : r.reason}>{r.ok ? r.email : (r.reason || "—")}</span>
                <span style={{ fontWeight: 800, color: r.ok ? "var(--green)" : "var(--red)" }}>{r.ok ? "✅" : "❌"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {runs.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>مفيش عمليات Graphy لسه</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {runs.map((r) => (
            <button key={r.id} onClick={() => openRun(r)} style={{ textAlign: "start", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13 }}>{fmt(r.created_at)}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.actor?.full_name || "—"}</span>
              <span style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>🎓 {(r.course_titles || []).join(" · ")}</span>
              <span style={{ marginInlineStart: "auto", display: "flex", gap: 10, fontWeight: 700, fontSize: 13 }}>
                <span style={{ color: "var(--green)" }}>✅ {r.succeeded}</span>
                <span style={{ color: "var(--red)" }}>❌ {r.failed}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
