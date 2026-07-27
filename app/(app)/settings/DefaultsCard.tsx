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
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const value = { inst_count: Math.max(1, Number(count) || 1), inst_gap: Math.max(1, Number(gap) || 1) };
    const { error } = await supabase.from("app_settings").upsert({ key: "defaults", value }, { onConflict: "key" });
    setBusy(false);
    if (error) { toast(tr("saveFailed") + error.message); return; }
    toast(tr("saved2")); setEditing(false); router.refresh();
  }
  function cancel() { setCount(String(initial?.inst_count ?? 3)); setGap(String(initial?.inst_gap ?? 1)); setEditing(false); }

  return (
    <div className="intcard settings-anim">
      <div className="intcard-h">
        <div><h3>{tr("defaultInstTitle")}</h3><p>{tr("defaultInstHint")}</p></div>
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
      <div className="fldgrid">
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("installmentCount")}</label>
          <input className="inp num" dir="ltr" inputMode="numeric" disabled={!editing} value={count} onChange={(e) => setCount(e.target.value)} /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("installmentGap")}</label>
          <input className="inp num" dir="ltr" inputMode="numeric" disabled={!editing} value={gap} onChange={(e) => setGap(e.target.value)} /></div>
      </div>
    </div>
  );
}
