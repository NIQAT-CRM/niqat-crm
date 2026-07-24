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
    toast(tr("saved2")); router.refresh();
  }

  return (
    <div className="card settings-anim" style={{ padding: 18, marginBottom: 18 }}>
      <div className="card-h" style={{ padding: 0, border: "none" }}><h3>{tr("companyTitle")}</h3></div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 14px" }}>{tr("companyHint")}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, alignItems: "end" }}>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("companyName")}</label>
          <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="NIQAT" /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("companyLogo")}</label>
          <input className="inp" type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} /></div>
        <button className="btn" onClick={save} disabled={busy} style={{ height: 40 }}>{busy ? "..." : tr("save")}</button>
      </div>
      {logo && <div style={{ fontSize: 11.5, color: "var(--green)", marginTop: 8 }}>✓ {tr("companyLogo")}: {logo.split("/").pop()}</div>}
    </div>
  );
}
