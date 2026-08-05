import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const EDU_ROLES = ["edu_admin", "edu_staff", "edu_grader", "edu_instructor"];

// كل الصلاحيات الحسّاسة تتقفل على عضو التعليم المدعو (عزل تام + منع تصعيد)
const ZERO_PERMS: Record<string, boolean> = {
  can_edit_customers: false, can_see_finance: false, can_view_reports: false,
  can_manage_tickets: false, can_manage_batches: false, can_manage_settings: false,
  can_manage_users: false, can_grant_access: false, can_export: false,
  can_message: false, can_view_education: false,
};

// حارس: الأدمن العام أو مدير التعليم (edu_admin نشط) فقط
async function guard() {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: "غير مسجّل دخول" }, { status: 401 }) };

  const { data: prof } = await supabase.from("profiles").select("team").eq("id", user.id).maybeSingle();
  const isAdmin = (prof?.team || "").toLowerCase() === "admin";

  let isEduAdmin = false;
  if (!isAdmin) {
    const { data: em } = await supabase.from("edu_members")
      .select("role, active").eq("profile_id", user.id).eq("active", true).maybeSingle();
    isEduAdmin = !!em && (em as any).role === "edu_admin";
  }
  if (!isAdmin && !isEduAdmin) {
    return { err: NextResponse.json({ error: "الصلاحية دي لمدير التعليم أو الأدمن العام بس" }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { err: NextResponse.json({ error: "مفتاح SUPABASE_SERVICE_ROLE_KEY مش متضاف في إعدادات Vercel." }, { status: 500 }) };
  }
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return { meId: user.id, admin };
}

// POST: دعوة عضو تعليم جديد بالإيميل (ينشئ حساب معزول + صف edu_members)
export async function POST(req: Request) {
  const g = await guard();
  if ("err" in g) return g.err;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  const role = String(body.role || "").trim();
  if (!email) return NextResponse.json({ error: "الإيميل مطلوب" }, { status: 400 });
  if (!EDU_ROLES.includes(role)) return NextResponse.json({ error: "قيمة الدور غير صحيحة" }, { status: 400 });

  const origin = new URL(req.url).origin;
  const redirectTo = `${origin}/auth/callback?next=/accept-invite`;

  // 1) دعوة بالإيميل = إنشاء الحساب (المستخدم يحط باسورده من اللينك)
  const { data: invited, error: iErr } = await g.admin!.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });
  if (iErr || !invited?.user) {
    const e: any = iErr || {};
    const blob = `${e.message || ""} ${e.code || ""} ${e.name || ""}`.toLowerCase();
    let msg: string;
    if (/already|exists|registered|422|email_exists/.test(blob)) {
      msg = "فيه حساب بنفس الإيميل ده قبل كده. لو عايز تضيفه للتعليم استخدم «اختَر مستخدم موجود».";
    } else if (/sending|smtp|mail|email|relay|550|535|connection|timeout|econn/.test(blob)) {
      msg = "فشل إرسال إيميل الدعوة (إعدادات SMTP). " + (e.message || "");
    } else {
      msg = "تعذّر إرسال الدعوة. " + (e.message || "");
    }
    console.error("edu invite failed:", JSON.stringify(e));
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const newId = invited.user.id;

  // 2) ضبط البروفايل: فريق غير أدمن + صفر صلاحيات حسّاسة (العزل مفروض كمان بالـ middleware)
  await g.admin!.from("profiles").update({ full_name: fullName, team: "support", ...ZERO_PERMS }).eq("id", newId);

  // 3) ربط العضو بالتعليم بالدور المختار
  const { data: mem, error: mErr } = await g.admin!
    .from("edu_members")
    .insert({ profile_id: newId, role, active: true, can_edit_results: false, created_by: g.meId })
    .select("id, profile_id, role, active, can_edit_results")
    .single();
  if (mErr) {
    return NextResponse.json({ error: "اتبعتت الدعوة بس فشل ربط العضو بالتعليم: " + mErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, member: mem, name: fullName || email });
}
