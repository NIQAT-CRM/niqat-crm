"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import { issueAndSendReceipt } from "@/lib/issueReceipt";

const nf = new Intl.NumberFormat("en-US");

export default function ReceiptIssuer({ customerId, refId, refType, amount, currency, payMethod, payKind, customerEmail, customerPhone }: {
  customerId: string; refId: string; refType: "installment" | "addon"; amount: number; currency: string;
  payMethod?: string; payKind?: "installment" | "full"; customerEmail?: string; customerPhone?: string;
}) {
  const tr = useT();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ no: string; pdfUrl: string; notes: string[] } | null>(null);

  async function go() {
    setBusy(true);
    const r = await issueAndSendReceipt({
      supabase, customerId, refId, refType, amount, currency, payKind: payKind || "installment",
      payMethod, email: customerEmail, phone: customerPhone, autoSend: true,
    });
    setBusy(false);
    if (!r.ok) { toast(r.error || tr("errorGeneric")); return; }
    setDone({ no: r.data.receipt_no, pdfUrl: r.pdfUrl || "", notes: r.sendNotes || [] });
    const sent = [r.sentEmail && "إيميل", r.sentWa && "واتساب"].filter(Boolean).join(" + ");
    toast(sent ? `${tr("receiptIssued")} + ${tr("sentWord")}: ${sent}` : tr("receiptIssued"));
  }

  if (done) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 700 }}>✓ {done.no}</span>
        {done.pdfUrl && <a href={done.pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>👁 PDF</a>}
      </span>
    );
  }
  return (
    <button className="btn" onClick={go} disabled={busy} style={{ height: 30, padding: "0 11px", fontSize: 12 }}>
      {busy ? "..." : "🧾 " + tr("issueAndSend")}
    </button>
  );
}
