import { hasPerm } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import NoAccess from "../../NoAccess";
import RealtimeRefresh from "../../RealtimeRefresh";
import InstitutionDrawer from "./InstitutionDrawer";

export const dynamic = "force-dynamic";

export default async function UniversityPage({ params }: { params: { id: string } }) {
  if (!(await hasPerm("can_view_universities"))) return <NoAccess />;
  const canManage = await hasPerm("can_manage_universities");
  const supabase = createClient();
  const { data: uni } = await supabase.from("universities").select("*").eq("id", params.id).maybeSingle();
  if (!uni) return <NoAccess />;
  const { data: protocols } = await supabase.from("protocols")
    .select("id,file_url,signed_at,expires_at,notes,created_at").eq("university_id", params.id)
    .order("signed_at", { ascending: false });
  return (
    <div>
      <RealtimeRefresh tables={["universities", "protocols"]} />
      <InstitutionDrawer uni={uni as any} protocols={(protocols as any[]) || []} canManage={canManage} />
    </div>
  );
}
