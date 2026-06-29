"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Opt = { id: string; code: string };
type Aff = { name: string; code: string; discount: number };

export default function AffiliateExport({ batches, affiliates }: { batches: Opt[]; affiliates: Aff[] }) {
  const supabase = createClient();
  const [batchId, setBatchId] = useState("");
  const [busy, setBusy] = useState(false);

  const affName = (code: string) => affiliates.find((a) => a.code.toUpperCase() === (code || "").toUpperCase());

  async function exportCsv() {
    if (!batchId) { toast("اختر الباتش"); return; }
    setBusy(true);
    try {
      // 1) اشتراكات الباتش
      const { data: enrs } = await supabase.from("enrollments")
        .select("id,customer_id").eq("batch_id", batchId);
      const custIds = Array.from(new Set((enrs || []).map((e: any) => e.customer_id)));
      const enrIds = (enrs || []).map((e: any) => e.id);
      if (custIds.length === 0) { toast("مفيش عملاء في الباتش ده"); setBusy(false); return; }

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

      // 5) تجميع حسب الافييليت
      type Row = { code: string; name: string; disc: number; count: number; total: number; refunded: number; lines: string[] };
      const groups = new Map<string, Row>();
      for (const c of (custs || []) as any[]) {
        const code = (c.affiliate_code || "").trim();
        if (!code) continue;
        const a = affName(code);
        if (!groups.has(code)) groups.set(code, { code, name: a?.name || "—", disc: a?.discount || 0, count: 0, total: 0, refunded: 0, lines: [] });
        const g = groups.get(code)!;
        const isRef = refundedSet.has(c.id);
        const paid = paidByCust.get(c.id) || 0;
        if (isRef) { g.refunded++; g.lines.push(`${c.name},${paid},ريفند`); }
        else { g.count++; g.total += paid; g.lines.push(`${c.name},${paid},نشط`); }
      }

      // 6) CSV
      const batchCode = batches.find((b) => b.id === batchId)?.code || batchId;
      let csv = "\uFEFF"; // BOM للعربي في Excel
      csv += `تصدير الأفيلييت — باتش ${batchCode}\n\n`;
      for (const g of Array.from(groups.values())) {
        csv += `الأفيلييت,${g.name} (${g.code}),نسبة الخصم,${g.disc}%\n`;
        csv += `عدد العملاء النشطين,${g.count},إجمالي المدفوع,${g.total},عدد الريفند,${g.refunded}\n`;
        csv += `اسم العميل,المدفوع,الحالة\n`;
        csv += g.lines.join("\n") + "\n\n";
      }
      if (groups.size === 0) csv += "مفيش عملاء بكود أفيلييت في الباتش ده\n";

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `affiliates-${batchCode}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast("تم التصدير");
    } catch {
      toast("تعذّر التصدير");
    }
    setBusy(false);
  }

  return (
    <div className="card" style={{ padding: 18, marginTop: 16 }}>
      <div className="sec-t" style={{ marginTop: 0 }}>تصدير الأفيلييت لكل باتش</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        اختر الباتش وحمّل Excel: نسبة الخصم، عدد العملاء، إجمالي المدفوع، والريفند بيتشال من الإجمالي ومتعلّم.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <select className="inp" style={{ flex: 1 }} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">— اختر الباتش —</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <button className="btn" onClick={exportCsv} disabled={busy} style={{ height: 40 }}>{busy ? "..." : "تصدير Excel"}</button>
      </div>
    </div>
  );
}
