import { createClient } from "@/lib/supabase/server";
import RealtimeRefresh from "../RealtimeRefresh";
import { hasPerm } from "@/lib/authz";
import NoAccess from "../NoAccess";
import PipelineBoard from "./PipelineBoard";

export const dynamic = "force-dynamic";

export default async function Pipeline({ searchParams }: { searchParams: { q?: string } }) {
  if (!(await hasPerm("can_view_pipeline"))) return <NoAccess />;
  const supabase = createClient();
  const q = (searchParams?.q || "").trim().toLowerCase();
  const { data: { user } } = await supabase.auth.getUser();

  // موجة متوازية: العملاء + الملفات + التسجيلات + صلاحية المالية
  const [rowsRes0, { data: profs }, { data: enr }, { data: me }] = await Promise.all([
    supabase.from("customers").select("id,name,company,phone1,phone2,email,stage,owner_id,created_at").eq("deleted", false).eq("archived", false).eq("board_done", false).order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("enrollments").select("customer_id, diplomas(name_ar), batches(code)").order("enrolled_at", { ascending: true }),
    supabase.from("profiles").select("can_see_finance").eq("id", user?.id || "").maybeSingle(),
  ]);
  const canFinance = !!me?.can_see_finance;
  let rowsRes = rowsRes0;
  if (rowsRes.error) {
    rowsRes = await supabase
      .from("customers")
      .select("id,name,company,phone1,phone2,email,stage,owner_id,created_at")
      .eq("deleted", false)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(500);
  }
  const rows = rowsRes.data;

  const pName = new Map((profs || []).map((p) => [p.id, p.full_name]));

  // الدبلومة + الباتش لكل عميل (أول اشتراك) من جدول enrollments
  const dipName = new Map<string, string>();
  const batchName = new Map<string, string>();
  for (const e of enr || []) {
    const cid = (e as any).customer_id as string;
    const nm = (e as any).diplomas?.name_ar as string | undefined;
    const bc = (e as any).batches?.code as string | undefined;
    if (cid && nm && !dipName.has(cid)) dipName.set(cid, nm);
    if (cid && bc && !batchName.has(cid)) batchName.set(cid, bc);
  }

  let src = rows || [];
  if (q) src = src.filter((c: any) =>
    ((c.name || "") + " " + (c.phone1 || "") + " " + (c.phone2 || "") + " " + (c.email || "")).toLowerCase().includes(q));

  // القيمة المالية (مجموع التعاقدات) لكل عميل — محجوبة خلف صلاحية المالية
  const valByCust = new Map<string, number>();
  const paidByCust = new Map<string, number>();
  if (canFinance) {
    const [{ data: enr2 }, { data: fin }, { data: insts }] = await Promise.all([
      supabase.from("enrollments").select("id,customer_id"),
      supabase.from("enrollment_finance").select("enrollment_id,agreed_amount"),
      supabase.from("installments").select("enrollment_id,amount,status,paid_at"),
    ]);
    const enrToCust = new Map(((enr2 as any[]) || []).map((e) => [e.id, e.customer_id]));
    const agreedByEnr = new Map(((fin as any[]) || []).map((f) => [f.enrollment_id, Number(f.agreed_amount) || 0]));
    for (const e of (enr2 as any[]) || []) {
      const v = agreedByEnr.get(e.id) || 0;
      if (v) valByCust.set(e.customer_id, (valByCust.get(e.customer_id) || 0) + v);
    }
    for (const i of (insts as any[]) || []) {
      if (i.status === "paid" || i.paid_at) {
        const cid = enrToCust.get(i.enrollment_id);
        if (cid) paidByCust.set(cid, (paidByCust.get(cid) || 0) + (Number(i.amount) || 0));
      }
    }
  }

  const items = src.map((c: any) => ({
    id: c.id as string,
    name: (c.name as string) || "—",
    diploma: dipName.get(c.id as string) || "",
    batch: batchName.get(c.id as string) || "",
    phone: (c.phone1 as string) || "",
    stage: (c.stage as string) || "interested",
    ownerId: (c.owner_id as string) || "",
    ownerName: pName.get(c.owner_id || "") || "",
    createdAt: (c.created_at as string) || "",
    value: valByCust.get(c.id as string) || 0,
    paid: paidByCust.get(c.id as string) || 0,
  }));

  return (<><RealtimeRefresh tables={["customers"]} /><PipelineBoard key={q || "all"} initial={items} canFinance={canFinance} /></>);
}
