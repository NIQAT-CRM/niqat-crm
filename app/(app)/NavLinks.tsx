"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type Perms = {
  canReports?: boolean;
  canUsers?: boolean;
  canSettings?: boolean;
  canGrant?: boolean;
  canAi?: boolean;
  canPipeline?: boolean;
  canSupport?: boolean;
  canActivations?: boolean;
  canUniversities?: boolean;
  canReceipts?: boolean;
  canDashboard?: boolean;
  canCustomers?: boolean;
  canTasks?: boolean;
  canBatches?: boolean;
  canViewPrices?: boolean;
  canRefunds?: boolean;
  canArchive?: boolean;
  canEducation?: boolean;
  canFeedback?: boolean;
  isAdmin?: boolean;
  eduMode?: boolean;
  eduRole?: string | null;
  dueCount?: number;
  handoffCount?: number;
  refundCount?: number;
};

const I: Record<string, string> = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M16 5.2A3 3 0 0 1 16 11M17 14.6c2.4.5 4 2.5 4 5.4"/></svg>',
  pipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/></svg>',
  task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/></svg>',
  batch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 16.5l9 5 9-5"/></svg>',
  uni2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l10 5-10 5L2 8l10-5z"/><path d="M6 10.5V15c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="2.5" y="13" width="4" height="6" rx="2"/><rect x="17.5" y="13" width="4" height="6" rx="2"/><path d="M20 19v.5a3 3 0 0 1-3 3h-3"/></svg>',
  onb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  refund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.5-7.5L3 8"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M9 12h6"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 4-6"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7 7 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.8 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L4.6 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.8 2.5h5l.8-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5z"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h13M3 12h18M3 18h9"/><circle cx="18" cy="6" r="2.2"/><circle cx="15" cy="18" r="2.2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1a8.38 8.38 0 0 1-.9-3.9 8.5 8.5 0 0 1 8.4-8.9 8.5 8.5 0 0 1 8.6 8.4z"/></svg>',
  ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
  edu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  feedback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>',
};

type Item = { href: string; key: string; tk: string; badge?: number };

