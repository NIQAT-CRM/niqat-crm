import { requireEdu } from "@/lib/edu";

export const dynamic = "force-dynamic";

// حارس منطقة التعليم كلها: الأدمن العام أو عضو تعليم نشط أو مشاهد can_view_education.
// حماية إضافية لكل بند حسب الدور بتتعمل جوّه كل صفحة فرعية.
export default async function EducationLayout({ children }: { children: React.ReactNode }) {
  await requireEdu([], true);
  return <>{children}</>;
}
