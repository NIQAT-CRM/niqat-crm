"use client";
import { useState, useEffect, type ReactNode } from "react";

export default function SeeAllModal({ title, label, count, children }: {
  title: string; label: string; count?: number; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="seeall-btn">
        {label}{count != null ? ` (${count})` : ""} <span style={{ fontSize: 14 }}>←</span>
      </button>
      {open && (
        <div className="modal-ov" onClick={() => setOpen(false)}>
          <div className="modal-bx" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>{title}</h3>
              <button onClick={() => setOpen(false)} className="modal-x" aria-label="close">✕</button>
            </div>
            <div className="modal-bd">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
