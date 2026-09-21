import { hasPerm } from "@/lib/authz";
import NoAccess from "../NoAccess";
import Link from "next/link";
import RefundTable from "./RefundTable";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " EGP");
}

const STATUS: Record<string, { labelKey: string; color: string; bg: string }> = {
  requested: { labelKey: "refundRequested2", color: "#B8860B", bg: "#FEF6E0" },
  refunded: { labelKey: "refundDone2", color: "var(--blue)", bg: "#E8F0FF" },
  closed: { labelKey: "archived", color: "#94A2BB", bg: "#EEF1F6" },
};

export default async function Refunds() {
  if (!(await hasPerm("can_view_refunds"))) return <NoAccess />;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_see_finance").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_see_finance) {
    return (
      <div className="page-h"><div><h1>{tr("refunds")}</h1><p>{tr("noFinanceAccess")}</p></div></div>
    );
  }

  const { data: rf, error } = await supabase
    .from("refunds").select("id,customer_id,amount,currency,reason,status,created_at").order("created_at", { ascending: false });

  if (error) {
    const missingTable = (error as any)?.code === "42P01" || /does not exist|relation .* does not/i.test((error as any)?.message || "");
    return (
      <div>
        <div className="page-h"><div><h1>{tr("refunds")}</h1></div></div>
        <div className="card" style={{ padding: 20, fontSize: 14, color: "var(--muted)" }}>
          {missingTable
            ? tr("refundsTableMissing")
            : `${tr("refundsLoadFailed")} ${(error as any)?.message || tr("unknownError")}`}
        </div>
      </div>
    );
  }

  // نجيب بس العملاء اللي ليهم ريفند (بالـ id) — مش الجدول كله (اللي بيتحدّ بـ 1000 صف)
  const cids = Array.from(new Set((rf || []).map((r) => r.customer_id)));
  const { data: custs } = cids.length
    ? await supabase.from("customers").select("id,name,archived").in("id", cids)
    : { data: [] as any[] };

  const cName = new Map((custs || []).map((c) => [c.id, c.name]));
  // نعرض كل الريفندات بأي حالة (شامل المقفول) وكل العملاء — عشان المجموع يطابق الداشبورد بالظبط
  const rows = (rf || []);
  const needTransfer = rows.filter((r) => r.status === "requested").length;
  const needClose = rows.filter((r) => r.status === "refunded").length;

  // تجميعة شهرية بكل الحالات (شاملة المقفول) — عشان كارت الشهر يوري الإجمالي الكامل المطابق للداشبورد
  const { data: allRf } = await supabase.from("refunds").select("amount,currency,status,created_at");
  const cairoYm = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
  const monthAgg: Record<string, { reqEgp: number; reqUsd: number; refEgp: number; refUsd: number; closedEgp: number; closedUsd: number }> = {};
  for (const r of ((allRf as any[]) || [])) {
    if (!r.created_at) continue;
    const ym = cairoYm(String(r.created_at));
    const a = monthAgg[ym] || (monthAgg[ym] = { reqEgp: 0, reqUsd: 0, refEgp: 0, refUsd: 0, closedEgp: 0, closedUsd: 0 });
    const amt = Number(r.amount) || 0;
    const usd = r.currency === "USD";
    if (r.status === "requested") usd ? (a.reqUsd += amt) : (a.reqEgp += amt);
    else if (r.status === "refunded") usd ? (a.refUsd += amt) : (a.refEgp += amt);
    else if (r.status === "closed") usd ? (a.closedUsd += amt) : (a.closedEgp += amt);
  }

  return (
    <div>
      <div className="page-h"><div><h1>{tr("refunds")}</h1><p>{rows.length} {tr("requestWord")}</p></div></div>

      {(needTransfer > 0 || needClose > 0) && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          {needTransfer > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FEF6E0", border: "1px solid #E8C766", borderRadius: 12, padding: "12px 16px" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#B8860B" }} className="num">{needTransfer}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-d)" }}>💸 {tr("refundBannerTransfer")}</span>
            </div>
          )}
          {needClose > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#E8F0FF", border: "1px solid #9DBBFF", borderRadius: 12, padding: "12px 16px" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--blue)" }} className="num">{needClose}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)" }}>🔒 {tr("refundBannerClose")}</span>
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty"><b>{tr("noRefundRequests")}</b></div>
      ) : (
        <RefundTable rows={rows.map((r) => ({
          id: r.id as string, customer_id: r.customer_id as string,
          customerName: cName.get(r.customer_id) || "—",
          amount: Number(r.amount), currency: r.currency as string,
          reason: (r.reason as string) || "", status: r.status as string,
          created_at: String(r.created_at || ""),
        }))} monthAgg={monthAgg} />
      )}
    </div>
  );
}
