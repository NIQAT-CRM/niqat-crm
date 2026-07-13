// أدوات التعامل مع اسكرينات bucket "receipts" (private).
// نخزّن الـ path في الداتابيز، ونولّد signed URL وقت العرض (روابط موقّتة).

/** يستخرج الـ path من قيمة مخزّنة: يدعم القديم (URL كامل فيه /receipts/) والجديد (path مباشر) */
export function receiptPath(stored: string): string {
  const m = "/receipts/";
  const i = stored.indexOf(m);
  return i >= 0 ? stored.slice(i + m.length) : stored;
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
