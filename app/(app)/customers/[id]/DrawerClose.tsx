"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function useClose() {
  const router = useRouter();
  return () => {
    // نرجّع دايماً لقائمة العملاء بشكل حاسم — الدفع لـ /customers بيخلّي الراوت المعترض
    // ما يطابقش فيتقفل المودال ويرجّع القائمة (بدل back اللي بيتلغبط بعد سلسلة list→new→[id]).
    router.push("/customers");
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
