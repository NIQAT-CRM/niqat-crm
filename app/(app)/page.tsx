import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const [cust, enr, tk, bt] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("deleted", false),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("batches").select("*", { count: "exact", head: true })
  ]);
  const kpis = [
    { label: "العملاء", value: cust.count ?? 0 },
    { label: "الاشتراكات", value: enr.count ?? 0 },
    { label: "تذاكر مفتوحة", value: tk.count ?? 0 },
    { label: "الباتشات", value: bt.count ?? 0 }
  ];
  return (
    <div>
      <h1 className="text-xl font-extrabold mb-4">الرئيسية</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-line p-5">
            <div className="text-sm text-muted mb-1">{k.label}</div>
            <div className="text-3xl font-extrabold text-ink">{k.value}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted mt-6">الأرقام دي حيّة من قاعدة بياناتك على Supabase ✅</p>
    </div>
  );
}
