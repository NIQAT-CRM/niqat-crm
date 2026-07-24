import { redirect } from "next/navigation";

// سجل الشات بقى تبويب جوّه الإعدادات
export default function ChatLogRedirect() {
  redirect("/settings?tab=chatlog");
}
