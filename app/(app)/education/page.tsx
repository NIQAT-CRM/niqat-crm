import { t as tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function EducationPage() {
  return (
    <div className="page-h" style={{ display: "block" }}>
      <h1>{tr("eduTeam")}</h1>
      <div className="card" style={{ padding: 40, marginTop: 16, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
        🎓 {tr("comingSoon")}
      </div>
    </div>
  );
}
