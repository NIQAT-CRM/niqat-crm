import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// روت تشخيص آمن: بيقول هل المفاتيح موجودة وشكلها سليم — من غير ما يكشف القيم.
// /api/graphy/test            → تشخيص المفاتيح فقط
// /api/graphy/test?email=..&course=..  → يجرّب الاتصال الفعلي بـGraphy
export async function GET(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("team").eq("id", user.id).maybeSingle();
  if ((me?.team || "").toLowerCase() !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

  const midRaw = process.env.GRAPHY_MID;
  const keyRaw = process.env.GRAPHY_API_TOKEN;

  // تشخيص آمن — من غير كشف القيم
  const shape = (v: string | undefined) => {
    if (v === undefined) return { present: false };
    const trimmed = v.trim();
    return {
      present: true,
      length: v.length,
      hasSpaces: v !== trimmed,                       // مسافة زيادة قبل/بعد؟
      first2: trimmed.slice(0, 2),                     // أول حرفين بس
      last2: trimmed.slice(-2),                        // آخر حرفين بس
      looksLikeToken: trimmed.length > 20,             // التوكن عادةً أطول من الـMID
    };
  };
  const diag = {
    GRAPHY_MID: shape(midRaw),
    GRAPHY_API_TOKEN: shape(keyRaw),
    hint: "لو واحد مش present → مش متضاف/محتاج Redeploy. لو hasSpaces=true → امسح المسافات. لو الـMID أطول من الـTOKEN → غالباً متبدلين.",
  };

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim();
  const course = (url.searchParams.get("course") || "").trim();
  if (!email || !course) return NextResponse.json({ diag }, { status: 200 });

  // اختبار الاتصال الفعلي (بنستخدم trim للأمان)
  const mid = (midRaw || "").trim();
  const key = (keyRaw || "").trim();
  if (!mid || !key) return NextResponse.json({ diag, error: "مفتاح ناقص" }, { status: 200 });
  const base = "https://api.ongraphy.com";
  const out: any = { diag, usingCourse: course, email };
  try {
    const q = encodeURIComponent(JSON.stringify({ email }));
    const r = await fetch(`${base}/public/v1/learners?mid=${encodeURIComponent(mid)}&key=${encodeURIComponent(key)}&limit=10&query=${q}`);
    out.find = { status: r.status, body: await r.json().catch(() => null) };
  } catch (e: any) { out.find = { error: e?.message }; }
  try {
    const form = new URLSearchParams({ mid, key, email, name: "Niqat Test", sendEmail: "true" });
    const r = await fetch(`${base}/public/v1/learners`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    out.create = { status: r.status, body: await r.json().catch(() => null) };
  } catch (e: any) { out.create = { error: e?.message }; }
  try {
    const form = new URLSearchParams({ mid, key, email, productId: course });
    const r = await fetch(`${base}/public/v1/assign`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
    out.assign = { status: r.status, body: await r.json().catch(() => null) };
  } catch (e: any) { out.assign = { error: e?.message }; }
  return NextResponse.json(out, { status: 200 });
}
