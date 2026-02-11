import { scheduledMessageService } from './scheduled-message.service';
import { baileysService } from './baileys.service';
import { connectionManager } from './connection-manager.service';

const LOG_PREFIX = '[ScheduledSendCron]';

function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

/**
 * Process due pending scheduled messages: send via WhatsApp (Baileys).
 * Automatically connects WhatsApp if needed, even when CRM is closed.
 * Called by cron every minute. Retries failed sends up to 3 times with exponential backoff.
 */
export async function processDueScheduledMessages(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const due = await scheduledMessageService.getDuePending();
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const row of due) {
    const userId = row.contact.userId;
    const contactId = row.contactId;
    const id = row.id;

    try {
      // If this is a failed message that failed due to connection issues,
      // reset it to pending with retryCount reset, since it wasn't a real failure
      if (row.status === 'failed' && row.errorMessage?.toLowerCase().includes('whatsapp not connected')) {
        await scheduledMessageService.resetConnectionFailure(id);
        log(`Resetting connection failure for message ${id} (retryCount was ${row.retryCount})`);
      }

      // Ensure WhatsApp is connected for scheduled messages
      // This connects even if CRM is closed (no heartbeat)
      await connectionManager.ensureConnectedForScheduledMessage(userId);

      await scheduledMessageService.setSending(id);
      log(`Sending scheduled message ${id} for contact ${contactId} (user ${userId})`);

      const result = await baileysService.sendMessage(userId, contactId, {
        body: row.messageText,
      });

      if (result?.id) {
        await scheduledMessageService.setSent(id);
        sent++;
        log(`Sent scheduled message ${id}`);
      } else {
        const errMsg = 'Send returned no message id';
        await scheduledMessageService.scheduleRetry(id, errMsg);
        failed++;
        errors.push(`${id}: ${errMsg}`);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      log(`Failed to send ${id}: ${errMsg}`);

      const updated = await scheduledMessageService.scheduleRetry(id, errMsg);
      if (updated) {
        log(`Scheduled retry for ${id} (retry ${updated.retryCount}/${3})`);
        failed++;
      } else {
        await scheduledMessageService.setFailed(id, errMsg, true);
        failed++;
      }
      errors.push(`${id}: ${errMsg}`);
    }
  }

  return {
    processed: due.length,
    sent,
    failed,
    errors,
  };
}
