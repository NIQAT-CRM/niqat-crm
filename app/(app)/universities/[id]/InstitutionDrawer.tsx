"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

type Uni = { id: string; name_ar: string; name_en: string; status: string; college: string; department: string; country: string;
  responsible_name: string; responsible_phone: string; responsible_email: string; university_email: string; wa_number: string; notes: string };
type Proto = { id: string; file_url: string; signed_at: string | null; expires_at: string | null; notes: string; created_at: string };

const STATUSES = ["active", "inactive", "negotiating", "signed"] as const;
const STK: Record<string, string> = { active: "uniStActive", inactive: "uniStInactive", negotiating: "uniStNegotiating", signed: "uniStSigned" };
const STC: Record<string, string> = { active: "#18A957", inactive: "#E0483B", negotiating: "#C7891A", signed: "#2F6BFF" };

export default function InstitutionDrawer({ uni, protocols, canManage }: { uni: Uni; protocols: Proto[]; canManage: boolean }) {
  const tr = useT();
  const lang = useLang();
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"data" | "protocols" | "contacts" | "activity">("data");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Uni>(uni);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const displayName = (lang === "ar" ? (uni.name_ar || uni.name_en) : (uni.name_en || uni.name_ar)) || "—";

  // بروتوكول جديد
  const [pFile, setPFile] = useState<File | null>(null);
  const [pSigned, setPSigned] = useState("");
  const [pExpires, setPExpires] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [pBusy, setPBusy] = useState(false);

  async function saveData() {
    if (!f.name_ar.trim()) return toast(tr("uniNameArRequired"));
    setBusy(true);
    const { error } = await supabase.from("universities").update({
      name_ar: f.name_ar.trim(), name_en: f.name_en.trim(), status: f.status, college: f.college.trim(),
      department: f.department.trim(), country: f.country.trim(), responsible_name: f.responsible_name.trim(),
      responsible_phone: f.responsible_phone.trim(), responsible_email: f.responsible_email.trim(),
      university_email: f.university_email.trim(), wa_number: f.wa_number.trim(), notes: f.notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", uni.id);
    setBusy(false);
    if (error) return toast(tr("uniSaveFailed") + error.message);
    setEditing(false); toast(tr("uniSaved")); router.refresh();
  }

  async function del() {
    if (!await confirmDialog({ message: tr("uniDeleteQ"), confirmLabel: tr("delete"), cancelLabel: tr("cancel"), danger: true })) return;
    setBusy(true);
    const { error } = await supabase.from("universities").delete().eq("id", uni.id);
    if (error) { setBusy(false); return toast(tr("uniSaveFailed") + error.message); }
    toast(tr("uniDeleted")); router.push("/universities");
  }

  async function addProtocol() {
    if (!pFile) return toast(tr("pickFileImage"));
    setPBusy(true);
    const ext = (pFile.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${uni.id}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("protocols").upload(path, pFile, { upsert: false });
    if (up.error) { setPBusy(false); return toast(tr("uploadFailed")); }
    const { error } = await supabase.from("protocols").insert({
      university_id: uni.id, file_url: path, signed_at: pSigned || null, expires_at: pExpires || null, notes: pNotes.trim(),
    });
    setPBusy(false);
    if (error) return toast(tr("uniSaveFailed") + error.message);
    setPFile(null); setPSigned(""); setPExpires(""); setPNotes("");
    toast(tr("uniProtoSaved")); router.refresh();
  }

  async function download(path: string) {
    const { data } = await supabase.storage.from("protocols").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast(tr("uploadFailed"));
  }

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB") : "—");
  const isExpired = (d: string | null) => !!d && new Date(d) < new Date();
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4, display: "block" };

  const Row = ({ label, val }: { label: string; val?: string }) => (
    <div><div style={{ ...lbl }}>{label}</div><div style={{ fontSize: 13.5, color: "var(--ink)" }}>{val || "—"}</div></div>
  );
  const EField = ({ k, label, type = "text" }: { k: string; label: string; type?: string }) => (
    <div><label style={lbl}>{label}</label><input className="inp" type={type} value={(f as any)[k] || ""} onChange={(e) => set(k, e.target.value)} style={{ width: "100%" }} /></div>
  );

  const TabBtn = (id: typeof tab, label: string) => (
    <button onClick={() => setTab(id)} className={tab === id ? "on" : ""} style={{ background: "none", border: "none", borderBottom: tab === id ? "2px solid var(--brand)" : "2px solid transparent", color: tab === id ? "var(--brand-d)" : "var(--muted)", fontWeight: 700, fontSize: 13.5, padding: "8px 12px", cursor: "pointer" }}>{label}</button>
  );

  return (
    <div>
      <div className="page-h">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0 }}>{displayName}</h1>
          <span style={{ fontSize: 11, fontWeight: 800, color: STC[uni.status] || STC.active, background: "var(--surface)", border: `1px solid ${STC[uni.status] || STC.active}`, borderRadius: 20, padding: "2px 10px" }}>{tr(STK[uni.status] || "uniStActive")}</span>
        </div>
        <Link href="/universities" className="btn ghost">{tr("uniBackToList")}</Link>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 16, flexWrap: "wrap" }}>
        {TabBtn("data", tr("uniData"))}
        {TabBtn("protocols", tr("uniProtocols"))}
        {TabBtn("contacts", tr("uniContacts"))}
        {TabBtn("activity", tr("uniActivity"))}
      </div>

      {/* تاب البيانات */}
      {tab === "data" && (
        <div className="card" style={{ padding: 20, maxWidth: 760 }}>
          {!editing ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                <Row label={tr("uniNameAr")} val={uni.name_ar} />
                <Row label={tr("uniNameEn")} val={uni.name_en} />
                <Row label={tr("uniStatusLabel")} val={tr(STK[uni.status] || "uniStActive")} />
                <Row label={tr("uniCollege")} val={uni.college} />
                <Row label={tr("uniDepartment")} val={uni.department} />
                <Row label={tr("uniCountry")} val={uni.country} />
                <Row label={tr("uniRespName")} val={uni.responsible_name} />
                <Row label={tr("uniRespPhone")} val={uni.responsible_phone} />
                <Row label={tr("uniRespEmail")} val={uni.responsible_email} />
                <Row label={tr("uniEmail")} val={uni.university_email} />
                <Row label={tr("uniWa")} val={uni.wa_number} />
                <div style={{ gridColumn: "1 / -1" }}><Row label={tr("uniNotes")} val={uni.notes} /></div>
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 8, marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <button onClick={() => { setF(uni); setEditing(true); }} className="btn">{tr("edit")}</button>
                  <button onClick={del} disabled={busy} className="btn ghost" style={{ color: "#E0483B", borderColor: "#E0483B" }}>{tr("delete")}</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                <div><label style={lbl}>{tr("uniNameAr")} *</label><input className="inp" value={f.name_ar} onChange={(e) => set("name_ar", e.target.value)} style={{ width: "100%" }} /></div>
                <EField k="name_en" label={tr("uniNameEn")} />
                <div><label style={lbl}>{tr("uniStatusLabel")}</label><select className="inp" value={f.status} onChange={(e) => set("status", e.target.value)} style={{ width: "100%" }}>{STATUSES.map((s) => <option key={s} value={s}>{tr(STK[s])}</option>)}</select></div>
                <EField k="college" label={tr("uniCollege")} />
                <EField k="department" label={tr("uniDepartment")} />
                <EField k="country" label={tr("uniCountry")} />
                <EField k="responsible_name" label={tr("uniRespName")} />
                <EField k="responsible_phone" label={tr("uniRespPhone")} type="tel" />
                <EField k="responsible_email" label={tr("uniRespEmail")} type="email" />
                <EField k="university_email" label={tr("uniEmail")} type="email" />
                <EField k="wa_number" label={tr("uniWa")} type="tel" />
                <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>{tr("uniNotes")}</label><textarea className="inp" value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={3} style={{ width: "100%", resize: "vertical" }} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button onClick={saveData} disabled={busy} className="btn">{busy ? "..." : tr("saveChanges")}</button>
                <button onClick={() => setEditing(false)} className="btn ghost">{tr("cancel")}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* تاب البروتوكولات */}
      {tab === "protocols" && (
        <div style={{ maxWidth: 760 }}>
          {canManage && (
            <div className="card" style={{ padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, alignItems: "end" }}>
              <div style={{ gridColumn: "1 / -1", fontWeight: 800, color: "var(--ink)", fontSize: 13.5 }}>+ {tr("uniAddProtocol")}</div>
              <div><label style={lbl}>{tr("uniProtoFile")}</label><input type="file" onChange={(e) => setPFile(e.target.files?.[0] || null)} style={{ fontSize: 12 }} /></div>
              <div><label style={lbl}>{tr("uniSignedAt")}</label><input className="inp" type="date" value={pSigned} onChange={(e) => setPSigned(e.target.value)} style={{ width: "100%" }} /></div>
              <div><label style={lbl}>{tr("uniExpiresAt")}</label><input className="inp" type="date" value={pExpires} onChange={(e) => setPExpires(e.target.value)} style={{ width: "100%" }} /></div>
              <div><label style={lbl}>{tr("uniNotes")}</label><input className="inp" value={pNotes} onChange={(e) => setPNotes(e.target.value)} style={{ width: "100%" }} /></div>
              <button onClick={addProtocol} disabled={pBusy} className="btn" style={{ justifyContent: "center" }}>{pBusy ? "..." : tr("uniAddProtocol")}</button>
            </div>
          )}
          {protocols.length === 0 ? (
            <div className="empty"><b>{tr("uniNoProtocols")}</b></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {protocols.map((p) => {
                const expired = isExpired(p.expires_at);
                return (
                  <div key={p.id} className="card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--ink)" }}>{tr("uniSignedAt")}: <b>{fmtDate(p.signed_at)}</b> · {tr("uniExpiresAt")}: <b>{fmtDate(p.expires_at)}</b></div>
                      {p.notes && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.notes}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: expired ? "#E0483B" : "#18A957", background: expired ? "rgba(224,72,59,.12)" : "rgba(24,169,87,.12)", borderRadius: 20, padding: "2px 10px" }}>{expired ? tr("uniProtoExpired") : tr("uniProtoValid")}</span>
                      <button onClick={() => download(p.file_url)} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}>{tr("uniDownload")}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(tab === "contacts" || tab === "activity") && (
        <div className="empty"><b>{tr("underPrep")}</b></div>
      )}
    </div>
  );
}
