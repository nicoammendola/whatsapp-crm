import { WhatsAppSettings } from "@/components/whatsapp/WhatsAppSettings";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        WhatsApp connection
      </h1>
      <WhatsAppSettings />
    </div>
  );
}
