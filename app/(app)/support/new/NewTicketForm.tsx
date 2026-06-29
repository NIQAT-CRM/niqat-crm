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
  customers, presetCustomer, problems = [],
}: {
  customers: Cust[]; presetCustomer: string; problems?: string[];
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
    if (error) { setSaving(false); setErr("تعذّر إنشاء التذكرة: " + error.message); return; }
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
        <label>العميل</label>
        <select className="inp" value={customerId} disabled={locked}
          onChange={(e) => setCustomerId(e.target.value)}
          style={locked ? { background: "#f1f3f8" } : undefined}>
          <option value="">— اختر العميل —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {problems.length > 0 && (
        <div className="fld">
          <label>مشاكل متكررة (اختر بدل ما تكتب)</label>
          <select className="inp" value="" onChange={(e) => e.target.value && setTitle(e.target.value)}>
            <option value="">— اختر مشكلة محفوظة —</option>
            {problems.map((p, i) => <option key={i} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      <div className="fld">
        <label>الموضوع</label>
        <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} list="probs"
          placeholder="مثال: مشكلة في الدخول على المنصة" />
        <datalist id="probs">{problems.map((p, i) => <option key={i} value={p} />)}</datalist>
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
