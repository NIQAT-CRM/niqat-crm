"use client";
import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";

const nf = new Intl.NumberFormat("en-US");

export default function ReceiptsLogView({ initial }: { initial: any[] }) {
  const tr = useT();
  const lang = useLang();
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

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
  const fmtDate = (iso: string) => iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

  const cols = "150px 1.3fr 1.4fr 110px 130px 1fr 110px";
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
          <div style={{ minWidth: 850 }}>
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
                  {!r.sent_email && !r.sent_whatsapp ? <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span> : null}
                </div>
                <div style={C}><button className="btn ghost" style={{ height: 30, padding: "0 11px", fontSize: 12 }} onClick={() => openPdf(r)}>👁 {tr("viewWord")}</button></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
