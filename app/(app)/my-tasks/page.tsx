import { createClient } from "@/lib/supabase/server";
import RealtimeRefresh from "../RealtimeRefresh";
import TaskList from "./TaskList";
export const dynamic = "force-dynamic";

export default async function MyTasks() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // الأدمن يشوف كل المهام (مع فلتر بالمستخدم)؛ غيره يشوف مهامه فقط
  const { data: me } = await supabase.from("profiles").select("team").eq("id", user?.id || "").maybeSingle();
  const isAdmin = String(me?.team || "").toLowerCase() === "admin";

  let tq = supabase.from("tasks").select("id,title,due_at,done,customer_id,assignee_id").order("due_at", { ascending: true }).limit(500);
  if (!isAdmin) tq = tq.eq("assignee_id", user?.id || "");

  const [
    { data: rows },
    { data: custs },
    { data: profs },
  ] = await Promise.all([
    tq,
    supabase.from("customers").select("id,name,phone1"),
    supabase.from("profiles").select("id,full_name"),
  ]);
  const cMap = new Map((custs || []).map((c) => [c.id, c]));
  const pMap = new Map((profs || []).map((p) => [p.id, p.full_name]));

  const tasks = (rows || []).map((k) => ({
    id: k.id as string,
    title: (k.title as string) || "—",
    due: k.due_at ? String(k.due_at).slice(0, 10) : "",
    done: !!k.done,
    custId: (k.customer_id as string) || "",
    custName: (cMap.get(k.customer_id || "") as any)?.name || "",
    phone: (cMap.get(k.customer_id || "") as any)?.phone1 || "",
    assignee: pMap.get(k.assignee_id || "") || "",
    assigneeId: (k.assignee_id as string) || "",
  }));

  const people = (profs || []).map((p) => ({ id: p.id as string, name: (p.full_name as string) || "—" }));

  return (<><RealtimeRefresh tables={["tasks","follow_ups"]} /><TaskList initial={tasks} meId={user?.id || ""} people={people} isAdmin={isAdmin} /></>);
}
