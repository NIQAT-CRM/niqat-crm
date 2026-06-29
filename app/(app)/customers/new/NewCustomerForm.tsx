"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Opt = { id: string; name: string };
const STAGES = [
  ["new", "جديد"], ["contacted", "تم التواصل"], ["interested", "مهتم"],
  ["negotiation", "تفاوض"], ["enrolled", "مسجّل / دفع"], ["onhold", "معلّق"], ["lost", "مؤجل / مرفوض"],
];

export default function NewCustomerForm({
  specialties, diplomas, batches, meId,
}: { specialties: Opt[]; diplomas: Opt[]; batches: Opt[]; meId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: "", phone1: "", phone2: "", email: "", company: "", affiliate_code: "",
    specialty_id: "", stage: "new", residency: "", grad_year: "", source: "",
    follow: "", diploma_id: "", batch_id: "", free: false, note: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.name.trim()) { toast("الاسم مطلوب"); return; }
    setSaving(true);
    const { data: cust, error } = await supabase.from("customers").insert({
      name: f.name.trim(), phone1: f.phone1.trim() || null, phone2: f.phone2.trim() || null,
      email: f.email.trim() || null, company: f.company.trim(), affiliate_code: f.affiliate_code.trim(),
      specialty_id: f.specialty_id || null, stage: f.stage, residency: f.residency.trim(),
      grad_year: f.grad_year.trim() || null, source: f.source.trim(),
    }).select("id").single();

    if (error || !cust) {
      setSaving(false);
      toast((error as any)?.code === "23505" ? "العميل موجود قبل كده" : "حصل خطأ");
      return;
    }
    const cid = cust.id;
    // اشتراك
    if (f.diploma_id) {
      await supabase.from("enrollments").insert({
        customer_id: cid, diploma_id: f.diploma_id, batch_id: f.batch_id || null,
        status: "active", free: f.free,
      });
    }
    // متابعة
    if (f.follow) {
      await supabase.from("follow_ups").insert({
        customer_id: cid, owner_id: meId, due_at: new Date(f.follow).toISOString(), note: "", done: false,
      });
    }
    // ملاحظة أولية
    if (f.note.trim()) {
      await supabase.from("communications").insert({
        customer_id: cid, channel: "note", direction: "out", body: f.note.trim(), by_id: meId,
      });
    }
    setSaving(false);
    toast("اتسجّل العميل ✓");
    router.push(`/customers/${cid}`); router.refresh();
  }

  const I = (label: string, k: string, ltr = false) => (
    <div className="fld"><label>{label}</label>
      <input className={"inp" + (ltr ? " num" : "")} dir={ltr ? "ltr" : "rtl"} value={(f as any)[k]} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="sec-t" style={{ marginTop: 0 }}>البيانات الأساسية</div>
      {I("الاسم *", "name")}
      <div className="frow">{I("موبايل ١", "phone1", true)}{I("موبايل ٢", "phone2", true)}</div>
      <div className="frow">{I("الإيميل", "email", true)}{I("الشركة", "company")}</div>
      {I("كود الأفيلييت", "affiliate_code", true)}

      <div className="sec-t">بيانات المبيعات</div>
      <div className="frow">
        <div className="fld"><label>التخصص الهندسي</label>
          <select className="inp" value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
            <option value="">— اختر —</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="fld"><label>المرحلة</label>
          <select className="inp" value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {STAGES.map((s) => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
          </select></div>
      </div>
      <div className="frow">{I("محل الإقامة", "residency")}{I("سنة التخرج", "grad_year", true)}</div>
      <div className="frow">
        {I("المصدر", "source")}
        <div className="fld"><label>موعد المتابعة</label>
          <input className="inp num" type="datetime-local" dir="ltr" value={f.follow} onChange={(e) => set("follow", e.target.value)} /></div>
      </div>

      <div className="sec-t">الاشتراك (اختياري)</div>
      <div className="frow">
        <div className="fld"><label>الدبلومة</label>
          <select className="inp" value={f.diploma_id} onChange={(e) => set("diploma_id", e.target.value)}>
            <option value="">— بدون —</option>
            {diplomas.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div className="fld"><label>الباتش</label>
          <select className="inp" value={f.batch_id} onChange={(e) => set("batch_id", e.target.value)}>
            <option value="">— بدون —</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></div>
      </div>
      <label className="chkrow"><input type="checkbox" checked={f.free} onChange={(e) => set("free", e.target.checked)} /> هدية / مجاني</label>

      <div className="sec-t">ملاحظة أولية</div>
      <textarea className="inp" rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="ملاحظات عن العميل…" />

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={save} disabled={saving} className="btn">{saving ? "..." : "حفظ العميل"}</button>
        <button onClick={() => router.back()} className="btn ghost">رجوع</button>
      </div>
    </div>
  );
}
