"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cust = { id: string; name: string };
const PRIOS = [
  { key: "high", label: "عالية" },
  { key: "medium", label: "متوسطة" },
  { key: "low", label: "منخفضة" },
];

export default function NewTicketModal({
  open, onClose, customers, problems = [],
}: {
  open: boolean; onClose: () => void; customers: Cust[]; problems?: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const create = useCallback(async () => {
    setErr("");
    if (!customerId) { setErr("اختر العميل أولاً."); return; }
    if (!title.trim()) { setErr("اكتب موضوع التذكرة."); return; }
    setSaving(true);
    const { error } = await supabase.from("tickets").insert({
      customer_id: customerId, title: title.trim(), priority, status: "open", archived: false,
    }).select("id").single();
    if (error) { setSaving(false); setErr("تعذّر إنشاء التذكرة: " + error.message); return; }
    const tt = title.trim();
    if (tt && !problems.some((p) => p.toLowerCase() === tt.toLowerCase())) {
      const next = [...problems, tt].slice(-50);
      await supabase.from("app_settings").upsert({ key: "ticket_problems", value: next, updated_at: new Date().toISOString() });
    }
    setSaving(false);
    setCustomerId(""); setTitle(""); setPriority("medium");
    onClose();
    router.refresh();
  }, [customerId, title, priority, problems, supabase, onClose, router]);

  if (!open) return null;

  return (
    <>
      <div className="scrim show" onClick={onClose} />
      <div className="modal show" role="dialog" aria-modal="true">
        <div className="modal-h">
          <h3>تذكرة جديدة</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-b">
          <div className="fld">
            <label>العميل</label>
            <select className="inp" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— اختر العميل —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>الموضوع</label>
            <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} list="probs_modal"
              placeholder="مثال: مشكلة في الدخول على المنصة" />
            <datalist id="probs_modal">{problems.map((p, i) => <option key={i} value={p} />)}</datalist>
          </div>
          <div className="fld">
            <label>الأولوية</label>
            <select className="inp" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          {err && <div style={{ fontSize: 13, color: "var(--red)" }}>{err}</div>}
        </div>
        <div className="modal-f">
          <button className="btn ghost" type="button" onClick={onClose}>إلغاء</button>
          <button className="btn" type="button" disabled={saving} style={{ marginInlineStart: "auto" }} onClick={create}>
            {saving ? "جاري الإنشاء…" : "إنشاء التذكرة"}
          </button>
        </div>
      </div>
    </>
  );
}
