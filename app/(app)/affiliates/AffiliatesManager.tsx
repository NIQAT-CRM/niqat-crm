"use client";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Aff = { name: string; code: string; discount: number; rate?: number; phone?: string; _uid: number; _orig: string };

let UID = 1;

export default function AffiliatesManager({ initial }: { initial: { name: string; code: string; discount: number; rate?: number; phone?: string }[] }) {
  const tr = useT();
  const supabase = createClient();
  const router = useRouter();
  const [list, setList] = useState<Aff[]>((initial || []).map((a) => ({ ...a, _uid: UID++, _orig: a.code })));
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [disc, setDisc] = useState("");
  const [rate, setRate] = useState("");
  const [ph, setPh] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // يحفظ الـ JSON + يهاجر العملاء لأي كود اتغيّر (القديم → الجديد)
  async function persist(next: Aff[]) {
    // تحقّق: مفيش كود فاضي أو مكرّر
    const codes = next.map((a) => a.code.trim().toUpperCase());
    if (codes.some((c) => !c)) { toast(tr("enterCode")); return false; }
    if (new Set(codes).size !== codes.length) { toast(tr("codeAlreadyExists")); return false; }

    setBusy(true); setSaved(false);
    // 1) احفظ الإعداد (من غير الحقول الداخلية)
    const clean = next.map((a) => ({ name: a.name, code: a.code.trim().toUpperCase(), discount: Number(a.discount) || 0, rate: Number(a.rate) || 0, phone: (a.phone || "").trim() }));
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "affiliates", value: clean, updated_at: new Date().toISOString() });
    if (error) { setBusy(false); toast(tr("saveFailedColon") + error.message); return false; }

    // 2) هاجر العملاء لأي كود اتغيّر
    let migrated = 0;
    for (const a of next) {
      const newCode = a.code.trim().toUpperCase();
      if (a._orig && a._orig !== newCode) {
        const { error: mErr } = await supabase.from("customers")
          .update({ affiliate_code: newCode }).eq("affiliate_code", a._orig);
        if (!mErr) { migrated++; a._orig = newCode; }
      }
    }
    setBusy(false); setSaved(true);
    if (migrated > 0) toast(tr("codesMigrated").replace("{n}", String(migrated)));
    setList(next.map((a) => ({ ...a, _orig: a.code.trim().toUpperCase() })));
    router.refresh();
    return true;
  }

  async function add() {
    const c = code.trim().toUpperCase();
    if (!c) return toast(tr("enterCode"));
    if (list.some((a) => a.code.toUpperCase() === c)) return toast(tr("codeAlreadyExists"));
    const next = [...list, { name: name.trim() || "—", code: c, discount: Number(disc) || 0, rate: Number(rate) || 0, phone: ph.trim(), _uid: UID++, _orig: c }];
    setName(""); setCode(""); setDisc(""); setRate(""); setPh("");
    await persist(next);
  }

  const upd = (uid: number, patch: Partial<Aff>) => setList((l) => l.map((a) => (a._uid === uid ? { ...a, ...patch } : a)));

  async function remove(uid: number) {
    if (!await confirmDialog(tr("deleteCodeQ"), true)) return;
    await persist(list.filter((a) => a._uid !== uid));
  }

  const cellInp: React.CSSProperties = { width: "100%", minWidth: 90, padding: "6px 9px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", color: "var(--ink)", fontSize: 13 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="sec-t" style={{ marginTop: 0 }}>{tr("addNewCode")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <input className="inp" style={{ flex: 1, minWidth: 140 }} placeholder={tr("affiliateName")} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="inp" dir="ltr" style={{ width: 140 }} placeholder={tr("uniRespPhone")} value={ph} onChange={(e) => setPh(e.target.value)} />
          <input className="inp" style={{ width: 130 }} placeholder={tr("code")} value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="inp num" style={{ width: 100 }} placeholder={tr("discountPct")} value={disc} onChange={(e) => setDisc(e.target.value)} />
          <input className="inp num" style={{ width: 120 }} placeholder={tr("commissionPct")} value={rate} onChange={(e) => setRate(e.target.value)} />
          <button onClick={add} disabled={busy} className="btn">{tr("add")}</button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 150 }}>{tr("code")}</th>
              <th style={{ minWidth: 160 }}>{tr("name")}</th>
              <th style={{ minWidth: 130 }}>{tr("uniRespPhone")}</th>
              <th>{tr("discountPct")}</th>
              <th>{tr("commissionPct")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>{tr("noCodesYet")}</td></tr>
            )}
            {list.map((a) => (
              <tr key={a._uid}>
                <td><input style={{ ...cellInp, fontWeight: 700, color: "var(--brand)" }} value={a.code} onChange={(e) => upd(a._uid, { code: e.target.value })} /></td>
                <td><input style={cellInp} placeholder={tr("affiliateName")} value={a.name === "—" ? "" : a.name} onChange={(e) => upd(a._uid, { name: e.target.value })} /></td>
                <td><input style={cellInp} dir="ltr" placeholder={tr("uniRespPhone")} value={a.phone || ""} onChange={(e) => upd(a._uid, { phone: e.target.value })} /></td>
                <td><input className="num" style={{ ...cellInp, width: 80 }} value={a.discount} onChange={(e) => upd(a._uid, { discount: Number(e.target.value) || 0 })} /></td>
                <td><input className="num" style={{ ...cellInp, width: 80 }} value={a.rate ?? 0} onChange={(e) => upd(a._uid, { rate: Number(e.target.value) || 0 })} /></td>
                <td style={{ textAlign: "end" }}>
                  <button onClick={() => remove(a._uid)} style={{ color: "var(--red)", fontSize: 12, fontWeight: 700, background: "none" }}>{tr("delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => persist(list)} disabled={busy} className="btn">{tr("saveChanges")}</button>
        {saved && <span style={{ color: "var(--green)", fontSize: 13, fontWeight: 700 }}>{tr("saved2")} ✓</span>}
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{tr("codeEditMigratesHint")}</span>
      </div>
    </div>
  );
}
