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
    return prisma.contact.upsert({
      where: {
        userId_whatsappId: {
          userId,
          whatsappId: data.whatsappId,
        },
      },
      update: {
        name: data.name,
        pushName: data.pushName,
        phoneNumber: data.phoneNumber,
        profilePicUrl: data.profilePicUrl,
      },
      create: {
        userId,
        whatsappId: data.whatsappId,
        name: data.name,
        pushName: data.pushName,
        phoneNumber: data.phoneNumber,
        profilePicUrl: data.profilePicUrl,
        isGroup: data.whatsappId.endsWith('@g.us'),
      },
    });
  }

  async getAllContacts(userId: string) {
    return prisma.contact.findMany({
      where: { userId },
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
    data: { notes?: string; tags?: string[] }
  ) {
    return prisma.contact.updateMany({
      where: { userId, id: contactId },
      data,
    });
  }
}

export const contactService = new ContactService();
