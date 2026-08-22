import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { t as tr } from "@/lib/i18n";
import WatiCard from "./WatiCard";
import OptionsList from "./OptionsList";
import SettingsTabs, { type SettingsTab } from "./SettingsTabs";
import DefaultsCard from "./DefaultsCard";
import CompanyCard from "./CompanyCard";
import ShortcutsManager from "./ShortcutsManager";
import ServiceTypesManager from "./ServiceTypesManager";
import AffiliatesManager from "../affiliates/AffiliatesManager";
import UsersManager from "../users/UsersManager";
import ChatLogView from "../admin/chat-log/ChatLogView";
import MembersManager from "../education/members/MembersManager";

export const dynamic = "force-dynamic";

const TEAM_AR: Record<string, string> = { sales: "المبيعات", support: "الدعم", admin: "الإدارة", ops: "العمليات", operations: "العمليات" };
const USER_COLS = "id,full_name,team,phone,can_edit_customers,can_see_finance,can_view_reports,can_manage_tickets,can_manage_batches,can_grant_access,can_message,can_export,can_manage_settings,can_manage_users,can_see_daily_sales,can_use_ai,ai_options,can_add_customers,can_view_pipeline,can_view_support,can_view_activations,can_view_universities,can_view_receipts,can_view_education,can_view_feedback,can_view_dashboard,can_view_customers,can_view_tasks,can_view_batches,can_view_refunds,can_view_archive,can_view_prices";

async function safeList(supabase: any, table: string, col: string, extraCol?: string) {
  const sel = extraCol ? `id,${col},${extraCol}` : `id,${col}`;
  const { data, error } = await supabase.from(table).select(sel).order(col);
  if (error) return { items: [] as any[], missing: true };
  return { items: (data || []).map((r: any) => ({ id: r.id, label: r[col], extra: extraCol ? (r[extraCol] || "") : undefined })), missing: false };
}

// ============ تبويب المستخدمين والصلاحيات (+ سيكشن فريق التعليم للأدمن) ============
async function buildUsersTab(supabase: any, meId: string, isAdmin: boolean): Promise<SettingsTab> {
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

  // سيكشن فريق التعليم — طبقة edu_members منفصلة (للأدمن العام بس)
  let eduSection: any = null;
  if (isAdmin) {
    const { data: memRows } = await supabase.from("edu_members")
      .select("id, profile_id, role, active, can_edit_results, created_at")
      .order("created_at", { ascending: false });
    const byId = new Map(users.map((p: any) => [p.id, p]));
    const eduMembers = ((memRows as any[]) || []).map((m: any) => {
      const p: any = byId.get(m.profile_id);
      return {
        id: m.id, profile_id: m.profile_id, role: m.role, active: m.active,
        can_edit_results: m.can_edit_results,
        name: (p?.full_name && p.full_name.trim()) || p?.phone || "—",
        team: p?.team || null,
      };
    });
    eduSection = (
      <div style={{ marginTop: 28, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
        <MembersManager initialMembers={eduMembers} profiles={users as any} meId={meId} />
      </div>
    );
  }

  return {
    key: "users",
    label: "👤 " + tr("users"),
    content: (
      <>
        <div className="sec-t" style={{ marginTop: 4, marginBottom: 4 }}>{tr("users")}</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>{users.length} {tr("userWord")} — {tr("unlimitedAdd")}</p>
        <UsersManager profiles={users} />
        {eduSection}
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
  let tablesMissing = false;

  // ===== تبويبات الإعدادات (تكاملات/كتالوج/أفيلييت) — تظهر لمن عنده can_manage_settings =====
  if (canSettings) {
    const [watiRow, defRow, coRow, stRow, affRow, access, spec, dip, uni, src, cty, scRows] = await Promise.all([
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
      safeList(supabase, "countries", "name"),
      supabase.from("keyboard_shortcuts").select("id,code,combo,category,action_type,target,label_ar,label_en,perm,context,enabled,sort").order("sort"),
    ]);

    const wRaw = (watiRow.data?.value as any) || {};
    const wati = {
      endpoint: wRaw.endpoint || "https://live-server.wati.io/api/v1",
      token: wRaw.token || "",
      sender_sales: wRaw.sender_sales || wRaw.sender || "",
      sender_support: wRaw.sender_support || "",
    };
    const affiliates = Array.isArray(affRow.data?.value) ? (affRow.data!.value as any[]) : [];
    tablesMissing = uni.missing;

    tabs.push({
      key: "integrations",
      label: "⚙️ " + tr("tabIntegrations"),
      content: (
        <div className="intgrid">
          <WatiCard initial={wati} />
          <DefaultsCard initial={(defRow.data?.value as any) || {}} />
          <CompanyCard initial={(coRow.data?.value as any) || {}} />
          {isAdmin && <ShortcutsManager initial={(scRows.data as any[]) || []} />}
        </div>
      ),
    });
    tabs.push({
      key: "catalog",
      label: "📚 " + tr("tabCatalog"),
      content: (
        <>
          <div className="sec-t" style={{ marginTop: 8, marginBottom: 4 }}>{tr("manageLists")}</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 14px" }}>{tr("manageListsHint")} {tr("servicesInBatchesHint")}</p>
          <div className="setgrid">
            <OptionsList title={tr("manageDiplomas")} hint={tr("manageDiplomasHint")} table="diplomas" labelCol="name_ar" initial={dip.items} extraCol="batch_code_prefix" extraPlaceholder={tr("batchCodePrefixPh")} />
            <ServiceTypesManager initial={(stRow.data as any[]) || []} />
            <OptionsList title={tr("manageSpecialties")} hint={tr("manageSpecialtiesHint")} table="specialties" labelCol="name_ar" initial={spec.items} />
            <OptionsList title={tr("manageAccessOptions")} hint={tr("manageAccessOptionsHint")} table="access_options" labelCol="label" initial={access.items} />
            <OptionsList title={tr("manageSources")} hint={tr("manageSourcesHint")} table="sources" labelCol="name" initial={src.items} />
            <OptionsList title={tr("manageCountries")} hint={tr("manageCountriesHint")} table="countries" labelCol="name" initial={cty.items} />
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
  if (canUsers) tabs.push(await buildUsersTab(supabase, user?.id || "", isAdmin));

  // ===== تبويب سجل الشات — للأدمن فقط =====
  if (isAdmin) tabs.push(await buildChatLogTab(supabase));

  // ترتيب التبويبات النهائي المطلوب
  const TAB_ORDER = ["users", "catalog", "team", "integrations", "chatlog"];
  tabs.sort((a, b) => {
    const ia = TAB_ORDER.indexOf(a.key), ib = TAB_ORDER.indexOf(b.key);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="settings-page">
      <div className="page-h"><div><h1>{tr("settings")}</h1><p>{tr("settingsDesc")}</p></div></div>

      <SettingsTabs tabs={tabs} />
    </div>
  );
}
