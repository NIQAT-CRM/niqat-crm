"use client";
import { useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Spec = { id: string; name_ar: string };
type C = {
  id: string; name: string; phone1: string | null; phone2: string | null;
  email: string | null; company: string | null; residency: string | null;
  grad_year: number | null; stage: string; specialty_id: string | null;
  lms_status: string | null; source: string | null; affiliate_code: string | null; created_at: string;
  terms_signed?: boolean | null; terms_signed_at?: string | null;
};

const STAGES = [
  { key: "new", label: "جديد" },
  { key: "contacted", label: "تم التواصل" },
  { key: "interested", label: "مهتم" },
  { key: "quote", label: "عرض سعر مُرسل" },
  { key: "negotiation", label: "تفاوض" },
  { key: "onhold", label: "معلّق" },
  { key: "enrolled", label: "مسجّل / دفع" },
  { key: "lost", label: "مؤجل / مرفوض" },
];

function engUpper(v: string) { return v.replace(/[\u0600-\u06FF]/g, "").toUpperCase(); }
const hasAr = (v: string) => /[\u0600-\u06FF]/.test(v);

export type CustomerEditHandle = { save: () => Promise<void> };

const fld = "flex flex-col gap-1.5";
const lbl = "text-[11px] font-bold text-muted uppercase tracking-wide";
const inp = "w-full h-[42px] px-3.5 rounded-xl border border-line bg-surface text-ink text-[14px] font-num transition-all duration-150 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10";
const sel = inp + " appearance-none cursor-pointer";
const errCls = "text-[13px] text-red bg-red/5 rounded-xl px-4 py-2.5 border border-red/10";
const okCls = "text-[13px] text-green bg-green/5 rounded-xl px-4 py-2.5 border border-green/10";

const CustomerEdit = forwardRef<CustomerEditHandle, { customer: C; specialties: Spec[] }>(({ customer, specialties }, ref) => {
  const router = useRouter();
  const supabase = createClient();
  const [f, setF] = useState({
    name: customer.name || "", phone1: customer.phone1 || "", phone2: customer.phone2 || "",
    email: customer.email || "", company: customer.company || "", residency: customer.residency || "",
    grad_year: customer.grad_year ? String(customer.grad_year) : "",
    specialty_id: customer.specialty_id || "", stage: customer.stage || "new",
    affiliate_code: customer.affiliate_code || "",
    source: customer.source || "", lms_status: customer.lms_status || "",
  });
  const [terms, setTerms] = useState(!!customer.terms_signed);
  const [termsAt, setTermsAt] = useState(customer.terms_signed_at || "");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const set = useCallback((k: string, v: string) => setF((s) => ({ ...s, [k]: v })), []);
  const onName = useCallback((v: string) => setF((s) => ({ ...s, name: engUpper(v) })), []);

  const toggleTerms = useCallback(async () => {
    const next = !terms;
    const at = next ? new Date().toISOString() : "";
    setTerms(next); setTermsAt(at);
    await supabase.from("customers").update({ terms_signed: next, terms_signed_at: at || null }).eq("id", customer.id);
  }, [terms, supabase, customer.id]);

  const save = useCallback(async () => {
    setErr(""); setMsg("");
    if (!f.name.trim()) { setErr("الاسم مطلوب"); return; }
    if (hasAr(f.name)) { setErr("اسم العميل لازم يكون إنجليزي فقط."); return; }
    const { error } = await supabase.from("customers").update({
      name: f.name.trim().toUpperCase(), phone1: f.phone1.trim() || null, phone2: f.phone2.trim() || null,
      email: f.email.trim() || null, company: f.company.trim() || null, residency: f.residency.trim() || null,
      grad_year: f.grad_year ? Number(f.grad_year) : null,
      specialty_id: f.specialty_id || null, stage: f.stage,
      affiliate_code: f.affiliate_code.trim(), source: f.source.trim(), lms_status: f.lms_status,
    }).eq("id", customer.id);
    if (error) {
      setErr((error as any).code === "23505" ? "الموبايل أو الإيميل ده موجود عند عميل تاني." : "حصل خطأ: " + error.message);
      return;
    }
    setMsg("اتحفظ ✓");
    router.refresh();
  }, [f, supabase, customer.id, router]);

  useImperativeHandle(ref, () => ({ save }), [save]);

  const wa = (ph: string | null) => {
    if (!ph) return null;
    const d = ph.replace(/\D/g, "");
    if (!d) return null;
    return "https://wa.me/" + (d.startsWith("0") ? "20" + d.slice(1) : d);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* === BASIC === */}
      <Section title="البيانات الأساسية">
        <div className="grid grid-cols-2 gap-4">
          <div className={fld}>
            <label className={lbl}>الاسم <span className="text-brand/60">(إنجليزي)</span></label>
            <input className={inp + " font-num"} dir="ltr" value={f.name}
              onChange={(e) => onName(e.target.value)} placeholder="AHMED ALI" />
          </div>
          <div className={fld}>
            <label className={lbl}>المرحلة</label>
            <select className={sel} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={fld}>
            <label className={lbl}>الموبايل 1</label>
            <input className={inp + " font-num"} dir="ltr" value={f.phone1}
              onChange={(e) => set("phone1", e.target.value)} />
          </div>
          <div className={fld}>
            <label className={lbl}>الموبايل 2</label>
            <input className={inp + " font-num"} dir="ltr" value={f.phone2}
              onChange={(e) => set("phone2", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={fld}>
            <label className={lbl}>الإيميل</label>
            <input className={inp + " font-num"} dir="ltr" value={f.email}
              onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className={fld}>
            <label className={lbl}>الشركة</label>
            <input className={inp} value={f.company}
              onChange={(e) => set("company", e.target.value)} />
          </div>
        </div>
      </Section>

      {/* === SALES === */}
      <Section title="معلومات المبيعات">
        <div className="grid grid-cols-2 gap-4">
          <div className={fld}>
            <label className={lbl}>التخصص الهندسي</label>
            <select className={sel} value={f.specialty_id} onChange={(e) => set("specialty_id", e.target.value)}>
              <option value="">— غير محدد —</option>
              {specialties.map((s) => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
            </select>
          </div>
          <div className={fld}>
            <label className={lbl}>سنة التخرج</label>
            <input className={inp + " font-num"} dir="ltr" inputMode="numeric" value={f.grad_year}
              onChange={(e) => set("grad_year", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={fld}>
            <label className={lbl}>محل الإقامة</label>
            <input className={inp} value={f.residency}
              onChange={(e) => set("residency", e.target.value)} />
          </div>
          <div className={fld}>
            <label className={lbl}>كود الأفيلييت</label>
            <input className={inp + " font-num"} dir="ltr" value={f.affiliate_code}
              onChange={(e) => set("affiliate_code", e.target.value)} placeholder="اختياري" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className={fld}>
            <label className={lbl}>مصدر العميل</label>
            <input className={inp} value={f.source}
              onChange={(e) => set("source", e.target.value)} placeholder="فيسبوك / إحالة / إعلان…" />
          </div>
          <div className={fld}>
            <label className={lbl}>حالة المنصة (LMS)</label>
            <select className={sel} value={f.lms_status} onChange={(e) => set("lms_status", e.target.value)}>
              <option value="">— غير محدّد —</option>
              <option value="active">مفعّلة</option>
              <option value="pending">قيد التفعيل</option>
              <option value="none">غير مفعّلة</option>
            </select>
          </div>
        </div>
      </Section>

      {/* === TERMS === */}
      <Section title="الشروط والأحكام">
        <div className={"flex items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-all duration-200 " +
          (terms ? "border-green/20 bg-green/[0.04]" : "border-line bg-surface")}>
          <button type="button" onClick={toggleTerms}
            className={"relative w-[42px] h-[24px] rounded-full transition-colors duration-200 flex-shrink-0 " +
              (terms ? "bg-green" : "bg-[#CFD6E2]")}>
            <span className={"absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-200 " +
              (terms ? "left-[21px]" : "left-[3px]")} />
          </button>
          <div className="flex-1 min-w-0">
            <div className={"text-[13.5px] font-bold " + (terms ? "text-green" : "text-ink")}>
              {terms ? "✓ العميل أمضى على الشروط والأحكام" : "لم يمضِ على الشروط والأحكام بعد"}
            </div>
            {terms && termsAt && (
              <div className="text-[11.5px] text-muted font-num mt-0.5">
                {String(termsAt).replace("T", " ").slice(0, 16)}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* === META === */}
      <div className="flex items-center justify-between text-[12px] text-muted/70 px-0.5">
        <span>تاريخ الإضافة: <span className="text-muted font-medium">{new Date(customer.created_at).toLocaleDateString("ar-EG")}</span></span>
        {wa(f.phone1) && (
          <a href={wa(f.phone1)!} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-wa hover:text-wa/80 font-bold text-[13px] transition-colors">
            <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.6-4A8 8 0 1 1 20 11.5z"/></svg>
            واتساب
          </a>
        )}
      </div>

      {err && <div className={errCls}>{err}</div>}
      {msg && <div className={okCls}>{msg}</div>}
    </div>
  );
});

CustomerEdit.displayName = "CustomerEdit";
export default CustomerEdit;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <span className="w-[3px] h-[16px] rounded-full bg-brand" />
        <span className="text-[12px] font-extrabold text-brand tracking-wide">{title}</span>
        <span className="flex-1 h-px bg-line" />
      </div>
      {children}
    </div>
  );
}
