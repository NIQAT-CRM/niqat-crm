"use client";
import { confirmDialog } from "@/lib/confirm";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT, useLang } from "@/lib/i18n/client";

type Row = {
  id: string; code: string; combo: string; category: string; action_type: string;
  target: string; label_ar: string; label_en: string; perm: string; context: string; enabled: boolean; sort: number;
};

const IcDel = () => <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;

export default function ShortcutsManager({ initial }: { initial: Row[] }) {
  const tr = useT();
  const lang = useLang();
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>(initial || []);
  const [busy, setBusy] = useState(false);
  const [nLabel, setNLabel] = useState("");
  const [nCombo, setNCombo] = useState("");
  const [nTarget, setNTarget] = useState("");

  const label = (r: Row) => (lang === "ar" ? r.label_ar : (r.label_en || r.label_ar));
  const catName: Record<string, string> = { navigation: tr("scNav"), actions: tr("scActions"), customer: tr("scCustomer") };

  async function saveCombo(r: Row, combo: string) {
    const v = combo.trim().toLowerCase();
    if (!v || v === r.combo) return;
    setRows((s) => s.map((x) => (x.id === r.id ? { ...x, combo: v } : x)));
    const { error } = await supabase.from("keyboard_shortcuts").update({ combo: v }).eq("id", r.id);
    if (error) toast(tr("updateFailedShort")); else toast(tr("saved2"));
  }
  async function toggle(r: Row) {
    const nv = !r.enabled;
    setRows((s) => s.map((x) => (x.id === r.id ? { ...x, enabled: nv } : x)));
    const { error } = await supabase.from("keyboard_shortcuts").update({ enabled: nv }).eq("id", r.id);
    if (error) { setRows((s) => s.map((x) => (x.id === r.id ? { ...x, enabled: !nv } : x))); toast(tr("updateFailedShort")); }
  }
  async function del(r: Row) {
    if (!await confirmDialog(`${tr("deleteQ")} «${label(r)}»?`, true)) return;
    setRows((s) => s.filter((x) => x.id !== r.id));
    const { error } = await supabase.from("keyboard_shortcuts").delete().eq("id", r.id);
    if (error) { toast(tr("deleteFailed")); router.refresh(); } else toast(tr("deletedM"));
  }
  async function add() {
    const lab = nLabel.trim(), combo = nCombo.trim().toLowerCase(), target = nTarget.trim();
    if (!lab || !combo || !target) { toast(tr("scAddHint")); return; }
    setBusy(true);
    const code = "custom_" + Date.now().toString(36);
    const sort = (rows.reduce((m, x) => Math.max(m, x.sort), 0) || 0) + 1;
    const payload = { code, combo, category: "navigation", action_type: "navigate", target, label_ar: lab, label_en: lab, perm: "", context: "", enabled: true, sort };
    const { data, error } = await supabase.from("keyboard_shortcuts").insert(payload).select("*").maybeSingle();
    setBusy(false);
    if (error || !data) { toast(tr("addFailedShort")); return; }
    setRows((s) => [...s, data as Row]);
    setNLabel(""); setNCombo(""); setNTarget(""); toast(tr("added"));
  }

  const grouped = ["navigation", "actions", "customer"].map((c) => ({ c, items: rows.filter((r) => r.category === c) })).filter((g) => g.items.length);

  return (
    <div className="intcard settings-anim" style={{ gridColumn: "1 / -1" }}>
      <div className="intcard-h">
        <div><h3>⌨️ {tr("scHelpTitle")}</h3><p>{tr("scManageHint")}</p></div>
      </div>

      {grouped.map(({ c, items }) => (
        <div key={c} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>{catName[c] || c}</div>
          {items.map((r) => (
            <div key={r.id} className="setrow" style={{ opacity: r.enabled ? 1 : 0.55 }}>
              <span className="nm" style={{ flex: "1 1 40%" }}>{label(r)}{r.context === "customer_drawer" ? ` · ${tr("scInDrawer")}` : ""}</span>
              <input className="setpfx" defaultValue={r.combo} dir="ltr" style={{ maxWidth: 120 }}
                onBlur={(e) => saveCombo(r, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              <div className="rowacts">
                <div className={"sw" + (r.enabled ? " on" : "")} onClick={() => toggle(r)} title={r.enabled ? tr("enabled") : tr("disabled")} />
                <button className="rowbtn del" onClick={() => del(r)} title={tr("delete")}><IcDel /></button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="setadd">
        <input className="inp" style={{ flex: "1 1 140px" }} value={nLabel} placeholder={tr("scNewLabel")} onChange={(e) => setNLabel(e.target.value)} />
        <input className="inp" style={{ flex: "0 0 90px" }} dir="ltr" value={nCombo} placeholder="g x" onChange={(e) => setNCombo(e.target.value)} />
        <input className="inp" style={{ flex: "1 1 120px" }} dir="ltr" value={nTarget} placeholder="/customers" onChange={(e) => setNTarget(e.target.value)} />
        <button className="setaddbtn" onClick={add} disabled={busy} title={tr("add")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
    </div>
  );
}
