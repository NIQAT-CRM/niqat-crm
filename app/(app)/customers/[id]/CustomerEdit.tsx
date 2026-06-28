"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Spec = { id: string; name_ar: string };
type C = {
  id: string;
  name: string;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  company: string | null;
  residency: string | null;
  grad_year: number | null;
  stage: string;
  specialty_id: string | null;
  lms_status: string | null;
  source: string | null;
  created_at: string;
};

const STAGES = [
  { key: "new", label: "جديد" },
  { key: "contacted", label: "تم التواصل" },
  { key: "interested", label: "مهتم" },
  { key: "negotiation", label: "تفاوض" },
  { key: "enrolled", label: "مشترك" },
  { key: "onhold", label: "معلّق" },
  { key: "lost", label: "خسارة" },
];

function waLink(phone: string | null) {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (!d) return null;
  const intl = d.startsWith("0") ? "20" + d.slice(1) : d;
  return `https://wa.me/${intl}`;
}

export default function CustomerEdit({
  customer,
  specialties,
}: {
  customer: C;
  specialties: Spec[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: customer.name || "",
    phone1: customer.phone1 || "",
    phone2: customer.phone2 || "",
    email: customer.email || "",
    company: customer.company || "",
    residency: customer.residency || "",
    grad_year: customer.grad_year ? String(customer.grad_year) : "",
    specialty_id: customer.specialty_id || "",
    stage: customer.stage || "new",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const wa = waLink(f.phone1);

  async function save() {
    setErr("");
    setMsg("");
    if (!f.name.trim()) {
      setErr("الاسم مطلوب");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("customers")
      .update({
        name: f.name.trim(),
        phone1: f.phone1.trim() || null,
        phone2: f.phone2.trim() || null,
        email: f.email.trim() || null,
        company: f.company.trim() || null,
        residency: f.residency.trim() || null,
        grad_year: f.grad_year ? Number(f.grad_year) : null,
        specialty_id: f.specialty_id || null,
        stage: f.stage,
      })
      .eq("id", customer.id);
    setBusy(false);
    if (error) {
      if ((error as any).code === "23505")
        setErr("الموبايل أو الإيميل ده موجود عند عميل تاني.");
      else setErr("حصل خطأ: " + error.message);
      return;
    }
    setMsg("اتحفظ ✓");
    router.refresh();
  }

  const Label = (p: { children: React.ReactNode }) => (
    <label className="text-xs text-muted mb-1 block">{p.children}</label>
  );
  const inputCls =
    "w-full border border-line rounded-lg px-3 py-2 text-sm bg-white";

  return (
    <div className="bg-white rounded-xl border border-line p-5 space-y-4">
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-emerald-700"
        >
          واتساب
        </a>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>الاسم</Label>
          <input
            className={inputCls}
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <Label>المرحلة</Label>
          <select
            className={inputCls}
            value={f.stage}
            onChange={(e) => set("stage", e.target.value)}
          >
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>الموبايل 1</Label>
          <input
            className={inputCls}
            dir="ltr"
            value={f.phone1}
            onChange={(e) => set("phone1", e.target.value)}
          />
        </div>
        <div>
          <Label>الموبايل 2</Label>
          <input
            className={inputCls}
            dir="ltr"
            value={f.phone2}
            onChange={(e) => set("phone2", e.target.value)}
          />
        </div>
        <div>
          <Label>الإيميل</Label>
          <input
            className={inputCls}
            dir="ltr"
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div>
          <Label>الشركة</Label>
          <input
            className={inputCls}
            value={f.company}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
        <div>
          <Label>التخصص الهندسي</Label>
          <select
            className={inputCls}
            value={f.specialty_id}
            onChange={(e) => set("specialty_id", e.target.value)}
          >
            <option value="">— غير محدد —</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name_ar}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>سنة التخرج</Label>
          <input
            className={inputCls}
            dir="ltr"
            inputMode="numeric"
            value={f.grad_year}
            onChange={(e) => set("grad_year", e.target.value)}
          />
        </div>
        <div>
          <Label>محل الإقامة</Label>
          <input
            className={inputCls}
            value={f.residency}
            onChange={(e) => set("residency", e.target.value)}
          />
        </div>
      </div>

      <div className="text-xs text-muted border-t border-line pt-3 flex flex-wrap gap-x-6 gap-y-1">
        <span>المصدر: {customer.source || "—"}</span>
        <span>حالة المنصة: {customer.lms_status || "—"}</span>
        <span>
          تاريخ الإضافة:{" "}
          {new Date(customer.created_at).toLocaleDateString("ar-EG")}
        </span>
      </div>

      {err && <div className="text-sm text-rose-600">{err}</div>}
      {msg && <div className="text-sm text-emerald-600">{msg}</div>}

      <button
        onClick={save}
        disabled={busy}
        className="bg-brand text-white rounded-lg px-5 py-2 text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "بيحفظ..." : "حفظ التعديلات"}
      </button>
    </div>
  );
}
