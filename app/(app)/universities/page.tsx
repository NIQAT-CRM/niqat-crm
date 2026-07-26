import { t as tr } from "@/lib/i18n";
import { requirePerm } from "@/lib/authz";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requirePerm("can_view_universities");
  return (
    <div>
      <div className="page-h"><div><h1>{tr("universities")}</h1><p>{tr("universitiesDesc")}</p></div></div>
      <div className="empty"><b>{tr("underPrep")}</b></div>
    </div>
  );
}
