"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

type Hit = { id: string; name: string; phone1: string | null; stage: string | null };

export default function TopSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useT();
  const supabase = createClient();
  const [q, setQ] = useState(sp.get("q") || "");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQ(sp.get("q") || ""); }, [pathname, sp]);

  // بحث فوري (debounce) في العملاء بالاسم/الموبايل/الإيميل
  useEffect(() => {
    const v = q.trim();
    if (v.length < 2) { setHits([]); setOpen(false); return; }
    const id = setTimeout(async () => {
      const { data } = await supabase.from("customers")
        .select("id,name,phone1,stage").eq("deleted", false).eq("archived", false)
        .or(`name.ilike.%${v}%,phone1.ilike.%${v}%,email.ilike.%${v}%`)
        .limit(8);
      setHits((data as Hit[]) || []);
      setHl(0);
      setOpen(true);
    }, 250);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function targetBase() {
    if (pathname.startsWith("/pipeline")) return "/pipeline";
    if (pathname.startsWith("/support")) return "/support";
    return "/customers";
  }
  function goAll() {
    const v = q.trim();
    setOpen(false);
    router.push(v ? `${targetBase()}?q=${encodeURIComponent(v)}` : targetBase());
  }
  function openHit(h: Hit) {
    setOpen(false);
    router.push(`/customers/${h.id}`);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); goAll(); return; }
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHl((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="search" ref={boxRef}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
      </svg>
      <input placeholder={t("search")} value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (hits.length) setOpen(true); }}
        onKeyDown={onKey} />
      {open && (
        <div className="search-dd">
          {hits.length === 0 ? (
            <div className="sd-empty">{t("noResults")}</div>
          ) : (
            <>
              {hits.map((h, i) => (
                <a key={h.id} className={i === hl ? "hl" : ""}
                  onMouseEnter={() => setHl(i)}
                  onClick={(e) => { e.preventDefault(); openHit(h); }} href={`/customers/${h.id}`}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sd-nm">{h.name}</div>
                    {h.phone1 && <div className="sd-sub num" dir="ltr">{h.phone1}</div>}
                  </div>
                </a>
              ))}
              <button className="sd-all" onClick={goAll}>{t("viewAll")}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
