"use client";

interface ConnectionStatusProps {
  status: {
    connected: boolean;
    session: { qrCode: string | null; phoneNumber: string | null; lastConnected?: string | null } | null;
  } | null;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  if (!status) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
        Checking connection status…
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
        <span className="font-medium">Connected</span>
        {status.session?.phoneNumber && (
          <span className="ml-2">· {status.session.phoneNumber}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <span className="font-medium">Not connected</span>
      <span className="ml-2">— Generate a QR code below to link WhatsApp.</span>
    </div>
  );
}
