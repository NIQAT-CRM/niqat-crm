import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerEdit from "./CustomerEdit";

export const dynamic = "force-dynamic";

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: c } = await supabase
    .from("customers")
    .select(
      "id,name,phone1,phone2,email,company,residency,grad_year,stage,specialty_id,lms_status,source,created_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!c) notFound();

  const { data: specs } = await supabase
    .from("specialties")
    .select("id,name_ar")
    .order("name_ar");

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-extrabold">{c.name}</h1>
        <Link href="/customers" className="text-sm text-muted hover:text-ink">
          ← رجوع للعملاء
        </Link>
      </div>

      <CustomerEdit customer={c} specialties={specs || []} />
    </div>
  );
}
