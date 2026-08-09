import { redirect } from "next/navigation";
import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import EducationTree from "./EducationTree";

export const dynamic = "force-dynamic";

// شجرة التعليم: دبلومة ← باتشات (بعدد العملاء) ← توسيع لعرض العملاء الحاليين.
// بتقرا من edu_v_batches (بدون سعر) + edu_v_customers (بدون ماليات). enrollments مفيهاش أرقام مالية.
export default async function EducationPage() {
  const m = await requireEdu([], true); // أي شخص تعليمي (staff/admin/viewer)
  if (m.eduMode && m.role === "edu_grader") redirect("/education/grading");

  const supabase = createClient();
  const [dipRes, batRes, specRes] = await Promise.all([
    supabase.from("diplomas").select("id, name_ar, name_en").order("name_ar"),
    supabase.from("edu_v_batches").select("id, code, status, diploma_id, start_date, created_at").order("created_at", { ascending: false }),
    supabase.from("specialties").select("id, name_ar, name_en"),
  ]);

  const dips = (dipRes.data as any[]) || [];
  const batches = (batRes.data as any[]) || [];
  const specs = (specRes.data as any[]) || [];

  // عدد العملاء لكل باتش (count مستقل يتجاوز حد الـ1000)
  const cntPairs = await Promise.all(
    batches.map((b: any) =>
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", b.id)
        .then((r) => [b.id as string, r.count || 0] as const)
    )
  );
  const cnt = new Map<string, number>(cntPairs);

  const dipName = new Map(dips.map((d: any) => [d.id, d.name_ar || d.name_en || "—"]));
  const gmap = new Map<string, { id: string; name: string; batches: any[] }>();
  for (const b of batches) {
    const key = b.diploma_id || "__none__";
    if (!gmap.has(key)) {
      gmap.set(key, { id: key, name: b.diploma_id ? (dipName.get(b.diploma_id) || "—") : "__NODIP__", batches: [] });
    }
    gmap.get(key)!.batches.push({
      id: b.id, code: b.code || "", status: b.status || "open",
      count: cnt.get(b.id) || 0, start_date: b.start_date || null,
    });
  }
  const groups = [...gmap.values()];

  const specialties: Record<string, string> = {};
  for (const s of specs) specialties[s.id] = s.name_en || s.name_ar || "";

  return <EducationTree groups={groups} specialties={specialties} />;
}
