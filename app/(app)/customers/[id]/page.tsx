import { notFound } from "next/navigation";
import { hasPerm } from "@/lib/authz";
import NoAccess from "../../NoAccess";
import RealtimeRefresh from "../../RealtimeRefresh";
import { createClient } from "@/lib/supabase/server";
import CustomerDrawer from "./CustomerDrawer";
import CopyNumbers from "./CopyNumbers";
import StagePicker from "./StagePicker";
import { DrawerScrim, DrawerCloseButton } from "./DrawerClose";
import { getLang, tFor } from "@/lib/i18n";
import { receiptSignedUrl } from "@/lib/supabase/receipts";

export const dynamic = "force-dynamic";

const STAGE: Record<string, { labelKey: string; color: string }> = {
  contacted: { labelKey: "dashStageContacted", color: "var(--teal)" },
  interested: { labelKey: "dashStageInterested", color: "var(--purple)" },
  enrolled: { labelKey: "dashStageEnrolled", color: "var(--green)" },
  onhold: { labelKey: "dashStageOnhold", color: "var(--amber)" },
};

const AUDIT_KEYS: Record<string, string> = {
  batch_transfer: "auditBatchTransfer", enrollment_add: "auditEnrollmentAdd",
  installment_add: "auditInstallmentAdd", installment_paid: "auditInstallmentPaid",
  create: "auditCreate", update: "auditUpdate", stage_change: "auditStageChange",
  refund_request: "auditRefundRequest", refunded: "auditRefunded", handoff: "auditHandoff",
  handoff_requested: "auditHandoffRequested", stage_paid: "auditStagePaidTl",
  agreed_edit: "auditAgreedEdit", refund_cancel: "auditRefundCancelTl", handoff_canceled: "auditHandoffCanceledTl",
};

