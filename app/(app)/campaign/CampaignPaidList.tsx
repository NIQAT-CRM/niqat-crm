"use client";
import { useMemo, useState } from "react";
import { useT, useLang } from "@/lib/i18n/client";

// مدفوعات الحملة — شراء دبلومة من صفحة الدفع (enroll.niqat.com). عرض فقط (read-only).
export type PaidRow = {
  id: string; createdAt: string; paidAt: string; fullName: string; email: string; whatsapp: string;
  specialization: string; country: string; amount: number | null; currency: string; status: string;
  paypalCaptureId: string; invoiceUrl: string;
};

const nf = new Intl.NumberFormat("en-US");
function cairoDay(iso: string) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }
  catch { return String(iso).slice(0, 10); }
}

export default function CampaignPaidList({ rows }: { rows: PaidRow[] }) {
  const tr = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const [paidOnly, setPaidOnly] = useState(true);   // الافتراضي: مدفوع فقط (ده اللي بنتعامل معاه)
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const fmtDate = (iso: string) => iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

  const paidCount = useMemo(() => rows.filter((r) => r.status === "paid").length, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (paidOnly && r.status !== "paid") return false;
      if (!needle) return true;
      return [r.fullName, r.email, r.whatsapp, r.specialization, r.country, r.paypalCaptureId].some((v) => (v || "").toLowerCase().includes(needle));
    });
    list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1) * (dir === "desc" ? 1 : -1));
    return list;
  }, [rows, q, paidOnly, dir]);

  function exportCsv() {
    const head = [tr("colCreatedAt"), tr("colPaidAt"), tr("colFullName"), tr("colEmail"), tr("colWhatsapp"), tr("colSpecialization"), tr("colCountry"), tr("amount"), "currency", tr("colStatus"), tr("colPaypal")];
    const lines = shown.map((r) => [fmtDate(r.createdAt), fmtDate(r.paidAt), r.fullName, r.email, r.whatsapp, r.specialization, r.country, r.amount ?? "", r.currency, r.status, r.paypalCaptureId]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `campaign-paid-${cairoDay(new Date().toISOString())}.csv`; a.click();
  }

  const statusChip = (s: string) => {
    const map: Record<string, { bg: string; c: string; label: string }> = {
      paid: { bg: "var(--green-soft)", c: "var(--green)", label: tr("statusPaidWord") },
      pending: { bg: "var(--muted-soft)", c: "var(--muted)", label: tr("statusPendingWord") },
    };
    const st = map[s] || { bg: "var(--red-soft)", c: "var(--red)", label: s || "—" };
    return <span className="chip" style={{ background: st.bg, color: st.c, fontWeight: 700 }}>{st.label}</span>;
  };

  const cols = "1.4fr 1.6fr 140px 1.1fr 100px 120px 95px 150px 150px 150px";
  const H: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: "var(--muted)", padding: "10px 12px", whiteSpace: "nowrap" };
  const C: React.CSSProperties = { fontSize: 12.5, color: "var(--text)", padding: "11px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <input className="inp" placeholder={tr("searchColon")} value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 38, minWidth: 200, flex: 1 }} />
        <button className={"btn" + (paidOnly ? "" : " ghost")} style={{ height: 38 }} onClick={() => setPaidOnly((v) => !v)}>{paidOnly ? "✓ " : ""}{tr("paidOnly")}</button>
        <button className="btn ghost" style={{ height: 38 }} onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}>{tr("colCreatedAt")} {dir === "desc" ? "↓" : "↑"}</button>
        <button className="btn" style={{ height: 38 }} onClick={exportCsv}>⬇ {tr("exportExcel")}</button>
        <span style={{ fontSize: 12, color: "var(--muted)", marginInlineStart: "auto" }}>{shown.length} / {rows.length} · {tr("statusPaidWord")}: {paidCount}</span>
      </div>

      {rows.length === 0 ? <div style={{ padding: "48px 18px", textAlign: "center", color: "var(--muted)" }}>{tr("noClientsRows")}</div> : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--shadow)", overflowX: "auto" }}>
          <div style={{ minWidth: 1150 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
              <div style={H}>{tr("colFullName")}</div>
              <div style={H}>{tr("colEmail")}</div>
              <div style={H}>{tr("colWhatsapp")}</div>
              <div style={H}>{tr("colSpecialization")}</div>
              <div style={H}>{tr("colCountry")}</div>
              <div style={H}>{tr("amount")}</div>
              <div style={H}>{tr("colStatus")}</div>
              <div style={H}>{tr("colPaidAt")}</div>
              <div style={H}>{tr("colCreatedAt")}</div>
              <div style={H}>{tr("colPaypal")}</div>
            </div>
            {shown.map((r, i) => (
              <div key={r.id || i} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", alignItems: "center", background: i % 2 ? "transparent" : "var(--muted-soft)" }}>
                <div style={{ ...C, fontWeight: 700, color: "var(--ink)" }} title={r.fullName}>{r.fullName || "—"}</div>
                <div style={C} title={r.email}>{r.email || "—"}</div>
                <div style={C}><a href={`https://wa.me/${(r.whatsapp || "").replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="num" style={{ direction: "ltr", color: "var(--wa)", fontWeight: 700 }}>{r.whatsapp || "—"}</a></div>
                <div style={C} title={r.specialization}>{r.specialization || "—"}</div>
                <div style={C}>{r.country || "—"}</div>
                <div style={C}><span className="num" style={{ direction: "ltr", fontWeight: 800, color: "var(--ink)" }}>{r.amount != null ? nf.format(r.amount) : "—"} <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{r.currency}</span></span></div>
                <div style={C}>{statusChip(r.status)}</div>
                <div style={C}><span className="num" style={{ direction: "ltr", fontSize: 11.5, color: "var(--muted)" }}>{r.paidAt ? fmtDate(r.paidAt) : "—"}</span></div>
                <div style={C}><span className="num" style={{ direction: "ltr", fontSize: 11.5, color: "var(--muted)" }}>{fmtDate(r.createdAt)}</span></div>
                <div style={C}>
                  {r.paypalCaptureId
                    ? (r.invoiceUrl
                        ? <a href={r.invoiceUrl} target="_blank" rel="noreferrer" className="num" style={{ direction: "ltr", fontSize: 11, color: "var(--brand-d)", fontWeight: 700 }} title={r.paypalCaptureId}>{r.paypalCaptureId}</a>
                        : <span className="num" style={{ direction: "ltr", fontSize: 11, color: "var(--muted-d)" }} title={r.paypalCaptureId}>{r.paypalCaptureId}</span>)
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
