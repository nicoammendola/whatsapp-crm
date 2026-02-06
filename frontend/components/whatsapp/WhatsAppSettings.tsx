"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import { whatsappApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConnectionStatus } from "./ConnectionStatus";

const POLL_INTERVAL_MS = 3000;

type LinkMethod = "qr" | "phone";

export function WhatsAppSettings() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [linkMethod, setLinkMethod] = useState<LinkMethod>("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    connected: boolean;
    session: { qrCode: string | null; phoneNumber: string | null } | null;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await whatsappApi.getStatus();
      setStatus(data);
      if (data.session?.qrCode && !data.connected && linkMethod === "qr") {
        const url = await QRCode.toDataURL(data.session.qrCode, {
          width: 256,
          margin: 2,
        });
        setQrDataUrl(url);
      } else if (data.connected) {
        setQrDataUrl(null);
        setPairingCode(null);
      }
    } catch {
      setStatus(null);
      setQrDataUrl(null);
    }
  }, [linkMethod]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleInitializeQR = async () => {
    setLoading(true);
    setError(null);
    setPairingCode(null);
    try {
      const { data } = await whatsappApi.initialize();
      if (data.qr) {
        const url = await QRCode.toDataURL(data.qr, {
          width: 256,
          margin: 2,
        });
        setQrDataUrl(url);
      }
      if (data.connected) {
        setQrDataUrl(null);
        await fetchStatus();
      }
    } catch {
      setError("Failed to start WhatsApp connection");
    } finally {
      setLoading(false);
    }
  };

  const handlePairWithPhone = async () => {
    if (!phoneNumber.trim()) {
      setError("Enter your phone number (e.g. +54 9 11 2345-6789)");
      return;
    }
    setLoading(true);
    setError(null);
    setQrDataUrl(null);
    try {
      const { data } = await whatsappApi.pair(phoneNumber.trim());
      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
      } else {
        setError(data.message || "Failed to generate pairing code. Try again.");
      }
    } catch {
      setError("Failed to generate pairing code");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await whatsappApi.disconnect();
      setQrDataUrl(null);
      setPairingCode(null);
      await fetchStatus();
    } catch {
      setError("Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConnectionStatus status={status} />
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {status?.connected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connected</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You are connected. To use another device, disconnect first.
            </p>
            <Button
              variant="danger"
              onClick={handleDisconnect}
              disabled={loading}
            >
              Disconnect
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Link WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Method toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLinkMethod("phone")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  linkMethod === "phone"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                Phone number
              </button>
              <button
                type="button"
                onClick={() => setLinkMethod("qr")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  linkMethod === "qr"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                QR code
              </button>
            </div>

            {linkMethod === "phone" ? (
              <div className="flex flex-col items-center gap-4">
                {pairingCode ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Enter this code in WhatsApp:
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Settings → Linked devices → Link a device → Link with phone number
                    </p>
                    <div className="rounded-xl bg-zinc-100 px-8 py-4 font-mono text-3xl font-bold tracking-[0.3em] dark:bg-zinc-800">
                      {pairingCode}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Code expires in ~60 seconds. Connection will complete
                      automatically.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handlePairWithPhone}
                      disabled={loading}
                    >
                      Generate new code
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                      Enter your WhatsApp phone number (with country code, e.g.
                      +54 9 11 2345-6789)
                    </p>
                    <Input
                      type="tel"
                      placeholder="+1 234 567 8901"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                    <Button
                      onClick={handlePairWithPhone}
                      isLoading={loading}
                      className="w-full"
                    >
                      Get pairing code
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {qrDataUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={qrDataUrl}
                      alt="WhatsApp QR Code"
                      className="h-64 w-64 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                    <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                      Scan this code with WhatsApp on your phone (Settings →
                      Linked devices)
                    </p>
                    <p className="text-xs text-zinc-500">
                      QR refreshes automatically. If it expires, click below.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleInitializeQR}
                      disabled={loading}
                    >
                      Refresh QR code
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Generate a QR code and scan it with WhatsApp to link this
                      CRM.
                    </p>
                    <Button onClick={handleInitializeQR} isLoading={loading}>
                      Generate QR code
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
