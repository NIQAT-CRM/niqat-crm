import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function headCount(supabase: any, table: string, apply?: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count } = await q;
  return count || 0;
}

// داشبورد الإدارة — أرقام فقط، صفر ماليات. (edu_admin / أدمن عام)
export default async function Page() {
  await requireEdu(["edu_admin"]);
  const supabase = createClient();

  const [
    enrolls, diplomas, openBatches, certsIssued, accreds,
    examSubmitted, examPassed, eligibleTotal, eligiblePass, appealsOpen,
  ] = await Promise.all([
    headCount(supabase, "enrollments"),
    headCount(supabase, "diplomas"),
    headCount(supabase, "edu_v_batches", (q) => q.eq("status", "open")),
    headCount(supabase, "edu_certificates", (q) => q.eq("status", "issued")),
    headCount(supabase, "edu_v_customer_addons", (q) => q.eq("type", "accred")),
    headCount(supabase, "edu_exam_attempts", (q) => q.not("submitted_at", "is", null)),
    headCount(supabase, "edu_exam_attempts", (q) => q.eq("passed", true)),
    headCount(supabase, "edu_diploma_results", (q) => q.not("computed_at", "is", null)),
    headCount(supabase, "edu_diploma_results", (q) => q.eq("eligible", true)),
    headCount(supabase, "edu_appeals", (q) => q.in("status", ["open", "under_review"])),
  ]);

  const examRate = examSubmitted ? Math.round((examPassed / examSubmitted) * 100) : 0;
  const eligRate = eligibleTotal ? Math.round((eligiblePass / eligibleTotal) * 100) : 0;

  const kpis: { label: string; value: string | number; hint?: string; accent?: boolean }[] = [
    { label: tr("eduKpiEnrolls"), value: enrolls },
    { label: tr("eduKpiDiplomas"), value: diplomas },
    { label: tr("eduKpiOpenBatches"), value: openBatches },
    { label: tr("eduKpiEligRate"), value: `${eligRate}%`, hint: `${eligiblePass}/${eligibleTotal}`, accent: true },
    { label: tr("eduKpiCerts"), value: certsIssued },
    { label: tr("eduKpiAccreds"), value: accreds },
    { label: tr("eduKpiExamRate"), value: `${examRate}%`, hint: `${examPassed}/${examSubmitted}`, accent: true },
    { label: tr("eduKpiAppeals"), value: appealsOpen },
  ];

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div>
        <h1>{tr("eduDashboard")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{tr("eduDashDesc")}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginTop: 18 }}>
        {kpis.map((k, i) => (
          <div key={i} className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 700 }}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: k.accent ? "var(--brand)" : "var(--ink)", marginTop: 6, lineHeight: 1 }}>{k.value}</div>
            {k.hint && <div className="num" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }} dir="ltr">{k.hint}</div>}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 18 }}>🔒 {tr("eduDashNoFinance")}</p>
    </div>
  );
}
