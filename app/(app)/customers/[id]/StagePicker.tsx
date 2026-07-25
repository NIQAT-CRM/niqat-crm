"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { useT } from "@/lib/i18n/client";

type St = { value: string; label: string; color: string };

export default function StagePicker({
  customerId, value, stages, canEdit,
}: { customerId: string; value: string; stages: St[]; canEdit: boolean }) {
  const tr = useT();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const cur = stages.find((s) => s.value === value) || stages[0];

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function change(v: string) {
    setOpen(false);
    if (v === value) return;
    setBusy(true);
    const { error } = await supabase.from("customers").update({ stage: v }).eq("id", customerId);
    setBusy(false);
    if (error) { toast(error.message); return; }
    toast(tr("saved"));
    router.refresh();
  }

  if (!canEdit) {
    return <span className="stg" style={{ background: cur.color + "1a", color: cur.color }}>{cur.label}</span>;
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={busy} title={tr("changeStage")}
        className="stg" style={{ background: cur.color + "1a", color: cur.color, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {busy ? "…" : cur.label}
        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} style={{ opacity: 0.7 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 60, insetInlineStart: 0, marginTop: 5, minWidth: 150, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.18)", padding: 5 }}>
          {stages.map((s) => (
            <div key={s.value} onClick={() => change(s.value)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 7, cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: s.value === value ? "var(--muted-soft)" : "transparent" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ color: "var(--ink)" }}>{s.label}</span>
              {s.value === value && <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={s.color} strokeWidth={2.5} style={{ marginInlineStart: "auto" }}><path d="M20 6L9 17l-5-5" /></svg>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
