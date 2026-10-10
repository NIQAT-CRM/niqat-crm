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
  const { data: me } = await supabase.from("profiles").select("can_view_campaign, can_message, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_view_campaign) return NextResponse.json({ error: "مالكش صلاحية الحملة" }, { status: 403 });
  if (!isAdmin && !me?.can_message) return NextResponse.json({ error: "مالكش صلاحية إرسال واتساب" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const { registration_ids, template_name, channel, params } = body || {};
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

  const { data: regs } = await admin.rpc("campaign_pick_svc", { p_ids: registration_ids });
  const targets = ((regs as any[]) || []).filter((r) => r.whatsapp).map((r) => ({
    name: String(r.full_name || "").trim().split(/\s+/).slice(0, 2).join(" "),
    num: normNum(r.whatsapp),
    country: String(r.country || ""),
    spec: String(r.specialization || ""),
  })).filter((t) => t.num);

  // نبني متغيّرات القالب حسب متغيّراته الفعلية (زي بحث العملاء) — مش متغيّر ثابت
  const plist: string[] = Array.isArray(params) ? params.map((p: any) => String(p)) : ["1"];
  const buildParams = (t: { name: string; num: string; country: string; spec: string }) =>
    plist.map((p, idx) => {
      const key = String(p).toLowerCase();
      let value = t.name;
      if (/country|بلد|دول/.test(key)) value = t.country || t.name;
      else if (/spec|تخصص|major/.test(key)) value = t.spec || t.name;
      else if (/phone|whats|mobile|رقم/.test(key)) value = t.num;
      else if (/name|اسم/.test(key) || key === "1" || idx === 0) value = t.name;
      return { name: p || String(idx + 1), value: value || t.name };
    });

  let sent = 0, failed = 0;
  const reasons = new Set<string>();
  const BATCH = 8;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.slice(i, i + BATCH);
    await Promise.all(slice.map(async (t) => {
      try {
        const apiUrl = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${t.num}${senderCh ? `&channelPhoneNumber=${senderCh}` : ""}`;
        const r = await fetch(apiUrl, {
          method: "POST", headers,
          body: JSON.stringify({ template_name, broadcast_name: template_name, parameters: buildParams(t), channel_number: senderCh, channelNumber: senderCh, channelPhoneNumber: senderCh }),
        });
        const j: any = await r.json().catch(() => ({}));
        if (r.ok && j?.result !== false) sent++;
        else {
          failed++;
          const reason = j?.info || j?.message || j?.error || (typeof j?.result === "string" ? j.result : "") || `HTTP ${r.status}`;
          if (reason) reasons.add(String(reason).slice(0, 180));
        }
      } catch (e: any) { failed++; if (e?.message) reasons.add(String(e.message).slice(0, 180)); }
    }));
  }
  return NextResponse.json({ ok: true, sent, failed, total: targets.length, reasons: Array.from(reasons).slice(0, 3) });
}
