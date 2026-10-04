"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { NIQAT_LOGO, NIQAT_STAMP } from "@/lib/receiptAssets";

type RData = {
  id: string; receipt_no: string; customer_name: string; phone: string; service_label: string;
  batch_code: string; amount: number; currency: string; pay_kind: string;
  installment_no: number; installment_total: number; remaining: number | null; pay_method: string; issued_at: string;
};

const nf = new Intl.NumberFormat("en-US");

// بناء HTML الإيصال من الـJSON (نفس تصميم الموك المعتمد)
function receiptHtml(d: RData): string {
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
    <div class="ct">niqatglobal.com · info@niqat.com<br>دعم العملاء (واتساب): wa.me/201000794484</div>
    <div class="seal">هذا الإيصال صادر إلكترونياً من نظام نقاط ولا يحتاج توقيعاً</div></div>
  <div class="perf"></div></div>`;
}
const CSS = `
:root{--surface:#fff;--ink:#15223B;--text:#2B3752;--muted:#6E7891;--line:#ECEDF1;--brand:#F58220;--brand-d:#D6741A;--brand-soft:#FDEFDF;--green:#2E9E6B}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Tajawal','Segoe UI',sans-serif}
.sheet{width:470px;background:#fff;border-radius:18px;overflow:hidden;position:relative}
.rb{height:7px;background:linear-gradient(90deg,#F58220,#D6741A)}
.head{padding:24px 30px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.head img.logo{height:46px}
.rcpt-meta{text-align:left}.rcpt-meta .t{font-size:10.5px;font-weight:800;color:#6E7891;letter-spacing:.06em}
.rcpt-meta .no{font-weight:700;color:#15223B;font-size:14px;margin-top:3px;direction:ltr}
.rcpt-meta .dt{font-size:11px;color:#6E7891;margin-top:4px;direction:ltr}
.divider{height:1px;background:#ECEDF1;margin:0 30px}
.title-row{padding:18px 30px 2px;display:flex;align-items:center;justify-content:space-between}
.title-row h1{font-size:17px;font-weight:800;color:#15223B}
.paidtag{color:#2E9E6B;font-weight:900;font-size:14px}
.rows{padding:10px 30px 4px}
.r{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px dashed #ECEDF1}
.r .k{font-size:12.5px;color:#6E7891;font-weight:600}.r .v{font-size:13.5px;color:#15223B;font-weight:700;text-align:left}
.r .v.ltr{direction:ltr}.r.hl .v{color:#D6741A}
.amount-box{margin:16px 30px 0;background:#15223B;border-radius:14px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;color:#fff}
.amount-box .l{font-size:12.5px;font-weight:700;opacity:.8}.amount-box .a{font-weight:700;font-size:25px;direction:ltr}
.amount-box .a .cur{font-size:13px;opacity:.7;margin-inline-start:4px}
.remain{margin:9px 30px 0;display:flex;align-items:center;justify-content:space-between;font-size:12px;background:#FDEFDF;border-radius:10px;padding:9px 16px;color:#D6741A;font-weight:700}
.remain .a{direction:ltr}
.stampwrap{position:relative;height:0}.stampwrap img{position:absolute;left:30px;top:-6px;width:150px;opacity:.9;transform:rotate(-8deg)}
.foot{padding:30px 30px 26px;text-align:center}.foot .thanks{font-size:13px;font-weight:700;color:#15223B;margin-bottom:8px}
.foot .ct{font-size:11px;color:#6E7891;line-height:1.8;direction:ltr}
.foot .seal{margin-top:14px;font-size:10px;color:#6E7891;border-top:1px solid #ECEDF1;padding-top:12px}
.perf{height:16px;background:radial-gradient(circle at 8px -4px, transparent 8px, #F6F6F3 9px) repeat-x;background-size:16px 16px}`;

async function loadHtml2pdf(): Promise<any> {
  if ((window as any).html2pdf) return (window as any).html2pdf;
  await new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"; s.onload = () => res(); s.onerror = () => rej(new Error("pdf lib load failed")); document.head.appendChild(s); });
  return (window as any).html2pdf;
}

export default function ReceiptIssuer({ customerId, refId, refType, amount, currency, payMethod, payKind, customerEmail, customerPhone }: {
  customerId: string; refId: string; refType: "installment" | "addon"; amount: number; currency: string;
  payMethod?: string; payKind?: "installment" | "full"; customerEmail?: string; customerPhone?: string;
}) {
  const tr = useT();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState("");
  const [data, setData] = useState<RData | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");

  async function issue() {
    setBusy("issue");
    try {
      const { data: j, error } = await supabase.rpc("issue_receipt", {
        p_customer_id: customerId, p_kind: payKind || "installment", p_ref_id: refId,
        p_amount: amount, p_currency: currency, p_pay_method: payMethod || "", p_ref_type: refType,
      });
      if (error) { toast(error.message); setBusy(""); return; }
      const d = j as RData; setData(d);
      // توليد الـPDF
      const html2pdf = await loadHtml2pdf();
      const wrap = document.createElement("div");
      wrap.innerHTML = `<style>${CSS}</style>` + receiptHtml(d);
      wrap.style.cssText = "position:fixed;left:-9999px;top:0;background:#fff";
      document.body.appendChild(wrap);
      const blob: Blob = await html2pdf().set({ margin: 0, image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: "px", format: [470, wrap.firstElementChild ? (wrap.querySelector(".sheet") as HTMLElement).offsetHeight + 4 : 700], orientation: "portrait" } }).from(wrap.querySelector(".sheet")).outputPdf("blob");
      document.body.removeChild(wrap);
      // رفع للـbucket
      const path = `${customerId}/${d.receipt_no}.pdf`;
      const { error: upErr } = await supabase.storage.from("receipts-pdf").upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (!upErr) {
        await supabase.from("receipts_issued").update({ pdf_url: path }).eq("id", d.id);
        const { data: signed } = await supabase.storage.from("receipts-pdf").createSignedUrl(path, 3600);
        if (signed?.signedUrl) setPdfUrl(signed.signedUrl);
      }
      toast(tr("receiptIssued"));
    } catch (e: any) { toast(e?.message || tr("errorGeneric")); }
    setBusy("");
  }

  async function send(channel: "email" | "whatsapp") {
    if (!data) return;
    setBusy(channel);
    try {
      const r = await fetch("/api/receipts/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: data.id, channel, email: customerEmail, whatsapp: customerPhone || data.phone,
          pdf_url: `${customerId}/${data.receipt_no}.pdf`, receipt_no: data.receipt_no, customer_name: data.customer_name,
          service_label: data.service_label, amount_label: `${nf.format(Math.round(data.amount))} ${data.currency}`,
        }),
      });
      const j = await r.json();
      if (!r.ok) toast(j.error || tr("sendFailed"));
      else toast(channel === "email" ? tr("receiptEmailSent") : tr("receiptWaSent"));
    } catch { toast(tr("sendFailed")); }
    setBusy("");
  }

  return (
    <div>
      <button className="btn" onClick={() => setOpen(true)} style={{ height: 36 }}>🧾 {tr("issueReceiptBtn")}</button>
      {open && (
        <div onClick={() => !busy && setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(21,34,59,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", border: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>🧾 {tr("issueReceiptBtn")}</h3>
            {!data ? (
              <>
                <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 14, lineHeight: 1.8 }}>
                  {tr("receiptConfirmHint")}<br />
                  <b className="num" dir="ltr">{nf.format(Math.round(amount))} {currency}</b>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 16, cursor: "pointer" }}>
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--brand)" }} />
                  {tr("receiptConfirmCheck")}
                </label>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn ghost" onClick={() => setOpen(false)}>{tr("cancel")}</button>
                  <button className="btn" onClick={issue} disabled={!confirmed || busy === "issue"}>{busy === "issue" ? "..." : tr("payOkIssue")}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "var(--green-soft)", color: "var(--green)", fontWeight: 700, fontSize: 13, padding: "10px 14px", borderRadius: 10, marginBottom: 14 }}>
                  ✓ {tr("receiptIssued")} — <span className="num" dir="ltr">{data.receipt_no}</span>
                </div>
                {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}>👁 {tr("previewDownloadReceipt")}</a>}
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{tr("sendReceiptVia")}:</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => send("email")} disabled={!!busy || !customerEmail}>{busy === "email" ? "..." : "✉️ " + tr("emailWord")}</button>
                  <button className="btn" style={{ flex: 1, background: "#25D366", borderColor: "#25D366" }} onClick={() => send("whatsapp")} disabled={!!busy}>{busy === "whatsapp" ? "..." : "📱 " + tr("whatsappWord")}</button>
                </div>
                {!customerEmail && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>⚠ {tr("noEmailForReceipt")}</div>}
                <button className="btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setOpen(false); setData(null); setConfirmed(false); setPdfUrl(""); }}>{tr("done2")}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
