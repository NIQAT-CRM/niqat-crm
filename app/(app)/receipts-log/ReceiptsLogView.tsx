"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { issueAndSendReceipt, resendReceipt } from "@/lib/issueReceipt";

const nf = new Intl.NumberFormat("en-US");

export default function ReceiptsLogView({ initial }: { initial: any[] }) {
  const tr = useT();
  const lang = useLang();
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search() {
    const needle = q.trim();
    setBusy(true);
    const { data } = await supabase.rpc("receipts_search", { p_query: needle });
    setRows((data as any[]) || []);
    setSearched(!!needle);
    setBusy(false);
  }
  function clearSearch() { setQ(""); setRows(initial); setSearched(false); }

  async function openPdf(r: any) {
    let path = r.pdf_url || null;
    if (!path) { const { data } = await supabase.from("receipts_issued").select("pdf_url").eq("id", r.id).maybeSingle(); if (!data?.pdf_url) return toast(tr("errorGeneric")); path = data.pdf_url; r.pdf_url = path; }
    const { data: s } = await supabase.storage.from("receipts-pdf").createSignedUrl(path, 3600);
    if (s?.signedUrl) window.open(s.signedUrl, "_blank");
  }
  // إعادة إرسال نفس الإيصال (نفس الرقم والـPDF)
  async function resend(r: any) {
    setRowBusy(r.id);
    const { data: row } = await supabase.from("receipts_issued").select("customer_id,service_label,amount,currency,pay_kind,receipt_no").eq("id", r.id).maybeSingle();
    if (!row) { setRowBusy(null); return toast(tr("errorGeneric")); }
    const { data: c } = await supabase.from("customers").select("name,email,phone1").eq("id", (row as any).customer_id).maybeSingle();
    const res = await resendReceipt({
      supabase, receiptId: r.id, receiptNo: (row as any).receipt_no, customerId: (row as any).customer_id,
      amount: Number((row as any).amount) || 0, currency: (row as any).currency, serviceLabel: (row as any).service_label, payKind: (row as any).pay_kind,
      customerName: (c as any)?.name, email: (c as any)?.email, phone: (c as any)?.phone1,
    });
    setRowBusy(null);
    const sent = [res.sentEmail && "إيميل", res.sentWa && "واتساب"].filter(Boolean).join(" + ");
    toast((sent ? `${tr("resentWord")}: ${sent}` : tr("errorGeneric")) + (res.notes.length ? ` — ⚠ ${res.notes.join(" · ")}` : ""));
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, sent_email: x.sent_email || res.sentEmail, sent_whatsapp: x.sent_whatsapp || res.sentWa, sent_email_at: x.sent_email_at || (res.sentEmail ? new Date().toISOString() : null), sent_whatsapp_at: x.sent_whatsapp_at || (res.sentWa ? new Date().toISOString() : null) } : x));
  }
  // إصدار إيصال جديد (بديل) لنفس الدفعة — بتأكيد، بيستخدم force
  async function issueNew(r: any) {
    if (!await confirmDialog({ message: tr("reissueConfirm"), confirmLabel: tr("reissueYes"), cancelLabel: tr("cancel"), danger: true })) return;
    setRowBusy(r.id);
    const { data: row } = await supabase.from("receipts_issued").select("customer_id,installment_id,addon_id,enrollment_id,pay_kind,pay_method,amount,currency").eq("id", r.id).maybeSingle();
    if (!row) { setRowBusy(null); return toast(tr("errorGeneric")); }
    const rr: any = row;
    const refType = rr.addon_id ? "addon" : rr.installment_id ? "installment" : "enrollment";
    const refId = rr.addon_id || rr.installment_id || rr.enrollment_id;
    if (!refId) { setRowBusy(null); return toast(tr("errorGeneric")); }
    const { data: c } = await supabase.from("customers").select("email,phone1").eq("id", rr.customer_id).maybeSingle();
    const res = await issueAndSendReceipt({
      supabase, customerId: rr.customer_id, refId, refType: refType as any,
      amount: Number(rr.amount) || 0, currency: rr.currency,
      payKind: (rr.pay_kind || "installment") as any, payMethod: rr.pay_method || "",
      email: (c as any)?.email, phone: (c as any)?.phone1, autoSend: true, force: true, background: true,
    });
    setRowBusy(null);
    if (!res.ok) return toast(res.error || tr("errorGeneric"));
    toast(`${tr("receiptIssued")} ${res.data.receipt_no} — ${tr("receiptBgNote")}`);
    setRows((rs) => [{ id: res.data.id, receipt_no: res.data.receipt_no, customer_name: res.data.customer_name, service_label: res.data.service_label, batch_code: res.data.batch_code, amount: res.data.amount, currency: res.data.currency, pay_kind: res.data.pay_kind, issued_at: res.data.issued_at, sent_email: false, sent_whatsapp: false, pdf_url: "" }, ...rs]);
  }
  const fmtDate = (iso: string) => iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

  // شارة حالة الإرسال لكل قناة على حدة (واتساب / إيميل)
  const chBadge = (icon: string, label: string, sent: boolean, at?: string) => (
    <span className="chip" title={sent ? (at ? `${tr("sentWord")}: ${fmtDate(at)}` : tr("sentWord")) : tr("notSentWord")}
      style={{ background: sent ? "var(--green-soft)" : "var(--red-soft)", color: sent ? "var(--green)" : "var(--red)", fontSize: 10.5, padding: "2px 9px", gap: 5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {icon} {label} {sent ? "✓" : "✗"}
    </span>
  );

  const cols = "130px 1.4fr 120px 150px 176px 206px";
  const cell: React.CSSProperties = { padding: "13px 14px", minWidth: 0 };
  const head: React.CSSProperties = { ...cell, fontSize: 11, fontWeight: 800, color: "var(--muted)", whiteSpace: "nowrap" };
  const abtn: React.CSSProperties = { height: 30, padding: "0 10px", fontSize: 11.5 };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>🧾 {tr("receiptsLogTitle")}</h1>
        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{rows.length} {tr("receiptWord")}</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: .5, pointerEvents: "none" }}>🔍</span>
          <input className="inp" placeholder={tr("receiptsSearchPh")} value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()}
            style={{ height: 44, width: "100%", paddingInlineStart: 40, fontSize: 13.5 }} />
        </div>
        <button className="btn" style={{ height: 44, padding: "0 22px" }} onClick={search} disabled={busy}>{busy ? "..." : tr("searchWord")}</button>
        {(searched || q) && <button className="btn ghost" style={{ height: 44 }} onClick={clearSearch}>{tr("clearWord")}</button>}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
          <div style={{ fontSize: 34, marginBottom: 8, opacity: .5 }}>🧾</div>
          {searched ? tr("noSearchResults") : tr("noReceiptsIssued")}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 950 }}>
              <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1.5px solid var(--line)", background: "var(--muted-soft)" }}>
                <div style={head}>{tr("colReceiptNo")}</div>
                <div style={head}>{tr("customer")}</div>
                <div style={head}>{tr("amount")}</div>
                <div style={head}>{tr("colCreatedAt")}</div>
                <div style={head}>{tr("sendStatusWord")}</div>
                <div style={head}>{tr("actionWord")}</div>
              </div>
              {rows.map((r, i) => {
                const isFree = r.pay_kind === "free";
                return (
                  <div key={r.id || i} className="rlog-row" style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)" }}>
                    <div style={cell}>
                      <span className="num" style={{ direction: "ltr", fontWeight: 800, fontSize: 12.5, color: "var(--brand-d)", whiteSpace: "nowrap" }}>{r.receipt_no}</span>
                    </div>
                    <div style={{ ...cell, overflow: "hidden" }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer_name || "—"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{isFree ? "🎁 " : ""}{r.service_label || "—"}{r.batch_code ? ` · ${r.batch_code}` : ""}</div>
                    </div>
                    <div style={cell}>
                      {isFree
                        ? <span className="chip" style={{ background: "var(--brand-soft)", color: "var(--brand-d)" }}>🎁 {tr("freeWord")}</span>
                        : <span className="num" style={{ direction: "ltr", fontWeight: 800, fontSize: 13.5, color: "var(--ink)", whiteSpace: "nowrap" }}>{nf.format(Math.round(r.amount || 0))} <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700 }}>{r.currency}</span></span>}
                    </div>
                    <div style={cell}>
                      <span className="num" style={{ direction: "ltr", fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(r.issued_at)}</span>
                    </div>
                    <div style={{ ...cell, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      {chBadge("📱", tr("whatsappWord"), !!r.sent_whatsapp, r.sent_whatsapp_at)}
                      {chBadge("✉️", tr("emailWord"), !!r.sent_email, r.sent_email_at)}
                    </div>
                    <div style={{ ...cell, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn ghost" style={abtn} onClick={() => openPdf(r)}>👁 {tr("viewWord")}</button>
                      <button className="btn ghost" style={abtn} onClick={() => resend(r)} disabled={rowBusy === r.id}>{rowBusy === r.id ? "..." : "🔁 " + tr("resendShort")}</button>
                      <button className="btn ghost" style={abtn} onClick={() => issueNew(r)} disabled={rowBusy === r.id}>➕ {tr("newShort")}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <style>{`.rlog-row{transition:background .12s}.rlog-row:hover{background:var(--muted-soft)}`}</style>
    </div>
  );
}
