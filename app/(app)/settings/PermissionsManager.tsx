"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = { id: string; full_name: string | null; team: string | null; [k: string]: any };

const PERMS: [string, string][] = [
  ["can_edit_customers", "تعديل العملاء"],
  ["can_see_finance", "رؤية المالية"],
  ["can_view_reports", "رؤية التقارير"],
  ["can_manage_tickets", "إدارة الدعم"],
  ["can_manage_batches", "إدارة الباتشات"],
  ["can_manage_settings", "إدارة الإعدادات"],
  ["can_manage_users", "إدارة المستخدمين"],
  ["can_grant_access", "منح صلاحية الدخول"],
  ["can_message", "إرسال واتساب"],
  ["can_export", "تصدير البيانات"],
];

export default function PermissionsManager({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Profile[]>(profiles);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(pid: string, col: string, current: boolean) {
    const key = pid + col;
    setBusy(key);
    setRows((rs) => rs.map((r) => (r.id === pid ? { ...r, [col]: !current } : r)));
    const { error } = await supabase.from("profiles").update({ [col]: !current }).eq("id", pid);
    setBusy(null);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === pid ? { ...r, [col]: current } : r)));
      alert("تعذّر التحديث: " + error.message);
    }
  }

  return (
    <div>
      {rows.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          لا يوجد أعضاء بعد.
        </div>
      )}

      {rows.map((p) => (
        <div key={p.id} className="ucard">
          <div className="ucard-h" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800, color: "var(--ink)" }}>{p.full_name || "—"}</div>
            <span className="chip">{p.team || "—"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24, rowGap: 10 }}>
            {PERMS.map(([col, label]) => {
              const on = !!p[col];
              const isBusy = busy === p.id + col;
              return (
                <div key={col} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, opacity: isBusy ? 0.5 : 1 }}>
                  <span style={{ fontSize: 14, color: "var(--ink)" }}>{label}</span>
                  <div className={"sw" + (on ? " on" : "")} onClick={() => !isBusy && toggle(p.id, col, on)}><i /></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        ملاحظة: الأعضاء بيظهروا هنا بعد ما يتعمل لهم حساب دخول. دلوقتي ظاهر حسابات الإدارة بس.
      </p>
    </div>
  );
}
