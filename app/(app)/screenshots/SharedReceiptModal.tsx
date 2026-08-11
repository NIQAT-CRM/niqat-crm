"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";

type Alloc = { customerId: string; customerName: string; phone: string; amount: string };

export default function SharedReceiptModal({ onClose }: { onClose: () => void }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [currency, setCurrency] = useState("EGP");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Alloc[]>([{ customerId: "", customerName: "", phone: "", amount: "" }]);
  const [busy, setBusy] = useState(false);

  // بحث العملاء لكل صف
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const tmr = useRef<any>(null);

  const previewUrl = file && file.type.startsWith("image/") ? URL.createObjectURL(file) : "";

  const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const nf = new Intl.NumberFormat("en");

  const doSearch = useCallback((q: string) => {
    setQuery(q);
    if (tmr.current) clearTimeout(tmr.current);
    if (!q.trim()) { setResults([]); return; }
    tmr.current = setTimeout(async () => {
      setSearching(true);
      const digits = q.replace(/\D/g, "");
      let qb = supabase.from("customers").select("id,name,phone1,phone2").eq("deleted", false).limit(8);
      qb = digits.length >= 4
        ? qb.or(`name.ilike.%${q}%,phone1.ilike.%${digits}%,phone2.ilike.%${digits}%`)
        : qb.ilike("name", `%${q}%`);
      const { data } = await qb;
      setResults((data as any[]) || []);
      setSearching(false);
    }, 250);
  }, [supabase]);

  function pickCustomer(idx: number, c: any) {
    setRows((rs) => rs.map((r, i) => i === idx ? { ...r, customerId: c.id, customerName: c.name || "—", phone: c.phone1 || "" } : r));
    setOpenIdx(null); setQuery(""); setResults([]);
  }
  function setAmount(idx: number, v: string) { setRows((rs) => rs.map((r, i) => i === idx ? { ...r, amount: v } : r)); }
  function addRow() { setRows((rs) => [...rs, { customerId: "", customerName: "", phone: "", amount: "" }]); }
  function removeRow(idx: number) { setRows((rs) => rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs); }

  async function submit() {
    if (!file) return toast(tr("shrAddScreenshot"));
    const valid = rows.filter((r) => r.customerId && (parseFloat(r.amount) || 0) > 0);
    if (!valid.length) return toast(tr("shrAddOneCustomer"));
    setBusy(true);
    try {
      // 1) رفع الاسكرين لباكت الإيصالات
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `shared/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
      if (up.error) { setBusy(false); return toast(tr("imgUploadFailed")); }

      // 2) إنشاء الإيصال + التوزيعات + تعليم الأقساط (RPC واحد في transaction)
      const p_allocations = valid.map((r) => ({ customer_id: r.customerId, amount: Number(r.amount), currency }));
      const { error } = await supabase.rpc("create_shared_receipt", {
        p_url: path, p_currency: currency, p_note: note.trim(), p_allocations,
      });
      if (error) { setBusy(false); return toast(tr("saveFailed") + " " + error.message); }

      // 3) لكل عميل في الإيصال: حوّله لـ«مسجّل/دفع» + اعمله طلب تفعيل للدعم (مش واحد بس)
      const custIds = Array.from(new Set(valid.map((r) => r.customerId)));
      const { data: authUser } = await supabase.auth.getUser();
      const meId = authUser?.user?.id || null;
      // دبلومة/باتش كل عميل (لبند التفعيل)
      const { data: enrs } = await supabase.from("enrollments")
        .select("customer_id, diplomas(name_ar), batches(code)").in("customer_id", custIds);
      const dipByCust = new Map<string, { dip: string; batch: string }>();
      ((enrs as any[]) || []).forEach((e) => { if (!dipByCust.has(e.customer_id)) dipByCust.set(e.customer_id, { dip: e.diplomas?.name_ar || "", batch: e.batches?.code || "" }); });

      for (const cid of custIds) {
        // (1) تحويل العميل لـ «مسجّل / دفع»
        await supabase.from("customers").update({ stage: "enrolled" }).eq("id", cid);
        // (2) طلب تفعيل (handoff pending) — نعيد استخدام الموجود أو ننشئ جديد
        const { data: ex } = await supabase.from("handoffs").select("id").eq("customer_id", cid).limit(1).maybeSingle();
        let hoId = (ex as any)?.id as string | undefined;
        if (!hoId) {
          const { data: h } = await supabase.from("handoffs").insert({ customer_id: cid, created_by: meId, note: tr("shrTitle"), status: "pending" }).select("id").single();
          hoId = (h as any)?.id;
        } else {
          await supabase.from("handoffs").update({ status: "pending" }).eq("id", hoId);
        }
        if (hoId) {
          const d = dipByCust.get(cid);
          const label = `${tr("activatePrefix")} ${d?.dip || ""}${d?.batch ? " — " + d.batch : ""}`.trim();
          const { data: cur } = await supabase.from("handoff_items").select("label").eq("handoff_id", hoId);
          const already = new Set(((cur as any[]) || []).map((x) => x.label));
          if (label && !already.has(label)) await supabase.from("handoff_items").insert({ handoff_id: hoId, label, done: false });
        }
        // (3) سجل في تايم لاين العميل
        await supabase.from("audit_log").insert({ customer_id: cid, actor_id: meId, action: "handoff_requested", detail: tr("shrActivationNote") });
      }

      setBusy(false);
      toast(tr("shrCreatedActivated").replace("{n}", String(custIds.length)));
      onClose();
      router.refresh();
    } catch (e: any) {
      setBusy(false);
      toast(tr("saveFailed"));
    }
  }

  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "var(--ink)", marginBottom: 6, display: "block" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,10,22,.6)", display: "grid", placeItems: "center", zIndex: 120, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.4)", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
        {/* رأس */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <b style={{ fontSize: 15, color: "var(--ink)" }}>🔗 {tr("shrTitle")}</b>
          <button onClick={onClose} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9, width: 32, height: 32, cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.6 }}>{tr("shrHint")}</div>

          {/* رفع الاسكرين */}
          <label style={lbl}>{tr("shrScreenshot")}</label>
          {!file ? (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith("image/")) setFile(f); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, border: `1.5px dashed ${dragging ? "var(--brand)" : "var(--line)"}`, borderRadius: 12, padding: "22px 12px", cursor: "pointer", color: dragging ? "var(--brand-d)" : "var(--muted)", fontSize: 13, fontWeight: 700, background: dragging ? "var(--brand-soft)" : "transparent", transition: "all .12s" }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              {tr("shrAddScreenshot")}
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{tr("dropOrPick")}</span>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          ) : (
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 10, marginBottom: 4 }}>
              {previewUrl && <img src={previewUrl} alt="receipt" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, display: "block", marginBottom: 8 }} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                <button onClick={() => setFile(null)} className="btn ghost" style={{ height: 30, padding: "0 10px", fontSize: 12 }}>{tr("changeWord")}</button>
              </div>
            </div>
          )}

          {/* العملة */}
          <div style={{ marginTop: 14 }}>
            <label style={lbl}>{tr("currency")}</label>
            <select className="inp" value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ maxWidth: 140 }}>
              <option value="EGP">{tr("egp")}</option>
              <option value="USD">USD $</option>
            </select>
          </div>

          {/* العملاء ومبالغهم */}
          <div style={{ marginTop: 16 }}>
            <label style={lbl}>{tr("shrCustomers")}</label>
            {rows.map((r, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                  {r.customerId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 9, padding: "8px 10px", height: 40, background: "var(--bg)" }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customerName}</span>
                      {r.phone && <span className="num" dir="ltr" style={{ fontSize: 11, color: "var(--muted)" }}>{r.phone}</span>}
                      <button onClick={() => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, customerId: "", customerName: "", phone: "" } : x))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16, lineHeight: 1 }}>×</button>
                    </div>
                  ) : (
                    <>
                      <input className="inp" placeholder={tr("shrSearchCustomer")} value={openIdx === idx ? query : ""}
                        onFocus={() => { setOpenIdx(idx); setQuery(""); setResults([]); }}
                        onChange={(e) => doSearch(e.target.value)} style={{ height: 40 }} />
                      {openIdx === idx && (query.trim() || searching) && (
                        <div style={{ position: "absolute", top: 44, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 5, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow)", maxHeight: 220, overflowY: "auto" }}>
                          {searching ? <div style={{ padding: 10, fontSize: 12, color: "var(--muted)" }}>…</div>
                            : results.length === 0 ? <div style={{ padding: 10, fontSize: 12, color: "var(--muted)" }}>{tr("noResults")}</div>
                              : results.map((c) => (
                                <div key={c.id} onClick={() => pickCustomer(idx, c)} style={{ padding: "9px 11px", cursor: "pointer", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                                  <div style={{ fontWeight: 700, color: "var(--ink)" }}>{c.name}</div>
                                  <div className="num" dir="ltr" style={{ fontSize: 11, color: "var(--muted)" }}>{c.phone1 || ""}</div>
                                </div>
                              ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <input className="inp num" dir="ltr" inputMode="numeric" placeholder={tr("amountWord")} value={r.amount}
                  onChange={(e) => setAmount(idx, e.target.value)} style={{ width: 110, height: 40 }} />
                <button onClick={() => removeRow(idx)} disabled={rows.length === 1} style={{ height: 40, width: 40, flexShrink: 0, borderRadius: 9, border: "1px solid var(--line)", background: "var(--bg)", color: rows.length === 1 ? "var(--line)" : "#E0483B", cursor: rows.length === 1 ? "not-allowed" : "pointer", fontSize: 16 }}>×</button>
              </div>
            ))}
            <button onClick={addRow} className="btn ghost" style={{ height: 36, padding: "0 12px", fontSize: 12.5, gap: 6 }}>
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>
              {tr("shrAddCustomer")}
            </button>
          </div>

          {/* ملاحظة */}
          <div style={{ marginTop: 14 }}>
            <label style={lbl}>{tr("noteOptional")}</label>
            <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("shrNotePh")} />
          </div>

          {/* الإجمالي */}
          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--brand-soft)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-d)" }}>{tr("shrTotal")}</span>
            <b className="num" style={{ fontSize: 17, color: "var(--brand-d)" }} dir="ltr">{nf.format(total)} {currency === "USD" ? "USD" : tr("egp")}</b>
          </div>

          <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--muted)", background: "rgba(24,169,87,.08)", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
            ✅ {tr("shrActivateInfo")}
          </div>

          {/* الأزرار */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={submit} disabled={busy} className="btn" style={{ flex: 1, height: 42, justifyContent: "center", background: "var(--green)" }}>{busy ? "..." : tr("shrCreate")}</button>
            <button onClick={onClose} disabled={busy} className="btn ghost" style={{ height: 42, padding: "0 16px" }}>{tr("cancel")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
