"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";

type Row = { ym: string; egp: number; usd: number; cnt: number };
type CloseAll = { ym: string; gross_egp: number; gross_usd: number; refunds_egp: number; refunds_usd: number; net_egp: number; net_usd: number; refunds_count: number; cnt: number };

export default function MonthlySales({ rows, collapsible = false }: { rows: Row[]; collapsible?: boolean }) {
  const tr = useT();
  const lang = useLang();
  const [all, setAll] = useState<CloseAll[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r: any = await createClient().rpc("monthly_close_all");
        if (!r.error && Array.isArray(r.data)) setAll(r.data);
      } catch { /* لا صلاحية مالية؟ */ }
    })();
  }, []);

  const nf = new Intl.NumberFormat("en-US");
  const fmt = (n: number) => nf.format(Math.round(Number(n) || 0));
  const curYm = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15));
  };

  const cur = all?.find((x) => x.ym === curYm) || null;
  const curRow = rows.find((r) => r.ym === curYm);
  const gEgp = cur ? cur.gross_egp : (curRow?.egp || 0);
  const gUsd = cur ? cur.gross_usd : (curRow?.usd || 0);
  const rEgp = cur ? cur.refunds_egp : 0;
  const rUsd = cur ? cur.refunds_usd : 0;
  const nEgp = cur ? cur.net_egp : gEgp;
  const nUsd = cur ? cur.net_usd : gUsd;
  const netPct = gEgp > 0 ? Math.max(4, Math.min(100, Math.round((nEgp / gEgp) * 100))) : 100;

  const detail: CloseAll[] = all && all.length
    ? all
    : rows.map((r) => ({ ym: r.ym, gross_egp: r.egp, gross_usd: r.usd, refunds_egp: 0, refunds_usd: 0, net_egp: r.egp, net_usd: r.usd, refunds_count: 0, cnt: r.cnt }));

  // صف: عنوان + خانتين (جنيه/دولار) بنفس الفونت
  const StatRow = ({ label, egp, usd, kind }: { label: string; egp: number; usd: number; kind: "gross" | "refund" | "net" }) => (
    <div className={"ms-srow " + kind}>
      <span className="ms-slbl">{label}</span>
      <div className="ms-vals">
        <span className={"ms-cell " + kind}><b className="n">{kind === "refund" && egp ? "−" : ""}{fmt(egp)}</b><i>{tr("egp")}</i></span>
        <span className={"ms-cell " + kind}><b className="n">{kind === "refund" && usd ? "−" : ""}{fmt(usd)}</b><i>$</i></span>
      </div>
    </div>
  );

  return (
    <div className="ms-card">
      <style>{css}</style>
      <div className="ms-head">
        <div style={{ minWidth: 0 }}>
          <h3>{tr("monthlySales")}</h3>
          <p>{monthLabel(curYm)}</p>
        </div>
        <span className="ms-livedot">● {tr("thisMonth")}</span>
      </div>

      <div className="ms-summary">
        <div className="ms-colhdr"><span /><div className="ms-vals"><span className="ms-ch">{tr("egp")}</span><span className="ms-ch">USD $</span></div></div>
        <StatRow label={tr("totalCollection")} egp={gEgp} usd={gUsd} kind="gross" />
        <StatRow label={tr("monthRefunds")} egp={rEgp} usd={rUsd} kind="refund" />
        <StatRow label={tr("netCollection")} egp={nEgp} usd={nUsd} kind="net" />
        <div className="ms-bar"><i style={{ width: netPct + "%" }} /></div>
      </div>

      <button className="ms-allbtn" onClick={() => setShowAll(true)}>
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        {tr("allMonthsDetail")}
      </button>

      {showAll && (
        <div className="ms-ov" onClick={() => setShowAll(false)}>
          <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ms-mhead">
              <div><h4>{tr("monthlySales")}</h4><span>{tr("allMonthsDetail")}</span></div>
              <button className="ms-x" onClick={() => setShowAll(false)}>✕</button>
            </div>
            <div className="ms-mbody">
              {detail.length === 0 ? <div className="ms-empty">{tr("noReceiptsYet")}</div> : detail.map((d) => (
                <div key={d.ym} className={"ms-mcard" + (d.ym === curYm ? " cur" : "")}>
                  <div className="ms-mtop">
                    <div className="ms-mname">{monthLabel(d.ym)}{d.ym === curYm && <span className="ms-curdot" />}</div>
                    <div className="ms-mcnt">{fmt(d.cnt)} {tr("receiptsWord")}</div>
                  </div>
                  <table className="ms-mtbl">
                    <thead><tr><th></th><th>{tr("egp")}</th><th>USD $</th></tr></thead>
                    <tbody>
                      <tr><td className="lbl">{tr("totalCollection")}</td><td className="n">{fmt(d.gross_egp)}</td><td className="n">{fmt(d.gross_usd)}</td></tr>
                      <tr className="rf"><td className="lbl">{tr("monthRefunds")}</td><td className="n">{d.refunds_egp ? "−" : ""}{fmt(d.refunds_egp)}</td><td className="n">{d.refunds_usd ? "−" : ""}{fmt(d.refunds_usd)}</td></tr>
                      <tr className="nt"><td className="lbl">{tr("netCollection")}</td><td className="n">{fmt(d.net_egp)}</td><td className="n">{fmt(d.net_usd)}</td></tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const css = `
.ms-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r,16px);box-shadow:var(--sh);padding:18px 20px;width:100%}
.ms-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:16px}
.ms-head h3{font-size:16px;font-weight:800;color:var(--ink);margin:0}
.ms-head p{font-size:12px;color:var(--muted);margin:3px 0 0;font-weight:600}
.ms-livedot{font-size:10.5px;font-weight:800;color:var(--green);background:var(--green-soft);padding:4px 11px;border-radius:20px;white-space:nowrap;flex-shrink:0}
.ms-summary{border:1px solid var(--line);border-radius:14px;overflow:hidden}
.ms-colhdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
.ms-ch{font-size:10px;font-weight:800;color:var(--muted);width:120px;text-align:center;text-transform:uppercase;letter-spacing:.03em}
.ms-srow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}
.ms-srow.refund{background:var(--red-soft,#FBECEA)}
.ms-srow.net{background:var(--green-soft);border-bottom:none}
.ms-slbl{font-size:13px;font-weight:700;color:var(--text)}
.ms-srow.refund .ms-slbl{color:var(--red)}
.ms-srow.net .ms-slbl{color:var(--ink);font-weight:800}
.ms-vals{display:flex;align-items:center;gap:0}
.ms-cell{width:120px;display:inline-flex;align-items:baseline;justify-content:center;gap:5px}
.ms-cell b{font-family:var(--fd);font-weight:800;font-size:16px;color:var(--ink)}
.ms-cell i{font-style:normal;font-size:10.5px;font-weight:700;color:var(--muted);font-family:var(--fa)}
.ms-cell.refund b{color:var(--red)}
.ms-cell.net b{color:var(--green);font-size:17px}
.ms-bar{height:6px;background:var(--red-soft,#FBECEA)}
.ms-bar i{display:block;height:100%;background:var(--green)}
.ms-allbtn{margin-top:14px;width:100%;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);background:var(--surface);color:var(--text);font-family:inherit;font-weight:700;font-size:13px;padding:11px;border-radius:12px;cursor:pointer}
.ms-allbtn:hover{border-color:var(--brand);color:var(--brand-d);background:var(--brand-soft)}
.ms-ov{position:fixed;inset:0;background:rgba(21,34,59,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
.ms-modal{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.3);width:100%;max-width:520px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden}
.ms-mhead{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line);flex-shrink:0}
.ms-mhead h4{font-size:16px;font-weight:800;color:var(--ink);margin:0}
.ms-mhead span{font-size:11.5px;color:var(--muted);font-weight:600}
.ms-x{border:none;background:var(--bg);width:32px;height:32px;border-radius:9px;cursor:pointer;color:var(--muted);font-size:15px;flex-shrink:0}
.ms-x:hover{background:var(--red);color:#fff}
.ms-mbody{overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.ms-mcard{border:1px solid var(--line);border-radius:14px;padding:13px 15px}
.ms-mcard.cur{border-color:var(--brand);background:var(--brand-soft)}
.ms-mtop{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.ms-mname{font-size:14px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:6px}
.ms-curdot{width:6px;height:6px;border-radius:50%;background:var(--brand)}
.ms-mcnt{font-size:11px;color:var(--muted);font-weight:600}
.ms-mtbl{width:100%;border-collapse:collapse}
.ms-mtbl th{font-size:9.5px;font-weight:800;color:var(--muted);text-transform:uppercase;padding:4px 8px;text-align:center;border-bottom:1px solid var(--line)}
.ms-mtbl th:first-child{text-align:start}
.ms-mtbl td{padding:8px;text-align:center;font-family:var(--fd);font-weight:800;font-size:13.5px;color:var(--ink)}
.ms-mtbl td.lbl{text-align:start;font-family:var(--fa);font-weight:700;font-size:12px;color:var(--text)}
.ms-mtbl tr.rf td:not(.lbl){color:var(--red)}
.ms-mtbl tr.rf td.lbl{color:var(--red)}
.ms-mtbl tr.nt td:not(.lbl){color:var(--green)}
.ms-mtbl tr.nt td.lbl{font-weight:800;color:var(--ink)}
.ms-empty{font-size:13px;color:var(--muted);padding:16px;text-align:center}
.ms-mbody::-webkit-scrollbar{width:6px}
.ms-mbody::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
@media(max-width:520px){.ms-ch,.ms-cell{width:88px}.ms-cell b{font-size:14px}}
`;
