"use client";
import { confirmDialog } from "@/lib/confirm";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { revalidateCustomers } from "../actions";
import DrawerTabs from "./DrawerTabs";
import CustomerEdit, { type CustomerEditHandle } from "./CustomerEdit";
import ServicesPanel from "./ServicesPanel";
import FinancePanel from "./FinancePanel";
import CustomerActivity from "./CustomerActivity";
import DocsPanel from "./DocsPanel";
import AccessPanel from "./AccessPanel";
import FollowUpPanel from "./FollowUpPanel";
import RefundPanel from "./RefundPanel";
import WhatsAppPanel from "./WhatsAppPanel";
import SmartActions from "../../SmartActions";
import { useLogUsage } from "../../AiFlags";

const fmtNum = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));

const SEC_ICONS: Record<string, ReactNode> = {
  user: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  money: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  ticket: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" /><path d="M15 6v12" /></svg>,
  clock: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  refund: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 0 2.5-7.5L3 8" /></svg>,
  archive: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" /></svg>,
  warning: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>,
};

// عنوان قسم هادي (ink + أيقونة SVG ملوّنة في مربّع + عدّاد اختياري)
function Sec({ icon, bg, color, title, count, mt }: { icon: string; bg: string; color: string; title: string; count?: number; mt?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: mt ? "20px 0 12px" : "0 0 12px", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", flexShrink: 0, background: bg, color }}>{SEC_ICONS[icon]}</span>
      {title}
      {typeof count === "number" && <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--muted-soft)", borderRadius: 20, padding: "1px 8px" }}>{count}</span>}
    </div>
  );
}

