import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_message, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!me?.can_message && !isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY مش متضاف في Vercel" }, { status: 500 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: row } = await admin.from("app_settings").select("value").eq("key", "wati").maybeSingle();
  const wati: any = row?.value || {};
  const endpoint = String(wati.endpoint || "").replace(/\/+$/, "");
  const token = String(wati.token || "").replace(/^\s*bearer\s+/i, "").trim();
  if (!endpoint || !token) return NextResponse.json({ error: "إعدادات WATI ناقصة — ظبّطها من الإعدادات" }, { status: 400 });

  try {
    // نلف على كل الصفحات — WATI بيحطّ حد لعدد القوالب في الصفحة، فلو مجبناش كل الصفحات بتختفي قوالب
    const raw: any[] = [];
    const seenRaw = new Set<string>();
    const PSIZE = 100;
    for (let page = 1; page <= 30; page++) {
      const r = await fetch(`${endpoint}/api/v1/getMessageTemplates?pageSize=${PSIZE}&pageNumber=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) { if (page === 1) return NextResponse.json({ error: j?.info || j?.message || `WATI HTTP ${r.status}` }, { status: 502 }); break; }
      const batch: any[] = j?.messageTemplates || j?.templates || j?.data || [];
      if (!batch.length) break;
      let added = 0;
      for (const t of batch) {
        const nm = t.elementName || t.name || t.template_name || "";
        if (!nm) continue;
        const key = nm + "|" + (t.language || t.languageCode || t.locale || "");
        if (!seenRaw.has(key)) { seenRaw.add(key); raw.push(t); added++; }
      }
      if (added === 0) break; // الصفحة مفيهاش جديد (WATI رجّع نفس الصفحة) → خلصنا
    }

    // الاسم + أسماء المتغيّرات الفعلية + الحالة
    const all = raw.map((t) => {
      const name = t.elementName || t.name || t.template_name || "";
      const body = t.bodyOriginal || t.body || (Array.isArray(t.elements) ? (t.elements.find((e: any) => e.type === "BODY")?.text || "") : "") || "";
      let params = (String(body).match(/\{\{\s*([\w\d_]+)\s*\}\}/g) || []).map((m) => m.replace(/[{}\s]/g, ""));
      if (!params.length && Array.isArray(t.customParams)) params = t.customParams.map((p: any) => p.paramName || p.name).filter(Boolean);
      params = Array.from(new Set(params));
      const status = String(t.status || t.templateStatus || t.approvalStatus || "").toUpperCase();
      return { name, body, params, vars: params.length, status };
    }).filter((t) => t.name);

    // المعتمدة فقط (اللي ينفع تتبعت). لو WATI مرجّعش حالة أصلاً → نعرض الكل
    const anyStatus = all.some((t) => t.status);
    const chosen = anyStatus ? all.filter((t) => t.status === "APPROVED") : all;

    // قالب واحد لكل اسم (نتجاهل تكرار اللغات)
    const seen = new Set<string>();
    const templates = chosen.filter((t) => (seen.has(t.name) ? false : (seen.add(t.name), true)))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ ok: true, templates, total: all.length, approved: templates.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "فشل الاتصال بـ WATI" }, { status: 502 });
  }
}
