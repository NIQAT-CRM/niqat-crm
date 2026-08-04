"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";

const STATUSES = ["active", "inactive", "negotiating", "signed"] as const;
const STK: Record<string, string> = { active: "uniStActive", inactive: "uniStInactive", negotiating: "uniStNegotiating", signed: "uniStSigned" };

export default function NewUniForm() {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name_ar: "", name_en: "", status: "negotiating", college: "", department: "", country: "",
    responsible_name: "", responsible_phone: "", responsible_email: "", university_email: "", wa_number: "", notes: "",
  });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.name_ar.trim()) return toast(tr("uniNameArRequired"));
    setBusy(true);
    const { data, error } = await supabase.from("universities").insert({
      name_ar: f.name_ar.trim(), name_en: f.name_en.trim(), status: f.status,
      college: f.college.trim(), department: f.department.trim(), country: f.country.trim(),
      responsible_name: f.responsible_name.trim(), responsible_phone: f.responsible_phone.trim(),
      responsible_email: f.responsible_email.trim(), university_email: f.university_email.trim(),
      wa_number: f.wa_number.trim(), notes: f.notes.trim(),
    }).select("id").single();
    if (error) { setBusy(false); return toast(tr("uniSaveFailed") + error.message); }
    toast(tr("uniSaved"));
    router.push(`/universities/${(data as any)?.id}`);
  }

  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 5, display: "block" };
  const Field = ({ k, label, type = "text" }: { k: string; label: string; type?: string }) => (
    <div>
      <label style={lbl}>{label}</label>
      <input className="inp" type={type} dir={type === "text" ? undefined : "ltr"} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} style={{ width: "100%" }} />
    </div>
  );

  return (
    <div>
      <div className="page-h"><div><h1>{tr("uniNewTitle")}</h1></div>
        <Link href="/universities" className="btn ghost">{tr("back")}</Link>
      </div>
      <div className="card" style={{ padding: 20, maxWidth: 720, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        <div>
          <label style={lbl}>{tr("uniNameAr")} *</label>
          <input className="inp" value={f.name_ar} onChange={(e) => set("name_ar", e.target.value)} style={{ width: "100%" }} />
        </div>
        <Field k="name_en" label={tr("uniNameEn")} />
        <div>
          <label style={lbl}>{tr("uniStatusLabel")}</label>
          <select className="inp" value={f.status} onChange={(e) => set("status", e.target.value)} style={{ width: "100%" }}>
            {STATUSES.map((s) => <option key={s} value={s}>{tr(STK[s])}</option>)}
          </select>
        </div>
        <Field k="college" label={tr("uniCollege")} />
        <Field k="department" label={tr("uniDepartment")} />
        <Field k="country" label={tr("uniCountry")} />
        <Field k="responsible_name" label={tr("uniRespName")} />
        <Field k="responsible_phone" label={tr("uniRespPhone")} type="tel" />
        <Field k="responsible_email" label={tr("uniRespEmail")} type="email" />
        <Field k="university_email" label={tr("uniEmail")} type="email" />
        <Field k="wa_number" label={tr("uniWa")} type="tel" />
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>{tr("uniNotes")}</label>
          <textarea className="inp" value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ width: "100%", resize: "vertical" }} />
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
          <button onClick={save} disabled={busy} className="btn" style={{ minWidth: 140, justifyContent: "center" }}>{busy ? "..." : tr("uniAddBtn")}</button>
          <Link href="/universities" className="btn ghost">{tr("cancel")}</Link>
        </div>
      </div>
    </div>
  );
}
