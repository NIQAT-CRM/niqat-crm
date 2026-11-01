import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// لكل عميل: إنشاء learner (لو مش موجود) ثم enroll على كل الكورسات المختارة.
// النتيجة: صف لكل (عميل × كورس).
export async function POST(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_use_graphy, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_use_graphy) return NextResponse.json({ error: "مالكش صلاحية Graphy" }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const { customer_ids, course_ids, course_titles, total_customers, run_id } = b || {};
  if (!Array.isArray(customer_ids) || !customer_ids.length) return NextResponse.json({ error: "مفيش عملاء" }, { status: 400 });
  if (!Array.isArray(course_ids) || !course_ids.length) return NextResponse.json({ error: "اختَر كورس على الأقل" }, { status: 400 });
  if (customer_ids.length > 100) return NextResponse.json({ error: "الحد 100 عميل في الطلب" }, { status: 400 });
  if (course_ids.length > 20) return NextResponse.json({ error: "الحد 20 كورس" }, { status: 400 });

  const mid = (process.env.GRAPHY_MID || "").trim();
  const key = (process.env.GRAPHY_API_TOKEN || "").trim();
  if (!mid || !key) return NextResponse.json({ error: "إعدادات Graphy ناقصة في Vercel" }, { status: 500 });
  const base = "https://api.ongraphy.com";

  const { data: custs } = await supabase.from("customers").select("id,name,email").in("id", customer_ids);
  const byId = new Map(((custs as any[]) || []).map((c) => [c.id, c]));
  const list = customer_ids.map((id: string) => byId.get(id)).filter(Boolean) as any[];

  // سجل العملية (هيدر) — يتعمل مرة واحدة في أول دفعة
  const titles: string[] = Array.isArray(course_titles) ? course_titles.map((t: any) => String(t)) : [];
  const titleOf = (cid: string) => titles[course_ids.indexOf(cid)] || cid;
  let runId: string | null = run_id || null;
  if (!runId) {
    const { data: hdr } = await supabase.from("graphy_runs").insert({
      actor_id: user.id, course_ids, course_titles: titles,
      customers_count: Number(total_customers) || customer_ids.length, total: 0, succeeded: 0, failed: 0,
    }).select("id").maybeSingle();
    runId = (hdr as any)?.id || null;
  }

  type Row = { id: string; name: string; email: string; course_id: string; ok: boolean; reason: string };
  const results: Row[] = [];

  const assignCourse = async (email: string, courseId: string, createReason: string) => {
    try {
      const f = new URLSearchParams({ mid, key, email, productId: courseId });
      const r = await fetch(`${base}/public/v1/assign`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
      const j: any = await r.json().catch(() => null);
      if (r.ok && (j?.status === "success" || j?.success === true)) return { ok: true, reason: "" };
      const reason = j?.error?.message || j?.message || (typeof j?.status === "string" ? j.status : "") || createReason || `HTTP ${r.status}`;
      return { ok: false, reason: String(reason).slice(0, 160) };
    } catch (e: any) { return { ok: false, reason: (createReason ? createReason + " · " : "") + (e?.message || "assign failed") }; }
  };

  const one = async (c: any) => {
    const name = String(c.name || "").trim();
    const email = String(c.email || "").trim();
    if (!email) { for (const cid of course_ids) results.push({ id: c.id, name, email: "", course_id: cid, ok: false, reason: "مفيش إيميل" }); return; }
    // إنشاء مرة واحدة للعميل
    let createReason = "";
    try {
      const f = new URLSearchParams({ mid, key, email, name: name || email, sendEmail: "true" });
      const r = await fetch(`${base}/public/v1/learners`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: f.toString() });
      const j: any = await r.json().catch(() => null);
      if (j?.error && Number(j.error.code) !== 22) createReason = j.error.message || "";
    } catch (e: any) { createReason = e?.message || ""; }
    // enroll على كل كورس
    for (const cid of course_ids) {
      const res = await assignCourse(email, cid, createReason);
      results.push({ id: c.id, name, email, course_id: cid, ok: res.ok, reason: res.reason });
    }
  };

  const CONC = 5;
  for (let i = 0; i < list.length; i += CONC) await Promise.all(list.slice(i, i + CONC).map(one));
  const sent = results.filter((r) => r.ok).length;

  // تسجيل التفاصيل + تحديث عدّادات الهيدر
  if (runId) {
    try {
      await supabase.from("graphy_run_items").insert(results.map((r) => ({
        run_id: runId, customer_id: r.id, name: r.name, email: r.email,
        course_id: r.course_id, course_title: titleOf(r.course_id), ok: r.ok, reason: r.reason,
      })));
      const { data: h } = await supabase.from("graphy_runs").select("total,succeeded,failed").eq("id", runId).maybeSingle();
      await supabase.from("graphy_runs").update({
        total: (((h as any)?.total) || 0) + results.length,
        succeeded: (((h as any)?.succeeded) || 0) + sent,
        failed: (((h as any)?.failed) || 0) + (results.length - sent),
      }).eq("id", runId);
    } catch { /* السجل best-effort */ }
  }

  return NextResponse.json({ ok: true, results, sent, failed: results.length - sent, run_id: runId });
}
