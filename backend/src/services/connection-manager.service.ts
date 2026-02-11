import { baileysService } from './baileys.service';

const LOG_PREFIX = '[ConnectionManager]';

interface ActiveUser {
  lastHeartbeat: number;
  checkTimer?: NodeJS.Timeout;
}

/**
 * Connection Manager Service
 * 
 * Manages WhatsApp connections based on frontend presence (heartbeats).
 * Mimics WhatsApp Desktop behavior:
 * - Connects when user opens CRM (first heartbeat)
 * - Disconnects when user closes CRM (no heartbeat for 2 minutes)
 * - Phone notifications work when CRM is closed
 */
class ConnectionManagerService {
  private activeUsers = new Map<string, ActiveUser>();

  /**
   * Record a heartbeat from a user.
   * This indicates the user has the CRM open in their browser.
   * Will connect to WhatsApp if not already connected.
   */
  recordHeartbeat(userId: string): void {
    const now = Date.now();
    const existing = this.activeUsers.get(userId);

    if (!existing) {
      // First heartbeat - connect to WhatsApp
      console.log(`${LOG_PREFIX} User ${userId} became active - connecting to WhatsApp`);
      this.connectUser(userId);
    }

    // Clear previous timer if exists
    if (existing?.checkTimer) {
      clearTimeout(existing.checkTimer);
    }

    // Update last heartbeat and schedule inactivity check
    const checkTimer = this.scheduleInactivityCheck(userId);
    this.activeUsers.set(userId, {
      lastHeartbeat: now,
      checkTimer,
    });
  }

  /**
   * Connect user to WhatsApp if not already connected.
   */
  private async connectUser(userId: string): Promise<void> {
    try {
      // Check if already connected
      if (baileysService.isConnected(userId)) {
        console.log(`${LOG_PREFIX} User ${userId} already connected`);
        return;
      }

      // Connect to WhatsApp
      // Baileys will automatically sync missed messages when reconnecting
      console.log(`${LOG_PREFIX} Initializing WhatsApp for user ${userId}...`);
      await baileysService.initializeWhatsApp(userId);
      console.log(`${LOG_PREFIX} User ${userId} connected - syncing history...`);
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to connect user ${userId}:`, error);
    }
  }

  /**
   * Schedule a check to see if user is still active.
   * If no heartbeat received for 2 minutes, disconnect.
   */
  private scheduleInactivityCheck(userId: string): NodeJS.Timeout {
    // Check if user is still active after 2 minutes
    return setTimeout(() => {
      this.checkInactivity(userId);
    }, 120000); // 2 minutes
  }

  /**
   * Check if user is inactive and disconnect if needed.
   */
  private checkInactivity(userId: string): void {
    const user = this.activeUsers.get(userId);
    if (!user) return;

    const now = Date.now();
    const timeSinceLastHeartbeat = now - user.lastHeartbeat;

    // If no heartbeat for 2 minutes, disconnect
    if (timeSinceLastHeartbeat > 120000) {
      console.log(`${LOG_PREFIX} User ${userId} inactive (${Math.round(timeSinceLastHeartbeat / 1000)}s since last heartbeat) - disconnecting from WhatsApp`);
      this.disconnectUser(userId);
    }
  }

  /**
   * Disconnect user from WhatsApp.
   */
  private async disconnectUser(userId: string): Promise<void> {
    try {
      await baileysService.disconnectWhatsApp(userId);
      this.activeUsers.delete(userId);
      console.log(`${LOG_PREFIX} User ${userId} disconnected - phone notifications enabled`);
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to disconnect user ${userId}:`, error);
    }
  }

  /**
   * Check if user is currently active (has sent heartbeat within last 2 minutes).
   */
  isUserActive(userId: string): boolean {
    const user = this.activeUsers.get(userId);
    if (!user) return false;

    const timeSinceLastHeartbeat = Date.now() - user.lastHeartbeat;
    return timeSinceLastHeartbeat < 120000; // Active if heartbeat within 2 minutes
  }

  /**
   * Get time since last heartbeat for a user (in milliseconds).
   * Returns null if user is not tracked.
   */
  getTimeSinceLastHeartbeat(userId: string): number | null {
    const user = this.activeUsers.get(userId);
    if (!user) return null;
    return Date.now() - user.lastHeartbeat;
  }

  /**
   * Ensure WhatsApp is connected for scheduled messages.
   * Connects if not already connected, even if no heartbeat was received.
   * This allows scheduled messages to be sent even when the CRM is closed.
   */
  async ensureConnectedForScheduledMessage(userId: string): Promise<void> {
    // Check if already connected
    if (baileysService.isConnected(userId)) {
      return;
    }

    // Connect to WhatsApp for scheduled message
    // Don't record heartbeat - let it disconnect after inactivity if CRM is closed
    console.log(`${LOG_PREFIX} Connecting WhatsApp for scheduled message (user ${userId})`);
    await this.connectUser(userId);
  }
}

export const connectionManager = new ConnectionManagerService();
