import { createClient } from "@/lib/supabase/server";

export type CustFilterSP = {
  q?: string; stage?: string; owner?: string; dip?: string;
  spec?: string; batch?: string; company?: string; pay?: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const arr = (s?: string) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

export async function filteredCustomerIds(sp: CustFilterSP): Promise<string[]> {
  const q = (sp?.q || "").trim();
  const stageVals = arr(sp.stage);
  const specVals = arr(sp.spec);
  const ownerVals = arr(sp.owner);
  const companyVals = arr(sp.company);
  const dipVals = arr(sp.dip);
  const batchVals = arr(sp.batch);
  const payVals = arr(sp.pay);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meProf } = await supabase.from("profiles").select("can_see_finance").eq("id", user?.id || "").maybeSingle();
  const canFinance = !!meProf?.can_see_finance;

  const payBalanceSet = new Set<string>();
  const payDueSet = new Set<string>();
  const payOverdueSet = new Set<string>();
  if (payVals.length && canFinance) {
    const PAGE = 1000, CAP = 60000, CHUNK = 150, today = todayStr();
    const enrFlags = new Map<string, { due: boolean; over: boolean }>();
    for (let from = 0; from < CAP; from += PAGE) {
      const { data, error } = await supabase.from("installments")
        .select("enrollment_id,due_date,paid_at,status").neq("status", "paid").range(from, from + PAGE - 1);
      if (error) break;
      const rows = (data as any[]) || [];
      for (const i of rows) {
        if (i.paid_at) continue;
        const eid = i.enrollment_id; if (!eid) continue;
        const fl = enrFlags.get(eid) || { due: false, over: false };
        if (i.due_date) { fl.due = true; if (String(i.due_date).slice(0, 10) < today) fl.over = true; }
        enrFlags.set(eid, fl);
      }
      if (rows.length < PAGE) break;
    }
    const enrIds = Array.from(enrFlags.keys());
    for (let c = 0; c < enrIds.length; c += CHUNK) {
      const { data } = await supabase.from("enrollments").select("id,customer_id").in("id", enrIds.slice(c, c + CHUNK));
      for (const e of (data as any[]) || []) {
        const cid = e.customer_id; if (!cid) continue;
        const fl = enrFlags.get(e.id); if (!fl) continue;
        payBalanceSet.add(cid);
        if (fl.due) payDueSet.add(cid);
        if (fl.over) payOverdueSet.add(cid);
      }
    }
  }

  async function enrollCustomerIds(col: "diploma_id" | "batch_id", vals: string[]) {
    const set = new Set<string>();
    const P = 1000, C = 60000;
    for (let from = 0; from < C; from += P) {
      const { data } = await supabase.from("enrollments").select("customer_id").in(col, vals).range(from, from + P - 1);
      const rows = (data as any[]) || [];
      for (const r of rows) if (r.customer_id) set.add(r.customer_id);
      if (rows.length < P) break;
    }
    return set;
  }

  const payActive = !!(payVals.length && canFinance);
  const restrictSets: Set<string>[] = [];
  if (payActive) {
    const u = new Set<string>();
    if (payVals.includes("overdue") || payVals.includes("over")) payOverdueSet.forEach((x) => u.add(x));
    if (payVals.includes("due")) payDueSet.forEach((x) => u.add(x));
    if (payVals.includes("bal")) payBalanceSet.forEach((x) => u.add(x));
    restrictSets.push(u);
  }
  if (dipVals.length) restrictSets.push(await enrollCustomerIds("diploma_id", dipVals));
  if (batchVals.length) restrictSets.push(await enrollCustomerIds("batch_id", batchVals));

  const applyCols = (sub: any) => {
    if (q) sub = sub.or(`name.ilike.%${q}%,phone1.ilike.%${q}%,email.ilike.%${q}%`);
    if (stageVals.length) sub = sub.in("stage", stageVals);
    if (specVals.length) sub = sub.in("specialty_id", specVals);
    if (companyVals.length) sub = sub.in("company", companyVals);
    if (ownerVals.length) {
      const hasNone = ownerVals.includes("none");
      const ids = ownerVals.filter((v) => v !== "none");
      if (hasNone && ids.length) sub = sub.or(`owner_id.is.null,owner_id.in.(${ids.join(",")})`);
      else if (hasNone) sub = sub.is("owner_id", null);
      else sub = sub.in("owner_id", ids);
    }
    return sub;
  };

  const restrictActive = restrictSets.length > 0;
  const out = new Set<string>();

  if (restrictActive) {
    let inter = restrictSets[0];
    for (let k = 1; k < restrictSets.length; k++) inter = new Set([...inter].filter((id) => restrictSets[k].has(id)));
    const restrictIds = Array.from(inter);
    if (!restrictIds.length) return [];
    const CH = 100;
    for (let i = 0; i < restrictIds.length; i += CH) {
      let sub = supabase.from("customers").select("id")
        .eq("deleted", false).not("archived", "is", true).in("id", restrictIds.slice(i, i + CH));
      sub = applyCols(sub);
      const { data } = await sub;
      for (const r of (data as any[]) || []) out.add(r.id);
    }
  } else {
    const P = 1000, C = 200000;
    for (let from = 0; from < C; from += P) {
      let cq = supabase.from("customers").select("id")
        .eq("deleted", false).not("archived", "is", true);
      cq = applyCols(cq);
      const { data, error } = await cq.order("created_at", { ascending: false }).range(from, from + P - 1);
      if (error) break;
      const rows = (data as any[]) || [];
      for (const r of rows) out.add(r.id);
      if (rows.length < P) break;
    }
  }
  return Array.from(out);
}
