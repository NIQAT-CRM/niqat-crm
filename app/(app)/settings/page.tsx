import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { t as tr } from "@/lib/i18n";
import WatiCard from "./WatiCard";
import OptionsList from "./OptionsList";
import SettingsTabs, { type SettingsTab } from "./SettingsTabs";
import DefaultsCard from "./DefaultsCard";
import CompanyCard from "./CompanyCard";
import ServiceTypesManager from "./ServiceTypesManager";
import AffiliatesManager from "../affiliates/AffiliatesManager";
import UsersManager from "../users/UsersManager";
import ChatLogView from "../admin/chat-log/ChatLogView";

export const dynamic = "force-dynamic";

const TEAM_AR: Record<string, string> = { sales: "المبيعات", support: "الدعم", admin: "الإدارة", ops: "العمليات", operations: "العمليات" };
const USER_COLS = "id,full_name,team,phone,can_edit_customers,can_see_finance,can_view_reports,can_manage_tickets,can_manage_batches,can_grant_access,can_message,can_export,can_manage_settings,can_manage_users,can_see_daily_sales,can_use_ai,ai_options,can_add_customers,can_view_pipeline,can_view_support,can_view_activations,can_view_universities,can_view_receipts";

async function safeList(supabase: any, table: string, col: string, extraCol?: string) {
  const sel = extraCol ? `id,${col},${extraCol}` : `id,${col}`;
  const { data, error } = await supabase.from(table).select(sel).order(col);
  if (error) return { items: [] as any[], missing: true };
  return { items: (data || []).map((r: any) => ({ id: r.id, label: r[col], extra: extraCol ? (r[extraCol] || "") : undefined })), missing: false };
}

// ============ تبويب المستخدمين والصلاحيات ============
async function buildUsersTab(supabase: any): Promise<SettingsTab> {
  let usersRes: any = await supabase.from("profiles").select(USER_COLS).order("team");
  if (usersRes.error) {
    usersRes = await supabase.from("profiles").select(USER_COLS.replace(",phone", "").replace(",can_see_daily_sales", "")).order("team");
  }
  const users = (usersRes.data as any[]) || [];

  // الإيميل بيعيش في auth.users — بنجيبه بالـ admin لو المفتاح متضاف (يتخطّى بأمان لو مش موجود)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey && users.length) {
    try {
      const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emailById = new Map((authList?.users || []).map((u: any) => [u.id, u.email]));
      for (const u of users) u.email = emailById.get(u.id) || "";
    } catch { /* تجاهل بأمان */ }
  }

  return {
    key: "users",
    label: "👤 " + tr("users"),
    content: (
      <>
        <div className="sec-t" style={{ marginTop: 4, marginBottom: 4 }}>{tr("users")}</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>{users.length} {tr("userWord")} — {tr("unlimitedAdd")}</p>
        <UsersManager profiles={users} />
      </>
    ),
  };
}

// ============ تبويب سجل الشات (أدمن فقط) ============
async function buildChatLogTab(supabase: any): Promise<SettingsTab> {
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

  return { key: "chatlog", label: "💬 " + tr("chatLogNav"), content: <ChatLogView items={items} rooms={rooms} /> };
}

