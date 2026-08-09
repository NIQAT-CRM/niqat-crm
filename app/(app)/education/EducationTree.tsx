"use client";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

type Batch = { id: string; code: string; status: string; count: number; start_date: string | null };
type Group = { id: string; name: string; batches: Batch[] };
type Cust = { id: string; name: string; phone1: string | null; email: string | null; specialty_id: string | null };
type SearchRow = Cust & { batches: string[] };

const COLORS = ["#F08A24", "#2F6BFF", "#0FA3A3", "#7B61FF", "#18A957", "#E6A700", "#E0483B", "#25D366"];

export default function EducationTree({
  groups, specialties,
}: { groups: Group[]; specialties: Record<string, string> }) {
  const tr = useT();
  const supabase = createClient();

  const [q, setQ] = useState("");
  const [openDip, setOpenDip] = useState<Record<string, boolean>>(groups[0] ? { [groups[0].id]: true } : {});
  const [openBatch, setOpenBatch] = useState<Record<string, boolean>>({});
  const [custCache, setCustCache] = useState<Record<string, Cust[] | "loading">>({});

  // بحث العملاء في قاعدة البيانات
  const [results, setResults] = useState<SearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debRef = useRef<any>(null);

  const specName = (id: string | null) => (id ? specialties[id] || "" : "");
  const batchCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const b of g.batches) m.set(b.id, b.code);
    return m;
  }, [groups]);

  // تصفية الشجرة (اسم الدبلومة / كود الباتش) فوريّاً
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groups;
    return groups
      .map((g) => {
        const dipHit = g.name.toLowerCase().includes(s);
        const batches = dipHit ? g.batches : g.batches.filter((b) => b.code.toLowerCase().includes(s));
        return dipHit || batches.length ? { ...g, batches } : null;
      })
      .filter(Boolean) as Group[];
  }, [q, groups]);

  // بحث العملاء (debounced) لما يكتب حرفين+
  useEffect(() => {
    const clean = q.replace(/[,%()]/g, " ").trim();
    if (debRef.current) clearTimeout(debRef.current);
    if (clean.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    debRef.current = setTimeout(async () => {
      const { data: cs } = await supabase.from("edu_v_customers")
        .select("id,name,phone1,phone2,email,specialty_id")
        .or(`name.ilike.%${clean}%,phone1.ilike.%${clean}%,phone2.ilike.%${clean}%,email.ilike.%${clean}%`)
        .limit(50);
      const list = (cs || []) as any[];
      const ids = list.map((c) => c.id);
      const byCust = new Map<string, string[]>();
      if (ids.length) {
        const { data: enr } = await supabase.from("enrollments").select("customer_id,batch_id").in("customer_id", ids);
        for (const e of (enr || []) as any[]) {
          const code = batchCode.get(e.batch_id);
          if (code) { const a = byCust.get(e.customer_id) || []; a.push(code); byCust.set(e.customer_id, a); }
        }
      }
      setResults(list.map((c) => ({ ...c, batches: byCust.get(c.id) || [] })));
      setSearching(false);
    }, 350);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [q, supabase, batchCode]);

  async function toggleBatch(b: Batch) {
    const willOpen = !openBatch[b.id];
    setOpenBatch((s) => ({ ...s, [b.id]: willOpen }));
    if (willOpen && !custCache[b.id]) {
      setCustCache((s) => ({ ...s, [b.id]: "loading" }));
      const { data: enr } = await supabase.from("enrollments").select("customer_id").eq("batch_id", b.id).limit(1000);
      const ids = [...new Set(((enr || []) as any[]).map((e) => e.customer_id).filter(Boolean))];
      let rows: Cust[] = [];
      if (ids.length) {
        const { data: cs } = await supabase.from("edu_v_customers")
          .select("id,name,phone1,email,specialty_id").in("id", ids);
        rows = (cs || []) as any[];
      }
      setCustCache((s) => ({ ...s, [b.id]: rows }));
    }
  }

  const CustRow = (c: Cust) => (
    <div key={c.id} style={row}>
      <div style={{ flex: "1 1 220px", minWidth: 160 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{c.name}</div>
        {specName(c.specialty_id) && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{specName(c.specialty_id)}</div>}
      </div>
      <div dir="ltr" style={{ fontSize: 12.5, color: "var(--muted)", minWidth: 110, textAlign: "start" }}>{c.phone1 || "—"}</div>
      <div dir="ltr" style={{ flex: "1 1 180px", fontSize: 12.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>{c.email || "—"}</div>
    </div>
  );

  return (
    <div className="page-h" style={{ display: "block" }}>
      <h1>{tr("eduDiplomasBatches")}</h1>

      {/* بحث */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("eduTreeSearchPh")}
        style={{ width: "100%", maxWidth: 460, height: 42, padding: "0 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--card)", color: "var(--text)", fontSize: 13.5, marginTop: 14 }}
      />

      {/* نتائج بحث العملاء */}
      {q.replace(/[,%()]/g, " ").trim().length >= 2 && (
        <div className="card" style={{ marginTop: 14, padding: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, color: "var(--muted)", padding: "8px 12px 4px" }}>
            {tr("eduCustResults")}{searching ? ` · ${tr("eduLoading")}` : results ? ` · ${results.length}` : ""}
          </div>
          {!searching && results && results.length === 0 && (
            <div style={{ padding: "10px 12px 14px", fontSize: 13, color: "var(--muted)" }}>{tr("eduNoCustResults")}</div>
          )}
          {results && results.map((c) => (
            <div key={c.id} style={{ ...row, alignItems: "center" }}>
              <div style={{ flex: "1 1 200px", minWidth: 150 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{c.name}</div>
                {specName(c.specialty_id) && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{specName(c.specialty_id)}</div>}
              </div>
              <div dir="ltr" style={{ fontSize: 12.5, color: "var(--muted)", minWidth: 110, textAlign: "start" }}>{c.phone1 || "—"}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: "1 1 140px" }}>
                {c.batches.length ? c.batches.map((code, i) => (
                  <span key={i} className="num" style={{ fontSize: 11, fontWeight: 700, background: "var(--muted-soft)", color: "var(--muted)", padding: "2px 7px", borderRadius: 6 }} dir="ltr">{code}</span>
                )) : <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* الشجرة */}
      {filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 18 }}>{tr("eduNoDiplomas")}</div>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((g, gi) => {
            const isOpen = !!openDip[g.id] || !!q.trim();
            const color = COLORS[gi % COLORS.length];
            const total = g.batches.reduce((a, b) => a + b.count, 0);
            const dipName = g.name === "__NODIP__" ? tr("eduNoDiploma") : g.name;
            return (
              <div key={g.id} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface)" }}>
                <button
                  onClick={() => setOpenDip((s) => ({ ...s, [g.id]: !isOpen }))}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5}
                    style={{ width: 15, height: 15, flexShrink: 0, transition: "transform .25s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 800, fontSize: 13.5, flex: 1, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dipName}</span>
                  <span className="chip" style={{ background: color + "1a", color, minWidth: 32, textAlign: "center" }}>{total}</span>
                </button>

                {isOpen && (
                  <div style={{ padding: "2px 10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {g.batches.map((b) => {
                      const bOpen = !!openBatch[b.id];
                      const rows = custCache[b.id];
                      return (
                        <div key={b.id} style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                          <button
                            onClick={() => toggleBatch(b)}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "start" }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.5}
                              style={{ width: 13, height: 13, flexShrink: 0, transition: "transform .25s", transform: bOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                              <path d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="num" style={{ minWidth: 60, fontSize: 12.5, fontWeight: 800, color: "var(--ink)" }} dir="ltr">{b.code}</span>
                            <span style={{ flex: 1 }} />
                            <span className="chip" style={{ background: "var(--muted-soft)", color: "var(--muted)", minWidth: 30, textAlign: "center" }}>{b.count}</span>
                          </button>

                          {bOpen && (
                            <div style={{ borderTop: "1px solid var(--line)", background: "var(--card)" }}>
                              {rows === "loading" || rows === undefined ? (
                                <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--muted)" }}>{tr("eduLoading")}</div>
                              ) : rows.length === 0 ? (
                                <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--muted)" }}>{tr("noCustomersInBatch")}</div>
                              ) : (
                                rows.map(CustRow)
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const row: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "9px 14px",
  borderBottom: "1px solid var(--line)", flexWrap: "wrap",
};
