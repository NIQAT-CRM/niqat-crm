"use client";
import { useT } from "@/lib/i18n/client";

// يصدّر بيانات لملف CSV (يفتح في Excel). UTF-8 BOM عشان العربي يظهر صح.
export default function ExportButton({ filename, headers, rows }: {
  filename: string; headers: string[]; rows: (string | number)[][];
}) {
  const tr = useT();
  function download() {
    const esc = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button onClick={download} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}>
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      {tr("exportCsv")}
    </button>
  );
}
