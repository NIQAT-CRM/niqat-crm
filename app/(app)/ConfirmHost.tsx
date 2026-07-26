"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

type State = { message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; resolve: (v: boolean) => void };

export default function ConfirmHost() {
  const tr = useT();
  const [st, setSt] = useState<State | null>(null);

  useEffect(() => {
    const on = (e: any) => setSt(e.detail as State);
    window.addEventListener("niqat-confirm", on as any);
    return () => window.removeEventListener("niqat-confirm", on as any);
  }, []);

  useEffect(() => {
    if (!st) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") done(false);
      if (e.key === "Enter") done(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);

  if (!st) return null;
  const done = (v: boolean) => { st.resolve(v); setSt(null); };

  return (
    <div onClick={() => done(false)}
      style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,.5)", backdropFilter: "blur(2px)", zIndex: 200, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: "min(400px,100%)", padding: 22 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.7, marginBottom: 18, whiteSpace: "pre-line" }}>
          {st.message}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => done(false)} style={{ height: 38, padding: "0 16px" }}>
            {st.cancelLabel || tr("cancel")}
          </button>
          <button className="btn" onClick={() => done(true)} autoFocus
            style={{ height: 38, padding: "0 18px", ...(st.danger ? { background: "var(--red)", borderColor: "var(--red)" } : {}) }}>
            {st.confirmLabel || tr("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
