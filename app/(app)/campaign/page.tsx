import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import CampaignView, { type Reg } from "./CampaignView";
import { type PaidRow } from "./CampaignPaidList";

export const dynamic = "force-dynamic";

// تسجيلات الحملة — موديول معزول. البوّابة على can_view_campaign مباشرة (مطابقة للـRPC،
// بدون أدمن-أوفررايد) عشان الوصول يبقى محكوم بنفس منطق حماية الداتا في قاعدة البيانات.
export default async function CampaignPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: prof } = await supabase.from("profiles")
    .select("can_view_campaign").eq("id", user?.id || "").maybeSingle();
  if (!prof?.can_view_campaign) redirect("/");
  const { data: meMsg } = await supabase.from("profiles").select("can_message,team").eq("id", user?.id || "").maybeSingle();
  const canMessage = ((meMsg?.team || "").toLowerCase() === "admin") || !!meMsg?.can_message;
  const { data: tpls } = await supabase.from("wa_templates").select("name").order("created_at");
  const templates = ((tpls as any[]) || []).map((t) => t.name).filter(Boolean);

  // المصدر الوحيد: RPC آمن (security definer + مربوط بالصلاحية على مستوى القاعدة)
  const { data } = await supabase.rpc("campaign_registrations");
  const rows: Reg[] = ((data as any[]) || []).map((r) => ({
    id: r.id || "",
    createdAt: r.created_at || "",
    fullName: r.full_name || "",
    email: r.email || "",
    whatsapp: r.whatsapp || "",
    specialization: r.specialization || "",
    country: r.country || "",
    experience: r.experience || "",
    role: r.role || "",
    software: r.software || "",
    source: r.source || "",
    status: r.status || "",
  }));

  // مدفوعات الحملة (شراء دبلومة من صفحة الدفع) — نفس بوابة can_view_campaign
  const { data: paidData } = await supabase.rpc("campaign_diploma_orders");
  const paidRows: PaidRow[] = ((paidData as any[]) || []).map((r) => ({
    id: r.id || "", createdAt: r.created_at || "", paidAt: r.paid_at || "",
    fullName: r.full_name || "", email: r.email || "", whatsapp: r.whatsapp || "",
    specialization: r.specialization || "", country: r.country || "",
    amount: r.amount != null ? Number(r.amount) : null, currency: r.currency || "USD",
    status: (r.status || "").toLowerCase(), paypalCaptureId: r.paypal_capture_id || "", invoiceUrl: r.invoice_url || "",
  }));

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div><h1>{tr("campaignTitle")}</h1><p>{tr("campaignDesc")}</p></div>
      </div>
      <CampaignView rows={rows} paidRows={paidRows} canMessage={canMessage} templates={templates} />
    </div>
  );
}
