"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

type Item = {
  id: string; sender: string; senderTeam: string; toTeam: string; roomKey: string;
  body: string; customer: string; customerId: string; hasAttachment: boolean; at: string;
};

function initials(n: string) {
  const p = n.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "؟";
}
const AVC = ["var(--brand)", "var(--teal)", "var(--purple)", "var(--blue)", "var(--green)"];

export default function ChatLogView({ items, rooms }: { items: Item[]; rooms: { key: string; label: string }[] }) {
  const tr = useT();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all"); // all | <roomKey> | att | linked

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((m) => {
      if (filter === "att" && !m.hasAttachment) return false;
      if (filter === "linked" && !m.customer) return false;
      if (filter !== "all" && filter !== "att" && filter !== "linked" && m.roomKey !== filter) return false;
      if (s) {
        const hay = (m.body + " " + m.sender + " " + m.customer).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, q, filter]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="page-h"><div><h1>{tr("chatLogTitle")}</h1><p>{tr("chatLogDesc")}</p></div></div>

      <div className="search" style={{ marginBottom: 12 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        <input placeholder={tr("chatLogSearch")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="filt" style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        <button className={"fchip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>{tr("filterAll")}</button>
        {rooms.map((r) => (
          <button key={r.key} className={"fchip" + (filter === r.key ? " on" : "")} onClick={() => setFilter(r.key)}>{r.label}</button>
        ))}
        <button className={"fchip" + (filter === "att" ? " on" : "")} onClick={() => setFilter("att")}>{tr("filterAttachments")}</button>
        <button className={"fchip" + (filter === "linked" ? " on" : "")} onClick={() => setFilter("linked")}>{tr("filterLinked")}</button>
      </div>

      <div className="card" style={{ padding: "6px 18px" }}>
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{tr("noData")}</div>}
        {filtered.map((m, i) => (
          <div key={m.id} className="clog-row">
            <span className="clog-av" style={{ background: AVC[i % AVC.length] }}>{initials(m.sender)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="clog-hd">
                <span className="clog-nm">{m.sender}</span>
                <span style={{ color: "var(--muted)" }}>←</span>
                <span className="clog-tag">{m.toTeam}</span>
              </div>
              {m.body && <div className="clog-bd">{m.body}</div>}
              {m.customer && (
                <Link href={`/customers/${m.customerId}`} className="chat-cchip" style={{ display: "inline-flex", background: "var(--blue-soft)", color: "var(--blue)", marginTop: 5, textDecoration: "none" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  {tr("chatAbout")} {m.customer}
                </Link>
              )}
              {m.hasAttachment && (
                <div className="clog-att"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>{tr("chatAttachment")}</div>
              )}
            </div>
            <span className="clog-tm num">{m.at}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
