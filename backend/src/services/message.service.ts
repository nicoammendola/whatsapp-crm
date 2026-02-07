import {
  downloadMediaMessage,
  normalizeMessageContent,
  getContentType,
  jidNormalizedUser,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys';
import { prisma } from '../config/database';
import { contactService } from './contact.service';
import { supabase, MEDIA_BUCKET } from '../config/supabase';
import { emitToUser } from './socket.service';
import mime from 'mime-types';

const LOG_PREFIX = '[Message]';

export class MessageService {
  async handleIncomingMessage(
    userId: string,
    waMessage: WAMessage,
    sock?: WASocket
  ): Promise<{ id: string } | void> {
    try {
      const messageId = waMessage.key.id;
      const remoteJid = waMessage.key.remoteJid;
      if (!messageId || !remoteJid) return;

      const fromMe = waMessage.key.fromMe ?? false;
      let normalizedRemoteJid = jidNormalizedUser(remoteJid);

      // Handle @lid (Local ID) JIDs - these are temporary IDs that WhatsApp uses
      // We should skip these messages as they'll arrive again with the proper JID
      if (normalizedRemoteJid.endsWith('@lid')) {
        console.warn(`${LOG_PREFIX} Skipping message with @lid JID: ${normalizedRemoteJid}`);
        return;
      }

      const existing = await prisma.message.findUnique({
        where: { whatsappId: messageId },
      });

      if (existing) return { id: existing.id };

      // Process protocol messages first (e.g. revokes, edits, history sync)
      // Protocol messages are "real" messages in Baileys but we might want to handle them differently
      // However, reactions are often delivered as messages too.
      
      const content = normalizeMessageContent(waMessage.message);
      const messageType = this.getMessageType(content);

      // Skip processing if it's a reaction message (handled by handleReaction via events)
      // or if it's a protocol message that doesn't need a row (like a history sync notification)
      // Note: Baileys emits 'messages.reaction' separately, so we can ignore reactionMessage here to avoid dupes
      if (messageType === 'OTHER') {
          const typeKey = getContentType(content);
          if (typeKey === 'reactionMessage') return;
      }

      const contact = await contactService.getOrCreateContact(userId, normalizedRemoteJid);

      const body = this.extractMessageBody(content);
      const { quotedContent, quotedMessageId } = await this.extractQuoted(content, userId, normalizedRemoteJid);

      // Group sender identity
      let senderJid: string | null = null;
      let senderName: string | null = null;
      let senderPhone: string | null = null;
      if (normalizedRemoteJid.endsWith('@g.us')) {
        const participant = waMessage.key.participant || waMessage.participant;
        if (participant) {
          senderJid = jidNormalizedUser(participant);
          senderName = waMessage.pushName ?? null;
        } else {
            console.warn(`${LOG_PREFIX} Group message from ${remoteJid} has no participant`, waMessage.key);
        }
      }

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
          quotedContent,
          quotedMessageId,
          senderJid,
          senderName,
          senderPhone,
        },
      });

      // Update contact timestamp - use current time to ensure accuracy
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastInteraction: new Date() },
      });

      // Update interaction stats (fire-and-forget)
      contactService.updateInteractionStats(userId, contact.id).catch((err) => {
        console.error(`${LOG_PREFIX} Failed to update interaction stats for contact ${contact.id}:`, err);
      });

      // Emit real-time event
      emitToUser(userId, 'new_message', {
          ...message,
          contact: { 
              id: contact.id, 
              name: contact.name, 
              pushName: contact.pushName, 
              profilePicUrl: contact.profilePicUrl 
          }
      });

      // Download and upload media in the background (don't block message processing)
      if (hasMedia && sock && supabase) {
        void this.processMedia(userId, contact.id, message.id, waMessage, sock);
      }

      return { id: message.id };
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private async extractQuoted(
    content: ReturnType<typeof normalizeMessageContent>,
    userId: string,
    remoteJid: string
  ): Promise<{ quotedContent: string | null; quotedMessageId: string | null }> {
    if (!content || typeof content !== 'object') return { quotedContent: null, quotedMessageId: null } as const;

    let contextInfo: { quotedMessage?: { conversation?: string; extendedTextMessage?: { text?: string } }; stanzaId?: string } | undefined;
    let quotedText: string | null = null;

    if (content.extendedTextMessage?.contextInfo) {
      contextInfo = content.extendedTextMessage.contextInfo as unknown as typeof contextInfo;
      quotedText = content.extendedTextMessage.text ?? null;
    }
    // Also check other message types that can contain text/caption + quote
    if (!contextInfo && content.imageMessage?.contextInfo) {
      contextInfo = content.imageMessage.contextInfo as unknown as typeof contextInfo;
      quotedText = content.imageMessage.caption ?? '[Image]';
    }
    if (!contextInfo && content.videoMessage?.contextInfo) {
      contextInfo = content.videoMessage.contextInfo as unknown as typeof contextInfo;
      quotedText = content.videoMessage.caption ?? '[Video]';
    }
    if (!contextInfo && content.documentMessage?.contextInfo) {
      contextInfo = content.documentMessage.contextInfo as unknown as typeof contextInfo;
      quotedText = content.documentMessage.caption ?? '[Document]';
    }
    if (!contextInfo && content.conversation) {
        // Plain text usually doesn't have contextInfo, but if normalized from extendedText it might
    }

    if (!contextInfo) return { quotedContent: null, quotedMessageId: null } as const;

    const quotedMsg = contextInfo.quotedMessage;
    const quotedContent = quotedMsg
      ? (typeof quotedMsg.conversation === 'string'
          ? quotedMsg.conversation
          : quotedMsg.extendedTextMessage?.text ?? '[Media]')
      : quotedText ?? null;

    let quotedMessageId: string | null = null;
    const stanzaId = contextInfo.stanzaId;
    if (stanzaId) {
      const existing = await prisma.message.findFirst({
        where: { userId, whatsappId: stanzaId },
        select: { id: true },
      });
      quotedMessageId = existing?.id ?? null;
    }

    return { quotedContent, quotedMessageId };
  }

  async handleReaction(
    userId: string,
    key: { remoteJid?: string; id?: string; fromMe?: boolean; participant?: string },
    reaction: { text?: string | null }
  ): Promise<void> {
    try {
      const remoteJid = key.remoteJid;
      const messageId = key.id;
      const fromMe = key.fromMe ?? false;
      if (!remoteJid || !messageId) return;

      const normalizedRemoteJid = jidNormalizedUser(remoteJid);
      const contact = await contactService.getOrCreateContact(userId, normalizedRemoteJid);

      const msg = await prisma.message.findFirst({
        where: { userId, contactId: contact.id, whatsappId: messageId },
      });
      if (!msg) return;

      const emoji = reaction?.text?.trim() ?? '';

      if (!emoji) {
        await prisma.reaction.deleteMany({
          where: { messageId: msg.id, fromMe },
        });
      } else {
        await prisma.reaction.upsert({
          where: {
            messageId_fromMe: { messageId: msg.id, fromMe },
          },
          create: {
            messageId: msg.id,
            emoji,
            fromMe,
          },
          update: { emoji },
        });
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Error handling reaction:`, err);
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

      const msgContent = normalizeMessageContent(waMessage.message);
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

  private extractMessageBody(
    content: ReturnType<typeof normalizeMessageContent>
  ): string | null {
    if (!content || typeof content !== 'object') return null;

    if (typeof content.conversation === 'string') return content.conversation;
    if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
    if (content.imageMessage?.caption) return content.imageMessage.caption;
    if (content.videoMessage?.caption) return content.videoMessage.caption;
    if (content.documentMessage?.caption) return content.documentMessage.caption;

    return null;
  }

  private getMessageType(
    content: ReturnType<typeof normalizeMessageContent>
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
    if (!content || typeof content !== 'object') return 'TEXT';

    const type = getContentType(content);
    if (!type) return 'TEXT';

    if (type === 'reactionMessage') return 'OTHER'; // Explicitly mark reactions as OTHER to skip
    if (type === 'imageMessage') return 'IMAGE';
    if (type === 'videoMessage' || type === 'ptvMessage') return 'VIDEO';
    if (type === 'audioMessage') return 'AUDIO';
    if (type === 'documentMessage') return 'DOCUMENT';
    if (type === 'stickerMessage') return 'STICKER';
    if (type === 'locationMessage' || type === 'liveLocationMessage') return 'LOCATION';
    if (type === 'contactMessage') return 'CONTACT';

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
        quotedMessage: {
          select: { id: true, body: true, fromMe: true, timestamp: true },
        },
        reactions: {
          select: { emoji: true, fromMe: true },
        },
      },
    });
  }

  async getConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    search?: string
  ): Promise<{ conversations: Array<{ contact: any; lastMessage: any; unreadCount: number }>; hasMore: boolean }> {
    // Single query: contact IDs ordered by latest message timestamp (most recent first)
    // If search is provided, filter by contact name/phone
    let ordered: Array<{ contactId: string; lastTs: Date; unreadCount: bigint }>;
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      ordered = await prisma.$queryRaw<
        Array<{ contactId: string; lastTs: Date; unreadCount: bigint }>
      >`
        SELECT m."contactId",
               MAX(m."timestamp") as "lastTs",
               COUNT(*) FILTER (WHERE m."isRead" = false AND m."fromMe" = false)::bigint as "unreadCount"
        FROM messages m
        INNER JOIN contacts c ON c.id = m."contactId"
        WHERE m."userId" = ${userId}
          AND (
            c.name ILIKE ${searchTerm}
            OR c."pushName" ILIKE ${searchTerm}
            OR c."phoneNumber" ILIKE ${searchTerm}
            OR c."whatsappId" ILIKE ${searchTerm}
          )
        GROUP BY m."contactId"
        ORDER BY "lastTs" DESC NULLS LAST
        LIMIT ${limit + 1}
        OFFSET ${offset}
      `;
    } else {
      ordered = await prisma.$queryRaw<
        Array<{ contactId: string; lastTs: Date; unreadCount: bigint }>
      >`
        SELECT m."contactId",
               MAX(m."timestamp") as "lastTs",
               COUNT(*) FILTER (WHERE m."isRead" = false AND m."fromMe" = false)::bigint as "unreadCount"
        FROM messages m
        WHERE m."userId" = ${userId}
        GROUP BY m."contactId"
        ORDER BY "lastTs" DESC NULLS LAST
        LIMIT ${limit + 1}
        OFFSET ${offset}
      `;
    }

    const hasMore = ordered.length > limit;
    const page = hasMore ? ordered.slice(0, limit) : ordered;
    if (page.length === 0) return { conversations: [], hasMore: false };

    const contactIds = page.map((r) => r.contactId);
    const [contacts, lastMessages] = await Promise.all([
      prisma.contact.findMany({ where: { id: { in: contactIds }, userId } }),
      Promise.all(
        contactIds.map((cid) =>
          prisma.message.findFirst({
            where: { userId, contactId: cid },
            orderBy: { timestamp: 'desc' },
          })
        )
      ),
    ]);

    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const conversations = [];
    for (let i = 0; i < page.length; i++) {
      const row = page[i];
      const contact = contactMap.get(row.contactId);
      const lastMessage = lastMessages[i];
      if (!contact || !lastMessage) continue;
      conversations.push({
        contact,
        lastMessage,
        unreadCount: Number(row.unreadCount),
      });
    }

    return { conversations, hasMore };
  }

  async getMessageById(userId: string, messageId: string) {
    return prisma.message.findFirst({
      where: { userId, id: messageId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            pushName: true,
            profilePicUrl: true,
          },
        },
        quotedMessage: {
          select: { id: true, body: true, fromMe: true, timestamp: true },
        },
        reactions: {
          select: { emoji: true, fromMe: true },
        },
      },
    });
  }

  async markAsRead(userId: string, contactId: string): Promise<void> {
    await prisma.message.updateMany({
      where: {
        userId,
        contactId,
        isRead: false,
        fromMe: false,
      },
      data: { isRead: true },
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
        quotedMessage: {
          select: { id: true, body: true, fromMe: true, timestamp: true },
        },
        reactions: {
          select: { emoji: true, fromMe: true },
        },
      },
    });
  }
}

export const messageService = new MessageService();
