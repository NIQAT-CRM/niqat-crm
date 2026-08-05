import { requireEdu } from "@/lib/edu";
import { createClient } from "@/lib/supabase/server";
import MembersManager from "./MembersManager";

export const dynamic = "force-dynamic";

// قسم «الصلاحيات» — إدارة أعضاء التعليم. الوصول: أدمن عام أو edu_admin.
export default async function Page() {
  const me = await requireEdu(["edu_admin"]);
  const supabase = createClient();

  const [profRes, memRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, team, phone").order("full_name"),
    supabase.from("edu_members")
      .select("id, profile_id, role, active, can_edit_results, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const profiles = (profRes.data || []) as any[];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const members = ((memRes.data || []) as any[]).map((m) => {
    const p = byId.get(m.profile_id);
    return {
      id: m.id,
      profile_id: m.profile_id,
      role: m.role,
      active: m.active,
      can_edit_results: m.can_edit_results,
      name: (p?.full_name && p.full_name.trim()) || p?.phone || "—",
      team: p?.team || null,
    };
  });

  return <MembersManager initialMembers={members} profiles={profiles} meId={me.userId || ""} />;
}