export default function CustomerDrawer(props: {
  user: any; c: any; specs: any[];
  enrolls: any[]; dipOpts: any[]; batchOpts: any[]; serviceTypes?: any[]; serviceItemsByType?: any; addons: any[];
  accredList: string[]; projList: string[]; libNames: string[];
  handoff: any; accessItems: any[]; accOpts: any[]; libOpts: any[];
  fuOpen: any; fuHistory: any[];
  finEnrollments: any[];
  refunds: any[]; refundServices: any[]; allServicesClosed: boolean; refundTableMissing: boolean;
  canFinance: boolean; canMessage: boolean; canManageBatches: boolean; canEdit: boolean;
  docs: any[]; docsMissing: boolean;
  waCtx: any; templates: any[];
  tasks: any[]; notes: any[];
  tickets: any[]; auditRows: any[]; pMap: any; AUDIT_KEYS: any; TK: any;
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const editRef = useRef<CustomerEditHandle>(null);
  const [tab, setTab] = useState<"basic" | "sales" | "docs" | "ops">("basic");
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const showOps = props.canFinance || props.canManageBatches;

  // ملخص الماليات (عرض فقط — من finEnrollments، بدون لمس أي منطق مالي)
  const finSum = (props.finEnrollments || []).reduce(
    (acc: { agreed: number; paid: number }, e: any) => {
      const paid = (e.installments || []).filter((i: any) => i.paidAt || i.status === "paid").reduce((a: number, i: any) => a + (i.amount || 0), 0);
      acc.agreed += e.agreed || 0; acc.paid += paid; return acc;
    }, { agreed: 0, paid: 0 });
  const finRemaining = finSum.agreed - finSum.paid;

  async function archiveCustomer() {
    if (!await confirmDialog(tr("archiveCustomerQ"))) return;
    setArchiving(true);
    const { error } = await supabase.from("customers").update({ archived: true }).eq("id", props.c.id);
    if (error) { setArchiving(false); toast(tr("archiveFailed") + error.message); return; }
    await revalidateCustomers();
    toast(tr("customerArchived"));
    router.push("/customers");
  }

  async function deleteCustomer() {
    if (!await confirmDialog(tr("deleteCustomerQ1"))) return;
    if (!await confirmDialog(tr("deleteCustomerQ2"))) return;
    setDeleting(true);
    const { error } = await supabase.from("customers").delete().eq("id", props.c.id);
    if (error) { setDeleting(false); toast(tr("deleteFailed") + error.message); return; }
    await revalidateCustomers();
    toast(tr("customerDeleted"));
    router.push("/customers");
  }

  function goTo(t: "basic" | "sales" | "docs" | "ops", panelId: string) {
    setTab(t);
    setTimeout(() => { document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
  }

  const log = useLogUsage();
  const CTX = "customer_card";
  // أكشنز الكارت: الاسم → (تسجيل + تنفيذ فعلي عبر goTo)
  function cardAction(name: string) {
    log("action", "action:" + name, CTX);
    if (name === "whatsapp") goTo("docs", "panel-whatsapp");
    else if (name === "followup") goTo("sales", "panel-followup");
    else if (name === "handoff") goTo("sales", "panel-access");
    else if (name === "service") goTo("sales", "panel-services");
    else if (name === "note") goTo("docs", "panel-activity");
  }
  // تشغيل عنصر من SmartActions (كلها أكشنز في سياق الكارت)
  function runSmart(item: { kind: "action" | "filter"; key: string }) {
    if (item.key.startsWith("action:")) cardAction(item.key.slice(7));
  }
  const cardActionLabels: Record<string, string> = {
    whatsapp: tr("qaWhatsapp"), followup: tr("qaFollow"), handoff: tr("qaHandoff"),
    service: tr("qaService"), note: tr("addNote"),
  };

  const qbtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, height: 36, padding: "0 13px",
    borderRadius: 9, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer",
    border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", flexShrink: 0,
  };
  const qbtnWa: React.CSSProperties = { ...qbtn, background: "var(--wa)", color: "#fff", borderColor: "var(--wa)" };

  const quickBar = (
    <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderBottom: "1px solid var(--line)", background: "linear-gradient(0deg,var(--muted-soft),transparent)", overflowX: "auto" }}>
      {props.canMessage && (
        <button type="button" style={qbtnWa} onClick={() => cardAction("whatsapp")}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.1.1.3 0 .5-.3.6-.6.8-.8 1-.1.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.8 2.1 1 .3.1.5.2.6.3.1.2.1.7-.1 1.3z" /></svg>
          {tr("qaWhatsapp")}
        </button>
      )}
      <button type="button" style={qbtn} onClick={() => cardAction("followup")}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></svg>
        {tr("qaFollow")}
      </button>
      <button type="button" style={qbtn} onClick={() => cardAction("handoff")}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        {tr("qaHandoff")}
      </button>
      <button type="button" style={qbtn} onClick={() => cardAction("service")}>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
        {tr("qaService")}
      </button>
    </div>
  );

  return (
    <>
    <SmartActions context="customer_card" actionLabels={cardActionLabels} onRun={runSmart} />
    <DrawerTabs
      tab={tab} onTab={setTab} quickBar={quickBar} showOps={showOps}
      basic={<div className="px-5 py-5">
        <Sec icon="user" bg="var(--brand-soft)" color="var(--brand)" title={tr("basicData")} />
        <CustomerEdit ref={editRef} customer={props.c as any} specialties={props.specs || []} canEdit={props.canEdit} />
      </div>}
      sales={<>
        {props.canFinance && (
          <div id="panel-finsum">
            <Sec icon="money" bg="rgba(24,169,87,.12)" color="var(--green)" title={tr("financeSummary")} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "var(--muted-soft)", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{tr("agreedAmount")}</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: "var(--ink)" }}>{fmtNum(finSum.agreed)}</div>
              </div>
              <div style={{ background: "var(--muted-soft)", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{tr("paidAmount")}</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: "var(--green)" }}>{fmtNum(finSum.paid)}</div>
              </div>
              <div style={{ background: "var(--muted-soft)", borderRadius: 10, padding: "11px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{tr("remainingAmount")}</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: "#a5790a" }}>{fmtNum(finRemaining)}</div>
              </div>
            </div>
          </div>
        )}

        <div id="panel-services">
          <ServicesPanel customerId={props.c.id} meId={props.user?.id || ""}
            enrolls={props.enrolls} dipOpts={props.dipOpts} batchOpts={props.batchOpts}
            addons={props.addons} accreditations={props.accredList}
            projects={props.projList} libraries={props.libNames} canFinance={props.canFinance}
            serviceTypes={props.serviceTypes || []} serviceItemsByType={props.serviceItemsByType || {}} />
        </div>

        <div id="panel-access">
          <AccessPanel customerId={props.c.id} handoff={props.handoff} items={props.accessItems}
            accessOptions={[
              ...(props.accOpts || []),
              ...props.enrolls.map((e: any, i: number) => ({ id: "dip-" + i, label: tr("accActivateDiploma") + ": " + e.diploma })),
              ...(props.addons || []).map((a: any, i: number) => ({
                id: "addon-" + i,
                label: (a.type === "accred" ? tr("accIssueAccred") + ": " : a.type === "project" ? tr("accPrepProject") + ": " : a.type === "library" ? tr("accOpenLibrary") + ": " : tr("accActivate") + ": ") + a.name,
              })),
            ]}
            libraries={props.libOpts} meId={props.user?.id || ""} meName="" />
        </div>

        <div id="panel-followup">
          <FollowUpPanel customerId={props.c.id} meId={props.user?.id || ""} open={props.fuOpen} history={props.fuHistory} />
        </div>

        {props.canFinance && <FinancePanel enrollments={props.finEnrollments} customerId={props.c.id} meId={props.user?.id || ""} batchOpts={props.batchOpts} addons={(props.addons || []).filter((a: any) => a.paid)} handedOff={!!(props.c as any).handed_off} />}
      </>}
      docs={<>
        <div id="panel-whatsapp">
          {props.canMessage && <WhatsAppPanel customerId={props.c.id} meId={props.user?.id || ""} ctx={props.waCtx} templates={props.templates as any} />}
        </div>

        <CustomerActivity customerId={props.c.id} meId={props.user?.id || ""} initialTasks={props.tasks} initialNotes={props.notes} />

        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Sec icon="ticket" bg="rgba(47,107,255,.12)" color="#2F6BFF" title={tr("supportTickets")} count={(props.tickets || []).length} />
            <a href={`/support/new?customer=${props.c.id}`} className="btn" style={{ height: 32, padding: "0 12px", fontSize: 13 }}>+ {tr("ticket")}</a>
          </div>
          {(!props.tickets || props.tickets.length === 0) ? (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{tr("noTickets")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {(props.tickets || []).map((t: any) => {
                const ts = props.TK[t.status] || props.TK.open;
                return (
                  <a key={t.id} href={`/support/${t.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink)" }}>{t.title}</span>
                    <span className="stg" style={{ background: ts.color + "1a", color: ts.color }}>{tr(ts.labelKey)}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <DocsPanel customerId={props.c.id} initial={props.docs} tableMissing={props.docsMissing} />

        <div className="card" style={{ padding: 18 }}>
          <Sec icon="clock" bg="var(--muted-soft)" color="var(--muted)" title={tr("timeline")} />
          {(!props.auditRows || props.auditRows.length === 0) ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noTimeline")}</div>
          ) : (props.auditRows || []).map((a: any, idx: number) => (
            <div key={idx} className="comm">
              <div className="ci" style={{ background: "#eef2f8", color: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{props.AUDIT_KEYS[a.action] ? tr(props.AUDIT_KEYS[a.action]) : a.action}{a.detail ? " — " + a.detail : ""}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  <b>{props.pMap.get(a.actor_id || "") || "—"}</b> • <span className="num">{String(a.at || "").replace("T", " ").slice(0, 16)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>}
      ops={<div className="px-5 py-5">
        {props.canFinance && (
          <>
            <Sec icon="refund" bg="rgba(47,107,255,.12)" color="#2F6BFF" title={tr("refundAccTitle")} />
            <div className="card" style={{ padding: 14, marginBottom: 14 }}>
              <RefundPanel customerId={props.c.id} refunds={props.refunds} refundServices={props.refundServices} allServicesClosed={props.allServicesClosed} meId={props.user?.id || ""} tableMissing={props.refundTableMissing} accessItems={props.accessItems} />
            </div>
          </>
        )}

        {props.canManageBatches && (
          <>
            {!(props.c as any).archived && (
              <>
                <Sec icon="archive" bg="var(--muted-soft)" color="var(--muted)" title={tr("archiveCustomerBtn")} mt={props.canFinance} />
                <div className="card" style={{ padding: 14, marginBottom: 14 }}>
                  <button onClick={archiveCustomer} disabled={archiving} className="btn danger" style={{ width: "100%" }}>
                    {archiving ? "..." : tr("archiveCustomerBtn")}
                  </button>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginTop: 6 }}>{tr("archiveCustomerHint")}</div>
                </div>
              </>
            )}

            <Sec icon="warning" bg="var(--red-soft)" color="var(--red)" title={tr("dangerZone")} mt />
            <div style={{ border: "1px solid #f3c9c4", background: "var(--red-soft)", borderRadius: 11, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--red)", marginBottom: 2 }}>{tr("deleteCustomerBtn")}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6, marginTop: 2, marginBottom: 10 }}>{tr("deleteCustomerHint")}</div>
              <button onClick={deleteCustomer} disabled={deleting} className="btn"
                style={{ width: "100%", background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}>
                {deleting ? "..." : tr("deleteCustomerBtn")}
              </button>
            </div>
          </>
        )}
      </div>}
      footer={() => null}
    />
    </>
  );
}
