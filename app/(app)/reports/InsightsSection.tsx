"use client";
import Link from "next/link";
import { useT, useLang } from "@/lib/i18n/client";

type TopDip = { name: string; enrollments: number; pct: number } | null;
type Peak = { peak_hour: number; peak_count: number; distribution: any } | null;
type Batch = { batch_id: string; code: string; registered: number; capacity: number; pct: number };
type Stale = { count: number; list: any[] };
type Trend = { currency?: string; total: number; prev_total?: number; change_pct: number | null; top_day: { date: string; amount: number } | null } | null;

type Fin = { count: number; total_egp: number; total_usd: number } | null;
export type InsightsData = {
  topDip: TopDip;
  peak: Peak;
  batches: Batch[];
  stale: Stale;
  trend: Trend;
  topSource: { source: string; customers: number; enrolled: number; pct: number } | null;
  unassigned: { count: number; list: any[] };
  staleTickets: { count: number; list: any[] };
  pendingHandoffs: { count: number; list: any[] };
  specialtyDist: { name: string; count: number; pct: number }[];
  overdue: Fin;
  expectedWeek: Fin;
  refundsMonth: Fin;
};

function hourLabel(h: number, lang: "ar" | "en") {
  const hr = ((h % 24) + 24) % 24;
  if (lang === "en") {
    const ampm = hr < 12 ? "AM" : "PM"; const h12 = hr % 12 === 0 ? 12 : hr % 12;
    const h12b = (hr + 2) % 12 === 0 ? 12 : (hr + 2) % 12; const ampmB = (hr + 2) % 24 < 12 ? "AM" : "PM";
    return `${h12} ${ampm} – ${h12b} ${ampmB}`;
  }
  const per = hr < 12 ? "صباحاً" : "مساءً";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  const hb = (hr + 2) % 12 === 0 ? 12 : (hr + 2) % 12;
  return `${h12} – ${hb} ${per}`;
}

