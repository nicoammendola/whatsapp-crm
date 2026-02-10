import { WhatsAppSettings } from "@/components/whatsapp/WhatsAppSettings";
import AnthropicSettings from "@/components/settings/AnthropicSettings";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Settings
        </h1>
      </div>
      
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          WhatsApp Connection
        </h2>
        <WhatsAppSettings />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          AI Analysis (Anthropic)
        </h2>
        <AnthropicSettings />
      </div>
    </div>
  );
}
