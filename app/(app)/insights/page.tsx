import { redirect } from "next/navigation";

// الرؤى بقت جزء من صفحة التقارير
export default function InsightsRedirect() {
  redirect("/reports");
}
