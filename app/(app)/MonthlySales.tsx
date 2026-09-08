"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";

type Row = { ym: string; egp: number; usd: number; cnt: number };
type Close = { gross_egp: number; gross_usd: number; refunds_egp: number; refunds_usd: number; net_egp: number; net_usd: number };

export default function MonthlySales({ rows, collapsible = false }: { rows: Row[]; collapsible?: boolean }) {
  const tr = useT();
  const lang = useLang();
  const [open, setOpen] = useState(!collapsible);
  const [close, setClose] = useState<Close | null>(null);
  useEffect(() => {
    const now = new Date();
    (async () => {
      try {
        const r: any = await createClient().rpc("monthly_close", { p_year: now.getFullYear(), p_month: now.getMonth() + 1 });
        if (!r.error && r.data && r.data[0]) setClose(r.data[0]);
      } catch { /* لا صلاحية مالية؟ نتجاهل */ }
    })();
  }, []);

  const nf = new Intl.NumberFormat("en-US"); // أرقام لاتيني
  const fmt = (n: number) => nf.format(Math.round(Number(n) || 0));
  const curYm = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15));
  };
  const netPct = close && Number(close.gross_egp) > 0 ? Math.max(0, Math.min(100, Math.round((Number(close.net_egp) / Number(close.gross_egp)) * 100))) : 100;
  const hasRefund = close ? (Number(close.refunds_egp) > 0 || Number(close.refunds_usd) > 0) : false;

  return (
    <div className="ms-card">
      <style>{css}</style>
      <div className={"ms-head" + (collapsible ? " clk" : "")} onClick={() => collapsible && setOpen((o) => !o)}>
        <div style={{ minWidth: 0 }}>
          <h3>{tr("monthlySales")}</h3>
          <p>{tr("monthlySalesHint")}</p>
        </div>
        {collapsible && (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--muted)" strokeWidth={2.4}
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
        )}
      </div>

      {open && close && (
        <div className="ms-summary">
          <div className="ms-srow">
            <span className="ms-slbl">{tr("totalCollection")}</span>
            <span className="ms-sval n">{fmt(close.gross_egp)} <i>{tr("egp")}</i>{Number(close.gross_usd) > 0 ? <b className="usd">${fmt(close.gross_usd)}</b> : null}</span>
          </div>
          <div className="ms-srow refund">
            <span className="ms-slbl">↩︎ {tr("monthRefunds")}</span>
            <span className="ms-sval n red">{hasRefund ? `−${fmt(close.refunds_egp)}` : "0"} {hasRefund ? <i>{tr("egp")}</i> : null}{hasRefund && Number(close.refunds_usd) > 0 ? <b className="usd red">−${fmt(close.refunds_usd)}</b> : null}</span>
          </div>
          <div className="ms-srow net">
            <span className="ms-slbl">{tr("netCollection")}</span>
            <span className="ms-sval n green big">{fmt(close.net_egp)} <i>{tr("egp")}</i>{Number(close.net_usd) > 0 ? <b className="usd green">${fmt(close.net_usd)}</b> : null}</span>
          </div>
          <div className="ms-bar"><i style={{ width: netPct + "%" }} /></div>
        </div>
      )}

      {open && (
        rows.length === 0
          ? <div className="ms-empty">{tr("noReceiptsYet")}</div>
          : (
            <div className="ms-list">
              {rows.map((r) => (
                <div key={r.ym} className={"ms-month" + (r.ym === curYm ? " cur" : "")}>
                  <div className="ms-minfo">
                    <div className="ms-mname">{monthLabel(r.ym)}{r.ym === curYm && <span className="ms-curdot" />}</div>
                    <div className="ms-mcnt">{fmt(r.cnt)} {tr("receiptsWord")}</div>
                  </div>
                  <div className="ms-mamt">
                    <span className="ms-egp n">{fmt(r.egp)} <i>{tr("egp")}</i></span>
                    {Number(r.usd) > 0 && <span className="ms-usd n">${fmt(r.usd)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}

const css = `
.ms-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r,16px);box-shadow:var(--sh);padding:16px 18px;max-width:440px;width:100%}
.ms-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ms-head.clk{cursor:pointer}
.ms-head h3{font-size:15px;font-weight:800;color:var(--ink);margin:0}
.ms-head p{font-size:11px;color:var(--muted);margin:3px 0 0}
/* ملخّص الشهر الحالي */
.ms-summary{margin-top:14px;border:1px solid var(--line);border-radius:13px;overflow:hidden}
.ms-srow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line)}
.ms-srow.refund{background:var(--red-soft,#FBECEA)}
.ms-srow.net{background:var(--green-soft);border-bottom:none}
.ms-slbl{font-size:12.5px;font-weight:700;color:var(--text)}
.ms-srow.refund .ms-slbl{color:var(--red)}
.ms-srow.net .ms-slbl{color:var(--ink);font-weight:800}
.ms-sval{font-family:var(--fd);font-weight:800;font-size:14.5px;color:var(--ink);direction:ltr;display:inline-flex;align-items:baseline;gap:5px}
.ms-sval i{font-style:normal;font-size:10.5px;font-weight:700;color:var(--muted);font-family:var(--fa)}
.ms-sval.red{color:var(--red)}
.ms-sval.green.big{font-size:17px}
.ms-sval .usd{font-family:var(--fd);font-size:11.5px;font-weight:800;background:var(--blue-soft);color:var(--blue);padding:1px 7px;border-radius:12px;margin-inline-start:3px}
.ms-sval .usd.red{background:var(--red-soft,#FBECEA);color:var(--red)}
.ms-sval .usd.green{background:rgba(46,158,107,.15);color:var(--green)}
.ms-bar{height:5px;background:var(--red-soft,#FBECEA)}
.ms-bar i{display:block;height:100%;background:var(--green);border-radius:0 3px 3px 0}
/* قائمة الشهور */
.ms-list{margin-top:14px;display:flex;flex-direction:column;max-height:290px;overflow-y:auto}
.ms-month{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 4px;border-bottom:1px solid var(--line)}
.ms-month:last-child{border-bottom:none}
.ms-month.cur{background:var(--brand-soft);border-radius:10px;padding-inline:11px;border-bottom:1px solid transparent;margin-bottom:2px}
.ms-minfo{min-width:0}
.ms-mname{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap;display:flex;align-items:center;gap:6px}
.ms-curdot{width:6px;height:6px;border-radius:50%;background:var(--brand)}
.ms-mcnt{font-size:10.5px;color:var(--muted);margin-top:2px}
.ms-mamt{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;text-align:end}
.ms-egp{font-family:var(--fd);font-weight:800;font-size:14px;color:var(--ink);direction:ltr}
.ms-egp i{font-style:normal;font-size:9.5px;font-weight:700;color:var(--muted);font-family:var(--fa)}
.ms-usd{font-family:var(--fd);font-weight:800;font-size:11px;color:var(--blue);background:var(--blue-soft);padding:1px 8px;border-radius:12px;direction:ltr}
.ms-empty{font-size:13px;color:var(--muted);padding:12px 2px}
.ms-list::-webkit-scrollbar{width:6px}
.ms-list::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
`;
