import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import ScreenshotsView, { type Receipt } from "./ScreenshotsView";

export const dynamic = "force-dynamic";

export default async function ScreenshotsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // بوّابة السيرفر: مفيش صلاحية → رفض الوصول المباشر (redirect)
  const { data: prof } = await supabase.from("profiles")
    .select("can_view_receipts").eq("id", user?.id || "").maybeSingle();
  if (!prof?.can_view_receipts) redirect("/");

  // كل الإيصالات (نطاق واسع) — التجميع شهر/يوم بيتعمل في الواجهة
  const { data } = await supabase.rpc("receipts_by_day", { p_from: "2000-01-01", p_to: "2100-01-01" });
  const rows: Receipt[] = ((data as any[]) || []).map((r) => ({
    receiptUrl: r.receipt_url || "",
    customerId: r.customer_id || "",
    customerName: r.customer_name || "—",
    phone1: r.phone1 || "",
    amount: Number(r.amount) || 0,
    currency: r.currency || "EGP",
    uploadedAt: r.uploaded_at || "",
    ownerName: r.owner_name || "",
  }));

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>{tr("screenshots")}</h1>
      </div>
      <ScreenshotsView rows={rows} />
    </div>
  );
}
