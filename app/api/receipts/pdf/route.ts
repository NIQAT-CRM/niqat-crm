import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { receiptHtmlDoc } from "@/lib/receiptHtml";

export const runtime = "nodejs";
export const maxDuration = 60;

// توليد PDF للإيصال على السيرفر (Puppeteer) — دعم عربي RTL كامل
export async function POST(req: Request) {
  const supabase = createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("can_issue_receipts,team").eq("id", user.id).maybeSingle();
  const isAdmin = (me?.team || "").toLowerCase() === "admin";
  if (!isAdmin && !me?.can_issue_receipts) return NextResponse.json({ error: "مالكش صلاحية" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const { receipt_id, data } = body || {};
  if (!receipt_id || !data) return NextResponse.json({ error: "ناقص بيانات" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY ناقص" }, { status: 500 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const html = receiptHtmlDoc(data);
    // Puppeteer: محلي (تطوير) أو @sparticuz/chromium (Vercel)
    let browser: any;
    const isLocal = !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.VERCEL;
    if (isLocal) {
      const puppeteer = await import("puppeteer-core");
      browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || "/usr/bin/chromium-browser", args: ["--no-sandbox"] });
    } else {
      const chromium = (await import("@sparticuz/chromium")).default;
      const puppeteer = await import("puppeteer-core");
      browser = await puppeteer.launch({ args: chromium.args, defaultViewport: { width: 480, height: 800 }, executablePath: await chromium.executablePath(), headless: true });
    }
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const el = await page.$(".sheet");
    const box = el ? await el.boundingBox() : null;
    const height = box ? Math.ceil(box.height) + 2 : 700;
    const pdf = await page.pdf({ width: "470px", height: `${height}px`, printBackground: true, pageRanges: "1" });
    await browser.close();

    const path = `${data.customer_id || "c"}/${data.receipt_no}.pdf`;
    await admin.storage.from("receipts-pdf").upload(path, Buffer.from(pdf), { contentType: "application/pdf", upsert: true });
    await admin.from("receipts_issued").update({ pdf_url: path }).eq("id", receipt_id);
    const { data: signed } = await admin.storage.from("receipts-pdf").createSignedUrl(path, 3600);
    return NextResponse.json({ ok: true, path, signedUrl: signed?.signedUrl || "" });
  } catch (e: any) {
    return NextResponse.json({ error: "فشل توليد الـPDF: " + (e?.message || "").slice(0, 200) }, { status: 500 });
  }
}
