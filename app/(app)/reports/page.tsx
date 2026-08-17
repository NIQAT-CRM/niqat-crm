import { createClient } from "@/lib/supabase/server";
import { t as tr } from "@/lib/i18n";
import ReportsView from "./ReportsView";
import { type InsightsData } from "./InsightsSection";

export const dynamic = "force-dynamic";

// نطاق الفترة بتوقيت مصر — يرجّع {from,to} ISO أو null لكل الوقت
function periodRange(period: string): { from: string; to: string } | null {
  if (!period || period === "all") return null;
  const now = new Date();
  const to = now.toISOString();
  const cairoMs = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" })).getTime()
    - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const nowCairo = new Date(now.getTime() + cairoMs);
  let from: Date;
  if (period === "today") { const d = new Date(nowCairo); d.setHours(0, 0, 0, 0); from = new Date(d.getTime() - cairoMs); }
  else if (period === "7") from = new Date(now.getTime() - 7 * 864e5);
  else if (period === "30") from = new Date(now.getTime() - 30 * 864e5);
  else if (period === "month") { const d = new Date(nowCairo.getFullYear(), nowCairo.getMonth(), 1); from = new Date(d.getTime() - cairoMs); }
  else return null;
  return { from: from.toISOString(), to };
}

const STAGES: Record<string, { labelKey: string; color: string }> = {
  contacted: { labelKey: "dashStageContacted", color: "var(--teal)" },
  interested: { labelKey: "dashStageInterested", color: "var(--purple)" },
  enrolled: { labelKey: "dashStageEnrolled", color: "var(--green)" },
  onhold: { labelKey: "dashStageOnhold", color: "var(--amber)" },
};
const DC = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B"];

