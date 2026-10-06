import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { waitUntil } from "@vercel/functions";

export const runtime = "nodejs";
export const maxDuration = 60;

// إصدار الإيصال (سريع) + توليد الـPDF والإرسال في الخلفية — المستخدم مايستناش
export async function POST(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_issue_receipts,team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_issue_receipts) return NextResponse.json({ error: "مالكش صلاحية إصدار الإيصالات" }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const { customerId, kind, refId, amount, currency, payMethod, refType, force, email, phone } = b || {};
  if (!customerId || !refId) return NextResponse.json({ error: "ناقص بيانات" }, { status: 400 });

  // 1) الإصدار كـ المستخدم نفسه (RLS + issued_by)
  const { data: j, error } = await supabase.rpc("issue_receipt", {
    p_customer_id: customerId, p_kind: kind || "installment", p_ref_id: refId,
    p_amount: amount || 0, p_currency: currency || "EGP", p_pay_method: payMethod || "",
    p_ref_type: refType || "installment", p_force: !!force,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const d: any = { ...j, customer_id: customerId, phone: (j as any)?.phone || phone || "" };

  // 2) التوليد + الإرسال في الخلفية (بعد ما نرجّع الرد)
  const origin = `https://${req.headers.get("host")}`;
  const cookie = req.headers.get("cookie") || "";
  const isFree = (kind || "") === "free";
  const amountLabel = isFree ? "هدية — Free" : `${new Intl.NumberFormat("en-US").format(Math.round(d.amount || 0))} ${d.currency}`;

  waitUntil((async () => {
    try {
      const pdfRes = await fetch(`${origin}/api/receipts/pdf`, {
        method: "POST", headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ receipt_id: d.id, data: d }),
      });
      const pj = await pdfRes.json().catch(() => ({} as any));
      const path = pj?.path || `${customerId}/${d.receipt_no}.pdf`;
      // إرسال قناة مع إعادة محاولة واحدة
      const sendOne = async (channel: string) => {
        const payload = { receipt_id: d.id, channel, email, whatsapp: phone || d.phone, pdf_url: path, receipt_no: d.receipt_no, customer_name: d.customer_name, service_label: d.service_label, amount_label: amountLabel };
        for (let i = 0; i < 2; i++) {
          try { const r = await fetch(`${origin}/api/receipts/send`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(payload) }); if (r.ok) return; } catch { }
          await new Promise((res) => setTimeout(res, 1500));
        }
      };
      const tasks: Promise<void>[] = [];
      if (email) tasks.push(sendOne("email"));
      tasks.push(sendOne("whatsapp"));
      await Promise.all(tasks); // إيميل + واتساب بالتوازي
    } catch { }
  })());

  return NextResponse.json({ ok: true, data: d });
}
