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
  const { data } = await supabase.rpc("receipts_search", { p_query: "" });
  return <ReceiptsLogView initial={(data as any[]) || []} />;
}
