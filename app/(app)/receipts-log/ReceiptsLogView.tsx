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

  async function search() {
    const needle = q.trim();
    setBusy(true);
    if (!needle) { setBusy(false); return; }
    const { data } = await supabase.rpc("receipts_search", { p_query: needle });
    setRows((data as any[]) || []);
    setBusy(false);
  }
  async function openPdf(r: any) {
    const path = r.pdf_url || null;
    if (!path) { const { data } = await supabase.from("receipts_issued").select("pdf_url").eq("id", r.id).maybeSingle(); if (!data?.pdf_url) return; r.pdf_url = data.pdf_url; }
    const { data: s } = await supabase.storage.from("receipts-pdf").createSignedUrl(r.pdf_url, 3600);
    if (s?.signedUrl) window.open(s.signedUrl, "_blank");
  }
  // إعادة إرسال نفس الإيصال (نفس الرقم والـPDF)
  async function resend(r: any) {
    setRowBusy(r.id);
    const { data: row } = await supabase.from("receipts_issued").select("customer_id,service_label,amount,currency,receipt_no").eq("id", r.id).maybeSingle();
    if (!row) { setRowBusy(null); return toast(tr("errorGeneric")); }
    const { data: c } = await supabase.from("customers").select("name,email,phone1").eq("id", (row as any).customer_id).maybeSingle();
    const res = await resendReceipt({
      supabase, receiptId: r.id, receiptNo: (row as any).receipt_no, customerId: (row as any).customer_id,
      amount: Number((row as any).amount) || 0, currency: (row as any).currency, serviceLabel: (row as any).service_label,
      customerName: (c as any)?.name, email: (c as any)?.email, phone: (c as any)?.phone1,
    });
    setRowBusy(null);
    const sent = [res.sentEmail && "إيميل", res.sentWa && "واتساب"].filter(Boolean).join(" + ");
    toast((sent ? `${tr("resentWord")}: ${sent}` : tr("errorGeneric")) + (res.notes.length ? ` — ⚠ ${res.notes.join(" · ")}` : ""));
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, sent_email: x.sent_email || res.sentEmail, sent_whatsapp: x.sent_whatsapp || res.sentWa } : x));
  }
  // إصدار إيصال جديد (بديل) لنفس الدفعة — بتأكيد، بيستخدم force
  async function issueNew(r: any) {
    if (!await confirmDialog({ message: tr("reissueConfirm"), confirmLabel: tr("reissueYes"), cancelLabel: tr("cancel"), danger: true })) return;
    setRowBusy(r.id);
    const { data: row } = await supabase.from("receipts_issued").select("customer_id,installment_id,addon_id,pay_kind,pay_method,amount,currency").eq("id", r.id).maybeSingle();
    if (!row) { setRowBusy(null); return toast(tr("errorGeneric")); }
    const refType = (row as any).addon_id ? "addon" : "installment";
    const refId = (row as any).addon_id || (row as any).installment_id;
    if (!refId) { setRowBusy(null); return toast(tr("errorGeneric")); }
    const { data: c } = await supabase.from("customers").select("email,phone1").eq("id", (row as any).customer_id).maybeSingle();
    const res = await issueAndSendReceipt({
      supabase, customerId: (row as any).customer_id, refId, refType: refType as any,
      amount: Number((row as any).amount) || 0, currency: (row as any).currency,
      payKind: ((row as any).pay_kind || "installment") as any, payMethod: (row as any).pay_method || "",
      email: (c as any)?.email, phone: (c as any)?.phone1, autoSend: true, force: true, background: true,
    });
    setRowBusy(null);
    if (!res.ok) return toast(res.error || tr("errorGeneric"));
    toast(`${tr("receiptIssued")} ${res.data.receipt_no} — ${tr("receiptBgNote")}`);
    setRows((rs) => [{ id: res.data.id, receipt_no: res.data.receipt_no, customer_name: res.data.customer_name, service_label: res.data.service_label, batch_code: res.data.batch_code, amount: res.data.amount, currency: res.data.currency, issued_at: res.data.issued_at, sent_email: false, sent_whatsapp: false, pdf_url: "" }, ...rs]);
  }
  const fmtDate = (iso: string) => iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

  const cols = "150px 1.2fr 1.3fr 105px 125px 90px 190px";
  const H: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: "var(--muted)", padding: "11px 12px", whiteSpace: "nowrap" };
  const C: React.CSSProperties = { fontSize: 12.5, color: "var(--text)", padding: "11px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 16 }}>🧾 {tr("receiptsLogTitle")}</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input className="inp" placeholder={tr("receiptsSearchPh")} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} style={{ height: 40, flex: 1 }} />
        <button className="btn" style={{ height: 40 }} onClick={search} disabled={busy}>{busy ? "..." : "🔍 " + tr("searchWord")}</button>
        <button className="btn ghost" style={{ height: 40 }} onClick={() => { setQ(""); setRows(initial); }}>{tr("clearWord")}</button>
      </div>
      {rows.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>{tr("noReceiptsIssued")}</div> : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--sh)", overflowX: "auto" }}>
          <div style={{ minWidth: 950 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
              {[tr("colReceiptNo"), tr("customer"), tr("serviceWord"), tr("amount"), tr("colCreatedAt"), tr("sendStatusWord"), tr("actionWord")].map((h, i) => <div key={i} style={H}>{h}</div>)}
            </div>
            {rows.map((r, i) => (
              <div key={r.id || i} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", alignItems: "center", background: i % 2 ? "transparent" : "var(--muted-soft)" }}>
                <div className="num" style={{ ...C, direction: "ltr", fontWeight: 700, color: "var(--brand-d)" }}>{r.receipt_no}</div>
                <div style={{ ...C, fontWeight: 700, color: "var(--ink)" }}>{r.customer_name || r.service_label || "—"}</div>
                <div style={C} title={r.service_label}>{r.service_label || "—"}{r.batch_code ? ` · ${r.batch_code}` : ""}</div>
                <div className="num" style={{ ...C, direction: "ltr", fontWeight: 700 }}>{nf.format(Math.round(r.amount || 0))} {r.currency}</div>
                <div className="num" style={{ ...C, direction: "ltr" }}>{fmtDate(r.issued_at)}</div>
                <div style={{ ...C, display: "flex", gap: 5 }}>
                  {r.sent_email ? <span title={fmtDate(r.sent_email_at)} style={{ fontSize: 15 }}>✉️</span> : null}
                  {r.sent_whatsapp ? <span title={fmtDate(r.sent_whatsapp_at)} style={{ fontSize: 15 }}>📱</span> : null}
                  {!r.sent_email && !r.sent_whatsapp ? <span style={{ fontSize: 10.5, color: "#c0392b", fontWeight: 700 }}>{tr("notSentWord")}</span> : null}
                </div>
                <div style={{ ...C, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn ghost" style={{ height: 30, padding: "0 10px", fontSize: 12 }} onClick={() => openPdf(r)}>👁 {tr("viewWord")}</button>
                  <button className="btn ghost" style={{ height: 30, padding: "0 10px", fontSize: 12 }} onClick={() => resend(r)} disabled={rowBusy === r.id}>{rowBusy === r.id ? "..." : "🔁 " + tr("resendReceipt")}</button>
                  <button className="btn ghost" style={{ height: 30, padding: "0 10px", fontSize: 12 }} onClick={() => issueNew(r)} disabled={rowBusy === r.id}>➕ {tr("reissueNewBtn")}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
