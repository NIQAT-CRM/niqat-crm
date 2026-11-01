import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// روت اختبار مؤقت (أدمن فقط).
// /api/graphy/test?products=1          → يجيب شكل قائمة كورسات Graphy
// /api/graphy/test?email=..&course=..  → يجرّب إنشاء + enroll
export async function GET(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("team").eq("id", user.id).maybeSingle();
  if ((me?.team || "").toLowerCase() !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

  const mid = (process.env.GRAPHY_MID || "").trim();
  const key = (process.env.GRAPHY_API_TOKEN || "").trim();
  if (!mid || !key) return NextResponse.json({ error: "GRAPHY keys missing" }, { status: 500 });
  const base = "https://api.ongraphy.com";
  const url = new URL(req.url);

  // --- قائمة الكورسات ---
  if (url.searchParams.get("products")) {
    try {
      const r = await fetch(`${base}/public/v1/products?mid=${encodeURIComponent(mid)}&key=${encodeURIComponent(key)}`);
      const body: any = await r.json().catch(() => null);
      // نرجّع الشكل الخام + عيّنة من أول 3 عناصر عشان نعرف أسماء الحقول
      const arr = Array.isArray(body) ? body : (body?.data || body?.products || body?.results || []);
      return NextResponse.json({
        status: r.status,
        topLevelKeys: body && !Array.isArray(body) ? Object.keys(body) : "(array)",
        count: Array.isArray(arr) ? arr.length : "?",
        sample: Array.isArray(arr) ? arr.slice(0, 3) : body,
      }, { status: 200 });
    } catch (e: any) { return NextResponse.json({ error: e?.message }, { status: 200 }); }
  }

  // --- اختبار إنشاء + enroll ---
  const email = (url.searchParams.get("email") || "").trim();
  const course = (url.searchParams.get("course") || "").trim();
  if (!email || !course) return NextResponse.json({ error: "محتاج ?products=1 أو ?email=&course=" }, { status: 400 });
  const out: any = { email, course };
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
