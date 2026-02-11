import { prisma } from '../config/database';
import { contactService } from './contact.service';
import type { ScheduledMessageStatus } from '@prisma/client';

const MAX_RETRIES = 3;
const LOG_PREFIX = '[ScheduledMessage]';

export class ScheduledMessageService {
  async create(
    userId: string,
    contactId: string,
    data: { messageText: string; scheduledTime: Date }
  ): Promise<{ id: string; contactId: string; messageText: string; scheduledTime: Date; status: ScheduledMessageStatus; createdAt: Date; updatedAt: Date; errorMessage: null; sentAt: null } | null> {
    const contact = await contactService.getContactById(userId, contactId);
    if (!contact) return null;

    const now = new Date();
    if (data.scheduledTime <= now) {
      throw new Error('Scheduled time must be in the future');
    }

    const created = await prisma.scheduledMessage.create({
      data: {
        contactId,
        messageText: data.messageText,
        scheduledTime: data.scheduledTime,
        status: 'pending',
      },
    });
    return created as typeof created & { errorMessage: null; sentAt: null };
  }

  async getByContact(userId: string, contactId: string) {
    const contact = await contactService.getContactById(userId, contactId);
    if (!contact) return null;

    return prisma.scheduledMessage.findMany({
      where: { contactId },
      orderBy: { scheduledTime: 'asc' },
      include: {
        contact: {
          select: {
            name: true,
            pushName: true,
            phoneNumber: true
          }
        }
      }
    });
  }

  async getById(userId: string, id: string) {
    const row = await prisma.scheduledMessage.findUnique({
      where: { id },
      include: { contact: true },
    });
    if (!row || row.contact.userId !== userId) return null;
    return row;
  }

  async update(
    userId: string,
    id: string,
    data: { messageText?: string; scheduledTime?: Date }
  ) {
    const existing = await this.getById(userId, id);
    if (!existing) return null;

    const updateData: { messageText?: string; scheduledTime?: Date } = {};
    if (data.messageText !== undefined) updateData.messageText = data.messageText;
    if (data.scheduledTime !== undefined) {
      const now = new Date();
      if (data.scheduledTime <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      updateData.scheduledTime = data.scheduledTime;
    }

    if (existing.status !== 'pending' && existing.status !== 'failed' && existing.status !== 'llmSuggested') {
      throw new Error('Only pending, failed, or LLM-suggested messages can be updated');
    }

    return prisma.scheduledMessage.update({
      where: { id },
      data: updateData,
    });
  }

  async cancel(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    if (!existing) return null;
    if (existing.status !== 'pending' && existing.status !== 'failed') {
      throw new Error('Only pending or failed messages can be cancelled');
    }
    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  /** Get all pending scheduled messages due to be sent (for cron). 
   * Also includes failed messages that failed due to WhatsApp connection issues,
   * so they can be retried when WhatsApp is connected.
   */
  async getDuePending() {
    const now = new Date();
    return prisma.scheduledMessage.findMany({
      where: {
        OR: [
          {
            status: 'pending',
            scheduledTime: { lte: now },
          },
          {
            status: 'failed',
            scheduledTime: { lte: now },
            errorMessage: {
              contains: 'WhatsApp not connected',
              mode: 'insensitive',
            },
            // Only retry connection errors, not other failures
          },
        ],
      },
      include: { contact: true },
      orderBy: { scheduledTime: 'asc' },
    });
  }

  /** Get failed messages eligible for retry (retryCount < MAX_RETRIES). */
  async getFailedForRetry() {
    return prisma.scheduledMessage.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: MAX_RETRIES },
      },
      include: { contact: true },
      orderBy: { scheduledTime: 'asc' },
    });
  }

  async setSending(id: string) {
    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'sending' },
    });
  }

  async setSent(id: string) {
    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date(), errorMessage: null },
    });
  }

  async setFailed(id: string, errorMessage: string, incrementRetry = true) {
    const row = await prisma.scheduledMessage.findUnique({ where: { id } });
    if (!row) return null;
    const retryCount = incrementRetry ? row.retryCount + 1 : row.retryCount;
    return prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: 'failed',
        errorMessage,
        retryCount,
      },
    });
  }

  /**
   * Reset a failed message that failed due to WhatsApp connection issues.
   * Resets retryCount to 0 since connection failures aren't real message failures.
   */
  async resetConnectionFailure(id: string) {
    return prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: 0,
        errorMessage: null,
      },
    });
  }

  /** Schedule retry with exponential backoff: next run at now + (2^retryCount) minutes. */
  async scheduleRetry(id: string, errorMessage: string) {
    const row = await prisma.scheduledMessage.findUnique({ where: { id } });
    if (!row || row.retryCount >= MAX_RETRIES) {
      if (row) await this.setFailed(id, errorMessage, false);
      return null;
    }
    const retryCount = row.retryCount + 1;
    const backoffMinutes = Math.pow(2, retryCount);
    const nextTime = new Date(Date.now() + backoffMinutes * 60 * 1000);
    return prisma.scheduledMessage.update({
      where: { id },
      data: {
        status: 'pending',
        scheduledTime: nextTime,
        errorMessage,
        retryCount,
      },
    });
  }

  /**
   * Approve an LLM-suggested message (set status to pending)
   */
  async approve(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    if (!existing) return null;

    if (existing.status !== 'llmSuggested') {
      throw new Error('Only LLM-suggested messages can be approved');
    }

    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'pending' }
    });
  }

  /**
   * Reject an LLM-suggested message (set status to userRejected)
   */
  async reject(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    if (!existing) return null;

    if (existing.status !== 'llmSuggested') {
      throw new Error('Only LLM-suggested messages can be rejected');
    }

    return prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'userRejected' }
    });
  }

  /**
   * Get upcoming scheduled messages for dashboard (pending, sending, llmSuggested)
   */
  async getUpcomingPaginated(userId: string, limit: number, offset: number) {
    const now = new Date();
    
    const [scheduledMessages, total] = await Promise.all([
      prisma.scheduledMessage.findMany({
        where: {
          contact: { userId },
          status: { in: ['pending', 'sending', 'llmSuggested'] },
          scheduledTime: { gte: now },
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              pushName: true,
              phoneNumber: true,
              profilePicUrl: true,
            },
          },
        },
        orderBy: { scheduledTime: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.scheduledMessage.count({
        where: {
          contact: { userId },
          status: { in: ['pending', 'sending', 'llmSuggested'] },
          scheduledTime: { gte: now },
        },
      }),
    ]);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;

    const items = scheduledMessages.map((sm) => {
      const scheduled = new Date(sm.scheduledTime);
      const scheduledDayStart = new Date(scheduled);
      scheduledDayStart.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((scheduledDayStart.getTime() - todayStart.getTime()) / msPerDay);
      let urgency: 'low' | 'medium' | 'high' = 'low';
      if (daysUntil <= 0) urgency = 'high';
      else if (daysUntil <= 7) urgency = 'medium';

      return {
        id: sm.id,
        contactId: sm.contactId,
        messageText: sm.messageText,
        scheduledTime: sm.scheduledTime,
        status: sm.status,
        contact: sm.contact,
        daysUntil,
        urgency,
        llmReasoning: sm.llmReasoning,
        llmConfidence: sm.llmConfidence,
      };
    });

    return {
      scheduledMessages: items,
      total,
      hasMore: offset + scheduledMessages.length < total,
    };
  }
}

export const scheduledMessageService = new ScheduledMessageService();
