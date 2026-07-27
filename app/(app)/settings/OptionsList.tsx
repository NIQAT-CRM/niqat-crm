"use client";
import { confirmDialog } from "@/lib/confirm";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Item = { id: string; label: string; extra?: string };

const IcEdit = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const IcDel = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;
const IcOk = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M20 6L9 17l-5-5" /></svg>;
const IcX = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 6l12 12M18 6L6 18" /></svg>;

export default function OptionsList({
  title, hint, table, labelCol, initial, extraCol, extraPlaceholder,
}: {
  title: string; hint: string; table: string; labelCol: string; initial: Item[];
  extraCol?: string; extraPlaceholder?: string;
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>(initial);
  const [val, setVal] = useState("");
  const [extraVal, setExtraVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  async function saveExtra(it: Item, value: string) {
    if (!extraCol || value === (it.extra || "")) return;
    setItems((s) => s.map((x) => (x.id === it.id ? { ...x, extra: value } : x)));
    const { error } = await (supabase.from(table) as any).update({ [extraCol]: value }).eq("id", it.id);
    if (error) toast(tr("updateFailedShort")); else toast(tr("saved2"));
  }
  async function add() {
    const v = val.trim();
    if (!v) return;
    if (items.some((i) => i.label === v)) { toast(tr("alreadyExists")); return; }
    setBusy(true);
    const payload: any = { [labelCol]: v };
    if (extraCol) payload[extraCol] = extraVal.trim();
    const { data, error } = await (supabase.from(table) as any).insert(payload).select("id").single();
    setBusy(false);
    if (error) { toast(tr("addFailedShort")); return; }
    setItems((s) => [...s, { id: data!.id, label: v, extra: extraCol ? extraVal.trim() : undefined }]);
    setVal(""); setExtraVal(""); toast(tr("added"));
  }
  function startEdit(it: Item) { setEditId(it.id); setEditVal(it.label); }
  function cancelEdit() { setEditId(null); setEditVal(""); }
  async function saveEdit(it: Item) {
    const v = editVal.trim();
    if (!v) return;
    if (v === it.label) { cancelEdit(); return; }
    if (items.some((i) => i.id !== it.id && i.label === v)) { toast(tr("alreadyExists")); return; }
    const prev = items;
    setItems((s) => s.map((x) => (x.id === it.id ? { ...x, label: v } : x))); cancelEdit();
    const { error } = await (supabase.from(table) as any).update({ [labelCol]: v }).eq("id", it.id);
    if (error) { setItems(prev); toast(tr("updateFailedShort")); return; }
    toast(tr("updated"));
  }
  async function del(it: Item) {
    if (!await confirmDialog(`${tr("deleteQ")} «${it.label}»?`, true)) return;
    setItems((s) => s.filter((x) => x.id !== it.id));
    const { error } = await (supabase.from(table) as any).delete().eq("id", it.id);
    if (error) { toast(tr("deleteFailed")); router.refresh(); return; }
    toast(tr("deletedM"));
  }

  return (
    <div className="setcard settings-anim">
      <div className="setcard-h">
        <div><h3>{title}</h3><p>{hint}</p></div>
        <span className="setcount">{items.length}</span>
      </div>

      <div className="setscroll">
        {items.length === 0 && <span className="setempty">{tr("noItemsYet")}</span>}

        {extraCol ? (
          items.length > 0 && (
            <table className="settbl">
              <thead><tr><th>{tr("name")}</th><th style={{ width: 170 }}>{tr("batchPrefixCol")}</th><th style={{ width: 84 }}></th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{editId === it.id
                      ? <input className="ei" autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it); if (e.key === "Escape") cancelEdit(); }} />
                      : <span className="nm">{it.label}</span>}</td>
                    <td><input className="setpfx" defaultValue={it.extra || ""} placeholder={tr("prefixShort")} dir="ltr" onBlur={(e) => saveExtra(it, e.target.value.trim())} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></td>
                    <td><div className="rowacts">
                      {editId === it.id ? (<>
                        <button className="rowbtn ok" onClick={() => saveEdit(it)} title={tr("save")}><IcOk /></button>
                        <button className="rowbtn cancel" onClick={cancelEdit} title={tr("cancel")}><IcX /></button>
                      </>) : (<>
                        <button className="rowbtn edit" onClick={() => startEdit(it)} title={tr("edit")}><IcEdit /></button>
                        <button className="rowbtn del" onClick={() => del(it)} title={tr("delete")}><IcDel /></button>
                      </>)}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          items.map((it) => (
            <div key={it.id} className="setrow">
              {editId === it.id ? (
                <input className="ei" autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(it); if (e.key === "Escape") cancelEdit(); }} />
              ) : <span className="nm">{it.label}</span>}
              <div className="rowacts">
                {editId === it.id ? (<>
                  <button className="rowbtn ok" onClick={() => saveEdit(it)} title={tr("save")}><IcOk /></button>
                  <button className="rowbtn cancel" onClick={cancelEdit} title={tr("cancel")}><IcX /></button>
                </>) : (<>
                  <button className="rowbtn edit" onClick={() => startEdit(it)} title={tr("edit")}><IcEdit /></button>
                  <button className="rowbtn del" onClick={() => del(it)} title={tr("delete")}><IcDel /></button>
                </>)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="setadd">
        <input className="inp" value={val} placeholder={tr("addNewItem")} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        {extraCol && <input className="inp" style={{ maxWidth: 150 }} value={extraVal} placeholder={tr("prefixShort")} dir="ltr" onChange={(e) => setExtraVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />}
        <button className="setaddbtn" onClick={add} disabled={busy} title={tr("add")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
    </div>
  );
}
