import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

function normNum(p: string) {
  let d = (p || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "20" + d.slice(1);
  return d;
}

export async function POST(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // صلاحية: رؤية الحملة (أو أدمن) + صلاحية الإرسال
  const { data: me } = await supabase.from("profiles").select("can_view_campaign, can_message, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_view_campaign) return NextResponse.json({ error: "مالكش صلاحية الحملة" }, { status: 403 });
  if (!isAdmin && !me?.can_message) return NextResponse.json({ error: "مالكش صلاحية إرسال واتساب" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const { registration_ids, template_name, channel } = body || {};
  if (!Array.isArray(registration_ids) || registration_ids.length === 0) return NextResponse.json({ error: "مفيش تسجيلات مختارة" }, { status: 400 });
  if (!template_name) return NextResponse.json({ error: "اختَر قالب الأول" }, { status: 400 });
  if (registration_ids.length > 1000) return NextResponse.json({ error: "الحد الأقصى 1000 في المرة" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel" }, { status: 500 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: row } = await admin.from("app_settings").select("value").eq("key", "wati").maybeSingle();
  const wati: any = row?.value || {};
  const endpoint = String(wati.endpoint || "").replace(/\/+$/, "");
  const token = String(wati.token || "").replace(/^\s*bearer\s+/i, "").trim();
  const sender = channel === "support" ? (wati.sender_support || wati.sender) : (wati.sender_sales || wati.sender);
  if (!endpoint || !token) return NextResponse.json({ error: "إعدادات WATI ناقصة" }, { status: 400 });
  const senderCh = String(sender || "").replace(/[^\d]/g, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // نقرا التسجيلات المختارة (service role)
  const { data: regs } = await admin.rpc("campaign_pick_svc", { p_ids: registration_ids });
  const targets = ((regs as any[]) || []).filter((r) => r.whatsapp).map((r) => ({
    name: String(r.full_name || "").trim().split(/\s+/).slice(0, 2).join(" "), num: normNum(r.whatsapp),
  })).filter((t) => t.num);

  let sent = 0, failed = 0;
  const BATCH = 8;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    await Promise.all(slice.map(async (t) => {
      try {
        const apiUrl = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${t.num}${senderCh ? `&channelPhoneNumber=${senderCh}` : ""}`;
        const r = await fetch(apiUrl, {
          method: "POST", headers,
          body: JSON.stringify({ template_name, broadcast_name: template_name, parameters: [{ name: "1", value: t.name }] }),
        });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok && j?.result !== false) sent++; else failed++;
      } catch { failed++; }
    }));
  }
  return NextResponse.json({ ok: true, sent, failed, total: targets.length });
}
