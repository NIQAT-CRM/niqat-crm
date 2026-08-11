import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import AccreditationsManager from "./AccreditationsManager";

export const dynamic = "force-dynamic";

// §7 إدارة الاعتمادات: بنك الأسئلة + إعدادات الاختبار — edu_admin فقط.
export default async function Page() {
  await requireEdu(["edu_admin"]);
  const supabase = createClient();
  const [acRes, stRes] = await Promise.all([
    supabase.from("accreditations").select("id, name").order("name"),
    supabase.from("edu_exam_settings").select("accreditation_id, num_questions, duration_minutes, pass_pct"),
  ]);
  const accreditations = ((acRes.data as any[]) || []).map((a) => ({ id: a.id, name: a.name || "—" }));
  const settings: Record<string, any> = {};
  for (const s of (stRes.data as any[]) || []) settings[s.accreditation_id] = s;
  return <AccreditationsManager accreditations={accreditations} settings={settings} />;
}
