"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";
import { postExport } from "@/lib/export/download";

// يصدّر جدولاً إلى XLSX مبراندَد (لوجو + اسم الشركة) من السيرفر
export default function ExportButton({ filename, title, headers, rows }: {
  filename: string; title?: string; headers: string[]; rows: (string | number)[][];
}) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    const r = await postExport({ type: "generic", title: title || filename, filename, headers, rows }, filename);
    setBusy(false);
    if (!r.ok) toast(tr("exportFailed") + (r.error ? ` (${r.error})` : ""));
  }
  return (
    <button onClick={download} disabled={busy} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 15, height: 15 }}>
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      {busy ? "..." : tr("exportXlsx")}
    </button>
  );
}
