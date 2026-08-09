import { createClient } from "@/lib/supabase/server";
import { brandedXlsx } from "@/lib/export/brandedXlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// حارس: أدمن عام أو عضو تعليم نشط أو من عنده can_export
async function guard(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 as const };
  const { data: prof } = await supabase.from("profiles").select("team, can_export").eq("id", user.id).maybeSingle();
  const isAdmin = (prof?.team || "").toLowerCase() === "admin";
  let isMember = false;
  if (!isAdmin) {
    const { data: em } = await supabase.from("edu_members").select("active").eq("profile_id", user.id).eq("active", true).maybeSingle();
    isMember = !!em;
  }
  if (!isAdmin && !isMember && !prof?.can_export) return { ok: false, status: 403 as const };
  return { ok: true as const };
}

async function loadCompany(supabase: any): Promise<{ name: string; logo: Buffer | null; ext: "png" | "jpeg" }> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "company").maybeSingle();
  const name = (data?.value?.name as string) || "NIQAT";
  const path = data?.value?.logo as string | undefined;
  let logo: Buffer | null = null;
  let ext: "png" | "jpeg" = "png";
  if (path) {
    try {
      const dl = await supabase.storage.from("receipts").download(path);
      if (dl.data) { logo = Buffer.from(await dl.data.arrayBuffer()); ext = /\.jpe?g$/i.test(path) ? "jpeg" : "png"; }
    } catch { /* بدون لوجو */ }
  }
  return { name, logo, ext };
}

// أعمدة التصدير الوحيدة المسموحة (صفر ماليات): الاسم | التخصص | الإيميل | الدبلومة | الباتش
export async function POST(req: Request) {
  const supabase = createClient();
  const g = await guard(supabase);
  if (!g.ok) return new Response(g.status === 401 ? "Unauthorized" : "Forbidden", { status: g.status });

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const batchId = String(body.batch_id || "").trim();
  if (!batchId) return new Response("batch_id required", { status: 400 });

  // بيانات الباتش (من الـ view — بدون سعر)
  const { data: bat } = await supabase.from("edu_v_batches").select("id, code, diploma_id").eq("id", batchId).maybeSingle();
  const batchCode = (bat?.code as string) || "";

  // اشتراكات الباتش → customer_id + diploma_id لكل عميل في الباتش ده
  const { data: enr } = await supabase.from("enrollments").select("customer_id, diploma_id").eq("batch_id", batchId).limit(5000);
  const rowsEnr = (enr || []) as any[];
  const ids = [...new Set(rowsEnr.map((e) => e.customer_id).filter(Boolean))];
  if (!ids.length) return new Response("No rows", { status: 400 });

  // قوائم مرجعية
  const [{ data: cs }, { data: specs }, { data: dips }] = await Promise.all([
    supabase.from("edu_v_customers").select("id, name, email, specialty_id").in("id", ids),
    supabase.from("specialties").select("id, name_ar, name_en"),
    supabase.from("diplomas").select("id, name_ar, name_en"),
  ]);
  const custMap = new Map<string, any>(((cs || []) as any[]).map((c) => [c.id, c]));
  const specMap = new Map<string, string>(((specs || []) as any[]).map((s) => [s.id, s.name_en || s.name_ar || ""]));
  const dipMap = new Map<string, string>(((dips || []) as any[]).map((d) => [d.id, d.name_ar || d.name_en || ""]));

  // صف لكل اشتراك في الباتش (لو عميل مكرر في نفس الباتش — نادر — بيظهر مرة لكل صف، طبيعي)
  const rows: (string | number)[][] = [];
  for (const e of rowsEnr) {
    const c = custMap.get(e.customer_id);
    if (!c) continue;
    rows.push([
      c.name || "",
      specMap.get(c.specialty_id) || "",
      c.email || "",
      dipMap.get(e.diploma_id) || "",
      batchCode,
    ]);
  }
  if (!rows.length) return new Response("No rows", { status: 400 });

  const headers = ["الاسم", "التخصص", "الإيميل", "اسم الدبلومة", "الباتش"];
  const company = await loadCompany(supabase);
  const buf = await brandedXlsx({
    title: `Batch ${batchCode}`, companyName: company.name, logo: company.logo, logoExt: company.ext,
    headers, rows, rtl: true,
  });

  const fname = `niqat-education-${batchCode || "batch"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname.replace(/[^\x20-\x7e]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