export default function NavLinks(p: Perms) {
  const path = usePathname() || "/";
  const t = useT();
  const closeSb = () => document.getElementById("sb")?.classList.remove("open");

  const A = !!p.isAdmin; // الأدمن يشوف كل حاجة
  const main: Item[] = [];
  if (A || p.canDashboard !== false) main.push({ href: "/", key: "dash", tk: "dash" });
  if (A || p.canCustomers !== false) main.push({ href: "/customers", key: "users", tk: "customers" });
  if (A || p.canPipeline) main.push({ href: "/pipeline", key: "pipe", tk: "pipeline" });
  if (A || p.canTasks !== false) main.push({ href: "/my-tasks", key: "task", tk: "myTasks", badge: p.dueCount });

  // الرؤى بقت جزء من صفحة التقارير (نفس صلاحية can_view_reports) — مبقاش بند مستقل
  const teams: Item[] = [];
  if (A || p.canSupport) teams.push({ href: "/support", key: "support", tk: "support" });
  if (A || p.canActivations) teams.push({ href: "/onboarding", key: "onb", tk: "onboarding", badge: p.handoffCount });
  // «فريق التعليم» بقى مجموعة منسدلة (تحت) بدل رابط مفرد
  if (A || p.canFeedback) teams.push({ href: "/feedback", key: "feedback", tk: "feedbackNav" });
  if (A || p.canRefunds !== false) teams.push({ href: "/refunds", key: "refund", tk: "refunds", badge: p.refundCount });
  if (p.canReceipts) teams.push({ href: "/screenshots", key: "receipt", tk: "screenshots" });
  if (A || p.canArchive !== false) teams.push({ href: "/archive", key: "archive", tk: "archive" });
  if (p.canReports) teams.push({ href: "/reports", key: "report", tk: "reports" });

  // المستخدمون + سجل الشات بقوا تبويبات جوّه الإعدادات — مبقاش فيه صفحات منفصلة
  const admin: Item[] = [];
  if (p.canSettings || p.canUsers || p.isAdmin) admin.push({ href: "/settings", key: "cog", tk: "settings" });

  // ===== قسم «فريق التعليم» =====
  const eduItems: Item[] = [
    { href: "/education", key: "batch", tk: "eduDiplomasBatches" },
    { href: "/education/grading", key: "task", tk: "eduGrading" },
    { href: "/education/accreditations", key: "uni2", tk: "eduAccreditations" },
    { href: "/education/appeals", key: "feedback", tk: "eduAppeals" },
    { href: "/education/dashboard", key: "dash", tk: "eduDashboard" },
    { href: "/education/members", key: "users", tk: "eduPermissions" },
  ];
  const eduRole = p.eduRole || null;
  const eduCanSee = (href: string): boolean => {
    if (p.eduMode) {
      if (eduRole === "edu_admin") return true;
      if (eduRole === "edu_staff") return href === "/education";
      if (eduRole === "edu_grader") return href === "/education/grading";
      return false; // instructor/غير معروف
    }
    if (href === "/education/members") return A; // الصلاحيات: الأدمن العام فقط في الوضع العادي
    return true;
  };
  const eduActive = (href: string) => (href === "/education" ? path === "/education" : path.startsWith(href));
  const EduBtn = (n: Item) => (
    <Link key={n.href} href={n.href} onClick={closeSb} className={eduActive(n.href) ? "on" : ""}>
      <span dangerouslySetInnerHTML={{ __html: I[n.key] }} />
      <span>{t(n.tk)}</span>
    </Link>
  );

  // عضو تعليم صافي (مش أدمن عام) → قايمة معزولة: «فريق التعليم» فقط
  if (p.eduMode) {
    return (
      <nav className="nav">
        <div className="sect">{t("eduTeam")}</div>
        {eduItems.filter((n) => eduCanSee(n.href)).map(EduBtn)}
      </nav>
    );
  }

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const Btn = (n: Item) => (
    <Link
      key={n.href}
      href={n.href}
      onClick={closeSb}
      className={isActive(n.href) ? "on" : ""}
    >
      <span dangerouslySetInnerHTML={{ __html: I[n.key] }} />
      <span>{t(n.tk)}</span>
      {n.badge ? <span className="badge num">{n.badge}</span> : null}
    </Link>
  );

  return (
    <nav className="nav">
      <div className="sect">{t("MAIN")}</div>
      {main.map(Btn)}
      {(A || p.canBatches !== false || p.canViewPrices) && (
        <>
          <Link href="/batches" onClick={closeSb} className={path.startsWith("/batches") || path.startsWith("/services-prices") ? "on" : ""}>
            <span dangerouslySetInnerHTML={{ __html: I["batch"] }} />
            <span>{t("batches")}</span>
          </Link>
          {(path.startsWith("/batches") || path.startsWith("/services-prices")) && (
            <div className="sub">
              {(A || p.canBatches !== false) && <Link href="/batches" onClick={closeSb} className={path === "/batches" ? "on" : ""}><span>{t("batches")}</span></Link>}
              {(A || p.canViewPrices) && <Link href="/services-prices" onClick={closeSb} className={path.startsWith("/services-prices") ? "on" : ""}><span>{t("servicesPrices")}</span></Link>}
            </div>
          )}
        </>
      )}
      {(A || p.canUniversities) && (
        <>
          <Link href="/universities" onClick={closeSb} className={path.startsWith("/universities") ? "on" : ""}>
            <span dangerouslySetInnerHTML={{ __html: I["uni2"] }} />
            <span>{t("universities")}</span>
          </Link>
          {path.startsWith("/universities") && (
            <div className="sub">
              <Link href="/universities" onClick={closeSb} className={path === "/universities" ? "on" : ""}><span>{t("universities")}</span></Link>
              <Link href="/universities/protocols" onClick={closeSb} className={path.startsWith("/universities/protocols") ? "on" : ""}><span>{t("protocolsNav")}</span></Link>
            </div>
          )}
        </>
      )}
      <div className="sect">{t("TEAMS")}</div>
      {teams.map(Btn)}
      {(A || p.canEducation) && (
        <>
          <Link href="/education" onClick={closeSb} className={path.startsWith("/education") ? "on" : ""}>
            <span dangerouslySetInnerHTML={{ __html: I["edu"] }} />
            <span>{t("eduTeam")}</span>
          </Link>
          {path.startsWith("/education") && (
            <div className="sub">
              {eduItems.filter((n) => eduCanSee(n.href)).map((n) => (
                <Link key={n.href} href={n.href} onClick={closeSb} className={eduActive(n.href) ? "on" : ""}>
                  <span>{t(n.tk)}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      {admin.length > 0 && <div className="sect">{t("ADMIN")}</div>}
      {admin.map(Btn)}
    </nav>
  );
}
