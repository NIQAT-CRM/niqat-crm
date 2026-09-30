"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";

type Row = { diploma_id: string | null; diploma_name: string | null; batch_id: string | null; batch_code: string | null; ym: string; egp: number; usd: number; cnt: number };

const nf = new Intl.NumberFormat("en-US");
const fmt = (n: number) => nf.format(Math.round(Number(n) || 0));

export default function BatchSalesCard() {
  const tr = useT();
  const lang = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState(false);
  const [openDip, setOpenDip] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || rows !== null) return;
    (async () => {
      try { const r: any = await createClient().rpc("sales_by_batch_month"); setRows(r.error ? [] : ((r.data as Row[]) || [])); }
      catch { setRows([]); }
    })();
  }, [open]);

  const monthLabel = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 15)); };

  // تجميع: دبلومة → باتش → شهور
  const tree = useMemo(() => {
    const dips = new Map<string, { name: string; egp: number; usd: number; batches: Map<string, { code: string; egp: number; usd: number; months: Row[] }> }>();
    for (const r of (rows || [])) {
      const dk = r.diploma_id || "—", bk = r.batch_id || "—";
      if (!dips.has(dk)) dips.set(dk, { name: r.diploma_name || "— بدون دبلومة —", egp: 0, usd: 0, batches: new Map() });
      const d = dips.get(dk)!; d.egp += Number(r.egp) || 0; d.usd += Number(r.usd) || 0;
      if (!d.batches.has(bk)) d.batches.set(bk, { code: r.batch_code || "—", egp: 0, usd: 0, months: [] });
      const b = d.batches.get(bk)!; b.egp += Number(r.egp) || 0; b.usd += Number(r.usd) || 0; b.months.push(r);
    }
    return Array.from(dips.entries()).map(([id, d]) => ({ id, ...d, batches: Array.from(d.batches.values()).sort((a, b) => a.code.localeCompare(b.code)) }))
      .sort((a, b) => b.egp - a.egp);
  }, [rows]);

  const toggleDip = (id: string) => setOpenDip((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="bs-card">
      <style>{css}</style>
      <div className="bs-head" onClick={() => setOpen((o) => !o)}>
        <div><h3>🎓 {tr("batchSalesTitle")}</h3><p>{tr("batchSalesHint")}</p></div>
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--muted)" strokeWidth={2.4} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
      </div>

      {open && (
        rows === null ? <div className="bs-empty">…</div>
        : tree.length === 0 ? <div className="bs-empty">{tr("noSalesData")}</div>
        : (
          <div className="bs-tree">
            {tree.map((d) => {
              const o = openDip.has(d.id);
              return (
                <div key={d.id} className="bs-dip">
                  <button className={"bs-diphead" + (o ? " on" : "")} onClick={() => toggleDip(d.id)}>
                    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.4} style={{ transform: o ? "none" : "rotate(-90deg)", transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
                    <span className="bs-dipname">{d.name}</span>
                    <span className="bs-dipbadge">{d.batches.length} {tr("batchesWord")}</span>
                    <span className="bs-diptot n">{fmt(d.egp)}<i>{tr("egp")}</i>{d.usd > 0 ? <b>${fmt(d.usd)}</b> : null}</span>
                  </button>
                  {o && (
                    <div className="bs-batches">
                      {d.batches.map((b, i) => (
                        <div key={i} className="bs-batch">
                          <div className="bs-btop"><span className="bs-bcode">{b.code}</span><span className="bs-btot n">{fmt(b.egp)}<i>{tr("egp")}</i>{b.usd > 0 ? <b>${fmt(b.usd)}</b> : null}</span></div>
                          <div className="bs-months">
                            {b.months.slice().sort((x, y) => x.ym.localeCompare(y.ym)).map((m) => (
                              <div key={m.ym} className="bs-mo">
                                <span className="bs-moname">{monthLabel(m.ym)}</span>
                                <span className="bs-moval n">{fmt(m.egp)}<i>{tr("egp")}</i>{Number(m.usd) > 0 ? <b>${fmt(m.usd)}</b> : null}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

const css = `
.bs-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--sh);padding:16px 18px;width:100%}
.bs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;cursor:pointer}
.bs-head h3{font-size:15px;font-weight:800;color:var(--ink);margin:0}
.bs-head p{font-size:11.5px;color:var(--muted);margin:3px 0 0;font-weight:600}
.bs-empty{font-size:13px;color:var(--muted);padding:16px 2px;text-align:center}
.bs-tree{margin-top:14px;display:flex;flex-direction:column;gap:8px;max-height:520px;overflow-y:auto}
.bs-dip{border:1px solid var(--line);border-radius:12px;overflow:hidden}
.bs-diphead{width:100%;display:flex;align-items:center;gap:9px;padding:12px 14px;background:var(--bg);border:none;cursor:pointer;font-family:inherit;color:var(--ink);text-align:start}
.bs-diphead.on{background:var(--brand-soft)}
.bs-diphead svg{color:var(--muted);flex-shrink:0}
.bs-diphead.on svg{color:var(--brand-d)}
.bs-dipname{font-size:13.5px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bs-dipbadge{font-size:10px;font-weight:700;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:2px 9px;font-family:var(--fd);white-space:nowrap;flex-shrink:0}
.bs-diptot{margin-inline-start:auto;font-family:var(--fd);font-weight:800;font-size:13px;color:var(--brand-d);direction:ltr;display:inline-flex;align-items:baseline;gap:4px;white-space:nowrap;flex-shrink:0}
.bs-diptot i{font-style:normal;font-size:9px;color:var(--muted);font-family:var(--fa);margin-inline-start:2px}
.bs-diptot b{font-family:var(--fd);font-size:10.5px;background:var(--blue-soft);color:var(--blue);padding:1px 6px;border-radius:10px;margin-inline-start:4px}
.bs-batches{padding:8px 12px;display:flex;flex-direction:column;gap:8px}
.bs-batch{border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:var(--surface)}
.bs-btop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;padding-bottom:7px;border-bottom:1px dashed var(--line)}
.bs-bcode{font-size:12px;font-weight:800;color:var(--ink);font-family:var(--fd)}
.bs-btot{font-family:var(--fd);font-weight:800;font-size:12.5px;color:var(--green);direction:ltr;display:inline-flex;align-items:baseline;gap:3px}
.bs-btot i{font-style:normal;font-size:9px;color:var(--muted);font-family:var(--fa);margin-inline-start:2px}
.bs-btot b{font-family:var(--fd);font-size:10px;background:var(--blue-soft);color:var(--blue);padding:1px 6px;border-radius:10px;margin-inline-start:3px}
.bs-months{display:flex;flex-direction:column;gap:3px}
.bs-mo{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 2px}
.bs-moname{font-size:11.5px;color:var(--muted);font-weight:600}
.bs-moval{font-family:var(--fd);font-weight:700;font-size:12px;color:var(--ink);direction:ltr;display:inline-flex;align-items:baseline;gap:3px}
.bs-moval i{font-style:normal;font-size:8.5px;color:var(--muted);font-family:var(--fa);margin-inline-start:2px}
.bs-moval b{font-family:var(--fd);font-size:10px;background:var(--blue-soft);color:var(--blue);padding:1px 5px;border-radius:9px;margin-inline-start:3px}
.bs-tree::-webkit-scrollbar{width:6px}
.bs-tree::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
`;
