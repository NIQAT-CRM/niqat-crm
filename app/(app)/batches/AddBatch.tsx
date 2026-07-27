"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

function isServiceKind(k: string) { return k !== "diploma"; }

export default function AddBatch({ diplomas = [], kind = "diploma" }: { diplomas?: { id: string; name: string; prefix?: string }[]; kind?: string }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", diploma_id: "", start_date: "", end_date: "", capacity: "", notes: "", price_egp: "", price_usd: "" });
  const [suffix, setSuffix] = useState("");
  const [busy, setBusy] = useState(false);
  const selPrefix = (diplomas.find((d) => d.id === f.diploma_id)?.prefix || "").trim();
  const usePrefix = !isServiceKind(kind) && !!selPrefix;
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const isService = kind !== "diploma";

  async function save() {
    let finalCode = f.code.trim();
    if (usePrefix) {
      const sfx = suffix.trim().toUpperCase();
      if (!sfx) { toast(tr("enterBatchNo")); return; }
      if (!/^[A-Z0-9]+$/.test(sfx)) { toast(tr("suffixLettersDigits")); return; }
      finalCode = selPrefix + sfx;
    }
    if (!finalCode) { toast(tr("enterBatchNo")); return; }
    const pe = Number(f.price_egp), pu = Number(f.price_usd);
    if (!(pe > 0) || !(pu > 0)) { toast(tr("enterBothPrices")); return; }
    setBusy(true);
    const base: any = {
      code: finalCode, start_date: isService ? null : (f.start_date || null),
      capacity: !isService && f.capacity ? Number(f.capacity) : null, notes: f.notes.trim(), status: "open", kind,
    };
    const priceFields = { price_egp: pe, price_usd: pu, price: pe, currency: "EGP" };
    const full = { ...base, ...priceFields, end_date: isService ? null : (f.end_date || null), diploma_id: isService ? null : (f.diploma_id || null) };
    let error = (await supabase.from("batches").insert(full)).error;
    if (error && /end_date|diploma_id|price|currency|kind/.test((error as any).message || "")) {
      error = (await supabase.from("batches").insert(base)).error;
    }
    setBusy(false);
    if (error) { toast((error as any).code === "23505" ? tr("codeExists") : tr("saveFailed")); return; }
    setF({ code: "", diploma_id: "", start_date: "", end_date: "", capacity: "", notes: "", price_egp: "", price_usd: "" }); setSuffix(""); setOpen(false);
    toast(tr("batchAdded")); router.refresh();
  }

  if (!open) return (
    <button className="btn" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
      {isService ? tr("addService") : tr("addBatch")}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.45)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setOpen(false)}>
      <div className="card" style={{ padding: 20, width: "min(440px,100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="sec-t" style={{ marginTop: 0 }}>{isService ? tr("newService") : tr("newBatch")}</div>
        {!isService && (
          <div className="fld"><label>{tr("theDiploma")}</label>
            <select className="inp" value={f.diploma_id} onChange={(e) => set("diploma_id", e.target.value)}>
              <option value="">{tr("selectDiplomaDash")}</option>
              {diplomas.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
        )}
        <div className="frow">
          {usePrefix ? (
            <div className="fld"><label>{tr("batchNo")}</label>
              <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }} dir="ltr">
                <span style={{ padding: "0 10px", display: "flex", alignItems: "center", background: "var(--muted-soft)", color: "var(--muted-d)", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{selPrefix}</span>
                <input style={{ flex: 1, border: "none", background: "transparent", color: "var(--ink)", padding: "0 10px", fontSize: 13, outline: "none", minWidth: 60 }}
                  placeholder="0023" value={suffix}
                  onChange={(e) => setSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>{tr("finalCode")}: <b dir="ltr">{selPrefix}{suffix || "…"}</b></span>
            </div>
          ) : (
            <div className="fld"><label>{isService ? tr("serviceName") : tr("batchNo")}</label><input className="inp" dir={isService ? "rtl" : "ltr"} placeholder={isService ? tr("serviceNamePh") : "B22"} value={f.code} onChange={(e) => set("code", e.target.value)} /></div>
          )}
          {!isService && <div className="fld"><label>{tr("capacity")}</label><input className="inp num" dir="ltr" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>}
        </div>
        {!isService && (
          <div className="frow">
            <div className="fld"><label>{tr("startDate")}</label><input className="inp num" type="date" dir="ltr" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
            <div className="fld"><label>{tr("endDate")}</label><input className="inp num" type="date" dir="ltr" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
          </div>
        )}
        <div className="frow">
          <div className="fld"><label>{tr("batchPrice")} — {tr("egpShort")}</label>
            <input className="inp num" dir="ltr" inputMode="numeric" placeholder="0" value={f.price_egp} onChange={(e) => set("price_egp", e.target.value)} /></div>
          <div className="fld"><label>{tr("batchPrice")} — $</label>
            <input className="inp num" dir="ltr" inputMode="numeric" placeholder="0" value={f.price_usd} onChange={(e) => set("price_usd", e.target.value)} /></div>
        </div>
        <div className="fld"><label>{tr("notes")}</label><input className="inp" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={save} disabled={busy}>{busy ? "..." : tr("save")}</button>
          <button className="btn ghost" onClick={() => setOpen(false)}>{tr("cancel")}</button>
        </div>
      </div>
    </div>
  );
}
