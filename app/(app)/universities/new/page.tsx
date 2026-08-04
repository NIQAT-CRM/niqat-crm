import { redirect } from "next/navigation";
import { hasPerm } from "@/lib/authz";
import NewUniForm from "./NewUniForm";

export const dynamic = "force-dynamic";

export default async function NewUniversityPage() {
  if (!(await hasPerm("can_manage_universities"))) redirect("/universities");
  return <NewUniForm />;
}
