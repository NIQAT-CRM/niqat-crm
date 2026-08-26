import { createClient } from "@/lib/supabase/server";
import { hasPerm } from "@/lib/authz";
import NoAccess from "../../NoAccess";
import { t as tr } from "@/lib/i18n";
import NewCustomerForm from "./NewCustomerForm";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  if (!(await hasPerm("can_add_customers"))) return <NoAccess />;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // حماية: إضافة عميل تحتاج صلاحية "تعديل العملاء"
  const { data: meProf } = await supabase.from("profiles").select("can_edit_customers").eq("id", user?.id || "").maybeSingle();
  if (!meProf?.can_edit_customers) {
    return (<div className="page-h"><div><h1>{tr("addCust")}</h1><p>{tr("noEditCustomersPerm")}</p></div></div>);
  }
  const [{ data: specs }, { data: dips }, { data: bts }, { data: affRow }, { data: svcTypes }, { data: srcs }, { data: defRow }, { data: edRows }, { data: ctry }, { data: svcPrices }, { data: ryRow }] = await Promise.all([
    supabase.from("specialties").select("id,name_ar").order("name_ar"),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
    supabase.from("batches").select("id,code,price,currency,price_egp,price_usd,diploma_id,status,kind,service_id").order("start_date", { ascending: false }),
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
    supabase.from("service_types").select("slug,name,activation_label,sort").eq("active", true).order("sort"),
    supabase.from("sources").select("name").order("name"),
    supabase.from("app_settings").select("value").eq("key", "defaults").maybeSingle(),
    supabase.rpc("dash_enrollment_diploma"),
    supabase.from("countries").select("name").order("name"),   // جدول اختياري — بيرجع null لو لسه مش متعمل
    supabase.from("services").select("id,base_old,base_recent,base_intl,base_single,normal_pct,affiliate_pct,temp_discount_pct,temp_discount_start,temp_discount_end"),
    supabase.from("app_settings").select("value").eq("key", "recent_grad_years").maybeSingle(),
  ]);
  const frequentDiplomas = ((edRows as any[]) || [])
    .filter((r) => r.diploma_id)
    .sort((a, b) => Number(b.n) - Number(a.n))
    .slice(0, 5)
    .map((r) => r.diploma_id as string);
  const affiliates = Array.isArray(affRow?.value) ? (affRow!.value as any[]) : [];
  const openB = (bts || []).filter((b) => { const s = (b as any).status; return !s || s === "open"; });
  const svcMap = new Map<string, any>();
  const todayCairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const activeTempPct = (sv: any) => {
    const p = Number(sv.temp_discount_pct) || 0;
    if (p <= 0) return 0;
    if (sv.temp_discount_start && String(sv.temp_discount_start) > todayCairo) return 0;
    if (sv.temp_discount_end && String(sv.temp_discount_end) < todayCairo) return 0;
    return p;
  };
  for (const sv of ((svcPrices as any[]) || [])) svcMap.set(sv.id, sv);
  const mapB = (b: any) => {
    const svc = b.service_id ? svcMap.get(b.service_id) : null;
    return { id: b.id, name: b.code, price: Number(b.price) || 0, currency: b.currency || "EGP", price_egp: Number(b.price_egp) || 0, price_usd: Number(b.price_usd) || 0, diploma_id: b.diploma_id || "", kind: b.kind || "diploma", status: b.status || "", service_id: b.service_id || null, svc: svc ? { base_old: svc.base_old, base_recent: svc.base_recent, base_intl: svc.base_intl, base_single: svc.base_single, normal_pct: svc.normal_pct, affiliate_pct: svc.affiliate_pct, temp_pct: activeTempPct(svc) } : null };
  };
  const recentYears: number[] = Array.isArray((ryRow as any)?.value?.years) ? (ryRow as any).value.years : [];
  return (
    <div style={{ maxWidth: 620 }}>
      <div className="page-h"><h1>{tr("addCust")}</h1></div>
      <NewCustomerForm
        specialties={(specs || []).map((s) => ({ id: s.id, name: s.name_ar }))}
        diplomas={(dips || []).map((d) => ({ id: d.id, name: d.name_ar }))}
        batches={openB.filter((b: any) => (b.kind || "diploma") === "diploma").map(mapB)}
        services={openB.filter((b: any) => b.kind && b.kind !== "diploma").map(mapB)}
        meId={user?.id || ""}
        affiliates={affiliates as any}
        serviceTypes={((svcTypes as any[]) || []).map((t) => ({ slug: t.slug, name: t.name, activation_label: t.activation_label }))}
        sources={((srcs as any[]) || []).map((x) => x.name)}
        defaultInst={{ count: Number((defRow as any)?.value?.inst_count) || 3, gap: Number((defRow as any)?.value?.inst_gap) || 1 }}
        frequentDiplomas={frequentDiplomas}
        countries={((ctry as any[]) || []).map((x) => x.name).filter(Boolean)}
        recentYears={recentYears}
      />
    </div>
  );
}
