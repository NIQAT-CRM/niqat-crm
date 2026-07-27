"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type RTTable = string | { table: string; filter?: string };

/**
 * طبقة تحديث فوري موحّدة: بتشترك في تغييرات جدول/جداول الصفحة الحالية،
 * وعند أي INSERT/UPDATE/DELETE بتعمل router.refresh() (debounced) — فبيعيد
 * الجلب من السيرفر باحترام فلاتر الـURL الحالية بدون reload.
 *
 * - اشترك بس في جداول الصفحة الحالية (تُمرَّر في tables).
 * - Debounce يجمّع الأحداث المتتالية في تحديث واحد.
 * - تنظيف الاشتراك تلقائياً عند مغادرة الصفحة (unmount).
 */
export function useRealtimeRefresh(
  tables: RTTable | RTTable[],
  opts?: { debounceMs?: number; enabled?: boolean }
) {
  const router = useRouter();
  const debounceMs = opts?.debounceMs ?? 400;
  const enabled = opts?.enabled ?? true;

  // مفتاح ثابت للاعتمادية (يمنع إعادة الاشتراك بلا داعي)
  const list: RTTable[] = Array.isArray(tables) ? tables : [tables];
  const key = list.map((t) => (typeof t === "string" ? t : `${t.table}|${t.filter || ""}`)).join(",");

  useEffect(() => {
    if (!enabled || !list.length) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; router.refresh(); }, debounceMs);
    };

    const channel = supabase.channel(`rt:${key}:${Math.random().toString(36).slice(2)}`);
    for (const t of list) {
      const table = typeof t === "string" ? t : t.table;
      const filter = typeof t === "string" ? undefined : t.filter;
      const cfg: any = { event: "*", schema: "public", table };
      if (filter) cfg.filter = filter;
      channel.on("postgres_changes" as any, cfg, schedule);
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, debounceMs]);
}
