import { redirect } from "next/navigation";

// المستخدمون والصلاحيات بقوا تبويب جوّه الإعدادات
export default function UsersRedirect() {
  redirect("/settings?tab=users");
}
