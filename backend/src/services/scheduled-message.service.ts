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

    if (existing.status !== 'pending' && existing.status !== 'failed') {
      throw new Error('Only pending or failed messages can be updated');
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

  /** Get all pending scheduled messages due to be sent (for cron). */
  async getDuePending() {
    const now = new Date();
    return prisma.scheduledMessage.findMany({
      where: {
        status: 'pending',
        scheduledTime: { lte: now },
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
}

export const scheduledMessageService = new ScheduledMessageService();
