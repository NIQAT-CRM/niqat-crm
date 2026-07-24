"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

export default function DefaultsCard({ initial }: { initial: { inst_count?: number; inst_gap?: number } }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [count, setCount] = useState(String(initial?.inst_count ?? 3));
  const [gap, setGap] = useState(String(initial?.inst_gap ?? 1));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const value = { inst_count: Math.max(1, Number(count) || 1), inst_gap: Math.max(1, Number(gap) || 1) };
    const { error } = await supabase.from("app_settings").upsert({ key: "defaults", value }, { onConflict: "key" });
    setBusy(false);
    if (error) { toast(tr("saveFailed") + error.message); return; }
    toast(tr("saved2")); router.refresh();
  }

  return (
    <div className="card settings-anim" style={{ padding: 18, marginBottom: 18 }}>
      <div className="card-h" style={{ padding: 0, border: "none" }}><h3>{tr("defaultInstTitle")}</h3></div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 14px" }}>{tr("defaultInstHint")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, alignItems: "end" }}>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("installmentCount")}</label>
          <input className="inp num" dir="ltr" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("installmentGap")}</label>
          <input className="inp num" dir="ltr" inputMode="numeric" value={gap} onChange={(e) => setGap(e.target.value)} /></div>
        <button className="btn" onClick={save} disabled={busy} style={{ height: 40 }}>{busy ? "..." : tr("save")}</button>
      </div>
    </div>
  );
}
