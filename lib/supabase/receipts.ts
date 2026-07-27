// أدوات التعامل مع اسكرينات bucket "receipts" (private).
// نخزّن الـ path في الداتابيز، ونولّد signed URL وقت العرض (روابط موقّتة).

/** يستخرج الـ path من قيمة مخزّنة: يدعم القديم (URL كامل فيه /receipts/) والجديد (path مباشر) */
export function receiptPath(stored: string): string {
  const m = "/receipts/";
  const i = stored.indexOf(m);
  return i >= 0 ? stored.slice(i + m.length) : stored;
}

/** اسم ملف الإيصال الجديد: "{اسم العميل} - {phone1}" + امتداد الملف الأصلي.
    للإيصالات الجديدة فقط — القديمة تفضل زي ما هي. */
export function receiptFileName(customerName: string, phone1: string, originalName: string): string {
  const ext = (String(originalName || "").match(/\.[a-zA-Z0-9]+$/)?.[0] || "").toLowerCase();
  const clean = (s: string) => String(s || "").replace(/[\/\\?%*:|"'<>]/g, " ").replace(/\s+/g, " ").trim();
  const base = [clean(customerName), clean(phone1)].filter(Boolean).join(" - ") || "receipt";
  return base + ext;
}

/** الاسم المعروض للإيصال الجديد: "{اسم العميل} - {phone1}" */
export function receiptDisplayName(customerName: string, phone1: string): string {
  const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
  return [clean(customerName), clean(phone1)].filter(Boolean).join(" - ") || clean(customerName) || "receipt";
}

/** يولّد signed URL صالح لمدة ساعة من قيمة مخزّنة (path أو URL قديم). يرجّع "" لو مفيش قيمة/فشل. */
export async function receiptSignedUrl(
  supabase: any,
  stored: string | null | undefined,
): Promise<string> {
  if (!stored) return "";
  try {
    const { data } = await supabase.storage
      .from("receipts")
      .createSignedUrl(receiptPath(stored), 3600); // ساعة
    return data?.signedUrl || "";
  } catch {
    return "";
  }
}
