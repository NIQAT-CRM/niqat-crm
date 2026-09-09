"use client";
import { useMemo, useState } from "react";
import { useT, useLang } from "@/lib/i18n/client";

export type Reg = {
  id: string; createdAt: string; fullName: string; email: string; whatsapp: string;
  specialization: string; country: string; experience: string; role: string;
  software: string; source: string; status: string;
};

export default function CampaignView({ rows }: { rows: Reg[] }) {
  const tr = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dir, setDir] = useState<"desc" | "asc">("desc"); // ترتيب حسب تاريخ التسجيل

  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status).filter(Boolean))), [rows]);

  const fmtDate = (iso: string) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (!needle) return true;
      return [r.fullName, r.email, r.whatsapp, r.specialization, r.country, r.role, r.experience]
        .some((v) => (v || "").toLowerCase().includes(needle));
    });
    list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1) * (dir === "desc" ? 1 : -1));
    return list;
  }, [rows, q, status, dir]);

  // أعمدة الجدول (CSS Grid — بديل موثوق لـ<table> في RTL)
  const cols = "150px 1.4fr 1.6fr 130px 1.2fr 100px 90px 1fr 110px";
  const H: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: "var(--muted)", padding: "10px 12px", whiteSpace: "nowrap" };
  const C: React.CSSProperties = { fontSize: 12.5, color: "var(--text)", padding: "11px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

  return (
    <div>
      {/* أدوات الفلترة والفرز */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <input className="inp" placeholder={tr("searchColon")} value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 38, minWidth: 220, flex: 1 }} />
        <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38, width: "auto", minWidth: 150 }}>
          <option value="">{tr("allWord")} — {tr("colStatus")}</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn ghost" style={{ height: 38 }} onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}>
          {tr("colCreatedAt")} {dir === "desc" ? "↓" : "↑"}
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", marginInlineStart: "auto" }}>{shown.length} / {rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--muted)" }}>{tr("noCampaignRows")}</div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--sh)", overflowX: "auto" }}>
          <div style={{ minWidth: 1050 }}>
            {/* الهيدر */}
            <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
              <div style={H}>{tr("colCreatedAt")}</div>
              <div style={H}>{tr("colFullName")}</div>
              <div style={H}>{tr("colEmail")}</div>
              <div style={H}>{tr("colWhatsapp")}</div>
              <div style={H}>{tr("colSpecialization")}</div>
              <div style={H}>{tr("colCountry")}</div>
              <div style={H}>{tr("colExperience")}</div>
              <div style={H}>{tr("colRole")}</div>
              <div style={H}>{tr("colStatus")}</div>
            </div>
            {/* الصفوف */}
            {shown.map((r, i) => (
              <div key={r.id || i} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", alignItems: "center", background: i % 2 ? "transparent" : "var(--muted-soft)" }}>
                <div className="n" style={{ ...C, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{fmtDate(r.createdAt)}</div>
                <div style={{ ...C, fontWeight: 700, color: "var(--ink)" }} title={r.fullName}>{r.fullName || "—"}</div>
                <div style={{ ...C, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }} title={r.email}>{r.email || "—"}</div>
                <div className="n" style={{ ...C, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{r.whatsapp || "—"}</div>
                <div style={C} title={r.specialization}>{r.specialization || "—"}</div>
                <div style={C}>{r.country || "—"}</div>
                <div style={C}>{r.experience || "—"}</div>
                <div style={C} title={r.role}>{r.role || "—"}</div>
                <div style={C}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "var(--brand-soft)", color: "var(--brand-d)" }}>{r.status || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
