"use client";
import { confirmDialog } from "@/lib/confirm";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type ST = { id: string; slug: string; name: string; activation_label: string; sort: number };

const IcEdit = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const IcDel = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;
const IcOk = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M20 6L9 17l-5-5" /></svg>;
const IcX = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>;

export default function ServiceTypesManager({ initial, diplomaLabel = "" }: { initial: ST[]; diplomaLabel?: string }) {
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
  // تاب الدبلومات (افتراضي) — اسمه مخزّن في app_settings
  const [dipLbl, setDipLbl] = useState(diplomaLabel || "");
  const [dipEdit, setDipEdit] = useState(false);
  const [dipVal, setDipVal] = useState(diplomaLabel || "");
  async function saveDip() {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "diploma_tab_label", value: { label: dipVal.trim() } }, { onConflict: "key" });
    setBusy(false);
    if (error) { toast(tr("saveFailed") + error.message); return; }
    setDipLbl(dipVal.trim()); setDipEdit(false); toast(tr("saved2")); router.refresh();
  }

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
    const { error } = await supabase.from("service_types").update({ name: eName.trim(), activation_label: eLabel.trim() }).eq("id", it.id);
    setBusy(false);
    if (error) { toast(tr("updateFailedShort")); return; }
    setItems((a) => a.map((x) => x.id === it.id ? { ...x, name: eName.trim(), activation_label: eLabel.trim() } : x));
    setEditId(null); toast(tr("edited")); router.refresh();
  }
  async function del(it: ST) {
    if (!await confirmDialog(tr("deleteServiceTypeQ").replace("{n}", it.name), true)) return;
    setBusy(true);
    const { error } = await supabase.from("service_types").delete().eq("id", it.id);
    setBusy(false);
    if (error) { toast(tr("deleteFailed")); return; }
    setItems((a) => a.filter((x) => x.id !== it.id));
    toast(tr("deleted")); router.refresh();
  }

  return (
    <div className="setcard settings-anim">
      <div className="setcard-h">
        <div><h3>{tr("manageServiceTypes")}</h3><p>{tr("manageServiceTypesHint")}</p></div>
        <span className="setcount">{items.length}</span>
      </div>

      <div className="setscroll">
        {items.length === 0 && <span className="setempty">{tr("noItemsYet")}</span>}
        {items.length > 0 && (
          <table className="settbl">
            <thead><tr><th>{tr("name")}</th><th>{tr("activationLabel")}</th><th style={{ width: 84 }}></th></tr></thead>
            <tbody>
              <tr>
                {dipEdit ? (<>
                  <td><input className="ei" value={dipVal} onChange={(e) => setDipVal(e.target.value)} placeholder={tr("tabDiplomaBatches")} /></td>
                  <td><span className="sub" style={{ color: "var(--muted)", fontSize: 11 }}>🎓 {tr("defaultTabNote")}</span></td>
                  <td className="act-c"><div className="rowacts">
                    <button className="rowbtn ok" onClick={saveDip} title={tr("save")} disabled={busy}><IcOk /></button>
                    <button className="rowbtn cancel" onClick={() => { setDipVal(dipLbl); setDipEdit(false); }} title={tr("cancel")}><IcX /></button>
                  </div></td>
                </>) : (<>
                  <td className="nm-c"><span className="nm">🎓 {dipLbl || tr("tabDiplomaBatches")}</span></td>
                  <td className="nm-c"><span className="sub" style={{ color: "var(--muted)", fontSize: 11 }}>{tr("defaultTabNote")}</span></td>
                  <td className="act-c"><div className="rowacts">
                    <button className="rowbtn edit" onClick={() => { setDipVal(dipLbl || ""); setDipEdit(true); }} title={tr("edit")}><IcEdit /></button>
                  </div></td>
                </>)}
              </tr>
              {items.map((it) => (
                <tr key={it.id}>
                  {editId === it.id ? (<>
                    <td><input className="ei" value={eName} onChange={(e) => setEName(e.target.value)} placeholder={tr("serviceTypeName")} /></td>
                    <td><input className="ei" value={eLabel} onChange={(e) => setELabel(e.target.value)} placeholder={tr("activationLabel")} /></td>
                    <td className="act-c"><div className="rowacts">
                      <button className="rowbtn ok" onClick={() => saveEdit(it)} title={tr("save")}><IcOk /></button>
                      <button className="rowbtn cancel" onClick={cancelEdit} title={tr("cancel")}><IcX /></button>
                    </div></td>
                  </>) : (<>
                    <td className="nm-c"><span className="nm">{it.name}</span></td>
                    <td className="nm-c"><span className="sub" style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"block"}}>{it.activation_label}</span></td>
                    <td className="act-c"><div className="rowacts">
                      <button className="rowbtn edit" onClick={() => startEdit(it)} title={tr("edit")}><IcEdit /></button>
                      <button className="rowbtn del" onClick={() => del(it)} title={tr("delete")}><IcDel /></button>
                    </div></td>
                  </>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="setadd">
        <input className="inp" value={nName} placeholder={tr("serviceTypeNamePh")} onChange={(e) => setNName(e.target.value)} />
        <input className="inp" value={nLabel} placeholder={tr("activationLabelPh")} onChange={(e) => setNLabel(e.target.value)} />
        <button className="setaddbtn" onClick={add} disabled={busy} title={tr("add")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
    </div>
  );
}
