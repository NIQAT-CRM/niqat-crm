"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type ST = { id: string; slug: string; name: string; activation_label: string; sort: number };

export default function ServiceTypesManager({ initial }: { initial: ST[] }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<ST[]>(initial || []);
  const [busy, setBusy] = useState(false);
  const [nName, setNName] = useState("");
  const [nLabel, setNLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eLabel, setELabel] = useState("");

  async function add() {
    const name = nName.trim();
    if (!name) { toast(tr("enterServiceTypeName")); return; }
    if (!nLabel.trim()) { toast(tr("enterActivationLabel")); return; }
    setBusy(true);
    const slug = "st_" + Date.now().toString(36);
    const sort = (items.reduce((m, x) => Math.max(m, x.sort), 0) || 0) + 1;
    const { data, error } = await supabase.from("service_types")
      .insert({ slug, name, activation_label: nLabel.trim(), sort }).select("id,slug,name,activation_label,sort").maybeSingle();
    setBusy(false);
    if (error || !data) { toast(tr("addFailedShort")); return; }
    setItems((a) => [...a, data as ST]);
    setNName(""); setNLabel(""); toast(tr("added")); router.refresh();
  }

  function startEdit(it: ST) { setEditId(it.id); setEName(it.name); setELabel(it.activation_label); }
  function cancelEdit() { setEditId(null); }

  async function saveEdit(it: ST) {
    if (!eName.trim() || !eLabel.trim()) { toast(tr("enterActivationLabel")); return; }
    setBusy(true);
    const { error } = await supabase.from("service_types")
      .update({ name: eName.trim(), activation_label: eLabel.trim() }).eq("id", it.id);
    setBusy(false);
    if (error) { toast(tr("updateFailedShort")); return; }
    setItems((a) => a.map((x) => x.id === it.id ? { ...x, name: eName.trim(), activation_label: eLabel.trim() } : x));
    setEditId(null); toast(tr("edited")); router.refresh();
  }

  async function del(it: ST) {
    if (!confirm(tr("deleteServiceTypeQ").replace("{n}", it.name))) return;
    setBusy(true);
    const { error } = await supabase.from("service_types").delete().eq("id", it.id);
    setBusy(false);
    if (error) { toast(tr("deleteFailed")); return; }
    setItems((a) => a.filter((x) => x.id !== it.id));
    toast(tr("deleted")); router.refresh();
  }

  return (
    <div className="card settings-anim" style={{ padding: 18, marginBottom: 18 }}>
      <div className="card-h" style={{ padding: 0, border: "none" }}><h3>{tr("manageServiceTypes")}</h3></div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "2px 0 14px" }}>{tr("manageServiceTypesHint")}</p>

      {/* إضافة نوع جديد */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 14, alignItems: "end" }}>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("serviceTypeName")}</label>
          <input className="inp" value={nName} placeholder={tr("serviceTypeNamePh")} onChange={(e) => setNName(e.target.value)} /></div>
        <div className="fld" style={{ marginBottom: 0 }}><label>{tr("activationLabel")}</label>
          <input className="inp" value={nLabel} placeholder={tr("activationLabelPh")} onChange={(e) => setNLabel(e.target.value)} /></div>
        <button className="btn" onClick={add} disabled={busy} style={{ height: 40 }}>{tr("add")}</button>
      </div>

      {/* القائمة */}
      <div className="optrows" style={{ height: "auto", maxHeight: 320 }}>
        {items.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)", fontStyle: "italic" }}>{tr("noItemsYet")}</span>}
        {items.map((it) => (
          editId === it.id ? (
            <div key={it.id} className="optrow editing" style={{ gap: 8, flexWrap: "wrap" }}>
              <input className="ei" style={{ flex: "1 1 130px" }} value={eName} onChange={(e) => setEName(e.target.value)} placeholder={tr("serviceTypeName")} />
              <input className="ei" style={{ flex: "1 1 130px" }} value={eLabel} onChange={(e) => setELabel(e.target.value)} placeholder={tr("activationLabel")} />
              <div className="acts">
                <button className="ok" onClick={() => saveEdit(it)} title={tr("save")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M20 6L9 17l-5-5" /></svg>
                </button>
                <button className="cn" onClick={cancelEdit} title={tr("cancel")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div key={it.id} className="optrow">
              <span className="lbl">{it.name} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 12 }}>· {tr("activationLabel")}: {it.activation_label}</span></span>
              <div className="acts">
                <button className="ed" onClick={() => startEdit(it)} title={tr("edit")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button className="dl" onClick={() => del(it)} title={tr("delete")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
