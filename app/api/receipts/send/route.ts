import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

function normNum(p: string) { let d = (p || "").replace(/[^\d]/g, ""); if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0")) d = "20" + d.slice(1); return d; }

export async function POST(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_issue_receipts,team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_issue_receipts) return NextResponse.json({ error: "مالكش صلاحية إصدار الإيصالات" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const { receipt_id, channel, email, whatsapp, pdf_url, receipt_no, customer_name, service_label, amount_label } = body || {};
  if (!receipt_id || !channel) return NextResponse.json({ error: "ناقص بيانات" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel" }, { status: 500 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    if (channel === "email") {
      const brevoKey = process.env.BREVO_API_KEY;
      if (!brevoKey) return NextResponse.json({ error: "BREVO_API_KEY مش متضاف في Vercel" }, { status: 500 });
      if (!email) return NextResponse.json({ error: "مفيش إيميل للعميل" }, { status: 400 });
      // نحمّل الـPDF ونبعته كمرفق base64
      let attachB64 = "";
      try {
        const path = pdf_url?.includes("/receipts-pdf/") ? pdf_url.split("/receipts-pdf/")[1].split("?")[0] : pdf_url;
        const { data: file } = await admin.storage.from("receipts-pdf").download(path);
        if (file) { const buf = Buffer.from(await file.arrayBuffer()); attachB64 = buf.toString("base64"); }
      } catch { }
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST", headers: { "api-key": brevoKey, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "Niqat", email: "info@niqat.com" },
          to: [{ email, name: customer_name || "" }],
          subject: `إيصال الدفع ${receipt_no || ""} — نقاط`,
          htmlContent: `<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif"><p>مرحباً ${customer_name || ""},</p><p>مرفق إيصال الدفع رقم <b>${receipt_no || ""}</b> للخدمة: ${service_label || ""} بمبلغ ${amount_label || ""}.</p><p>شكراً لثقتك في نقاط 🧡<br>niqatglobal.com · info@niqat.com</p></div>`,
          ...(attachB64 ? { attachment: [{ content: attachB64, name: `${receipt_no || "receipt"}.pdf` }] } : {}),
        }),
      });
      if (!r.ok) { const t = await r.text(); return NextResponse.json({ error: "فشل إرسال الإيميل: " + t.slice(0, 200) }, { status: 400 }); }
      await admin.rpc("mark_receipt_sent", { p_id: receipt_id, p_channel: "email" });
      return NextResponse.json({ ok: true });
    }

    if (channel === "whatsapp") {
      const { data: wrow } = await admin.from("app_settings").select("value").eq("key", "wati").maybeSingle();
      const wati: any = wrow?.value || {};
      const endpoint = String(wati.endpoint || "").replace(/\/+$/, "");
      let token = String(wati.token || ""); if (!/^bearer /i.test(token)) token = "Bearer " + token;
      const num = normNum(whatsapp || "");
      if (!endpoint || !num) return NextResponse.json({ error: "إعدادات WATI أو رقم العميل ناقص" }, { status: 400 });
      const r = await fetch(`${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${num}`, {
        method: "POST", headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({
          template_name: "niqat_payment_receipt", broadcast_name: "niqat_payment_receipt",
          parameters: [
            { name: "1", value: customer_name || "" }, { name: "2", value: receipt_no || "" },
            { name: "3", value: service_label || "" }, { name: "4", value: amount_label || "" },
          ],
        }),
      });
      const j: any = await r.json().catch(() => ({}));
      // القالب لسه Pending → رسالة واضحة من غير كسر
      if (!r.ok || j?.result === false) {
        const info = (j?.info || JSON.stringify(j) || "").toString();
        if (/template|not approved|pending|does not exist/i.test(info))
          return NextResponse.json({ error: "قالب الواتساب (niqat_payment_receipt) لسه تحت الموافقة أو مش معتمد — الإيميل شغّال عادي" }, { status: 400 });
        return NextResponse.json({ error: "فشل إرسال الواتساب: " + info.slice(0, 180) }, { status: 400 });
      }
      await admin.rpc("mark_receipt_sent", { p_id: receipt_id, p_channel: "whatsapp" });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "قناة غير معروفة" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: "خطأ: " + (e?.message || "").slice(0, 180) }, { status: 500 });
  }
}
