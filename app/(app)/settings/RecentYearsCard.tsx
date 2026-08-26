"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

const IcDel = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;

export default function RecentYearsCard({ initial }: { initial: { years?: number[] } }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [years, setYears] = useState<number[]>(Array.isArray(initial?.years) ? [...initial.years].sort((a, b) => b - a) : []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function persist(next: number[]) {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "recent_grad_years", value: { years: next } }, { onConflict: "key" });
    setBusy(false);
    if (error) { toast(tr("saveFailed") + error.message); return false; }
    router.refresh(); return true;
  }
  async function add() {
    const y = parseInt(input, 10);
    if (!y || y < 1950 || y > 2100) { toast(tr("enterValidYear")); return; }
    if (years.includes(y)) { setInput(""); return; }
    const next = [...years, y].sort((a, b) => b - a);
    if (await persist(next)) { setYears(next); setInput(""); toast(tr("added")); }
  }
  async function remove(y: number) {
    const next = years.filter((x) => x !== y);
    if (await persist(next)) { setYears(next); }
  }

  return (
    <div className="setcard settings-anim">
      <div className="setcard-h">
        <div><h3>{tr("recentYearsTitle")}</h3><p>{tr("recentYearsHint")}</p></div>
      </div>

      <div className="setscroll">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 2px" }}>
          {years.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("noRecentYears")}</span>}
          {years.map((y) => (
            <span key={y} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--green-soft)", color: "var(--green)", fontFamily: "var(--fd)", fontWeight: 800, fontSize: 14, padding: "8px 14px", borderRadius: 12 }}>
              {y}
              <button onClick={() => remove(y)} disabled={busy} title={tr("delete")} style={{ border: "none", background: "none", color: "var(--green)", cursor: "pointer", display: "grid", placeItems: "center", padding: 0, width: 15, height: 15, opacity: .75 }}>
                <IcDel />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="setadd">
        <input className="inp num" dir="ltr" inputMode="numeric" placeholder="2026" value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="setaddbtn" onClick={add} disabled={busy} title={tr("add")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "10px 14px 0" }}>💡 {tr("recentYearsNote")}</p>
    </div>
  );
}
