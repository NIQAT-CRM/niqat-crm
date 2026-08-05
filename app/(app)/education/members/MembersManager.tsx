"use client";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

type Profile = { id: string; full_name: string | null; team: string | null; phone: string | null };
type Member = {
  id: string;
  profile_id: string;
  role: string;
  active: boolean;
  can_edit_results: boolean;
  name: string;
  team: string | null;
};

const ROLES: [string, string][] = [
  ["edu_admin", "eduRoleAdmin"],
  ["edu_staff", "eduRoleStaff"],
  ["edu_grader", "eduRoleGrader"],
  ["edu_instructor", "eduRoleInstructor"],
];

const AV = ["#F08A24", "#0FA3A3", "#2F6BFF", "#7B61FF", "#18A957", "#E0483B", "#E6A700"];
const avc = (id: string) => { let h = 0; for (const ch of id || "") h += ch.charCodeAt(0); return AV[h % AV.length]; };
const ini = (n: string) => {
  const p = (n || "?").trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase();
};

export default function MembersManager({
  initialMembers, profiles, meId,
}: { initialMembers: Member[]; profiles: Profile[]; meId: string }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();

  const [rows, setRows] = useState<Member[]>(initialMembers);
  const [busy, setBusy] = useState<string | null>(null);
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState("edu_staff");
  const [adding, setAdding] = useState(false);

  const nameOf = (p: Profile) => (p.full_name && p.full_name.trim()) || p.phone || tr("eduNoName");
  const roleKey = (r: string) => ROLES.find((x) => x[0] === r)?.[1] || r;

  const available = useMemo(() => {
    const taken = new Set(rows.map((r) => r.profile_id));
    return profiles.filter((p) => !taken.has(p.id));
  }, [rows, profiles]);

  async function addMember() {
    if (!newUser) return toast(tr("eduPickUserFirst"));
    setAdding(true);
    const { data, error } = await supabase
      .from("edu_members")
      .insert({ profile_id: newUser, role: newRole, active: true, can_edit_results: false, created_by: meId })
      .select("id, profile_id, role, active, can_edit_results")
      .single();
    setAdding(false);
    if (error) { toast(error.code === "23505" ? tr("eduMemberExists") : error.message); return; }
    const p = profiles.find((x) => x.id === newUser);
    setRows((r) => [
      {
        id: data!.id, profile_id: data!.profile_id, role: data!.role,
        active: data!.active, can_edit_results: data!.can_edit_results,
        name: p ? nameOf(p) : "—", team: p?.team || null,
      },
      ...r,
    ]);
    setNewUser(""); setNewRole("edu_staff");
    toast(tr("eduAddedMember"));
    router.refresh();
  }

  async function patch(m: Member, changes: Partial<Pick<Member, "role" | "active" | "can_edit_results">>) {
    setBusy(m.id);
    const { error } = await supabase.from("edu_members").update(changes).eq("id", m.id);
    setBusy(null);
    if (error) { toast(error.message); return; }
    setRows((r) => r.map((x) => (x.id === m.id ? { ...x, ...changes } : x)));
    toast(tr("saved"));
    router.refresh();
  }

  async function toggleActive(m: Member) {
    if (m.active) {
      const ok = await confirmDialog({ message: tr("eduConfirmDeactivate"), danger: true });
      if (!ok) return;
    }
    patch(m, { active: !m.active });
  }

  return (
    <div className="page-h" style={{ display: "block" }}>
      <div>
        <h1>{tr("eduMembersTitle")}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{tr("eduMembersDesc")}</p>
      </div>

      {/* فورم الإضافة */}
      <div className="card" style={{ padding: 16, marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={newUser} onChange={(e) => setNewUser(e.target.value)} style={sel} disabled={available.length === 0}>
          <option value="">{available.length === 0 ? tr("eduNoUsersLeft") : tr("eduSelectUser")}</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>{nameOf(p)}{p.team ? ` · ${p.team}` : ""}</option>
          ))}
        </select>
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={sel}>
          {ROLES.map(([v, k]) => <option key={v} value={v}>{tr(k)}</option>)}
        </select>
        <button className="btn" onClick={addMember} disabled={adding || !newUser}>{tr("eduAddMember")}</button>
      </div>

      {/* قائمة الأعضاء */}
      <div className="card" style={{ marginTop: 16, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>{tr("eduNoMembers")}</div>
        ) : (
          rows.map((m) => (
            <div key={m.id} style={row}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 200px", minWidth: 180 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: avc(m.profile_id), color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{ini(m.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  {m.team && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{m.team}</div>}
                </div>
              </div>

              <select value={m.role} onChange={(e) => patch(m, { role: e.target.value })} disabled={busy === m.id} style={{ ...sel, minWidth: 130 }}>
                {ROLES.map(([v, k]) => <option key={v} value={v}>{tr(k)}</option>)}
              </select>

              <div style={{ flex: "1 1 160px", minWidth: 140 }}>
                {m.role === "edu_staff" ? (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: "var(--muted)" }} title={tr("eduEditResultsHint")}>
                    <Toggle on={m.can_edit_results} busy={busy === m.id} onClick={() => patch(m, { can_edit_results: !m.can_edit_results })} />
                    {tr("eduEditResults")}
                  </label>
                ) : m.role === "edu_grader" ? (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{tr("eduGraderAlways")}</span>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="chip" style={{ background: m.active ? "var(--brand-soft)" : "#eef2f8", color: m.active ? "var(--brand-d)" : "#6b7280" }}>
                  {m.active ? tr("eduStatusActive") : tr("eduStatusInactive")}
                </span>
                <button className={"btn sm " + (m.active ? "danger" : "ghost")} onClick={() => toggleActive(m)} disabled={busy === m.id}>
                  {m.active ? tr("eduDeactivate") : tr("eduActivate")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const sel: CSSProperties = {
  height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--line)",
  background: "var(--card)", color: "var(--text)", fontSize: 13, fontWeight: 600, minWidth: 200,
};
const row: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
  borderBottom: "1px solid var(--line)", flexWrap: "wrap",
};

function Toggle({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <span
      onClick={busy ? undefined : onClick}
      role="switch"
      aria-checked={on}
      style={{
        width: 38, height: 22, borderRadius: 999, background: on ? "var(--brand)" : "#c7cfdb",
        position: "relative", transition: "background .15s", flexShrink: 0,
        opacity: busy ? 0.5 : 1, cursor: busy ? "default" : "pointer",
      }}
    >
      <span style={{
        position: "absolute", top: 2, insetInlineStart: on ? 18 : 2, width: 18, height: 18,
        borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s",
      }} />
    </span>
  );
}
