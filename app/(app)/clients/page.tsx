import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// اتنقلت لتبويب "Campaign Paid" جوه صفحة الحملة — نحوّل أي لينك قديم
export default function ClientsRedirect() {
  redirect("/campaign");
}
