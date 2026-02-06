import { prisma } from '../config/database';

export class AnalyticsService {
  /** Contacts the user hasn't interacted with in the last 7 days (excluding groups). */
  async getContactsNeedingAttention(userId: string, limit = 10) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return prisma.contact.findMany({
      where: {
        userId,
        isGroup: false,
        lastInteraction: {
          lt: sevenDaysAgo,
        },
      },
      orderBy: {
        lastInteraction: 'asc',
      },
      take: limit,
    });
  }

  /** Contacts where the last message in the thread was not from the user (pending reply). */
  async getPendingReplies(userId: string, limit = 20) {
    const contacts = await prisma.contact.findMany({
      where: { userId, isGroup: false },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { fromMe: true },
        },
      },
    });

    const pending = contacts.filter(
      (c) => c.messages.length > 0 && !c.messages[0].fromMe
    );

    return pending.slice(0, limit).map(({ messages, ...contact }) => ({
      ...contact,
      lastMessageFromMe: false,
    }));
  }

  /** Basic stats for a contact (message counts). */
  async getContactStats(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { userId, id: contactId },
    });
    if (!contact) return null;

    const messages = await prisma.message.findMany({
      where: { userId, contactId },
    });

    const sentByUser = messages.filter((m) => m.fromMe).length;
    const receivedFromContact = messages.filter((m) => !m.fromMe).length;

    return {
      contactId,
      totalMessages: messages.length,
      sentByUser,
      receivedFromContact,
    };
  }

  /** Dashboard payload: needs attention + pending replies. */
  async getDashboard(userId: string) {
    const [needsAttention, pendingReplies] = await Promise.all([
      this.getContactsNeedingAttention(userId),
      this.getPendingReplies(userId),
    ]);
    return {
      needsAttention,
      pendingReplies,
    };
  }
}

export const analyticsService = new AnalyticsService();
