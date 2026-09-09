"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

// المفاتيح المسموحة فقط (تعديل القيم — مفيش إضافة/حذف)
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("campaign_settings_read");
      if (!error && Array.isArray(data)) {
        const m: Record<string, string> = {};
        for (const r of data as any[]) if (ALL_KEYS.includes(r.key)) m[r.key] = r.value ?? "";
        for (const k of ALL_KEYS) if (!(k in m)) m[k] = "";
        setVals(m); setOrig(m);
      }
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));
  const dirty = ALL_KEYS.filter((k) => (vals[k] ?? "") !== (orig[k] ?? ""));

  async function save() {
    if (!dirty.length) return;
    setBusy(true);
    for (const k of dirty) {
      const { error } = await supabase.rpc("campaign_settings_update", { p_key: k, p_value: vals[k] ?? "" });
      if (error) { setBusy(false); toast(tr("saveFailed") + error.message); return; }
    }
    setBusy(false); setOrig({ ...vals }); toast(tr("saved2"));
  }

  return (
    <div className="setcard settings-anim" style={{ gridColumn: "1 / -1" }}>
      <div className="setcard-h">
        <div><h3>📣 {tr("campaignSettings")}</h3><p>{tr("campaignSettingsHint")}</p></div>
        <button className="btn sm" onClick={save} disabled={busy || !dirty.length}>
          {busy ? "..." : tr("save")}{dirty.length ? ` (${dirty.length})` : ""}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 20, color: "var(--muted)", fontSize: 13 }}>…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--brand-d)", marginBottom: 9, textTransform: "uppercase", letterSpacing: ".02em" }}>{tr(g.title)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
                {g.keys.map((f) => (
                  <div key={f.k} style={{ gridColumn: f.area ? "1 / -1" : undefined }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 5 }}>
                      {tr(f.label) === f.label ? f.label : tr(f.label)}
                      {(vals[f.k] ?? "") !== (orig[f.k] ?? "") && <span style={{ color: "var(--brand)", marginInlineStart: 6 }}>●</span>}
                    </label>
                    {f.area ? (
                      <textarea className="inp" rows={2} value={vals[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)} style={{ resize: "vertical", minHeight: 44 }} />
                    ) : (
                      <input className="inp" value={vals[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}
                        dir={f.k.startsWith("social_") || f.k === "zoom_link" || f.k === "whatsapp_number" ? "ltr" : undefined} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, marginBottom: 0 }}>🔒 {tr("campaignSettingsNote")}</p>
    </div>
  );
}
