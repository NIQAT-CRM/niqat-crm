import { hasPerm } from "@/lib/authz";
import NoAccess from "../NoAccess";
import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import BatchesView from "./BatchesView";
export const dynamic = "force-dynamic";

export default async function Batches() {
  if (!(await hasPerm("can_view_batches"))) return <NoAccess />;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // موجة متوازية: الصلاحية + الباتشات + الدبلومات + الحجوزات (كلهم مستقلين)
  const [
    { data: meB },
    bFull,
    bd,
    { data: allDips },
    { data: svcTypes },
  ] = await Promise.all([
    supabase.from("profiles").select("can_manage_batches").eq("id", user?.id || "").maybeSingle(),
    supabase.from("batches").select("id,code,status,start_date,end_date,capacity,notes,price,currency,price_egp,price_usd,kind,service_id,price_frozen_at,done").order("created_at", { ascending: false }),
    supabase.from("batches").select("id,diploma_id"),
    supabase.from("diplomas").select("id,name_ar,batch_code_prefix").order("name_ar"),
    supabase.from("service_types").select("slug,name,sort").eq("active", true).order("sort"),
  ]);
  const canManage = !!meB?.can_manage_batches;

  let batches: any[] = [];
  if (bFull.error) {
    const bMin = await supabase.from("batches")
      .select("id,code,status,start_date,capacity,notes")
      .order("created_at", { ascending: false });
    batches = bMin.data || [];
  } else batches = bFull.data || [];

  // الدبلومة لكل باتش (دفاعي)
  const dMap = new Map<string, string>();
  const dipName = new Map((allDips || []).map((d: any) => [d.id, d.name_ar]));
  if (!bd.error) for (const r of (bd.data as any[]) || []) if (r.diploma_id) dMap.set(r.id, dipName.get(r.diploma_id) || "");

  // عدد المشتركين الفعلي لكل باتش (count مستقل يتجاوز حد الـ1000 صف)
  const cntPairs = await Promise.all(
    (batches || []).map(async (b: any) => {
      try {
        const r: any = await supabase.rpc("batch_subscriber_count", { p_batch_id: b.id });
        if (r && !r.error && r.data != null) return [b.id as string, Number(r.data) || 0] as const;
      } catch { /* نرجع للعدّ القديم */ }
      const r2 = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", b.id);
      return [b.id as string, r2.count || 0] as const;
    })
  );
  const cnt = new Map<string, number>(cntPairs);

  // الخدمات (للربط) + السعر الفعّال لكل باتش مربوط (حيّ/متجمّد) — إضافة، مايكسرش حاجة
  let servicesList: any[] = [];
  const epriceMap = new Map<string, any>();
  try {
    const { data: svcs } = await supabase.from("services").select("id,name,code").order("name");
    servicesList = svcs || [];
    const linked = (batches || []).filter((b: any) => b.service_id);
    const pricePairs = await Promise.all(linked.map(async (b: any) => {
      try { const r: any = await supabase.rpc("batch_effective_price", { p_batch_id: b.id }); return [b.id as string, (r.data && r.data[0]) || null] as const; }
      catch { return [b.id as string, null] as const; }
    }));
    for (const [id, p] of pricePairs) if (p) epriceMap.set(id, p);
  } catch { /* الباك-إند لسه؟ نتجاهل بأمان */ }

  const viewData = (batches || []).map((b) => ({
    id: b.id as string,
    code: (b.code as string) || "",
    diploma: dMap.get(b.id as string) || "",
    diploma_id: "",
    status: (b.status as string) || "open",
    start_date: (b.start_date as string) || null,
    end_date: (b.end_date as string) || null,
    capacity: (b.capacity as number) ?? null,
    enrolled: cnt.get(b.id as string) || 0,
    price: ((b as any).price as number) ?? null,
    currency: ((b as any).currency as string) || "EGP",
    price_egp: ((b as any).price_egp as number) ?? null,
    price_usd: ((b as any).price_usd as number) ?? null,
    kind: ((b as any).kind as string) || "diploma",
    notes: (b.notes as string) || null,
    service_id: ((b as any).service_id as string) || null,
    price_frozen_at: ((b as any).price_frozen_at as string) || null,
    done: !!(b as any).done,
    eprice: epriceMap.get(b.id as string) || null,
  }));
  // ربط diploma_id لكل باتش (للفلترة)
  if (!bd.error) for (const r of (bd.data as any[]) || []) {
    const row = viewData.find((v) => v.id === r.id);
    if (row && r.diploma_id) row.diploma_id = r.diploma_id;
  }

  const diplomaOpts = (allDips || []).map((d: any) => ({ v: d.id, label: d.name_ar }));

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("batches")}</h1>
          <p>{(batches || []).length} {tr("batchWord")}</p>
        </div>
      </div>
      <BatchesView batches={viewData} canManage={canManage} diplomaOpts={diplomaOpts}
        diplomas={(allDips || []).map((d: any) => ({ id: d.id, name: d.name_ar, prefix: d.batch_code_prefix || "" }))}
        serviceTypes={((svcTypes as any[]) || []).map((t) => ({ slug: t.slug, name: t.name }))}
        services={(servicesList as any[]).map((sv) => ({ id: sv.id, name: sv.name, code: sv.code }))} />
    </div>
  );
}
