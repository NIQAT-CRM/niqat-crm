import { t as tr } from "@/lib/i18n";

// رسالة "ملكش صلاحية" تظهر داخل الصفحة (الصفحة نفسها متفتحش محتواها)
export default function NoAccess() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--red-soft)", color: "var(--red)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
          <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>{tr("noAccessTitle")}</h2>
        <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.7 }}>{tr("noAccessBody")}</p>
      </div>
    </div>
  );
}
