"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function useClose() {
  const router = useRouter();
  return () => {
    if (typeof window === "undefined") return;
    const stillOpen = () => window.location.pathname.startsWith("/customers/")
      && window.location.pathname !== "/customers/new";
    // من القائمة (modal): back للحفاظ على مكان القائمة وفلاترها
    if (window.history.length > 1) {
      router.back();
      // ضمان الإغلاق: لو back() ما قفلش الـ modal (مشكلة parallel routes) → ادفع للقائمة
      setTimeout(() => { if (stillOpen()) { router.push("/customers"); router.refresh(); } }, 160);
    } else {
      router.push("/customers");
    }
  };
}

export function DrawerScrim({ label }: { label: string }) {
  const close = useClose();
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="drawer-scrim" role="button" tabIndex={-1} aria-label={label} onClick={close} />;
}

export function DrawerCloseButton({ label }: { label: string }) {
  const close = useClose();
  return (
    <button type="button" className="dr-x" aria-label={label} onClick={close}
      style={{ background: "none", border: "none", cursor: "pointer" }}>
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}
