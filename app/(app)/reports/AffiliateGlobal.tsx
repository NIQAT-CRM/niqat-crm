"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

type Opt = { v: string; label: string };
type Aff = { code: string; name: string; rate?: number; phone?: string };
type Cust = { id: string; name: string; phone: string; code: string; diploma: string; batch: string; agreed: number; collected: number; paid: boolean; refunded: boolean };
type Row = { code: string; name: string; phone: string; rate: number; customers: number; paidN: number; notPaidN: number; refundedN: number; sales: number; commission: number; collected: number };

const money = (n: number) => new Intl.NumberFormat("en").format(Math.round(n || 0));

export default function AffiliateGlobal({ affiliates, diplomas, batches, canFinance }: {
  affiliates: Aff[]; diplomas: Opt[]; batches: Opt[]; canFinance: boolean;
}) {
  const tr = useT();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [custs, setCusts] = useState<Cust[]>([]);
  const [q, setQ] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const affByCode = useMemo(() => new Map(affiliates.map((a) => [a.code.toUpperCase(), a])), [affiliates]);
  const dipName = useMemo(() => new Map(diplomas.map((d) => [d.v, d.label])), [diplomas]);
  const batchName = useMemo(() => new Map(batches.map((b) => [b.v, b.label])), [batches]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: cs } = await supabase.from("customers")
          .select("id,name,phone1,affiliate_code,stage").eq("deleted", false)
          .not("affiliate_code", "is", null).neq("affiliate_code", "");
        const cList = (cs || []) as any[];
        const ids = cList.map((c) => c.id);
        if (!ids.length) { setCusts([]); setLoading(false); return; }

        const { data: enrs } = await supabase.from("enrollments").select("id,customer_id,diploma_id,batch_id").in("customer_id", ids);
        const eList = (enrs || []) as any[];
        const enrIds = eList.map((e) => e.id);
        const { data: refunds } = await supabase.from("refunds").select("customer_id").in("customer_id", ids);
        const refSet = new Set((refunds || []).map((r: any) => r.customer_id));

        const agreedByEnr = new Map<string, number>();
        const paidByEnr = new Map<string, number>();
        if (canFinance && enrIds.length) {
          const [{ data: fin }, { data: insts }] = await Promise.all([
            supabase.from("enrollment_finance").select("enrollment_id,agreed_amount").in("enrollment_id", enrIds),
            supabase.from("installments").select("enrollment_id,amount,status,paid_at").in("enrollment_id", enrIds),
          ]);
          (fin || []).forEach((f: any) => agreedByEnr.set(f.enrollment_id, Number(f.agreed_amount) || 0));
          (insts || []).forEach((i: any) => { if (i.status === "paid" || i.paid_at) paidByEnr.set(i.enrollment_id, (paidByEnr.get(i.enrollment_id) || 0) + (Number(i.amount) || 0)); });
        }

        const enrByCust = new Map<string, any[]>();
        eList.forEach((e) => { const arr = enrByCust.get(e.customer_id) || []; arr.push(e); enrByCust.set(e.customer_id, arr); });

        const out: Cust[] = cList.map((c) => {
          const es = enrByCust.get(c.id) || [];
          let agreed = 0, collected = 0;
          const dips = new Set<string>(), bts = new Set<string>();
          es.forEach((e) => {
            agreed += agreedByEnr.get(e.id) || 0;
            collected += paidByEnr.get(e.id) || 0;
            if (e.diploma_id) dips.add(dipName.get(e.diploma_id) || "");
            if (e.batch_id) bts.add(batchName.get(e.batch_id) || "");
          });
          return {
            id: c.id, name: c.name || "—", phone: c.phone1 || "", code: (c.affiliate_code || "").trim().toUpperCase(),
            diploma: Array.from(dips).filter(Boolean).join(" / ") || "—",
            batch: Array.from(bts).filter(Boolean).join(" / ") || "—",
            agreed, collected, paid: c.stage === "enrolled", refunded: refSet.has(c.id),
          };
        });
        setCusts(out);
      } catch { setCusts([]); }
      setLoading(false);
    })();
  }, [supabase, canFinance, dipName, batchName]);

  const rows: Row[] = useMemo(() => {
    const m = new Map<string, Row>();
    for (const c of custs) {
      if (!c.code) continue;
      const a = affByCode.get(c.code);
      let r = m.get(c.code);
      if (!r) { r = { code: c.code, name: a?.name && a.name !== "—" ? a.name : c.code, phone: a?.phone || "", rate: Number(a?.rate) || 0, customers: 0, paidN: 0, notPaidN: 0, refundedN: 0, sales: 0, commission: 0, collected: 0 }; m.set(c.code, r); }
      r.customers++;
      if (c.refunded) { r.refundedN++; continue; }
      if (c.paid) { r.paidN++; r.sales += c.agreed; r.collected += c.collected; }
      else r.notPaidN++;
    }
    const arr = Array.from(m.values());
    arr.forEach((r) => { r.commission = Math.round((r.sales * r.rate) / 100); });
    arr.sort((a, b) => b.customers - a.customers);
    return arr;
  }, [custs, affByCode]);

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return r.code.toLowerCase().includes(s) || r.name.toLowerCase().includes(s);
  });

  const totals = useMemo(() => ({
    partners: rows.length,
    customers: rows.reduce((s, r) => s + r.customers, 0),
    commission: rows.reduce((s, r) => s + r.commission, 0),
  }), [rows]);

  const th: React.CSSProperties = { padding: "9px 12px", textAlign: "start", color: "var(--muted)", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 12px", fontSize: 13, color: "var(--ink)" };

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

      <input className="inp" placeholder={tr("affSearchPh")} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320, marginBottom: 12 }} />

      {filtered.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{tr("noData")}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg)" }}>
                <th style={th}>{tr("code")}</th>
                <th style={th}>{tr("affiliate")}</th>
                <th style={th}>{tr("customerCount")}</th>
                <th style={th}>✅ {tr("paid")}</th>
                <th style={th}>⏳ {tr("unpaid")}</th>
                {canFinance && <th style={th}>{tr("salesBaseCol")}</th>}
                {canFinance && <th style={th}>{tr("commissionCol")}</th>}
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <>
                  <tr key={r.code} style={{ borderTop: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setOpenCode(openCode === r.code ? null : r.code)}>
                    <td style={{ ...td, fontWeight: 800, color: "var(--brand-d)" }} dir="ltr">{r.code}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{r.name}{r.refundedN > 0 && <span style={{ fontSize: 10.5, color: "#E0483B", marginInlineStart: 6 }}>↩{r.refundedN}</span>}</td>
                    <td style={td}><b>{r.customers}</b></td>
                    <td style={{ ...td, color: "#18A957", fontWeight: 700 }}>{r.paidN}</td>
                    <td style={{ ...td, color: "#C7891A", fontWeight: 700 }}>{r.notPaidN}</td>
                    {canFinance && <td style={td} dir="ltr"><span className="num">{money(r.sales)}</span></td>}
                    {canFinance && <td style={{ ...td, color: "#18A957", fontWeight: 800 }} dir="ltr"><span className="num">{money(r.commission)}</span></td>}
                    <td style={{ ...td, textAlign: "end", color: "var(--muted)" }}>{openCode === r.code ? "▲" : "▼"}</td>
                  </tr>
                  {openCode === r.code && (
                    <tr style={{ background: "var(--bg)" }}>
                      <td colSpan={canFinance ? 8 : 6} style={{ padding: 10 }}>
                        {r.phone && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>📞 <span dir="ltr">{r.phone}</span></div>}
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
