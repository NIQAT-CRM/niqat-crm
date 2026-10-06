"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { issueAndSendReceipt, resendReceipt } from "@/lib/issueReceipt";

type Existing = { id: string; no: string; amount?: number; currency?: string; serviceLabel?: string; sentEmail?: boolean; sentWa?: boolean } | null;

export default function ReceiptIssuer({ customerId, refId, refType, amount, currency, payMethod, payKind, customerEmail, customerPhone, existing = null }: {
  customerId: string; refId: string; refType: "installment" | "addon"; amount: number; currency: string;
  payMethod?: string; payKind?: "installment" | "full"; customerEmail?: string; customerPhone?: string; existing?: Existing;
}) {
  const tr = useT();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  // الحالة الأولية من الداتا: لو الإيصال اتصدر قبل كده → نبدأ بحالة "اتصدر" (مش زر إصدار)
  const [rec, setRec] = useState<{ id: string; no: string; pdfUrl: string } | null>(existing ? { id: existing.id, no: existing.no, pdfUrl: "" } : null);

  async function go() {
    setBusy(true);
    const r = await issueAndSendReceipt({
      supabase, customerId, refId, refType, amount, currency, payKind: payKind || "installment",
      payMethod, email: customerEmail, phone: customerPhone, autoSend: true,
    });
    setBusy(false);
    if (!r.ok) {
      // الحارس في الباك-إند منع تكرار لنفس القسط → نعرض رقم الإيصال الموجود ونقفل الزر
      if ((r.error || "").includes("receipt_exists")) {
        const no = (r.error || "").split("receipt_exists:")[1]?.trim() || "";
        if (no) setRec({ id: existing?.id || "", no, pdfUrl: "" });
        toast(`${tr("receiptIssued")} ${no}`.trim());
        return;
      }
      toast(r.error || tr("errorGeneric"));
      return;
    }
    setRec({ id: r.data.id, no: r.data.receipt_no, pdfUrl: r.pdfUrl || "" });
    const sent = [r.sentEmail && "إيميل", r.sentWa && "واتساب"].filter(Boolean).join(" + ");
    const notes = (r.sendNotes || []).join(" · ");
    toast((sent ? `${tr("receiptIssued")} + ${tr("sentWord")}: ${sent}` : tr("receiptIssued")) + (notes ? ` — ⚠ ${notes}` : ""));
  }

  async function resend() {
    if (!rec || !rec.id) { toast(tr("errorGeneric")); return; }
    setBusy(true);
    const r = await resendReceipt({
      supabase, receiptId: rec.id, receiptNo: rec.no, customerId,
      amount: existing?.amount ?? amount, currency: existing?.currency ?? currency,
      serviceLabel: existing?.serviceLabel, email: customerEmail, phone: customerPhone,
    });
    setBusy(false);
    const sent = [r.sentEmail && "إيميل", r.sentWa && "واتساب"].filter(Boolean).join(" + ");
    toast((sent ? `${tr("resentWord")}: ${sent}` : tr("errorGeneric")) + (r.notes.length ? ` — ⚠ ${r.notes.join(" · ")}` : ""));
  }

  if (rec) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>✓ {rec.no}</span>
        {rec.pdfUrl && <a href={rec.pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>👁 PDF</a>}
        {rec.id && <button className="btn ghost" onClick={resend} disabled={busy} style={{ height: 28, padding: "0 9px", fontSize: 11 }}>{busy ? "..." : "🔁 " + tr("resendReceipt")}</button>}
      </span>
    );
  }
  return (
    <button className="btn" onClick={go} disabled={busy} style={{ height: 30, padding: "0 11px", fontSize: 12 }}>
      {busy ? "..." : "🧾 " + tr("issueAndSend")}
    </button>
  );
}
