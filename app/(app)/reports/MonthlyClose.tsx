"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";

type Close = { gross_egp: number; gross_usd: number; refunds_egp: number; refunds_usd: number; net_egp: number; net_usd: number; refunds_count: number };
type Refund = { id?: string; customer_name: string; service_label: string; amount: number; currency: string; created_at: string; requested_by_name: string; status: string };

export default function MonthlyClose() {
  const t = useT();
  const lang = useLang();
  const supabase = createClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [close, setClose] = useState<Close | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const fmt = (n: number) => nf.format(Math.round(Number(n) || 0));
  const monthLabel = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 15));

  const load = useCallback(async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      supabase.rpc("monthly_close", { p_year: year, p_month: month }),
      supabase.rpc("monthly_refunds", { p_year: year, p_month: month }),
    ]);
    setClose((c.data && (c.data as any[])[0]) || null);
    setRefunds(((r.data as any[]) || []) as Refund[]);
    setLoading(false);
  }, [year, month]);
  useEffect(() => { load(); }, [load]);

  function shift(delta: number) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setYear(y); setMonth(m);
  }
  // الشهر مقفول لو انتهى (آخر يوم فيه عدّى)
  const isOpen = (year > now.getFullYear()) || (year === now.getFullYear() && month >= now.getMonth() + 1);

  async function cancel(rf: Refund) {
    if (!rf.id || rf.status !== "requested") return;
    setBusyId(rf.id);
    const { error } = await supabase.rpc("cancel_refund", { p_refund_id: rf.id });
    setBusyId(null);
    if (error) { toast(t("cancelFailed") + error.message); return; }
    toast(t("refundCancelled")); load();
  }

  function exportXlsx() {
    const head = [t("customerName"), t("serviceLabel"), t("amount"), t("currency"), t("requestDate"), t("requestedBy"), t("statusWord")];
    const rows = refunds.map((r) => [r.customer_name, r.service_label, r.amount, r.currency, String(r.created_at).slice(0, 10), r.requested_by_name, r.status]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `monthly-close-${year}-${String(month).padStart(2, "0")}.csv`; a.click();
  }

  const stStyle = (s: string) => s === "requested"
    ? { background: "var(--amber-soft,#FBF1DC)", color: "#9a6a12" }
    : { background: "var(--green-soft)", color: "var(--green)" };

  return (
    <div style={{ maxWidth: 640 }}>
      <style>{css}</style>
      <div className="mc-nav">
        <button onClick={() => shift(-1)} aria-label="prev">‹</button>
        <span className="mc-month">{monthLabel}</span>
        <button onClick={() => shift(1)} aria-label="next">›</button>
        <span className={"mc-badge " + (isOpen ? "open" : "closed")}>{isOpen ? t("monthOpen") : t("monthClosed")}</span>
      </div>

      <div className="mc-stmt">
        <div className="mc-hdr"><div>{t("itemWord")}</div><div className="c">{t("egpShort")}</div><div className="c">$</div></div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>…</div>
        ) : close ? (<>
          <div className="mc-row gross">
            <span className="lbl">{t("totalCollection")}</span>
            <span className="val n">{fmt(close.gross_egp)}</span>
            <span className="val n">${fmt(close.gross_usd)}</span>
          </div>
          <div className="mc-row refund">
            <span className="lbl">− {t("monthRefunds")} ({close.refunds_count})</span>
            <span className="val n red">−{fmt(close.refunds_egp)}</span>
            <span className="val n red">−${fmt(close.refunds_usd)}</span>
          </div>
          <div className="mc-row net">
            <span className="lbl">{t("netCollection")}</span>
            <span className="val n green">{fmt(close.net_egp)}</span>
            <span className="val n green">${fmt(close.net_usd)}</span>
          </div>
        </>) : <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>—</div>}
      </div>

      <div className="mc-refhead">
        <h4>{t("refundsDetail")}</h4>
        {refunds.length > 0 && <button className="mc-export" onClick={exportXlsx}>⬇ {t("exportExcel")}</button>}
      </div>

      {refunds.length === 0 ? (
        <div className="mc-empty">{t("noRefundsThisMonth")}</div>
      ) : (
        <div className="mc-tbl">
          <div className="mc-thead"><div>{t("customerService")}</div><div className="c">{t("amount")}</div><div className="c">{t("statusWord")}</div><div className="c">{t("actionWord")}</div></div>
          {refunds.map((r, i) => (
            <div className="mc-trow" key={r.id || i}>
              <div className="mc-cust"><b>{r.customer_name}</b><span>{r.service_label}</span><em>{String(r.created_at).slice(0, 10)} · {r.requested_by_name}</em></div>
              <div className="c mc-amt n">{r.currency === "USD" ? "$" : ""}{fmt(r.amount)}{r.currency === "EGP" ? " " + t("egpShort") : ""}</div>
              <div className="c"><span className="mc-st" style={stStyle(r.status)}>{r.status === "requested" ? t("statusRequested") : r.status === "refunded" ? t("statusRefunded") : t(r.status)}</span></div>
              <div className="c">
                {r.status === "requested" && r.id
                  ? <button className="mc-cancel" onClick={() => cancel(r)} disabled={busyId === r.id}>{busyId === r.id ? "…" : t("cancelRefund")}</button>
                  : <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mc-footnote">💡 {t("monthlyCloseFootnote")}</p>
    </div>
  );
}

const css = `
.mc-nav{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.mc-nav button{width:34px;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:18px;cursor:pointer;line-height:1}
.mc-nav button:hover{border-color:var(--brand);color:var(--brand)}
.mc-month{font-size:16px;font-weight:800;color:var(--ink);min-width:150px;text-align:center;font-family:var(--fd)}
.mc-badge{margin-inline-start:auto;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px}
.mc-badge.open{background:var(--amber-soft,#FBF1DC);color:#9a6a12}
.mc-badge.closed{background:var(--green-soft);color:var(--green)}
.mc-stmt{background:var(--surface);border:1px solid var(--line);border-radius:var(--r,16px);box-shadow:var(--sh);overflow:hidden;margin-bottom:22px}
.mc-hdr{display:grid;grid-template-columns:1fr 110px 110px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--bg)}
.mc-hdr div{font-size:11px;font-weight:800;color:var(--muted)}
.mc-hdr .c{text-align:center}
.mc-row{display:grid;grid-template-columns:1fr 110px 110px;padding:15px 18px;align-items:center;border-bottom:1px solid var(--line)}
.mc-row:last-child{border-bottom:none}
.mc-row .lbl{font-size:13.5px;font-weight:700;color:var(--text)}
.mc-row .val{text-align:center;font-family:var(--fd);font-weight:700;font-size:14.5px;color:var(--ink)}
.mc-row .val.red{color:var(--red)}
.mc-row .val.green{color:var(--green)}
.mc-row.refund{background:var(--red-soft,#FBECEA)}
.mc-row.refund .lbl{color:var(--red)}
.mc-row.net{background:var(--green-soft)}
.mc-row.net .lbl{font-weight:800;color:var(--ink)}
.mc-row.net .val.green{font-size:16px;font-weight:800}
.mc-refhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.mc-refhead h4{font-size:14px;font-weight:800;color:var(--ink)}
.mc-export{border:1px solid var(--line);background:var(--surface);color:var(--muted);font-family:inherit;font-weight:700;font-size:12px;padding:7px 13px;border-radius:9px;cursor:pointer}
.mc-export:hover{border-color:var(--green);color:var(--green)}
.mc-empty{background:var(--surface);border:1px dashed var(--line);border-radius:12px;padding:22px;text-align:center;color:var(--muted);font-size:13px}
.mc-tbl{background:var(--surface);border:1px solid var(--line);border-radius:var(--r,16px);box-shadow:var(--sh);overflow:hidden}
.mc-thead{display:grid;grid-template-columns:1fr 100px 90px 90px;padding:11px 16px;border-bottom:1px solid var(--line);background:var(--bg)}
.mc-thead div{font-size:11px;font-weight:800;color:var(--muted)}
.mc-thead .c{text-align:center}
.mc-trow{display:grid;grid-template-columns:1fr 100px 90px 90px;padding:12px 16px;align-items:center;border-bottom:1px solid var(--line)}
.mc-trow:last-child{border-bottom:none}
.mc-cust{display:flex;flex-direction:column;gap:2px;min-width:0}
.mc-cust b{font-size:13px;font-weight:700;color:var(--ink)}
.mc-cust span{font-size:11.5px;color:var(--muted)}
.mc-cust em{font-size:10px;color:var(--muted);font-style:normal;opacity:.8;font-family:var(--fd)}
.mc-amt{font-family:var(--fd);font-weight:700;color:var(--red);font-size:13px}
.mc-st{font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap}
.mc-cancel{border:1px solid rgba(219,91,78,.35);background:var(--red-soft,#FBECEA);color:var(--red);font-family:inherit;font-weight:700;font-size:11px;padding:5px 10px;border-radius:8px;cursor:pointer}
.mc-cancel:hover{background:var(--red);color:#fff}
.mc-cancel:disabled{opacity:.5;cursor:default}
.mc-footnote{font-size:11px;color:var(--muted);margin-top:16px;text-align:center}
.c{text-align:center}
`;
