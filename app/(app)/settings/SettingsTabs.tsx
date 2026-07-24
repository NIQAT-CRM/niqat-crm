"use client";
import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

export default function SettingsTabs({ integrations, catalog, team }: {
  integrations: ReactNode; catalog: ReactNode; team: ReactNode;
}) {
  const tr = useT();
  const [tab, setTab] = useState<"integrations" | "catalog" | "team">("integrations");
  const tabs = [
    ["integrations", "⚙️ " + tr("tabIntegrations")],
    ["catalog", "📚 " + tr("tabCatalog")],
    ["team", "👥 " + tr("tabAffTeam")],
  ] as const;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        {tabs.map(([k, lbl]) => (
          <button key={k} type="button" onClick={() => setTab(k as any)}
            style={{
              padding: "11px 18px", fontSize: 13.5, fontWeight: 700, background: "none",
              color: tab === k ? "var(--brand-d)" : "var(--muted)",
              borderBottom: tab === k ? "2px solid var(--brand)" : "2px solid transparent", marginBottom: -1,
            }}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ display: tab === "integrations" ? "block" : "none" }}>{integrations}</div>
      <div style={{ display: tab === "catalog" ? "block" : "none" }}>{catalog}</div>
      <div style={{ display: tab === "team" ? "block" : "none" }}>{team}</div>
    </div>
  );
}
