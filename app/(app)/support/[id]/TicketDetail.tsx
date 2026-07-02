"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Ticket = {
  id: string; title: string; body: string | null; status: string;
  priority: string; customer_id: string | null; assignee_id: string | null; created_at: string;
};
type Customer = { id: string; name: string; phone1: string | null } | null;
type Prof = { id: string; full_name: string | null; team: string | null };
type Note = { id: string; body: string; created_at: string; author: string };

const STATUSES = [
  { key: "open" },
  { key: "progress" },
  { key: "resolved" },
  { key: "closed" },
];
const PRIOS = [
  { key: "high" },
  { key: "medium" },
  { key: "low" },
];

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString("ar-EG", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}

export default function TicketDetail({
  ticket, customer, assignees, notes, currentUserId,
}: {
  ticket: Ticket; customer: Customer; assignees: Prof[]; notes: Note[]; currentUserId: string | null;
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(ticket.title || "");
  const [body, setBody] = useState(ticket.body || "");
  const [priority, setPriority] = useState(ticket.priority || "medium");
  const [status, setStatus] = useState(ticket.status || "open");
  const [assignee, setAssignee] = useState(ticket.assignee_id || "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function save() {
    setSaving(true); setSavedMsg("");
    const { error } = await supabase.from("tickets").update({
      title: title.trim(), body: body.trim() || null, priority, status, assignee_id: assignee || null,
    }).eq("id", ticket.id);
    setSaving(false);
    if (error) { setSavedMsg("خطأ: " + error.message); return; }
    setSavedMsg(tr("saved") + " ✓");
    router.refresh();
  }

  async function addNote() {
    const b = noteText.trim();
    if (!b) return;
    setAddingNote(true);
    const { error } = await supabase.from("ticket_notes").insert({
      ticket_id: ticket.id, author_id: currentUserId, body: b,
    });
    setAddingNote(false);
    if (error) { alert(tr("addNoteFailed") + error.message); return; }
    setNoteText("");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      {/* بيانات التذكرة */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div className="sec-t" style={{ margin: 0 }}>{tr("editTicket")}</div>
          {customer && (
            <Link href={`/customers/${customer.id}`} style={{ fontSize: 12, color: "var(--brand)", fontWeight: 700 }}>
              {customer.name}
            </Link>
          )}
        </div>

        <div className="fld">
          <label>{tr("subject")}</label>
          <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="fld">
            <label>{tr("priority")}</label>
            <select className="inp" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIOS.map((p) => <option key={p.key} value={p.key}>{tr(p.key)}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>{tr("status")}</label>
            <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{tr(s.key)}</option>)}
            </select>
          </div>
        </div>

        <div className="fld">
          <label>{tr("assignee")}</label>
          <select className="inp" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{tr("unassigned")}</option>
            {assignees.map((a) => <option key={a.id} value={a.id}>{a.full_name || "—"}</option>)}
          </select>
        </div>

        <div className="fld">
          <label>{tr("details")}</label>
          <textarea className="inp" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <button onClick={save} disabled={saving} className="btn">{saving ? tr("saving") : tr("save")}</button>
          {savedMsg && <span style={{ fontSize: 12, color: "var(--muted)" }}>{savedMsg}</span>}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="sec-t" style={{ marginTop: 0 }}>{tr("ticketNotes")}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {notes.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>{tr("noNotes")}</div>}
          {notes.map((n) => (
            <div key={n.id} style={{ background: "rgba(240,138,36,.07)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 14 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{n.author} · {fmt(n.created_at)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input className="inp" placeholder={tr("addTicketNote")} value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
          <button onClick={addNote} disabled={addingNote || !noteText.trim()} className="btn" style={{ flexShrink: 0 }}>
            {tr("addOpt")}
          </button>
        </div>
      </div>
    </div>
  );
}
