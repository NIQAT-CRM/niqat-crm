import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import { receiptPath } from "@/lib/supabase/receipts";
import ScreenshotsView, { type Receipt } from "./ScreenshotsView";

export const dynamic = "force-dynamic";

export default async function ScreenshotsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // بوّابة السيرفر: مفيش صلاحية → رفض الوصول المباشر (redirect)
  const { data: prof } = await supabase.from("profiles")
    .select("can_view_receipts").eq("id", user?.id || "").maybeSingle();
  if (!prof?.can_view_receipts) redirect("/");

  // ===== المصدر (أ): إيصالات الأقساط (فيها مبلغ/عملة) — عبر RPC =====
  const instP = supabase.rpc("receipts_by_day", { p_from: "2000-01-01", p_to: "2100-01-01" });
  // ===== المصدر (ب): إيصالات المستندات (صور التحويل المتفق عليها ...) — متاحة للكل =====
  const docsP = supabase.from("customer_docs")
    .select("url, created_at, customers(id, name, phone1, owner_id)")
    .not("url", "is", null).neq("url", "")
    .order("created_at", { ascending: false });

  const [instRes, docsRes] = await Promise.all([instP, docsP]);

  // أسماء الملاك (owner) في map واحد
  const docRows = (docsRes.data as any[]) || [];
  const ownerIds = Array.from(new Set(docRows.map((d) => {
    const c = Array.isArray(d.customers) ? d.customers[0] : d.customers; return c?.owner_id;
  }).filter(Boolean)));
  const ownerName = new Map<string, string>();
  if (ownerIds.length) {
    const { data: prs } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds as string[]);
    ((prs as any[]) || []).forEach((p) => ownerName.set(p.id, p.full_name || ""));
  }

  const byPath = new Map<string, Receipt>();
  const put = (r: Receipt) => {
    const key = receiptPath(r.receiptUrl || "");
    if (!key) return;
    if (!byPath.has(key)) byPath.set(key, r); // الأقساط أولاً (فيها مبلغ) تغلب المكرر
  };

  // (أ) الأقساط
  ((instRes.data as any[]) || []).forEach((r) => put({
    receiptUrl: r.receipt_url || "",
    customerId: r.customer_id || "",
    customerName: r.customer_name || "—",
    phone1: r.phone1 || "",
    amount: Number(r.amount) || 0,
    hasAmount: true,
    currency: r.currency || "EGP",
    uploadedAt: r.uploaded_at || "",
    ownerName: r.owner_name || "",
  }));

  // (ب) المستندات — بدون مبلغ
  docRows.forEach((d) => {
    const c = Array.isArray(d.customers) ? d.customers[0] : d.customers;
    put({
      receiptUrl: d.url || "",
      customerId: c?.id || "",
      customerName: c?.name || "—",
      phone1: c?.phone1 || "",
      amount: null,
      hasAmount: false,
      currency: "EGP",
      uploadedAt: d.created_at || "",
      ownerName: (c?.owner_id && ownerName.get(c.owner_id)) || "",
    });
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
