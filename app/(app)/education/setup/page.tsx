import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import SetupWorkspace from "./SetupWorkspace";

export const dynamic = "force-dynamic";

// §4 إعداد السمسترات/التاسكات (قوالب الدبلومة) + نسخها للباتشات — edu_staff/admin.
export default async function Page() {
  await requireEdu(["edu_staff", "edu_admin"]);
  const supabase = createClient();
  const [dipRes, batRes] = await Promise.all([
    supabase.from("diplomas").select("id, name_ar, name_en").order("name_ar"),
    supabase.from("edu_v_batches").select("id, code, diploma_id").order("created_at", { ascending: false }),
  ]);
  const diplomas = ((dipRes.data as any[]) || []).map((d) => ({ id: d.id, name: d.name_ar || d.name_en || "—" }));
  const batches = ((batRes.data as any[]) || []).map((b) => ({ id: b.id, code: b.code || "", diploma_id: b.diploma_id || "" }));
  return <SetupWorkspace diplomas={diplomas} batches={batches} />;
}
