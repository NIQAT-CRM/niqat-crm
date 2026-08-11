"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";

const OPTS: [string, string][] = [
  ["today", "periodToday"], ["7", "period7"], ["30", "period30"], ["month", "periodMonth"], ["all", "periodAll"],
];

export default function PeriodFilter() {
  const tr = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const cur = sp.get("period") || "all";
  const [isPending, startTransition] = useTransition();

  function pick(v: string) {
    if (v === cur) return;
    const p = new URLSearchParams(Array.from(sp.entries()));
    if (v === "all") p.delete("period"); else p.set("period", v);
    const qs = p.toString();
    // startTransition: التنقّل يفضل متجاوب + مؤشّر تحميل بدل الإحساس بالتجميد
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 18, paddingBottom: 2, alignItems: "center", opacity: isPending ? 0.65 : 1, transition: "opacity .15s" }}>
      {OPTS.map(([v, k]) => {
        const on = cur === v;
        return (
          <button key={v} onClick={() => pick(v)} disabled={isPending}
            style={{
              height: 34, padding: "0 15px", borderRadius: 10, whiteSpace: "nowrap", cursor: isPending ? "wait" : "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 12.5,
              border: "1px solid " + (on ? "var(--brand)" : "var(--line)"),
              background: on ? "var(--brand)" : "var(--surface)",
              color: on ? "#fff" : "var(--muted-d)",
            }}>
            {tr(k)}
          </button>
        );
      })}
      {isPending && (
        <span aria-hidden style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--brand)", display: "inline-block", animation: "spin .6s linear infinite", marginInlineStart: 4 }} />
      )}
    </div>
  );
}
