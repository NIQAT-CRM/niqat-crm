import { redirect } from "next/navigation";
import { requireEdu } from "@/lib/edu";
import { t as tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// الشجرة (الدبلومات والباتشات) — نقطة الهبوط المشتركة لأي شخص تعليمي.
// المصحح الصافي بيتحوّل لصفحة التصحيح بتاعته (تجنّب هبوط بلا معنى + أي لوب).
export default async function EducationPage() {
  const m = await requireEdu([], true);
  if (m.eduMode && m.role === "edu_grader") redirect("/education/grading");

  return (
    <div className="page-h" style={{ display: "block" }}>
      <h1>{tr("eduDiplomasBatches")}</h1>
      <div className="card" style={{ padding: 40, marginTop: 16, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        🎓 {tr("comingSoon")}
      </div>
    </div>
  );
}
