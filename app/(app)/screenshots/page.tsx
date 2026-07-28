import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import { receiptPath } from "@/lib/supabase/receipts";
import ScreenshotsView, { type Receipt } from "./ScreenshotsView";

export const dynamic = "force-dynamic";

export default async function ScreenshotsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: prof } = await supabase.from("profiles")
    .select("can_view_receipts").eq("id", user?.id || "").maybeSingle();
  if (!prof?.can_view_receipts) redirect("/");

  // كل صور الدفع الفعلي من كل المصادر (أقساط + دفعة أولى + إضافات + تحويلات) — الريفند مستبعد داخل الدالة.
  const { data } = await supabase.rpc("receipts_all", { p_from: "2000-01-01", p_to: "2100-01-01" });

  // إزالة تكرار نفس الصورة (لو اتخزنت في أكتر من مصدر) — الأولوية للي فيها مبلغ
  const byPath = new Map<string, Receipt>();
  ((data as any[]) || []).forEach((r) => {
    if (!r.receipt_url) return;
    const key = receiptPath(r.receipt_url) || r.receipt_url;
    const rec: Receipt = {
      receiptUrl: r.receipt_url || "",
      customerId: r.customer_id || "",
      customerName: r.customer_name || "—",
      phone1: r.phone1 || "",
      amount: r.amount != null ? Number(r.amount) : null,
      hasAmount: r.amount != null,
      currency: r.currency || "EGP",
      uploadedAt: r.uploaded_at || "",
      ownerName: r.owner_name || "",
    };
    const existing = byPath.get(key);
    if (!existing || (!existing.hasAmount && rec.hasAmount)) byPath.set(key, rec);
  });

  const rows: Receipt[] = Array.from(byPath.values())
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>{tr("screenshots")}</h1>
      </div>
      <ScreenshotsView rows={rows} />
    </div>
  );
}
