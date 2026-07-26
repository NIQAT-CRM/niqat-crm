import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// يتأكد إن المستخدم عنده الصلاحية (أو أدمن)، وإلا يرجّعه للوحة المعلومات.
// يُستخدم في أعلى أي صفحة سيرفر محميّة.
export async function requirePerm(col: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = (await supabase
    .from("profiles")
    .select(`team, ${col}`)
    .eq("id", user.id)
    .maybeSingle()) as any;
  const isAdmin = (p?.team || "").toLowerCase() === "admin";
  if (isAdmin) return;
  if (!p?.[col]) redirect("/");
}
