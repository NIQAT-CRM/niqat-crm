"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

export default function RecentYearsCard({ initial }: { initial: { years?: number[] } }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [years, setYears] = useState<number[]>(Array.isArray(initial?.years) ? [...initial.years].sort((a, b) => b - a) : []);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  function addYear() {
    const y = parseInt(input, 10);
    if (!y || y < 1950 || y > 2100) { toast(tr("enterValidYear")); return; }
    if (!years.includes(y)) setYears((p) => [...p, y].sort((a, b) => b - a));
    setInput("");
  }
  function removeYear(y: number) { setYears((p) => p.filter((x) => x !== y)); }

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "recent_grad_years", value: { years } }, { onConflict: "key" });
    setBusy(false);
    if (error) { toast(tr("saveFailed") + error.message); return; }
    toast(tr("saved2")); setEditing(false); router.refresh();
  }
  function cancel() { setYears(Array.isArray(initial?.years) ? [...initial.years].sort((a, b) => b - a) : []); setInput(""); setEditing(false); }

  return (
    <div className="intcard settings-anim">
      <div className="intcard-h">
        <div><h3>{tr("recentYearsTitle")}</h3><p>{tr("recentYearsHint")}</p></div>
        <div className="acts">
          {!editing ? (
            <button className="rowbtn edit" onClick={() => setEditing(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>{tr("edit")}
            </button>
          ) : (<>
            <button className="btn sm" onClick={save} disabled={busy}>{busy ? "..." : tr("save")}</button>
            <button className="rowbtn cancel" onClick={cancel}>{tr("cancel")}</button>
          </>)}
        </div>
      </div>

      {editing && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input className="inp num" dir="ltr" inputMode="numeric" placeholder="2025" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addYear(); }} style={{ maxWidth: 140 }} />
          <button className="btn sm" onClick={addYear}>{tr("add")}</button>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {years.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("noRecentYears")}</span>}
        {years.map((y) => (
          <span key={y} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--green-soft)", color: "var(--green)", fontFamily: "var(--fd)", fontWeight: 800, fontSize: 13, padding: "6px 12px", borderRadius: 20 }}>
            {y}
            {editing && <button onClick={() => removeYear(y)} style={{ border: "none", background: "none", color: "var(--green)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>}
          </span>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12, marginBottom: 0 }}>💡 {tr("recentYearsNote")}</p>
    </div>
  );
}
