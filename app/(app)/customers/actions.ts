"use server";
import { revalidatePath } from "next/cache";

// يبطّل كاش الصفحات اللي بتعرض العملاء عشان أي أرشفة/حذف تظهر فوراً من غير ريفريش يدوي
export async function revalidateCustomers() {
  revalidatePath("/customers");
  revalidatePath("/onboarding");
  revalidatePath("/refunds");
  revalidatePath("/archive");
}
