// HTML كامل للإيصال (للتوليد على السيرفر عبر Puppeteer) — عربي RTL + خط Tajawal
import { NIQAT_LOGO, NIQAT_STAMP } from "@/lib/receiptAssets";

const nf = new Intl.NumberFormat("en-US");

export function receiptHtmlDoc(d: any): string {
  const dt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(d.issued_at)).replace(",", " —");
  const isFree = d.pay_kind === "free";
  const isInst = d.pay_kind !== "full" && !isFree;
  const payType = isFree ? "اشتراك هدية — مجاناً 🎁 (Gift)" : (isInst ? `قسط — الدفعة ${d.installment_no} من ${d.installment_total}` : "دفع كامل (كاش — بدون أقساط)");
  const amtLabel = isFree ? "قيمة الاشتراك" : (isInst ? "المبلغ المدفوع (هذا القسط)" : "المبلغ المدفوع (كامل)");
  const remain = (!isFree && isInst && d.remaining != null && d.remaining > 0)
    ? `<div class="remain"><span>المتبقّي على العميل</span><span class="a">${nf.format(Math.round(d.remaining))} ${d.currency}</span></div>` : "";
  const amtValue = isFree
    ? `<span class="a" style="font-size:18px">🎁 هدية — Free</span>`
    : `<span class="a">${nf.format(Math.round(d.amount))}<span class="cur">${d.currency}</span></span>`;
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#15223B;--text:#2B3752;--muted:#6E7891;--line:#ECEDF1;--brand:#F58220;--brand-d:#D6741A;--brand-soft:#FDEFDF;--green:#2E9E6B;--fa:'Tajawal',sans-serif;--fd:'Space Grotesk',sans-serif}
*{box-sizing:border-box;margin:0;padding:0;font-family:var(--fa);-webkit-font-smoothing:antialiased}
body{background:#fff}
.sheet{width:470px;background:#fff;position:relative;overflow:hidden}
.rb{height:7px;background:linear-gradient(90deg,var(--brand),var(--brand-d))}
.head{padding:24px 30px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.head img.logo{height:46px}
.rcpt-meta{text-align:left}.rcpt-meta .t{font-size:10.5px;font-weight:800;color:var(--muted);letter-spacing:.06em}
.rcpt-meta .no{font-family:var(--fd);font-weight:700;color:var(--ink);font-size:14px;margin-top:3px;direction:ltr}
.rcpt-meta .dt{font-family:var(--fd);font-size:11px;color:var(--muted);margin-top:4px;direction:ltr}
.divider{height:1px;background:var(--line);margin:0 30px}
.title-row{padding:18px 30px 2px;display:flex;align-items:center;justify-content:space-between}
.title-row h1{font-size:17px;font-weight:800;color:var(--ink)}
.paidtag{color:var(--green);font-weight:900;font-size:14px;display:flex;align-items:center;gap:6px}
.paidtag svg{width:16px;height:16px}
.rows{padding:10px 30px 4px}
.r{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px dashed var(--line)}
.r .k{font-size:12.5px;color:var(--muted);font-weight:600}.r .v{font-size:13.5px;color:var(--ink);font-weight:700;text-align:left}
.r .v.ltr{direction:ltr}.r.hl .v{color:var(--brand-d)}
.amount-box{margin:16px 30px 0;background:var(--ink);border-radius:14px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;color:#fff}
.amount-box .l{font-size:12.5px;font-weight:700;opacity:.8}.amount-box .a{font-family:var(--fd);font-weight:700;font-size:25px;direction:ltr}
.amount-box .a .cur{font-size:13px;opacity:.7;margin-inline-start:4px}
.remain{margin:9px 30px 0;display:flex;align-items:center;justify-content:space-between;font-size:12px;background:var(--brand-soft);border-radius:10px;padding:9px 16px;color:var(--brand-d);font-weight:700}
.remain .a{font-family:var(--fd);direction:ltr}
.stampwrap{position:relative;height:0}.stampwrap img{position:absolute;left:30px;top:-6px;width:150px;opacity:.9;transform:rotate(-8deg)}
.foot{padding:30px 30px 26px;text-align:center}.foot .thanks{font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px}
.foot .ct{font-size:11px;color:var(--muted);line-height:1.8;direction:ltr}
.foot .seal{margin-top:14px;font-size:10px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px}
.perf{height:16px;background:radial-gradient(circle at 8px -4px, transparent 8px, #F6F6F3 9px) repeat-x;background-size:16px 16px}
</style></head><body>
<div class="sheet"><div class="rb"></div>
  <div class="head"><img class="logo" src="${NIQAT_LOGO}"><div class="rcpt-meta"><div class="t">إيصال رقم</div><div class="no">${d.receipt_no}</div><div class="dt">${dt}</div></div></div>
  <div class="divider"></div>
  <div class="title-row"><h1>${isFree ? "إيصال اشتراك" : "إيصال دفع"}</h1><div class="paidtag">${isFree ? "🎁 هدية" : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>مدفوع`}</div></div>
  <div class="rows">
    <div class="r"><span class="k">اسم العميل</span><span class="v ltr">${d.customer_name || "-"}</span></div>
    <div class="r"><span class="k">رقم الهاتف</span><span class="v ltr">${d.phone || "-"}</span></div>
    <div class="r"><span class="k">الخدمة / الدبلومة</span><span class="v">${d.service_label || "-"}</span></div>
    ${d.batch_code ? `<div class="r"><span class="k">الباتش</span><span class="v ltr">${d.batch_code}</span></div>` : ""}
    ${d.pay_method ? `<div class="r"><span class="k">طريقة الدفع</span><span class="v">${d.pay_method}</span></div>` : ""}
    <div class="r hl"><span class="k">نوع الدفعة</span><span class="v">${payType}</span></div>
  </div>
  <div class="amount-box"><span class="l">${amtLabel}</span>${amtValue}</div>
  ${remain}
  <div class="stampwrap"><img src="${NIQAT_STAMP}"></div>
  <div class="foot"><div class="thanks">شكراً لثقتك في نقاط 🧡</div>
    <div class="ct">niqatglobal.com · info@niqat.com<br>دعم العملاء (واتساب): wa.me/201000794484</div>
    <div class="seal">هذا الإيصال صادر إلكترونياً من نظام نقاط ولا يحتاج توقيعاً</div></div>
  <div class="perf"></div></div>
</body></html>`;
}
