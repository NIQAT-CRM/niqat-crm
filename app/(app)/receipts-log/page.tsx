import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// اتنقل سجل الإيصالات ليبقى تبويب جوه صفحة «الإيصالات» — نحوّل أي لينك قديم للتبويب
export default function ReceiptsLogRedirect() {
  redirect("/screenshots?tab=log");
}
