import { scheduledMessageService } from './scheduled-message.service';
import { baileysService } from './baileys.service';

const LOG_PREFIX = '[ScheduledSendCron]';

function log(message: string): void {
  console.log(`${LOG_PREFIX} ${message}`);
}

/**
 * Process due pending scheduled messages: send via WhatsApp (Baileys).
 * Called by cron every minute. Uses existing Baileys connection per user.
 * Retries failed sends up to 3 times with exponential backoff.
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
