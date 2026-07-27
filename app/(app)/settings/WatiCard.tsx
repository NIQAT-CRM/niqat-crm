"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Wati = { endpoint: string; token: string; sender_sales: string; sender_support: string };

export default function WatiCard({ initial }: { initial: Wati }) {
  const tr = useT();
  const supabase = createClient();
  const [w, setW] = useState<Wati>(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Wati, v: string) => setW((s) => ({ ...s, [k]: v }));

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "wati", value: w, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast(tr("saveFailed")); return; }
    toast(tr("watiSaved")); setEditing(false);
  }
  function cancel() { setW(initial); setEditing(false); }

  return (
    <div className="intcard settings-anim">
      <div className="intcard-h">
        <div><h3>{tr("watiTitle")}</h3></div>
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
        <div className="fld full" style={{ marginBottom: 0 }}><label>Endpoint</label>
          <input className="inp" dir="ltr" disabled={!editing} value={w.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder="https://live-server.wati.io/api/v1" /></div>
        <div className="fld full" style={{ marginBottom: 0 }}><label>API Token</label>
          <input className="inp" dir="ltr" type="password" disabled={!editing} value={w.token} onChange={(e) => set("token", e.target.value)} placeholder="••••••••" /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("senderNumberSales")}</label>
          <input className="inp" dir="ltr" disabled={!editing} value={w.sender_sales} onChange={(e) => set("sender_sales", e.target.value)} placeholder="2010xxxxxxxx" /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("senderNumberSupport")}</label>
          <input className="inp" dir="ltr" disabled={!editing} value={w.sender_support} onChange={(e) => set("sender_support", e.target.value)} placeholder="2010xxxxxxxx" /></div>
      </div>
    </div>
  );
}
