"use client";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";

type Perf = { name: string; total: number; eligible: number; rate: number };
type Batch = { code: string; diploma: string; total: number; eligible: number; rate: number };
type Grader = { name: string; graded: number };
type Accred = { name: string; submitted: number; passed: number; rate: number };

export default function DashboardView({ kpis, diplomaPerf, struggling, graders, appeals, accredPerf }: {
  kpis: any; diplomaPerf: Perf[]; struggling: Batch[]; graders: Grader[];
  appeals: { open: number; review: number; upheld: number; rejected: number; failedIssues: number };
  accredPerf: Accred[];
}) {
  const tr = useT();
  const [exp, setExp] = useState(false);

  const kpiCards = [
    { label: tr("eduKpiEnrolls"), value: kpis.enrolls },
    { label: tr("eduKpiDiplomas"), value: kpis.diplomas },
    { label: tr("eduKpiOpenBatches"), value: kpis.openBatches },
    { label: tr("eduKpiEligRate"), value: `${kpis.eligRate}%`, hint: `${kpis.eligPass}/${kpis.eligTotal}`, accent: true },
    { label: tr("eduKpiCerts"), value: kpis.certsIssued },
    { label: tr("eduKpiAccreds"), value: kpis.accreds },
    { label: tr("eduKpiExamRate"), value: `${kpis.examRate}%`, hint: `${kpis.examPassed}/${kpis.examSubmitted}`, accent: true },
    { label: tr("eduKpiAppeals"), value: kpis.apOpen },
  ];

  async function exportAll() {
    setExp(true);
    const rows: (string | number)[][] = [];
    rows.push([tr("eduSecOverview"), "", ""]);
    for (const k of kpiCards) rows.push([k.label, String(k.value), k.hint || ""]);
    rows.push(["", "", ""]);
    rows.push([tr("eduSecDiploma"), tr("eduStudentsGraded"), tr("eduEligRate")]);
    for (const d of diplomaPerf) rows.push([d.name, d.total, `${d.rate}%`]);
    rows.push(["", "", ""]);
    rows.push([tr("eduSecTeam"), "", ""]);
    for (const g of graders) rows.push([g.name, g.graded, ""]);
    rows.push([tr("eduAppealOpen"), appeals.open + appeals.review, ""]);
    rows.push([tr("eduAppealUpheld"), appeals.upheld, ""]);
    rows.push([tr("eduAppealRejected"), appeals.rejected, ""]);
    rows.push([tr("eduFailedIssues"), appeals.failedIssues, ""]);
    rows.push(["", "", ""]);
    rows.push([tr("eduSecAccreds"), tr("eduExamsCount"), tr("eduKpiExamRate")]);
    for (const a of accredPerf) rows.push([a.name, a.submitted, `${a.rate}%`]);

    try {
      const res = await fetch("/api/edu/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "generic", title: tr("eduDashboard"), headers: [tr("name"), "#", "%"], rows }),
      });
      if (!res.ok) { toast(tr("exportFailed")); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "niqat-education-dashboard.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast(tr("exportFailed")); }
    finally { setExp(false); }
  }

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h1>{tr("eduDashboard")}</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{tr("eduDashDesc")}</p>
        </div>
        <button className="btn ghost sm" onClick={exportAll} disabled={exp}>⬇ {tr("exportExcel")}</button>
      </div>

      {/* ١) نظرة عامة */}
      <Section title={tr("eduSecOverview")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {kpiCards.map((k, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.accent ? "var(--brand)" : "var(--ink)", marginTop: 6, lineHeight: 1 }}>{k.value}</div>
              {k.hint && <div className="num" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }} dir="ltr">{k.hint}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* ٢) أداء الدبلومات/الباتشات */}
      <Section title={tr("eduSecDiploma")}>
        <div className="card" style={{ padding: 16 }}>
          {diplomaPerf.length === 0 ? <Empty t={tr("eduNoDataYet")} /> : diplomaPerf.map((d, i) => (
            <Bar key={i} label={d.name} pct={d.rate} sub={`${d.eligible}/${d.total}`} />
          ))}
          {struggling.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#b42318", marginBottom: 8 }}>⚠️ {tr("eduStruggling")}</div>
              {struggling.map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
                  <span className="num" style={{ fontWeight: 700 }} dir="ltr">{b.code}</span>
                  <span style={{ color: "var(--muted)" }}>· {b.diploma}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ color: "#b42318", fontWeight: 700 }}>{b.rate}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ٣) أداء الفريق */}
      <Section title={tr("eduSecTeam")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--muted)", marginBottom: 10 }}>{tr("eduGraderProductivity")}</div>
            {graders.length === 0 ? <Empty t={tr("eduNoDataYet")} /> : graders.map((g, i) => {
              const max = Math.max(...graders.map((x) => x.graded), 1);
              return <Bar key={i} label={g.name} pct={Math.round((g.graded / max) * 100)} sub={String(g.graded)} raw />;
            })}
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--muted)", marginBottom: 10 }}>{tr("eduAppeals")}</div>
            <Stat label={tr("eduAppealOpen")} v={appeals.open + appeals.review} />
            <Stat label={tr("eduAppealUpheld")} v={appeals.upheld} color="#18794e" />
            <Stat label={tr("eduAppealRejected")} v={appeals.rejected} color="#b42318" />
            <Stat label={tr("eduFailedIssues")} v={appeals.failedIssues} color="#b42318" />
          </div>
        </div>
      </Section>

      {/* ٤) الاعتمادات المدفوعة */}
      <Section title={tr("eduSecAccreds")}>
        <div className="card" style={{ padding: 16 }}>
          {accredPerf.length === 0 ? <Empty t={tr("eduNoAccreds")} /> : accredPerf.map((a, i) => (
            <Bar key={i} label={a.name} pct={a.rate} sub={`${a.passed}/${a.submitted}`} />
          ))}
        </div>
      </Section>

      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>🔒 {tr("eduDashNoFinance")}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Bar({ label, pct, sub, raw }: { label: string; pct: number; sub?: string; raw?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ flex: 1, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span className="num" style={{ color: "var(--muted)", fontWeight: 700 }} dir="ltr">{raw ? sub : `${pct}%`}{raw ? "" : sub ? ` · ${sub}` : ""}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--muted-soft)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: "var(--brand)", borderRadius: 999 }} />
      </div>
    </div>
  );
}
function Stat({ label, v, color }: { label: string; v: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ flex: 1, fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: color || "var(--ink)" }}>{v}</span>
    </div>
  );
}
function Empty({ t }: { t: string }) {
  return <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{t}</div>;
}
const _s: CSSProperties = {};
