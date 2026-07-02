"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Cust = { id: string; name: string };

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

  const locked = !!presetCustomer;

  async function create() {
    setErr("");
    if (!customerId) { setErr(tr("selectCustomerFirst")); return; }
    if (!title.trim()) { setErr(tr("enterSubject")); return; }
    setSaving(true);
    const { data, error } = await supabase.from("tickets").insert({
      customer_id: customerId, title: title.trim(), priority, status: "open", archived: false,
    }).select("id").single();
    if (error) { setSaving(false); setErr(tr("createFailed") + error.message); return; }
    // حفظ المشكلة في القائمة المتكررة لو جديدة
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
        <select className="inp" value={customerId} disabled={locked}
          onChange={(e) => setCustomerId(e.target.value)}
          style={locked ? { background: "#f1f3f8" } : undefined}>
          <option value="">{tr("selectCustomer")}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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
