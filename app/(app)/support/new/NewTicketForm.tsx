"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cust = { id: string; name: string };

const PRIOS = [
  { key: "high", label: "عالية" },
  { key: "medium", label: "متوسطة" },
  { key: "low", label: "منخفضة" },
];

export default function NewTicketForm({
  customers, presetCustomer,
}: {
  customers: Cust[]; presetCustomer: string;
}) {
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
    if (!customerId) { setErr("اختر العميل أولاً."); return; }
    if (!title.trim()) { setErr("اكتب موضوع التذكرة."); return; }
    setSaving(true);
    const { data, error } = await supabase.from("tickets").insert({
      customer_id: customerId, title: title.trim(), priority, status: "open", archived: false,
    }).select("id").single();
    setSaving(false);
    if (error) { setErr("تعذّر إنشاء التذكرة: " + error.message); return; }
    router.push(`/support/${data!.id}`);
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      <div className="fld">
        <label>العميل</label>
        <select className="inp" value={customerId} disabled={locked}
          onChange={(e) => setCustomerId(e.target.value)}
          style={locked ? { background: "#f1f3f8" } : undefined}>
          <option value="">— اختر العميل —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="fld">
        <label>الموضوع</label>
        <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="مثال: مشكلة في الدخول على المنصة" />
      </div>

      <div className="fld">
        <label>الأولوية</label>
        <select className="inp" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      {err && <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 10 }}>{err}</div>}

      <button onClick={create} disabled={saving} className="btn">
        {saving ? "جاري الإنشاء…" : "إنشاء التذكرة"}
      </button>
    </div>
  );
}
