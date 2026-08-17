import { receiptPath } from "@/lib/supabase/receipts";

// مفتاح اليوم بتوقيت القاهرة
function cairoDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

type Row = { amount: number; currency: string; day: string };

// المصدر الموحّد للمبيعات: الإيصالات الفردية (منزوعة التكرار بالمسار زي صفحة الإيصالات) + الإيصالات المشتركة
// يستبعد الاستيراد التاريخي تلقائياً (لأنه بلا صور/إيصالات)
async function collectReceiptRows(supabase: any): Promise<Row[]> {
  const out: Row[] = [];
  // (1) الفردي — من receipts_all، نزع تكرار بالمسار، أول واحد فيه مبلغ يفوز (نفس منطق صفحة الإيصالات)
  const { data } = await supabase.rpc("receipts_all", { p_from: "2000-01-01", p_to: "2100-01-01" });
  const byPath = new Map<string, Row>();
  for (const r of ((data as any[]) || [])) {
    if (!r.receipt_url || r.amount == null || !r.uploaded_at) continue;
    const key = receiptPath(r.receipt_url) || r.receipt_url;
    if (byPath.has(key)) continue; // أول واحد فيه مبلغ يفوز
    byPath.set(key, { amount: Number(r.amount) || 0, currency: r.currency || "EGP", day: cairoDay(r.uploaded_at) });
  }
  out.push(...byPath.values());
  // (2) المشترك — من جدول receipts (بتاريخ الإنشاء)
  const { data: shared } = await supabase.from("receipts").select("total_amount,currency,created_at");
  for (const r of ((shared as any[]) || [])) {
    if (r.total_amount == null || !r.created_at) continue;
    out.push({ amount: Number(r.total_amount) || 0, currency: r.currency || "EGP", day: cairoDay(r.created_at) });
  }
  return out;
}

// إجماليات المبيعات لكل شهر (موحّدة مع صفحة الإيصالات)
export async function receiptMonthlyTotals(supabase: any): Promise<{ ym: string; egp: number; usd: number; cnt: number }[]> {
  const rows = await collectReceiptRows(supabase);
  const m = new Map<string, { egp: number; usd: number; cnt: number }>();
  for (const r of rows) {
    const ym = r.day.slice(0, 7);
    const cur = m.get(ym) || { egp: 0, usd: 0, cnt: 0 };
    if (r.currency === "USD") cur.usd += r.amount; else cur.egp += r.amount;
    cur.cnt++;
    m.set(ym, cur);
  }
  return Array.from(m.entries()).map(([ym, v]) => ({ ym, ...v })).sort((a, b) => b.ym.localeCompare(a.ym));
}

// إجمالي مبيعات النهاردة (موحّد مع صفحة الإيصالات)
export async function receiptTodayTotals(supabase: any): Promise<{ egp: number; usd: number; cnt: number }> {
  const rows = await collectReceiptRows(supabase);
  const today = cairoDay(new Date().toISOString());
  let egp = 0, usd = 0, cnt = 0;
  for (const r of rows) {
    if (r.day !== today) continue;
    if (r.currency === "USD") usd += r.amount; else egp += r.amount;
    cnt++;
  }
  return { egp, usd, cnt };
}
