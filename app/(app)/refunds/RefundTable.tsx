"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
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

export default function RefundTable({ rows }: { rows: Row[] }) {
  const tr = useT();
  if (!rows.length) return <EmptyState text={tr("funNoRefunds")} />;
  const req = rows.filter((r) => r.status === "requested");
  const reqEgp = req.filter((r) => r.currency !== "USD").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const reqUsd = req.filter((r) => r.currency === "USD").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return (
    <div className="tbl-wrap">
      {req.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--amber-soft,#FBF1DC)", border: "1px solid rgba(224,163,46,.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, color: "#9a6a12", fontSize: 13 }}>💰 {tr("totalRequestedRefunds")} · {req.length} {tr("requestWord")}</span>
          <span className="num" dir="ltr" style={{ fontFamily: "var(--fd)", fontWeight: 800, fontSize: 16, color: "var(--red)" }}>
            {new Intl.NumberFormat("en").format(Math.round(reqEgp))} EGP{reqUsd > 0 ? ` · ${new Intl.NumberFormat("en").format(Math.round(reqUsd))} $` : ""}
          </span>
        </div>
      )}
      <table>
        <thead>
          <tr><th>{tr("customer")}</th><th>{tr("serviceReason")}</th><th>{tr("amount")}</th><th>{tr("status")}</th><th>{tr("actions")}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = STATUS[r.status] || STATUS.requested;
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/customers/${r.customer_id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>
                    {r.customerName || "—"}
                  </Link>
                </td>
                <td style={{ color: "var(--muted)", maxWidth: 260 }}>{r.reason || "—"}</td>
                <td className="num" dir="ltr" style={{ fontWeight: 700, color: "var(--ink)" }}>{money(r.amount, r.currency)}</td>
                <td><span className="stg" style={{ background: st.color + "22", color: st.color }}>{tr(st.labelKey)}</span></td>
                <td>
                  <Link href={`/customers/${r.customer_id}`} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}>
                    {tr("openCard")}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
