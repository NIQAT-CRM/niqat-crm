import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import ClientsView, { type Client } from "./ClientsView";

export const dynamic = "force-dynamic";

// عملاء الدبلومات (مشتريات صفحة الدفع enroll.niqat.com) — عرض فقط (read-only).
// نفس بوابة تسجيلات الحملة: can_view_campaign (مطابقة لحماية الـRPC على مستوى القاعدة).
export default async function ClientsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles").select("can_view_campaign").eq("id", user?.id || "").maybeSingle();
  if (!prof?.can_view_campaign) redirect("/");

  const { data } = await supabase.rpc("campaign_diploma_orders");
  const rows: Client[] = ((data as any[]) || []).map((r) => ({
    id: r.id || "",
    createdAt: r.created_at || "",
    paidAt: r.paid_at || "",
    fullName: r.full_name || "",
    email: r.email || "",
    whatsapp: r.whatsapp || "",
    specialization: r.specialization || "",
    country: r.country || "",
    amount: r.amount != null ? Number(r.amount) : null,
    currency: r.currency || "USD",
    status: (r.status || "").toLowerCase(),
    paypalCaptureId: r.paypal_capture_id || "",
    invoiceUrl: r.invoice_url || "",
  }));

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div><h1>{tr("clientsTitle")}</h1><p>{tr("clientsDesc")}</p></div>
      </div>
      <ClientsView rows={rows} />
    </div>
  );
}
