import { downloadMediaMessage, type WAMessage, type WASocket } from '@whiskeysockets/baileys';
import { prisma } from '../config/database';
import { contactService } from './contact.service';
import { supabase, MEDIA_BUCKET } from '../config/supabase';
import mime from 'mime-types';

const LOG_PREFIX = '[Message]';

export class MessageService {
  async handleIncomingMessage(
    userId: string,
    waMessage: WAMessage,
    sock?: WASocket
  ): Promise<void> {
    try {
      const messageId = waMessage.key.id;
      const remoteJid = waMessage.key.remoteJid;
      if (!messageId || !remoteJid) return;

      const fromMe = waMessage.key.fromMe ?? false;

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

      const hasMedia = messageType !== 'TEXT';

      const message = await prisma.message.create({
        data: {
          userId,
          contactId: contact.id,
          whatsappId: messageId,
          fromMe,
          body,
          type: messageType,
          timestamp,
          hasMedia,
        },
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastInteraction: timestamp },
      });

      // Download and upload media in the background (don't block message processing)
      if (hasMedia && sock && supabase) {
        void this.processMedia(userId, contact.id, message.id, waMessage, sock);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private async processMedia(
    userId: string,
    contactId: string,
    messageId: string,
    waMessage: WAMessage,
    sock: WASocket
  ): Promise<void> {
    try {
      if (!supabase) return;

      const buffer = await downloadMediaMessage(
        waMessage,
        'buffer',
        {},
      );

      if (!buffer || (buffer as Buffer).length === 0) return;

      const msgContent = waMessage.message;
      const mediaMimeType =
        msgContent?.imageMessage?.mimetype ??
        msgContent?.videoMessage?.mimetype ??
        msgContent?.audioMessage?.mimetype ??
        msgContent?.documentMessage?.mimetype ??
        msgContent?.stickerMessage?.mimetype ??
        'application/octet-stream';

      const ext = mime.extension(mediaMimeType) || 'bin';
      const filePath = `${userId}/${contactId}/${messageId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(filePath, buffer as Buffer, {
          contentType: mediaMimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`${LOG_PREFIX} Media upload failed:`, uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(filePath);

      await prisma.message.update({
        where: { id: messageId },
        data: {
          mediaUrl: urlData.publicUrl,
          mediaMimeType,
          mediaSize: (buffer as Buffer).length,
        },
      });
    } catch (err) {
      // Media download can fail for old messages or history sync — don't crash
      console.error(`${LOG_PREFIX} Media processing failed (non-fatal):`, err);
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

  private getMessageType(
    waMessage: WAMessage
  ):
    | 'TEXT'
    | 'IMAGE'
    | 'VIDEO'
    | 'AUDIO'
    | 'DOCUMENT'
    | 'STICKER'
    | 'LOCATION'
    | 'CONTACT'
    | 'OTHER' {
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

  async getConversations(userId: string) {
    const contacts = await prisma.contact.findMany({
      where: { userId },
      orderBy: { lastInteraction: 'desc' },
    });

    const conversations = [];

    for (const contact of contacts) {
      const lastMessage = await prisma.message.findFirst({
        where: { userId, contactId: contact.id },
        orderBy: { timestamp: 'desc' },
      });

      if (!lastMessage) continue;

      const unreadCount = await prisma.message.count({
        where: { userId, contactId: contact.id, isRead: false, fromMe: false },
      });

      conversations.push({
        contact,
        lastMessage,
        unreadCount,
      });
    }

    return conversations;
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
