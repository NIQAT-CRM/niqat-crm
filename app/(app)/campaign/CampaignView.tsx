"use client";
import { useMemo, useState } from "react";
import { useT, useLang } from "@/lib/i18n/client";

export type Reg = {
  id: string; createdAt: string; fullName: string; email: string; whatsapp: string;
  specialization: string; country: string; experience: string; role: string;
  software: string; source: string; status: string;
};

const nf = new Intl.NumberFormat("en-US");
function cairoDay(iso: string) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }
  catch { return String(iso).slice(0, 10); }
}

export default function CampaignView({ rows }: { rows: Reg[] }) {
  const tr = useT();
  const lang = useLang();
  const [tab, setTab] = useState<"dash" | "list">("dash");

  return (
    <div>
      <div className="cmp-tabs">
        <button className={tab === "dash" ? "on" : ""} onClick={() => setTab("dash")}>📊 {tr("campDashboard")}</button>
        <button className={tab === "list" ? "on" : ""} onClick={() => setTab("list")}>📋 {tr("campRegistrations")} <span className="cmp-cnt">{rows.length}</span></button>
      </div>
      {tab === "dash" ? <Dashboard rows={rows} tr={tr} lang={lang} /> : <RegList rows={rows} tr={tr} lang={lang} />}
      <style>{css}</style>
    </div>
  );
}

