// دالة مشتركة: إصدار الإيصال + توليد PDF + رفعه + إرساله تلقائياً (واتساب + إيميل) في خطوة واحدة

const nf = new Intl.NumberFormat("en-US");

export type IssueArgs = {
  supabase: any; customerId: string; refId: string; refType: "installment" | "addon";
  amount: number; currency: string; payKind?: "installment" | "full"; payMethod?: string;
  email?: string; phone?: string; autoSend?: boolean; // autoSend=true → يبعت واتساب + إيميل تلقائياً
};
export type IssueResult = { ok: boolean; data?: any; pdfUrl?: string; sentEmail?: boolean; sentWa?: boolean; error?: string; sendNotes?: string[] };

export async function issueAndSendReceipt(a: IssueArgs): Promise<IssueResult> {
  const { supabase } = a;
  try {
    const { data: j, error } = await supabase.rpc("issue_receipt", {
      p_customer_id: a.customerId, p_kind: a.payKind || "installment", p_ref_id: a.refId,
      p_amount: a.amount, p_currency: a.currency, p_pay_method: a.payMethod || "", p_ref_type: a.refType,
    });
    if (error) return { ok: false, error: error.message };
    const d = { ...j, customer_id: a.customerId };
    // توليد الـPDF على السيرفر (Puppeteer) — عربي RTL مظبوط
    const path = `${a.customerId}/${d.receipt_no}.pdf`;
    let pdfUrl = "";
    try {
      const pr = await fetch("/api/receipts/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt_id: d.id, data: d }) });
      const pj = await pr.json();
      if (pr.ok && pj.signedUrl) pdfUrl = pj.signedUrl;
    } catch { }
    const res: IssueResult = { ok: true, data: d, pdfUrl, sendNotes: [] };
    if (a.autoSend) {
      const payload = (channel: string) => ({
        receipt_id: d.id, channel, email: a.email, whatsapp: a.phone || d.phone,
        pdf_url: path, receipt_no: d.receipt_no, customer_name: d.customer_name,
        service_label: d.service_label, amount_label: `${nf.format(Math.round(d.amount))} ${d.currency}`,
      });
      // إيميل
      if (a.email) {
        try { const r = await fetch("/api/receipts/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload("email")) }); const jj = await r.json(); if (r.ok) res.sentEmail = true; else res.sendNotes!.push("إيميل: " + (jj.error || "فشل")); } catch { res.sendNotes!.push("إيميل: فشل"); }
      } else res.sendNotes!.push("مفيش إيميل للعميل");
      // واتساب
      try { const r = await fetch("/api/receipts/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload("whatsapp")) }); const jj = await r.json(); if (r.ok) res.sentWa = true; else res.sendNotes!.push("واتساب: " + (jj.error || "فشل")); } catch { res.sendNotes!.push("واتساب: فشل"); }
    }
    return res;
  } catch (e: any) { return { ok: false, error: e?.message || "خطأ" }; }
}
