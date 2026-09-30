"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";

type Row = { diploma_id: string | null; diploma_name: string | null; batch_id: string | null; batch_code: string | null; ym: string; egp: number; usd: number; cnt: number };

const nf = new Intl.NumberFormat("en-US");
const fmt = (n: number) => nf.format(Math.round(Number(n) || 0));

export default function BatchSalesCard() {
  const tr = useT();
  const lang = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [dip, setDip] = useState("");
  const [batch, setBatch] = useState("");
  const [ym, setYm] = useState("");

  useEffect(() => {
    if (!open || rows !== null) return;
    (async () => {
      try { const r: any = await createClient().rpc("sales_by_batch_month"); setRows(r.error ? [] : ((r.data as Row[]) || [])); }
      catch { setRows([]); }
    })();
  }, [open]);

  const monthLabel = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(y, mo - 1, 15)); };
  const bkey = (r: Row) => r.batch_id || "none";
  const bcode = (r: Row) => r.batch_code || tr("noBatch");

  // قوائم الاختيار المتسلسلة
  const diplomas = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of (rows || [])) m.set(r.diploma_id || "none", r.diploma_name || tr("noDiploma"));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const batches = useMemo(() => {
    if (!dip) return [];
    const m = new Map<string, string>();
    for (const r of (rows || [])) if ((r.diploma_id || "none") === dip) m.set(bkey(r), bcode(r));
    return Array.from(m.entries()).sort((a, b) => (a[0] === "none" ? 1 : 0) - (b[0] === "none" ? 1 : 0) || a[1].localeCompare(b[1]));
  }, [rows, dip]);

  const months = useMemo(() => {
    if (!dip || !batch) return [];
    const s = new Set<string>();
    for (const r of (rows || [])) if ((r.diploma_id || "none") === dip && bkey(r) === batch) s.add(r.ym);
    return Array.from(s).sort().reverse();
  }, [rows, dip, batch]);

  // النتيجة المختارة
  const result = useMemo(() => {
    if (!dip || !batch) return null;
    const matched = (rows || []).filter((r) => (r.diploma_id || "none") === dip && bkey(r) === batch && (!ym || r.ym === ym));
    const egp = matched.reduce((s, r) => s + (Number(r.egp) || 0), 0);
    const usd = matched.reduce((s, r) => s + (Number(r.usd) || 0), 0);
    const cnt = matched.reduce((s, r) => s + (Number(r.cnt) || 0), 0);
    return { egp, usd, cnt, months: matched.slice().sort((a, b) => b.ym.localeCompare(a.ym)) };
  }, [rows, dip, batch, ym]);

  const selStyle: React.CSSProperties = { height: 40, width: "100%", borderRadius: 10 };

  return (
    <div className="bs-card">
      <style>{css}</style>
      <div className="bs-head" onClick={() => setOpen((o) => !o)}>
        <div><h3>🎓 {tr("batchSalesTitle")}</h3><p>{tr("batchSalesHint")}</p></div>
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--muted)" strokeWidth={2.4} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
      </div>

      {open && (
        rows === null ? <div className="bs-empty">…</div> : (
          <div style={{ marginTop: 14 }}>
            <div className="bs-selrow">
              <div className="bs-fld">
                <label>{tr("diplomaWord")}</label>
                <select className="inp" style={selStyle} value={dip} onChange={(e) => { setDip(e.target.value); setBatch(""); setYm(""); }}>
                  <option value="">— {tr("chooseDiploma")} —</option>
                  {diplomas.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
              <div className="bs-fld">
                <label>{tr("batchWord")}</label>
                <select className="inp" style={selStyle} value={batch} onChange={(e) => { setBatch(e.target.value); setYm(""); }} disabled={!dip}>
                  <option value="">— {tr("chooseBatch")} —</option>
                  {batches.map(([id, code]) => <option key={id} value={id}>{code}</option>)}
                </select>
              </div>
              <div className="bs-fld">
                <label>{tr("monthWord")}</label>
                <select className="inp" style={selStyle} value={ym} onChange={(e) => setYm(e.target.value)} disabled={!batch}>
                  <option value="">{tr("allMonthsWord")}</option>
                  {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
              </div>
            </div>

            {!dip || !batch ? (
              <div className="bs-hint">{tr("batchSalesPick")}</div>
            ) : result && (
              <div className="bs-result">
                <div className="bs-rtop">
                  <div className="bs-rlbl">{ym ? monthLabel(ym) : tr("allMonthsWord")} · {result.cnt} {tr("receiptsWord")}</div>
                  <div className="bs-rval n">{fmt(result.egp)}<i>{tr("egp")}</i>{result.usd > 0 ? <b>${fmt(result.usd)}</b> : null}</div>
                </div>
                {!ym && result.months.length > 0 && (
                  <div className="bs-mlist">
                    {result.months.map((m) => (
                      <div key={m.ym} className="bs-mrow">
                        <span>{monthLabel(m.ym)}</span>
                        <span className="n">{fmt(m.egp)}<i>{tr("egp")}</i>{Number(m.usd) > 0 ? <b>${fmt(m.usd)}</b> : null}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

const css = `
.bs-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--sh);padding:16px 18px;width:100%}
.bs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;cursor:pointer}
.bs-head h3{font-size:15px;font-weight:800;color:var(--ink);margin:0}
.bs-head p{font-size:11.5px;color:var(--muted);margin:3px 0 0;font-weight:600}
.bs-empty{font-size:13px;color:var(--muted);padding:16px 2px;text-align:center}
.bs-selrow{display:grid;grid-template-columns:2fr 1.3fr 1.3fr;gap:10px}
.bs-fld label{display:block;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:5px}
.bs-hint{margin-top:16px;padding:20px;text-align:center;font-size:13px;color:var(--muted);background:var(--bg);border-radius:12px}
.bs-result{margin-top:16px;border:1px solid var(--line);border-radius:13px;overflow:hidden}
.bs-rtop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:var(--green-soft)}
.bs-rlbl{font-size:12.5px;font-weight:700;color:var(--ink)}
.bs-rval{font-family:var(--fd);font-weight:800;font-size:19px;color:var(--green);direction:ltr;display:inline-flex;align-items:baseline;gap:4px}
.bs-rval i{font-style:normal;font-size:11px;color:var(--muted);font-family:var(--fa);margin-inline-start:2px}
.bs-rval b{font-family:var(--fd);font-size:12px;background:var(--blue-soft);color:var(--blue);padding:2px 8px;border-radius:12px;margin-inline-start:4px}
.bs-mlist{display:flex;flex-direction:column}
.bs-mrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 16px;border-top:1px solid var(--line)}
.bs-mrow>span:first-child{font-size:12.5px;font-weight:600;color:var(--text)}
.bs-mrow .n{font-family:var(--fd);font-weight:800;font-size:13px;color:var(--ink);direction:ltr;display:inline-flex;align-items:baseline;gap:3px}
.bs-mrow .n i{font-style:normal;font-size:9px;color:var(--muted);font-family:var(--fa);margin-inline-start:2px}
.bs-mrow .n b{font-family:var(--fd);font-size:10px;background:var(--blue-soft);color:var(--blue);padding:1px 6px;border-radius:10px;margin-inline-start:3px}
@media(max-width:640px){.bs-selrow{grid-template-columns:1fr}}
`;