/* ============ الداشبورد ============ */
function Dashboard({ rows, tr, lang }: { rows: Reg[]; tr: any; lang: string }) {
  const stats = useMemo(() => {
    const today = cairoDay(new Date().toISOString());
    const now = Date.now();
    const d7 = now - 7 * 864e5, d30 = now - 30 * 864e5;
    let tToday = 0, t7 = 0, t30 = 0;
    const byDay = new Map<string, number>();
    const grp = (f: keyof Reg) => { const m = new Map<string, number>(); for (const r of rows) { const k = (r[f] || "—").toString().trim() || "—"; m.set(k, (m.get(k) || 0) + 1); } return Array.from(m.entries()).sort((a, b) => b[1] - a[1]); };
    for (const r of rows) {
      const day = cairoDay(r.createdAt); byDay.set(day, (byDay.get(day) || 0) + 1);
      if (day === today) tToday++;
      const t = new Date(r.createdAt).getTime();
      if (t >= d7) t7++; if (t >= d30) t30++;
    }
    // آخر 14 يوم
    const days: { day: string; n: number }[] = [];
    for (let i = 13; i >= 0; i--) { const d = cairoDay(new Date(now - i * 864e5).toISOString()); days.push({ day: d, n: byDay.get(d) || 0 }); }
    return { total: rows.length, tToday, t7, t30, days,
      spec: grp("specialization"), country: grp("country"), source: grp("source"), exp: grp("experience"), status: grp("status") };
  }, [rows]);

  const kpis = [
    { label: tr("campTotal"), val: stats.total, icon: "👥", c: "var(--brand)" },
    { label: tr("campToday"), val: stats.tToday, icon: "📅", c: "var(--green)" },
    { label: tr("campLast7"), val: stats.t7, icon: "📈", c: "var(--blue)" },
    { label: tr("campLast30"), val: stats.t30, icon: "🗓️", c: "var(--purple)" },
  ];
  const maxDay = Math.max(1, ...stats.days.map((d) => d.n));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div className="cmp-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="cmp-kpi">
            <div className="cmp-kpi-ico" style={{ background: k.c + "22" }}>{k.icon}</div>
            <div><div className="cmp-kpi-val n">{nf.format(k.val)}</div><div className="cmp-kpi-lbl">{k.label}</div></div>
          </div>
        ))}
      </div>

      {/* رسم بياني يومي */}
      <div className="cmp-card">
        <h3>{tr("campDailyChart")}</h3>
        <div className="cmp-chart">
          {stats.days.map((d) => (
            <div key={d.day} className="cmp-bar-wrap" title={`${d.day}: ${d.n}`}>
              <div className="cmp-bar-val n">{d.n || ""}</div>
              <div className="cmp-bar" style={{ height: `${Math.max(4, (d.n / maxDay) * 100)}%` }} />
              <div className="cmp-bar-day n">{d.day.slice(8)}/{d.day.slice(5, 7)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* تحليلات */}
      <div className="cmp-breakdowns">
        <Breakdown title={tr("colSpecialization")} data={stats.spec} total={stats.total} color="var(--brand)" />
        <Breakdown title={tr("colCountry")} data={stats.country} total={stats.total} color="var(--blue)" />
        <Breakdown title={tr("campSource")} data={stats.source} total={stats.total} color="var(--green)" />
        <Breakdown title={tr("colExperience")} data={stats.exp} total={stats.total} color="var(--purple)" />
      </div>
    </div>
  );
}

function Breakdown({ title, data, total, color }: { title: string; data: [string, number][]; total: number; color: string }) {
  const top = data.slice(0, 6);
  const max = Math.max(1, ...top.map((d) => d[1]));
  return (
    <div className="cmp-card">
      <h3>{title}</h3>
      {top.length === 0 ? <div className="cmp-empty">—</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {top.map(([k, n]) => (
            <div key={k} className="cmp-brow">
              <div className="cmp-blabel" title={k}>{k}</div>
              <div className="cmp-btrack"><div className="cmp-bfill" style={{ width: `${(n / max) * 100}%`, background: color }} /></div>
              <div className="cmp-bval n">{nf.format(n)}<span>{total ? ` · ${Math.round((n / total) * 100)}%` : ""}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ قائمة التسجيلات ============ */
function RegList({ rows, tr, lang }: { rows: Reg[]; tr: any; lang: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [spec, setSpec] = useState("");
  const [source, setSource] = useState("");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const uniq = (f: keyof Reg) => Array.from(new Set(rows.map((r) => (r[f] || "").toString().trim()).filter(Boolean))).sort();
  const statuses = useMemo(() => uniq("status"), [rows]);
  const countries = useMemo(() => uniq("country"), [rows]);
  const specs = useMemo(() => uniq("specialization"), [rows]);
  const sources = useMemo(() => uniq("source"), [rows]);

  const fmtDate = (iso: string) => iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (country && r.country !== country) return false;
      if (spec && r.specialization !== spec) return false;
      if (source && r.source !== source) return false;
      if (!needle) return true;
      return [r.fullName, r.email, r.whatsapp, r.specialization, r.country, r.role, r.experience].some((v) => (v || "").toLowerCase().includes(needle));
    });
    list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1) * (dir === "desc" ? 1 : -1));
    return list;
  }, [rows, q, status, country, spec, source, dir]);

  function exportCsv() {
    const head = [tr("colCreatedAt"), tr("colFullName"), tr("colEmail"), tr("colWhatsapp"), tr("colSpecialization"), tr("colCountry"), tr("colExperience"), tr("colRole"), "software", tr("campSource"), tr("colStatus")];
    const lines = shown.map((r) => [fmtDate(r.createdAt), r.fullName, r.email, r.whatsapp, r.specialization, r.country, r.experience, r.role, r.software, r.source, r.status]);
    const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `campaign-registrations-${cairoDay(new Date().toISOString())}.csv`; a.click();
  }

  const cols = "150px 1.4fr 1.6fr 130px 1.2fr 100px 90px 1fr 110px";
  const H: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, color: "var(--muted)", padding: "10px 12px", whiteSpace: "nowrap" };
  const C: React.CSSProperties = { fontSize: 12.5, color: "var(--text)", padding: "11px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <input className="inp" placeholder={tr("searchColon")} value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 38, minWidth: 200, flex: 1 }} />
        <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38, width: "auto", minWidth: 120 }}><option value="">{tr("colStatus")}: {tr("allWord")}</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select className="inp" value={country} onChange={(e) => setCountry(e.target.value)} style={{ height: 38, width: "auto", minWidth: 120 }}><option value="">{tr("colCountry")}: {tr("allWord")}</option>{countries.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select className="inp" value={spec} onChange={(e) => setSpec(e.target.value)} style={{ height: 38, width: "auto", minWidth: 120 }}><option value="">{tr("colSpecialization")}: {tr("allWord")}</option>{specs.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select className="inp" value={source} onChange={(e) => setSource(e.target.value)} style={{ height: 38, width: "auto", minWidth: 110 }}><option value="">{tr("campSource")}: {tr("allWord")}</option>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <button className="btn ghost" style={{ height: 38 }} onClick={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}>{tr("colCreatedAt")} {dir === "desc" ? "↓" : "↑"}</button>
        <button className="btn" style={{ height: 38 }} onClick={exportCsv}>⬇ {tr("exportExcel")}</button>
        <span style={{ fontSize: 12, color: "var(--muted)", marginInlineStart: "auto" }}>{shown.length} / {rows.length}</span>
      </div>

      {rows.length === 0 ? <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--muted)" }}>{tr("noCampaignRows")}</div> : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "var(--sh)", overflowX: "auto" }}>
          <div style={{ minWidth: 1050 }}>
            <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
              {[tr("colCreatedAt"), tr("colFullName"), tr("colEmail"), tr("colWhatsapp"), tr("colSpecialization"), tr("colCountry"), tr("colExperience"), tr("colRole"), tr("colStatus")].map((h, i) => <div key={i} style={H}>{h}</div>)}
            </div>
            {shown.map((r, i) => (
              <div key={r.id || i} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--line)", alignItems: "center", background: i % 2 ? "transparent" : "var(--muted-soft)" }}>
                <div className="n" style={{ ...C, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{fmtDate(r.createdAt)}</div>
                <div style={{ ...C, fontWeight: 700, color: "var(--ink)" }} title={r.fullName}>{r.fullName || "—"}</div>
                <div style={{ ...C, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }} title={r.email}>{r.email || "—"}</div>
                <div className="n" style={{ ...C, direction: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>{r.whatsapp || "—"}</div>
                <div style={C} title={r.specialization}>{r.specialization || "—"}</div>
                <div style={C}>{r.country || "—"}</div>
                <div style={C}>{r.experience || "—"}</div>
                <div style={C} title={r.role}>{r.role || "—"}</div>
                <div style={C}><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: "var(--brand-soft)", color: "var(--brand-d)" }}>{r.status || "—"}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const css = `
.cmp-tabs{display:flex;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:4px;margin-bottom:16px;width:fit-content;box-shadow:var(--sh)}
.cmp-tabs button{border:none;background:none;font-family:inherit;font-size:13px;font-weight:700;color:var(--muted);padding:8px 16px;border-radius:9px;cursor:pointer;display:flex;align-items:center;gap:7px}
.cmp-tabs button.on{background:var(--ink);color:var(--surface)}
.cmp-cnt{font-size:11px;background:var(--brand-soft);color:var(--brand-d);padding:1px 8px;border-radius:12px;font-family:var(--fd)}
.cmp-tabs button.on .cmp-cnt{background:rgba(255,255,255,.2);color:#fff}
.cmp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
.cmp-kpi{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh);padding:16px;display:flex;align-items:center;gap:13px}
.cmp-kpi-ico{width:46px;height:46px;border-radius:12px;display:grid;place-items:center;font-size:22px;flex-shrink:0}
.cmp-kpi-val{font-family:var(--fd);font-weight:800;font-size:26px;color:var(--ink);line-height:1}
.cmp-kpi-lbl{font-size:12px;color:var(--muted);font-weight:600;margin-top:4px}
.cmp-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh);padding:16px 18px}
.cmp-card h3{font-size:14px;font-weight:800;color:var(--ink);margin:0 0 14px}
.cmp-chart{display:flex;align-items:flex-end;gap:6px;height:170px;padding-top:18px}
.cmp-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;gap:4px;min-width:0}
.cmp-bar-val{font-size:10px;font-weight:800;color:var(--muted);font-family:var(--fd);height:12px}
.cmp-bar{width:100%;max-width:34px;background:linear-gradient(180deg,var(--brand),var(--brand-d));border-radius:6px 6px 0 0;transition:height .3s;min-height:4px}
.cmp-bar-day{font-size:9px;color:var(--muted);font-family:var(--fd);white-space:nowrap}
.cmp-breakdowns{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.cmp-brow{display:grid;grid-template-columns:110px 1fr auto;gap:10px;align-items:center}
.cmp-blabel{font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-btrack{height:9px;background:var(--bg);border-radius:20px;overflow:hidden}
.cmp-bfill{height:100%;border-radius:20px;min-width:4px;transition:width .3s}
.cmp-bval{font-family:var(--fd);font-weight:800;font-size:12.5px;color:var(--ink);white-space:nowrap}
.cmp-bval span{color:var(--muted);font-weight:600;font-size:10.5px}
.cmp-empty{font-size:12.5px;color:var(--muted);padding:8px 0}
`;
