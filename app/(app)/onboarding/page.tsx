import Link from "next/link";
import { t as tr } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("handoffs")
    .select("id,customer_id,assignee_id,note,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: custs } = await supabase.from("customers").select("id,name,stage");
  const cMap = new Map((custs || []).map((c) => [c.id, c.name]));
  const cStage = new Map((custs || []).map((c) => [c.id, c.stage]));
  const { data: profs } = await supabase.from("profiles").select("id,full_name");
  const pMap = new Map((profs || []).map((p) => [p.id, p.full_name]));

  const { data: items } = await supabase.from("handoff_items").select("handoff_id,id,done");
  const itemCount = new Map<string, number>();
  const doneCount = new Map<string, number>();
  for (const it of (items || []) as any[]) {
    const hid = it.handoff_id;
    itemCount.set(hid, (itemCount.get(hid) || 0) + 1);
    if (it.done) doneCount.set(hid, (doneCount.get(hid) || 0) + 1);
  }

  function fmtDate(d: string) {
    try { return new Date(d).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }); } catch { return d; }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>{tr("onboarding")}</h1>
          <p>{(rows || []).length} تسليم في الانتظار</p>
        </div>
      </div>
      {(!rows || rows.length === 0) ? (
        <div className="empty"><b>لا توجد عمليات تسليم معلّقة</b></div>
      ) : (
        <div className="grid2" style={{ marginTop: 4 }}>
          {(rows || []).map((h: any) => {
            const total = itemCount.get(h.id) || 0;
            const done = doneCount.get(h.id) || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const stage = cStage.get(h.customer_id) || "";
            return (
              <Link key={h.id} href={`/customers/${h.customer_id}`} className="card" style={{ padding: 16, display: "block", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <b style={{ color: "var(--ink)", fontSize: 15 }}>{cMap.get(h.customer_id) || "—"}</b>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {stage === "enrolled" ? <span style={{ color: "#18A957" }}>مسجّل</span> : <span style={{ color: "#F08A24" }}>{stage}</span>}
                      {h.created_at ? <> · {fmtDate(h.created_at)}</> : null}
                    </div>
                  </div>
                  <span className="stg" style={{ background: "#F08A241a", color: "#F08A24", whiteSpace: "nowrap" }}>
                    {total > 0 ? `${done}/${total}` : "بانتظار"}
                  </span>
                </div>
                {h.note && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>📝 {h.note}</div>}
                {total > 0 && (
                  <div style={{ marginTop: 10, height: 6, background: "#eef2f8", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ width: pct + "%", height: "100%", background: pct === 100 ? "#18A957" : "#F08A24", borderRadius: 10 }} />
                  </div>
                )}
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
                  المسؤول: {pMap.get(h.assignee_id || "") || "غير معيّن"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
