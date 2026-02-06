import { ContactList } from "@/components/contacts/ContactList";

export default function ContactsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Contacts
      </h1>
      <ContactList />
    </div>
  );
}
