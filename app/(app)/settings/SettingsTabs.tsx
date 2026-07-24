"use client";
import { useState, useEffect, type ReactNode } from "react";

export type SettingsTab = { key: string; label: string; content: ReactNode };

export default function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const first = tabs[0]?.key || "";
  const [tab, setTab] = useState<string>(first);

  // deep-link: /settings?tab=users أو ?tab=chatlog (لو التبويب متاح للمستخدم)
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && tabs.some((t) => t.key === wanted)) setTab(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              padding: "11px 18px", fontSize: 13.5, fontWeight: 700, background: "none",
              color: tab === t.key ? "var(--brand-d)" : "var(--muted)",
              borderBottom: tab === t.key ? "2px solid var(--brand)" : "2px solid transparent", marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} style={{ display: tab === t.key ? "block" : "none" }}>{t.content}</div>
      ))}
    </div>
  );
}
