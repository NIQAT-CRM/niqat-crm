"use client";
import { useState, useRef, useEffect } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { postExport } from "@/lib/export/download";
import SmartActions from "../SmartActions";
import { useLogUsage } from "../AiFlags";

type Opt = { v: string; label: string; dip?: string; kind?: string };
type Tpl = { id: string; name: string; body: string };
type Filters = { q?: string; stage?: string; owner?: string; company?: string; dip?: string; spec?: string; batch?: string; svc?: string; svctype?: string; pay?: string };

// فلتر متعدد الاختيار (checkboxes) — يخزّن القيم كـ CSV في الـ URL
function MultiSel({ label, paramKey, opts, onApply }: { label: string; paramKey: string; opts: Opt[]; onApply?: (p: URLSearchParams) => void }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = (sp.get(paramKey) || "").split(",").map((x) => x.trim()).filter(Boolean);
  const [draft, setDraft] = useState<string[]>(selected);

  function commit(next: string[]) {
    const cur = (sp.get(paramKey) || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (JSON.stringify([...cur].sort()) === JSON.stringify([...next].sort())) { setOpen(false); return; }
    const p = new URLSearchParams(sp.toString());
    if (next.length) p.set(paramKey, next.join(",")); else p.delete(paramKey);
    p.delete("page");
    setOpen(false);
    onApply?.(p);
    router.push("/customers" + (p.toString() ? "?" + p.toString() : ""));
  }

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) commit(draft); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, draft]);

  const count = selected.length;
  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button type="button" className="inp"
        onClick={() => { if (open) commit(draft); else { setDraft(selected); setOpen(true); } }}
        style={{ width: "auto", minWidth: 150, height: 36, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", justifyContent: "space-between" }}>
        <span style={{ color: count ? "var(--ink)" : "var(--muted)", whiteSpace: "nowrap" }}>{label}{count ? " · " + count : ""}</span>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} style={{ opacity: .6 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", insetInlineStart: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", padding: 6, minWidth: 210, maxHeight: 300, overflow: "auto" }}>
          {opts.map((o) => {
            const on = draft.includes(o.v);
            return (
              <label key={o.v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}>
                <input type="checkbox" checked={on} onChange={() => setDraft((d) => on ? d.filter((x) => x !== o.v) : [...d, o.v])} />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CustomersTools({
  stages, owners, diplomas, specialties, batches, services = [], serviceTypes = [], companies, canFinance,
  filters, sortBy, sortDir, sortOpts,
}: {
  stages: Opt[]; owners: Opt[]; diplomas: Opt[]; specialties: Opt[]; batches: Opt[]; services?: Opt[]; serviceTypes?: { v: string; label: string }[]; companies: Opt[];
  canFinance: boolean; canMessage: boolean; filters: Filters; templates: Tpl[];
  sortBy?: string; sortDir?: boolean; sortOpts?: Opt[];
}) {
  const tr = useT();
  const router = useRouter();
  const sp = useSearchParams();
  const log = useLogUsage();

  // بارامترات الفلتر المعتبرة + خرائط القيمة→التسمية لتسمية مفاتيح الفلتر
  const FILTER_KEYS = ["stage", "dip", "spec", "batch", "svctype", "svc", "owner", "company", "pay"] as const;
  const payOpts: Opt[] = [{ v: "bal", label: tr("payBal") }, { v: "due", label: tr("payDue") }, { v: "overdue", label: tr("overdue") }, { v: "over", label: tr("overdue") }];
  const mapOf = (arr: Opt[]) => new Map(arr.map((o) => [o.v, o.label]));
  const paramMaps: Record<string, Map<string, string>> = {
    stage: mapOf(stages), dip: mapOf(diplomas), spec: mapOf(specialties), batch: mapOf(batches),
    svctype: mapOf((serviceTypes as any[]) || []), svc: mapOf(services), owner: mapOf(owners),
    company: mapOf(companies), pay: mapOf(payOpts),
  };

  // بناء مفتاح الفلتر من حالة الـ URL بعد التطبيق (للتسجيل)
  function buildFilterKey(p: URLSearchParams): string {
    const parts: string[] = [];
    for (const k of FILTER_KEYS) { const v = p.get(k); if (v) parts.push(k + "=" + v); }
    return parts.length ? "filter:" + parts.join(";") : "";
  }
  function logFilter(p: URLSearchParams) {
    const key = buildFilterKey(p);
    if (key) log("filter", key, "customers");
  }

  // تسمية مقروءة لمفتاح فلتر (للـ SmartActions)
  function filterLabel(key: string): string {
    const body = key.slice("filter:".length);
    const segs = body.split(";").filter(Boolean);
    const labels: string[] = [];
    for (const seg of segs) {
      const [k, raw = ""] = seg.split("=");
      const m = paramMaps[k];
      raw.split(",").filter(Boolean).forEach((v) => {
        if (k === "owner" && v === "none") { labels.push(tr("unassigned")); return; }
        labels.push(m?.get(v) || v);
      });
    }
    return labels.join(" + ") || tr("filterStage");
  }

  // تشغيل عنصر من SmartActions
  async function runSmart(item: { kind: "action" | "filter"; key: string }) {
    if (item.key.startsWith("filter:")) {
      const p = new URLSearchParams();
      item.key.slice("filter:".length).split(";").filter(Boolean).forEach((seg) => {
        const [k, raw = ""] = seg.split("="); if (k && raw) p.set(k, raw);
      });
      router.push("/customers" + (p.toString() ? "?" + p.toString() : ""));
      return;
    }
    const name = item.key.slice("action:".length);
    if (name === "new_customer") { log("action", "action:new_customer", "customers"); router.push("/customers/new"); }
    else if (name === "export") { log("action", "action:export", "customers"); const r = await postExport({ type: "customers", filter: filters as any }, "niqat-customers"); if (!r.ok) toast(tr("exportFailed")); }
  }
  const listActionLabels: Record<string, string> = { new_customer: tr("addCust"), export: tr("export") };

  function setSort(v: string) {
    const p = new URLSearchParams(sp.toString());
    const [col, dir] = v.split(":");
    if (col) p.set("sort", col); else p.delete("sort");
    if (dir) p.set("dir", dir); else p.delete("dir");
    p.delete("page");
    router.push("/customers" + (p.toString() ? "?" + p.toString() : ""));
  }
  const sortVal = (sortBy || "") + ":" + (sortDir ? "asc" : "desc");

  // فلترة الباتشات حسب الدبلومة/الدبلومات المختارة في الفلتر
  const selDips = (sp.get("dip") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const visibleBatches = selDips.length ? batches.filter((b) => b.dip && selDips.includes(b.dip)) : batches;
  const selSvcType = (sp.get("svctype") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const visibleServices = selSvcType.length ? services.filter((s) => s.kind && selSvcType.includes(s.kind)) : services;

  return (
    <>
      <SmartActions context="customers" title={tr("qaQuickAccess")} actionLabels={listActionLabels} filterLabel={filterLabel} onRun={runSmart} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <MultiSel label={tr("filterStage")} paramKey="stage" opts={stages} onApply={logFilter} />
        <MultiSel label={tr("filterDip")} paramKey="dip" opts={diplomas} onApply={logFilter} />
        {specialties.length > 0 && <MultiSel label={tr("filterSpec")} paramKey="spec" opts={specialties} onApply={logFilter} />}
        <MultiSel label={tr("filterBatch")} paramKey="batch" opts={visibleBatches} onApply={logFilter} />
        {serviceTypes.length > 0 && <MultiSel label={tr("filterServiceType")} paramKey="svctype" opts={serviceTypes} onApply={logFilter} />}
        {services.length > 0 && <MultiSel label={tr("filterService")} paramKey="svc" opts={visibleServices} onApply={logFilter} />}
        {owners.length > 0 && <MultiSel label={tr("filterOwner")} paramKey="owner" opts={owners} onApply={logFilter} />}
        {companies.length > 0 && <MultiSel label={tr("filterCompany")} paramKey="company" opts={companies} onApply={logFilter} />}
        {canFinance && <MultiSel label={tr("filterPay")} paramKey="pay" opts={[
          { v: "bal", label: tr("payBal") }, { v: "due", label: tr("payDue") }, { v: "overdue", label: tr("overdue") },
        ]} onApply={logFilter} />}
        {sortOpts && (
          <select className="inp" style={{ width: "auto", minWidth: 130, height: 36, flex: "0 0 auto" }} value={sortVal} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at:desc">{tr("sortLabel")}: {tr("sortNew")}</option>
            {sortOpts.map((o) => (
              <>
                <option key={o.v + ":asc"} value={o.v + ":asc"}>{tr("sortLabel")}: {o.label} ↑</option>
                <option key={o.v + ":desc"} value={o.v + ":desc"}>{tr("sortLabel")}: {o.label} ↓</option>
              </>
            ))}
          </select>
        )}
        {(sp.toString()) && (
          <button className="btn ghost" style={{ height: 36, padding: "0 12px", fontSize: 12.5 }} onClick={() => router.push("/customers")}>{tr("clearFilters")}</button>
        )}
      </div>
    </>
  );
}
