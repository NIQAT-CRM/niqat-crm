"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import BatchActions from "./BatchActions";
import AddBatch from "./AddBatch";

type Opt = { v: string; label: string };
export type B = {
  id: string; code: string; diploma: string; diploma_id: string;
  status: string; start_date: string | null; end_date: string | null;
  capacity: number | null; enrolled: number; price: number | null;
  currency: string; notes: string | null;
  price_egp: number | null; price_usd: number | null; kind: string;
  service_id?: string | null; price_frozen_at?: string | null; done?: boolean; eprice?: any;
};

function statusMeta(tr: (k: string) => string, status: string) {
  if (status === "open" || !status) return { l: tr("batchOpen"), c: "var(--green)" };
  return { l: tr("batchEnded"), c: "#94A2BB" };
}

export default function BatchesView({ batches, canManage, diplomaOpts, diplomas = [], serviceTypes = [], services = [] }: {
  batches: B[]; canManage: boolean; diplomaOpts: Opt[]; diplomas?: { id: string; name: string; prefix?: string }[];
  serviceTypes?: { slug: string; name: string }[];
  services?: { id: string; name: string; code: string | null }[];
}) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<string>("diploma");
  const [dip, setDip] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [linkSvc, setLinkSvc] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const isService = tab !== "diploma";
  const efmt = (n: any) => n == null || isNaN(Number(n)) ? "—" : new Intl.NumberFormat("en").format(Math.round(Number(n)));
  async function doLink() {
    if (!linkFor || !linkSvc) return;
    setLinkBusy(true);
    await supabase.from("batches").update({ service_id: linkSvc }).eq("id", linkFor);
    setLinkBusy(false); setLinkFor(null); setLinkSvc(""); router.refresh();
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return batches.filter((b) =>
      ((b.kind || "diploma") === tab) &&
      (isService || !dip || b.diploma_id === dip) &&
      (!status || (status === "open" ? (b.status === "open" || !b.status) : (b.status !== "open" && !!b.status))) &&
      (!qq || (b.code || "").toLowerCase().includes(qq))
    );
  }, [batches, tab, isService, dip, status, q]);

  const sel: React.CSSProperties = { height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", padding: "0 10px", fontSize: 13 };

  return (
    <div>
      {/* تبويبات: باتشات الدبلومات / الاعتمادات / المشاريع */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        {([["diploma", tr("tabDiplomaBatches")], ...serviceTypes.map((t) => [t.slug, t.name] as [string, string])]).map(([k, lbl]) => (
          <button key={k} type="button" onClick={() => { setTab(k as any); setDip(""); }}
            style={{
              padding: "10px 16px", fontSize: 13.5, fontWeight: 700, background: "none", position: "relative",
              color: tab === k ? "var(--brand-d)" : "var(--muted)",
              borderBottom: tab === k ? "2px solid var(--brand)" : "2px solid transparent", marginBottom: -1,
            }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* شريط الأدوات */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isService ? tr("searchServicePh") : tr("searchBatchPh")}
          style={{ ...sel, flex: 1, minWidth: 150 }} dir="rtl" />
        {!isService && (
          <select value={dip} onChange={(e) => setDip(e.target.value)} style={sel}>
            <option value="">{tr("filterDip")}</option>
            {diplomaOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={sel}>
          <option value="">{tr("allStatuses")}</option>
          <option value="open">{tr("batchOpen")}</option>
          <option value="closed">{tr("batchEnded")}</option>
        </select>
        {canManage && <AddBatch kind={tab} diplomas={diplomas} services={services} />}
      </div>

      {filtered.length === 0 && (
        <div style={{ fontSize: 13.5, color: "var(--muted)", padding: 24, textAlign: "center" }}>{tr("noBatchesMatch")}</div>
      )}

      {/* عرض الكروت */}
      {filtered.length > 0 && (
        <div className="bgrid">
          {filtered.map((b) => {
            const seats = Number(b.capacity) || 0;
            const pct = seats ? Math.min(100, Math.round((b.enrolled / seats) * 100)) : 0;
            const st = statusMeta(tr, b.status);
            return (
              <div key={b.id} className="bcard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    {b.diploma && <div style={{ color: "var(--brand)", fontSize: 12.5, fontWeight: 700 }}>{b.diploma}</div>}
                    <div className="bcode">{b.code}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{b.notes || ""}</div>
                  </div>
                  <span className="stg" style={{ background: st.c + "1a", color: st.c }}>{st.l}</span>
                </div>
                {!isService && (
                  <>
                    <div style={{ margin: "14px 0 6px", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span style={{ color: "var(--muted)" }}>{tr("seats")}</span>
                      <b className="num">{b.enrolled}/{seats || "—"}</b>
                    </div>
                    <div className="bbar"><i style={{ width: pct + "%" }} /></div>
                  </>
                )}
                <div style={{ marginTop: 14 }}>
                  {isService ? (
                    <div className="brow"><span>{tr("subscribers")}</span><b className="num">{b.enrolled}</b></div>
                  ) : (
                    <>
                      <div className="brow"><span>{tr("bookingStart")}</span><b className="num">{b.start_date ? String(b.start_date).slice(0, 10) : "—"}</b></div>
                      <div className="brow"><span>{tr("bookingEnd")}</span><b className="num">{b.end_date ? String(b.end_date).slice(0, 10) : "—"}</b></div>
                    </>
                  )}
                  {!b.service_id && (Number(b.price_egp) > 0 || Number(b.price_usd) > 0) && (
                    <div className="brow"><span>{tr("batchPrice")}</span><b className="num" dir="ltr">{new Intl.NumberFormat("en").format(Number(b.price_egp) || 0)} {tr("egpShort")} · {new Intl.NumberFormat("en").format(Number(b.price_usd) || 0)} $</b></div>
                  )}
                  {b.service_id ? (
                    b.eprice ? (
                      <div style={{ marginTop: 8, padding: "10px 11px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--line)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 700 }}>{tr("servicePrice")}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: b.eprice.source === "frozen" ? "var(--blue-soft)" : "var(--green-soft)", color: b.eprice.source === "frozen" ? "var(--blue)" : "var(--green)" }}>
                            {b.eprice.source === "frozen" ? "🔒 " + tr("frozenPrice") : "● " + tr("livePrice")}
                          </span>
                        </div>
                        {(() => {
                          const ep = b.eprice; const np = Number(ep.normal_pct) || 0; const ap = Number(ep.affiliate_pct) || 0;
                          const rows: { lbl: string; base: any; dollar?: boolean }[] = [];
                          if (ep.base_single != null) rows.push({ lbl: tr("singlePrice"), base: ep.base_single });
                          else {
                            if (ep.base_old != null) rows.push({ lbl: "🇪🇬 " + tr("tierOldShort"), base: ep.base_old });
                            if (ep.base_recent != null) rows.push({ lbl: "🇪🇬 " + tr("tierRecentShort"), base: ep.base_recent });
                            if (ep.base_intl != null) rows.push({ lbl: "🌍 " + tr("tierIntl"), base: ep.base_intl, dollar: true });
                          }
                          if (!rows.length) return <b className="num">—</b>;
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 5, fontSize: 9, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                                <span>{tr("tierWord")}</span><span style={{ textAlign: "center" }}>{tr("baseWord")}</span><span style={{ textAlign: "center", color: "var(--green)" }}>{tr("normalWord")} -{Number(ep.normal_pct) || 0}%</span><span style={{ textAlign: "center", color: "var(--blue)" }}>{tr("affiliateWord")} -{Number(ep.affiliate_pct) || 0}%</span>
                              </div>
                              {rows.map((r, i) => {
                                const s = r.dollar ? "$" : "", suf = r.dollar ? "" : " " + tr("egpShort");
                                return (
                                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 5, fontSize: 11, alignItems: "center", fontFamily: "var(--fa)" }}>
                                    <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: 10.5 }}>{r.lbl}</span>
                                    <b className="num" dir="ltr" style={{ textAlign: "center", color: "var(--ink)" }}>{s}{efmt(r.base)}</b>
                                    <b className="num" dir="ltr" style={{ textAlign: "center", color: "var(--green)", fontWeight: 700 }}>{s}{efmt(Number(r.base) * (1 - np / 100))}</b>
                                    <b className="num" dir="ltr" style={{ textAlign: "center", color: "var(--blue)", fontWeight: 700 }}>{s}{efmt(Number(r.base) * (1 - ap / 100))}</b>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        {b.eprice.source === "frozen" && (
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--line)" }}>🔒 {tr("frozenNote")}{b.price_frozen_at ? " · " + String(b.price_frozen_at).slice(0, 10) : ""}</div>
                        )}
                      </div>
                    ) : (
                      <div className="brow"><span>{tr("servicePrice")}</span><b className="num">—</b></div>
                    )
                  ) : (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 11px", background: "var(--amber-soft,#FBF1DC)", borderRadius: 10 }}>
                      <span style={{ fontSize: 11.5, color: "var(--amber)", fontWeight: 700 }}>⚠ {tr("notLinkedToService")}</span>
                      {canManage && <button onClick={() => setLinkFor(b.id)} style={{ border: "none", background: "var(--brand)", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: 11, padding: "5px 11px", borderRadius: 8, cursor: "pointer" }}>{tr("linkToService")}</button>}
                    </div>
                  )}
                </div>
                {canManage && (
                  <BatchActions
                    batch={{ id: b.id, code: b.code, status: b.status || "open", start_date: b.start_date, end_date: b.end_date, capacity: b.capacity, notes: b.notes, price: b.price, currency: b.currency || "EGP", price_egp: b.price_egp, price_usd: b.price_usd, service_id: b.service_id } as any}
                    enrolledCount={b.enrolled}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {linkFor && (
        <div onClick={() => !linkBusy && setLinkFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(21,34,59,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,.28)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>{tr("linkToService")}</h3>
            <select className="inp" value={linkSvc} onChange={(e) => setLinkSvc(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
              <option value="">{tr("chooseService")}</option>
              {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}{sv.code ? ` — ${sv.code}` : ""}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setLinkFor(null)} className="btn ghost" disabled={linkBusy}>{tr("cancel")}</button>
              <button onClick={doLink} className="btn" disabled={linkBusy || !linkSvc}>{linkBusy ? "..." : tr("linkBtn")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
