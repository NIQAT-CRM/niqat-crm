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
  const [rate, setRate] = useState<number>(44);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editRate, setEditRate] = useState(false);
  const [rateInput, setRateInput] = useState("44");
  const [rateBusy, setRateBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      try { const r: any = await sb.rpc("monthly_close_all"); if (!r.error && Array.isArray(r.data)) setAll(r.data); } catch { }
      try { const r: any = await sb.rpc("usd_rate_get"); if (!r.error && r.data != null) { setRate(Number(r.data)); setRateInput(String(Number(r.data))); } } catch { }
      try { const { data: { user } } = await sb.auth.getUser(); if (user) { const { data: p } = await sb.from("profiles").select("team").eq("id", user.id).maybeSingle(); setIsAdmin((p?.team || "").toLowerCase() === "admin"); } } catch { }
    })();
  }, []);

  async function saveRate() {
    const v = Number(rateInput);
    if (!v || v <= 0) return;
    setRateBusy(true);
    const { error } = await createClient().rpc("usd_rate_set", { p_rate: v });
    setRateBusy(false);
    if (!error) { setRate(v); setEditRate(false); }
  }

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
        <div className="ms-unified">
          <div className="ms-urow">
            <span className="ms-ulbl">💱 {tr("unifiedTotal")}
              {!editRate ? (
                <button className="ms-rate" onClick={() => isAdmin && setEditRate(true)} title={isAdmin ? tr("edit") : ""} style={{ cursor: isAdmin ? "pointer" : "default" }}>
                  {tr("usdRate")}: {rate}{isAdmin && <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>}
                </button>
              ) : (
                <span className="ms-rate-edit">
                  <input value={rateInput} onChange={(e) => setRateInput(e.target.value)} inputMode="decimal" />
                  <button onClick={saveRate} disabled={rateBusy} className="ok">{rateBusy ? "…" : "✓"}</button>
                  <button onClick={() => { setEditRate(false); setRateInput(String(rate)); }} className="cx">✕</button>
                </span>
              )}
            </span>
            <b className="n">{fmt(nEgp + nUsd * rate)} <i>{tr("egp")}</i></b>
          </div>
          <div className="ms-uhint">{tr("egp")} {fmt(nEgp)} + ${fmt(nUsd)} × {rate}</div>
        </div>
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
                  <div className="ms-mg">
                    <div className="ms-mg-h"><span /><span>{tr("egp")}</span><span>USD $</span></div>
                    <div className="ms-mg-r"><span className="l">{tr("totalCollection")}</span><b className="n">{fmt(d.gross_egp)}</b><b className="n">{fmt(d.gross_usd)}</b></div>
                    <div className="ms-mg-r rf"><span className="l">{tr("monthRefunds")}</span><b className="n">{d.refunds_egp ? "−" : ""}{fmt(d.refunds_egp)}</b><b className="n">{d.refunds_usd ? "−" : ""}{fmt(d.refunds_usd)}</b></div>
                    <div className="ms-mg-r nt"><span className="l">{tr("netCollection")}</span><b className="n">{fmt(d.net_egp)}</b><b className="n">{fmt(d.net_usd)}</b></div>
                    <div className="ms-mg-uni"><span>💱 {tr("unifiedTotal")} ({tr("egp")} · ×{rate})</span><b className="n">{fmt(d.net_egp + d.net_usd * rate)}</b></div>
                  </div>
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
.ms-unified{border-top:1px dashed var(--line);padding:12px 16px;background:var(--brand-soft)}
.ms-urow{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ms-ulbl{font-size:12.5px;font-weight:800;color:var(--brand-d);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ms-urow b{font-family:var(--fd);font-weight:800;font-size:17px;color:var(--brand-d);direction:ltr;display:inline-flex;align-items:baseline;gap:4px}
.ms-urow b i{font-style:normal;font-size:10.5px;font-weight:700;color:var(--brand-d);opacity:.7;font-family:var(--fa)}
.ms-rate{border:1px solid var(--brand);background:var(--surface);color:var(--brand-d);font-family:var(--fd);font-weight:700;font-size:11px;padding:2px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:4px}
.ms-rate-edit{display:inline-flex;align-items:center;gap:4px}
.ms-rate-edit input{width:56px;height:26px;border:1px solid var(--brand);border-radius:7px;padding:0 8px;font-family:var(--fd);font-size:12px;text-align:center;background:var(--surface);color:var(--ink)}
.ms-rate-edit button{width:26px;height:26px;border-radius:7px;border:none;cursor:pointer;font-size:12px}
.ms-rate-edit .ok{background:var(--green);color:#fff}
.ms-rate-edit .cx{background:var(--bg);color:var(--muted)}
.ms-uhint{font-size:10px;color:var(--brand-d);opacity:.7;margin-top:4px;font-family:var(--fd);direction:ltr;text-align:end}
.ms-mg-uni{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;padding:7px 9px;background:var(--brand-soft);border-radius:8px}
.ms-mg-uni span{font-size:10px;font-weight:700;color:var(--brand-d)}
.ms-mg-uni b{font-family:var(--fd);font-weight:800;font-size:13px;color:var(--brand-d);direction:ltr}
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
.ms-mg{display:flex;flex-direction:column}
.ms-mg-h,.ms-mg-r{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:6px;align-items:center}
.ms-mg-h{padding:5px 8px;border-bottom:1px solid var(--line)}
.ms-mg-h span{font-size:9.5px;font-weight:800;color:var(--muted);text-transform:uppercase;text-align:center}
.ms-mg-h span:first-child{text-align:start}
.ms-mg-r{padding:8px;border-radius:8px}
.ms-mg-r .l{font-family:var(--fa);font-weight:700;font-size:12px;color:var(--text);text-align:start;min-width:0}
.ms-mg-r b{font-family:var(--fd);font-weight:800;font-size:13.5px;color:var(--ink);text-align:center;direction:ltr}
.ms-mg-r.rf{background:var(--red-soft,#FBECEA)}
.ms-mg-r.rf .l,.ms-mg-r.rf b{color:var(--red)}
.ms-mg-r.nt{background:var(--green-soft)}
.ms-mg-r.nt .l{font-weight:800;color:var(--ink)}
.ms-mg-r.nt b{color:var(--green)}
.ms-empty{font-size:13px;color:var(--muted);padding:16px;text-align:center}
.ms-mbody::-webkit-scrollbar{width:6px}
.ms-mbody::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
@media(max-width:520px){.ms-ch,.ms-cell{width:88px}.ms-cell b{font-size:14px}}
`;
