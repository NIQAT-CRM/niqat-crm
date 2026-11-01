import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// روت اختبار مؤقت للتأكد من ربط Graphy (أدمن فقط). بيرجّع رد Graphy الخام.
// الاستخدام: /api/graphy/test?email=YOUR_EMAIL&course=COURSE_CODE
export async function GET(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("team").eq("id", user.id).maybeSingle();
  if ((me?.team || "").toLowerCase() !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim();
  const course = (url.searchParams.get("course") || "").trim();
  const name = (url.searchParams.get("name") || "Niqat Test").trim();
  if (!email || !course) return NextResponse.json({ error: "محتاج ?email= و ?course= في الرابط" }, { status: 400 });

  const mid = process.env.GRAPHY_MID;
  const key = process.env.GRAPHY_API_TOKEN;
  if (!mid || !key) return NextResponse.json({ error: "GRAPHY_MID أو GRAPHY_API_TOKEN مش متضافين في Vercel (أو لسه محتاج Redeploy)" }, { status: 500 });

  const base = "https://api.ongraphy.com";
  const out: any = { usingCourse: course, email };

  // 1) البحث عن learner بالإيميل
  try {
    const q = encodeURIComponent(JSON.stringify({ email }));
    const r = await fetch(`${base}/public/v1/learners?mid=${encodeURIComponent(mid)}&key=${encodeURIComponent(key)}&limit=10&query=${q}`);
    out.find = { status: r.status, body: await r.json().catch(() => null) };
  } catch (e: any) { out.find = { error: e?.message || "fetch failed" }; }

  // 2) إنشاء learner (form-urlencoded)
  try {
    const form = new URLSearchParams({ mid, key, email, name, sendEmail: "true" });
    const r = await fetch(`${base}/public/v1/learners`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    out.create = { status: r.status, body: await r.json().catch(() => null) };
  } catch (e: any) { out.create = { error: e?.message || "fetch failed" }; }

  // 3) الـEnroll (assign) على الكورس
  try {
    const form = new URLSearchParams({ mid, key, email, productId: course });
    const r = await fetch(`${base}/public/v1/assign`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    out.assign = { status: r.status, body: await r.json().catch(() => null) };
  } catch (e: any) { out.assign = { error: e?.message || "fetch failed" }; }

  return NextResponse.json(out, { status: 200 });
}
