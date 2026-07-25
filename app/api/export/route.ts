import { createClient } from "@/lib/supabase/server";
import { filteredCustomerIds } from "@/lib/customerFilter";
import { brandedXlsx } from "@/lib/export/brandedXlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CH = 200;
const STAGE_EN: Record<string, string> = {
  contacted: "Contacted", interested: "Interested", enrolled: "Enrolled / Paid", onhold: "On hold",
};

function chunk<T>(a: T[], n: number) { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

async function loadCompany(supabase: any): Promise<{ name: string; logo: Buffer | null; ext: "png" | "jpeg" }> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "company").maybeSingle();
  const name = (data?.value?.name as string) || "NIQAT";
  const path = data?.value?.logo as string | undefined;
  let logo: Buffer | null = null;
  let ext: "png" | "jpeg" = "png";
  if (path) {
    try {
      const dl = await supabase.storage.from("receipts").download(path);
      if (dl.data) {
        const ab = await dl.data.arrayBuffer();
        logo = Buffer.from(ab);
        ext = /\.jpe?g$/i.test(path) ? "jpeg" : "png";
      }
    } catch { /* بدون لوجو لو تعذّر */ }
  }
  return { name, logo, ext };
}

// ============ تجميع بيانات العملاء الكاملة ============
async function buildCustomers(supabase: any, ids: string[], canFinance: boolean) {
  // قوائم مرجعية صغيرة
  const [{ data: specs }, { data: profs }, { data: dips }] = await Promise.all([
    supabase.from("specialties").select("id,name_ar"),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("diplomas").select("id,name_ar"),
  ]);
  const specMap = new Map<string, string>((specs || []).map((s: any) => [s.id, s.name_ar]));
  const profMap = new Map<string, string>((profs || []).map((p: any) => [p.id, p.full_name]));
  const dipMap = new Map<string, string>((dips || []).map((d: any) => [d.id, d.name_ar]));

  // العملاء
  const custs: any[] = [];
  for (const part of chunk(ids, CH)) {
    const { data } = await supabase.from("customers")
      .select("id,name,phone1,phone2,email,company,source,specialty_id,stage,owner_id,created_at")
      .in("id", part);
    for (const c of (data as any[]) || []) custs.push(c);
  }

  // الاشتراكات (دبلومات لكل عميل) + جمع enrollment ids
  const dipNamesByCust = new Map<string, string[]>();
  const enrToCust = new Map<string, string>();
  for (const part of chunk(ids, CH)) {
    const { data } = await supabase.from("enrollments").select("id,customer_id,diploma_id").in("customer_id", part);
    for (const e of (data as any[]) || []) {
      enrToCust.set(e.id, e.customer_id);
      if (e.diploma_id) {
        const nm = dipMap.get(e.diploma_id);
        if (nm) { const arr = dipNamesByCust.get(e.customer_id) || []; arr.push(nm); dipNamesByCust.set(e.customer_id, arr); }
      }
    }
  }

  // المالية (لو مصرّح) — المتفق + المدفوع لكل عميل، بالعملة
  const agreedEgp = new Map<string, number>(), paidEgp = new Map<string, number>(), paidUsd = new Map<string, number>();
  if (canFinance) {
    const enrIds = Array.from(enrToCust.keys());
    for (const part of chunk(enrIds, CH)) {
      const { data } = await supabase.from("enrollment_finance").select("enrollment_id,agreed_amount,currency").in("enrollment_id", part);
      for (const f of (data as any[]) || []) {
        const cid = enrToCust.get(f.enrollment_id); if (!cid) continue;
        if ((f.currency || "EGP") === "EGP") agreedEgp.set(cid, (agreedEgp.get(cid) || 0) + (Number(f.agreed_amount) || 0));
      }
    }
    for (const part of chunk(enrIds, CH)) {
      const { data } = await supabase.from("installments").select("enrollment_id,amount,currency,status,paid_at").in("enrollment_id", part);
      for (const i of (data as any[]) || []) {
        if (i.status !== "paid" && !i.paid_at) continue;
        const cid = enrToCust.get(i.enrollment_id); if (!cid) continue;
        const amt = Number(i.amount) || 0;
        if ((i.currency || "EGP") === "USD") paidUsd.set(cid, (paidUsd.get(cid) || 0) + amt);
        else paidEgp.set(cid, (paidEgp.get(cid) || 0) + amt);
      }
    }
  }

  const headers = [
    "Name", "Mobile 1", "Mobile 2", "Email", "Company / Group", "Source",
    "Specialty", "Stage", "Owner", "Diplomas", "Diplomas Count", "Created At",
    ...(canFinance ? ["Agreed (EGP)", "Paid (EGP)", "Remaining (EGP)", "Paid (USD)"] : []),
  ];

  const nf = (n: number) => Math.round(n || 0);
  const rows = custs.map((c) => {
    const dipNames = dipNamesByCust.get(c.id) || [];
    const base: (string | number)[] = [
      c.name || "", c.phone1 || "", c.phone2 || "", c.email || "", c.company || "", c.source || "",
      specMap.get(c.specialty_id) || "", STAGE_EN[c.stage] || c.stage || "",
      profMap.get(c.owner_id) || "", dipNames.join(", "), dipNames.length,
      c.created_at ? String(c.created_at).slice(0, 10) : "",
    ];
    if (canFinance) {
      const ag = nf(agreedEgp.get(c.id) || 0), pd = nf(paidEgp.get(c.id) || 0);
      base.push(ag, pd, ag - pd, nf(paidUsd.get(c.id) || 0));
    }
    return base;
  });

  return { headers, rows };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: prof } = await supabase.from("profiles").select("can_export,can_see_finance").eq("id", user.id).maybeSingle();
  if (!prof?.can_export) return new Response("Forbidden", { status: 403 });
  const canFinance = !!prof.can_see_finance;

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const type = body.type as string;

  let title = String(body.title || "تصدير");
  let headers: string[] = [];
  let rows: (string | number)[][] = [];

  if (type === "customers") {
    const ids: string[] = Array.isArray(body.ids) && body.ids.length ? body.ids : await filteredCustomerIds(body.filter || {});
    if (!ids.length) return new Response("No rows", { status: 400 });
    const built = await buildCustomers(supabase, ids, canFinance);
    headers = built.headers; rows = built.rows;
    title = "Customers";
  } else if (type === "generic") {
    headers = (body.headers as string[]) || [];
    rows = (body.rows as (string | number)[][]) || [];
    if (!headers.length) return new Response("No headers", { status: 400 });
  } else {
    return new Response("Bad type", { status: 400 });
  }

  const company = await loadCompany(supabase);
  const buf = await brandedXlsx({ title, companyName: company.name, logo: company.logo, logoExt: company.ext, headers, rows });

  const fname = `niqat-${(body.filename || type)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname.replace(/[^\x20-\x7e]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
