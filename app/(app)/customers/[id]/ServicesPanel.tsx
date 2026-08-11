"use client";
import { confirmDialog } from "@/lib/confirm";
import { createPortal } from "react-dom";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";
import FileDrop from "@/lib/ui/FileDrop";
import SearchSelect from "../../SearchSelect";

type Opt = { v: string; label: string; dip?: string; status?: string; done?: boolean; price?: number; currency?: string; price_egp?: number; price_usd?: number };
type Enr = { id: string; diploma: string; batch: string; diplomaId: string; batchId: string; transferCount: number; status?: string };
type Addon = { id: string; type: string; name: string; amount: number; free: boolean; note: string; paid: boolean; shot_url?: string };

const SV_TYPES = [
  { key: "diploma", labelKey: "svTypeDiploma", color: "#F08A24", icon: "📜" },
  { key: "accred", labelKey: "svTypeAccred", color: "#7B61FF", icon: "✅" },
  { key: "project", labelKey: "svTypeProject", color: "#0FA3A3", icon: "📋" },
  { key: "library", labelKey: "svTypeLibrary", color: "#E6A700", icon: "📚" },
];
const stMeta = (k: string) => SV_TYPES.find((t) => t.key === k) || { key: k, labelKey: "serviceWord", color: "#2F6BFF", icon: "🔧" };

