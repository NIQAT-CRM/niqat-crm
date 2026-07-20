import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLang, tFor } from "@/lib/i18n";
import ChatLogView from "./ChatLogView";

export const dynamic = "force-dynamic";

const TEAM_AR: Record<string, string> = { sales: "المبيعات", support: "الدعم", admin: "الإدارة", ops: "العمليات", operations: "العمليات" };

export default async function ChatLogPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("team").eq("id", user.id).maybeSingle();
  const lang = getLang();
  const t = tFor(lang);
  if ((profile?.team || "").toLowerCase() !== "admin") {
    return <div className="page-h"><div><h1>{t("chatLogTitle")}</h1><p>{t("noReportsAccess")}</p></div></div>;
  }

  // كل الرسائل (RLS بيسمح للأدمن)
  const { data: rows } = await supabase.from("internal_messages")
    .select("id,room_id,sender_id,body,customer_id,attachment_path,created_at")
    .order("created_at", { ascending: false }).limit(500);
  const msgs = (rows as any[]) || [];

  const [profRes, roomRes, custRes] = await Promise.all([
    supabase.from("profiles").select("id,full_name,team"),
    supabase.from("internal_rooms").select("id,key,team_a,team_b"),
    (async () => {
      const cids = Array.from(new Set(msgs.map((m) => m.customer_id).filter(Boolean)));
      if (!cids.length) return { data: [] };
      return supabase.from("customers").select("id,name").in("id", cids);
    })(),
  ]);
  const prof = new Map(((profRes.data as any[]) || []).map((p) => [p.id, { name: p.full_name || "—", team: (p.team || "").toLowerCase() }]));
  const custMap = new Map((((custRes as any).data as any[]) || []).map((c) => [c.id, c.name]));
  const roomMap = new Map(((roomRes.data as any[]) || []).map((r) => [r.id, r]));

  const items = msgs.map((m) => {
    const s = prof.get(m.sender_id);
    const room = roomMap.get(m.room_id);
    const other = room ? (s?.team === room.team_a ? room.team_b : room.team_a) : "";
    return {
      id: m.id,
      sender: s?.name || "—",
      senderTeam: TEAM_AR[s?.team || ""] || s?.team || "",
      toTeam: TEAM_AR[other] || other || "",
      roomKey: room?.key || "",
      body: m.body || "",
      customer: m.customer_id ? (custMap.get(m.customer_id) || "") : "",
      customerId: m.customer_id || "",
      hasAttachment: !!m.attachment_path,
      at: String(m.created_at || "").slice(0, 16).replace("T", " "),
    };
  });

  const rooms = ((roomRes.data as any[]) || []).map((r) => ({
    key: r.key, label: `${TEAM_AR[r.team_a] || r.team_a} ↔ ${TEAM_AR[r.team_b] || r.team_b}`,
  }));

  return <ChatLogView items={items} rooms={rooms} />;
}
