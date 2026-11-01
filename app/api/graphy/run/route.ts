import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// لكل عميل: إنشاء learner (لو مش موجود) ثم enroll على الكورس. بيرجّع نتيجة كل عميل.
export async function POST(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_message, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_message) return NextResponse.json({ error: "مالكش صلاحية" }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const { customer_ids, course_id } = b || {};
  if (!Array.isArray(customer_ids) || !customer_ids.length) return NextResponse.json({ error: "مفيش عملاء" }, { status: 400 });
  if (!course_id) return NextResponse.json({ error: "اختَر كورس" }, { status: 400 });
  if (customer_ids.length > 300) return NextResponse.json({ error: "الحد 300 في الطلب" }, { status: 400 });

  const mid = (process.env.GRAPHY_MID || "").trim();
  const key = (process.env.GRAPHY_API_TOKEN || "").trim();
  if (!mid || !key) return NextResponse.json({ error: "إعدادات Graphy ناقصة في Vercel" }, { status: 500 });
  const base = "https://api.ongraphy.com";

  const { data: custs } = await supabase.from("customers").select("id,name,email").in("id", customer_ids);
  const byId = new Map(((custs as any[]) || []).map((c) => [c.id, c]));
  const list = customer_ids.map((id: string) => byId.get(id)).filter(Boolean) as any[];

  const results: { id: string; name: string; email: string; ok: boolean; reason: string }[] = [];
  const one = async (c: any) => {
    const name = String(c.name || "").trim();
    const email = String(c.email || "").trim();
    if (!email) { results.push({ id: c.id, name, email: "", ok: false, reason: "مفيش إيميل" }); return; }
    let createReason = "";
    try {
      const f = new URLSearchParams({ mid, key, email, name: name || email, sendEmail: "true" });
      const r = await fetch(`${base}/public/v1/learners`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
      const j: any = await r.json().catch(() => null);
      if (j?.error && Number(j.error.code) !== 22) createReason = j.error.message || ""; // 22 = موجود بالفعل = تمام
    } catch (e: any) { createReason = e?.message || ""; }
    try {
      const f = new URLSearchParams({ mid, key, email, productId: course_id });
      const r = await fetch(`${base}/public/v1/assign`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
      const j: any = await r.json().catch(() => null);
      if (r.ok && (j?.status === "success" || j?.success === true)) results.push({ id: c.id, name, email, ok: true, reason: "" });
      else { const reason = j?.error?.message || j?.message || (typeof j?.status === "string" ? j.status : "") || createReason || `HTTP ${r.status}`; results.push({ id: c.id, name, email, ok: false, reason: String(reason).slice(0, 160) }); }
    } catch (e: any) { results.push({ id: c.id, name, email, ok: false, reason: (createReason ? createReason + " · " : "") + (e?.message || "assign failed") }); }
  };

  const CONC = 5;
  for (let i = 0; i < list.length; i += CONC) await Promise.all(list.slice(i, i + CONC).map(one));
  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, results, sent, failed: results.length - sent });
}
