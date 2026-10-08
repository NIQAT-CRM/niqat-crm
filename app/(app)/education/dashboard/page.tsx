import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import DashboardView from "./DashboardView";

export const dynamic = "force-dynamic";

async function hc(supabase: any, table: string, apply?: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count || 0;
}

// §10 داشبورد الإدارة — ٤ أقسام، أرقام لحظية، صفر ماليات. edu_admin فقط.
export default async function Page() {
  await requireEdu(["edu_admin"]);
  const supabase = createClient();

  const [
    enrolls, diplomasN, openBatches, certsIssued, accredsN,
    examSubmitted, examPassed, eligTotal, eligPass, apOpen, apReview, apUpheld, apRejected, failedIssues,
  ] = await Promise.all([
    hc(supabase, "enrollments"),
    hc(supabase, "diplomas"),
    hc(supabase, "edu_v_batches", (q) => q.eq("status", "open")),
    hc(supabase, "edu_certificates", (q) => q.eq("status", "issued")),
    hc(supabase, "edu_v_customer_addons", (q) => q.eq("type", "accred")),
    hc(supabase, "edu_exam_attempts", (q) => q.not("submitted_at", "is", null)),
    hc(supabase, "edu_exam_attempts", (q) => q.eq("passed", true)),
    hc(supabase, "edu_diploma_results", (q) => q.not("computed_at", "is", null)),
    hc(supabase, "edu_diploma_results", (q) => q.eq("eligible", true)),
    hc(supabase, "edu_appeals", (q) => q.eq("status", "open")),
    hc(supabase, "edu_appeals", (q) => q.eq("status", "under_review")),
    hc(supabase, "edu_appeals", (q) => q.eq("status", "upheld")),
    hc(supabase, "edu_appeals", (q) => q.eq("status", "rejected")),
    hc(supabase, "edu_diploma_results", (q) => q.eq("issue_status", "failed")),
  ]);

  const [{ data: bats }, { data: dips }, { data: accs }, { data: mems }] = await Promise.all([
    supabase.from("edu_v_batches").select("id, code, diploma_id"),
    supabase.from("diplomas").select("id, name_ar, name_en"),
    supabase.from("accreditations").select("id, name"),
    supabase.from("edu_members").select("profile_id, role").eq("active", true),
  ]);
  const dipName = new Map(((dips as any[]) || []).map((d) => [d.id, d.name_ar || d.name_en || "—"]));

  // أداء الباتشات (نتائج محسوبة + مستحق)
  const batchStats = await Promise.all(((bats as any[]) || []).map(async (b) => {
    const [t, e] = await Promise.all([
      hc(supabase, "edu_diploma_results", (q) => q.eq("batch_id", b.id).not("computed_at", "is", null)),
      hc(supabase, "edu_diploma_results", (q) => q.eq("batch_id", b.id).eq("eligible", true)),
    ]);
    return { code: b.code || "—", diploma: dipName.get(b.diploma_id) || "—", total: t, eligible: e, rate: t ? Math.round((e / t) * 100) : 0 };
  }));

  // تجميع لكل دبلومة
  const dmap = new Map<string, { name: string; total: number; eligible: number }>();
  for (const b of batchStats) {
    const g = dmap.get(b.diploma) || { name: b.diploma, total: 0, eligible: 0 };
    g.total += b.total; g.eligible += b.eligible; dmap.set(b.diploma, g);
  }
  const diplomaPerf = [...dmap.values()].map((d) => ({ ...d, rate: d.total ? Math.round((d.eligible / d.total) * 100) : 0 }));
  const struggling = batchStats.filter((b) => b.total > 0 && b.rate < 50);

  // أداء الفريق — إنتاجية المصححين
  const memIds = [...new Set(((mems as any[]) || []).map((m) => m.profile_id))];
  const { data: profs } = memIds.length ? await supabase.from("profiles").select("id, full_name").in("id", memIds) : { data: [] as any[] };
  const pName = new Map(((profs as any[]) || []).map((p) => [p.id, p.full_name || "—"]));
  const graders = (await Promise.all(((mems as any[]) || []).filter((m) => m.role === "edu_grader" || m.role === "edu_admin").map(async (m) => {
    const g = await hc(supabase, "edu_task_results", (q) => q.eq("graded_by", m.profile_id));
    return { name: pName.get(m.profile_id) || "—", graded: g };
  }))).filter((x) => x.graded > 0).sort((a, b) => b.graded - a.graded);

  // الاعتمادات المدفوعة — لكل اعتماد
  const accredPerf = await Promise.all(((accs as any[]) || []).map(async (a) => {
    const [s, p] = await Promise.all([
      hc(supabase, "edu_exam_attempts", (q) => q.eq("accreditation_id", a.id).not("submitted_at", "is", null)),
      hc(supabase, "edu_exam_attempts", (q) => q.eq("accreditation_id", a.id).eq("passed", true)),
    ]);
    return { name: a.name || "—", submitted: s, passed: p, rate: s ? Math.round((p / s) * 100) : 0 };
  }));

  const examRate = examSubmitted ? Math.round((examPassed / examSubmitted) * 100) : 0;
  const eligRate = eligTotal ? Math.round((eligPass / eligTotal) * 100) : 0;

  return (
    <DashboardView
      kpis={{ enrolls, diplomas: diplomasN, openBatches, eligRate, eligPass, eligTotal, certsIssued, accreds: accredsN, examRate, examPassed, examSubmitted, apOpen: apOpen + apReview }}
      diplomaPerf={diplomaPerf}
      struggling={struggling}
      graders={graders}
      appeals={{ open: apOpen, review: apReview, upheld: apUpheld, rejected: apRejected, failedIssues }}
      accredPerf={accredPerf}
    />
  );
}
