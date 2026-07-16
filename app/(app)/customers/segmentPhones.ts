"use server";
import { createClient } from "@/lib/supabase/server";

type SP = { q?: string; stage?: string; owner?: string; company?: string; dip?: string; batch?: string; pay?: string };
const PAGE = 1000;
const CAP = 30000;
const CHUNK = 150;

// يجيب أرقام كل العملاء المطابقين للفلتر/البحث الحالي (مش الـ100 المعروضين بس).
// بيشتغل عند الطلب (الضغط على زر الإرسال) عشان ما يثقّلش تحميل الصفحة.
export async function getSegmentPhones(f: SP): Promise<string[]> {
  const supabase = createClient();
  const q = (f?.q || "").trim();

  // (1) لو فيه فلتر دبلومة/باتش/دفع → نحدّد أولاً IDs العملاء المرشّحين
  let idFilter: string[] | null = null;
  if (f?.dip || f?.batch || f?.pay) {
    const enrToCust = new Map<string, string>();
    for (let from = 0; from < CAP; from += PAGE) {
      let eq = supabase.from("enrollments").select("id,customer_id");
      if (f?.dip) eq = eq.eq("diploma_id", f.dip);
      if (f?.batch) eq = eq.eq("batch_id", f.batch);
      const { data } = await eq.range(from, from + PAGE - 1);
      const rows = (data as any[]) || [];
      for (const r of rows) if (r.customer_id) enrToCust.set(r.id, r.customer_id);
      if (rows.length < PAGE) break;
    }
    let candidate = new Set<string>(Array.from(enrToCust.values()));

    if (f?.pay) {
      const today = new Date().toISOString().slice(0, 10);
      const payIds = new Set<string>();
      const scan = (rows: any[]) => {
        for (const i of rows) {
          const cid = enrToCust.get(i.enrollment_id); if (!cid) continue;
          const paid = !!i.paid_at || i.status === "paid"; if (paid) continue;
          if (f.pay === "bal") payIds.add(cid);
          else if (f.pay === "due" && i.due_date) payIds.add(cid);
          else if (f.pay === "overdue" && i.due_date && i.due_date < today) payIds.add(cid);
        }
      };
      if (f?.dip || f?.batch) {
        const enrIds = Array.from(enrToCust.keys());
        for (let c = 0; c < enrIds.length; c += CHUNK) {
          const { data } = await supabase.from("installments")
            .select("enrollment_id,amount,paid_at,due_date,status").in("enrollment_id", enrIds.slice(c, c + CHUNK));
          scan((data as any[]) || []);
        }
      } else {
        for (let from = 0; from < CAP; from += PAGE) {
          const { data } = await supabase.from("installments")
            .select("enrollment_id,amount,paid_at,due_date,status").range(from, from + PAGE - 1);
          const rows = (data as any[]) || []; scan(rows);
          if (rows.length < PAGE) break;
        }
      }
      candidate = (f?.dip || f?.batch)
        ? new Set(Array.from(candidate).filter((x) => payIds.has(x)))
        : payIds;
    }
    idFilter = Array.from(candidate);
    if (idFilter.length === 0) return [];
  }

  // (2) نجيب الأرقام مع فلاتر أعمدة العميل (deleted/بحث/مرحلة/مسؤول/شركة)
  const applyCols = (cq: any) => {
    cq = cq.eq("deleted", false).not("archived", "is", true);
    if (q) cq = cq.or(`name.ilike.%${q}%,phone1.ilike.%${q}%,email.ilike.%${q}%`);
    if (f?.stage) cq = cq.eq("stage", f.stage);
    if (f?.owner) cq = cq.eq("owner_id", f.owner);
    if (f?.company) cq = cq.eq("company", f.company);
    return cq;
  };

  const phones: string[] = [];
  if (idFilter) {
    for (let c = 0; c < idFilter.length; c += CHUNK) {
      const { data } = await applyCols(supabase.from("customers").select("phone1")).in("id", idFilter.slice(c, c + CHUNK));
      for (const r of (data as any[]) || []) if (r.phone1) phones.push(r.phone1);
    }
  } else {
    for (let from = 0; from < CAP; from += PAGE) {
      const { data } = await applyCols(supabase.from("customers").select("phone1"))
        .order("created_at", { ascending: false }).range(from, from + PAGE - 1);
      const rows = (data as any[]) || [];
      for (const r of rows) if (r.phone1) phones.push(r.phone1);
      if (rows.length < PAGE) break;
    }
  }
  return Array.from(new Set(phones));
}
