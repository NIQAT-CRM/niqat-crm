import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import { receiptPath } from "@/lib/supabase/receipts";
import RealtimeRefresh from "../RealtimeRefresh";
import ScreenshotsView, { type Receipt } from "./ScreenshotsView";
import MonthlySales from "../MonthlySales";

export const dynamic = "force-dynamic";

export default async function ScreenshotsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: prof } = await supabase.from("profiles")
    .select("can_view_receipts,can_see_finance,team,can_view_customers").eq("id", user?.id || "").maybeSingle();
  if (!prof?.can_view_receipts) redirect("/");
  const canCreate = !!prof?.can_see_finance;
  const canDelete = (prof?.team || "").toLowerCase() === "admin";
  const canEdit = (prof?.team || "").toLowerCase() === "admin" || !!prof?.can_see_finance;
  const canOpenCustomer = (prof?.team || "").toLowerCase() === "admin" || prof?.can_view_customers !== false;

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

  const oldRows: Receipt[] = Array.from(byPath.values());

  // ===== الإيصالات المشتركة/المجزّأة الجديدة (receipts + receipt_allocations) — محمية بالماليات =====
  const sharedRows: Receipt[] = [];
  const { data: shared } = await supabase
    .from("receipts")
    .select("id,url,currency,total_amount,note,created_at,uploaded_by, receipt_allocations(customer_id,amount,currency,customers(name,phone1))");
  const sh = (shared as any[]) || [];
  if (sh.length) {
    const ownIds = Array.from(new Set(sh.map((s) => s.uploaded_by).filter(Boolean)));
    let ownMap = new Map<string, string>();
    if (ownIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ownIds);
      ownMap = new Map(((profs as any[]) || []).map((p) => [p.id, p.full_name]));
    }
    for (const s of sh) {
      if (!s.url) continue;
      const allocs = ((s.receipt_allocations as any[]) || []).map((a) => ({
        customerId: a.customer_id || "", name: a.customers?.name || "—", phone: a.customers?.phone1 || "",
        amount: Number(a.amount) || 0, currency: a.currency || s.currency || "EGP",
      }));
      sharedRows.push({
        receiptUrl: s.url, customerId: allocs[0]?.customerId || "", customerName: "", phone1: "",
        amount: Number(s.total_amount) || 0, hasAmount: true, currency: s.currency || "EGP",
        uploadedAt: s.created_at || "", ownerName: ownMap.get(s.uploaded_by) || "",
        isShared: true, allocations: allocs, note: s.note || "",
      });
    }
  }

  const rows: Receipt[] = [...oldRows, ...sharedRows]
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));

  // التجميع الشهري (يستخدم الدالة الموجودة receipts_monthly — قراءة فقط، مفيش تعديل داتابيز)
  const { data: monthlyRows } = await supabase.rpc("receipts_monthly");

  return (
    <div className="page-h" style={{ display: "block" }}>
      <RealtimeRefresh tables={["installments","customer_docs","customer_addons","enrollment_finance","addon_finance","receipts","receipt_allocations"]} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>{tr("screenshots")}</h1>
      </div>
      <div style={{ marginBottom: 18 }}>
        <MonthlySales rows={(monthlyRows as any[]) || []} collapsible />
      </div>
      <ScreenshotsView rows={rows} canCreate={canCreate} canDelete={canDelete} canEdit={canEdit} canOpenCustomer={canOpenCustomer} />
    </div>
  );
}
