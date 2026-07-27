"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";

export type Receipt = {
  receiptUrl: string; // path داخل bucket receipts
  customerId: string;
  customerName: string;
  phone1: string;
  amount: number;
  currency: string;
  uploadedAt: string; // ISO
  ownerName: string;
};
type Totals = { egp: number; usd: number; count: number };

// تاريخ/وقت بتوقيت القاهرة (يطابق فلترة الـ RPC)
function cairoDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function cairoTime(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function ScreenshotsView({ rows }: { rows: Receipt[] }) {
  const tr = useT();
  const lang = useLang();
  const supabase = createClient();
  const [level, setLevel] = useState<"months" | "days" | "gallery">("months");
  const [selMonth, setSelMonth] = useState<string>(""); // YYYY-MM
  const [selDay, setSelDay] = useState<string>("");      // YYYY-MM-DD
  const [totals, setTotals] = useState<Totals | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<Receipt | null>(null);

  const nf = useMemo(() => new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US"), [lang]);
  const fmtMoney = (v: number, cur: string) => `${nf.format(v)} ${cur === "USD" ? tr("usd") : tr("egp")}`;

  // تجميع هرمي: شهر → يوم → إيصالات
  const tree = useMemo(() => {
    const months = new Map<string, { days: Map<string, Receipt[]>; count: number }>();
    for (const r of rows) {
      if (!r.receiptUrl) continue;
      const day = cairoDayKey(r.uploadedAt);
      const month = day.slice(0, 7);
      if (!months.has(month)) months.set(month, { days: new Map(), count: 0 });
      const M = months.get(month)!;
      if (!M.days.has(day)) M.days.set(day, []);
      M.days.get(day)!.push(r);
      M.count++;
    }
    return months;
  }, [rows]);

  const monthKeys = useMemo(() => Array.from(tree.keys()).sort().reverse(), [tree]);

  // إجماليات كل نطاق من receipts_totals حسب المستوى الحالي
  useEffect(() => {
    let from: string, to: string;
    if (level === "gallery" && selDay) { from = selDay; to = selDay; }
    else if (level === "days" && selMonth) {
      const [y, m] = selMonth.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      from = `${selMonth}-01`; to = `${selMonth}-${String(last).padStart(2, "0")}`;
    } else { from = "2000-01-01"; to = "2100-01-01"; }
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("receipts_totals", { p_from: from, p_to: to });
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] : data;
      setTotals(row ? { egp: Number(row.total_egp) || 0, usd: Number(row.total_usd) || 0, count: Number(row.count) || 0 } : { egp: 0, usd: 0, count: 0 });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, selMonth, selDay]);

  // توقيع صور اليوم المفتوح فقط (lazy)
  useEffect(() => {
    if (level !== "gallery" || !selDay || !selMonth) return;
    const dayRows = tree.get(selMonth)?.days.get(selDay) || [];
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
  }, [level, selDay, selMonth]);

  function monthLabel(m: string) {
    const [y, mm] = m.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { year: "numeric", month: "long" }).format(new Date(y, mm - 1, 15));
  }
  function dayLabel(d: string) {
    const [y, m, dd] = d.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, dd));
  }

  // ===== ستايلات (theme tokens فقط) =====
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--sh)", padding: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 };
  const gGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 };
  const crumb: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14, fontSize: 13, color: "var(--muted)" };
  const crumbBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--brand-d)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13, padding: 0 };
  const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 20, padding: "3px 11px", fontSize: 12, fontWeight: 700, color: "var(--muted)" };

  const Totals = () => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ ...pill, background: "var(--brand-soft)", borderColor: "var(--brand-soft)", color: "var(--brand-d)" }}>{tr("total")}: <b className="n">{nf.format(totals?.egp || 0)}</b> {tr("egp")}</div>
      <div style={{ ...pill, background: "var(--blue-soft, var(--bg))" }}>{tr("total")}: <b className="n">{nf.format(totals?.usd || 0)}</b> {tr("usd")}</div>
      <div style={pill}>{tr("count")}: <b className="n">{nf.format(totals?.count || 0)}</b></div>
    </div>
  );

  if (rows.length === 0) {
    return <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--muted)" }}>{tr("noReceiptsYet")}</div>;
  }

  return (
    <div>
      {/* مسار التنقل */}
      <div style={crumb}>
        <button style={crumbBtn} onClick={() => { setLevel("months"); setSelMonth(""); setSelDay(""); }}>{tr("allMonths")}</button>
        {selMonth && <>›<button style={crumbBtn} onClick={() => { setLevel("days"); setSelDay(""); }}>{monthLabel(selMonth)}</button></>}
        {level === "gallery" && selDay && <>›<span style={{ color: "var(--ink)", fontWeight: 700 }}>{dayLabel(selDay)}</span></>}
      </div>

      <Totals />

      {/* المستوى ١: الشهور */}
      {level === "months" && (
        <div style={grid}>
          {monthKeys.map((m) => (
            <div key={m} style={card} onClick={() => { setSelMonth(m); setLevel("days"); }}>
              <div>
                <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 15 }}>{monthLabel(m)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{tree.get(m)!.days.size} {tr("daysWord")}</div>
              </div>
              <span style={pill}><span className="n">{tree.get(m)!.count}</span> {tr("receiptsWord")}</span>
            </div>
          ))}
        </div>
      )}

      {/* المستوى ٢: أيام الشهر */}
      {level === "days" && selMonth && (
        <div style={grid}>
          {Array.from(tree.get(selMonth)!.days.keys()).sort().reverse().map((d) => (
            <div key={d} style={card} onClick={() => { setSelDay(d); setLevel("gallery"); }}>
              <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 14 }}>{dayLabel(d)}</div>
              <span style={pill}><span className="n">{tree.get(selMonth)!.days.get(d)!.length}</span> {tr("receiptsWord")}</span>
            </div>
          ))}
        </div>
      )}

      {/* المستوى ٣: معرض إيصالات اليوم */}
      {level === "gallery" && selDay && selMonth && (
        <div style={gGrid}>
          {(tree.get(selMonth)!.days.get(selDay) || []).map((r, i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh)" }}>
              <div onClick={() => setLightbox(r)} style={{ cursor: "zoom-in", height: 150, background: "var(--bg)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                {signed[r.receiptUrl]
                  ? <img src={signed[r.receiptUrl]} alt={r.customerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 11, color: "var(--muted)" }}>…</span>}
              </div>
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontWeight: 800, color: "var(--ink)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.customerName}</div>
                <div className="n" style={{ fontSize: 12, color: "var(--muted)", direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{r.phone1}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7, gap: 6 }}>
                  <b style={{ color: "var(--green)", fontSize: 13 }} className="n">{fmtMoney(r.amount, r.currency)}</b>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{cairoTime(r.uploadedAt, lang)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.ownerName || "—"}</span>
                  <Link href={`/customers/${r.customerId}`} style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-d)" }}>{tr("openCustomerCard")}</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(4,10,22,.72)", display: "grid", placeItems: "center", zIndex: 90, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 800, color: "var(--ink)" }}>{lightbox.customerName}</div>
                <div className="n" style={{ fontSize: 12, color: "var(--muted)", direction: "ltr" }}>{lightbox.phone1} · {fmtMoney(lightbox.amount, lightbox.currency)}</div>
              </div>
              <button onClick={() => setLightbox(null)} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9, width: 32, height: 32, cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ background: "var(--bg)", display: "grid", placeItems: "center", maxHeight: "62vh", overflow: "auto" }}>
              {signed[lightbox.receiptUrl]
                ? <img src={signed[lightbox.receiptUrl]} alt={lightbox.customerName} style={{ maxWidth: "100%", display: "block" }} />
                : <span style={{ padding: 40, color: "var(--muted)" }}>…</span>}
            </div>
            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{lightbox.ownerName || "—"} · {cairoTime(lightbox.uploadedAt, lang)}</span>
              <Link href={`/customers/${lightbox.customerId}`} className="btn" style={{ fontSize: 13 }}>{tr("openCustomerCard")}</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
