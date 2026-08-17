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
    <div className="card" style={{ padding: 16, maxWidth: 420, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: collapsible ? "pointer" : "default", marginBottom: open ? 12 : 0 }}
        onClick={() => collapsible && setOpen((o) => !o)}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink)", margin: 0 }}>📅 {tr("monthlySales")}</h3>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0" }}>{tr("monthlySalesHint")}</p>
        </div>
        {collapsible && (
          <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="var(--muted)" strokeWidth={2.4}
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
        )}
      </div>

      {open && (
        rows.length === 0
          ? <div style={{ fontSize: 13, color: "var(--muted)", padding: "6px 2px" }}>{tr("noReceiptsYet")}</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 264, overflowY: "auto", paddingInlineEnd: 4 }}>
              {rows.map((r) => (
                <div key={r.ym} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 11px", border: "1px solid var(--line)", borderRadius: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>{monthLabel(r.ym)}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{nf.format(r.cnt)} {tr("receiptsWord")}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--brand-soft)", color: "var(--brand-d)", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 800, direction: "ltr" }}>
                      <span className="n">{nf.format(r.egp)}</span> {tr("egp")}
                    </span>
                    {Number(r.usd) > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(47,107,255,.12)", color: "var(--blue)", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 800, direction: "ltr" }}>
                        $<span className="n">{nf.format(r.usd)}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}