const TK: Record<string, { labelKey: string; color: string }> = {
  open: { labelKey: "openLabel", color: "var(--blue)" }, progress: { labelKey: "inProgressLabel", color: "var(--amber)" },
  resolved: { labelKey: "resolvedLabel", color: "var(--green)" }, closed: { labelKey: "closedLabel", color: "#94A2BB" },
};

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  if (!(await hasPerm("can_view_customers"))) return <NoAccess />;
  const supabase = createClient();
  const tr = tFor(getLang());
  const { data: { user } } = await supabase.auth.getUser();

  // ===== الموجة المتوازية: كل الاستعلامات المستقلة عن بعضها تتنفّذ مع بعض =====
  const [
    { data: meProf },
    { data: c },
    { data: specs },
    { data: enrRows },
    { data: allDips },
    { data: allBatches },
    { data: profs },
    { data: taskRows },
    { data: commRows },
    { data: auditRows },
    { data: tickets },
    { data: hoRows },
    { data: accOpts },
    { data: libOpts },
    docsRes,
    { data: fuRows },
    { data: tplRows },
    adRes,
    { data: accredRows },
    { data: projRows },
    { data: svcTypeRows },
    { data: svcItemRows },
    { data: ctry },
  ] = await Promise.all([
    supabase.from("profiles").select("can_see_finance,can_message,can_manage_batches,can_edit_customers,team").eq("id", user?.id || "").maybeSingle(),
    supabase.from("customers").select("id,name,phone1,phone2,email,company,residency,grad_year,stage,specialty_id,lms_status,source,affiliate_code,onhold_reason,created_at,terms_signed,terms_signed_at,handed_off,owner_id").eq("id", params.id).maybeSingle(),
    supabase.from("specialties").select("id,name_ar").order("name_ar"),
    supabase.from("enrollments").select("id,status,diploma_id,batch_id,transfer_count, diplomas(name_ar), batches(code)").eq("customer_id", params.id),
    supabase.from("diplomas").select("id,name_ar").order("name_ar"),
    supabase.from("batches").select("id,code,status,diploma_id,done,price,currency,price_egp,price_usd").order("code"),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("tasks").select("id,title,due_at,done").eq("customer_id", params.id).order("created_at", { ascending: false }),
    supabase.from("communications").select("id,body,by_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(50),
    supabase.from("audit_log").select("action,detail,actor_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(60),
    supabase.from("tickets").select("id,title,status").eq("customer_id", params.id).eq("archived", false).order("created_at", { ascending: false }),
    supabase.from("handoffs").select("id,status,note,assignee_id,created_by,created_at").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("access_options").select("id,label").order("label"),
    supabase.from("libraries").select("id,name").order("name"),
    supabase.from("customer_docs").select("id,url,name,created_at").eq("customer_id", params.id).order("created_at", { ascending: false }),
    supabase.from("follow_ups").select("id,due_at,note,done").eq("customer_id", params.id).order("due_at", { ascending: false }),
    supabase.from("wa_templates").select("id,name,body").order("created_at"),
    supabase.from("customer_addons").select("id,type,name,amount,free,note,paid,shot_url,refunded").eq("customer_id", params.id).order("created_at"),
    supabase.from("batches").select("code").eq("kind", "accreditation").order("code"),
    supabase.from("batches").select("code").eq("kind", "project").order("code"),
    supabase.from("service_types").select("slug,name,sort").eq("active", true).order("sort"),
    supabase.from("batches").select("code,kind,price_egp,price_usd").neq("kind", "diploma").order("code"),
    supabase.from("countries").select("name").order("name"),   // جدول اختياري — null لو لسه مش متعمل
  ]);

  const canFinance = !!meProf?.can_see_finance;
  const canMessage = !!meProf?.can_message;
  const canManageBatches = !!meProf?.can_manage_batches;
  const canEdit = !!meProf?.can_edit_customers;
  const myTeam = String(meProf?.team || "").toLowerCase();

  if (!c) notFound();

  const enrolls = (enrRows || []).map((e: any) => ({
    id: e.id, diploma: e.diplomas?.name_ar || "—", batch: e.batches?.code || "—",
    diplomaId: e.diploma_id || "", batchId: e.batch_id || "",
    transferCount: Number(e.transfer_count) || 0, status: e.status || "active",
  }));
  const dipOpts = (allDips || []).map((d: any) => ({ v: d.id, label: d.name_ar }));
  const batchOpts = (allBatches || []).map((b: any) => ({ v: b.id, label: b.code, dip: b.diploma_id || "", status: b.status || "", done: !!b.done, price: Number(b.price) || 0, currency: b.currency || "EGP", price_egp: Number(b.price_egp) || 0, price_usd: Number(b.price_usd) || 0 }));

  const pMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
  const tasks = (taskRows || []).map((k: any) => ({ id: k.id, title: k.title || "", due: k.due_at ? String(k.due_at).slice(0, 10) : "", done: !!k.done }));
  const notes = (commRows || []).map((n: any) => ({ id: n.id, body: n.body || "", by: pMap.get(n.by_id || "") || "—", at: String(n.at || "").replace("T", " ").slice(0, 16) }));

  // ===== المالية: تعتمد على canFinance + enrolls (تفضل بعد الموجة) =====
  let finEnrollments: any[] = [];
  if (canFinance && enrolls.length) {
    const enrs = enrRows || [];
    const ids = enrs.map((e: any) => e.id);
    if (ids.length) {
      const [{ data: fin }, { data: insts }] = await Promise.all([
        supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", ids),
        supabase.from("installments").select("id,enrollment_id,amount,currency,due_date,paid_at,status,screenshot_url").in("enrollment_id", ids).order("due_date", { ascending: true }),
      ]);
      const dName = new Map((allDips || []).map((d: any) => [d.id, d.name_ar]));
      const finMap = new Map((fin || []).map((f: any) => [f.enrollment_id, f]));
      finEnrollments = await Promise.all(enrs.map(async (e: any) => {
        const f: any = finMap.get(e.id);
        return {
          id: e.id, diploma: dName.get(e.diploma_id || "") || "—", status: e.status || "",
          batchId: e.batch_id || "", batch: e.batches?.code || "",
          free: !!(e as any).free, freeReason: (e as any).free_reason || "",
          agreed: Number(f?.agreed_amount) || 0, currency: f?.currency || "EGP",
          installments: await Promise.all((insts || []).filter((i: any) => i.enrollment_id === e.id).map(async (i: any) => ({
            id: i.id, amount: Number(i.amount) || 0, currency: i.currency || "EGP",
            due: i.due_date ? String(i.due_date).slice(0, 10) : "", status: i.status || "pending", paidAt: i.paid_at || null,
            shot: (i as any).screenshot_url ? await receiptSignedUrl(supabase, (i as any).screenshot_url) : null,
          }))),
        };
      }));
    }
  }

  // ===== handoff_items: تعتمد على hoRows (تفضل بعد الموجة) =====
  const ho: any = (hoRows || [])[0] || null;
  let accessItems: any[] = [];
  if (ho) {
    const { data: it } = await supabase.from("handoff_items")
      .select("id,label,done,done_by,done_at").eq("handoff_id", ho.id).order("id");
    accessItems = (it || []).map((x: any) => ({ id: x.id, label: x.label, done: !!x.done, done_by: pMap.get(x.done_by || "") || null, done_at: x.done_at || null }));
  }
  const handoff = ho ? { id: ho.id, status: ho.status || "pending", note: ho.note || "", assignee: pMap.get(ho.assignee_id || "") || "", by: pMap.get(ho.created_by || "") || "", at: String(ho.created_at || "").replace("T", " ").slice(0, 16) } : null;

  const docsMissing = !!docsRes.error;
  const docs = await Promise.all((docsRes.data || []).map(async (d: any) => ({ id: d.id, url: await receiptSignedUrl(supabase, d.url), name: d.name || tr("docFallback"), at: String(d.created_at || "").slice(0, 10) })));

  const fuAll = (fuRows || []).map((x: any) => ({ id: x.id, due_at: x.due_at, note: x.note || "", done: !!x.done }));
  const fuOpen = fuAll.find((x: any) => !x.done) || null;

  // ===== refunds: كل ريفندات العميل (يفضل بعد الموجة) =====
  let refunds: any[] = [];
  let refundTableMissing = false;
  if (canFinance) {
    const { data: rf, error: rfErr } = await supabase.from("refunds")
      .select("id,enrollment_id,addon_id,amount,currency,reason,shot_url,status,closes_service,created_at")
      .eq("customer_id", params.id).order("created_at", { ascending: false });
    if (rfErr) refundTableMissing = true;
    else refunds = await Promise.all((rf || []).map(async (r: any) => ({
      id: r.id, enrollmentId: r.enrollment_id || "", addonId: r.addon_id || "",
      amount: Number(r.amount) || 0, currency: r.currency || "EGP", reason: r.reason || "",
      status: r.status || "requested", closesService: !!r.closes_service,
      shot_url: r.shot_url ? await receiptSignedUrl(supabase, r.shot_url) : "",
      at: String(r.created_at || "").slice(0, 10),
    })));
  }

  const templates = tplRows || [];
  const waCtx = { name: (c.name as string) || "", phone1: (c.phone1 as string) || "", diploma: enrolls[0]?.diploma || "", batch: enrolls[0]?.batch || "", remaining: "" };

  let addons: any[] = []; let addonsMissing = false;
  if (adRes.error) addonsMissing = true; else addons = await Promise.all((adRes.data || []).map(async (a: any) => ({ id: a.id, type: a.type, name: a.name, amount: Number(a.amount) || 0, free: !!a.free, note: a.note || "", paid: !!a.paid, refunded: !!a.refunded, shot_url: a.shot_url ? await receiptSignedUrl(supabase, a.shot_url) : "" })));
  const accredList = (accredRows || []).map((x: any) => x.code);
  const projList = (projRows || []).map((x: any) => x.code);
  const serviceTypes = ((svcTypeRows as any[]) || []).map((t) => ({ slug: t.slug, name: t.name }));
  const serviceItemsByType: Record<string, { code: string; price_egp: number; price_usd: number }[]> = {};
  ((svcItemRows as any[]) || []).forEach((b) => { (serviceItemsByType[b.kind] = serviceItemsByType[b.kind] || []).push({ code: b.code, price_egp: Number(b.price_egp) || 0, price_usd: Number(b.price_usd) || 0 }); });

  // ===== خدمات الريفند: دبلومات (بالمدفوع فعلاً) + إضافات مدفوعة =====
  let refundServices: any[] = [];
  let allServicesClosed = false;
  if (canFinance) {
    const enrServices = (finEnrollments || []).map((e: any) => {
      const paid = (e.installments || []).filter((i: any) => i.status === "paid" || i.paidAt).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
      return {
        kind: "enrollment", id: e.id,
        name: `${e.diploma}${e.batch ? " — " + e.batch : ""}`,
        paid, currency: e.currency || "EGP",
        free: !!e.free, closed: e.status === "refunded",
      };
    });
    const addonServices = (addons || []).filter((a: any) => a.paid || a.free).map((a: any) => ({
      kind: "addon", id: a.id, name: a.name || a.type || "—",
      paid: Number(a.amount) || 0, currency: "EGP",
      free: !!a.free, closed: !!a.refunded,
    }));
    refundServices = [...enrServices, ...addonServices];
    allServicesClosed = refundServices.length > 0 && refundServices.every((s: any) => s.closed);
  }

  const st = STAGE[c.stage as string] || STAGE.interested;
  const stageOpts = Object.keys(STAGE).map((k) => ({ value: k, label: tr(STAGE[k].labelKey), color: STAGE[k].color }));
  const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2); };

  // ملخّص المدير: المسؤول + آخر تواصل + المتابعة الجاية + عميل منذ
  const ownerName = pMap.get((c as any).owner_id || "") || "";
  const relDays = (d?: string | null) => {
    if (!d) return null;
    const then = new Date(d).getTime(); if (isNaN(then)) return null;
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days <= 0) return tr("today");
    if (days === 1) return tr("yesterday");
    return `${days} ${tr("dayUnit")}`;
  };
  const lastContactRel = relDays((commRows && commRows[0]) ? (commRows[0] as any).at : null);
  const nextFollow = fuOpen?.due_at ? String(fuOpen.due_at).slice(0, 10) : null;
  const createdRel = relDays((c as any).created_at);

  // شيبس الهيدر: الدبلومة·الباتش (أول اشتراك) + المتبقّي (canFinance)
  const firstEnr = enrolls.find((e: any) => e.status !== "refunded") || enrolls[0];
  const headerRemaining = (finEnrollments || []).filter((e: any) => e.status !== "refunded").reduce((s: number, e: any) => {
    const paid = (e.installments || []).filter((i: any) => i.paidAt || i.status === "paid").reduce((a: number, i: any) => a + (i.amount || 0), 0);
    return s + ((e.agreed || 0) - paid);
  }, 0);

  // حالة الأكسس (معلومة سريعة): مفعّل / بانتظار التفعيل / مدفوع محتاج تفعيل / لسه مدفعش
  const accessState = (c as any).handed_off ? "active"
    : (handoff && handoff.status !== "done") ? "awaiting"
    : (c.stage === "enrolled") ? "paid_need"
    : "not_paid";
  const ACCESS_UI: Record<string, { k: string; bg: string; color: string; icon: string }> = {
    active: { k: "accessActive", bg: "rgba(24,169,87,.14)", color: "var(--green)", icon: "✓" },
    awaiting: { k: "accessAwaiting", bg: "rgba(47,107,255,.12)", color: "var(--blue)", icon: "⏳" },
    paid_need: { k: "accessPaidNeed", bg: "rgba(230,167,0,.14)", color: "#a5790a", icon: "●" },
    not_paid: { k: "accessNotPaid", bg: "var(--muted-soft)", color: "var(--muted)", icon: "🔒" },
  };
  const acc = ACCESS_UI[accessState];

  return (
    <>
      <RealtimeRefresh tables={["customers","enrollments","enrollment_finance","installments","tickets","tasks","follow_ups","communications","customer_addons","refunds","handoffs","handoff_items"]} />
      <DrawerScrim label={tr("close")} />
      <aside className="drawer-panel">
        <div className="dr-h">
          <div className="av">{ini(c.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{c.name}</h2>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StagePicker customerId={c.id} value={c.stage as string} stages={stageOpts} canEdit={canEdit} />
              {firstEnr && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "var(--muted-soft)", color: "var(--muted)" }}>
                  📜 {firstEnr.diploma} · <span className="num">{firstEnr.batch}</span>
                </span>
              )}
              {canFinance && headerRemaining > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "rgba(230,167,0,.14)", color: "#a5790a" }}>
                  {tr("remainingWord")} <span className="num">{new Intl.NumberFormat("en").format(Math.round(headerRemaining))}</span>
                </span>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: acc.bg, color: acc.color }} title={tr("accessStatusLabel")}>
                {acc.icon} {tr(acc.k)}
              </span>
              <CopyNumbers phones={[c.phone1 as string, c.phone2 as string]} />
            </div>

            {/* شريط ملخّص المدير */}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tr("ownerLabel")}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <span style={{ color: ownerName ? "var(--ink)" : "#a5790a", fontWeight: 700 }}>{ownerName || tr("notAssigned")}</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tr("lastContactLabel")}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                {tr("lastContactLabel")}: <span style={{ color: "var(--ink)", fontWeight: 700 }} className="num">{lastContactRel || tr("noContactYet")}</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tr("nextFollowLabel")}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                {tr("nextFollowLabel")}: <span style={{ color: nextFollow ? "var(--ink)" : "var(--muted)", fontWeight: 700 }} className="num">{nextFollow || tr("noFollowUp")}</span>
              </span>
              {createdRel && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tr("createdLabel")}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 8v8M8 12h8" /><circle cx="12" cy="12" r="9" /></svg>
                  {tr("createdLabel")} <span style={{ color: "var(--ink)", fontWeight: 700 }} className="num">{createdRel}</span>
                </span>
              )}
              {(c as any).source && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={tr("source")}>
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
                  {tr("source")}: <span style={{ color: "var(--ink)", fontWeight: 700 }}>{(c as any).source}</span>
                </span>
              )}
            </div>
          </div>
          <DrawerCloseButton label={tr("close")} />
        </div>
        {notes && notes.length > 0 && (
          <div style={{ margin: "12px 18px 0", padding: "10px 14px", background: "rgba(240,138,36,.08)", borderInlineStart: "3px solid var(--brand)", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, fontSize: 14, marginTop: 1 }}>📝</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--brand-d)", marginBottom: 2, letterSpacing: ".02em" }}>{tr("customerNoteLabel")}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5, wordBreak: "break-word" }}>{notes[0].body}</div>
            </div>
          </div>
        )}
        <div className="dr-b" style={{ display: "flex", flexDirection: "column" }}>
          <CustomerDrawer
            user={user} c={c} specs={specs || []} countries={((ctry as any[]) || []).map((x) => x.name).filter(Boolean)}
            enrolls={enrolls} dipOpts={dipOpts} batchOpts={batchOpts} addons={addons}
            accredList={accredList} projList={projList} libNames={(libOpts || []).map((l: any) => l.name)}
            serviceTypes={serviceTypes} serviceItemsByType={serviceItemsByType}
            handoff={handoff} accessItems={accessItems} accOpts={accOpts || []} libOpts={(libOpts || []).map((l: any) => ({ id: l.id, name: l.name }))}
            fuOpen={fuOpen} fuHistory={(fuAll || []).filter((x: any) => x.done).slice(0, 5)}
            finEnrollments={finEnrollments}
            refunds={refunds} refundServices={refundServices} allServicesClosed={allServicesClosed} refundTableMissing={refundTableMissing}
            canFinance={canFinance} canMessage={canMessage} canManageBatches={canManageBatches} canEdit={canEdit} myTeam={myTeam}
            docs={docs} docsMissing={docsMissing}
            waCtx={waCtx} templates={templates as any}
            tasks={tasks} notes={notes}
            tickets={tickets || []} auditRows={auditRows || []} pMap={pMap} AUDIT_KEYS={AUDIT_KEYS} TK={TK}
          />
        </div>
      </aside>
    </>
  );
}
