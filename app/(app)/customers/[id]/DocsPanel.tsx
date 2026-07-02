"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Doc = { id: string; url: string; name: string; at: string };

export default function DocsPanel({
  customerId, initial, tableMissing,
}: {
  customerId: string; initial: Doc[]; tableMissing: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);

  const upload = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    const path = `docs/${customerId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("receipts").upload(path, file, { upsert: false });
    if (up.error) { setBusy(false); toast("تعذّر رفع الملف"); return; }
    const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
    const url = pub.publicUrl;
    const { data, error } = await supabase.from("customer_docs")
      .insert({ customer_id: customerId, url, name: file.name }).select("id,created_at").single();
    setBusy(false);
    if (error) { toast("اترفع بس تعذّر حفظه"); return; }
    setDocs((d) => [{ id: data!.id, url, name: file.name, at: String(data!.created_at || "").slice(0, 10) }, ...d]);
    setFile(null);
    toast("تم رفع المستند");
  }, [file, customerId, supabase]);

  async function del(id: string) {
    if (!confirm("حذف المستند؟")) return;
    setDocs((d) => d.filter((x) => x.id !== id));
    const { error } = await supabase.from("customer_docs").delete().eq("id", id);
    if (error) { toast("تعذّر الحذف"); router.refresh(); }
  }

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t" style={{ margin: 0 }}>المستندات</div>
      {tableMissing ? (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
          شغّل ملف <b>customer_docs.sql</b> في Supabase عشان قسم المستندات يشتغل.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
            <label className="addshot" style={{ borderColor: "var(--line)", color: "var(--brand)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
              {file ? file.name : "اختر ملف / صورة"}
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <button className="btn" type="button" disabled={!file || busy} onClick={upload}>
              {busy ? "بيرفع..." : "رفع"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {docs.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>لا توجد مستندات بعد.</div>}
            {docs.map((d) => (
              <div key={d.id} className="bg-surface" style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <button onClick={() => setPreview(d)} style={{ flex: 1, fontWeight: 600, color: "var(--blue)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                  {isImage(d.name) ? "🖼" : "📎"} {d.name}
                </button>
                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--fe)", flexShrink: 0 }}>{d.at}</span>
                <button type="button" onClick={() => del(d.id)} title="حذف" style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", flexShrink: 0, padding: 4 }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {preview && (
        <>
          <div className="scrim show" onClick={() => setPreview(null)} style={{ zIndex: 70 }} />
          <div className="shotview show" onClick={() => setPreview(null)} style={{ zIndex: 80, cursor: "pointer" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90%", maxHeight: "90%", position: "relative" }}>
              <button onClick={() => setPreview(null)} style={{ position: "absolute", top: -12, insetInlineEnd: -12, width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", zIndex: 10, fontSize: 16 }}>✕</button>
              {isImage(preview.name) ? (
                <img src={preview.url} alt={preview.name} style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,.5)" }} />
              ) : (
                <iframe src={preview.url} style={{ width: "min(800px,80vw)", height: "80vh", borderRadius: 12, border: "none", background: "#fff" }} title={preview.name} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