export default async function Settings() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: prof } = await supabase.from("profiles")
    .select("can_manage_settings,can_manage_users,team").eq("id", user?.id || "").maybeSingle();

  const canSettings = !!prof?.can_manage_settings;
  const canUsers = !!prof?.can_manage_users;
  const isAdmin = (prof?.team || "").toLowerCase() === "admin";

  // مفيش أي صلاحية إعدادات؟ ممنوع
  if (!canSettings && !canUsers && !isAdmin) {
    return (<div className="page-h"><div><h1>{tr("settings")}</h1><p>{tr("noSettingsAccess")}</p></div></div>);
  }

  const tabs: SettingsTab[] = [];

  // ===== تبويبات الإعدادات (تكاملات/كتالوج/أفيلييت) — تظهر لمن عنده can_manage_settings =====
  if (canSettings) {
    const [watiRow, defRow, coRow, stRow, affRow, access, spec, dip, uni, src] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "wati").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "defaults").maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "company").maybeSingle(),
      supabase.from("service_types").select("id,slug,name,activation_label,sort").order("sort"),
      supabase.from("app_settings").select("value").eq("key", "affiliates").maybeSingle(),
      safeList(supabase, "access_options", "label"),
      safeList(supabase, "specialties", "name_ar"),
      safeList(supabase, "diplomas", "name_ar", "batch_code_prefix"),
      safeList(supabase, "universities", "name"),
      safeList(supabase, "sources", "name"),
    ]);

    const wRaw = (watiRow.data?.value as any) || {};
    const wati = {
      endpoint: wRaw.endpoint || "https://live-server.wati.io/api/v1",
      token: wRaw.token || "",
      sender_sales: wRaw.sender_sales || wRaw.sender || "",
      sender_support: wRaw.sender_support || "",
    };
    const affiliates = Array.isArray(affRow.data?.value) ? (affRow.data!.value as any[]) : [];

    tabs.push({
      key: "integrations",
      label: "⚙️ " + tr("tabIntegrations"),
      content: (
        <>
          <div className="settings-anim" style={{ marginBottom: 18 }}><WatiCard initial={wati} /></div>
          <DefaultsCard initial={(defRow.data?.value as any) || {}} />
          <CompanyCard initial={(coRow.data?.value as any) || {}} />
        </>
      ),
    });
    tabs.push({
      key: "catalog",
      label: "📚 " + tr("tabCatalog"),
      content: (
        <>
          <ServiceTypesManager initial={(stRow.data as any[]) || []} />
          <div className="sec-t" style={{ marginTop: 8, marginBottom: 4 }}>{tr("manageLists")}</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>{tr("manageListsHint")} {tr("servicesInBatchesHint")}</p>
          <div className="settings-grid">
            <OptionsList title={tr("manageDiplomas")} hint={tr("manageDiplomasHint")} table="diplomas" labelCol="name_ar" initial={dip.items} extraCol="batch_code_prefix" extraPlaceholder={tr("batchCodePrefixPh")} />
            <OptionsList title={tr("manageSpecialties")} hint={tr("manageSpecialtiesHint")} table="specialties" labelCol="name_ar" initial={spec.items} />
            <OptionsList title={tr("manageAccessOptions")} hint={tr("manageAccessOptionsHint")} table="access_options" labelCol="label" initial={access.items} />
            <OptionsList title={tr("manageSources")} hint={tr("manageSourcesHint")} table="sources" labelCol="name" initial={src.items} />
            <OptionsList title={tr("manageUniversities")} hint={tr("manageUniversitiesHint")} table="universities" labelCol="name" initial={uni.items} />
          </div>
        </>
      ),
    });
    tabs.push({
      key: "team",
      label: "👥 " + tr("tabAffTeam"),
      content: (
        <>
          <div className="sec-t" style={{ marginTop: 4, marginBottom: 4 }}>{tr("manageAff")}</div>
          <div className="card settings-anim" style={{ padding: 18 }}>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>{tr("affiliatesManagerHint")}</p>
            <AffiliatesManager initial={affiliates} />
          </div>
        </>
      ),
    });
  }

  // ===== تبويب المستخدمين — لمن عنده can_manage_users =====
  if (canUsers) tabs.push(await buildUsersTab(supabase));

  // ===== تبويب سجل الشات — للأدمن فقط =====
  if (isAdmin) tabs.push(await buildChatLogTab(supabase));

  return (
    <div className="settings-page">
      <div className="page-h"><div><h1>{tr("settings")}</h1><p>{tr("settingsDesc")}</p></div></div>

      <SettingsTabs tabs={tabs} />
    </div>
  );
}
