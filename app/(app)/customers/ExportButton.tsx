"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";
import { postExport } from "@/lib/export/download";
import type { CustFilterSP } from "@/lib/customerFilter";

// يصدّر كل العملاء المطابقين للفلتر (مش الصفحة المعروضة بس) — XLSX مبراندَد كامل
export default function ExportButton({ filter }: { filter: CustFilterSP }) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    const r = await postExport({ type: "customers", filter }, "niqat-customers");
    setBusy(false);
    if (!r.ok) toast(tr("exportFailed") + (r.error ? ` (${r.error})` : ""));
  }
  return (
    <button onClick={download} disabled={busy} className="btn ghost" title={tr("exportCustomersXlsx")}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      {busy ? "..." : tr("export")}
    </button>
  );
}
