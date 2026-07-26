// مودال تأكيد مشترك يرجّع Promise<boolean> — بديل confirm() الأصلي
export type ConfirmOpts = { message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };

export function confirmDialog(opts: ConfirmOpts | string, danger?: boolean): Promise<boolean> {
  const o: ConfirmOpts = typeof opts === "string" ? { message: opts } : { ...opts };
  if (danger) o.danger = true;
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(false); return; }
    window.dispatchEvent(new CustomEvent("niqat-confirm", { detail: { ...o, resolve } }));
  });
}