export default function ServicesPanel({
  customerId, meId, enrolls, dipOpts, batchOpts, addons, accreditations, projects, libraries, canFinance, serviceTypes = [], serviceItemsByType = {}, myTeam = "", stage = "",
}: {
  customerId: string; meId: string; enrolls: Enr[];
  dipOpts: Opt[]; batchOpts: Opt[]; addons: Addon[];
  accreditations: string[]; projects: string[]; libraries: string[]; canFinance: boolean;
  myTeam?: string; stage?: string;
  serviceTypes?: { slug: string; name: string }[];
  serviceItemsByType?: Record<string, { code: string; price_egp: number; price_usd: number }[]>;
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [svType, setSvType] = useState("diploma");
  const [svDip, setSvDip] = useState("");
  // تغيير الدبلومة/الباتش لاشتراك غير مدفوع
  const [dipEditFor, setDipEditFor] = useState<string | null>(null);
  const [edDip2, setEdDip2] = useState("");
  const [edBatch2, setEdBatch2] = useState("");
  const notPaid = stage !== "enrolled";
  async function saveDipChange(e: any) {
    setBusy(true);
    const { error } = await supabase.from("enrollments").update({ diploma_id: edDip2 || e.diplomaId, batch_id: edBatch2 || null }).eq("id", e.id);
    setBusy(false);
    if (error) return toast(tr("saveFailed") + error.message);
    setDipEditFor(null); toast(tr("updated")); router.refresh();
  }
  const [svBatch, setSvBatch] = useState("");
  const [svName, setSvName] = useState("");
  const [svAmount, setSvAmount] = useState("");
  const [svCurrency, setSvCurrency] = useState("EGP");
  const [svFree, setSvFree] = useState(false);
  const [svNote, setSvNote] = useState("");
  const [svPaid, setSvPaid] = useState(false);
  const [svNeedsAct, setSvNeedsAct] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [moveAnchor, setMoveAnchor] = useState<DOMRect | null>(null);
  const movePopRef = useRef<HTMLDivElement>(null);
  const [movePos, setMovePos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!moveFor) { setMovePos(null); return; }
    const el = movePopRef.current; if (!el) return;
    const pw = el.offsetWidth, ph = el.offsetHeight, m = 12; const r = moveAnchor;
    let left: number, top: number;
    if (r) { left = r.left + r.width / 2 - pw / 2; top = r.top - ph - 8; if (top < m) top = r.bottom + 8; }
    else { left = (window.innerWidth - pw) / 2; top = (window.innerHeight - ph) / 2; }
    left = Math.min(Math.max(m, left), window.innerWidth - pw - m);
    top = Math.min(Math.max(m, top), window.innerHeight - ph - m);
    setMovePos({ top, left });
  }, [moveFor, moveAnchor]);
  const [moveTo, setMoveTo] = useState("");
  const [moveFee, setMoveFee] = useState("");
  const [moveCur, setMoveCur] = useState("EGP");
  const [moveGift, setMoveGift] = useState(false);
  const [moveFile, setMoveFile] = useState<File | null>(null);

  const typeOpts = [
    { key: "diploma", label: tr("svTypeDiploma"), icon: "📜" },
    ...serviceTypes.map((t) => ({ key: t.slug, label: t.name, icon: "🔧" })),
  ];
  const svNames = svType === "diploma" ? dipOpts
    : svType === "library" ? libraries.map((n) => ({ v: n, label: n }))
    : (serviceItemsByType[svType] || []).map((n) => ({ v: n.code, label: n.code }));
  const batchLabel = (id: string) => batchOpts.find((b) => b.v === id)?.label || "—";

  // بند 5: ملء المبلغ تلقائياً من سعر الباتش بالعملة المختارة (قابل للتعديل)
  useEffect(() => {
    if (!svBatch) return;
    const b = batchOpts.find((x) => x.v === svBatch);
    if (!b) return;
    const p = svCurrency === "USD" ? Number(b.price_usd) : Number(b.price_egp);
    if (p > 0) setSvAmount(String(p));
  }, [svBatch, svCurrency]);

  // ملء المبلغ تلقائياً من سعر عنصر الخدمة المختار
  useEffect(() => {
    if (svType === "diploma" || svType === "library" || !svName) return;
    const it = (serviceItemsByType[svType] || []).find((x) => x.code === svName);
    if (!it) return;
    const p = svCurrency === "USD" ? Number(it.price_usd) : Number(it.price_egp);
    if (p > 0) setSvAmount(String(p));
  }, [svName, svType, svCurrency]);

  async function logAudit(action: string, detail: string) {
    await supabase.from("audit_log").insert({ customer_id: customerId, actor_id: meId || null, action, detail });
  }

  async function uploadShot(amount?: number, currency?: string): Promise<string> {
    if (!file) return "";
    const path = `services/${customerId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { toast(tr("screenshotUploadFailed")); return ""; }
    const url = path; // نخزّن الـ path
    // نخزّن المبلغ والعملة عشان يظهر في الإيصالات بالمبلغ الصح
    await supabase.from("customer_docs").insert({ customer_id: customerId, url, name: `${tr("svPaymentProof")} — (${file.name})`, ...(amount != null && amount > 0 ? { amount } : {}), ...(currency ? { currency } : {}) });
    return url;
  }

  async function addService() {
    if (svType === "diploma" && !svDip) { toast(tr("selectDiploma")); return; }
    if (svType !== "diploma" && !svName) { toast(tr("selectItem")); return; }
    setBusy(true);
    const amt = svFree ? 0 : Number(svAmount) || 0;
    // الاسكرين يترفع دايماً لو فيه ملف (مش متوقّف على toggle «مدفوع») — بالمبلغ والعملة
    const shot_url = file ? await uploadShot(amt, svCurrency) : "";
    // لو فيه اسكرين تحويل + مبلغ → دي دفعة فعلية: تتعلّم «مدفوعة» تلقائياً
    const isPaid = svPaid || (!!shot_url && amt > 0);
    const label = svType === "diploma" ? (dipOpts.find((d) => d.v === svDip)?.label || "—") : svName;

    if (svType === "diploma") {
      const { data: ins, error } = await supabase.from("enrollments")
        .insert({ customer_id: customerId, diploma_id: svDip, batch_id: svBatch || null, status: "active", needs_activation: svNeedsAct })
        .select("id").maybeSingle();
      if (error || !ins) { setBusy(false); toast(tr("addDiplomaFailed")); return; }
      if (canFinance && amt > 0) {
        await supabase.from("enrollment_finance").insert({ enrollment_id: ins.id, agreed_amount: amt, currency: svCurrency, screenshot_url: null });
        // نعمل قسط مدفوع لو فيه اسكرين تحويل — عشان يتحسب محصّل ويظهر في الإيصالات (مرة واحدة)
        if (shot_url) {
          await supabase.from("installments").insert({ enrollment_id: ins.id, amount: amt, currency: svCurrency, status: "paid", paid_at: new Date().toISOString(), screenshot_url: shot_url });
        }
      }
      await logAudit("enrollment_add", `${tr("auditEnrollmentAdd")}: ${label}${svBatch ? " — " + batchLabel(svBatch) : ""}`);
    } else {
      const { data, error } = await supabase.from("customer_addons").insert({
        customer_id: customerId, type: svType, name: label, amount: amt, free: svFree, note: svNote.trim(), paid: isPaid, shot_url: shot_url || null, currency: svCurrency, needs_activation: svNeedsAct,
      }).select("id").single();
      if (error) { setBusy(false); toast(tr("addFailed") + error.message); return; }
      await logAudit("addon_add", `${tr("auditAddonAdd")} ${tr(stMeta(svType).labelKey)}: ${label}`);
    }

    setBusy(false); setOpen(false);
    setSvDip(""); setSvBatch(""); setSvName(""); setSvAmount(""); setSvNote(""); setFile(null); setSvFree(false); setSvPaid(false); setSvNeedsAct(false);
    toast(tr("serviceAdded")); router.refresh();
  }

  function resetMove() { setMoveFor(null); setMoveTo(""); setMoveFee(""); setMoveCur("EGP"); setMoveGift(false); setMoveFile(null); }

  // كيبورد: ESC يقفل نافذة النقل أو نافذة إضافة الخدمة
  useEffect(() => {
    if (!moveFor && !open) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { if (moveFor) resetMove(); if (open) setOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveFor, open]);

  async function doMove(e: Enr) {
    if (!moveTo || moveTo === e.batchId) { toast(tr("selectTargetBatch")); return; }
    const fee = Number(moveFee) || 0;
    if (!moveGift && fee <= 0) { toast(tr("enterTransferFee")); return; }
    setBusy(true);

    // 1) رفع اسكرين التحويل (لو مرفوع)
    let shotUrl = "";
    if (!moveGift && moveFile) {
      const path = `transfers/${customerId}/${Date.now()}-${moveFile.name}`;
      const up = await supabase.storage.from("receipts").upload(path, moveFile, { upsert: false });
      if (up.error) { setBusy(false); toast(tr("screenshotUploadFailed")); return; }
      shotUrl = path;
      await supabase.from("customer_docs").insert({ customer_id: customerId, url: path, name: `${tr("transferFeeProof")} — (${moveFile.name})` });
    }

    // 2) رسوم النقل كقسط مدفوع (يدخل التحصيل) — إلا لو هدية
    if (!moveGift && fee > 0) {
      const { error: finErr } = await supabase.from("installments").insert({
        enrollment_id: e.id, amount: fee, currency: moveCur, status: "paid",
        paid_at: new Date().toISOString(), screenshot_url: shotUrl || null,
      });
      if (finErr) { setBusy(false); toast(tr("transferFailed")); return; }
    }

    // 3) طلب النقل — مابنغيّرش الباتش هنا. الدعم هو اللي يأكّد من صفحة التفعيل/التسليم.
    const fromLabel = e.batch || batchLabel(e.batchId);
    const toLabel = batchLabel(moveTo);
    const feeText = moveGift ? tr("transferGiftNote") : `${tr("transferFeeLabel")}: ${fee} ${moveCur === "USD" ? "$" : tr("egpShort")}`;
    const { error: hErr } = await supabase.from("handoffs").insert({
      customer_id: customerId, created_by: meId || null, status: "pending", kind: "batch_transfer",
      note: `${e.diploma}: ${fromLabel} → ${toLabel} · ${feeText}`,
      meta: { enrollment_id: e.id, target_batch_id: moveTo, from_label: fromLabel, to_label: toLabel, diploma: e.diploma, gift: moveGift, fee, currency: moveCur },
    });
    if (hErr) { setBusy(false); toast(tr("transferFailed")); return; }

    // 4) تسجيل في التايم لاين (طلب — مش تنفيذ)
    await logAudit("batch_transfer_requested", `${e.diploma}: ${tr("auditBatchTransfer")} ${fromLabel} → ${toLabel}${moveGift ? " (" + tr("giftWord") + ")" : " — " + tr("transferFeeLabel") + " " + fee + " " + (moveCur === "USD" ? "$" : tr("egpShort"))}`);

    setBusy(false); resetMove();
    toast(tr("transferRequestSent")); router.refresh();
  }

  // نقل مباشر مجاني (النقلة الأولى — الدعم/الأدمن فقط): يغيّر الباتش فوراً بدون رسوم/طلب/تذكرة.
  // الحماية والعدّاد على مستوى قاعدة البيانات (trigger): لو حد غير الدعم/الأدمن → القاعدة بترفض.
  async function doDirectTransfer(e: Enr) {
    if (!moveTo || moveTo === e.batchId) { toast(tr("selectTargetBatch")); return; }
    setBusy(true);
    const fromLabel = e.batch || batchLabel(e.batchId);
    const toLabel = batchLabel(moveTo);
    const { error } = await supabase.from("enrollments").update({ batch_id: moveTo }).eq("id", e.id);
    if (error) { setBusy(false); toast(tr("transferFailed")); return; }
    await logAudit("batch_transfer_confirmed", `${e.diploma}: ${tr("auditBatchTransfer")} ${fromLabel} → ${toLabel} (${tr("firstFreeTransfer")})`);
    setBusy(false); resetMove();
    toast(tr("transferDone")); router.refresh();
  }

  async function togglePaid(a: Addon) {
    const next = !a.paid;
    const { error } = await supabase.from("customer_addons").update({ paid: next }).eq("id", a.id);
    if (error) { toast(tr("updateFailedShort")); return; }
    toast(next ? tr("markedPaid") : tr("paymentCancelled")); router.refresh();
  }

  async function delAddon(a: Addon) {
    if (!await confirmDialog(`${tr("deleteQ")} «${a.name}»؟`, true)) return;
    await supabase.from("customer_addons").delete().eq("id", a.id);
    toast(tr("deleted")); router.refresh();
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="sec-t" style={{ margin: 0 }}>{tr("servicesTitle")}</div>
        <button onClick={() => setOpen((v) => !v)} className={open ? "btn ghost" : "btn"} style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
          {open ? tr("close") : "＋ " + tr("addServiceBtn")}
        </button>
      </div>

      {open && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, margin: "12px 0", background: "var(--surface)" }}>
          <div className="frow">
            <div className="fld"><label>{tr("serviceType")}</label>
              <select className="inp" value={svType} onChange={(e) => { setSvType(e.target.value); setSvName(""); setSvDip(""); }}>
                {typeOpts.map((t) => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
              </select></div>
            <div className="fld"><label>{svType === "diploma" ? tr("theDiploma") : tr("theItem")}</label>
              {svType === "diploma" ? (
                <SearchSelect
                  options={dipOpts.map((d) => ({ value: d.v, label: d.label }))}
                  value={svDip} onChange={(v) => { setSvDip(v); setSvBatch(""); }}
                  placeholder={tr("selectDiploma")} emptyLabel={tr("selectDiploma")} searchPlaceholder={tr("searchDots")}
                />
              ) : (
                <SearchSelect
                  options={svNames.map((n) => ({ value: n.v, label: n.label }))}
                  value={svName} onChange={(v) => setSvName(v)}
                  placeholder={tr("selectDash")} emptyLabel={tr("selectDash")} searchPlaceholder={tr("searchDots")}
                />
              )}
            </div>
          </div>

          {svType === "diploma" && (
            <div className="frow">
              <div className="fld"><label>{tr("theBatch")}</label>
                <SearchSelect
                  options={batchOpts.filter((b) => b.dip === svDip && b.status === "open" && !b.done).map((b) => ({ value: b.v, label: b.label }))}
                  value={svBatch} onChange={(v) => setSvBatch(v)}
                  placeholder={tr("noBatch")} emptyLabel={tr("noBatch")} searchPlaceholder={tr("searchDots")}
                /></div>
            </div>
          )}

          <label className="chkrow"><input type="checkbox" checked={svFree} onChange={(e) => setSvFree(e.target.checked)} /> {tr("freeGift")}</label>

          <label className="chkrow" style={{ background: svNeedsAct ? "rgba(24,169,87,.08)" : "transparent", borderRadius: 8, padding: svNeedsAct ? "6px 8px" : "0" }}>
            <input type="checkbox" checked={svNeedsAct} onChange={(e) => setSvNeedsAct(e.target.checked)} />
            🎯 {tr("svNeedsActivation")}
          </label>

          {canFinance && !svFree && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginTop: 8, background: "rgba(24,169,87,.04)" }}>
              <div className="frow" style={{ alignItems: "end" }}>
                <div className="fld" style={{ margin: 0 }}><label>{tr("agreedAmount")}</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="inp num" dir="ltr" style={{ flex: 1 }} value={svAmount} onChange={(e) => setSvAmount(e.target.value)} placeholder={tr("amountPh")} />
                    <select className="inp" style={{ width: 70 }} value={svCurrency} onChange={(e) => setSvCurrency(e.target.value)}>
                      <option value="EGP">{tr("egpShort")}</option><option value="USD">$</option>
                    </select>
                  </div>
                </div>
                <div className="fld" style={{ margin: 0 }}><label>{tr("paymentProof")}</label>
                  <FileDrop value={file} onFile={setFile} onClear={() => setFile(null)} accept="image/*" label={tr("uploadTransferShot")} />
                </div>
              </div>
            </div>
          )}

          {svType !== "diploma" && (
            <div className="fld" style={{ marginTop: 8 }}><label>{tr("note")}</label><input className="inp" value={svNote} onChange={(e) => setSvNote(e.target.value)} /></div>
          )}

          {svType !== "diploma" && (
            <label className="chkrow"><input type="checkbox" checked={svPaid} onChange={(e) => setSvPaid(e.target.checked)} /> {tr("paidHandoffHint")}</label>
          )}

          <button onClick={addService} disabled={busy} className="btn" style={{ marginTop: 10, width: "100%" }}>{busy ? "..." : tr("addServiceSubmit")}</button>
        </div>
      )}

      {/* الدبلومات (الاشتراكات النشطة فقط — المستردة بتختفي وتظهر في التايم لاين) */}
      {enrolls.filter((e) => e.status !== "refunded").length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>{tr("diplomas")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,300px))", gap: 8, alignItems: "start", justifyContent: "start" }}>
          {enrolls.filter((e) => e.status !== "refunded").map((e) => {
            const m = stMeta("diploma");
            const moving = moveFor === e.id;
            return (
              <div key={e.id} style={{ gridColumn: moving ? "1 / -1" : "auto", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: m.color + "1a", color: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{m.icon}</span>
                  <span className="chip" style={{ background: m.color + "1a", color: m.color }}>{tr(m.labelKey)}</span>
                  <span style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--green)", display: "flex", alignItems: "center", gap: 3 }}>● {tr("active")}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.diploma}
                  {notPaid && (
                    <button title={tr("changeDiploma")} onClick={() => { const o = dipEditFor !== e.id; setDipEditFor(o ? e.id : null); setEdDip2(o ? e.diplomaId : ""); setEdBatch2(o ? (e.batchId || "") : ""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", marginInlineStart: 6, verticalAlign: "middle" }}>
                      <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                    </button>
                  )}
                </div>
                {dipEditFor === e.id && (
                  <div style={{ gridColumn: "1 / -1", border: "1px solid var(--brand)", background: "var(--brand-soft)", borderRadius: 9, padding: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--brand-d)" }}>✎ {tr("changeDiploma")}</div>
                    <div>
                      <label style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>{tr("diploma")}</label>
                      <select className="inp" value={edDip2} onChange={(ev) => { setEdDip2(ev.target.value); setEdBatch2(""); }} style={{ width: "100%", height: 36 }}>
                        {dipOpts.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>{tr("batch")}</label>
                      <select className="inp" value={edBatch2} onChange={(ev) => setEdBatch2(ev.target.value)} style={{ width: "100%", height: 36 }}>
                        <option value="">{tr("selectDash")}</option>
                        {batchOpts.filter((b) => (!edDip2 || b.dip === edDip2) && b.status === "open" && !b.done).map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveDipChange(e)} disabled={busy} className="btn" style={{ height: 32, padding: "0 12px", fontSize: 12 }}>{busy ? "..." : tr("saveChanges")}</button>
                      <button onClick={() => setDipEditFor(null)} className="btn ghost" style={{ height: 32, padding: "0 10px", fontSize: 12 }}>{tr("cancel")}</button>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "var(--muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr("batchColon")} <span className="num">{e.batch}</span></span>
                  <button onClick={(ev) => { if (moveFor === e.id) { resetMove(); } else { const r = ev.currentTarget.getBoundingClientRect(); resetMove(); setMoveFor(e.id); setMoveAnchor(r); setMoveTo(""); } }}
                    style={{ color: "var(--brand)", fontWeight: 700, fontSize: 12, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
                    {tr("moveTransfer")}
                  </button>
                </div>
                {moving && (() => {
                  const isSupport = myTeam === "support" || myTeam === "admin";
                  const isFirst = (e.transferCount || 0) === 0;
                  const openB = batchOpts.filter((b) => b.dip === e.diplomaId && b.status === "open" && !b.done && b.v !== e.batchId);
                  const batchPicker = (
                    <>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>{tr("diplomaWord")}</label>
                        <select className="inp" style={{ width: "100%", height: 38, opacity: 0.65, cursor: "not-allowed", background: "var(--bg)" }} value="__locked" disabled title={tr("diplomaNotTransferable")}>
                          <option value="__locked">{e.diploma}</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>{tr("targetBatch")}</label>
                        {openB.length > 0 ? (
                          <select className="inp" style={{ width: "100%", height: 38 }} value={moveTo} onChange={(ev) => setMoveTo(ev.target.value)}>
                            <option value="">{tr("selectTargetBatch")}</option>
                            {openB.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
                          </select>
                        ) : (
                          <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "8px 10px", border: "1px dashed var(--line)", borderRadius: 8 }}>{tr("noOpenBatchesSameDip")}</div>
                        )}
                      </div>
                    </>
                  );
                  const box = (children: React.ReactNode) => (typeof document === "undefined" ? null : createPortal(
                    <div onClick={resetMove} style={{ position: "fixed", inset: 0, background: "rgba(4,10,22,.35)", zIndex: 200 }}>
                      <div ref={movePopRef} onClick={(ev) => ev.stopPropagation()} style={{ position: "fixed", top: movePos?.top ?? -9999, left: movePos?.left ?? -9999, visibility: movePos ? "visible" : "hidden", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.35)", width: "min(440px,calc(100vw - 24px))", maxHeight: "88vh", overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 15 }}>{tr("moveTransfer")}</div>
                          <button type="button" onClick={resetMove} aria-label={tr("close")} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9, width: 30, height: 30, cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1 }}>×</button>
                        </div>
                        {children}
                      </div>
                    </div>,
                    document.body
                  ));
                  const noteBox = (text: string) => box(<>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>{text}</div>
                    <div><button className="btn ghost" onClick={resetMove} style={{ height: 36, padding: "0 14px" }}>{tr("close")}</button></div>
                  </>);

                  // (١) أول نقلة + دعم/أدمن → نقل مباشر مجاني
                  if (isFirst && isSupport) {
                    return box(<>
                      <div style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 800, color: "var(--green)", background: "var(--green-soft)", border: "1px solid var(--green)", borderRadius: 20, padding: "3px 11px" }}>{tr("firstFreeTransfer")}</div>
                      {batchPicker}
                      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>{tr("firstTransferFreeNote")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={() => doDirectTransfer(e)} disabled={busy || !moveTo} style={{ height: 38, flex: 1 }}>{busy ? "..." : tr("confirmFreeTransfer")}</button>
                        <button className="btn ghost" onClick={resetMove} style={{ height: 38, padding: "0 14px" }}>{tr("cancel")}</button>
                      </div>
                    </>);
                  }
                  // (٢) أول نقلة + مبيعات → مش مسموح (الدعم بيعملها)
                  if (isFirst && !isSupport) return noteBox(tr("salesCannotFirstTransfer"));
                  // (٣) من التانية + مبيعات → طلب نقل مدفوع (المسار الحالي)
                  if (!isFirst && !isSupport) {
                    return box(<>
                      {batchPicker}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 4 }}>{tr("transferFeeLabel")}</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input className="inp num" dir="ltr" placeholder="0" style={{ flex: 1, height: 38 }} value={moveFee} onChange={(ev) => setMoveFee(ev.target.value)} />
                          <select className="inp" style={{ width: 84, height: 38 }} value={moveCur} onChange={(ev) => setMoveCur(ev.target.value)}>
                            <option value="EGP">{tr("egpShort")}</option><option value="USD">$</option>
                          </select>
                        </div>
                      </div>
                      <FileDrop compact value={moveFile} onFile={setMoveFile} onClear={() => setMoveFile(null)} accept="image/*" label={tr("uploadTransferShot")} />
                      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>{tr("transferHint")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn" onClick={() => doMove(e)} disabled={busy} style={{ height: 38, flex: 1 }}>{busy ? "..." : tr("requestTransfer")}</button>
                        <button className="btn ghost" onClick={resetMove} style={{ height: 38, padding: "0 14px" }}>{tr("cancel")}</button>
                      </div>
                    </>);
                  }
                  // (٤) من التانية + دعم → لازم طلب مدفوع من المبيعات، والتأكيد من صفحة التفعيل
                  return noteBox(tr("supportPaidTransferNote"));
                })()}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* الإضافات (اعتماد / مشروع / مكتبة) */}
      {addons.length > 0 && (
        <div style={{ marginTop: enrolls.length > 0 ? 12 : 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>{tr("addonsLabel")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,300px))", gap: 8, alignItems: "start", justifyContent: "start" }}>
          {addons.map((a) => {
            const m = stMeta(a.type);
            return (
              <div key={a.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: m.color + "1a", color: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{m.icon}</span>
                  <span className="chip" style={{ background: m.color + "1a", color: m.color }}>{tr(m.labelKey)}</span>
                  <span style={{ marginInlineStart: "auto", fontSize: 11, color: a.paid ? "var(--green)" : "var(--amber, #E6A700)", display: "flex", alignItems: "center", gap: 3 }}>● {a.paid ? tr("paid") : tr("unpaid")}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.name}{a.free && <span style={{ color: "var(--green)", fontSize: 11, marginInlineStart: 6 }}>🎁 {tr("free")}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {canFinance && !a.free && <span className="num" dir="ltr" style={{ fontSize: 12.5, color: "var(--muted)" }}>{new Intl.NumberFormat("en").format(a.amount)} {(a as any).currency === "USD" ? "$" : tr("egpShort")}</span>}
                  {a.shot_url && <a href={a.shot_url} target="_blank" rel="noreferrer" title={tr("paymentProof")} style={{ color: "var(--blue)", fontSize: 13 }}>🧾</a>}
                  <div className={"sw" + (a.paid ? " on" : "")} onClick={() => togglePaid(a)} title={a.paid ? tr("paid") : tr("unpaid")} style={{ marginInlineStart: "auto" }}><i /></div>
                  <button onClick={() => delAddon(a)} title={tr("delete")} style={{ color: "var(--red)", fontSize: 13, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>✕</button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {enrolls.length === 0 && addons.length === 0 && !open && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{tr("noServices")}</div>
      )}
    </div>
  );
}
