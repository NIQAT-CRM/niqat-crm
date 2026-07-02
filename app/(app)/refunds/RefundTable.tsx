"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type RefundRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  service: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  created_at: string;
};

const STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "في انتظار الريفند", color: "var(--amber)" },
  refunded: { label: "تم الريفند", color: "var(--blue)" },
  closed: { label: "مؤرشف", color: "var(--muted)" },
};

function money(n: number, cur: string) {
  return new Intl.NumberFormat("en").format(Math.round(n || 0)) + (cur === "USD" ? " $" : " ج");
}

export default function RefundTable() {
  const supabase = createClient();
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: rf, error } = await supabase.from("refunds")
      .select("id,customer_id,reason,status,created_at")
      .order("created_at", { ascending: false });

    if (error) { setLoading(false); return; }

    const cids = [...new Set((rf || []).map((r: any) => r.customer_id))];
    const { data: custs } = await supabase.from("customers").select("id,name").in("id", cids);
    const cName = new Map((custs || []).map((c: any) => [c.id, c.name]));

    const { data: enrData } = await supabase.from("enrollments")
      .select("customer_id, diplomas(name_ar)").in("customer_id", cids);
    const cService = new Map<string, string>();
    const seen = new Set<string>();
    for (const e of (enrData || []) as any[]) {
      if (!seen.has(e.customer_id)) {
        cService.set(e.customer_id, (e.diplomas?.name_ar) || "—");
        seen.add(e.customer_id);
      }
    }

    const { data: fin } = await supabase.from("refund_finance").select("refund_id,amount,currency");
    const finMap = new Map((fin || []).map((x: any) => [x.refund_id, x]));

    const mapped: RefundRow[] = (rf || []).map((r: any) => {
      const f = finMap.get(r.id);
      return {
        id: r.id,
        customer_id: r.customer_id,
        customer_name: cName.get(r.customer_id) || "—",
        service: cService.get(r.customer_id) || "—",
        amount: Number(f?.amount) || 0,
        currency: (f?.currency as string) || "EGP",
        reason: r.reason || "",
        status: r.status,
        created_at: String(r.created_at || "").slice(0, 10),
      };
    });
    setRows(mapped);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("refunds").update({ status }).eq("id", id);
    if (error) { toast("تعذّر التحديث"); return; }
    toast("تم التحديث");
    load();
  }

  if (loading) return <div style={{ padding: 20, color: "var(--muted)", textAlign: "center" }}>جاري التحميل…</div>;

  if (rows.length === 0) return <div className="empty"><b>لا توجد طلبات استرداد</b></div>;

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>اسم العميل</th>
            <th>الخدمة</th>
            <th>المبلغ</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = STATUS[r.status] || STATUS.requested;
            return (
              <tr key={r.id}>
                <td>
                  <Link href={`/customers/${r.customer_id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>
                    {r.customer_name}
                  </Link>
                </td>
                <td style={{ color: "var(--muted)", fontSize: 13 }}>{r.service}</td>
                <td className="num" dir="ltr" style={{ fontWeight: 700 }}>{money(r.amount, r.currency)}</td>
                <td><span className="stg" style={{ background: st.color + "1a", color: st.color }}>{st.label}</span></td>
                <td>
                  {r.status === "requested" && (
                    <button className="btn sm" onClick={() => updateStatus(r.id, "refunded")}>تم التحويل</button>
                  )}
                  {r.status === "refunded" && (
                    <button className="btn ghost sm" onClick={() => updateStatus(r.id, "closed")}>أرشفة</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
