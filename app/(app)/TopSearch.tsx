"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export default function TopSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useT();
  const [q, setQ] = useState(sp.get("q") || "");

  // لما أغيّر الصفحة، حدّث خانة البحث بقيمة الصفحة الجديدة
  useEffect(() => { setQ(sp.get("q") || ""); }, [pathname, sp]);

  // الصفحة اللي البحث هيفلترها (نفس الصفحة لو من صفحات البحث، غير كده العملاء)
  function targetBase() {
    if (pathname.startsWith("/pipeline")) return "/pipeline";
    if (pathname.startsWith("/support")) return "/support";
    return "/customers";
  }

  function go() {
    const v = q.trim();
    const base = targetBase();
    router.push(v ? `${base}?q=${encodeURIComponent(v)}` : base);
  }

  // placeholder حسب الصفحة
  const ph = pathname.startsWith("/support")
    ? (t("search") + " — " + (t("support") || ""))
    : pathname.startsWith("/pipeline")
    ? (t("search") + " — " + (t("pipeline") || ""))
    : t("search");

  return (
    <div className="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
      </svg>
      <input placeholder={ph} value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
    </div>
  );
}
