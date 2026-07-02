"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cust = { id: string; name: string; phone1?: string; phone2?: string; email?: string };
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
  const [search, setSearch] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

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
      if (ref.current && !ref.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

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
    setCustomerId(""); setSearch(""); setTitle(""); setPriority("medium");
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
            <div ref={ref} style={{ position: "relative" }}>
              <input className="inp" value={selected ? selected.name : search}
                onChange={(e) => { setSearch(e.target.value); setDropOpen(true); setCustomerId(""); }}
                onFocus={() => setDropOpen(true)} placeholder="ابحث باسم العميل أو الموبايل أو الإيميل"
                style={{ width: "100%", boxSizing: "border-box" }} />
              {dropOpen && (
                <div className="suggest-drop" style={{ position: "absolute", top: "100%", left: 0, right: 0 }}>
                  {filtered.length === 0 ? (
                    <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>لا توجد نتائج</div>
                  ) : filtered.map((c) => (
                    <div key={c.id} className="suggest-item" onClick={() => { setCustomerId(c.id); setSearch(c.name); setDropOpen(false); }}>
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
