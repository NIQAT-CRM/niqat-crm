"use client";
import { useRealtimeRefresh, type RTTable } from "@/lib/useRealtimeRefresh";

/** مكوّن خفيف (بلا واجهة) يتحط في أي صفحة سيرفر لتفعيل التحديث الفوري. */
export default function RealtimeRefresh({ tables, debounceMs }: { tables: RTTable | RTTable[]; debounceMs?: number }) {
  useRealtimeRefresh(tables, { debounceMs });
  return null;
}
