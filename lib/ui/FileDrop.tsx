"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * منطقة رفع ملفات واضحة: سحب وإفلات + اختيار من الجهاز،
 * مع معاينة للصورة وزر إزالة/استبدال قبل التسجيل.
 */
export default function FileDrop({
  value = null, onFile, onClear, label, hint,
  accept = "image/*", disabled = false, compact = false, className, style,
}: {
  value?: File | null;
  onFile: (f: File) => void;
  onClear?: () => void;
  label?: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const tr = useT();
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (value && value.type.startsWith("image/")) {
      const u = URL.createObjectURL(value);
      setPreview(u);
      return () => URL.revokeObjectURL(u);
    }
    setPreview("");
  }, [value]);

  function emit(files: FileList | null) {
    if (!files || !files.length) return;
    onFile(files[0]);
  }

  // ===== في حالة وجود ملف مختار: معاينة + استبدال + إزالة =====
  if (value) {
    return (
      <div className={"fdrop-has" + (compact ? " compact" : "")} style={style}>
        {preview ? <img src={preview} alt="" className="fdrop-thumb" /> : <span className="fdrop-ficon">📄</span>}
        <span className="fdrop-fname">{value.name}</span>
        <div className="fdrop-actions">
          <label className="fdrop-replace">
            {tr("replaceFile")}
            <input type="file" accept={accept} disabled={disabled} style={{ display: "none" }}
              onChange={(e) => { emit(e.target.files); e.currentTarget.value = ""; }} />
          </label>
          {onClear && <button type="button" className="fdrop-x" onClick={onClear} aria-label={tr("removeFile")} title={tr("removeFile")}>✕</button>}
        </div>
      </div>
    );
  }

  // ===== منطقة الإفلات (فاضية) =====
  return (
    <label
      className={"fdrop" + (compact ? " compact" : "") + (drag ? " drag" : "") + (className ? " " + className : "")}
      style={{ cursor: disabled ? "not-allowed" : "pointer", ...style }}
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); e.stopPropagation(); setDrag(true); }}
      onDragEnter={(e) => { if (disabled) return; e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
      onDrop={(e) => { if (disabled) return; e.preventDefault(); e.stopPropagation(); setDrag(false); emit(e.dataTransfer?.files || null); }}
    >
      <svg className="fdrop-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      <span className="fdrop-t">{label || tr("dropOrPick")}</span>
      {!compact && <span className="fdrop-h">{hint || tr("dropHint")}</span>}
      <input type="file" accept={accept} disabled={disabled} style={{ display: "none" }}
        onChange={(e) => { emit(e.target.files); e.currentTarget.value = ""; }} />
    </label>
  );
}
