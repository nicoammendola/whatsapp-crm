import { prisma } from '../config/database';

export class ReminderService {
  async listByContact(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });
    if (!contact) return null;

    return prisma.reminder.findMany({
      where: { userId, contactId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async create(userId: string, contactId: string, data: { dueDate: Date; notes?: string | null }) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId },
    });
    if (!contact) return null;

    return prisma.reminder.create({
      data: {
        userId,
        contactId,
        dueDate: data.dueDate,
        notes: data.notes ?? null,
      },
    });
  }

  async update(
    userId: string,
    contactId: string,
    reminderId: string,
    data: { dueDate?: Date; notes?: string | null }
  ) {
    const reminder = await prisma.reminder.findFirst({
      where: { id: reminderId, contactId, userId },
    });
    if (!reminder) return null;

    return prisma.reminder.update({
      where: { id: reminderId },
      data: {
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  async delete(userId: string, contactId: string, reminderId: string) {
    const reminder = await prisma.reminder.findFirst({
      where: { id: reminderId, contactId, userId },
    });
    if (!reminder) return null;

    await prisma.reminder.delete({
      where: { id: reminderId },
    });
    return { deleted: true };
  }

  async getUpcomingPaginated(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{
    reminders: Array<{
      id: string;
      contactId: string;
      dueDate: Date;
      notes: string | null;
      contact: {
        id: string;
        name: string | null;
        pushName: string | null;
        phoneNumber: string | null;
        profilePicUrl: string | null;
      };
      daysUntil: number;
      urgency: 'low' | 'medium' | 'high';
    }>;
    total: number;
    hasMore: boolean;
  }> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const [reminders, total] = await Promise.all([
      prisma.reminder.findMany({
        where: { userId, dueDate: { gte: now } },
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
        orderBy: { dueDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.reminder.count({
        where: { userId, dueDate: { gte: now } },
      }),
    ]);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const msPerDay = 24 * 60 * 60 * 1000;

    const items = reminders.map((r) => {
      const due = new Date(r.dueDate);
      const dueDayStart = new Date(due);
      dueDayStart.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((dueDayStart.getTime() - todayStart.getTime()) / msPerDay);
      let urgency: 'low' | 'medium' | 'high' = 'low';
      if (daysUntil <= 0) urgency = 'high';
      else if (daysUntil <= 7) urgency = 'medium';

      return {
        id: r.id,
        contactId: r.contactId,
        dueDate: r.dueDate,
        notes: r.notes,
        contact: r.contact,
        daysUntil,
        urgency,
      };
    });

    return {
      reminders: items,
      total,
      hasMore: offset + reminders.length < total,
    };
  }
}

export const reminderService = new ReminderService();
