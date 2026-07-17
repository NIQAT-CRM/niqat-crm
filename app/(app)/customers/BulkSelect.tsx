"use client";
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import {
  selectAllFilteredIds, bulkSetOwner, bulkSetStage, bulkSignTerms, bulkArchive, bulkExportRows,
} from "./bulkActions";
import type { CustFilterSP } from "@/lib/customerFilter";

type Ctx = {
  sel: Set<string>;
  toggle: (id: string) => void;
  isSel: (id: string) => boolean;
  clear: () => void;
  togglePage: (pageIds: string[], on: boolean) => void;
  pageAllSelected: (pageIds: string[]) => boolean;
  selectAllFiltered: () => Promise<void>;
  loadingAll: boolean;
  count: number;
};

const SelCtx = createContext<Ctx | null>(null);

export function BulkSelectProvider({ filter, children }: { filter: CustFilterSP; children: ReactNode }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loadingAll, setLoadingAll] = useState(false);
  const tr = useT();

  const toggle = useCallback((id: string) => {
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const isSel = useCallback((id: string) => sel.has(id), [sel]);
  const clear = useCallback(() => setSel(new Set()), []);
  const togglePage = useCallback((pageIds: string[], on: boolean) => {
    setSel((prev) => { const n = new Set(prev); pageIds.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  }, []);
  const pageAllSelected = useCallback((pageIds: string[]) => pageIds.length > 0 && pageIds.every((id) => sel.has(id)), [sel]);

  const selectAllFiltered = useCallback(async () => {
    setLoadingAll(true);
    try {
      const ids = await selectAllFilteredIds(filter);
      setSel(new Set(ids));
      toast(tr("bulkSelectedAll").replace("{n}", String(ids.length)));
    } catch { toast(tr("bulkGenericError")); }
    setLoadingAll(false);
  }, [filter, tr]);

  const value = useMemo<Ctx>(() => ({
    sel, toggle, isSel, clear, togglePage, pageAllSelected, selectAllFiltered, loadingAll, count: sel.size,
  }), [sel, toggle, isSel, clear, togglePage, pageAllSelected, selectAllFiltered, loadingAll]);

  return <SelCtx.Provider value={value}>{children}</SelCtx.Provider>;
}

function useSel() {
  const c = useContext(SelCtx);
  if (!c) throw new Error("useSel outside provider");
  return c;
}

/* ===== checkbox لكل صف ===== */
export function RowCheck({ id }: { id: string }) {
  const { isSel, toggle } = useSel();
  return (
    <input type="checkbox" checked={isSel(id)} onChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
      style={{ width: 16, height: 16, accentColor: "var(--brand)", cursor: "pointer" }} />
  );
}

/* ===== checkbox رأس الجدول (تحديد/إلغاء الصفحة) ===== */
export function SelectAllHeader({ pageIds }: { pageIds: string[] }) {
  const { pageAllSelected, togglePage } = useSel();
  const on = pageAllSelected(pageIds);
  return (
    <input type="checkbox" checked={on} onChange={() => togglePage(pageIds, !on)}
      style={{ width: 16, height: 16, accentColor: "var(--brand)", cursor: "pointer" }} />
  );
}

/* ===== شريط الأكشنز الجماعية ===== */
export function BulkBar({ owners, stages, totalFiltered, canManageBatches, canExport, canMessage }: {
  owners: { id: string; name: string }[];
  stages: { key: string; label: string }[];
  totalFiltered: number;
  canManageBatches: boolean;
  canExport: boolean;
  canMessage: boolean;
}) {
  const { sel, count, clear, selectAllFiltered, loadingAll } = useSel();
  const tr = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<"" | "owner" | "stage">("");

  if (count === 0) return null;
  const ids = () => Array.from(sel);

  async function run(fn: () => Promise<{ ok: number; error: string | null }>, okMsg: string) {
    setBusy(true); setMenu("");
    try {
      const res = await fn();
      if (res.error) { toast(tr("bulkGenericError")); }
      else { toast(okMsg.replace("{n}", String(res.ok))); clear(); router.refresh(); }
    } catch { toast(tr("bulkGenericError")); }
    setBusy(false);
  }

  async function doArchive() {
    if (!confirm(tr("bulkArchiveConfirm").replace("{n}", String(count)))) return;
    run(() => bulkArchive(ids()), tr("bulkArchivedOk"));
  }
  async function doTerms() {
    if (!confirm(tr("bulkTermsConfirm").replace("{n}", String(count)))) return;
    run(() => bulkSignTerms(ids()), tr("bulkTermsOk"));
  }
  async function doOwner(ownerId: string | null) {
    run(() => bulkSetOwner(ids(), ownerId), tr("bulkOwnerOk"));
  }
  async function doStage(stage: string) {
    run(() => bulkSetStage(ids(), stage), tr("bulkStageOk"));
  }
  async function doExport() {
    setBusy(true);
    try {
      const rows = await bulkExportRows(ids());
      const head = ["name", "phone1", "phone2", "email", "company", "stage"];
      const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = "\uFEFF" + [head.join(","), ...rows.map((r: any) => head.map((h) => esc(r[h])).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast(tr("bulkExportOk").replace("{n}", String(rows.length)));
    } catch { toast(tr("bulkGenericError")); }
    setBusy(false);
  }

  const btn: React.CSSProperties = {
    height: 34, padding: "0 12px", borderRadius: 8, fontWeight: 700, fontSize: 12.5,
    border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", marginBottom: 12, borderRadius: 10, background: "var(--brand-soft)", border: "1px solid #f6d6b0" }}>
      <span style={{ fontWeight: 800, fontSize: 13, color: "var(--brand-d)" }}>
        {tr("bulkSelectedCount").replace("{n}", String(count))}
      </span>

      {count < totalFiltered && (
        <button style={{ ...btn, borderColor: "var(--brand)", color: "var(--brand)" }} onClick={selectAllFiltered} disabled={loadingAll}>
          {loadingAll ? "..." : tr("bulkSelectAllFiltered").replace("{n}", String(totalFiltered))}
        </button>
      )}
      <button style={btn} onClick={clear}>{tr("bulkClear")}</button>

      <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }} />

      {/* تعيين مسؤول */}
      <div style={{ position: "relative" }}>
        <button style={btn} disabled={busy} onClick={() => setMenu(menu === "owner" ? "" : "owner")}>👤 {tr("bulkAssignOwner")}</button>
        {menu === "owner" && (
          <div style={{ position: "absolute", top: 38, insetInlineStart: 0, zIndex: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", minWidth: 180, maxHeight: 260, overflow: "auto", padding: 4 }}>
            <button style={{ ...btn, width: "100%", border: "none", textAlign: "start", color: "var(--muted)" }} onClick={() => doOwner(null)}>{tr("unassigned")}</button>
            {owners.map((o) => (
              <button key={o.id} style={{ ...btn, width: "100%", border: "none", textAlign: "start" }} onClick={() => doOwner(o.id)}>{o.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* تغيير المرحلة */}
      <div style={{ position: "relative" }}>
        <button style={btn} disabled={busy} onClick={() => setMenu(menu === "stage" ? "" : "stage")}>🔄 {tr("bulkChangeStage")}</button>
        {menu === "stage" && (
          <div style={{ position: "absolute", top: 38, insetInlineStart: 0, zIndex: 20, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", minWidth: 160, padding: 4 }}>
            {stages.map((s) => (
              <button key={s.key} style={{ ...btn, width: "100%", border: "none", textAlign: "start" }} onClick={() => doStage(s.key)}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* إمضاء الشروط */}
      <button style={btn} disabled={busy} onClick={doTerms}>✍️ {tr("bulkSignTerms")}</button>

      {/* أرشفة */}
      {canManageBatches && <button style={{ ...btn, color: "var(--red)", borderColor: "#f3c9c4" }} disabled={busy} onClick={doArchive}>🗄️ {tr("bulkArchive")}</button>}

      {/* تصدير */}
      {canExport && <button style={btn} disabled={busy} onClick={doExport}>📥 {tr("bulkExport")}</button>}
    </div>
  );
}
