"use client";
import { useState, useRef } from "react";
import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Ticket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  customerName: string;
  assigneeId: string;
  assigneeName: string;
  date: string;
};

const STATUSES = [
  { key: "open", color: "#2F6BFF" },
  { key: "progress", color: "#E6A700" },
  { key: "resolved", color: "#18A957" },
  { key: "closed", color: "#94A2BB" },
];

const PRC: Record<string, string> = {
  high: "#E0483B",
  medium: "#E6A700",
  low: "#0FA3A3",
  normal: "#94A2BB",
};

const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
function avColor(id: string) {
  let h = 0;
  for (const ch of id || "") h += ch.charCodeAt(0);
  return AV[h % AV.length];
}
function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2);
}

export default function SupportBoard({ initial }: { initial: Ticket[] }) {
  const tr = useT();
  const router = useRouter();
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [colQ, setColQ] = useState<Record<string, string>>({});
  const [colSort, setColSort] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editStatus, setEditStatus] = useState("open");
  const [editSaving, setEditSaving] = useState(false);

  function sortItems(items: Ticket[], colKey: string): Ticket[] {
    const mode = colSort[colKey] || "";
    if (!mode) return items;
    const sorted = [...items];
    if (mode === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (mode === "new") sorted.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    else if (mode === "pri") sorted.sort((a, b) => {
      const ord: Record<string, number> = { high: 0, medium: 1, low: 2, normal: 3 };
      return (ord[a.priority] ?? 3) - (ord[b.priority] ?? 3);
    });
    return sorted;
  }

  async function drop(status: string) {
    const id = dragId;
    setOverCol(null);
    setDragId(null);
    if (!id) return;
    const tk = tickets.find((t) => t.id === id);
    if (!tk || tk.status === status) return;
    const prev = tickets;
    setTickets((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) {
      setTickets(prev);
      alert("تعذّر نقل التذكرة: " + error.message);
    }
  }

  function openEdit(tk: Ticket) {
    setEditId(tk.id);
    setEditTitle(tk.title);
    setEditPriority(tk.priority);
    setEditStatus(tk.status);
  }

  async function saveEdit() {
    if (!editId) return;
    setEditSaving(true);
    const { error } = await supabase.from("tickets").update({ title: editTitle.trim(), priority: editPriority, status: editStatus }).eq("id", editId);
    setEditSaving(false);
    if (error) { alert("خطأ: " + error.message); return; }
    setTickets((list) => list.map((t) => t.id === editId ? { ...t, title: editTitle.trim(), priority: editPriority, status: editStatus } : t));
    setEditId(null);
  }

  async function archive(id: string) {
    const prev = tickets;
    setTickets((l) => l.filter((t) => t.id !== id));
    const { error } = await supabase.from("tickets").update({ archived: true }).eq("id", id);
    if (error) {
      setTickets(prev);
      alert("تعذّر الأرشفة: " + error.message);
    }
  }

  return (
    <div>
      <style>{`[data-theme="dark"] .col .dot{filter:grayscale(100%) brightness(1.5);}`}</style>
      <div className="page-h">
        <div>
          <h1>{tr("support")}</h1>
          <p>{tickets.length} {tr("support")} — {tr("supportDesc")}</p>
        </div>
        <Link href="/support/new" className="btn">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
          {tr("newTicket")}
        </Link>
      </div>

      <div className="pipe">
        {STATUSES.map((s) => {
          const cq = (colQ[s.key] || "").trim().toLowerCase();
          const items = sortItems(tickets.filter((t) => (t.status || "open") === s.key)
            .filter((t) => !cq || ((t.title || "") + " " + ((t as any).customerName || "") + " " + ((t as any).phone || "")).toLowerCase().includes(cq)), s.key);
          return (
            <div
              key={s.key}
              className={"col" + (overCol === s.key ? " drag" : "")}
              onDragOver={(e) => {
                e.preventDefault();
                if (overCol !== s.key) setOverCol(s.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(s.key);
              }}
            >
              <div className="col-h">
                <span className="nm">
                  <span className="dot" style={{ background: s.color }} />
                  {tr(s.key)}
                </span>
                <select className="sortsel" value={colSort[s.key] || ""} onChange={(e) => setColSort((q) => ({ ...q, [s.key]: e.target.value }))}>
                  <option value="">{tr("sortPlaceholder")}</option>
                  <option value="name">{tr("bySubject")}</option>
                  <option value="new">{tr("newestLabel")}</option>
                  <option value="pri">{tr("byPriority")}</option>
                </select>
                <span className="ct">{items.length}</span>
              </div>
              <input className="inp" placeholder={tr("filterColumn")} value={colQ[s.key] || ""}
                onChange={(e) => setColQ((q) => ({ ...q, [s.key]: e.target.value }))}
                style={{ height: 30, fontSize: 12, margin: "0 0 8px" }} />
              <div className="col-b enter">
                {items.map((t) => {
                  const pc = PRC[t.priority] || PRC.normal;
                  return (
                    <div
                      key={t.id}
                      className={"tk" + (dragId === t.id ? " ghost" : "")}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                        downRef.current = null;
                      }}
                      onMouseDown={(e) => { downRef.current = { x: e.clientX, y: e.clientY }; }}
                      onMouseUp={(e) => {
                        const d = downRef.current; downRef.current = null;
                        if (!d) return;
                        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) openEdit(t);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <button className="cardx" title={tr("archiveCard")} onMouseDown={(ev) => ev.stopPropagation()} onMouseUp={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); archive(t.id); }}>
                        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12l5 5L20 7" /></svg>
                      </button>
                      <div className="th">
                        <span className="pr" style={{ background: pc }} />
                        <span className="tt">{t.title}</span>
                      </div>
                      <div className="tm">
                        <span>{t.customerName}</span>
                        <span>•</span>
                        <span className="num">{t.date}</span>
                        <span>•</span>
                        <span className="who-mini">
                          <span
                            className="av-xs"
                            style={{
                              background: avColor(t.assigneeId),
                              width: 18,
                              height: 18,
                              fontSize: 9,
                            }}
                          >
                            {initials(t.assigneeName)}
                          </span>
                          {t.assigneeName}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-xs text-muted text-center py-3">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editId && (
        <>
          <div className="scrim show" onClick={() => setEditId(null)} />
          <div className="modal show">
            <div className="modal-h">
              <h3>{tr("editTicket")}</h3>
              <button className="x" onClick={() => setEditId(null)}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <div className="modal-b">
              <div className="fld">
                <label>{tr("subject")}</label>
                <input className="inp" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="frow">
                <div className="fld">
                  <label>{tr("priority")}</label>
                  <select className="inp" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                    <option value="high">{tr("high")}</option>
                    <option value="medium">{tr("medium")}</option>
                    <option value="low">{tr("low")}</option>
                  </select>
                </div>
                <div className="fld">
                  <label>{tr("status")}</label>
                  <select className="inp" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    <option value="open">{tr("open")}</option>
                    <option value="progress">{tr("progress")}</option>
                    <option value="resolved">{tr("resolved")}</option>
                    <option value="closed">{tr("closed")}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-f">
              <button className="btn" onClick={saveEdit} disabled={editSaving}>{editSaving ? "..." : tr("save")}</button>
              <button className="btn ghost" onClick={() => setEditId(null)}>{tr("cancel")}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
