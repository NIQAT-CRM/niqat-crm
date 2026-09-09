"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

const GROUPS: { title: string; keys: { k: string; label: string; area?: boolean }[] }[] = [
  { title: "campEvent", keys: [
    { k: "event_title", label: "campEventTitle" },
    { k: "event_date", label: "campEventDate" },
    { k: "event_time_cairo", label: "campEventTime" },
    { k: "event_timezones", label: "campTimezones" },
    { k: "duration", label: "campDuration" },
  ] },
  { title: "campSessionLink", keys: [{ k: "zoom_link", label: "campZoom" }] },
  { title: "campWhatsapp", keys: [
    { k: "whatsapp_number", label: "campWaNumber" },
    { k: "whatsapp_prefill", label: "campWaPrefill", area: true },
  ] },
  { title: "campAboutSocials", keys: [
    { k: "about_blurb", label: "campAbout", area: true },
    { k: "social_facebook", label: "Facebook" },
    { k: "social_instagram", label: "Instagram" },
    { k: "social_linkedin", label: "LinkedIn" },
    { k: "social_youtube", label: "YouTube" },
    { k: "social_tiktok", label: "TikTok" },
  ] },
];
const ALL_KEYS = GROUPS.flatMap((g) => g.keys.map((x) => x.k));

export default function CampaignSettingsCard() {
  const tr = useT();
  const supabase = createClient();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);     // مطوي افتراضياً
  const [editing, setEditing] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logs, setLogs] = useState<any[] | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  async function loadLogs() {
    setLogBusy(true);
    const { data, error } = await supabase.rpc("campaign_wa_log_read");
    setLogs(error ? [] : ((data as any[]) || []));
    setLogBusy(false);
  }

  async function load() {
    const { data, error } = await supabase.rpc("campaign_settings_read");
    if (!error && Array.isArray(data)) {
      const m: Record<string, string> = {};
      for (const r of data as any[]) if (ALL_KEYS.includes(r.key)) m[r.key] = r.value ?? "";
      for (const k of ALL_KEYS) if (!(k in m)) m[k] = "";
      setVals(m); setOrig(m);
    }
    setLoaded(true);
  }
  useEffect(() => { if (open && !loaded) load(); }, [open]);

  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  const dirty = ALL_KEYS.filter((k) => (vals[k] ?? "") !== (orig[k] ?? ""));

  async function save() {
    if (!dirty.length) { setEditing(false); return; }
    setBusy(true);
    for (const k of dirty) {
      const { error } = await supabase.rpc("campaign_settings_update", { p_key: k, p_value: vals[k] ?? "" });
      if (error) { setBusy(false); toast(tr("saveFailed") + error.message); return; }
    }
    setBusy(false); setOrig({ ...vals }); setEditing(false); toast(tr("saved2"));
  }
  function cancel() { setVals({ ...orig }); setEditing(false); }

  return (
    <div className="setcard settings-anim">
      <div className="setcard-h" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div><h3>📣 {tr("campaignSettings")}</h3><p>{tr("campaignSettingsHint")}</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {open && !editing && <button className="rowbtn edit" onClick={() => setEditing(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>{tr("edit")}
          </button>}
          {open && editing && <>
            <button className="btn sm" onClick={save} disabled={busy}>{busy ? "..." : tr("save")}{dirty.length ? ` (${dirty.length})` : ""}</button>
            <button className="rowbtn cancel" onClick={cancel}>{tr("cancel")}</button>
          </>}
          <button className="rowbtn" onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "none" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.4} width={18} height={18}
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      </div>

      {open && (
        !loaded ? <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>…</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 6 }}>
            {GROUPS.map((g) => (
              <div key={g.title}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--brand-d)", marginBottom: 9, textTransform: "uppercase", letterSpacing: ".02em" }}>{tr(g.title)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
                  {g.keys.map((f) => {
                    const changed = (vals[f.k] ?? "") !== (orig[f.k] ?? "");
                    return (
                      <div key={f.k} style={{ gridColumn: f.area ? "1 / -1" : undefined }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 5 }}>
                          {tr(f.label) === f.label ? f.label : tr(f.label)}
                          {changed && <span style={{ color: "var(--brand)", marginInlineStart: 6 }}>●</span>}
                        </label>
                        {f.area ? (
                          <textarea className="inp" rows={2} disabled={!editing} value={vals[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}
                            style={{ resize: "vertical", minHeight: 44, opacity: editing ? 1 : .7, cursor: editing ? "text" : "default" }} />
                        ) : (
                          <input className="inp" disabled={!editing} value={vals[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}
                            dir={f.k.startsWith("social_") || f.k === "zoom_link" || f.k === "whatsapp_number" ? "ltr" : undefined}
                            style={{ opacity: editing ? 1 : .7, cursor: editing ? "text" : "default" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>🔒 {tr("campaignSettingsNote")}</p>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <button onClick={() => { const n = !logOpen; setLogOpen(n); if (n && logs === null) loadLogs(); }}
                  style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: 12.5, color: "var(--ink)", display: "flex", alignItems: "center", gap: 7, padding: 0 }}>
                  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="var(--muted)" strokeWidth={2.4} style={{ transform: logOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="M6 9l6 6 6-6" /></svg>
                  📨 {tr("waSendLog")}
                </button>
                {logOpen && <button className="rowbtn" onClick={loadLogs} disabled={logBusy} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11, padding: "4px 10px", color: "var(--muted)" }}>{logBusy ? "..." : "↻ " + tr("refresh")}</button>}
              </div>

              {logOpen && (
                <div style={{ marginTop: 10 }}>
                  {logBusy && logs === null ? <div style={{ fontSize: 12, color: "var(--muted)", padding: 8 }}>…</div>
                    : !logs || logs.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 2px" }}>{tr("waNoSends")}</div>
                    : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 260, overflowY: "auto" }}>
                        {logs.map((r, i) => {
                          const ok = r.http_code === 200 || r.http_code === 201 || r.http_code === 202;
                          const pending = r.status === "queued" && r.http_code == null;
                          const color = ok ? "var(--green)" : pending ? "var(--amber)" : "var(--red)";
                          const bg = ok ? "var(--green-soft)" : pending ? "var(--amber-soft,#FBF1DC)" : "var(--red-soft,#FBECEA)";
                          const label = ok ? tr("waSent") : pending ? tr("waPending") : tr("waFailed");
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", flexShrink: 0 }}>{label}{r.http_code ? ` · ${r.http_code}` : ""}</span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.full_name || "—"} · <span dir="ltr" style={{ fontFamily: "var(--fd)" }}>{r.whatsapp}</span></div>
                                {(r.note || (!ok && r.wati_response)) && <div style={{ fontSize: 10.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.note || r.wati_response}</div>}
                              </div>
                              <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--fd)", flexShrink: 0 }} dir="ltr">{String(r.created_at).slice(0, 16).replace("T", " ")}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
