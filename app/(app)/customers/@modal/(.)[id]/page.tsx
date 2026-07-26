// اعتراض /customers/[id] عند الانتقال من القائمة → يفتح الكارت فوقها كـ modal.
// مهم: نتجاهل الروتس الثابتة زي /customers/new حتى ميتعاملش "new" كـ id (كان بيعمل 404).
import CustomerModalPage from "../../[id]/page";

export const dynamic = "force-dynamic";

export default async function InterceptedCustomer({ params }: { params: { id: string } }) {
  if (params.id === "new") return null;
  return <CustomerModalPage params={params} />;
}
