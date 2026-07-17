"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { filteredCustomerIds, type CustFilterSP } from "@/lib/customerFilter";

const CHUNK = 200;

function revalidateAll() {
  revalidatePath("/customers");
  revalidatePath("/onboarding");
  revalidatePath("/refunds");
  revalidatePath("/archive");
}

async function logBulk(action: string, ids: string[], detail: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert(
      ids.slice(0, 500).map((cid) => ({ customer_id: cid, actor_id: user?.id || null, action, detail }))
    );
  } catch { /* اللوج مش حرج — نتجاهل أي خطأ */ }
}

// يرجّع كل IDs الفلتر الحالي (لزر «تحديد كل النتائج»)
export async function selectAllFilteredIds(sp: CustFilterSP): Promise<string[]> {
  return filteredCustomerIds(sp);
}

async function updateChunks(ids: string[], patch: Record<string, any>) {
  const supabase = createClient();
  let ok = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await supabase.from("customers").update(patch).in("id", slice);
    if (error) return { ok, error: error.message };
    ok += slice.length;
  }
  return { ok, error: null as string | null };
}

export async function bulkSetOwner(ids: string[], ownerId: string | null) {
  if (!ids.length) return { ok: 0, error: null };
  const res = await updateChunks(ids, { owner_id: ownerId });
  if (!res.error) { await logBulk("bulk_owner", ids, "تعيين مسؤول جماعي"); revalidateAll(); }
  return res;
}

export async function bulkSetStage(ids: string[], stage: string) {
  if (!ids.length || !stage) return { ok: 0, error: null };
  const res = await updateChunks(ids, { stage });
  if (!res.error) { await logBulk("bulk_stage", ids, "تغيير المرحلة جماعي → " + stage); revalidateAll(); }
  return res;
}

export async function bulkSignTerms(ids: string[]) {
  if (!ids.length) return { ok: 0, error: null };
  const res = await updateChunks(ids, { terms_signed: true, terms_signed_at: new Date().toISOString() });
  if (!res.error) { await logBulk("bulk_terms", ids, "إمضاء الشروط والأحكام جماعي"); revalidateAll(); }
  return res;
}

export async function bulkArchive(ids: string[]) {
  if (!ids.length) return { ok: 0, error: null };
  const res = await updateChunks(ids, { archived: true });
  if (!res.error) { await logBulk("bulk_archive", ids, "أرشفة جماعية"); revalidateAll(); }
  return res;
}

// تصدير المحدّدين — يرجّع صفوف مبسّطة للـ CSV (على دفعات)
export async function bulkExportRows(ids: string[]): Promise<{ name: string; phone1: string; phone2: string; email: string; company: string; stage: string }[]> {
  if (!ids.length) return [];
  const supabase = createClient();
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await supabase.from("customers")
      .select("name,phone1,phone2,email,company,stage").in("id", ids.slice(i, i + CHUNK));
    for (const r of (data as any[]) || []) out.push({
      name: r.name || "", phone1: r.phone1 || "", phone2: r.phone2 || "",
      email: r.email || "", company: r.company || "", stage: r.stage || "",
    });
  }
  return out;
}
