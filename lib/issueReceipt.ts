// دالة مشتركة: إصدار الإيصال + توليد PDF + رفعه + إرساله تلقائياً (واتساب + إيميل) في خطوة واحدة
import { NIQAT_LOGO, NIQAT_STAMP } from "@/lib/receiptAssets";

const nf = new Intl.NumberFormat("en-US");

function receiptHtml(d: any): string {
  const dt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(d.issued_at)).replace(",", " —");
  const isInst = d.pay_kind !== "full";
  const payType = isInst ? `قسط — الدفعة ${d.installment_no} من ${d.installment_total}` : "دفع كامل (كاش — بدون أقساط)";
  const amtLabel = isInst ? "المبلغ المدفوع (هذا القسط)" : "المبلغ المدفوع (كامل)";
  const remain = (isInst && d.remaining != null && d.remaining > 0)
    ? `<div class="remain"><span>المتبقّي على العميل</span><span class="a">${nf.format(Math.round(d.remaining))} ${d.currency}</span></div>` : "";
  return `<div class="sheet"><div class="rb"></div>
  <div class="head"><img class="logo" src="${NIQAT_LOGO}"><div class="rcpt-meta"><div class="t">إيصال رقم</div><div class="no">${d.receipt_no}</div><div class="dt">${dt}</div></div></div>
  <div class="divider"></div>
  <div class="title-row"><h1>إيصال دفع</h1><div class="paidtag">✓ مدفوع</div></div>
  <div class="rows">
    <div class="r"><span class="k">اسم العميل</span><span class="v ltr">${d.customer_name || "-"}</span></div>
    <div class="r"><span class="k">رقم الهاتف</span><span class="v ltr">${d.phone || "-"}</span></div>
    <div class="r"><span class="k">الخدمة / الدبلومة</span><span class="v">${d.service_label || "-"}</span></div>
    ${d.batch_code ? `<div class="r"><span class="k">الباتش</span><span class="v ltr">${d.batch_code}</span></div>` : ""}
    ${d.pay_method ? `<div class="r"><span class="k">طريقة الدفع</span><span class="v">${d.pay_method}</span></div>` : ""}
    <div class="r hl"><span class="k">نوع الدفعة</span><span class="v">${payType}</span></div>
  </div>
  <div class="amount-box"><span class="l">${amtLabel}</span><span class="a">${nf.format(Math.round(d.amount))}<span class="cur">${d.currency}</span></span></div>
  ${remain}
  <div class="stampwrap"><img src="${NIQAT_STAMP}"></div>
  <div class="foot"><div class="thanks">شكراً لثقتك في نقاط 🧡</div>
    <div class="ct">niqatglobal.com · info@niqatcrm.com<br>دعم العملاء (واتساب): wa.me/201000794484</div>
    <div class="seal">هذا الإيصال صادر إلكترونياً من نظام نقاط ولا يحتاج توقيعاً</div></div>
  <div class="perf"></div></div>`;
}
const CSS = `:root{--surface:#fff;--ink:#15223B;--text:#2B3752;--muted:#6E7891;--line:#ECEDF1;--brand:#F58220;--brand-d:#D6741A;--brand-soft:#FDEFDF;--green:#2E9E6B}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Tajawal','Segoe UI',sans-serif}
.sheet{width:470px;background:#fff;border-radius:18px;overflow:hidden;position:relative}
.rb{height:7px;background:linear-gradient(90deg,#F58220,#D6741A)}
.head{padding:24px 30px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.head img.logo{height:46px}
.rcpt-meta{text-align:left}.rcpt-meta .t{font-size:10.5px;font-weight:800;color:#6E7891;letter-spacing:.06em}
.rcpt-meta .no{font-weight:700;color:#15223B;font-size:14px;margin-top:3px;direction:ltr}.rcpt-meta .dt{font-size:11px;color:#6E7891;margin-top:4px;direction:ltr}
.divider{height:1px;background:#ECEDF1;margin:0 30px}
.title-row{padding:18px 30px 2px;display:flex;align-items:center;justify-content:space-between}.title-row h1{font-size:17px;font-weight:800;color:#15223B}
.paidtag{color:#2E9E6B;font-weight:900;font-size:14px}
.rows{padding:10px 30px 4px}.r{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #ECEDF1}
.r .k{font-size:12.5px;color:#6E7891;font-weight:600}.r .v{font-size:13.5px;color:#15223B;font-weight:700;text-align:left}.r .v.ltr{direction:ltr}.r.hl .v{color:#D6741A}
.amount-box{margin:16px 30px 0;background:#15223B;border-radius:14px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;color:#fff}
.amount-box .l{font-size:12.5px;font-weight:700;opacity:.8}.amount-box .a{font-weight:700;font-size:25px;direction:ltr}.amount-box .a .cur{font-size:13px;opacity:.7;margin-inline-start:4px}
.remain{margin:9px 30px 0;display:flex;align-items:center;justify-content:space-between;font-size:12px;background:#FDEFDF;border-radius:10px;padding:9px 16px;color:#D6741A;font-weight:700}.remain .a{direction:ltr}
.stampwrap{position:relative;height:0}.stampwrap img{position:absolute;left:30px;top:-6px;width:150px;opacity:.9;transform:rotate(-8deg)}
.foot{padding:30px 30px 26px;text-align:center}.foot .thanks{font-size:13px;font-weight:700;color:#15223B;margin-bottom:8px}
.foot .ct{font-size:11px;color:#6E7891;line-height:1.8;direction:ltr}.foot .seal{margin-top:14px;font-size:10px;color:#6E7891;border-top:1px solid #ECEDF1;padding-top:12px}
.perf{height:16px;background:radial-gradient(circle at 8px -4px, transparent 8px, #F6F6F3 9px) repeat-x;background-size:16px 16px}`;

async function loadHtml2pdf(): Promise<any> {
  if ((window as any).html2pdf) return (window as any).html2pdf;
  await new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"; s.onload = () => res(); s.onerror = () => rej(new Error("pdf lib load failed")); document.head.appendChild(s); });
  return (window as any).html2pdf;
}

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
    const d = j;
    // توليد PDF
    const html2pdf = await loadHtml2pdf();
    const wrap = document.createElement("div");
    wrap.innerHTML = `<style>${CSS}</style>` + receiptHtml(d);
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;background:#fff";
    document.body.appendChild(wrap);
    const sheet = wrap.querySelector(".sheet") as HTMLElement;
    const blob: Blob = await html2pdf().set({ margin: 0, image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: "px", format: [470, sheet.offsetHeight + 4], orientation: "portrait" } }).from(sheet).outputPdf("blob");
    document.body.removeChild(wrap);
    // رفع للـbucket
    const path = `${a.customerId}/${d.receipt_no}.pdf`;
    let pdfUrl = "";
    const { error: upErr } = await supabase.storage.from("receipts-pdf").upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (!upErr) {
      await supabase.from("receipts_issued").update({ pdf_url: path }).eq("id", d.id);
      const { data: signed } = await supabase.storage.from("receipts-pdf").createSignedUrl(path, 3600);
      if (signed?.signedUrl) pdfUrl = signed.signedUrl;
    }
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
