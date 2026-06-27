"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCustomer() {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({ name: "", phone1: "", phone2: "", email: "", company: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }));

  async function save() {
    setErr("");
    if (!f.name.trim()) { setErr("الاسم مطلوب"); return; }
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: f.name.trim(),
      phone1: f.phone1.trim() || null,
      phone2: f.phone2.trim() || null,
      email: f.email.trim() || null,
      company: f.company.trim()
    });
    setSaving(false);
    if (error) {
      if ((error as any).code === "23505")
        setErr("العميل ده موجود قبل كده (نفس الموبايل أو الإيميل).");
      else setErr("حصل خطأ: " + error.message);
      return;
    }
    router.push("/customers"); router.refresh();
  }

  const Field = (label: string, k: keyof typeof f, ltr = false) => (
    <div className="mb-3">
      <label className="block text-sm font-bold mb-1">{label}</label>
      <input className="w-full border border-line rounded-lg px-3 py-2 outline-none focus:border-brand"
        dir={ltr ? "ltr" : "rtl"} value={f[k]} onChange={e => set(k, e.target.value)} />
    </div>
  );

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-extrabold mb-4">إضافة عميل</h1>
      <div className="bg-white rounded-xl border border-line p-5">
        {Field("الاسم *", "name")}
        {Field("موبايل ١", "phone1", true)}
        {Field("موبايل ٢", "phone2", true)}
        {Field("الإيميل", "email", true)}
        {Field("الشركة", "company")}
        {err && <div className="text-red-600 text-sm mb-3">{err}</div>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="bg-brand text-white rounded-lg px-5 py-2.5 font-bold hover:bg-brand-dark disabled:opacity-60">
            {saving ? "..." : "حفظ"}
          </button>
          <button onClick={() => router.back()}
            className="border border-line rounded-lg px-5 py-2.5 font-bold text-muted hover:bg-gray-50">
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}
