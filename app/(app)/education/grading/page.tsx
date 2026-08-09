import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import GradingWorkspace from "./GradingWorkspace";

export const dynamic = "force-dynamic";

// شاشة التصحيح — المصحح/المدير. اختيار باتش ← سمستر ← تصحيح تاسكات العملاء.
export default async function Page() {
  await requireEdu(["edu_grader", "edu_admin"]);
  const supabase = createClient();

  const [dipRes, batRes] = await Promise.all([
    supabase.from("diplomas").select("id, name_ar, name_en"),
    supabase.from("edu_v_batches").select("id, code, diploma_id, created_at").order("created_at", { ascending: false }),
  ]);
  const dipName = new Map(((dipRes.data as any[]) || []).map((d) => [d.id, d.name_ar || d.name_en || "—"]));
  const batches = ((batRes.data as any[]) || []).map((b) => ({
    id: b.id, code: b.code || "", diploma: b.diploma_id ? (dipName.get(b.diploma_id) || "—") : "",
  }));

  return <GradingWorkspace batches={batches} />;
}
