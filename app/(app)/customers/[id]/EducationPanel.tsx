"use client";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

type Data = {
  diplomaResults: any[];
  semesters: any[];
  certs: any[];
  accreds: { name: string; attempt: any | null }[];
  appeals: any[];
  comments: any[];
  batchCode: Record<string, string>;
  semTitle: Record<string, string>;
};

export default function EducationPanel({ customerId }: { customerId: string }) {
  const tr = useT();
  const supabase = createClient();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [dr, sr, ce, ad, ap, cm, bt] = await Promise.all([
        supabase.from("edu_diploma_results").select("id, batch_id, overall_pct, eligible, issue_status, result_shown_at").eq("customer_id", customerId),
        supabase.from("edu_semester_results").select("id, batch_semester_id, pct, status").eq("customer_id", customerId),
        supabase.from("edu_certificates").select("id, kind, status, code, source_type").eq("customer_id", customerId),
        supabase.from("edu_v_customer_addons").select("id, name, accreditation_id").eq("customer_id", customerId).eq("type", "accred"),
        supabase.from("edu_appeals").select("id, source_type, status, created_at").eq("customer_id", customerId),
        supabase.from("edu_comments").select("id, body, created_at, visible_to_customer").eq("customer_id", customerId).order("created_at", { ascending: false }),
        supabase.from("edu_exam_attempts").select("id, accreditation_id, score_pct, passed, issue_status, submitted_at").eq("customer_id", customerId),
      ]);

      const diplomaResults = (dr.data as any[]) || [];
      const semesters = (sr.data as any[]) || [];
      const certs = (ce.data as any[]) || [];
      const addons = (ad.data as any[]) || [];
      const appeals = (ap.data as any[]) || [];
      const comments = ((cm.data as any[]) || []).filter((x) => x.visible_to_customer !== false);
      const attempts = (bt.data as any[]) || [];

      // أسماء الباتشات والسمسترات
      const batchIds = [...new Set([...diplomaResults.map((r) => r.batch_id)].filter(Boolean))];
      const semIds = [...new Set(semesters.map((s) => s.batch_semester_id).filter(Boolean))];
      const [bRes, sRes] = await Promise.all([
        batchIds.length ? supabase.from("edu_v_batches").select("id, code").in("id", batchIds) : Promise.resolve({ data: [] }),
        semIds.length ? supabase.from("edu_batch_semesters").select("id, title").in("id", semIds) : Promise.resolve({ data: [] }),
      ]);
      const batchCode: Record<string, string> = {};
      for (const b of (bRes.data as any[]) || []) batchCode[b.id] = b.code;
      const semTitle: Record<string, string> = {};
      for (const s of (sRes.data as any[]) || []) semTitle[s.id] = s.title;

      const accreds = addons.map((a) => ({
        name: a.name || "—",
        attempt: attempts.find((t) => t.accreditation_id === a.accreditation_id) || null,
      }));

      if (alive) { setD({ diplomaResults, semesters, certs, accreds, appeals, comments, batchCode, semTitle }); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [customerId, supabase]);

  if (loading) return <div style={{ padding: 24, fontSize: 13, color: "var(--muted)" }}>{tr("eduLoading")}</div>;
  if (!d) return null;

  const empty = !d.diplomaResults.length && !d.semesters.length && !d.certs.length && !d.accreds.length && !d.appeals.length;

  const issueLabel = (s: string) => ({ not_eligible: tr("eduNotEligible"), eligible: tr("eduEligible"), issuing: tr("eduIssuing"), issued: tr("eduIssued"), failed: tr("eduIssueFailed") } as any)[s] || s;
  const issueColor = (s: string) => ({ issued: ["#18794e", "#e7f7ec"], eligible: ["#8a5a00", "#fdf0d8"], issuing: ["#8a5a00", "#fdf0d8"], failed: ["#b42318", "#fdecea"], not_eligible: ["var(--muted)", "var(--muted-soft)"] } as any)[s] || ["var(--muted)", "var(--muted-soft)"];
  const certLabel = (s: string) => ({ pending: tr("eduPendingStatus"), issuing: tr("eduIssuing"), issued: tr("eduIssued"), failed: tr("eduIssueFailed"), manual_wait: tr("eduManualWait") } as any)[s] || s;
  const appealLabel = (s: string) => ({ open: tr("eduAppealOpen"), under_review: tr("eduAppealReview"), upheld: tr("eduAppealUpheld"), rejected: tr("eduAppealRejected") } as any)[s] || s;

  const Chip = ({ label, colors }: { label: string; colors: [string, string] }) => (
    <span className="chip" style={{ background: colors[1], color: colors[0] }}>{label}</span>
  );
  const Sec = ({ title, children }: { title: string; children: any }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--muted)", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  if (empty) return <div style={{ padding: 24, fontSize: 13, color: "var(--muted)" }}>{tr("eduNoEduData")}</div>;

  return (
    <div style={{ padding: 16 }}>
      {/* نتيجة الدبلومة */}
      {d.diplomaResults.length > 0 && (
        <Sec title={tr("eduDiplomaResult")}>
          {d.diplomaResults.map((r) => (
            <div key={r.id} style={rowCard}>
              <span className="num" style={{ fontWeight: 800, fontSize: 13, color: "var(--ink)" }} dir="ltr">{d.batchCode[r.batch_id] || "—"}</span>
              {r.overall_pct != null && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{Math.round(r.overall_pct)}%</span>}
              <span style={{ flex: 1 }} />
              <Chip label={r.eligible ? tr("eduEligible") : issueLabel(r.issue_status)} colors={issueColor(r.issue_status) as any} />
            </div>
          ))}
        </Sec>
      )}

      {/* السمسترات */}
      {d.semesters.length > 0 && (
        <Sec title={tr("eduSemesters")}>
          {d.semesters.map((s) => (
            <div key={s.id} style={rowCard}>
              <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{d.semTitle[s.batch_semester_id] || "—"}</span>
              {s.pct != null && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{Math.round(s.pct)}%</span>}
              <Chip label={s.status === "locked" ? tr("eduLocked") : tr("eduOpenStatus")} colors={(s.status === "locked" ? ["#18794e", "#e7f7ec"] : ["var(--muted)", "var(--muted-soft)"]) as any} />
            </div>
          ))}
        </Sec>
      )}

      {/* الاعتمادات المدفوعة */}
      {d.accreds.length > 0 && (
        <Sec title={tr("eduAccredsSec")}>
          {d.accreds.map((a, i) => (
            <div key={i} style={rowCard}>
              <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{a.name}</span>
              {a.attempt?.score_pct != null && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{Math.round(a.attempt.score_pct)}%</span>}
              {a.attempt && <Chip label={a.attempt.passed ? tr("eduPassed") : tr("eduFailedStatus")} colors={(a.attempt.passed ? ["#18794e", "#e7f7ec"] : ["#b42318", "#fdecea"]) as any} />}
              {a.attempt?.issue_status && <Chip label={issueLabel(a.attempt.issue_status)} colors={issueColor(a.attempt.issue_status) as any} />}
            </div>
          ))}
        </Sec>
      )}

      {/* الشهادات */}
      {d.certs.length > 0 && (
        <Sec title={tr("eduCerts")}>
          {d.certs.map((c) => (
            <div key={c.id} style={rowCard}>
              <span style={{ fontSize: 13, color: "var(--ink)", flex: 1, textTransform: "capitalize" }}>{c.kind}</span>
              {c.code && <span className="num" style={{ fontSize: 11.5, color: "var(--muted)" }} dir="ltr">{c.code}</span>}
              <Chip label={certLabel(c.status)} colors={issueColor(c.status === "manual_wait" ? "issuing" : c.status) as any} />
            </div>
          ))}
        </Sec>
      )}

      {/* التظلمات */}
      {d.appeals.length > 0 && (
        <Sec title={tr("eduAppealsSec")}>
          {d.appeals.map((a) => (
            <div key={a.id} style={rowCard}>
              <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{a.source_type === "exam" ? tr("eduAccredsSec") : tr("eduDiplomaResult")}</span>
              <Chip label={appealLabel(a.status)} colors={(a.status === "upheld" ? ["#18794e", "#e7f7ec"] : a.status === "rejected" ? ["#b42318", "#fdecea"] : ["#8a5a00", "#fdf0d8"]) as any} />
            </div>
          ))}
        </Sec>
      )}

      {/* كومنتات المصححين */}
      {d.comments.length > 0 && (
        <Sec title={tr("eduCommentsSec")}>
          {d.comments.map((c) => (
            <div key={c.id} style={{ ...rowCard, alignItems: "flex-start", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "var(--ink)" }}>{c.body}</span>
              <span className="num" style={{ fontSize: 11, color: "var(--muted)" }} dir="ltr">{String(c.created_at).slice(0, 10)}</span>
            </div>
          ))}
        </Sec>
      )}
    </div>
  );
}

const rowCard: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
  border: "1px solid var(--line)", borderRadius: 9, marginBottom: 6, background: "var(--surface)",
};