export default async function Reports({ searchParams }: { searchParams?: { period?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles")
    .select("can_view_reports, can_see_finance, can_use_ai").eq("id", user?.id || "").maybeSingle();

  if (!prof?.can_view_reports) {
    return (<div className="page-h"><div><h1>{tr("reports")}</h1><p>{tr("noReportsAccess")}</p></div></div>);
  }
  const canFinance = !!prof.can_see_finance;

  // ==== بوّابة لوحة الرؤى: صلاحية المستخدم (can_use_ai) + سويتش الأدمن (ai_settings.insights_enabled) ====
  let showInsights = false;
  if (prof.can_use_ai) {
    const { data: aiSettings } = await supabase.from("ai_settings")
      .select("insights_enabled").eq("id", 1).maybeSingle();
    showInsights = !!aiSettings?.insights_enabled;
  }

  const period = searchParams?.period || "all";
  const range = periodRange(period);
  const rpcArgs = range ? { p_from: range.from, p_to: range.to } : undefined;

  // ==== لوحة الرؤى: تتشغّل استعلاماتها فقط لو البوّابة مفتوحة (توفير وقت) ====
  const insightsP: Promise<any[] | null> = showInsights ? Promise.all([
    supabase.rpc("ins_top_diplomas", { p_days: 30 }),
    supabase.rpc("ins_peak_hours", { p_days: 30 }),
    supabase.rpc("ins_batches_filling"),
    supabase.rpc("ins_stale_leads", { p_days_idle: 7 }),
    supabase.rpc("ins_collection_trend", { p_days: 30 }),
    supabase.rpc("ins_top_source"),
    supabase.rpc("ins_unassigned_leads"),
    supabase.rpc("ins_stale_tickets", { p_days: 3 }),
    supabase.rpc("ins_pending_handoffs", { p_days: 2 }),
    supabase.rpc("ins_specialty_dist"),
    supabase.rpc("ins_overdue_installments"),
    supabase.rpc("ins_expected_week"),
    supabase.rpc("ins_refunds_month"),
  ]) : Promise.resolve(null);
  const mainP = Promise.all([
    supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
    supabase.from("profiles").select("id,full_name,team"),
    supabase.from("diplomas").select("id,name_ar"),
    supabase.from("refunds").select("customer_id"),
    supabase.from("batches").select("id,code,diploma_id").order("start_date", { ascending: false }),
    supabase.from("tickets").select("assignee_id,status"),
    supabase.rpc("dash_stage_counts", rpcArgs),
    supabase.rpc("dash_enrollment_diploma"),
    supabase.rpc("dash_affiliate_counts"),
    supabase.rpc("dash_owner_customer_counts"),
    supabase.from("batches").select("id,code").neq("kind", "diploma"),
    supabase.from("enrollments").select("batch_id").not("batch_id", "is", null),
    supabase.from("app_settings").select("value").eq("key", "reports_reset_at").maybeSingle(),
    supabase.from("handoff_items").select("done_by,done").eq("done", true),
  ]);
  const [
    insRes,
    [affRes, profRes, dipRes, refundRes, batchRes, tkRes, scRes, edRes, acRes, occRes, svcBatchesRes, svcEnrRes, resetRowRes, hiRes],
  ] = await Promise.all([insightsP, mainP]);

  const emptyInsights: InsightsData = {
    topDip: null, peak: null, batches: [], stale: { count: 0, list: [] },
    trend: null, topSource: null, unassigned: { count: 0, list: [] },
    staleTickets: { count: 0, list: [] }, pendingHandoffs: { count: 0, list: [] },
    specialtyDist: [], overdue: null, expectedWeek: null, refundsMonth: null,
  };
  const insights: InsightsData = insRes ? {
    topDip: ((insRes[0].data as any[]) || [])[0] || null,
    peak: (insRes[1].data as any) || null,
    batches: (insRes[2].data as any[]) || [],
    stale: (insRes[3].data as any) || { count: 0, list: [] },
    trend: (insRes[4].data as any) || null,
    topSource: (insRes[5].data as any) || null,
    unassigned: (insRes[6].data as any) || { count: 0, list: [] },
    staleTickets: (insRes[7].data as any) || { count: 0, list: [] },
    pendingHandoffs: (insRes[8].data as any) || { count: 0, list: [] },
    specialtyDist: (insRes[9].data as any[]) || [],
    overdue: (insRes[10].data as any) || null,
    expectedWeek: (insRes[11].data as any) || null,
    refundsMonth: (insRes[12].data as any) || null,
  } : emptyInsights;

  const profiles = (profRes.data as any[]) || [];
  const diplomas = (dipRes.data as any[]) || [];
  const pName = new Map(profiles.map((p) => [p.id, p.full_name]));
  const dName = new Map(diplomas.map((d: any) => [d.id, d.name_ar]));

  // ==== المراحل (دالة القاعدة — بدون سقف) ====
  const stageCount: Record<string, number> = {};
  for (const r of (scRes.data as any[]) || []) stageCount[r.stage] = Number(r.n) || 0;
  const stageRows = Object.keys(STAGES).map((k) => ({
    key: k, label: tr(STAGES[k].labelKey), color: STAGES[k].color, n: stageCount[k] || 0,
  }));
  const totalCust = Object.values(stageCount).reduce((a, b) => a + b, 0);

  // ==== أفضل الدبلومات (دالة القاعدة) ====
  const dipCount: Record<string, number> = {};
  for (const r of (edRes.data as any[]) || []) dipCount[r.diploma_id] = Number(r.n) || 0;
  const byDiploma = Object.entries(dipCount)
    .map(([id, n], i) => ({ label: dName.get(id) || "—", value: n, color: DC[i % DC.length] }))
    .sort((a, b) => b.value - a.value);

  // ==== أكثر الخدمات (اعتمادات/مشاريع) اشتراكاً ====
  const svcBatches = svcBatchesRes.data as any[] | null;
  const svcIds = new Set((svcBatches || []).map((b: any) => b.id));
  const svcCode = new Map((svcBatches || []).map((b: any) => [b.id, b.code]));
  const svcEnrRows = svcEnrRes.data as any[] | null;
  const svcCount: Record<string, number> = {};
  (svcEnrRows || []).forEach((e: any) => { if (svcIds.has(e.batch_id)) svcCount[e.batch_id] = (svcCount[e.batch_id] || 0) + 1; });
  const byService = Object.entries(svcCount)
    .map(([id, n], i) => ({ label: svcCode.get(id) || "—", value: n, color: DC[i % DC.length] }))
    .sort((a, b) => b.value - a.value);

  // ==== الريفند لكل كود ====
  const refundIds = Array.from(new Set(((refundRes.data as any[]) || []).map((r) => r.customer_id)));
  const refundCodeCount: Record<string, number> = {};
  if (refundIds.length) {
    const { data: refCusts } = await supabase.from("customers").select("affiliate_code").in("id", refundIds);
    (refCusts || []).forEach((c: any) => { const code = (c.affiliate_code || "").trim(); if (code) refundCodeCount[code] = (refundCodeCount[code] || 0) + 1; });
  }

  // تاريخ تصفير القياس (اختياري) — يبدأ القياس من عند بدء الشغل الفعلي
  const resetRow = resetRowRes.data as any;
  const resetAt: string = typeof resetRow?.value === "string" ? resetRow.value : ((resetRow?.value as any)?.at || "");

  // ==== المالية مفصولة بالعملة (دالة fin_totals) + المحصّل لكل مندوب + المتأخرات ====
  let agreed = 0, collected = 0, overdueN = 0, agreedUsd = 0, collectedUsd = 0;
  const monthlyMap: Record<string, number> = {};
  const collectedByOwner: Record<string, { egp: number; usd: number }> = {};
  if (canFinance) {
    const [{ data: ft }, { data: oc }, { data: odn }] = await Promise.all([
      supabase.rpc("fin_totals", rpcArgs),
      supabase.rpc("fin_collected_by_owner", rpcArgs),
      supabase.rpc("fin_overdue_count"),
    ]);
    for (const r of (ft as any[]) || []) {
      if (r.currency === "USD") { collectedUsd = Number(r.collected) || 0; agreedUsd = Number(r.agreed) || 0; }
      else { collected += Number(r.collected) || 0; agreed += Number(r.agreed) || 0; }
    }
    for (const r of (oc as any[]) || []) collectedByOwner[r.owner_id] = { egp: Number(r.egp) || 0, usd: Number(r.usd) || 0 };
    overdueN = Number(odn) || 0;

    // شهري (بالجنيه) — أقساط مدفوعة ليها تاريخ فعلي خلال آخر 6 شهور (أو من تاريخ التصفير)
    const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth() - 6);
    const startFilter = resetAt && resetAt > sixMo.toISOString() ? resetAt : sixMo.toISOString();
    const { data: mInsts } = await supabase.from("installments")
      .select("amount,paid_at,status,currency")
      .not("paid_at", "is", null).gte("paid_at", startFilter).eq("currency", "EGP");
    for (const i of (mInsts as any[]) || []) {
      if (i.status === "paid" || i.paid_at) { const m = String(i.paid_at).slice(0, 7); monthlyMap[m] = (monthlyMap[m] || 0) + (Number(i.amount) || 0); }
    }
  }

  // آخر 6 شهور — نمرّر المفتاح (YYYY-MM) والعرض يترجم الاسم حسب اللغة
  const monthly: { key: string; value: number }[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(); d.setMonth(d.getMonth() - k);
    const key = d.toISOString().slice(0, 7);
    monthly.push({ key, value: Math.round(monthlyMap[key] || 0) });
  }

  // ==== أداء المبيعات (team=sales/admin) — من دالة عدّ العملاء لكل مندوب ====
  const ownerCounts = new Map<string, { total: number; enrolled: number }>();
  for (const r of (occRes.data as any[]) || []) ownerCounts.set(r.owner_id, { total: Number(r.total) || 0, enrolled: Number(r.enrolled) || 0 });
  const salesIds = profiles.filter((p) => p.team === "sales" || p.team === "admin").map((p) => p.id);
  const salesRows = salesIds.map((id) => {
    const oc2 = ownerCounts.get(id) || { total: 0, enrolled: 0 };
    const co = collectedByOwner[id] || { egp: 0, usd: 0 };
    return {
      name: pName.get(id) || "—", customers: oc2.total, enrolled: oc2.enrolled,
      conv: oc2.total ? Math.round((oc2.enrolled / oc2.total) * 100) : 0,
      collectedEgp: Math.round(co.egp), collectedUsd: Math.round(co.usd),
    };
  }).filter((r) => r.customers > 0).sort((a, b) => b.customers - a.customers);

  // ==== أداء الدعم — قياس كل الشغل: التفعيلات (بنود handoff تمّت) + التذاكر ====
  // التفعيلات لكل شخص = عدد بنود handoff_items اللي علّمها done (done_by).
  const actAgg: Record<string, number> = {};
  let actTeamTotal = 0;
  ((hiRes.data as any[]) || []).forEach((it) => {
    actTeamTotal++;
    if (it.done_by) actAgg[it.done_by] = (actAgg[it.done_by] || 0) + 1;
  });
  // التذاكر لكل شخص + إجمالي الفريق (بيضم كمان التذاكر غير المُسنَدة لأي حد)
  const tkAgg: Record<string, { total: number; open: number; closed: number }> = {};
  const tkTeam = { total: 0, open: 0, closed: 0 };
  ((tkRes.data as any[]) || []).forEach((t) => {
    const closed = t.status === "closed" || t.status === "resolved";
    tkTeam.total++; if (closed) tkTeam.closed++; else tkTeam.open++;
    const id = t.assignee_id; if (!id) return;
    if (!tkAgg[id]) tkAgg[id] = { total: 0, open: 0, closed: 0 };
    tkAgg[id].total++; if (closed) tkAgg[id].closed++; else tkAgg[id].open++;
  });
  // نسرد كل أفراد الدعم + أي حد عمل تفعيلات/اتسندله تذاكر (عشان مايضيعش أي أداء)
  const supIds = Array.from(new Set<string>([
    ...profiles.filter((p) => p.team === "support").map((p) => p.id),
    ...Object.keys(actAgg), ...Object.keys(tkAgg),
  ]));
  const supportRows = supIds.map((id) => {
    const t = tkAgg[id] || { total: 0, open: 0, closed: 0 };
    return { name: pName.get(id) || "—", activations: actAgg[id] || 0, total: t.total, open: t.open, closed: t.closed };
  }).sort((a, b) => (b.activations + b.total) - (a.activations + a.total));
  const supportTotals = { activations: actTeamTotal, total: tkTeam.total, open: tkTeam.open, closed: tkTeam.closed };

  // ==== الأفيلييت (دالة القاعدة) ====
  const affList: any[] = Array.isArray(affRes.data?.value) ? (affRes.data!.value as any[]) : [];
  const affName = new Map(affList.map((a) => [a.code, a]));
  const affAgg: Record<string, { customers: number; enrolled: number }> = {};
  for (const r of (acRes.data as any[]) || []) affAgg[r.code] = { customers: Number(r.customers) || 0, enrolled: Number(r.enrolled) || 0 };
  Object.keys(refundCodeCount).forEach((code) => { if (!affAgg[code]) affAgg[code] = { customers: 0, enrolled: 0 }; });
  const affRows = Object.entries(affAgg).map(([code, v]) => ({
    code, name: affName.get(code)?.name || "—", discount: affName.get(code)?.discount ?? null,
    customers: v.customers, enrolled: v.enrolled,
    interested: Math.max(0, v.customers - v.enrolled), refunded: refundCodeCount[code] || 0,
  })).sort((a, b) => b.customers - a.customers);

  const batchOpts = ((batchRes.data as any[]) || []).map((b) => ({ v: b.id, label: b.code, dip: b.diploma_id || "" }));
  const diplomaOpts = diplomas.map((d: any) => ({ v: d.id, label: d.name_ar }));
  const affiliatesList = affList.map((a: any) => ({ code: (a.code || "").toUpperCase(), name: a.name || "—", rate: Number(a.rate) || 0, discount: Number(a.discount) || 0, phone: (a.phone || "").trim() }));
  const { data: rateRow } = await supabase.from("app_settings").select("value").eq("key", "usd_rate").maybeSingle();
  const usdRate = Number(rateRow?.value) || 44;
  const { data: payoutsRows } = await supabase.from("affiliate_payouts").select("code,amount,paid_at,customers_count,note").order("paid_at", { ascending: false });
  const affPayouts = ((payoutsRows as any[]) || []).map((p) => ({ code: (p.code || "").toUpperCase(), amount: Number(p.amount) || 0, paidAt: p.paid_at, count: p.customers_count || 0, note: p.note || "" }));

  // ===== تقرير الاستردادات (لأصحاب صلاحية المالية) =====
  let refundReport: any = null;
  if (canFinance) {
    const { data: rfRows } = await supabase.from("refunds")
      .select("id,amount,status,closes_service,enrollment_id,addon_id,customer_id,created_at")
      .order("created_at", { ascending: false });
    const rows = (rfRows as any[]) || [];
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const count = rows.length;
    const avg = count ? Math.round(total / count) : 0;
    const enrIds = Array.from(new Set(rows.map((r) => r.enrollment_id).filter(Boolean)));
    const addonIds = Array.from(new Set(rows.map((r) => r.addon_id).filter(Boolean)));
    const custIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)));
    const enrMap = new Map<string, any>();
    if (enrIds.length) { const { data: e } = await supabase.from("enrollments").select("id,diploma_id,batch_id").in("id", enrIds); (e || []).forEach((x: any) => enrMap.set(x.id, x)); }
    const addonMap = new Map<string, string>();
    if (addonIds.length) { const { data: a } = await supabase.from("customer_addons").select("id,name").in("id", addonIds); (a || []).forEach((x: any) => addonMap.set(x.id, x.name || "")); }
    const custName = new Map<string, string>();
    if (custIds.length) { const { data: c } = await supabase.from("customers").select("id,name").in("id", custIds); (c || []).forEach((x: any) => custName.set(x.id, x.name || "")); }
    const bCode = new Map(((batchRes.data as any[]) || []).map((b: any) => [b.id, b.code]));
    const svcLabel = (r: any) => {
      if (r.enrollment_id) { const e = enrMap.get(r.enrollment_id); const dn = e ? dName.get(e.diploma_id) : ""; const bc = e && e.batch_id ? bCode.get(e.batch_id) : ""; return dn ? (dn + (bc ? " · " + bc : "")) : (bc || "—"); }
      if (r.addon_id) return addonMap.get(r.addon_id) || "—";
      return "—";
    };
    const bySvc: Record<string, number> = {};
    rows.forEach((r) => { const l = svcLabel(r); bySvc[l] = (bySvc[l] || 0) + (Number(r.amount) || 0); });
    const breakdown = Object.entries(bySvc).map(([label, amount]) => ({ label, amount: Math.round(amount as number) })).sort((a, b) => b.amount - a.amount).slice(0, 8);
    const maxBd = Math.max(...breakdown.map((b) => b.amount), 1);
    const recent = rows.slice(0, 200).map((r) => ({
      customer: custName.get(r.customer_id) || "—",
      service: svcLabel(r),
      amount: Math.round(Number(r.amount) || 0),
      status: r.status === "closed" ? "closed" : (!r.closes_service ? "partial" : "progress"),
    }));
    refundReport = { total: Math.round(total), count, avg, breakdown, maxBd, recent };
  }

  return (
    <ReportsView
      canFinance={canFinance}
      refundReport={refundReport}
      agreed={Math.round(agreed)} collected={Math.round(collected)} overdueN={overdueN}
      agreedUsd={Math.round(agreedUsd)} collectedUsd={Math.round(collectedUsd)}
      stageRows={stageRows} totalCust={totalCust} affRows={affRows}
      salesRows={salesRows} supportRows={supportRows} supportTotals={supportTotals} monthly={monthly} byDiploma={byDiploma} byService={byService}
      batchOpts={batchOpts} diplomaOpts={diplomaOpts} affiliates={affiliatesList} usdRate={usdRate} affPayouts={affPayouts}
      resetAt={resetAt}
      insights={insights}
    />
  );
}
