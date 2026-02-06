import type { WAMessage } from '@whiskeysockets/baileys';
import { prisma } from '../config/database';
import { contactService } from './contact.service';

export class MessageService {
  async handleIncomingMessage(userId: string, waMessage: WAMessage): Promise<void> {
    try {
      const messageId = waMessage.key.id!;
      const fromMe = waMessage.key.fromMe ?? false;
      const remoteJid = waMessage.key.remoteJid!;

      const existing = await prisma.message.findUnique({
        where: { whatsappId: messageId },
      });

      if (existing) return;

      const contact = await contactService.getOrCreateContact(userId, remoteJid);

      const body = this.extractMessageBody(waMessage);
      const messageType = this.getMessageType(waMessage);
      const timestamp = waMessage.messageTimestamp
        ? new Date(Number(waMessage.messageTimestamp) * 1000)
        : new Date();

      await prisma.message.create({
        data: {
          userId,
          contactId: contact.id,
          whatsappId: messageId,
          fromMe,
          body,
          type: messageType,
          timestamp,
          hasMedia: messageType !== 'TEXT',
        },
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastInteraction: timestamp },
      });
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private extractMessageBody(waMessage: WAMessage): string | null {
    const msg = waMessage.message;
    if (!msg) return null;

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;

    return null;
  }

  private getMessageType(waMessage: WAMessage): 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'CONTACT' | 'OTHER' {
    const msg = waMessage.message;
    if (!msg) return 'TEXT';

    if (msg.imageMessage) return 'IMAGE';
    if (msg.videoMessage) return 'VIDEO';
    if (msg.audioMessage) return 'AUDIO';
    if (msg.documentMessage) return 'DOCUMENT';
    if (msg.stickerMessage) return 'STICKER';
    if (msg.locationMessage) return 'LOCATION';
    if (msg.contactMessage) return 'CONTACT';

    return 'TEXT';
  }

  async getMessagesForContact(
    userId: string,
    contactId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return prisma.message.findMany({
      where: { userId, contactId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            pushName: true,
            profilePicUrl: true,
          },
        },
      },
    });
  }

  async getAllMessages(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    return prisma.message.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            pushName: true,
            profilePicUrl: true,
          },
        },
      },
    });
  }
}

export const messageService = new MessageService();
