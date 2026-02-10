"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

const HEARTBEAT_INTERVAL = 45000; // 45 seconds
const INITIAL_HEARTBEAT_DELAY = 1000; // 1 second after mount

/** Response shape from POST /whatsapp/heartbeat */
interface HeartbeatResponse {
  data?: { success?: boolean; connected?: boolean; message?: string };
}

/**
 * WhatsApp Connection Hook
 *
 * Sends periodic heartbeats to the backend to indicate the CRM is open.
 * Backend will connect/disconnect WhatsApp based on these heartbeats.
 *
 * When the CRM is open and WhatsApp is connected, syncs contacts once per
 * session so new contacts (e.g. added on the phone) appear in the CRM.
 *
 * Mimics WhatsApp Desktop behavior:
 * - Backend connects when CRM is open
 * - Backend disconnects when CRM is closed (no heartbeat for 2 minutes)
 * - Phone notifications work when CRM is closed
 */
export function useWhatsAppConnection() {
  const { user, token } = useAuthStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = useRef(false);
  const hasSyncedContactsRef = useRef(false);

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    isUnmountingRef.current = false;
    hasSyncedContactsRef.current = false;

    const sendHeartbeat = async () => {
      if (isUnmountingRef.current) {
        return;
      }

      try {
        const res = (await api.post("/whatsapp/heartbeat")) as HeartbeatResponse;
        const connected = res?.data?.connected === true;

        // Sync contacts once per session when we're connected (e.g. new contacts from phone)
        if (connected && !hasSyncedContactsRef.current) {
          hasSyncedContactsRef.current = true;
          api.post("/whatsapp/sync-contacts").catch(() => {
            hasSyncedContactsRef.current = false; // allow retry later
          });
        }
      } catch (error) {
        // Don't log errors if we're unmounting
        if (!isUnmountingRef.current) {
          console.error("Heartbeat failed:", error);
        }
      }
    };

    // Send initial heartbeat immediately (after a short delay)
    const initialTimeout = setTimeout(() => {
      if (!isUnmountingRef.current) {
        sendHeartbeat();
      }
    }, INITIAL_HEARTBEAT_DELAY);

    // Continue sending every 45 seconds
    intervalRef.current = setInterval(() => {
      if (!isUnmountingRef.current) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL);

    // Cleanup on unmount
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Note: No explicit disconnect needed here
      // The backend timeout (2 minutes) will handle disconnection
      // when no heartbeats are received. This works correctly even
      // if user has multiple tabs open - as long as one tab sends
      // heartbeats, connection stays active.
    };
  }, [user, token]);
}
