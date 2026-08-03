import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("team, can_view_feedback").eq("id", user?.id || "").maybeSingle();
  const allowed = (prof?.team || "").toLowerCase() === "admin" || !!prof?.can_view_feedback;
  if (!allowed) redirect("/");

  return (
    <div className="page-h" style={{ display: "block" }}>
      <h1>{tr("feedbackNav")}</h1>
      <div className="card" style={{ padding: 40, marginTop: 16, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        💬 {tr("comingSoon")}
      </div>
    </div>
  );
}
