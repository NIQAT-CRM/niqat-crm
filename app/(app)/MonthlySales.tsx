"use client";
import { useState } from "react";
import { useT, useLang } from "@/lib/i18n/client";

type Row = { ym: string; egp: number; usd: number; cnt: number };

export default function MonthlySales({ rows, collapsible = false }: { rows: Row[]; collapsible?: boolean }) {
  const tr = useT();
  const lang = useLang();
  const [open, setOpen] = useState(!collapsible);
  const nf = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US");
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 15));
  };

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: collapsible ? "pointer" : "default", marginBottom: open ? 14 : 0 }}
        onClick={() => collapsible && setOpen((o) => !o)}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", margin: 0 }}>📅 {tr("monthlySales")}</h3>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0" }}>{tr("monthlySalesHint")}</p>
        </div>
        {collapsible && (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--muted)" strokeWidth={2.4}
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
        )}
      </div>

      {open && (
        rows.length === 0
          ? <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 2px" }}>{tr("noReceiptsYet")}</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
              {rows.map((r) => (
                <div key={r.ym} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 13px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg,transparent)", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13.5, minWidth: 120 }}>
                    {monthLabel(r.ym)}
                    <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 11.5, marginInlineStart: 6 }}>· {nf.format(r.cnt)} {tr("receiptsWord")}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--brand-soft)", color: "var(--brand-d)", padding: "5px 11px", borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                      <span className="n">{nf.format(r.egp)}</span> {tr("egp")}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--muted-soft)", color: "var(--ink)", padding: "5px 11px", borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                      <span className="n">{nf.format(r.usd)}</span> {tr("usd")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}
