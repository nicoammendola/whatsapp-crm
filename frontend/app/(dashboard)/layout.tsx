"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize heartbeat system - connects WhatsApp when CRM is open
  useWhatsAppConnection();

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
        <DashboardNav />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
