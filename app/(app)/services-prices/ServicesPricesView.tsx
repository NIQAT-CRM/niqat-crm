"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Group = { id: string; name: string; sort: number | null };
type Service = {
  id: string; group_id: string; name: string; code: string | null; description: string | null;
  schedule: string | null; batch_code: string | null;
  base_old: number | null; base_recent: number | null; base_intl: number | null; base_single: number | null;
  tiers: string[] | null; normal_pct: number | null; affiliate_pct: number | null; notes: string | null; sort: number | null;
};

const TIER_KEYS = ["old", "recent", "intl"] as const;

export default function ServicesPricesView({ groups, services, isAdmin }: { groups: Group[]; services: Service[]; isAdmin: boolean }) {
  const t = useT();
  const router = useRouter();
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [editSvc, setEditSvc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (id: string) => setCollapsed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [filter, setFilter] = useState<"all" | "priced" | "empty">("all");
  const [compact, setCompact] = useState(false);
  const isPriced = (s: Service) => [s.base_old, s.base_recent, s.base_intl, s.base_single].some((v) => v != null && Number(v) > 0);
  // نافذة النظام (بدل prompt/confirm بتوع المتصفح)
  const [modal, setModal] = useState<null | { title: string; input?: boolean; value?: string; ph?: string; warn?: string; okLabel?: string; danger?: boolean; run: (v: string) => Promise<void> }>(null);
  const [mval, setMval] = useState("");
  function openModal(m: NonNullable<typeof modal>) { setMval(m.value || ""); setModal(m); }
  async function runModal() {
    if (!modal) return;
    if (modal.input && !mval.trim()) return;
    setBusy(true); await modal.run(mval.trim()); setBusy(false); setModal(null); router.refresh();
  }

  const nf = useMemo(() => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }), []);
  const fmt = (n: number | null | undefined, dollar = false) =>
    (n == null || isNaN(Number(n))) ? null : (dollar ? "$" : "") + nf.format(Math.round(Number(n)));
  const disc = (base: number | null, pct: number | null) =>
    base == null ? null : Number(base) * (1 - (Number(pct) || 0) / 100);

  const tierLabel = (k: string) => k === "old" ? t("tierOld") : k === "recent" ? t("tierRecent") : k === "intl" ? t("tierIntl") : k;
  const baseOf = (s: Service, k: string) => k === "old" ? s.base_old : k === "recent" ? s.base_recent : s.base_intl;

  const ql = q.trim().toLowerCase();
  const matches = (s: Service) => {
    if (filter === "priced" && !isPriced(s)) return false;
    if (filter === "empty" && isPriced(s)) return false;
    return !ql || (s.name || "").toLowerCase().includes(ql) || (s.code || "").toLowerCase().includes(ql);
  };

  const byGroup = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services) { if (!matches(s)) continue; const a = m.get(s.group_id) || []; a.push(s); m.set(s.group_id, a); }
    return m;
  }, [services, ql, filter]);

  // ===== إجراءات الأدمن (نافذة النظام) =====
  function addGroup() {
    openModal({ title: t("addGroup"), input: true, ph: t("groupNamePrompt"), okLabel: t("addGroup"), run: async (v) => { await supabase.from("service_groups").insert({ name: v, sort: groups.length }); } });
  }
  function renameGroup(g: Group) {
    openModal({ title: t("editGroup"), input: true, value: g.name, ph: t("groupNamePrompt"), okLabel: t("save"), run: async (v) => { await supabase.from("service_groups").update({ name: v }).eq("id", g.id); } });
  }
  function delGroup(g: Group) {
    const n = (byGroup.get(g.id) || []).length;
    openModal({ title: t("deleteGroup"), warn: n > 0 ? t("groupDeleteWarn").replace("{n}", String(n)) : t("groupDeleteConfirm"), okLabel: t("deleteWord"), danger: true, run: async () => { await supabase.from("service_groups").delete().eq("id", g.id); } });
  }
  function addService(groupId: string) {
    openModal({ title: t("serviceNamePrompt"), input: true, ph: t("serviceNamePrompt"), okLabel: t("addGroup"), run: async (v) => { await supabase.from("services").insert({ group_id: groupId, name: v, tiers: ["recent", "intl"], normal_pct: 10, affiliate_pct: 25, sort: (byGroup.get(groupId) || []).length }); } });
  }
  function delService(s: Service) {
    openModal({ title: t("deleteWord"), warn: t("serviceDeleteConfirm"), okLabel: t("deleteWord"), danger: true, run: async () => { await supabase.from("services").delete().eq("id", s.id); setEditSvc(null); } });
  }
  async function dupService(s: Service) {
    setBusy(true);
    const { id, created_at, updated_at, ...rest } = s as any;
    await supabase.from("services").insert({ ...rest, name: (s.name || "") + " " + t("copySuffix"), code: s.code ? s.code + "-COPY" : null, sort: (byGroup.get(s.group_id) || []).length });
    setBusy(false); router.refresh();
  }
  function selectGroup(gid: string) {
    const ids = (byGroup.get(gid) || []).map((s) => s.id);
    setSelected((p) => { const n = new Set(p); const allSel = ids.every((i) => n.has(i)); ids.forEach((i) => allSel ? n.delete(i) : n.add(i)); return n; });
  }

  return (
    <div style={{ maxWidth: "100%", margin: "0 auto" }}>
      <style>{spCss}</style>
      <div className="sp-note"><b>{t("spNoteB")}</b> {t("spNote")}</div>
      <div className="sp-crumb">{t("batches")} › <b>{t("servicesPrices")}</b></div>
      <div className="sp-top">
        <h1>{t("servicesPricesTitle")}</h1>
        <div className="sp-actions">
          {isAdmin && (
            <button className="sp-addgroup" onClick={addGroup} disabled={busy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>{t("addGroup")}
            </button>
          )}
          {isAdmin && <span className="sp-adminpill">{t("adminWord")}</span>}
        </div>
      </div>
      {isAdmin && selected.size > 0 && (
        <div className="sp-selbar">
          <span>✓ {t("selectedCount").replace("{n}", String(selected.size))}</span>
          <span className="sp-selhint">{t("bulkEditHint")}</span>
          <button onClick={clearSel} className="sp-btn ghost" style={{ height: 32, marginInlineStart: "auto" }}>{t("clearSelection")}</button>
        </div>
      )}
      <div className="sp-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchServicePh")} />
      </div>
      <div className="sp-toolbar">
        <div className="sp-segs">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>{t("filterAll")}</button>
          <button className={filter === "priced" ? "on" : ""} onClick={() => setFilter("priced")}>{t("filterPriced")}</button>
          <button className={filter === "empty" ? "on" : ""} onClick={() => setFilter("empty")}>{t("filterEmpty")}</button>
        </div>
        <button className={"sp-compact" + (compact ? " on" : "")} onClick={() => setCompact((v) => !v)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M3 12h18M3 18h18" /></svg>{t("compactView")}
        </button>
      </div>

      {groups.map((g) => {
        const list = byGroup.get(g.id) || [];
        if (ql && list.length === 0) return null;
        const pricedN = list.filter(isPriced).length;
        const emptyN = list.length - pricedN;
        const isCol = collapsed.has(g.id);
        const groupIds = list.map((s) => s.id);
        const allSel = groupIds.length > 0 && groupIds.every((i) => selected.has(i));
        return (
          <div key={g.id}>
            <div className="sp-grp">
              <button className="sp-coltoggle" onClick={() => toggleCollapse(g.id)} title={isCol ? t("expand") : t("collapse")}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={{ transform: isCol ? "rotate(-90deg)" : "none", transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
              </button>
              <h2>{g.name}</h2>
              <span className="sp-cnt">{list.length}</span>
              {emptyN > 0 && <span className="sp-cnt empty" title={t("filterEmpty")}>{emptyN} {t("emptyWord")}</span>}
              {isAdmin && (
                <div className="sp-gtools">
                  {list.length > 0 && <button title={t("selectGroup")} onClick={() => selectGroup(g.id)} className={allSel ? "act" : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></button>}
                  <button title={t("editGroup")} onClick={() => renameGroup(g)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg></button>
                  <button title={t("deleteGroup")} onClick={() => delGroup(g)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg></button>
                </div>
              )}
            </div>

            {!isCol && (<>
            <div className={"sp-cards" + (compact ? " compact" : "")}>
            {list.map((s) => {
              const isSingle = (s.tiers || []).includes("single") || (!s.tiers?.some((x) => TIER_KEYS.includes(x as any)));
              const activeTiers = (s.tiers || []).filter((x) => TIER_KEYS.includes(x as any));
              return (
                <div key={s.id} className="sp-card">
                  <div className="sp-chead">
                    {isAdmin && <input type="checkbox" className="sp-chk" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} title={t("selectService")} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sp-nm">{s.name}{!isPriced(s) && <span className="sp-emptybadge">{t("notPricedYet")}</span>}</div>
                      {s.description && <div className="sp-desc">{s.description}</div>}
                      <div className="sp-meta">
                        {s.code && <span className="sp-mchip code">{s.code}</span>}
                        {(s.schedule || s.batch_code) && (
                          <span className="sp-mchip date">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                            {[s.schedule, s.batch_code].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="sp-cardtools">
                        <button className="sp-edit" onClick={() => setEditSvc(editSvc === s.id ? null : s.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>{t("edit")}
                        </button>
                        <button className="sp-iconbtn" title={t("duplicateService")} onClick={() => dupService(s)} disabled={busy}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {isSingle ? (
                    <div className="sp-single">
                      <span className="sp-lbl">{t("singlePrice")}:</span>
                      <Pill v={fmt(s.base_single)} suffix={t("egpShort")} />
                      <span className="sp-lbl">{t("normalWord")}:</span>
                      <Pill v={fmt(disc(s.base_single, s.normal_pct))} suffix={t("egpShort")} />
                      <span className="sp-lbl">{t("affiliateWord")}:</span>
                      <Pill v={fmt(disc(s.base_single, s.affiliate_pct))} suffix={t("egpShort")} />
                    </div>
                  ) : (
                    <div className="sp-ptbl">
                      <div className="sp-prow sp-phead">
                        <span>{t("tierWord")}</span>
                        <span className="c">{t("baseWord")}</span>
                        <span className="c">{t("normalWord")}<i className="sp-disc">-{s.normal_pct ?? 0}%</i></span>
                        <span className="c">{t("affiliateWord")}<i className="sp-disc">-{s.affiliate_pct ?? 0}%</i></span>
                      </div>
                      {activeTiers.map((k) => {
                        const b = baseOf(s, k); const dollar = k === "intl";
                        const nb = fmt(b, dollar), nn = fmt(disc(b, s.normal_pct), dollar), na = fmt(disc(b, s.affiliate_pct), dollar);
                        return (
                          <div className={"sp-prow" + (k === "intl" ? " intl" : "")} key={k}>
                            <span className="tier">{tierLabel(k)}</span>
                            <span className={"c base n" + (nb ? "" : " empty")}>{nb ?? "—"}</span>
                            <span className={"c norm n" + (nn ? "" : " empty")}>{nn ?? "—"}</span>
                            <span className={"c aff n" + (na ? "" : " empty")}>{na ?? "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            {isAdmin && (
              <button className="sp-addservice" onClick={() => addService(g.id)} disabled={busy}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
                {t("addServiceIn").replace("{g}", g.name)}
              </button>
            )}
            </>)}
          </div>
        );
      })}
      <div className="sp-footnote">{t("spFootnote")}</div>

      {isAdmin && editSvc && (() => {
        const svc = services.find((x) => x.id === editSvc);
        if (!svc) return null;
        return (
          <div className="sp-ov" onClick={() => setEditSvc(null)}>
            <div className="sp-modal sp-editmodal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <h3>{svc.name}</h3>
                <button className="sp-x" onClick={() => setEditSvc(null)}>✕</button>
              </div>
              <ServiceEditor s={svc} selectedIds={Array.from(selected)} onClose={() => setEditSvc(null)} onDelete={() => delService(svc)} onBulkDone={clearSel} />
            </div>
          </div>
        );
      })()}

      {modal && (
        <div className="sp-ov" onClick={() => !busy && setModal(null)}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.title}</h3>
            {modal.warn && <p className="warn">{modal.warn}</p>}
            {modal.input && (
              <input autoFocus value={mval} placeholder={modal.ph} onChange={(e) => setMval(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runModal(); if (e.key === "Escape") setModal(null); }} />
            )}
            <div className="row">
              <button className="sp-btn ghost" onClick={() => setModal(null)} disabled={busy}>{t("cancel")}</button>
              <button className="sp-btn save" onClick={runModal} disabled={busy || (modal.input && !mval.trim())}
                style={modal.danger ? { background: "var(--red)" } : undefined}>
                {busy ? "..." : (modal.okLabel || t("save"))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ v, suffix }: { v: string | null; suffix?: string }) {
  return <span className={"sp-pill n" + (v ? "" : " empty")}>{v ? `${v}${suffix ? " " + suffix : ""}` : "—"}</span>;
}

// ===== محرّر الخدمة (أدمن) — حساب حي =====
function ServiceEditor({ s, selectedIds = [], onClose, onDelete, onBulkDone }: { s: Service; selectedIds?: string[]; onClose: () => void; onDelete: () => void; onBulkDone?: () => void }) {
  const t = useT();
  const router = useRouter();
  const supabase = createClient();
  const bulkOthers = selectedIds.filter((id) => id !== s.id);
  const [f, setF] = useState({
    name: s.name || "", code: s.code || "", description: s.description || "", schedule: s.schedule || "", batch_code: s.batch_code || "",
    old: (s.tiers || []).includes("old"), recent: (s.tiers || []).includes("recent"), intl: (s.tiers || []).includes("intl"),
    single: (s.tiers || []).includes("single"),
    base_old: s.base_old ?? "", base_recent: s.base_recent ?? "", base_intl: s.base_intl ?? "", base_single: s.base_single ?? "",
    normal_pct: s.normal_pct ?? 10, affiliate_pct: s.affiliate_pct ?? 25,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: any) => v === "" || v == null ? null : Number(v);

  async function save() {
    setSaving(true);
    const tiers: string[] = [];
    if (f.single) tiers.push("single");
    else { if (f.old) tiers.push("old"); if (f.recent) tiers.push("recent"); if (f.intl) tiers.push("intl"); }
    // حقول الأسعار (تتطبّق على المحدّدين كمان)
    const priceFields = {
      tiers, base_old: num(f.base_old), base_recent: num(f.base_recent), base_intl: num(f.base_intl), base_single: num(f.base_single),
      normal_pct: num(f.normal_pct), affiliate_pct: num(f.affiliate_pct),
    };
    // الخدمة الحالية: كل الحقول (بما فيها الاسم/الكود)
    await supabase.from("services").update({
      name: f.name.trim(), code: f.code.trim() || null, description: f.description.trim() || null,
      schedule: f.schedule.trim() || null, batch_code: f.batch_code.trim() || null, ...priceFields,
    }).eq("id", s.id);
    // المحدّدين الآخرين: الأسعار/النسب/الشرائح فقط (مش الاسم/الكود)
    if (bulkOthers.length) { await supabase.from("services").update(priceFields).in("id", bulkOthers); onBulkDone?.(); }
    setSaving(false); onClose(); router.refresh();
  }

  return (
    <div className="sp-editbox">
      <div className="sp-eb-lab">✏️ {t("editServiceHint")}</div>
      {bulkOthers.length > 0 && (
        <div className="sp-bulkbanner">⚡ {t("bulkApplyNote").replace("{n}", String(bulkOthers.length))}</div>
      )}
      <div className="sp-eb-grid">
        <Fld label={t("serviceNameLabel")}><input className="sp-inp" style={{ fontFamily: "var(--fa)" }} value={f.name} onChange={(e) => set("name", e.target.value)} /></Fld>
        <Fld label={t("codeLabel")}><input className="sp-inp" value={f.code} onChange={(e) => set("code", e.target.value)} /></Fld>
        <Fld label={t("scheduleLabel")}><input className="sp-inp" style={{ fontFamily: "var(--fa)" }} value={f.schedule} onChange={(e) => set("schedule", e.target.value)} /></Fld>
        <Fld label={t("batchCodeLabel")}><input className="sp-inp" value={f.batch_code} onChange={(e) => set("batch_code", e.target.value)} /></Fld>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, marginBottom: 7 }}>{t("activeTiers")}:</div>
      <div className="sp-tiersel">
        <label><input type="checkbox" checked={f.single} onChange={(e) => set("single", e.target.checked)} />{t("tierSingle")}</label>
        {!f.single && <>
          <label><input type="checkbox" checked={f.old} onChange={(e) => set("old", e.target.checked)} />{t("tierOldShort")}</label>
          <label><input type="checkbox" checked={f.recent} onChange={(e) => set("recent", e.target.checked)} />{t("tierRecentShort")}</label>
          <label><input type="checkbox" checked={f.intl} onChange={(e) => set("intl", e.target.checked)} />{t("tierIntl")}</label>
        </>}
      </div>
      <div className="sp-eb-grid">
        {f.single ? (
          <Fld label={t("singlePrice")}><input className="sp-inp" value={f.base_single as any} onChange={(e) => set("base_single", e.target.value)} placeholder="—" /></Fld>
        ) : (<>
          {f.old && <Fld label={`${t("baseWord")} — ${t("tierOldShort")}`}><input className="sp-inp" value={f.base_old as any} onChange={(e) => set("base_old", e.target.value)} placeholder="—" /></Fld>}
          {f.recent && <Fld label={`${t("baseWord")} — ${t("tierRecentShort")}`}><input className="sp-inp" value={f.base_recent as any} onChange={(e) => set("base_recent", e.target.value)} placeholder="—" /></Fld>}
          {f.intl && <Fld label={`${t("baseWord")} — ${t("tierIntl")}`}><input className="sp-inp" value={f.base_intl as any} onChange={(e) => set("base_intl", e.target.value)} placeholder="—" /></Fld>}
        </>)}
        <Fld label={t("normalDiscPct")}><input className="sp-inp" value={f.normal_pct as any} onChange={(e) => set("normal_pct", e.target.value)} /></Fld>
        <Fld label={t("affiliateDiscPct")}><input className="sp-inp" value={f.affiliate_pct as any} onChange={(e) => set("affiliate_pct", e.target.value)} /></Fld>
      </div>
      <div className="sp-btnrow">
        <button className="sp-btn save" onClick={save} disabled={saving}>{saving ? "..." : t("save")}</button>
        <button className="sp-btn ghost" onClick={onClose}>{t("cancel")}</button>
        <button className="sp-btn ghost" onClick={onDelete} style={{ marginInlineStart: "auto", color: "var(--red)", borderColor: "rgba(219,91,78,.35)" }}>{t("deleteWord")}</button>
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="sp-fld"><label>{label}</label>{children}</div>;
}

const spCss = `
.sp-note{background:var(--brand-soft);border:1px solid var(--brand-soft);border-radius:12px;padding:11px 14px;font-size:12.5px;color:var(--brand-d);margin-bottom:16px;line-height:1.65}
.sp-note b{font-weight:800}
.sp-crumb{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:4px}
.sp-crumb b{color:var(--brand-d)}
.sp-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap}
.sp-top h1{font-size:23px;font-weight:800;color:var(--ink)}
.sp-actions{display:flex;gap:8px;align-items:center}
.sp-addgroup{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:var(--surface);background:var(--ink);border:none;border-radius:10px;padding:9px 14px;cursor:pointer}
.sp-addgroup svg{width:14px;height:14px}
.sp-adminpill{font-size:11px;font-weight:800;color:var(--blue);background:var(--blue-soft);border-radius:7px;padding:5px 10px}
.sp-search{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:0 14px;height:44px;box-shadow:var(--sh);margin-bottom:12px}
.sp-search input{flex:1;border:none;background:none;font-family:inherit;font-size:14px;outline:none;color:var(--text)}
.sp-search svg{width:17px;height:17px;color:var(--muted)}
.sp-grp{display:flex;align-items:center;gap:11px;margin:26px 0 14px;background:linear-gradient(90deg,var(--brand-soft),transparent);border-inline-start:4px solid var(--brand);border-radius:10px;padding:11px 15px}
.sp-tick{display:none}
.sp-grp h2{font-size:16.5px;font-weight:800;color:var(--brand-d);letter-spacing:.01em}
.sp-cnt{font-size:11.5px;font-weight:700;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:2px 10px;font-family:var(--fd)}
.sp-gtools{margin-inline-start:auto;display:flex;gap:6px}
.sp-gtools button{border:none;background:none;color:var(--muted);cursor:pointer;width:28px;height:28px;border-radius:7px;display:grid;place-items:center}
.sp-gtools button:hover{background:var(--surface);color:var(--brand)}
.sp-gtools svg{width:14px;height:14px}
.sp-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r,16px);box-shadow:var(--sh);padding:14px 16px;margin-bottom:0;min-width:0}
.sp-chead{display:flex;align-items:flex-start;gap:12px}
.sp-nm{font-weight:800;color:var(--ink);font-size:14.5px}
.sp-desc{font-size:12px;color:var(--muted);margin-top:3px}
.sp-meta{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap;align-items:center}
.sp-mchip{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;background:var(--bg);color:var(--muted);display:inline-flex;align-items:center;gap:5px}
.sp-mchip.code{background:var(--blue-soft);color:var(--blue);font-family:var(--fd);letter-spacing:.02em}
.sp-mchip.date{background:var(--brand-soft);color:var(--brand-d)}
.sp-mchip svg{width:11px;height:11px}
.sp-edit{margin-inline-start:auto;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--muted);background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:6px 11px;cursor:pointer;height:32px}
.sp-edit svg{width:13px;height:13px}
.sp-edit:hover{border-color:var(--brand);color:var(--brand)}
.sp-ptbl{margin-top:10px;font-size:12px;display:block}
.sp-prow{display:grid;grid-template-columns:1.7fr 1fr 1fr 1fr;gap:6px;align-items:center;height:34px;border-bottom:1px solid var(--line);min-width:0}
.sp-prow:last-child{border-bottom:none}
.sp-phead{height:24px}
.sp-phead span{font-size:9.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.sp-prow .c{text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-prow>span:first-child{text-align:start}
.sp-prow .tier{font-weight:700;color:var(--ink);font-size:11.5px;line-height:1.2}
.sp-prow .base{font-weight:800;color:var(--ink);font-size:13px}
.sp-prow .norm{color:var(--green);font-weight:600;font-size:11.5px}
.sp-prow .aff{color:var(--blue);font-weight:600;font-size:11.5px}
.sp-prow .n{font-family:var(--fd)}
.sp-prow .empty{color:var(--muted);opacity:.45;font-weight:500}
.sp-disc{font-size:8.5px;color:var(--muted);display:block;font-weight:600;font-style:normal}
/* شريط الفلتر والعرض المضغوط */
.sp-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.sp-segs{display:flex;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:3px;box-shadow:var(--sh)}
.sp-segs button{border:none;background:none;font-family:inherit;font-size:12px;font-weight:700;color:var(--muted);padding:6px 14px;border-radius:8px;cursor:pointer}
.sp-segs button.on{background:var(--ink);color:var(--surface)}
.sp-compact{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 13px;font-family:inherit;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer}
.sp-compact svg{width:14px;height:14px}
.sp-compact.on{border-color:var(--brand);color:var(--brand-d);background:var(--brand-soft)}
/* طي الجروب */
.sp-coltoggle{border:none;background:none;color:var(--brand-d);cursor:pointer;width:26px;height:26px;display:grid;place-items:center;border-radius:7px}
.sp-coltoggle svg{width:16px;height:16px}
.sp-tick{display:none}
.sp-cnt.empty{background:var(--amber-soft,#FBF1DC);color:var(--amber);border-color:transparent;font-family:var(--fa)}
.sp-gtools button.act{color:var(--green);background:var(--green-soft)}
/* شارة الخدمة الفاضية */
.sp-emptybadge{display:inline-block;margin-inline-start:8px;font-size:9.5px;font-weight:800;color:var(--amber);background:var(--amber-soft,#FBF1DC);border-radius:20px;padding:2px 8px;vertical-align:middle}
/* أدوات الكارت (تعديل + نسخ) */
.sp-cardtools{display:flex;gap:6px;align-items:flex-start;flex-shrink:0}
.sp-iconbtn{border:1px solid var(--line);background:var(--bg);border-radius:9px;width:32px;height:32px;display:grid;place-items:center;color:var(--muted);cursor:pointer}
.sp-iconbtn svg{width:14px;height:14px}
.sp-iconbtn:hover{border-color:var(--brand);color:var(--brand)}
/* تمييز صف خارج مصر + تدرّج الأرقام */
.sp-prow.intl{background:var(--blue-soft);border-radius:6px;height:36px;padding-inline:9px;margin-inline:-6px}
/* نافذة تعديل الخدمة */
.sp-editmodal{max-width:560px;max-height:88vh;overflow-y:auto;padding:0}
.sp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface);z-index:2;border-radius:16px 16px 0 0}
.sp-modal-head h3{font-size:16px;font-weight:800;color:var(--ink);margin:0}
.sp-x{border:none;background:var(--bg);width:30px;height:30px;border-radius:8px;cursor:pointer;color:var(--muted);font-size:14px}
.sp-x:hover{background:var(--red);color:#fff}
.sp-editmodal .sp-editbox{margin-top:0;border-top:none;padding:18px 20px}
.sp-editmodal .sp-btnrow{position:sticky;bottom:0;background:var(--surface);padding-top:12px;margin-top:6px;border-top:1px solid var(--line)}
.sp-prow .base{font-size:14px}
.sp-prow.sp-phead .base,.sp-prow.sp-phead .norm,.sp-prow.sp-phead .aff{font-size:10.5px}
.sp-prow .norm,.sp-prow .aff{font-size:12px}
/* العرض المضغوط */
.sp-cards.compact .sp-ptbl,.sp-cards.compact .sp-single{margin-top:9px}
.sp-cards.compact .sp-card{padding:11px 13px}
.sp-cards.compact .sp-prow{padding:5px 4px}
.sp-cards.compact .sp-desc,.sp-cards.compact .sp-phead{display:none}
.sp-single{margin-top:13px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px}
.sp-pill{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:6px 12px;font-weight:700;color:var(--ink)}
.sp-pill.n{font-family:var(--fd)}
.sp-pill.empty{color:var(--muted);opacity:.6}
.sp-lbl{color:var(--muted);font-size:11.5px}
.sp-chk{width:18px;height:18px;accent-color:var(--brand);cursor:pointer;flex-shrink:0;margin-top:2px}
.sp-selbar{display:flex;align-items:center;gap:12px;background:var(--brand-soft);border:1px solid var(--brand);border-radius:12px;padding:10px 14px;margin-bottom:14px;flex-wrap:wrap}
.sp-selbar>span:first-child{font-weight:800;color:var(--brand-d);font-size:13px}
.sp-selhint{font-size:11.5px;color:var(--brand-d);opacity:.85}
.sp-bulkbanner{background:var(--blue-soft);color:var(--blue);border-radius:9px;padding:8px 12px;font-size:11.5px;font-weight:700;margin-bottom:11px}
.sp-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start;margin-bottom:14px}
@media(max-width:720px){.sp-cards{grid-template-columns:1fr}}
.sp-ov{position:fixed;inset:0;background:rgba(21,34,59,.45);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
.sp-modal{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);width:100%;max-width:420px;padding:20px}
.sp-modal h3{font-size:16px;font-weight:800;color:var(--ink);margin-bottom:6px}
.sp-modal p{font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:14px}
.sp-modal .warn{background:var(--brand-soft);color:var(--brand-d);border-radius:9px;padding:9px 12px;font-weight:700}
.sp-modal input{width:100%;height:42px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font-family:var(--fa);font-size:14px;background:var(--surface);color:var(--text);margin-bottom:14px}
.sp-modal input:focus{outline:none;border-color:var(--brand)}
.sp-modal .row{display:flex;gap:8px;justify-content:flex-end}
.sp-addservice{width:100%;border:1px dashed var(--line);background:var(--surface);border-radius:12px;padding:12px;color:var(--muted);font-family:inherit;font-weight:700;font-size:12.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:4px}
.sp-addservice:hover{border-color:var(--brand);color:var(--brand-d);background:var(--brand-soft)}
.sp-addservice svg{width:14px;height:14px}
.sp-editbox{margin-top:13px;border-top:1px dashed var(--line);padding-top:13px}
.sp-eb-lab{font-size:11px;font-weight:800;color:var(--brand-d);margin-bottom:10px}
.sp-eb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.sp-fld label{display:block;font-size:10.5px;color:var(--muted);font-weight:700;margin-bottom:5px}
.sp-inp{width:100%;height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;font-family:var(--fd);font-size:13px;background:var(--surface);color:var(--text)}
.sp-inp:focus{outline:none;border-color:var(--brand)}
.sp-tiersel{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.sp-tiersel label{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 11px;cursor:pointer;line-height:1}
.sp-tiersel input{width:15px;height:15px;flex-shrink:0;accent-color:var(--brand);margin:0}
.sp-btnrow{display:flex;gap:8px;margin-top:4px;align-items:center}
.sp-btn{height:36px;padding:0 15px;border-radius:9px;border:none;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.sp-btn.save{background:var(--brand);color:var(--surface)}
.sp-btn.ghost{background:var(--surface);border:1px solid var(--line);color:var(--text)}
.sp-footnote{text-align:center;font-size:11px;color:var(--muted);margin-top:20px}
`;
