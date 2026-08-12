"use client";
import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";
import SharedReceiptModal from "./SharedReceiptModal";

export type Alloc = { customerId: string; name: string; phone: string; amount: number; currency: string };
export type Receipt = {
  receiptUrl: string; customerId: string; customerName: string; phone1: string;
  amount: number | null; hasAmount: boolean; currency: string; uploadedAt: string; ownerName: string;
  isShared?: boolean; allocations?: Alloc[]; note?: string;
};

function cairoDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function cairoTime(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function ScreenshotsView({ rows, canCreate = false, canDelete = false }: { rows: Receipt[]; canCreate?: boolean; canDelete?: boolean }) {
  const tr = useT();
  const lang = useLang();
  const supabase = createClient();
  const router = useRouter();
  const [delBusy, setDelBusy] = useState(false);
  const [selDay, setSelDay] = useState<string>("");
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [lbIdx, setLbIdx] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const nf = useMemo(() => new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US"), [lang]);
  const fmtMoney = (v: number, cur: string) => `${nf.format(v)} ${cur === "USD" ? tr("usd") : tr("egp")}`;

  // شجرة: سنة → شهر(YYYY-MM) → يوم(YYYY-MM-DD) → إيصالات
  const tree = useMemo(() => {
    const y = new Map<string, Map<string, Map<string, Receipt[]>>>();
    for (const r of rows) {
      if (!r.receiptUrl || !r.uploadedAt) continue;
      const day = cairoDayKey(r.uploadedAt), year = day.slice(0, 4), month = day.slice(0, 7);
      if (!y.has(year)) y.set(year, new Map());
      const Y = y.get(year)!; if (!Y.has(month)) Y.set(month, new Map());
      const M = Y.get(month)!; if (!M.has(day)) M.set(day, []);
      M.get(day)!.push(r);
    }
    return y;
  }, [rows]);

  const years = useMemo(() => Array.from(tree.keys()).sort().reverse(), [tree]);
  const allDaysDesc = useMemo(() => {
    const days: string[] = [];
    for (const Y of tree.values()) for (const M of Y.values()) for (const d of M.keys()) days.push(d);
    return days.sort().reverse();
  }, [tree]);

  // افتراضي: أحدث يوم
  useEffect(() => { if (!selDay && allDaysDesc.length) setSelDay(allDaysDesc[0]); }, [allDaysDesc, selDay]);

  const selYear = selDay.slice(0, 4);
  const selMonth = selDay.slice(0, 7);
  const monthsOfYear = useMemo(() => selYear && tree.get(selYear) ? Array.from(tree.get(selYear)!.keys()).sort().reverse() : [], [tree, selYear]);
  const daysOfMonth = useMemo(() => selMonth && tree.get(selYear)?.get(selMonth) ? Array.from(tree.get(selYear)!.get(selMonth)!.keys()).sort().reverse() : [], [tree, selYear, selMonth]);
  const dayRows = useMemo(() => tree.get(selYear)?.get(selMonth)?.get(selDay) || [], [tree, selYear, selMonth, selDay]);

  function latestDayOfMonth(m: string) { const dd = Array.from(tree.get(m.slice(0, 4))?.get(m)?.keys() || []).sort().reverse(); return dd[0] || ""; }
  function onYear(y: string) { const m = Array.from(tree.get(y)?.keys() || []).sort().reverse()[0]; if (m) setSelDay(latestDayOfMonth(m)); }
  function onMonth(m: string) { const d = latestDayOfMonth(m); if (d) setSelDay(d); }

  // توقيع صور اليوم المفتوح
  useEffect(() => {
    const paths = dayRows.map((r) => r.receiptUrl).filter(Boolean);
    if (!paths.length) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.storage.from("receipts").createSignedUrls(paths, 3600);
        if (!alive || !data) return;
        const map: Record<string, string> = {};
        data.forEach((d: any, i: number) => { if (d?.signedUrl) map[paths[i]] = d.signedUrl; });
        setSigned((cur) => ({ ...cur, ...map }));
      } catch { /* تجاهل */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDay]);

  // إجماليات اليوم
  const totals = useMemo(() => {
    let egp = 0, usd = 0;
    for (const r of dayRows) { if (r.hasAmount && r.amount != null) { if (r.currency === "USD") usd += r.amount; else egp += r.amount; } }
    return { egp, usd, count: dayRows.length };
  }, [dayRows]);

  // ===== lightbox: تنقّل بين صور نفس اليوم =====
  const closeLb = useCallback(() => setLbIdx(null), []);
  const prevImg = useCallback(() => setLbIdx((i) => (i != null && i > 0 ? i - 1 : i)), []);
  const nextImg = useCallback(() => setLbIdx((i) => (i != null && i < dayRows.length - 1 ? i + 1 : i)), [dayRows.length]);
  useEffect(() => {
    if (lbIdx == null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowRight") prevImg();   // RTL: يمين = السابقة
      else if (e.key === "ArrowLeft") nextImg();    // RTL: شمال = التالية
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lbIdx, prevImg, nextImg, closeLb]);

  async function delReceipt(r: Receipt) {
    const msg = r.isShared
      ? tr("delShrConfirm").replace("{n}", String(r.allocations?.length || 0))
      : tr("delReceiptConfirm");
    if (!await confirmDialog(msg, true)) return;
    setDelBusy(true);
    const { data, error } = await supabase.rpc("delete_receipt", { p_url: r.receiptUrl });
    setDelBusy(false);
    if (error || (data && (data as any).ok === false)) { toast(tr("deleteFailed")); return; }
    toast(tr("deletedM"));
    closeLb();
    router.refresh();
  }

  function monthLabel(m: string) {
    const [y, mm] = m.split("-").map(Number);
    const nm = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long" }).format(new Date(y, mm - 1, 15));
    return `${nm} (${mm})`;
  }
  function dayLabel(d: string) {
    const [y, m, dd] = d.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, dd));
  }

  // ستايلات
  const wrap: React.CSSProperties = { position: "relative" };
  const selBox: React.CSSProperties = { position: "relative", display: "inline-flex" };
  const sel: React.CSSProperties = { appearance: "none", WebkitAppearance: "none", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "11px 38px 11px 14px", fontSize: 14, fontWeight: 700, color: "var(--ink)", cursor: "pointer", minWidth: 150, fontFamily: "inherit", boxShadow: "var(--sh)" };
  const chev: React.CSSProperties = { position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--muted)" };
  const arrowBtn = (disabled: boolean): React.CSSProperties => ({ width: 40, height: 40, borderRadius: 11, border: "1px solid var(--line)", background: disabled ? "var(--bg)" : "var(--surface)", color: disabled ? "var(--line)" : "var(--brand-d)", cursor: disabled ? "not-allowed" : "pointer", display: "grid", placeItems: "center", boxShadow: disabled ? "none" : "var(--sh)", transition: "all .15s" });

  if (rows.length === 0) {
    return (
      <div style={{ padding: "50px 18px", textAlign: "center", color: "var(--muted)" }}>
        <div style={{ marginBottom: 16 }}>{tr("noReceiptsYet")}</div>
        {canCreate && <button onClick={() => setCreating(true)} className="btn" style={{ height: 42, padding: "0 18px", gap: 6, background: "var(--green)" }}>🔗 {tr("shrNewBtn")}</button>}
        {creating && <SharedReceiptModal onClose={() => setCreating(false)} />}
      </div>
    );
  }

  const Chevron = () => <svg style={chev} viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></svg>;

  return (
    <div style={wrap}>
      {/* ===== شريط التحكّم: 3 قوائم ===== */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 18 }}>
        <div style={selBox}>
          <select style={sel} value={selYear} onChange={(e) => onYear(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select><Chevron />
        </div>
        <div style={selBox}>
          <select style={sel} value={selMonth} onChange={(e) => onMonth(e.target.value)}>
            {monthsOfYear.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select><Chevron />
        </div>
        <div style={selBox}>
          <select style={{ ...sel, minWidth: 200 }} value={selDay} onChange={(e) => setSelDay(e.target.value)}>
            {daysOfMonth.map((d) => {
              const c = tree.get(selYear)?.get(selMonth)?.get(d)?.length || 0;
              return <option key={d} value={d}>{dayLabel(d)} · {c}</option>;
            })}
          </select><Chevron />
        </div>
        {canCreate && (
          <button onClick={() => setCreating(true)} className="btn" style={{ height: 44, padding: "0 16px", marginInlineStart: "auto", gap: 6, background: "var(--green)" }}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
            {tr("shrNewBtn")}
          </button>
        )}
      </div>

      {/* ===== إجماليات اليوم — كروت أوضح ===== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
        {/* الجنيه */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", boxShadow: "var(--sh)", position: "relative", overflow: "hidden" }}>
          <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 4, background: "var(--brand)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>{tr("total")}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--brand-d)", background: "var(--brand-soft)", borderRadius: 20, padding: "3px 10px" }}>{tr("egp")}</span>
          </div>
          <div className="n" style={{ fontSize: 28, fontWeight: 800, color: "var(--green)", lineHeight: 1.1, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{nf.format(totals.egp)}</div>
        </div>
        {/* الدولار */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", boxShadow: "var(--sh)", position: "relative", overflow: "hidden" }}>
          <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 4, background: "#2F6BFF" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>{tr("total")}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#2F6BFF", background: "rgba(47,107,255,.12)", borderRadius: 20, padding: "3px 10px" }}>{tr("usd")}</span>
          </div>
          <div className="n" style={{ fontSize: 28, fontWeight: 800, color: totals.usd > 0 ? "var(--green)" : "var(--muted)", lineHeight: 1.1, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{nf.format(totals.usd)}</div>
        </div>
        {/* العدد */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", boxShadow: "var(--sh)", position: "relative", overflow: "hidden" }}>
          <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 4, background: "var(--muted)" }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>{tr("count")}</div>
          <div className="n" style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{nf.format(totals.count)}</div>
        </div>
      </div>

      {/* ===== معرض إيصالات اليوم ===== */}
      {dayRows.length === 0 ? (
        <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--muted)" }}>{tr("noReceiptsYet")}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
          {dayRows.map((r, i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh)" }}>
              <div onClick={() => setLbIdx(i)} style={{ cursor: "zoom-in", height: 160, background: "var(--bg)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                {signed[r.receiptUrl]
                  ? <img src={signed[r.receiptUrl]} alt={r.customerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 11, color: "var(--muted)" }}>…</span>}
              </div>
              <div style={{ padding: "10px 12px" }}>
                {r.isShared ? (
                  <>
                    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 800, background: "var(--brand-soft)", color: "var(--brand-d)", borderRadius: 20, padding: "2px 8px", marginBottom: 4 }}>🔗 {tr("shrReceipt")} · {r.allocations?.length || 0}</span>
                    <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 700, lineHeight: 1.45, maxHeight: 35, overflow: "hidden" }}>{(r.allocations || []).map((a) => a.name).join("، ")}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.customerName}</div>
                    <div className="n" style={{ fontSize: 12, color: "var(--muted)", direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{r.phone1}</div>
                  </>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7, gap: 6 }}>
                  {r.hasAmount && r.amount != null
                    ? <b style={{ color: "var(--green)", fontSize: 13 }} className="n">{fmtMoney(r.amount, r.currency)}</b>
                    : <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>}
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{cairoTime(r.uploadedAt, lang)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.ownerName || "—"}</span>
                  {r.isShared
                    ? <button onClick={() => setLbIdx(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "var(--brand-d)", padding: 0 }}>{tr("shrDetails")}</button>
                    : <Link href={`/customers/${r.customerId}`} style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-d)" }}>{tr("openCustomerCard")}</Link>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Lightbox مع أسهم بين صور اليوم ===== */}
      {lbIdx != null && dayRows[lbIdx] && (() => {
        const r = dayRows[lbIdx];
        const atFirst = lbIdx === 0, atLast = lbIdx === dayRows.length - 1;
        return (
          <div onClick={closeLb} style={{ position: "fixed", inset: 0, background: "rgba(4,10,22,.75)", display: "grid", placeItems: "center", zIndex: 90, padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", maxWidth: 600, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontWeight: 800, color: "var(--ink)" }}>{r.isShared ? `🔗 ${tr("shrReceipt")}` : r.customerName}</div>
                  <div className="n" style={{ fontSize: 12, color: "var(--muted)", direction: "ltr" }}>{r.isShared ? `${r.allocations?.length || 0} · ${fmtMoney(r.amount || 0, r.currency)}` : `${r.phone1}${r.hasAmount && r.amount != null ? ` · ${fmtMoney(r.amount, r.currency)}` : ""}`}</div>
                </div>
                <button onClick={closeLb} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9, width: 32, height: 32, cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1 }}>×</button>
              </div>

              <div style={{ position: "relative", background: "var(--bg)", display: "grid", placeItems: "center", maxHeight: "60vh", overflow: "auto" }}>
                {signed[r.receiptUrl]
                  ? <img src={signed[r.receiptUrl]} alt={r.customerName} style={{ maxWidth: "100%", display: "block" }} />
                  : <span style={{ padding: 40, color: "var(--muted)" }}>…</span>}
              </div>

              {r.isShared && (r.allocations?.length || 0) > 0 && (
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line)", maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }}>{tr("shrCustomers")} ({r.allocations!.length})</div>
                  {r.allocations!.map((a, ai) => (
                    <div key={ai} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: ai < r.allocations!.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <Link href={`/customers/${a.customerId}`} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-d)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</Link>
                      <b className="num" style={{ fontSize: 12.5, color: "var(--green)", flexShrink: 0 }} dir="ltr">{fmtMoney(a.amount, a.currency)}</b>
                    </div>
                  ))}
                </div>
              )}

              {/* شريط التنقّل بين الصور */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--line)", gap: 10 }}>
                <button onClick={prevImg} disabled={atFirst} title={tr("prevImage")} style={arrowBtn(atFirst)}>
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M9 6l6 6-6 6" /></svg>
                </button>
                <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--muted)", fontWeight: 700 }}>
                  <span className="n">{lbIdx + 1}</span> / <span className="n">{dayRows.length}</span>
                  {atLast && <div style={{ fontSize: 11, color: "var(--brand-d)", marginTop: 2 }}>{tr("lastImage")}</div>}
                  {atFirst && dayRows.length > 1 && <div style={{ fontSize: 11, color: "var(--brand-d)", marginTop: 2 }}>{tr("firstImage")}</div>}
                </div>
                <button onClick={nextImg} disabled={atLast} title={tr("nextImage")} style={arrowBtn(atLast)}>
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M15 6l-6 6 6 6" /></svg>
                </button>
              </div>

              <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.ownerName || "—"} · {cairoTime(r.uploadedAt, lang)}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {canDelete && (
                    <button onClick={() => delReceipt(r)} disabled={delBusy} className="btn ghost" style={{ fontSize: 13, color: "#E0483B", borderColor: "rgba(224,72,59,.35)", gap: 6 }}>
                      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      {tr("deleteReceipt")}
                    </button>
                  )}
                  {!r.isShared && <Link href={`/customers/${r.customerId}`} className="btn" style={{ fontSize: 13 }}>{tr("openCustomerCard")}</Link>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {creating && <SharedReceiptModal onClose={() => setCreating(false)} />}
    </div>
  );
}
