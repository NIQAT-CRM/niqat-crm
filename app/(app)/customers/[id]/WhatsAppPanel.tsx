"use client";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type Tpl = { id: string; name: string; body: string };
type Ctx = { name: string; phone1: string; diploma: string; batch: string; remaining: string };

function fill(text: string, c: Ctx) {
  return text
    .replace(/\{name\}/g, c.name || "")
    .replace(/\{diploma\}/g, c.diploma || "")
    .replace(/\{batch\}/g, c.batch || "")
    .replace(/\{remaining\}/g, c.remaining || "");
}
function waLink(phone: string, text: string) {
  const num = (phone || "").replace(/[^\d]/g, "").replace(/^0/, "20");
  return `https://wa.me/${num}${text ? "?text=" + encodeURIComponent(text) : ""}`;
}

export default function WhatsAppPanel({
  customerId, meId, ctx, templates,
}: { customerId: string; meId: string; ctx: Ctx; templates: Tpl[] }) {
  const tr = useT();
  const [preview, setPreview] = useState<string>("");
  const [channel, setChannel] = useState<"sales" | "support">("sales");
  const [busy, setBusy] = useState(false);
  const [tplName, setTplName] = useState("");

  async function api(payload: any) {
    setBusy(true);
    try {
      const res = await fetch("/api/wa/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, to: ctx.phone1, channel, customer_id: customerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(tr("waSendFailed") + (data.error || "")); return; }
      toast(tr("waSent"));
    } catch (e: any) {
      toast(tr("waSendFailed") + (e?.message || ""));
    } finally { setBusy(false); }
  }

  const sendSession = (tpl: Tpl) => api({ mode: "session", text: fill(tpl.body, ctx) });
  const sendTemplate = () => { if (!tplName.trim()) return toast(tr("enterTplName")); api({ mode: "template", template_name: tplName.trim() }); };

  if (!ctx.phone1) {
    return (
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div className="sec-t">{tr("whatsapp")}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{tr("noMobile")}</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="sec-t">{tr("whatsapp")}</div>

      {/* اختيار الرقم المُرسِل */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 700 }}>{tr("senderNo")}:</span>
        {(["sales", "support"] as const).map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)} className="opt-chip"
            style={channel === c ? { background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" } : undefined}>
            {tr(c === "sales" ? "senderSales" : "senderSupport")}
          </button>
        ))}
      </div>

      {/* قوالب النظام (نص حر — session، بيشتغل خلال 24 ساعة من آخر رسالة من العميل) */}
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{tr("waSessionNote")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
        {templates.length === 0 && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{tr("noTemplates")}</span>}
        {templates.map((t) => (
          <button key={t.id} className="btn ghost" disabled={busy} style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
            onMouseEnter={() => setPreview(fill(t.body, ctx))} onMouseLeave={() => setPreview("")}
            onClick={() => sendSession(t)}>
            {t.name}
          </button>
        ))}
        <a className="btn wa" style={{ height: 32, padding: "0 12px", fontSize: 12.5 }}
          href={waLink(ctx.phone1, "")} target="_blank" rel="noreferrer">{tr("openBlankChat")}</a>
      </div>
      {preview && (
        <div style={{ fontSize: 12.5, color: "var(--muted)", background: "rgba(24,169,87,.07)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, whiteSpace: "pre-wrap", marginBottom: 10 }}>
          {preview}
        </div>
      )}

      {/* قالب WATI معتمد (بيشتغل أي وقت) */}
      <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 12 }}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{tr("waTemplateNote")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="inp" dir="ltr" placeholder={tr("watiTemplateName")} value={tplName} onChange={(e) => setTplName(e.target.value)} style={{ flex: 1, height: 36 }} />
          <button className="btn" disabled={busy} onClick={sendTemplate} style={{ height: 36, flexShrink: 0 }}>{tr("sendTemplateBtn")}</button>
        </div>
      </div>
    </div>
  );
}
