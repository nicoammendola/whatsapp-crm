import { prisma } from '../config/database';

export class ContactService {
  async getOrCreateContact(userId: string, whatsappId: string) {
    let contact = await prisma.contact.findUnique({
      where: {
        userId_whatsappId: {
          userId,
          whatsappId,
        },
      },
    });

    if (!contact) {
      const isGroup = whatsappId.endsWith('@g.us');

      contact = await prisma.contact.create({
        data: {
          userId,
          whatsappId,
          isGroup,
        },
      });
    }

    return contact;
  }

  async upsertContact(
    userId: string,
    data: {
      whatsappId: string;
      name?: string;
      pushName?: string;
      phoneNumber?: string;
      profilePicUrl?: string;
    }
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.pushName !== undefined) updateData.pushName = data.pushName;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    // Do not overwrite profilePicUrl with undefined — keep existing value when imgUrl is missing
    if (data.profilePicUrl !== undefined) updateData.profilePicUrl = data.profilePicUrl;

    const createData = {
      userId,
      whatsappId: data.whatsappId,
      name: data.name,
      pushName: data.pushName,
      phoneNumber: data.phoneNumber,
      profilePicUrl: data.profilePicUrl,
      isGroup: data.whatsappId.endsWith('@g.us'),
    };

    return prisma.contact.upsert({
      where: {
        userId_whatsappId: {
          userId,
          whatsappId: data.whatsappId,
        },
      },
      update: updateData,
      create: createData,
    });
  }

  async getAllContacts(userId: string, search?: string) {
    const where: any = { userId };
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { pushName: { contains: search.trim(), mode: 'insensitive' } },
        { phoneNumber: { contains: search.trim(), mode: 'insensitive' } },
        { whatsappId: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    return prisma.contact.findMany({
      where,
      orderBy: { lastInteraction: 'desc' },
    });
  }

  async getContactById(userId: string, contactId: string) {
    return prisma.contact.findFirst({
      where: { userId, id: contactId },
    });
  }

  async updateContact(
    userId: string,
    contactId: string,
    data: {
      notes?: string;
      tags?: string[];
      birthday?: Date | null;
      company?: string | null;
      jobTitle?: string | null;
      location?: string | null;
      relationshipType?: string | null;
      contactFrequency?: string | null;
      importance?: number | null;
      customFields?: any;
    }
  ) {
    // Validate importance range
    if (data.importance !== undefined && data.importance !== null) {
      if (data.importance < 0 || data.importance > 5) {
        throw new Error('Importance must be between 0 and 5');
      }
    }

    // Validate enum values
    const validRelationshipTypes = ['family', 'close_friend', 'colleague', 'acquaintance', 'other'];
    if (data.relationshipType && !validRelationshipTypes.includes(data.relationshipType)) {
      throw new Error(`Invalid relationship type. Must be one of: ${validRelationshipTypes.join(', ')}`);
    }

    const validContactFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (data.contactFrequency && !validContactFrequencies.includes(data.contactFrequency)) {
      throw new Error(`Invalid contact frequency. Must be one of: ${validContactFrequencies.join(', ')}`);
    }

    return prisma.contact.updateMany({
      where: { userId, id: contactId },
      data,
    });
  }

  async updateInteractionStats(userId: string, contactId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [count7d, count30d, count90d] = await Promise.all([
      prisma.message.count({
        where: { userId, contactId, timestamp: { gte: sevenDaysAgo } },
      }),
      prisma.message.count({
        where: { userId, contactId, timestamp: { gte: thirtyDaysAgo } },
      }),
      prisma.message.count({
        where: { userId, contactId, timestamp: { gte: ninetyDaysAgo } },
      }),
    ]);

    await prisma.contact.updateMany({
      where: { userId, id: contactId },
      data: {
        interactionCount7d: count7d,
        interactionCount30d: count30d,
        interactionCount90d: count90d,
      },
    });
  }

  async getContactStats(userId: string, contactId: string) {
    const contact = await prisma.contact.findFirst({
      where: { userId, id: contactId },
      select: {
        id: true,
        lastInteraction: true,
        interactionCount7d: true,
        interactionCount30d: true,
        interactionCount90d: true,
        updatedAt: true,
      },
    });

    if (!contact) {
      return null;
    }

    // Check if stats need recalculation
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const isStale = contact.updatedAt < oneHourAgo;
    
    // Check if never calculated (null) or likely uninitialized (all are exactly 0 and stale)
    const hasNullStats = 
      contact.interactionCount7d === null ||
      contact.interactionCount30d === null ||
      contact.interactionCount90d === null;
    
    const likelyUninitialized = 
      contact.interactionCount7d === 0 &&
      contact.interactionCount30d === 0 &&
      contact.interactionCount90d === 0 &&
      isStale;

    // Recalculate if stale, never calculated, or likely uninitialized from migration
    if (isStale || hasNullStats || likelyUninitialized) {
      await this.updateInteractionStats(userId, contactId);
      // Refetch updated stats
      const updatedContact = await prisma.contact.findFirst({
        where: { userId, id: contactId },
        select: {
          interactionCount7d: true,
          interactionCount30d: true,
          interactionCount90d: true,
        },
      });
      if (updatedContact) {
        contact.interactionCount7d = updatedContact.interactionCount7d;
        contact.interactionCount30d = updatedContact.interactionCount30d;
        contact.interactionCount90d = updatedContact.interactionCount90d;
      }
    }

    // Get total message counts
    const [totalMessages, sentByUser, receivedFromContact] = await Promise.all([
      prisma.message.count({
        where: { userId, contactId },
      }),
      prisma.message.count({
        where: { userId, contactId, fromMe: true },
      }),
      prisma.message.count({
        where: { userId, contactId, fromMe: false },
      }),
    ]);

    return {
      contactId: contact.id,
      lastInteraction: contact.lastInteraction,
      interactionCount7d: contact.interactionCount7d ?? 0,
      interactionCount30d: contact.interactionCount30d ?? 0,
      interactionCount90d: contact.interactionCount90d ?? 0,
      totalMessages,
      sentByUser,
      receivedFromContact,
    };
  }
}

export const contactService = new ContactService();
