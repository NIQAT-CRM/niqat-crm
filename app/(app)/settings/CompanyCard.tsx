"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

export default function CompanyCard({ initial }: { initial: { name?: string; currency?: string; logo?: string } }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initial?.name || "");
  const [logo, setLogo] = useState(initial?.logo || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | null) {
    if (!f) return;
    setBusy(true);
    const path = `company/logo-${Date.now()}-${f.name}`;
    const up = await supabase.storage.from("receipts").upload(path, f, { upsert: true });
    setBusy(false);
    if (up.error) { toast(tr("imgUploadFailed")); return; }
    setLogo(path); toast(tr("uploaded" as any) || "OK");
  }
  async function save() {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "company", value: { name: name.trim(), logo } }, { onConflict: "key" });
    setBusy(false);
    if (error) { toast(tr("saveFailed") + error.message); return; }
    toast(tr("saved2")); setEditing(false); router.refresh();
  }
  function cancel() { setName(initial?.name || ""); setLogo(initial?.logo || ""); setEditing(false); }

  return (
    <div className="intcard settings-anim">
      <div className="intcard-h">
        <div><h3>{tr("companyTitle")}</h3><p>{tr("companyHint")}</p></div>
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
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("companyName")}</label>
          <input className="inp" disabled={!editing} value={name} onChange={(e) => setName(e.target.value)} placeholder="NIQAT" /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("companyLogo")}</label>
          <input className="inp" type="file" accept="image/*" disabled={!editing} onChange={(e) => onFile(e.target.files?.[0] || null)} /></div>
      </div>
      {logo && <div style={{ fontSize: 11.5, color: "var(--green)", marginTop: 10 }}>✓ {tr("companyLogo")}: {logo.split("/").pop()}</div>}
    </div>
  );
}
