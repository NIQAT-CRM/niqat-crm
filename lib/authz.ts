import { createClient } from "@/lib/supabase/server";

// يرجّع true لو المستخدم عنده الصلاحية (أو أدمن). للاستخدام في حماية الصفحات.
export async function hasPerm(col: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = (await supabase
    .from("profiles")
    .select(`team, ${col}`)
    .eq("id", user.id)
    .maybeSingle()) as any;
  if ((p?.team || "").toLowerCase() === "admin") return true;
  return !!p?.[col];
}
