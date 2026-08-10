import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import AppealsManager from "./AppealsManager";

export const dynamic = "force-dynamic";

// §8 التظلمات — edu_admin يراجع/يسند/يقرر. (assignee_id لعضو موزّع عليه لاحقاً)
export default async function Page() {
  await requireEdu(["edu_admin"]);
  const supabase = createClient();

  const { data: aps } = await supabase.from("edu_appeals")
    .select("id, customer_id, source_type, batch_id, reason, status, assignee_id, response, decided_at, created_at")
    .order("created_at", { ascending: false });
  const appeals = (aps as any[]) || [];

  const custIds = [...new Set(appeals.map((a) => a.customer_id).filter(Boolean))];
  const [{ data: cs }, { data: mem }] = await Promise.all([
    custIds.length ? supabase.from("edu_v_customers").select("id, name").in("id", custIds) : Promise.resolve({ data: [] }),
    supabase.from("edu_members").select("profile_id, role, active").eq("active", true),
  ]);
  const custName = new Map(((cs as any[]) || []).map((c) => [c.id, c.name]));

  // أسماء الأعضاء (للإسناد والعرض)
  const memberIds = [...new Set((((mem as any[]) || []).map((m) => m.profile_id)))];
  const asgIds = [...new Set(appeals.map((a) => a.assignee_id).filter(Boolean))];
  const allProfIds = [...new Set([...memberIds, ...asgIds])];
  const { data: profs } = allProfIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", allProfIds)
    : { data: [] as any[] };
  const profName = new Map(((profs as any[]) || []).map((p) => [p.id, p.full_name || "—"]));

  const rows = appeals.map((a) => ({
    id: a.id,
    customer: custName.get(a.customer_id) || "—",
    source_type: a.source_type,
    reason: a.reason || "",
    status: a.status,
    assignee_id: a.assignee_id,
    assignee: a.assignee_id ? (profName.get(a.assignee_id) || "—") : null,
    response: a.response,
    created_at: a.created_at,
  }));
  const members = ((mem as any[]) || []).map((m) => ({ id: m.profile_id, name: profName.get(m.profile_id) || "—", role: m.role }));

  return <AppealsManager appeals={rows} members={members} />;
}
