// يرسل طلب تصدير للسيرفر ويحمّل ملف XLSX المبراندَد الراجع
export async function postExport(payload: Record<string, any>, downloadName: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${t}` };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${downloadName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "export failed" };
  }
}
