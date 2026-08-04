import { hasPerm } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import NoAccess from "../../NoAccess";
import RealtimeRefresh from "../../RealtimeRefresh";
import { t as tr } from "@/lib/i18n";
import ProtocolsTable from "./ProtocolsTable";

export const dynamic = "force-dynamic";

export default async function ProtocolsPage() {
  if (!(await hasPerm("can_view_universities"))) return <NoAccess />;
  const supabase = createClient();
  const { data: protos } = await supabase.from("protocols")
    .select("id,file_url,signed_at,expires_at,university_id, universities(name_ar,name_en)")
    .order("signed_at", { ascending: false });
  const rows = ((protos as any[]) || []).map((p) => ({
    id: p.id, file_url: p.file_url, signed_at: p.signed_at, expires_at: p.expires_at,
    uniName: p.universities?.name_ar || p.universities?.name_en || "—",
  }));
  return (
    <div>
      <RealtimeRefresh tables={["universities", "protocols"]} />
      <div className="page-h"><div><h1>{tr("protocolsNav")}</h1></div></div>
      <ProtocolsTable rows={rows} />
    </div>
  );
}
