"use client";
import { useState } from "react";
import Link from "next/link";
import { useT, useLang } from "@/lib/i18n/client";

type Uni = { id: string; name_ar: string; name_en: string; college: string; department: string; status: string };

const ST: Record<string, { k: string; c: string; bg: string }> = {
  active:      { k: "uniStActive",      c: "var(--green)", bg: "rgba(24,169,87,.12)" },
  inactive:    { k: "uniStInactive",    c: "var(--red)", bg: "rgba(224,72,59,.12)" },
  negotiating: { k: "uniStNegotiating", c: "var(--amber)", bg: "rgba(240,168,36,.16)" },
  signed:      { k: "uniStSigned",      c: "var(--blue)", bg: "rgba(47,107,255,.12)" },
};

export default function UniList({ items, canManage }: { items: Uni[]; canManage: boolean }) {
  const tr = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const nm = (u: Uni) => ((lang === "ar" ? (u.name_ar || u.name_en) : (u.name_en || u.name_ar)) || "—");
  const filtered = items.filter((u) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (u.name_ar || "").toLowerCase().includes(s) || (u.name_en || "").toLowerCase().includes(s);
  });

  return (
    <>
      <div className="page-h">
        <div><h1>{tr("universities")}</h1></div>
        {canManage && <Link href="/universities/new" className="btn">+ {tr("uniAddBtn")}</Link>}
      </div>

      <input className="inp" placeholder={tr("uniSearchPh")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 340, marginBottom: 16 }} />

      {filtered.length === 0 ? (
        <div className="empty"><b>{tr("uniNoneYet")}</b></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
          {filtered.map((u) => {
            const st = ST[u.status] || ST.active;
            return (
              <Link key={u.id} href={`/universities/${u.id}`} className="card" style={{ padding: 16, borderInlineStart: `4px solid ${st.c}`, textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <b style={{ color: "var(--ink)", fontSize: 15, lineHeight: 1.35 }}>{nm(u)}</b>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: st.c, background: st.bg, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap", flexShrink: 0 }}>{tr(st.k)}</span>
                </div>
                {(u.college || u.department) && (
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{[u.college, u.department].filter(Boolean).join(" · ")}</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
