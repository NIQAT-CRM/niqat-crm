"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { postExport } from "@/lib/export/download";

type Opt = { id: string; code: string };
type Aff = { name: string; code: string; discount: number };

export default function AffiliateExport({ batches, affiliates }: { batches: Opt[]; affiliates: Aff[] }) {
  const tr = useT();
  const supabase = createClient();
  const [batchId, setBatchId] = useState("");
  const [busy, setBusy] = useState(false);

  const affName = (code: string) => affiliates.find((a) => a.code.toUpperCase() === (code || "").toUpperCase());

  async function exportCsv() {
    if (!batchId) { toast(tr("selectBatch")); return; }
    setBusy(true);
    try {
      // 1) اشتراكات الباتش
      const { data: enrs } = await supabase.from("enrollments")
        .select("id,customer_id").eq("batch_id", batchId);
      const custIds = Array.from(new Set((enrs || []).map((e: any) => e.customer_id)));
      const enrIds = (enrs || []).map((e: any) => e.id);
      if (custIds.length === 0) { toast(tr("noCustomersInBatch")); setBusy(false); return; }

      // 2) العملاء (الكود + الاسم)
      const { data: custs } = await supabase.from("customers")
        .select("id,name,affiliate_code").in("id", custIds);

      // 3) المدفوع (الأقساط المدفوعة) لكل اشتراك
      const { data: insts } = await supabase.from("installments")
        .select("enrollment_id,amount,status,paid_at").in("enrollment_id", enrIds);
      const enrCust = new Map((enrs || []).map((e: any) => [e.id, e.customer_id]));
      const paidByCust = new Map<string, number>();
      for (const i of (insts || []) as any[]) {
        if (i.status === "paid" || i.paid_at) {
          const cid = enrCust.get(i.enrollment_id);
          if (cid) paidByCust.set(cid, (paidByCust.get(cid) || 0) + (Number(i.amount) || 0));
        }
      }

      // 4) الريفند
      const { data: refunds } = await supabase.from("refunds")
        .select("customer_id,status").in("customer_id", custIds);
      const refundedSet = new Set((refunds || []).map((r: any) => r.customer_id));

      // 5) صفوف مسطّحة (صف لكل عميل) — تصدّر XLSX مبراندَد من السيرفر
      const batchCode = batches.find((b) => b.id === batchId)?.code || batchId;
      const rows: (string | number)[][] = [];
      for (const c of (custs || []) as any[]) {
        const code = (c.affiliate_code || "").trim();
        if (!code) continue;
        const a = affName(code);
        const paid = Math.round(paidByCust.get(c.id) || 0);
        const status = refundedSet.has(c.id) ? tr("refundWord") : tr("activeWord");
        rows.push([a?.name || "—", code, (a?.discount || 0) + "%", c.name || "", paid, status]);
      }
      if (!rows.length) { toast(tr("noAffiliateCustomers")); setBusy(false); return; }
      const headers = [tr("affiliate"), tr("code"), tr("discountRate"), tr("customerName"), tr("paidWord"), tr("status")];
      const r = await postExport(
        { type: "generic", title: `${tr("affiliateExportTitle")} — ${tr("batchWord")} ${batchCode}`, filename: `niqat-affiliates-${batchCode}`, headers, rows },
        `niqat-affiliates-${batchCode}`
      );
      if (r.ok) toast(tr("exported")); else toast(tr("exportFailed") + (r.error ? ` (${r.error})` : ""));
    } catch {
      toast(tr("exportFailed"));
    }
    setBusy(false);
  }

  return (
    <div className="card" style={{ padding: 18, marginTop: 16 }}>
      <div className="sec-t" style={{ marginTop: 0 }}>{tr("affiliateExportPerBatch")}</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        {tr("affiliateExportHint")}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <select className="inp" style={{ flex: 1 }} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">{tr("selectBatchDash")}</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <button className="btn" onClick={exportCsv} disabled={busy} style={{ height: 40 }}>{busy ? "..." : tr("exportExcel")}</button>
      </div>
    </div>
  );
}
