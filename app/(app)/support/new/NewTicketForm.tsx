"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Cust = { id: string; name: string; phone1?: string; phone2?: string; email?: string };

const PRIOS = [
  { key: "high" },
  { key: "medium" },
  { key: "low" },
];

export default function NewTicketForm({
  customers, presetCustomer, problems = [],
}: {
  customers: Cust[]; presetCustomer: string; problems?: string[];
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();

  const [customerId, setCustomerId] = useState(presetCustomer || "");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const locked = !!presetCustomer;

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone1 || "").includes(q) ||
      (c.phone2 || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  const selected = customers.find((c) => c.id === customerId);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (presetCustomer) {
      const c = customers.find((x) => x.id === presetCustomer);
      if (c) setSearch(c.name);
    }
  }, [presetCustomer, customers]);

  async function create() {
    setErr("");
    if (!customerId) { setErr(tr("selectCustomerFirst")); return; }
    if (!title.trim()) { setErr(tr("enterSubject")); return; }
    setSaving(true);
    const { data, error } = await supabase.from("tickets").insert({
      customer_id: customerId, title: title.trim(), priority, status: "open", archived: false,
    }).select("id").single();
    if (error) { setSaving(false); setErr(tr("createFailed") + error.message); return; }
    const tt = title.trim();
    if (tt && !problems.some((p) => p.toLowerCase() === tt.toLowerCase())) {
      const next = [...problems, tt].slice(-50);
      await supabase.from("app_settings").upsert({ key: "ticket_problems", value: next, updated_at: new Date().toISOString() });
    }
    setSaving(false);
    router.push(`/support/${data!.id}`);
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <div className="fld">
        <label>{tr("customer")}</label>
        <div ref={ref} style={{ position: "relative" }}>
          <input className="inp" value={locked ? search : search} onChange={(e) => { setSearch(e.target.value); setOpen(true); if (!locked) setCustomerId(""); }}
            onFocus={() => setOpen(true)} placeholder={tr("selectCustomer")} disabled={locked}
            style={{ width: "100%", boxSizing: "border-box", ...(locked ? { background: "var(--muted-soft)" } : {}) }} />
          {open && !locked && (
            <div className="suggest-drop" style={{
              position: "absolute", top: "100%", left: 0, right: 0,
            }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>{tr("noResults")}</div>
              ) : filtered.map((c) => (
                <div key={c.id} className="suggest-item" onClick={() => { setCustomerId(c.id); setSearch(c.name); setOpen(false); }}>
                  <span>{c.name}</span>
                  <span>
                    {c.phone1 && <span dir="ltr">{c.phone1}</span>}
                    {c.email && <span>{c.email}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {problems.length > 0 && (
        <div className="fld">
          <label>{tr("frequentIssues")}</label>
          <select className="inp" value="" onChange={(e) => e.target.value && setTitle(e.target.value)}>
            <option value="">{tr("selectSavedIssue")}</option>
            {problems.map((p, i) => <option key={i} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      <div className="fld">
        <label>{tr("subject")}</label>
        <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} list="probs"
          placeholder={tr("subjectPlaceholder")} />
        <datalist id="probs">{problems.map((p, i) => <option key={i} value={p} />)}</datalist>
      </div>

      <div className="fld">
        <label>{tr("priority")}</label>
        <select className="inp" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIOS.map((p) => <option key={p.key} value={p.key}>{tr(p.key)}</option>)}
        </select>
      </div>

      {err && <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 10 }}>{err}</div>}

      <button onClick={create} disabled={saving} className="btn">
        {saving ? tr("creating") : tr("newTicket")}
      </button>
    </div>
  );
}
