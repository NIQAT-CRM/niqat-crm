"use client";
import { useState, useRef, useEffect, useMemo } from "react";

export type SSOpt = { value: string; label: string };

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "— اختر —",
  emptyLabel = "— بدون —",
  searchPlaceholder = "ابحث…",
  frequentLabel = "الأكثر استخداماً",
  frequentValues = [],
  allowEmpty = true,
  allowCustom = false,
  addPrefix = "",
  disabled = false,
}: {
  options: SSOpt[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  frequentLabel?: string;
  frequentValues?: string[];
  allowEmpty?: boolean;
  allowCustom?: boolean;   // يسمح بإدخال قيمة مش موجودة في القائمة (نص حر)
  addPrefix?: string;      // نص يظهر قبل القيمة المكتوبة في صف "الإضافة" (مثلاً "إضافة")
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) || null;

  const sorted = useMemo(
    () => [...options].sort((a, b) => a.label.localeCompare(b.label, "ar", { numeric: true })),
    [options]
  );
  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => (query ? sorted.filter((o) => o.label.toLowerCase().includes(query)) : sorted),
    [sorted, query]
  );
  const freq = useMemo(() => {
    if (query || !frequentValues.length) return [] as SSOpt[];
    return frequentValues
      .map((v) => options.find((o) => o.value === v))
      .filter(Boolean) as SSOpt[];
  }, [frequentValues, options, query]);
  const freqSet = useMemo(() => new Set(freq.map((o) => o.value)), [freq]);
  const rest = useMemo(() => filtered.filter((o) => !freqSet.has(o.value)), [filtered, freqSet]);

  // صف "إضافة" لقيمة مكتوبة مش موجودة في القائمة (نص حر)
  const customQ = q.trim();
  const showCustom = allowCustom && !!customQ
    && !options.some((o) => o.label.toLowerCase() === customQ.toLowerCase());

  // قائمة مسطّحة للتنقّل بالكيبورد (بدون + الأكثر استخداماً + الباقي + الإضافة)
  const flat: SSOpt[] = [];
  if (allowEmpty && !query) flat.push({ value: "", label: emptyLabel });
  flat.push(...freq, ...rest);
  if (showCustom) flat.push({ value: customQ, label: customQ });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setHi(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const o = flat[hi]; if (o) pick(o.value); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  let idx = -1;
  const rowStyle = (i: number): React.CSSProperties => ({
    padding: "8px 11px", fontSize: 13, cursor: "pointer", borderRadius: 7,
    background: i === hi ? "var(--brand-soft)" : "transparent",
    color: i === hi ? "var(--brand-d)" : "var(--ink)",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
  });

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button" className="inp" disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "start", width: "100%" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: (selected || value) ? "var(--ink)" : "var(--muted)" }}>
          {selected ? selected.label : (value || placeholder)}
        </span>
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, opacity: 0.6, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div style={{ position: "absolute", zIndex: 50, insetInlineStart: 0, insetInlineEnd: 0, marginTop: 4, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.18)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
            <input
              ref={inputRef} className="inp" value={q} onKeyDown={onKey}
              onChange={(e) => { setQ(e.target.value); setHi(0); }}
              placeholder={searchPlaceholder} style={{ width: "100%", height: 34 }}
            />
          </div>
          <div ref={listRef} style={{ maxHeight: 260, overflowY: "auto", padding: 6 }}>
            {allowEmpty && !query && (() => { idx++; const i = idx; return (
              <div data-idx={i} onMouseEnter={() => setHi(i)} onClick={() => pick("")} style={{ ...rowStyle(i), color: i === hi ? "var(--brand-d)" : "var(--muted)" }}>{emptyLabel}</div>
            ); })()}

            {freq.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "var(--muted)", padding: "6px 11px 3px", fontWeight: 700 }}>{frequentLabel}</div>
                {freq.map((o) => { idx++; const i = idx; return (
                  <div key={"f" + o.value} data-idx={i} onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)} style={rowStyle(i)}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                    {o.value === value && <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5" /></svg>}
                  </div>
                ); })}
                <div style={{ height: 1, background: "var(--line)", margin: "5px 8px" }} />
              </>
            )}

            {rest.map((o) => { idx++; const i = idx; return (
              <div key={o.value} data-idx={i} onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)} style={rowStyle(i)}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                {o.value === value && <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
            ); })}

            {showCustom && (() => { idx++; const i = idx; return (
              <div key="__custom" data-idx={i} onMouseEnter={() => setHi(i)} onClick={() => pick(customQ)} style={{ ...rowStyle(i), color: i === hi ? "var(--brand-d)" : "var(--brand)", fontWeight: 700 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4} style={{ flexShrink: 0 }}><path d="M12 5v14M5 12h14" /></svg>
                  {addPrefix ? `${addPrefix} «${customQ}»` : customQ}
                </span>
              </div>
            ); })()}

            {flat.length === 0 && <div style={{ padding: "10px 11px", fontSize: 13, color: "var(--muted)" }}>لا نتائج</div>}
          </div>
        </div>
      )}
    </div>
  );
}
