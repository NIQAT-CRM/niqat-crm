"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

type Opt = { v: string; label: string; dip?: string };
type Aff = { code: string; name: string; rate?: number; phone?: string };
type Payout = { code: string; amount: number; paidAt: string; count: number; note: string };
type EnrRow = { cid: string; dip: string; batch: string; agreed: number; collected: number; cur: string };
type CMeta = { id: string; name: string; phone: string; code: string; stage: string; refunded: boolean };
type Cust = { id: string; name: string; phone: string; code: string; diploma: string; batch: string; agreed: number; collected: number; paid: boolean; refunded: boolean; usd: boolean };
type Row = { code: string; name: string; phone: string; rate: number; customers: number; paidN: number; notPaidN: number; refundedN: number; sales: number; commission: number; collected: number; hasUsd: boolean; paidOut: number; dueNow: number };

const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));

export default function AffiliateGlobal({ affiliates, diplomas, batches, canFinance, usdRate = 44, payouts = [] }: {
  affiliates: Aff[]; diplomas: Opt[]; batches: Opt[]; canFinance: boolean; usdRate?: number; payouts?: Payout[];
}) {
  const tr = useT();
  const lang = useLang();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [cmeta, setCmeta] = useState<CMeta[]>([]);
  const [enrRows, setEnrRows] = useState<EnrRow[]>([]);
  const [q, setQ] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [dips, setDips] = useState<string[]>([]);
  const [bsel, setBsel] = useState<string[]>([]);
  const toggleDip = (v: string) => setDips((a) => a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  const toggleBatch = (v: string) => setBsel((a) => a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

  const affByCode = useMemo(() => new Map(affiliates.map((a) => [a.code.toUpperCase(), a])), [affiliates]);
  const dipName = useMemo(() => new Map(diplomas.map((d) => [d.v, d.label])), [diplomas]);
  const batchName = useMemo(() => new Map(batches.map((b) => [b.v, b.label])), [batches]);
  const visBatches = dips.length ? batches.filter((b) => b.dip && dips.includes(b.dip)) : batches;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: cs } = await supabase.from("customers")
          .select("id,name,phone1,affiliate_code,stage").eq("deleted", false)
          .not("affiliate_code", "is", null).neq("affiliate_code", "");
        const cList = (cs || []) as any[];
        const ids = cList.map((c) => c.id);
        if (!ids.length) { setCmeta([]); setEnrRows([]); setLoading(false); return; }

        const { data: enrs } = await supabase.from("enrollments").select("id,customer_id,diploma_id,batch_id").in("customer_id", ids);
        const eList = (enrs || []) as any[];
        const enrIds = eList.map((e) => e.id);
        const { data: refunds } = await supabase.from("refunds").select("customer_id").in("customer_id", ids);
        const refSet = new Set((refunds || []).map((r: any) => r.customer_id));

        const agreedByEnr = new Map<string, number>();
        const curByEnr = new Map<string, string>();
        const paidByEnr = new Map<string, number>();
        if (canFinance && enrIds.length) {
          const [{ data: fin }, { data: insts }] = await Promise.all([
            supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", enrIds),
            supabase.from("installments").select("enrollment_id,amount,status,paid_at").in("enrollment_id", enrIds),
          ]);
          (fin || []).forEach((f: any) => { agreedByEnr.set(f.enrollment_id, Number(f.agreed_amount) || 0); curByEnr.set(f.enrollment_id, f.currency || "EGP"); });
          (insts || []).forEach((i: any) => { if (i.status === "paid" || i.paid_at) paidByEnr.set(i.enrollment_id, (paidByEnr.get(i.enrollment_id) || 0) + (Number(i.amount) || 0)); });
        }

        setCmeta(cList.map((c) => ({ id: c.id, name: c.name || "—", phone: c.phone1 || "", code: (c.affiliate_code || "").trim().toUpperCase(), stage: c.stage || "", refunded: refSet.has(c.id) })));
        setEnrRows(eList.map((e) => ({ cid: e.customer_id, dip: e.diploma_id || "", batch: e.batch_id || "", agreed: agreedByEnr.get(e.id) || 0, collected: paidByEnr.get(e.id) || 0, cur: curByEnr.get(e.id) || "EGP" })));
      } catch { setCmeta([]); setEnrRows([]); }
      setLoading(false);
    })();
  }, [supabase, canFinance]);

  // تجميع لكل عميل مع تطبيق فلتر الدبلومة/الباتش
  const custs: Cust[] = useMemo(() => {
    const byCust = new Map<string, EnrRow[]>();
    for (const e of enrRows) {
      if (dips.length && !dips.includes(e.dip)) continue;
      if (bsel.length && !bsel.includes(e.batch)) continue;
      const arr = byCust.get(e.cid) || []; arr.push(e); byCust.set(e.cid, arr);
    }
    const out: Cust[] = [];
    for (const c of cmeta) {
      const es = byCust.get(c.id);
      if ((dips.length || bsel.length) && (!es || !es.length)) continue; // فلتر شغّال → استبعد اللي ملوش اشتراك مطابق
      let agreed = 0, collected = 0, usd = false; const dipset = new Set<string>(), bts = new Set<string>();
      (es || []).forEach((e) => { const mult = e.cur === "USD" ? usdRate : 1; if (e.cur === "USD") usd = true; agreed += e.agreed * mult; collected += e.collected * mult; if (e.dip) dipset.add(dipName.get(e.dip) || ""); if (e.batch) bts.add(batchName.get(e.batch) || ""); });
      out.push({ id: c.id, name: c.name, phone: c.phone, code: c.code, diploma: Array.from(dipset).filter(Boolean).join(" / ") || "—", batch: Array.from(bts).filter(Boolean).join(" / ") || "—", agreed, collected, paid: c.stage === "enrolled", refunded: c.refunded, usd });
    }
    return out;
  }, [cmeta, enrRows, dips, bsel, dipName, batchName, usdRate]);

  const payoutByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payouts) m.set(p.code.toUpperCase(), (m.get(p.code.toUpperCase()) || 0) + p.amount);
    return m;
  }, [payouts]);

  const rows: Row[] = useMemo(() => {
    const m = new Map<string, Row>();
    for (const c of custs) {
      if (!c.code) continue;
      const a = affByCode.get(c.code);
      let r = m.get(c.code);
      if (!r) { r = { code: c.code, name: a?.name && a.name !== "—" ? a.name : "", phone: a?.phone || "", rate: Number(a?.rate) || 0, customers: 0, paidN: 0, notPaidN: 0, refundedN: 0, sales: 0, commission: 0, collected: 0, hasUsd: false, paidOut: 0, dueNow: 0 }; m.set(c.code, r); }
      r.customers++;
      if (c.usd) r.hasUsd = true;
      if (c.refunded) { r.refundedN++; continue; }
      if (c.paid) { r.paidN++; r.sales += c.agreed; r.collected += c.collected; }
      else r.notPaidN++;
    }
    const arr = Array.from(m.values());
    arr.forEach((r) => {
      r.commission = Math.round((r.sales * r.rate) / 100);
      r.paidOut = Math.round(payoutByCode.get(r.code) || 0);
      r.dueNow = Math.max(0, r.commission - r.paidOut);
    });
    arr.sort((a, b) => b.customers - a.customers);
    return arr;
  }, [custs, affByCode, payoutByCode]);

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return r.code.toLowerCase().includes(s) || r.name.toLowerCase().includes(s);
  });
  const totals = useMemo(() => ({ partners: rows.length, customers: rows.reduce((s, r) => s + r.customers, 0), commission: rows.reduce((s, r) => s + r.dueNow, 0) }), [rows]);

  async function settle(r: Row) {
    if (r.dueNow <= 0) return toast(tr("affNothingDue"));
    const ok = await confirmDialog({ message: tr("affSettleConfirm").replace("{a}", money(r.dueNow)).replace("{n}", dName(r)), confirmLabel: tr("affSettleYes"), cancelLabel: tr("cancel") });
    if (!ok) return;
    const { data: au } = await supabase.auth.getUser();
    const { error } = await supabase.from("affiliate_payouts").insert({ code: r.code, amount: r.dueNow, customers_count: r.paidN, paid_by: au?.user?.id || null });
    if (error) return toast(tr("saveFailed") + error.message);
    toast(tr("affSettled")); router.refresh();
  }

  const dName = (r: Row) => r.name || r.code;

  function waPhone(raw: string) {
    let d = (raw || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("0")) d = "20" + d.slice(1);
    else if (!d.startsWith("20") && d.length <= 11) d = "20" + d;
    return d;
  }
  function buildMsg(r: Row) {
    const cs = custs.filter((c) => c.code === r.code && !c.refunded);
    const dips = Array.from(new Set(cs.map((c) => c.diploma).filter((x) => x && x !== "—"))).join("، ") || "—";
    const bts = Array.from(new Set(cs.flatMap((c) => (c.batch || "").split(" / ")).filter((x) => x && x !== "—"))).join("، ") || "—";
    const L = [
      `مساء الخير مهندس/${dName(r)} 🌟`,
      `بعد إغلاق الحساب وانتهاء باب التحويل والاسترداد، تم تسوية العمولة الخاصة بحضرتك.`, ``,
      `🔑 الكود: ${r.code}`, `🎓 الدبلومة: ${dips} — الباتش: ${bts}`,
      ...(canFinance ? [`📈 نسبة عمولتك: ${r.rate}%`] : []), ``,
      `👥 إجمالي العملاء: ${r.customers} — ✅ دفعوا: ${r.paidN} · ⏳ لسه: ${r.notPaidN}`,
      ...(canFinance ? [`💰 إجمالي المبيعات: ${money(r.sales)} جنيه${r.hasUsd ? " (شامل تحويل الدولار × " + usdRate + ")" : ""}`, `💵 عمولتك المستحقة: ${money(r.dueNow)} جنيه`] : []), ``,
      `سيتم التحويل خلال أقصاها 15 يوم عمل.`, `نشكر حضرتك على جهودك المستمرة، ونتطلع لمزيد من النجاحات معًا 🤝`,
    ];
    return L.join("\n");
  }
  function esc(s: string) { return (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)); }
  function openPdf(r: Row) {
    const ar = lang === "ar";
    const L = ar
      ? { title: "نقاط — تقرير الشريك", name: "الاسم", code: "الكود", phone: "التليفون", cust: "العملاء", paid: "دفعوا", not: "لسه", sales: "المبيعات", comm: "العمولة", dip: "الدبلومة", batch: "الباتش", status: "الحالة", agreed: "المتفق", coll: "المحصّل", total: "الإجمالي", pd: "دفع", ls: "لسه", rf: "مسترد", ft: "تم الإنشاء من نظام CRM-NIQAT" }
      : { title: "NIQAT — Partner report", name: "Name", code: "Code", phone: "Phone", cust: "Customers", paid: "Paid", not: "Unpaid", sales: "Sales", comm: "Commission", dip: "Diploma", batch: "Batch", status: "Status", agreed: "Agreed", coll: "Collected", total: "Total", pd: "Paid", ls: "Unpaid", rf: "Refunded", ft: "Generated by CRM-NIQAT" };
    const cs = custs.filter((c) => c.code === r.code).sort((a, b) => b.agreed - a.agreed);
    let tAgreed = 0, tColl = 0;
    const rowsHtml = cs.map((c) => { if (!c.refunded) { tAgreed += c.agreed; tColl += c.collected; } return `<tr style="${c.refunded ? "opacity:.6" : ""}"><td>${esc(c.name)}</td><td dir="ltr">${esc(c.phone) || "—"}</td><td>${esc(c.diploma)}</td><td dir="ltr">${esc(c.batch)}</td><td>${c.refunded ? L.rf : c.paid ? L.pd : L.ls}</td>${canFinance ? `<td dir="ltr">${money(c.agreed)}</td><td dir="ltr">${money(c.collected)}</td>` : ""}</tr>`; }).join("");
    const totalRow = canFinance ? `<tr style="font-weight:800;background:#faf5ee"><td colspan="5">${L.total}</td><td dir="ltr">${money(tAgreed)}</td><td dir="ltr">${money(tColl)}</td></tr>` : "";
    const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8"><title>${L.title} — ${esc(dName(r))}</title>
<style>body{font-family:Tajawal,Arial,sans-serif;padding:28px;color:#1a1a1a}h1{color:#F08A24;margin:0 0 4px}.meta{color:#555;font-size:13px;margin-bottom:14px}.sum{display:flex;gap:14px;flex-wrap:wrap;margin:14px 0}.box{border:1px solid #eee;border-radius:10px;padding:10px 16px;min-width:90px}.box small{color:#777;font-size:11px}.box b{display:block;font-size:18px;color:#F08A24;margin-top:2px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px}th,td{border:1px solid #e2e2e2;padding:7px 9px;text-align:${ar ? "right" : "left"}}th{background:#faf5ee;color:#8a5a12}.ft{margin-top:22px;color:#999;font-size:11px}</style>
</head><body>
<h1>${L.title}</h1>
<div class="meta">${L.name}: <b>${esc(dName(r))}</b> · ${L.code}: <b>${esc(r.code)}</b>${r.phone ? ` · ${L.phone}: ${esc(r.phone)}` : ""}</div>
<div class="sum">
  <div class="box"><small>${L.cust}</small><b>${r.customers}</b></div>
  <div class="box"><small>${L.paid}</small><b>${r.paidN}</b></div>
  <div class="box"><small>${L.not}</small><b>${r.notPaidN}</b></div>
  ${canFinance ? `<div class="box"><small>${L.sales}</small><b>${money(r.sales)}</b></div><div class="box"><small>${L.comm} (${r.rate}%)</small><b>${money(r.dueNow)}</b></div>` : ""}
</div>
${canFinance && r.hasUsd ? `<div style="font-size:11px;color:#2F6BFF;margin:-4px 0 8px">💱 ${ar ? "شامل تحويل مبيعات بالدولار × " + usdRate : "Includes USD sales converted × " + usdRate}</div>` : ""}
<table><thead><tr><th>${L.name}</th><th>${L.phone}</th><th>${L.dip}</th><th>${L.batch}</th><th>${L.status}</th>${canFinance ? `<th>${L.agreed}</th><th>${L.coll}</th>` : ""}</tr></thead><tbody>${rowsHtml}${totalRow}</tbody></table>
<p class="ft">${L.ft} — ${new Date().toLocaleDateString(ar ? "ar-EG" : "en-GB")}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }
  function sendWA(r: Row) {
    if (pdfInc) openPdf(r);
    const ph = waPhone(r.phone);
    const url = ph ? `https://wa.me/${ph}?text=${encodeURIComponent(buildMsg(r))}` : `https://wa.me/?text=${encodeURIComponent(buildMsg(r))}`;
    window.open(url, "_blank");
  }
  const [pdfInc, setPdfInc] = useState(true);

  const th: React.CSSProperties = { padding: "9px 12px", textAlign: "start", color: "var(--muted)", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 12px", fontSize: 13, color: "var(--ink)" };
  const selSt: React.CSSProperties = { height: 38, padding: "0 10px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13 };

  if (loading) return <div className="card" style={{ padding: 24, color: "var(--muted)" }}>…</div>;

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>🤝 {tr("affGlobalTitle")}</h3>

      {/* ملخّص */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        {[
          { l: tr("affTotalPartners"), v: money(totals.partners), c: "var(--brand-d)" },
          { l: tr("affTotalCustomers"), v: money(totals.customers), c: "#2F6BFF" },
          ...(canFinance ? [{ l: tr("affTotalCommission"), v: money(totals.commission) + " " + tr("egp"), c: "#18A957" }] : []),
        ].map((k, i) => (
          <div key={i} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{k.l}</div>
            <div className="num" style={{ fontSize: 18, fontWeight: 800, color: k.c }} dir="ltr">{k.v}</div>
          </div>
        ))}
      </div>

      {/* الفلاتر: اختر دبلومات (متعدّد) → باتشاتها (متعدّد) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)" }}>{tr("diploma")}:</span>
          {diplomas.map((d) => {
            const on = dips.includes(d.v);
            return <button key={d.v} onClick={() => { toggleDip(d.v); }} style={{ height: 30, padding: "0 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid " + (on ? "var(--brand)" : "var(--line)"), background: on ? "var(--brand)" : "var(--surface)", color: on ? "#fff" : "var(--muted-d)" }}>{d.label}</button>;
          })}
        </div>
        {dips.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)" }}>{tr("batch")}:</span>
            {visBatches.map((b) => {
              const on = bsel.includes(b.v);
              return <button key={b.v} onClick={() => toggleBatch(b.v)} style={{ height: 28, padding: "0 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: "1px solid " + (on ? "#2F6BFF" : "var(--line)"), background: on ? "rgba(47,107,255,.12)" : "var(--surface)", color: on ? "#2F6BFF" : "var(--muted-d)" }} dir="ltr">{b.label}</button>;
            })}
            {visBatches.length === 0 && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>—</span>}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {(dips.length > 0 || bsel.length > 0) && <button onClick={() => { setDips([]); setBsel([]); }} className="btn ghost" style={{ height: 32, padding: "0 12px", fontSize: 12 }}>{tr("clearFilter")}</button>}
          <input className="inp" placeholder={tr("affSearchPh")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280, marginInlineStart: "auto" }} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{tr("noData")}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg)" }}>
                <th style={th}>{tr("name")}</th>
                <th style={th}>{tr("code")}</th>
                <th style={th}>{tr("customerCount")}</th>
                <th style={th}>✅ {tr("paid")}</th>
                <th style={th}>⏳ {tr("unpaid")}</th>
                {canFinance && <th style={th}>{tr("salesBaseCol")}</th>}
                {canFinance && <th style={th}>{tr("affDueCol")}</th>}
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <>
                  <tr key={r.code} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setOpenCode(openCode === r.code ? null : r.code)}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.name || "—"}{r.refundedN > 0 && <span style={{ fontSize: 10.5, color: "#E0483B", marginInlineStart: 6 }}>↩{r.refundedN}</span>}</td>
                    <td style={{ ...td, fontWeight: 800, color: "var(--brand-d)" }} dir="ltr">{r.code}</td>
                    <td style={td}><b>{r.customers}</b></td>
                    <td style={{ ...td, color: "#18A957", fontWeight: 700 }}>{r.paidN}</td>
                    <td style={{ ...td, color: "#C7891A", fontWeight: 700 }}>{r.notPaidN}</td>
                    {canFinance && <td style={td} dir="ltr"><span className="num">{money(r.sales)}</span>{r.hasUsd && <span title={"$ × " + usdRate} style={{ fontSize: 9, color: "#2F6BFF", marginInlineStart: 3 }}>$</span>}</td>}
                    {canFinance && <td style={{ ...td, color: r.dueNow > 0 ? "#18A957" : "var(--muted)", fontWeight: 800 }} dir="ltr"><span className="num">{money(r.dueNow)}</span></td>}
                    <td style={{ ...td, textAlign: "end", color: "var(--muted)" }}>{openCode === r.code ? "▲" : "▼"}</td>
                  </tr>
                  {openCode === r.code && (
                    <tr style={{ background: "var(--bg)" }}>
                      <td colSpan={canFinance ? 8 : 6} style={{ padding: 10 }}>
                        {canFinance && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }}>
                            <div style={{ fontSize: 12 }}><span style={{ color: "var(--muted)" }}>{tr("affTotalComm")}: </span><b className="num">{money(r.commission)}</b></div>
                            <div style={{ fontSize: 12 }}><span style={{ color: "var(--muted)" }}>{tr("affPaidOut")}: </span><b className="num" style={{ color: "#2F6BFF" }}>{money(r.paidOut)}</b></div>
                            <div style={{ fontSize: 12 }}><span style={{ color: "var(--muted)" }}>{tr("affDueNow")}: </span><b className="num" style={{ color: r.dueNow > 0 ? "#18A957" : "var(--muted)", fontSize: 15 }}>{money(r.dueNow)}</b></div>
                            {r.hasUsd && <span style={{ fontSize: 10.5, color: "#2F6BFF" }}>💱 {tr("usdConverted").replace("{r}", String(usdRate))}</span>}
                            <button onClick={() => settle(r)} disabled={r.dueNow <= 0} className="btn" style={{ height: 32, padding: "0 14px", fontSize: 12.5, marginInlineStart: "auto", opacity: r.dueNow > 0 ? 1 : .5 }}>💵 {tr("affSettleBtn")}</button>
                          </div>
                        )}
                        {canFinance && (() => { const ps = payouts.filter((p) => p.code.toUpperCase() === r.code); return ps.length > 0 ? (
                          <div style={{ marginBottom: 12, fontSize: 12 }}>
                            <div style={{ fontWeight: 800, color: "var(--muted)", marginBottom: 4 }}>{tr("affSettlements")}:</div>
                            {ps.map((p, i) => (
                              <div key={i} style={{ display: "flex", gap: 10, padding: "3px 0", color: "var(--ink)" }}>
                                <span style={{ color: "var(--muted)" }}>{new Date(p.paidAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")}</span>
                                <b className="num">{money(p.amount)} {tr("egp")}</b>
                                <span style={{ color: "var(--muted)" }}>· {p.count} {tr("receiptsCountWord") || ""}</span>
                              </div>
                            ))}
                          </div>
                        ) : null; })()}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                          <button onClick={() => sendWA(r)} className="btn" style={{ height: 34, padding: "0 14px", fontSize: 13, background: "#25D366", gap: 6 }}>
                            <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3A2.8 2.8 0 0 0 6 8.9c0 1.6 1.2 3.2 1.4 3.4s2.3 3.6 5.6 5c.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2z" /></svg>
                            {tr("waSend")}
                          </button>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink)", cursor: "pointer" }}>
                            <input type="checkbox" checked={pdfInc} onChange={(e) => setPdfInc(e.target.checked)} /> {tr("includePdf")}
                          </label>
                          <button onClick={() => openPdf(r)} className="btn ghost" style={{ height: 34, padding: "0 12px", fontSize: 12.5 }}>{tr("uniDownload")} PDF</button>
                          {!r.phone && <span style={{ fontSize: 11.5, color: "#C7891A" }}>⚠️ {tr("noPhoneForWa")}</span>}
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead><tr>
                              <th style={{ ...th, fontSize: 11 }}>{tr("name")}</th>
                              <th style={{ ...th, fontSize: 11 }}>{tr("phone")}</th>
                              <th style={{ ...th, fontSize: 11 }}>{tr("diploma")}</th>
                              <th style={{ ...th, fontSize: 11 }}>{tr("batch")}</th>
                              <th style={{ ...th, fontSize: 11 }}>{tr("statusWord")}</th>
                              {canFinance && <th style={{ ...th, fontSize: 11 }}>{tr("agreed")}</th>}
                              {canFinance && <th style={{ ...th, fontSize: 11 }}>{tr("collected")}</th>}
                            </tr></thead>
                            <tbody>
                              {custs.filter((c) => c.code === r.code).sort((a, b) => b.agreed - a.agreed).map((c) => (
                                <tr key={c.id} style={{ borderTop: "1px solid var(--line)", opacity: c.refunded ? .55 : 1 }}>
                                  <td style={{ ...td, fontSize: 12.5 }}>{c.name}</td>
                                  <td style={{ ...td, fontSize: 12 }} dir="ltr">{c.phone || "—"}</td>
                                  <td style={{ ...td, fontSize: 12 }}>{c.diploma}</td>
                                  <td style={{ ...td, fontSize: 12 }} dir="ltr">{c.batch}</td>
                                  <td style={{ ...td, fontSize: 11.5 }}>
                                    {c.refunded ? <span style={{ color: "#E0483B", fontWeight: 700 }}>↩ {tr("refundedBadge")}</span>
                                      : c.paid ? <span style={{ color: "#18A957", fontWeight: 700 }}>✅ {tr("paid")}</span>
                                        : <span style={{ color: "#C7891A", fontWeight: 700 }}>⏳ {tr("unpaid")}</span>}
                                  </td>
                                  {canFinance && <td style={{ ...td, fontSize: 12 }} dir="ltr"><span className="num">{money(c.agreed)}</span></td>}
                                  {canFinance && <td style={{ ...td, fontSize: 12 }} dir="ltr"><span className="num">{money(c.collected)}</span></td>}
                                </tr>
                              ))}
                              {canFinance && (
                                <tr style={{ borderTop: "2px solid var(--line)", fontWeight: 800, background: "var(--surface)" }}>
                                  <td style={{ ...td, fontSize: 12 }} colSpan={5}>{tr("totalWord")}</td>
                                  <td style={{ ...td, fontSize: 12 }} dir="ltr"><span className="num">{money(r.sales)}</span></td>
                                  <td style={{ ...td, fontSize: 12 }} dir="ltr"><span className="num">{money(r.collected)}</span></td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
