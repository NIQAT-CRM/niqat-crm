"use client";
import { toast } from "@/lib/toast";

export default function CopyNumbers({ phones }: { phones: string[] }) {
  const list = phones.filter(Boolean);
  if (!list.length) return null;
  function copy() {
    const txt = list.join("\n");
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    toast("اتنسخت الأرقام");
  }
  return (
    <button onClick={copy} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }} title="نسخ الأرقام">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}>
        <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
      نسخ الأرقام
    </button>
  );
}
