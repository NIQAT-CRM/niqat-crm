"use client";
import { useState } from "react";
import Link from "next/link";
import { useT, useLang } from "@/lib/i18n/client";
import EmptyState from "../EmptyState";

type Row = {
  id: string; customer_id: string; customerName: string;
  amount: number; currency: string; reason: string; status: string; created_at: string;
};

const STATUS: Record<string, { labelKey: string; color: string }> = {
  requested: { labelKey: "refundRequested2", color: "var(--amber)" },
  refunded: { labelKey: "refundDone2", color: "var(--blue)" },
  closed: { labelKey: "archived", color: "#94A2BB" },
};

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}
function cairoYm(iso: string): string {
  try {
    const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
    return s.slice(0, 7);
  } catch { return String(iso).slice(0, 7); }
}

export default function RefundTable({ rows }: { rows: Row[] }) {
  const tr = useT();
  const lang = useLang();
  const curYm = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (ym: string) => setCollapsed((p) => { const n = new Set(p); n.has(ym) ? n.delete(ym) : n.add(ym); return n; });

  if (!rows.length) return <EmptyState text={tr("funNoRefunds")} />;

  // تجميع بالشهور (بتاريخ الطلب، توقيت القاهرة)
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const ym = cairoYm(r.created_at); const a = groups.get(ym) || []; a.push(r); groups.set(ym, a); }
  const months = Array.from(groups.keys()).sort().reverse();
  const monthLabel = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15)); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {months.map((ym) => {
        const list = groups.get(ym)!;
        const req = list.filter((r) => r.status === "requested");
        const reqEgp = req.filter((r) => r.currency !== "USD").reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const reqUsd = req.filter((r) => r.currency === "USD").reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const isCur = ym === curYm;
        const open = isCur ? !collapsed.has(ym) : collapsed.has("open:" + ym);
        return (
          <div key={ym} className="rf-msec">
            <button className={"rf-mhead" + (isCur ? " cur" : "")} onClick={() => setCollapsed((p) => {
              const n = new Set(p);
              const key = isCur ? ym : "open:" + ym;
              n.has(key) ? n.delete(key) : n.add(key);
              return n;
            })}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4}
                style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
              <span className="rf-mname">{monthLabel(ym)}{isCur && <span className="rf-curbadge">{tr("thisMonth")}</span>}</span>
              <span className="rf-mcount">{list.length}</span>
              {(reqEgp > 0 || reqUsd > 0) && (
                <span className="rf-mtotal n" dir="ltr">−{new Intl.NumberFormat("en").format(Math.round(reqEgp))}{reqUsd > 0 ? ` · −$${new Intl.NumberFormat("en").format(Math.round(reqUsd))}` : ""} <i>{tr("egp")}</i></span>
              )}
            </button>

            {open && (
              <div className="rf-mbody">
                {(reqEgp > 0 || reqUsd > 0) && (
                  <div className="rf-reqbanner">
                    <span>💰 {tr("totalRequestedRefunds")} · {req.length} {tr("requestWord")}</span>
                    <span className="n" dir="ltr">{new Intl.NumberFormat("en").format(Math.round(reqEgp))} EGP{reqUsd > 0 ? ` · ${new Intl.NumberFormat("en").format(Math.round(reqUsd))} $` : ""}</span>
                  </div>
                )}
                <div className="tbl-wrap">
                  <table>
                    <thead><tr><th>{tr("customer")}</th><th>{tr("serviceReason")}</th><th>{tr("amount")}</th><th>{tr("status")}</th><th>{tr("actions")}</th></tr></thead>
                    <tbody>
                      {list.map((r) => {
                        const st = STATUS[r.status] || STATUS.requested;
                        return (
                          <tr key={r.id}>
                            <td><Link href={`/customers/${r.customer_id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>{r.customerName || "—"}</Link></td>
                            <td style={{ color: "var(--muted)", maxWidth: 260 }}>{r.reason || "—"}</td>
                            <td className="num" dir="ltr" style={{ fontWeight: 700, color: "var(--ink)" }}>{money(r.amount, r.currency)}</td>
                            <td><span className="stg" style={{ background: st.color + "22", color: st.color }}>{tr(st.labelKey)}</span></td>
                            <td><Link href={`/customers/${r.customer_id}`} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}>{tr("openCard")}</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <style>{css}</style>
    </div>
  );
}

const css = `
.rf-msec{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface)}
.rf-mhead{width:100%;display:flex;align-items:center;gap:10px;padding:13px 16px;background:var(--bg);border:none;cursor:pointer;font-family:inherit;color:var(--ink);text-align:start}
.rf-mhead.cur{background:var(--brand-soft)}
.rf-mhead svg{color:var(--muted)}
.rf-mhead.cur svg{color:var(--brand-d)}
.rf-mname{font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}
.rf-mhead.cur .rf-mname{color:var(--brand-d)}
.rf-curbadge{font-size:9.5px;font-weight:800;color:var(--green);background:var(--green-soft);padding:2px 8px;border-radius:20px}
.rf-mcount{font-size:11.5px;font-weight:700;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:2px 10px;font-family:var(--fd)}
.rf-mtotal{margin-inline-start:auto;font-family:var(--fd);font-weight:800;font-size:13.5px;color:var(--red);display:inline-flex;align-items:baseline;gap:4px}
.rf-mtotal i{font-style:normal;font-size:9.5px;color:var(--muted);font-family:var(--fa)}
.rf-mbody{padding:14px 16px}
.rf-reqbanner{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--amber-soft,#FBF1DC);border:1px solid rgba(224,163,46,.3);border-radius:11px;padding:10px 14px;margin-bottom:12px;flex-wrap:wrap}
.rf-reqbanner>span:first-child{font-weight:800;color:#9a6a12;font-size:12.5px}
.rf-reqbanner>span:last-child{font-family:var(--fd);font-weight:800;font-size:15px;color:var(--red)}
`;
