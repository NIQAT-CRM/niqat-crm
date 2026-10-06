// دالة مشتركة: إصدار الإيصال + توليد PDF + رفعه + إرساله تلقائياً (واتساب + إيميل)
// background=true → الإصدار لحظي والتوليد/الإرسال يكمّلوا في الخلفية على السيرفر

const nf = new Intl.NumberFormat("en-US");

export type IssueArgs = {
  supabase: any; customerId: string; refId: string; refType: "installment" | "addon" | "enrollment";
  amount: number; currency: string; payKind?: "installment" | "full" | "free"; payMethod?: string;
  email?: string; phone?: string; autoSend?: boolean; force?: boolean; background?: boolean;
};
export type IssueResult = { ok: boolean; data?: any; pdfUrl?: string; sentEmail?: boolean; sentWa?: boolean; error?: string; sendNotes?: string[]; background?: boolean };

const amountLabelOf = (d: any) => d?.pay_kind === "free" ? "هدية — Free" : `${nf.format(Math.round(d?.amount || 0))} ${d?.currency}`;

export async function issueAndSendReceipt(a: IssueArgs): Promise<IssueResult> {
  const { supabase } = a;
  // المسار السريع: الإصدار + التوليد/الإرسال في الخلفية
  if (a.background) {
    try {
      const r = await fetch("/api/receipts/issue-bg", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: a.customerId, kind: a.payKind || "installment", refId: a.refId,
          amount: a.amount, currency: a.currency, payMethod: a.payMethod || "",
          refType: a.refType, force: a.force || false, email: a.email, phone: a.phone,
        }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) return { ok: false, error: j?.error || `HTTP ${r.status}` };
      return { ok: true, data: j.data, background: true };
    } catch (e: any) { return { ok: false, error: e?.message || "فشل الإصدار" }; }
  }

  // المسار العادي (متزامن): يرجّع لينك الـPDF وحالة الإرسال
  try {
    const { data: j, error } = await supabase.rpc("issue_receipt", {
      p_customer_id: a.customerId, p_kind: a.payKind || "installment", p_ref_id: a.refId,
      p_amount: a.amount, p_currency: a.currency, p_pay_method: a.payMethod || "", p_ref_type: a.refType, p_force: a.force || false,
    });
    if (error) return { ok: false, error: error.message };
    const d = { ...j, customer_id: a.customerId };
    const path = `${a.customerId}/${d.receipt_no}.pdf`;
    let pdfUrl = ""; let pdfErr = "";
    try {
      const pr = await fetch("/api/receipts/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt_id: d.id, data: d }) });
      const pj = await pr.json();
      if (pr.ok && pj.signedUrl) pdfUrl = pj.signedUrl;
      else pdfErr = pj?.error || `HTTP ${pr.status}`;
    } catch (e: any) { pdfErr = e?.message || "fetch failed"; }
    const res: IssueResult = { ok: true, data: d, pdfUrl, sendNotes: [] };
    if (pdfErr) res.sendNotes!.push("PDF: " + pdfErr);
    if (a.autoSend) {
      const payload = (channel: string) => ({
        receipt_id: d.id, channel, email: a.email, whatsapp: a.phone || d.phone,
        pdf_url: path, receipt_no: d.receipt_no, customer_name: d.customer_name,
        service_label: d.service_label, amount_label: amountLabelOf(d),
      });
      const sendCh = async (channel: string, label: string) => {
        try { const r = await fetch("/api/receipts/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(channel)) }); const jj = await r.json(); if (r.ok) return { ok: true }; return { ok: false, note: `${label}: ${jj.error || "فشل"}` }; }
        catch { return { ok: false, note: `${label}: فشل` }; }
      };
      const jobs: Promise<{ ok: boolean; note?: string; ch: string }>[] = [];
      if (a.email) jobs.push(sendCh("email", "إيميل").then((x) => ({ ...x, ch: "email" }))); else res.sendNotes!.push("مفيش إيميل للعميل");
      jobs.push(sendCh("whatsapp", "واتساب").then((x) => ({ ...x, ch: "whatsapp" })));
      const outs = await Promise.all(jobs); // بالتوازي
      for (const o of outs) { if (o.ok) { if (o.ch === "email") res.sentEmail = true; else res.sentWa = true; } else if (o.note) res.sendNotes!.push(o.note); }
    }
    return res;
  } catch (e: any) { return { ok: false, error: e?.message || "خطأ" }; }
}

export type ResendArgs = {
  supabase: any; receiptId: string; receiptNo: string; customerId: string;
  amount: number; currency: string; serviceLabel?: string; payKind?: string;
  customerName?: string; email?: string; phone?: string;
};
// إعادة إرسال نفس الإيصال (نفس الـPDF) — إيميل + واتساب بالتوازي
export async function resendReceipt(a: ResendArgs): Promise<{ sentEmail: boolean; sentWa: boolean; notes: string[] }> {
  const path = `${a.customerId}/${a.receiptNo}.pdf`;
  const notes: string[] = []; let sentEmail = false, sentWa = false;
  let cname = a.customerName;
  if (!cname) { try { const { data } = await a.supabase.from("customers").select("name").eq("id", a.customerId).maybeSingle(); cname = (data as any)?.name || ""; } catch { } }
  const amtLabel = a.payKind === "free" ? "هدية — Free" : `${nf.format(Math.round(a.amount))} ${a.currency}`;
  const payload = (channel: string) => ({
    receipt_id: a.receiptId, channel, email: a.email, whatsapp: a.phone,
    pdf_url: path, receipt_no: a.receiptNo, customer_name: cname || "",
    service_label: a.serviceLabel || "", amount_label: amtLabel,
  });
  const sendCh = async (channel: string, label: string) => {
    try { const r = await fetch("/api/receipts/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(channel)) }); const j = await r.json(); if (r.ok) return { ok: true }; return { ok: false, note: `${label}: ${j.error || "فشل"}` }; }
    catch { return { ok: false, note: `${label}: فشل` }; }
  };
  const jobs: Promise<{ ok: boolean; note?: string; ch: string }>[] = [];
  if (a.email) jobs.push(sendCh("email", "إيميل").then((x) => ({ ...x, ch: "email" }))); else notes.push("مفيش إيميل للعميل");
  jobs.push(sendCh("whatsapp", "واتساب").then((x) => ({ ...x, ch: "whatsapp" })));
  const outs = await Promise.all(jobs);
  for (const o of outs) { if (o.ok) { if (o.ch === "email") sentEmail = true; else sentWa = true; } else if (o.note) notes.push(o.note); }
  return { sentEmail, sentWa, notes };
}
