import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

const STAGES: Record<string, string> = {
  new: "جديد", contacted: "تم التواصل", interested: "مهتم",
  negotiation: "تفاوض", enrolled: "مشترك", onhold: "معلّق", lost: "خسارة"
};

export default async function Customers() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("customers")
    .select("id,name,phone1,email,company,stage,created_at")
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">العملاء</h1>
        <Link href="/customers/new"
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-brand-dark">
          + إضافة عميل
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-soft text-ink">
            <tr>
              <th className="text-right p-3 font-bold">الاسم</th>
              <th className="text-right p-3 font-bold">الموبايل</th>
              <th className="text-right p-3 font-bold">الشركة</th>
              <th className="text-right p-3 font-bold">المرحلة</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map(r => (
              <tr key={r.id} className="border-t border-line hover:bg-brand-soft/40">
                <td className="p-3 font-bold">
                  <Link href={`/customers/${r.id}`} className="text-brand hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="p-3 text-muted" dir="ltr">{r.phone1 || "—"}</td>
                <td className="p-3 text-muted">{r.company || "—"}</td>
                <td className="p-3">{STAGES[r.stage] || r.stage}</td>
              </tr>
            ))}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={4} className="p-6 text-center text-muted">لا يوجد عملاء بعد — اضغط «إضافة عميل».</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
