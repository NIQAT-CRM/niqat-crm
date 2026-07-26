import { t as tr } from "@/lib/i18n";
import { hasPerm } from "@/lib/authz";
import NoAccess from "../NoAccess";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await hasPerm("can_view_universities"))) return <NoAccess />;
  return (
    <div>
      <div className="page-h"><div><h1>{tr("universities")}</h1><p>{tr("universitiesDesc")}</p></div></div>
      <div className="empty"><b>{tr("underPrep")}</b></div>
    </div>
  );
}