export default function InsightsSection({ insights, canFinance }: { insights: InsightsData; canFinance: boolean }) {
  const tr = useT();
  const lang = useLang();
  const { topDip, peak, batches, stale, trend, topSource, unassigned, staleTickets, pendingHandoffs, specialtyDist, overdue, expectedWeek, refundsMonth } = insights;
  const nf = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));
  const money = (f: { total_egp: number; total_usd: number }) => {
    const parts: string[] = [];
    if (f.total_egp) parts.push(`${nf(f.total_egp)} ${tr("egpShort")}`);
    if (f.total_usd) parts.push(`${nf(f.total_usd)} $`);
    return parts.join(" · ") || `0 ${tr("egpShort")}`;
  };

  // نسبة الذروة — distribution عبارة عن [{hour,count}]
  let peakPct = 0;
  if (peak?.distribution) {
    const dist = Array.isArray(peak.distribution) ? peak.distribution : Object.values(peak.distribution);
    const tot = (dist as any[]).reduce((a, b) => a + (Number(b?.count ?? b) || 0), 0);
    if (tot > 0) peakPct = Math.round(((peak.peak_count || 0) / tot) * 100);
  }
  const hasCollectionSuggestion = trend && trend.change_pct != null && Number(trend.change_pct) > 0;

  return (
    <div className="fade-in" style={{ marginTop: 26, borderTop: "1px solid var(--line)", paddingTop: 22 }}>
      {/* عنوان القسم */}
      <div className="ai-top" style={{ marginBottom: 6 }}>
        <div>
          <div className="ai-hi">{tr("insightsLast30")}</div>
          <h2 className="ai-h1" style={{ fontSize: 20 }}>
            <span className="ai-spark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg></span>
            {tr("insightsTitle")}
          </h2>
        </div>
        <span className="ai-badge">{tr("aiFree")}</span>
      </div>

      {/* اللي بيحصل دلوقتي */}
      <div className="ai-sh"><span className="tick" /><h2>{tr("insightsNow")}</h2></div>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", alignItems: "stretch" }}>
        {/* أكتر دبلومة حجزاً */}
        <div className="card ai-ins">
          <div className="top-r"><span className="ic" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /></svg></span><span className="lab">{tr("insTopDiploma")}</span></div>
          {topDip ? (<><div className="big">{topDip.name}</div><div className="sub num">{topDip.enrollments} {tr("enrollWord")} · {topDip.pct}%</div></>)
            : <div className="ai-empty">{tr("insNoData")}</div>}
        </div>

        {/* وقت الذروة */}
        <div className="card ai-ins">
          <div className="top-r"><span className="ic" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><span className="lab">{tr("insPeakTime")}</span></div>
          {peak && peak.peak_count > 0 ? (<><div className="big n">{hourLabel(Number(peak.peak_hour), lang)}</div><div className="sub num">{peakPct > 0 ? `${peakPct}% ${tr("insOfEnrolls")}` : `${peak.peak_count} ${tr("enrollWord")}`}</div></>)
            : <div className="ai-empty">{tr("insNoData")}</div>}
        </div>

        {/* اتجاه التحصيل — مالي: يظهر فقط لو trend مش null (can_finance) */}
        {canFinance && trend && (
          <div className="card ai-ins">
            <div className="top-r"><span className="ic" style={{ background: "var(--green-soft)", color: "var(--green)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 7l-8.5 8.5-5-5L2 17" /></svg></span><span className="lab">{tr("insCollectionTrend")}</span></div>
            <div className="big num" dir="ltr">{nf(trend.total)} <span style={{ fontSize: 13, color: "var(--muted)" }}>{trend.currency || "EGP"}</span></div>
            <div className="sub">
              {trend.change_pct != null
                ? <span style={{ color: Number(trend.change_pct) >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }} className="num" dir="ltr">{Number(trend.change_pct) >= 0 ? "▲ +" : "▼ "}{trend.change_pct}%</span>
                : <span>{tr("insNoPrevPeriod")}</span>}
              {trend.top_day && <span> · {tr("insTopDay")}: {trend.top_day.date}</span>}
            </div>
          </div>
        )}

        {/* أفضل مصدر تحويلاً */}
        <div className="card ai-ins">
          <div className="top-r"><span className="ic" style={{ background: "var(--teal-soft, rgba(15,163,163,.12))", color: "var(--teal, #0FA3A3)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4v16M4 8h12l-2-2M4 14h9l-2-2" /></svg></span><span className="lab">{tr("insTopSource")}</span></div>
          {topSource ? (<><div className="big">{topSource.source}</div><div className="sub num" dir="ltr">{topSource.pct}% · {topSource.enrolled}/{topSource.customers}</div></>)
            : <div className="ai-empty">{tr("insNoData")}</div>}
        </div>

        {/* توزيع التخصصات */}
        {specialtyDist.length > 0 && (
          <div className="card ai-ins">
            <div className="top-r"><span className="ic" style={{ background: "var(--purple-soft, rgba(123,97,255,.12))", color: "var(--purple, #7B61FF)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 3v18h18" /><rect x="7" y="10" width="3" height="8" /><rect x="12" y="6" width="3" height="12" /><rect x="17" y="13" width="3" height="5" /></svg></span><span className="lab">{tr("insSpecialtyDist")}</span></div>
            <div style={{ marginTop: 4 }}>
              {specialtyDist.slice(0, 4).map((s) => (
                <div key={s.name} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "3px 0" }}>
                  <span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <b className="num" dir="ltr" style={{ color: "var(--muted)", flexShrink: 0 }}>{s.pct}%</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* اقتراحات ليك */}
      <div className="ai-sh"><span className="tick" /><h2>{tr("insSuggestions")}</h2></div>
      <div className="card">
        {/* باتشات قرب تكمل */}
        {batches.length > 0 ? batches.slice(0, 4).map((b) => (
          <div key={b.batch_id} className="ai-sug">
            <span className="tag" style={{ background: "var(--amber-soft)", color: "#9a6a12" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t">{tr("insBatchFilling").replace("{code}", b.code)} <span className="num" dir="ltr">({b.registered} / {b.capacity})</span></div>
              <div className="d num" dir="ltr">{b.pct}% {tr("insFilled")}</div>
            </div>
            <Link href="/batches" className="ai-act">{tr("insOpenBatch")}</Link>
          </div>
        )) : (
          <div className="ai-sug"><span className="tag" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg></span><div style={{ flex: 1 }}><div className="d">{tr("insNoBatchesFilling")}</div></div></div>
        )}

        {/* عملاء بايتين */}
        {stale.count > 0 ? (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--red-soft)", color: "var(--red)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{stale.count}</span> {tr("insStaleLeads")}</div>
              <div className="d">{tr("insStaleSub")}</div>
            </div>
            <Link href="/customers?idle=7" className="ai-act">{tr("insShowThem")}</Link>
          </div>
        ) : (
          <div className="ai-sug"><span className="tag" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg></span><div style={{ flex: 1 }}><div className="d">{tr("insNoStaleLeads")}</div></div></div>
        )}

        {/* التحصيل بيرتفع — مالي */}
        {canFinance && hasCollectionSuggestion && trend && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--green-soft)", color: "var(--green)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 7l-8.5 8.5-5-5L2 17" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t num" dir="ltr">{tr("insCollectionUp").replace("{pct}", String(trend.change_pct))}</div>
              {trend.top_day && <div className="d">{tr("insTopDay")}: {trend.top_day.date}</div>}
            </div>
            <Link href="/reports" className="ai-act">{tr("insReport")}</Link>
          </div>
        )}

        {/* عملاء بدون مسؤول */}
        {unassigned.count > 0 && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--blue-soft)", color: "var(--blue)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{unassigned.count}</span> {tr("insUnassigned")}</div>
              <div className="d">{tr("insUnassignedSub")}</div>
            </div>
            <Link href="/customers" className="ai-act">{tr("insAssignThem")}</Link>
          </div>
        )}

        {/* تذاكر متأخرة */}
        {staleTickets.count > 0 && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--amber-soft)", color: "#9a6a12" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{staleTickets.count}</span> {tr("insStaleTickets")}</div>
              <div className="d">{tr("insStaleTicketsSub")}</div>
            </div>
            <Link href="/support" className="ai-act">{tr("insTicketsBtn")}</Link>
          </div>
        )}

        {/* طلبات تفعيل معلّقة */}
        {pendingHandoffs.count > 0 && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{pendingHandoffs.count}</span> {tr("insPendingHandoffs")}</div>
              <div className="d">{tr("insPendingHandoffsSub")}</div>
            </div>
            <Link href="/onboarding" className="ai-act">{tr("insOnboardingBtn")}</Link>
          </div>
        )}

        {/* أقساط متأخرة — مالي */}
        {canFinance && overdue && overdue.count > 0 && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--red-soft)", color: "var(--red)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{overdue.count}</span> {tr("insOverdue")} · <span className="num" dir="ltr">{money(overdue)}</span></div>
              <div className="d">{tr("insOverdueSub")}</div>
            </div>
            <Link href="/finance" className="ai-act">{tr("insReport")}</Link>
          </div>
        )}

        {/* متوقع تحصيله الأسبوع الجاي — مالي */}
        {canFinance && expectedWeek && expectedWeek.count > 0 && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--green-soft)", color: "var(--green)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{expectedWeek.count}</span> {tr("insInstWord")} · <span className="num" dir="ltr">{money(expectedWeek)}</span></div>
              <div className="d">{tr("insExpectedWeekSub")}</div>
            </div>
          </div>
        )}

        {/* استردادات الشهر — مالي */}
        {canFinance && refundsMonth && refundsMonth.count > 0 && (
          <div className="ai-sug">
            <span className="tag" style={{ background: "var(--muted-soft)", color: "var(--muted)" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 0 2.5-7.5L3 8" /></svg></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t"><span className="num">{refundsMonth.count}</span> {tr("insRefundsMonth")} · <span className="num" dir="ltr">{money(refundsMonth)}</span></div>
              <div className="d">{tr("insRefundsMonthSub")}</div>
            </div>
            <Link href="/refunds" className="ai-act">{tr("insReport")}</Link>
          </div>
        )}
      </div>

      <div className="ai-perm" style={{ marginTop: 14 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
        <span>{tr("insightsFootnote")}</span>
      </div>
    </div>
  );
}
