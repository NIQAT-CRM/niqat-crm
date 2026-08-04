"use client";
import { createClient } from "@/lib/supabase/client";
import { useT, useLang } from "@/lib/i18n/client";
import { toast } from "@/lib/toast";

type Row = { id: string; uniName: string; signed_at: string | null; expires_at: string | null; file_url: string };

export default function ProtocolsTable({ rows }: { rows: Row[] }) {
  const tr = useT();
  const lang = useLang();
  const supabase = createClient();
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB") : "—");
  const expired = (d: string | null) => !!d && new Date(d) < new Date();

  async function download(path: string) {
    const { data } = await supabase.storage.from("protocols").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast(tr("uploadFailed"));
  }

  if (rows.length === 0) return <div className="empty"><b>{tr("uniNoProtocols")}</b></div>;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg)", textAlign: "start" }}>
            <th style={{ padding: "10px 14px", textAlign: "start", color: "var(--muted)", fontWeight: 700 }}>{tr("uniUniversity")}</th>
            <th style={{ padding: "10px 14px", textAlign: "start", color: "var(--muted)", fontWeight: 700 }}>{tr("uniSignedAt")}</th>
            <th style={{ padding: "10px 14px", textAlign: "start", color: "var(--muted)", fontWeight: 700 }}>{tr("uniExpiresAt")}</th>
            <th style={{ padding: "10px 14px", textAlign: "start", color: "var(--muted)", fontWeight: 700 }}>{tr("uniStatusLabel")}</th>
            <th style={{ padding: "10px 14px", textAlign: "end", color: "var(--muted)", fontWeight: 700 }}>{tr("uniProtoFile")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ex = expired(r.expires_at);
            return (
              <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 14px", color: "var(--ink)", fontWeight: 700 }}>{r.uniName}</td>
                <td style={{ padding: "10px 14px", color: "var(--ink)" }}>{fmt(r.signed_at)}</td>
                <td style={{ padding: "10px 14px", color: "var(--ink)" }}>{fmt(r.expires_at)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: ex ? "#E0483B" : "#18A957", background: ex ? "rgba(224,72,59,.12)" : "rgba(24,169,87,.12)", borderRadius: 20, padding: "2px 10px" }}>{ex ? tr("uniProtoExpired") : tr("uniProtoValid")}</span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "end" }}>
                  <button onClick={() => download(r.file_url)} className="btn ghost" style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}>{tr("uniDownload")}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
