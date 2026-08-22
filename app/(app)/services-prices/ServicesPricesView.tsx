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
  const matches = (s: Service) => !ql || (s.name || "").toLowerCase().includes(ql) || (s.code || "").toLowerCase().includes(ql);

  const byGroup = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services) { if (!matches(s)) continue; const a = m.get(s.group_id) || []; a.push(s); m.set(s.group_id, a); }
    return m;
  }, [services, ql]);

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

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
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
      <div className="sp-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchServicePh")} />
      </div>

      {groups.map((g) => {
        const list = byGroup.get(g.id) || [];
        if (ql && list.length === 0) return null;
        return (
          <div key={g.id}>
            <div className="sp-grp">
              <span className="sp-tick" />
              <h2>{g.name}</h2>
              <span className="sp-cnt">{list.length}</span>
              {isAdmin && (
                <div className="sp-gtools">
                  <button title={t("editGroup")} onClick={() => renameGroup(g)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg></button>
                  <button title={t("deleteGroup")} onClick={() => delGroup(g)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg></button>
                </div>
              )}
            </div>

            <div className="sp-cards">
            {list.map((s) => {
              const isSingle = (s.tiers || []).includes("single") || (!s.tiers?.some((x) => TIER_KEYS.includes(x as any)));
              const activeTiers = (s.tiers || []).filter((x) => TIER_KEYS.includes(x as any));
              return (
                <div key={s.id} className="sp-card" style={editSvc === s.id ? { gridColumn: "1 / -1" } : undefined}>
                  <div className="sp-chead">
                    <div>
                      <div className="sp-nm">{s.name}</div>
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
                      <button className="sp-edit" onClick={() => setEditSvc(editSvc === s.id ? null : s.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>{t("edit")}
                      </button>
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
                    <table className="sp-ptbl">
                      <thead><tr>
                        <th>{t("tierWord")}</th>
                        <th className="c">{t("baseWord")}</th>
                        <th className="c">{t("normalWord")} <span className="sp-disc">-{s.normal_pct ?? 0}%</span></th>
                        <th className="c">{t("affiliateWord")} <span className="sp-disc">-{s.affiliate_pct ?? 0}%</span></th>
                      </tr></thead>
                      <tbody>
                        {activeTiers.map((k) => {
                          const b = baseOf(s, k); const dollar = k === "intl";
                          const nb = fmt(b, dollar), nn = fmt(disc(b, s.normal_pct), dollar), na = fmt(disc(b, s.affiliate_pct), dollar);
                          return (
                            <tr key={k}>
                              <td className="tier">{tierLabel(k)}</td>
                              <td className={"c base n" + (nb ? "" : " empty")}>{nb ?? "—"}</td>
                              <td className={"c norm n" + (nn ? "" : " empty")}>{nn ?? "—"}</td>
                              <td className={"c aff n" + (na ? "" : " empty")}>{na ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {isAdmin && editSvc === s.id && <ServiceEditor s={s} onClose={() => setEditSvc(null)} onDelete={() => delService(s)} />}
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
          </div>
        );
      })}
      <div className="sp-footnote">{t("spFootnote")}</div>

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
function ServiceEditor({ s, onClose, onDelete }: { s: Service; onClose: () => void; onDelete: () => void }) {
  const t = useT();
  const router = useRouter();
  const supabase = createClient();
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
    await supabase.from("services").update({
      name: f.name.trim(), code: f.code.trim() || null, description: f.description.trim() || null,
      schedule: f.schedule.trim() || null, batch_code: f.batch_code.trim() || null,
      tiers, base_old: num(f.base_old), base_recent: num(f.base_recent), base_intl: num(f.base_intl), base_single: num(f.base_single),
      normal_pct: num(f.normal_pct), affiliate_pct: num(f.affiliate_pct),
    }).eq("id", s.id);
    setSaving(false); onClose(); router.refresh();
  }

  return (
    <div className="sp-editbox">
      <div className="sp-eb-lab">✏️ {t("editServiceHint")}</div>
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
.sp-search{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:0 14px;height:44px;box-shadow:var(--sh);margin-bottom:18px}
.sp-search input{flex:1;border:none;background:none;font-family:inherit;font-size:14px;outline:none;color:var(--text)}
.sp-search svg{width:17px;height:17px;color:var(--muted)}
.sp-grp{display:flex;align-items:center;gap:10px;margin:24px 0 12px}
.sp-tick{width:4px;height:16px;background:var(--brand);border-radius:3px}
.sp-grp h2{font-size:15px;font-weight:800;color:var(--ink)}
.sp-cnt{font-size:11.5px;font-weight:700;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:2px 10px;font-family:var(--fd)}
.sp-gtools{margin-inline-start:auto;display:flex;gap:6px}
.sp-gtools button{border:none;background:none;color:var(--muted);cursor:pointer;width:28px;height:28px;border-radius:7px;display:grid;place-items:center}
.sp-gtools button:hover{background:var(--surface);color:var(--brand)}
.sp-gtools svg{width:14px;height:14px}
.sp-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r,16px);box-shadow:var(--sh);padding:16px 18px;margin-bottom:12px}
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
.sp-ptbl{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:13px}
.sp-ptbl th{text-align:start;font-weight:700;color:var(--muted);font-size:10.5px;padding:8px 6px;border-bottom:1px solid var(--line)}
.sp-ptbl th.c,.sp-ptbl td.c{text-align:center}
.sp-ptbl td{padding:9px 6px;border-bottom:1px solid var(--line)}
.sp-ptbl tr:last-child td{border:none}
.sp-ptbl .tier{font-weight:700;color:var(--ink);font-size:12px}
.sp-ptbl .base{font-weight:700;color:var(--ink)}
.sp-ptbl .norm{color:var(--green);font-weight:600}
.sp-ptbl .aff{color:var(--blue);font-weight:600}
.sp-ptbl .n{font-family:var(--fd)}
.sp-disc{font-size:9.5px;color:var(--muted);display:block;font-weight:600}
.sp-ptbl .empty,.sp-pill.empty{color:var(--muted);opacity:.6}
.sp-single{margin-top:13px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px}
.sp-pill{background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:6px 12px;font-weight:700;color:var(--ink)}
.sp-pill.n{font-family:var(--fd)}
.sp-lbl{color:var(--muted);font-size:11.5px}
.sp-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;margin-bottom:12px}
@media(max-width:640px){.sp-cards{grid-template-columns:1fr}}
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
.sp-tiersel label{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 10px;cursor:pointer}
.sp-btnrow{display:flex;gap:8px;margin-top:4px;align-items:center}
.sp-btn{height:36px;padding:0 15px;border-radius:9px;border:none;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.sp-btn.save{background:var(--brand);color:var(--surface)}
.sp-btn.ghost{background:var(--surface);border:1px solid var(--line);color:var(--text)}
.sp-footnote{text-align:center;font-size:11px;color:var(--muted);margin-top:20px}
`;
