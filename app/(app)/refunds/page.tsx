import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import RefundTable from "./RefundTable";

export const dynamic = "force-dynamic";

export default async function Refunds() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_see_finance").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_see_finance) {
    return (
      <div className="page-h"><div><h1>{tr("refunds")}</h1><p>مالكش صلاحية رؤية البيانات المالية.</p></div></div>
    );
  }

  return (
    <div>
      <div className="page-h"><div><h1>{tr("refunds")}</h1></div></div>
      <RefundTable />
    </div>
  );
}
