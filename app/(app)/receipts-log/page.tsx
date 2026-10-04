import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReceiptsLogView from "./ReceiptsLogView";

export const dynamic = "force-dynamic";

export default async function ReceiptsLogPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_view_receipts,team").eq("id", user?.id || "").maybeSingle();
  const isAdmin = (prof?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !prof?.can_view_receipts) redirect("/");
  const { data } = await supabase.from("receipts_issued").select("id,receipt_no,customer_id,service_label,batch_code,amount,currency,pay_kind,pay_method,issued_at,sent_whatsapp,sent_whatsapp_at,sent_email,sent_email_at").order("issued_at", { ascending: false }).limit(300);
  return <ReceiptsLogView initial={(data as any[]) || []} />;
}
