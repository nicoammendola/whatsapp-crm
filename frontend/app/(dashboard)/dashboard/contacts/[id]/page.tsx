import { ContactDetail } from "@/components/contacts/ContactDetail";

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ContactDetail params={params} />;
}
