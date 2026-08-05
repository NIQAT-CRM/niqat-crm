import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// طبقة التعليم (edu_members) منفصلة تماماً عن profiles.team.
// الهيلبر ده بيجمع حقائق عضوية اليوزر في التعليم لاستخدامها في العزل وحماية الصفحات.
export type EduMember = {
  userId: string | null;
  isMember: boolean;       // عنده صف edu_members نشط
  role: string | null;     // edu_admin | edu_staff | edu_grader | edu_instructor | null
  canEditResults: boolean; // مفتاح تعديل النتائج (edu_members.can_edit_results)
  isAdmin: boolean;        // أدمن عام (profiles.team === 'admin') — فوق تيم التعليم دايماً
  canViewFlag: boolean;    // profiles.can_view_education (مشاهد قديم، غير عضو)
  canView: boolean;        // وصول لمنطقة التعليم عموماً
  eduMode: boolean;        // عضو تعليم صافي (عضو && مش أدمن عام) → قايمة معزولة
};

export async function getEduMember(): Promise<EduMember> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empty: EduMember = {
    userId: null, isMember: false, role: null, canEditResults: false,
    isAdmin: false, canViewFlag: false, canView: false, eduMode: false,
  };
  if (!user) return empty;

  const [profRes, emRes] = await Promise.all([
    supabase.from("profiles").select("team, can_view_education").eq("id", user.id).maybeSingle(),
    supabase.from("edu_members").select("role, active, can_edit_results")
      .eq("profile_id", user.id).eq("active", true).maybeSingle(),
  ]);

  const prof: any = profRes.data;
  const em: any = emRes.data;

  const isAdmin = (prof?.team || "").toLowerCase() === "admin";
  const isMember = !!em;
  const role = (em?.role as string) || null;
  const canEditResults = !!em?.can_edit_results;
  const canViewFlag = !!prof?.can_view_education;
  const canView = isAdmin || isMember || canViewFlag;
  const eduMode = isMember && !isAdmin;

  return { userId: user.id, isMember, role, canEditResults, isAdmin, canViewFlag, canView, eduMode };
}

// حارس صفحات التعليم.
// allowedRoles فاضية = أي عضو تعليم نشط. لو مش مطابق → redirect("/").
// allowOpsViewer=true بيسمح لمشاهد can_view_education القديم (اللي مش عضو) — للشجرة بس.
export async function requireEdu(allowedRoles: string[] = [], allowOpsViewer = false): Promise<EduMember> {
  const m = await getEduMember();
  const roleOk = m.isMember && (allowedRoles.length === 0 || allowedRoles.includes(m.role || ""));
  const opsOk = allowOpsViewer && !m.isMember && m.canViewFlag;
  if (!(m.isAdmin || roleOk || opsOk)) redirect("/");
  return m;
}
