import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// بيسحب كل كورسات Graphy (كل الصفحات) → { courses: [{id,title}] }
export async function GET() {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_use_graphy, team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_use_graphy) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const mid = (process.env.GRAPHY_MID || "").trim();
  const key = (process.env.GRAPHY_API_TOKEN || "").trim();
  if (!mid || !key) return NextResponse.json({ error: "إعدادات Graphy ناقصة في Vercel" }, { status: 500 });
  const base = "https://api.ongraphy.com";

  const all: { id: string; title: string }[] = [];
  let skip = 0; const limit = 50;
  try {
    for (let i = 0; i < 60; i++) {
      const r = await fetch(`${base}/public/v1/products?mid=${encodeURIComponent(mid)}&key=${encodeURIComponent(key)}&limit=${limit}&skip=${skip}`);
      const j: any = await r.json().catch(() => null);
      if (!r.ok) { if (i === 0) return NextResponse.json({ error: j?.error?.message || `Graphy HTTP ${r.status}` }, { status: 502 }); break; }
      const data: any[] = Array.isArray(j) ? j : (j?.data || []);
      for (const p of data) { if (p?.id) all.push({ id: String(p.id), title: String(p.title || p.name || p.id) }); }
      const total = Number(j?.total) || all.length;
      skip += limit;
      if (data.length < limit || all.length >= total) break;
    }
  } catch (e: any) { return NextResponse.json({ error: e?.message || "فشل الاتصال بـ Graphy" }, { status: 502 }); }

  const seen = new Set<string>();
  const courses = all.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))).sort((a, b) => a.title.localeCompare(b.title));
  return NextResponse.json({ ok: true, courses });
}
