import { hasPerm } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import NoAccess from "../NoAccess";
import RealtimeRefresh from "../RealtimeRefresh";
import UniList from "./UniList";

export const dynamic = "force-dynamic";

export default async function UniversitiesPage() {
  if (!(await hasPerm("can_view_universities"))) return <NoAccess />;
  const canManage = await hasPerm("can_manage_universities");
  const supabase = createClient();
  const { data } = await supabase
    .from("universities")
    .select("id,name_ar,name_en,college,department,status")
    .order("created_at", { ascending: false });
  return (
    <div>
      <RealtimeRefresh tables={["universities", "protocols"]} />
      <UniList items={(data as any[]) || []} canManage={canManage} />
    </div>
  );
}
