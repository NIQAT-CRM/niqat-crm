import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerDrawer from "./CustomerDrawer";
import CopyNumbers from "./CopyNumbers";

export const dynamic = "force-dynamic";

const STAGE: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "#2F6BFF" }, contacted: { label: "تم التواصل", color: "#0FA3A3" },
  interested: { label: "مهتم", color: "#7B61FF" }, negotiation: { label: "تفاوض", color: "#F08A24" },
  quote: { label: "عرض سعر مُرسل", color: "#E6A700" },
  enrolled: { label: "مسجّل / دفع", color: "#18A957" }, onhold: { label: "معلّق", color: "#7C8AA5" },
  lost: { label: "مؤجل / مرفوض", color: "#94A2BB" },
};

const AUDIT_LABELS: Record<string, string> = {
  batch_transfer: "نقل بين الباتشات", enrollment_add: "إضافة دبلومة",
  installment_add: "إضافة قسط", installment_paid: "تأكيد دفع",
  create: "إنشاء العميل", update: "تعديل بيانات", stage_change: "تغيير المرحلة",
  refund_request: "طلب استرداد", refunded: "تم الاسترداد", handoff: "تحويل للدعم",
};

const TK: Record<string, { label: string; color: string }> = {
  open: { label: "مفتوحة", color: "#2F6BFF" }, progress: { label: "قيد المعالجة", color: "#E6A700" },
  resolved: { label: "محلولة", color: "#18A957" }, closed: { label: "مغلقة", color: "#94A2BB" },
};

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meProf } = await supabase.from("profiles").select("can_see_finance,can_message").eq("id", user?.id || "").maybeSingle();
  const canFinance = !!meProf?.can_see_finance;
  const canMessage = !!meProf?.can_message;

  const { data: c } = await supabase.from("customers")
    .select("id,name,phone1,phone2,email,company,residency,grad_year,stage,specialty_id,lms_status,source,affiliate_code,onhold_reason,created_at,terms_signed,terms_signed_at")
    .eq("id", params.id).maybeSingle();
  if (!c) notFound();
  const { data: specs } = await supabase.from("specialties").select("id,name_ar").order("name_ar");

  const { data: enrRows } = await supabase.from("enrollments")
    .select("id,status,diploma_id,batch_id, diplomas(name_ar), batches(code)").eq("customer_id", params.id);
  const enrolls = (enrRows || []).map((e: any) => ({
    id: e.id, diploma: e.diplomas?.name_ar || "—", batch: e.batches?.code || "—",
    diplomaId: e.diploma_id || "", batchId: e.batch_id || "",
  }));
  const { data: allDips } = await supabase.from("diplomas").select("id,name_ar").order("name_ar");
  const { data: allBatches } = await supabase.from("batches").select("id,code,status").order("code");
  const dipOpts = (allDips || []).map((d: any) => ({ v: d.id, label: d.name_ar }));
  const batchOpts = (allBatches || []).map((b: any) => ({ v: b.id, label: b.code }));

  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
  const { data: taskRows } = await supabase.from("tasks").select("id,title,due_at,done").eq("customer_id", params.id).order("created_at", { ascending: false });
  const tasks = (taskRows || []).map((k: any) => ({ id: k.id, title: k.title || "", due: k.due_at ? String(k.due_at).slice(0, 10) : "", done: !!k.done }));
  const { data: commRows } = await supabase.from("communications").select("id,body,by_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(50);
  const notes = (commRows || []).map((n: any) => ({ id: n.id, body: n.body || "", by: pMap.get(n.by_id || "") || "—", at: String(n.at || "").replace("T", " ").slice(0, 16) }));
  const { data: auditRows } = await supabase.from("audit_log").select("action,detail,actor_id,at").eq("customer_id", params.id).order("at", { ascending: false }).limit(60);

  const { data: tickets } = await supabase.from("tickets").select("id,title,status").eq("customer_id", params.id).eq("archived", false).order("created_at", { ascending: false });

  let finEnrollments: any[] = [];
  if (canFinance && enrolls.length) {
    const { data: enrs } = await supabase.from("enrollments").select("id,diploma_id,status,free,free_reason").eq("customer_id", params.id);
    const ids = (enrs || []).map((e: any) => e.id);
    if (ids.length) {
      const [{ data: fin }, { data: insts }, { data: dips }] = await Promise.all([
        supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", ids),
        supabase.from("installments").select("id,enrollment_id,amount,currency,due_date,paid_at,status,screenshot_url").in("enrollment_id", ids).order("due_date", { ascending: true }),
        supabase.from("diplomas").select("id,name_ar"),
      ]);
      const dName = new Map((dips || []).map((d: any) => [d.id, d.name_ar]));
      const finMap = new Map((fin || []).map((f: any) => [f.enrollment_id, f]));
      finEnrollments = (enrs || []).map((e: any) => {
        const f: any = finMap.get(e.id);
        return {
          id: e.id, diploma: dName.get(e.diploma_id || "") || "—", status: e.status || "",
          free: !!(e as any).free, freeReason: (e as any).free_reason || "",
          agreed: Number(f?.agreed_amount) || 0, currency: f?.currency || "EGP",
          installments: (insts || []).filter((i: any) => i.enrollment_id === e.id).map((i: any) => ({
            id: i.id, amount: Number(i.amount) || 0, currency: i.currency || "EGP",
            due: i.due_date ? String(i.due_date).slice(0, 10) : "", status: i.status || "pending", paidAt: i.paid_at || null,
            shot: (i as any).screenshot_url || null,
          })),
        };
      });
    }
  }

  const { data: hoRows } = await supabase.from("handoffs")
    .select("id,status,note,assignee_id,created_by,created_at").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1);
  const ho: any = (hoRows || [])[0] || null;
  let accessItems: any[] = [];
  if (ho) {
    const { data: it } = await supabase.from("handoff_items")
      .select("id,label,done,done_by,done_at").eq("handoff_id", ho.id).order("id");
    accessItems = (it || []).map((x: any) => ({ id: x.id, label: x.label, done: !!x.done, done_by: pMap.get(x.done_by || "") || null, done_at: x.done_at || null }));
  }
  const handoff = ho ? { id: ho.id, status: ho.status || "pending", note: ho.note || "", assignee: pMap.get(ho.assignee_id || "") || "", by: pMap.get(ho.created_by || "") || "", at: String(ho.created_at || "").replace("T", " ").slice(0, 16) } : null;
  const { data: accOpts } = await supabase.from("access_options").select("id,label").order("label");
  const { data: libOpts } = await supabase.from("libraries").select("id,name").order("name");

  const docsRes = await supabase.from("customer_docs").select("id,url,name,created_at").eq("customer_id", params.id).order("created_at", { ascending: false });
  const docsMissing = !!docsRes.error;
  const docs = (docsRes.data || []).map((d: any) => ({ id: d.id, url: d.url, name: d.name || "مستند", at: String(d.created_at || "").slice(0, 10) }));

  const { data: fuRows } = await supabase.from("follow_ups").select("id,due_at,note,done").eq("customer_id", params.id).order("due_at", { ascending: false });
  const fuAll = (fuRows || []).map((x: any) => ({ id: x.id, due_at: x.due_at, note: x.note || "", done: !!x.done }));
  const fuOpen = fuAll.find((x: any) => !x.done) || null;

  let refund: any = null;
  let refundTableMissing = false;
  if (canFinance) {
    const { data: rf, error: rfErr } = await supabase.from("refunds").select("id,amount,currency,reason,shot_url,status,created_at").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1);
    if (rfErr) refundTableMissing = true; else refund = (rf || [])[0] || null;
  }

  const { data: tplRows } = await supabase.from("wa_templates").select("id,name,body").order("created_at");
  const templates = tplRows || [];
  const waCtx = { name: (c.name as string) || "", phone1: (c.phone1 as string) || "", diploma: enrolls[0]?.diploma || "", batch: enrolls[0]?.batch || "", remaining: "" };

  let addons: any[] = []; let addonsMissing = false;
  const { data: adRows, error: adErr } = await supabase.from("customer_addons").select("id,type,name,amount,free,note,paid").eq("customer_id", params.id).order("created_at");
  if (adErr) addonsMissing = true; else addons = (adRows || []).map((a: any) => ({ id: a.id, type: a.type, name: a.name, amount: Number(a.amount) || 0, free: !!a.free, note: a.note || "", paid: !!a.paid }));
  const [{ data: accredRows }, { data: projRows }] = await Promise.all([
    supabase.from("accreditations").select("name").order("name"),
    supabase.from("projects").select("name").order("name"),
  ]);
  const accredList = (accredRows || []).map((x: any) => x.name);
  const projList = (projRows || []).map((x: any) => x.name);

  const st = STAGE[c.stage as string] || STAGE.new;
  const ini = (n: string) => { const p = (n || "?").trim().split(/\s+/); return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2); };

  return (
    <>
      <Link href="/customers" className="drawer-scrim" aria-label="إغلاق" />
      <aside className="drawer-panel">
        <div className="dr-h">
          <div className="av">{ini(c.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{c.name}</h2>
            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="stg" style={{ background: st.color + "1a", color: st.color }}>{st.label}</span>
              {c.stage === "onhold" && (c as any).onhold_reason && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>⏸️ {(c as any).onhold_reason}</span>
              )}
              <CopyNumbers phones={[c.phone1 as string, c.phone2 as string]} />
            </div>
          </div>
          <Link href="/customers" className="dr-x" aria-label="إغلاق">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </Link>
        </div>
        <div className="dr-b" style={{ display: "flex", flexDirection: "column" }}>
          <CustomerDrawer
            user={user} c={c} specs={specs || []}
            enrolls={enrolls} dipOpts={dipOpts} batchOpts={batchOpts} addons={addons}
            accredList={accredList} projList={projList} libNames={(libOpts || []).map((l: any) => l.name)}
            handoff={handoff} accessItems={accessItems} accOpts={accOpts || []} libOpts={(libOpts || []).map((l: any) => ({ id: l.id, name: l.name }))}
            fuOpen={fuOpen} fuHistory={(fuAll || []).filter((x: any) => x.done).slice(0, 5)}
            finEnrollments={finEnrollments}
            refund={refund} refundTableMissing={refundTableMissing}
            canFinance={canFinance} canMessage={canMessage}
            docs={docs} docsMissing={docsMissing}
            waCtx={waCtx} templates={templates as any}
            tasks={tasks} notes={notes}
            tickets={tickets || []} auditRows={auditRows || []} pMap={pMap} AUDIT_LABELS={AUDIT_LABELS} TK={TK}
          />
        </div>
      </aside>
    </>
  );
}
