"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { useAiFlags } from "./AiFlags";

type Ctx = "customer_card" | "customers" | "support";
type Pinned = { id: number; key: string; label: string; sort: number };
type Sugg = { key: string; type: "action" | "filter" };

export type SmartActionsProps = {
  context: Ctx;
  // عنوان الشريط (أكشنز سريعة / وصول سريع)
  title?: string;
  // خريطة اسم الأكشن → التسمية المعروضة (مترجمة) — للأكشنز
  actionLabels?: Record<string, string>;
  // محوّل اختياري لتسمية مفاتيح الفلتر (filter:...) لنص مقروء
  filterLabel?: (key: string) => string;
  // تنفيذ الأكشن/الفلتر فعلياً — الهوست بيحدّد السلوك حسب السياق
  onRun: (item: { kind: "action" | "filter"; key: string }) => void;
};

// أيقونات SVG صغيرة (theme-aware عبر currentColor)
const IcoStar = () => (<svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z" /></svg>);
const IcoPin = () => (<svg viewBox="0 0 24 24" width={11} height={11} fill="currentColor"><path d="M12 17v5M9 10.8V7a3 3 0 0 1 6 0v3.8l2 3.2H7z" /></svg>);
const IcoX = () => (<svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>);
const IcoBolt = () => (<svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9z" /></svg>);
const IcoEdit = () => (<svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>);

export default function SmartActions({ context, title, actionLabels = {}, filterLabel, onRun }: SmartActionsProps) {
  const { canUseAi, shortcutsEnabled } = useAiFlags();
  const tr = useT();
  const supabase = createClient();
  const [uid, setUid] = useState<string>("");
  const [pinned, setPinned] = useState<Pinned[]>([]);
  const [suggs, setSuggs] = useState<Sugg[]>([]);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  const gated = canUseAi && shortcutsEnabled;

  // اشتقاق تسمية أي مفتاح
  const keyLabel = useCallback((key: string): string => {
    if (key.startsWith("action:")) {
      const name = key.slice(7);
      return actionLabels[name] || name;
    }
    if (key.startsWith("filter:")) {
      return filterLabel ? filterLabel(key) : key.slice(7);
    }
    return key;
  }, [actionLabels, filterLabel]);

  useEffect(() => {
    if (!gated) { setReady(true); return; }
    let alive = true;
    (async () => {
      const [{ data: u }, pinRes, sugRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("qa_pinned", { p_context: context }),
        supabase.rpc("qa_suggestions", { p_context: context }),
      ]);
      if (!alive) return;
      setUid(u?.user?.id || "");
      const p: Pinned[] = ((pinRes.data as any[]) || []).map((r) => ({
        id: Number(r.id), key: r.action_key, label: r.label || keyLabel(r.action_key), sort: Number(r.sort) || 0,
      }));
      const s: Sugg[] = ((sugRes.data as any[]) || []).map((r) => ({
        key: r.event_key, type: (r.event_type === "filter" ? "filter" : "action") as "action" | "filter",
      }));
      setPinned(p);
      setSuggs(s);
      setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gated, context]);

  // فك تثبيت (delete)
  async function unpin(item: Pinned) {
    setPinned((cur) => cur.filter((x) => x.id !== item.id));
    await supabase.from("user_pinned_actions").delete().eq("id", item.id);
  }

  // تثبيت مقترَح (insert) — التسمية المشتقّة بتتخزّن
  async function pin(item: Sugg) {
    if (!uid) return;
    const label = keyLabel(item.key);
    const nextSort = (pinned.reduce((m, x) => Math.max(m, x.sort), 0) || 0) + 1;
    setSuggs((cur) => cur.filter((x) => x.key !== item.key));
    const { data, error } = await supabase.from("user_pinned_actions")
      .insert({ user_id: uid, context, action_key: item.key, label, sort: nextSort })
      .select("id").single();
    if (error) { // رجوع لو فشل
      setSuggs((cur) => [...cur, item]);
      return;
    }
    setPinned((cur) => [...cur, { id: Number((data as any).id), key: item.key, label, sort: nextSort }]);
  }

  if (!gated || !ready) return null;
  // empty state: مفيش مثبّت ولا مقترحات → إخفاء الشريط بهدوء
  if (pinned.length === 0 && suggs.length === 0) return null;

  const wrap: React.CSSProperties = {
    padding: "12px 16px", borderBottom: "1px solid var(--line)",
    background: "linear-gradient(0deg,var(--ai-soft),transparent)",
  };
  const chipBase: React.CSSProperties = {
    position: "relative", display: "inline-flex", alignItems: "center", gap: 7,
    height: 36, padding: "0 13px", borderRadius: 10, fontFamily: "inherit",
    fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", cursor: "pointer",
    border: "1px solid var(--line)", flexShrink: 0,
  };
  const chipPin: React.CSSProperties = { ...chipBase, background: "var(--brand-soft)", borderColor: "var(--brand-soft)", color: "var(--brand-d)" };
  const chipSug: React.CSSProperties = { ...chipBase, background: "var(--surface)", border: "1px dashed var(--ai)", color: "var(--text)" };
  const badge: React.CSSProperties = {
    position: "absolute", top: -7, insetInlineStart: -7, width: 20, height: 20, borderRadius: "50%",
    color: "#fff", border: "2px solid var(--surface)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0,
  };

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 800, color: "var(--ai)", marginBottom: 10 }}>
        <IcoBolt />
        {title || tr("qaSmartTitle")}
        <button type="button" onClick={() => setEditing((v) => !v)}
          style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <IcoEdit />{editing ? tr("qaEditDone") : tr("edit")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {/* المثبّت أولاً */}
        {pinned.map((p) => (
          <button key={"p" + p.id} type="button" style={chipPin}
            onClick={() => { if (!editing) onRun({ kind: p.key.startsWith("filter:") ? "filter" : "action", key: p.key }); }}>
            {editing && (
              <span style={{ ...badge, background: "var(--red)" }} onClick={(e) => { e.stopPropagation(); unpin(p); }} title={tr("removeFile")}><IcoX /></span>
            )}
            <span>{p.label}</span>
            <span style={{ opacity: .7 }}><IcoPin /></span>
          </button>
        ))}
        {/* المقترَح بعده */}
        {suggs.map((s) => (
          <button key={"s" + s.key} type="button" style={chipSug}
            onClick={() => { if (!editing) onRun({ kind: s.type, key: s.key }); }}>
            {editing && (
              <span style={{ ...badge, insetInlineStart: "auto", insetInlineEnd: -7, background: "var(--ai)" }} onClick={(e) => { e.stopPropagation(); pin(s); }} title={tr("qaPin")}><IcoPin /></span>
            )}
            <span style={{ color: "var(--ai)" }}><IcoStar /></span>
            <span>{keyLabel(s.key)}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 11, display: "flex", alignItems: "center", gap: 5 }}>
        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        {tr("qaSmartFoot")}
      </div>
    </div>
  );
}
