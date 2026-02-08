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
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
        <div className="h-2 w-2 rounded-full bg-zinc-400" />
        <span>Checking connection status…</span>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        <span className="font-medium">Connected to WhatsApp</span>
        {status.session?.phoneNumber && (
          <span className="text-emerald-700 dark:text-emerald-300">· {status.session.phoneNumber}</span>
        )}
        <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-300">
          Phone notifications disabled
        </span>
      </div>
    );
  }

  // Not connected - could be offline or needs linking
  const hasSession = status.session?.phoneNumber;
  
  if (hasSession) {
    // Has session but not connected - likely offline (phone notifications active)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
        <div className="h-2 w-2 rounded-full bg-zinc-400" />
        <span className="font-medium">Offline</span>
        <span className="text-zinc-500 dark:text-zinc-400">— Phone notifications active</span>
        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          Connection will resume when you use the CRM
        </span>
      </div>
    );
  }

  // No session - needs initial linking
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <div className="h-2 w-2 rounded-full bg-amber-500" />
      <span className="font-medium">Not connected</span>
      <span className="text-amber-700 dark:text-amber-300">— Generate a QR code below to link WhatsApp.</span>
    </div>
  );
}
