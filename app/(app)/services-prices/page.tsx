import { createClient } from "@/lib/supabase/server";
import { hasPerm } from "@/lib/authz";
import NoAccess from "../NoAccess";
import RealtimeRefresh from "../RealtimeRefresh";
import ServicesPricesView from "./ServicesPricesView";

export const dynamic = "force-dynamic";

export default async function ServicesPricesPage() {
  if (!(await hasPerm("can_view_prices"))) return <NoAccess />;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("team").eq("id", user?.id || "").maybeSingle();
  const isAdmin = (prof?.team || "").toLowerCase() === "admin";

  const [{ data: groups }, { data: services }] = await Promise.all([
    supabase.from("service_groups").select("id,name,sort").order("sort", { ascending: true }),
    supabase.from("services").select("*").order("sort", { ascending: true }),
  ]);

  return (
    <div className="page-h" style={{ display: "block" }}>
      <RealtimeRefresh tables={["service_groups", "services"]} />
      <ServicesPricesView
        groups={(groups as any[]) || []}
        services={(services as any[]) || []}
        isAdmin={isAdmin}
      />
    </div>
  );
}
