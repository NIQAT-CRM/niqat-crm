"use client";
import { useEffect, useRef, useState } from "react";

// ===== رقم يعدّ تصاعدياً عند الظهور =====
export function CountUp({ value, suffix = "", prefix = "", dur = 900, decimals = 0 }: {
  value: number; suffix?: string; prefix?: string; dur?: number; decimals?: number;
}) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
          setN(value * eased);
          if (p < 1) requestAnimationFrame(tick);
          else setN(value);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, dur]);
  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString("en");
  return <span ref={ref} className="num">{prefix}{shown}{suffix}</span>;
}

// ===== دونات SVG احترافي مع حركة =====
export function Donut({ data, size = 140, thickness = 22 }: {
  data: { label: string; value: number; color: string }[]; size?: number; thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {data.map((d, i) => {
          const frac = d.value / total;
          const len = frac * circ;
          const seg = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${mounted ? len : 0} ${circ}`}
              strokeDashoffset={-offset}
              style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,1,.36,1)" }} />
          );
          offset += len;
          return seg;
        })}
      </g>
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: "var(--text)" }} className="num">{total}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" style={{ fontSize: 11, fill: "var(--muted)" }}>{data.length}</text>
    </svg>
  );
}

// ===== بار أفقي مع حركة =====
export function BarRow({ label, value, max, color, prefix = "" }: {
  label: React.ReactNode; value: number; max: number; color: string; prefix?: string;
}) {
  const [w, setW] = useState(0);
  const pct = max ? Math.round((value / max) * 100) : 0;
  useEffect(() => { const t = setTimeout(() => setW(pct), 60); return () => clearTimeout(t); }, [pct]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ minWidth: 92, maxWidth: 150, fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "var(--muted-soft)", borderRadius: 20, overflow: "hidden" }}>
        <div style={{ width: w + "%", height: "100%", background: color, borderRadius: 20, transition: "width .8s cubic-bezier(.22,1,.36,1)" }} />
      </div>
      <span className="num" style={{ width: 44, textAlign: "end", fontWeight: 700, color: "var(--muted)", fontSize: 12.5 }}>{prefix}{value}</span>
    </div>
  );
}

// ===== رسم خطي (sparkline/area) SVG =====
export function AreaChart({ points, color = "#F08A24", height = 90 }: {
  points: { label: string; value: number }[]; color?: string; height?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);
  if (!points.length) return null;
  const w = 100, h = height;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const coords = points.map((p, i) => [i * step, h - (p.value / max) * (h - 20) - 6]);
  const line = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
        <defs>
          <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaG)" style={{ opacity: mounted ? 1 : 0, transition: "opacity 1s" }} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke"
          strokeDasharray={mounted ? "none" : "1000"} strokeDashoffset={mounted ? 0 : 1000}
          style={{ transition: "stroke-dashoffset 1.2s ease" }} />
        {coords.map((c, i) => (
          <circle key={i} cx={c[0]} cy={c[1]} r={2.5} fill={color} vectorEffect="non-scaling-stroke"
            style={{ opacity: mounted ? 1 : 0, transition: `opacity .4s ${0.5 + i * 0.08}s` }} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {points.map((p, i) => <span key={i} style={{ fontSize: 10, color: "var(--muted)" }}>{p.label}</span>)}
      </div>
    </div>
  );
}
