"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useT, useLang } from "@/lib/i18n/client";

export type SC = {
  code: string; combo: string; category: string; action_type: string;
  target: string; label_ar: string; label_en: string; context: string;
};

// هل المستخدم بيكتب دلوقتي؟ (ساعتها الاختصارات تتعطّل تماماً)
function isTyping(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  const tag = n.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (n.isContentEditable) return true;
  if (n.getAttribute && n.getAttribute("role") === "textbox") return true;
  return false;
}

function drawerOpen(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector(".drawer-panel");
}

// المفتاح الفيزيائي (مستقل عن لغة الكيبورد عربي/إنجليزي) — نعتمد e.code مش e.key
function physKey(e: KeyboardEvent): string {
  const c = e.code || "";
  const m = c.match(/^Key([A-Z])$/);
  if (m) return m[1].toLowerCase();
  if (c === "Slash") return e.shiftKey ? "?" : "/";
  if (c === "Digit1" && e.shiftKey) return "!";
  return (e.key || "").toLowerCase();
}

export default function Shortcuts({ shortcuts }: { shortcuts: SC[] }) {
  const router = useRouter();
  const tr = useT();
  const lang = useLang();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [q, setQ] = useState("");
  const gPending = useRef(false);
  const gTimer = useRef<any>(null);
  const paletteInput = useRef<HTMLInputElement>(null);

  const label = useCallback((s: SC) => (lang === "ar" ? s.label_ar : (s.label_en || s.label_ar)), [lang]);

  const runShortcut = useCallback((s: SC) => {
    if (s.context === "customer_drawer" && !drawerOpen()) return; // أكشنز الكارت تشتغل بس لو مفتوح
    switch (s.action_type) {
      case "navigate": router.push(s.target || "/"); break;
      case "palette": setPaletteOpen(true); break;
      case "help": setHelpOpen(true); break;
      case "focus_search": {
        const inp = document.querySelector<HTMLInputElement>("header input, .top input");
        if (inp) { inp.focus(); inp.select?.(); }
        break;
      }
      case "click": {
        const scope = drawerOpen() ? document.querySelector(".drawer-panel")! : document;
        const el = s.target ? scope.querySelector<HTMLElement>(s.target) : null;
        if (el) el.click();
        break;
      }
    }
  }, [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const pk = physKey(e);
      // Command Palette: Ctrl/Cmd + K — يشتغل حتى لو بتكتب أو الكيبورد عربي
      if ((e.ctrlKey || e.metaKey) && pk === "k") {
        e.preventDefault(); setPaletteOpen((o) => !o); setHelpOpen(false); return;
      }
      // Esc: يقفل المودالات بتاعتنا بس (الدروار له معالج خاص)
      if (e.key === "Escape") {
        if (paletteOpen) { setPaletteOpen(false); e.stopPropagation(); }
        else if (helpOpen) { setHelpOpen(false); e.stopPropagation(); }
        return;
      }
      // لو بيكتب في حقل → مفيش أي اختصار تاني
      if (isTyping(e.target)) return;
      // مودال مفتوح بتاعنا → سيبه يتصرّف لوحده
      if (paletteOpen || helpOpen) return;
      // معدّلات (Ctrl/Alt/Meta) → تجاهل (عشان مانكسرش اختصارات المتصفح)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // وضع G ثم حرف
      if (gPending.current) {
        gPending.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const combo = "g " + pk;
        const s = shortcuts.find((x) => x.combo.toLowerCase() === combo);
        if (s) { e.preventDefault(); runShortcut(s); return; }
        return;
      }
      if (pk === "g") {
        gPending.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => { gPending.current = false; }, 1000);
        return;
      }
      // مفاتيح مفردة (بالمفتاح الفيزيائي)
      const single = shortcuts.find((x) => x.combo.toLowerCase() === pk && x.combo.length <= 2 && x.combo !== "mod+k");
      if (single) { e.preventDefault(); runShortcut(single); }
    }
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (gTimer.current) clearTimeout(gTimer.current); };
  }, [shortcuts, paletteOpen, helpOpen, runShortcut]);

  useEffect(() => { if (paletteOpen) { setQ(""); setTimeout(() => paletteInput.current?.focus(), 30); } }, [paletteOpen]);

  // عناصر الـ palette = كل الاختصارات القابلة للتنفيذ المباشر (تنقّل + أكشنز)
  const paletteItems = shortcuts.filter((s) => s.action_type === "navigate" || s.action_type === "focus_search");
  const filtered = q.trim()
    ? paletteItems.filter((s) => label(s).toLowerCase().includes(q.trim().toLowerCase()))
    : paletteItems;

  const catName: Record<string, string> = {
    navigation: tr("scNav"), actions: tr("scActions"), customer: tr("scCustomer"),
  };
  const grouped = shortcuts.reduce((acc: Record<string, SC[]>, s) => {
    (acc[s.category] = acc[s.category] || []).push(s); return acc;
  }, {});

  const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,27,48,.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12vh 16px 16px" };
  const kbd: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 7, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 12, fontWeight: 800, fontFamily: "var(--fe)", textTransform: "uppercase", minWidth: 22, justifyContent: "center" };

  return (
    <>
      {paletteOpen && typeof document !== "undefined" && createPortal(
        <div onClick={() => setPaletteOpen(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "min(560px,100%)", padding: 0, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--muted)" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
              <input ref={paletteInput} className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("scPalettePh")}
                style={{ border: "none", height: 32, flex: 1, background: "transparent", fontSize: 15 }}
                onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) { setPaletteOpen(false); runShortcut(filtered[0]); } }} />
            </div>
            <div style={{ maxHeight: "50vh", overflow: "auto", padding: 8 }}>
              {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{tr("scNoResults")}</div>}
              {filtered.map((s) => (
                <button key={s.code} onClick={() => { setPaletteOpen(false); runShortcut(s); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", color: "var(--ink)", fontSize: 14, fontWeight: 600, textAlign: lang === "ar" ? "right" : "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span>{label(s)}</span>
                  <span style={{ display: "flex", gap: 3 }}>{s.combo.split(" ").map((p, i) => <kbd key={i} style={kbd}>{p}</kbd>)}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)" }}>{tr("scPaletteHint")}</div>
          </div>
        </div>, document.body)}

      {helpOpen && typeof document !== "undefined" && createPortal(
        <div onClick={() => setHelpOpen(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "min(560px,100%)", padding: 20, maxHeight: "76vh", overflow: "auto", boxShadow: "0 24px 70px rgba(0,0,0,.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>{tr("scHelpTitle")}</h3>
              <button onClick={() => setHelpOpen(false)} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 9, width: 30, height: 30, cursor: "pointer", color: "var(--muted)", fontSize: 17 }}>×</button>
            </div>
            {["navigation", "actions", "customer"].filter((c) => grouped[c]?.length).map((c) => (
              <div key={c} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>{catName[c] || c}</div>
                {grouped[c].map((s) => (
                  <div key={s.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 4px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{label(s)}{s.context === "customer_drawer" ? ` · ${tr("scInDrawer")}` : ""}</span>
                    <span style={{ display: "flex", gap: 3 }}>{s.combo.split(" ").map((p, i) => <kbd key={i} style={kbd}>{p === "mod+k" ? "⌘/Ctrl K" : p}</kbd>)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>, document.body)}
    </>
  );
}
