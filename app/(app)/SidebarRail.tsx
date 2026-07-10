"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

const KEY = "sb-pinned";

export default function SidebarRail() {
  const t = useT();
  const [pinned, setPinned] = useState(true); // القيمة تُصحّح بعد التحميل

  useEffect(() => {
    let p = false;
    try { p = localStorage.getItem(KEY) === "1"; } catch {}
    setPinned(p);
    document.querySelector(".app")?.classList.toggle("rail", !p);
  }, []);

  function toggle() {
    const np = !pinned;
    setPinned(np);
    try { localStorage.setItem(KEY, np ? "1" : "0"); } catch {}
    document.querySelector(".app")?.classList.toggle("rail", !np);
  }

  return (
    <button className={"sb-pin" + (pinned ? " pinned" : "")} onClick={toggle}
      title={pinned ? t("collapseMenu") : t("pinMenu")} aria-label={pinned ? t("collapseMenu") : t("pinMenu")}>
      <svg viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z" /><path d="M12 15v5" />
      </svg>
    </button>
  );
}
