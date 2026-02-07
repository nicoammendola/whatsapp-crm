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
          // Skip poll votes/updates - they're encrypted and don't add CRM value
          if (typeKey === 'pollUpdateMessage') return;
      }

      const contact = await contactService.getOrCreateContact(userId, normalizedRemoteJid);

      const body = this.extractMessageBody(content);
      const { quotedContent, quotedMessageId } = await this.extractQuoted(content, userId, normalizedRemoteJid);
      const mentionedJids = this.extractMentions(content);

      // Group sender identity
      let senderJid: string | null = null;
      let senderName: string | null = null;
      let senderPhone: string | null = null;
      if (normalizedRemoteJid.endsWith('@g.us')) {
        const participant = waMessage.key.participant || waMessage.participant;
        if (participant) {
          senderJid = jidNormalizedUser(participant);
          senderName = waMessage.pushName ?? null;

          // Create or update contact for group participant so mentions can be resolved
          // Store the @s.whatsapp.net version as primary, and @lid as alternative
          const participantAlt = (waMessage.key as any).participantAlt;
          if (participantAlt && senderJid) {
            // participantAlt is the real phone number (@s.whatsapp.net)
            // senderJid is the @lid version (used in mentions)
            await contactService.upsertContact(userId, {
              whatsappId: participantAlt,
              alternativeJid: senderJid,
              pushName: senderName || undefined,
            });
          } else if (senderJid) {
            // Fallback if no participantAlt
            await contactService.upsertContact(userId, {
              whatsappId: senderJid,
              pushName: senderName || undefined,
            });
          }
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
          mentionedJids,
          rawMessage: waMessage as any, // Store complete WAMessage for debugging and analysis
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

    if (content.extendedTextMessage?.contextInfo) {
      contextInfo = content.extendedTextMessage.contextInfo as unknown as typeof contextInfo;
    }
    // Also check other message types that can contain contextInfo with quotes
    if (!contextInfo && content.imageMessage?.contextInfo) {
      contextInfo = content.imageMessage.contextInfo as unknown as typeof contextInfo;
    }
    if (!contextInfo && content.videoMessage?.contextInfo) {
      contextInfo = content.videoMessage.contextInfo as unknown as typeof contextInfo;
    }
    if (!contextInfo && content.documentMessage?.contextInfo) {
      contextInfo = content.documentMessage.contextInfo as unknown as typeof contextInfo;
    }

    if (!contextInfo) return { quotedContent: null, quotedMessageId: null } as const;

    // Only treat as a quote if contextInfo actually has quote-related fields
    // contextInfo can exist for other reasons (mentions, expiration, statusSourceType, etc.)
    const hasQuoteData = contextInfo.quotedMessage || contextInfo.stanzaId;
    if (!hasQuoteData) return { quotedContent: null, quotedMessageId: null } as const;

    const quotedMsg = contextInfo.quotedMessage;
    const quotedContent = quotedMsg
      ? (typeof quotedMsg.conversation === 'string'
          ? quotedMsg.conversation
          : quotedMsg.extendedTextMessage?.text ?? '[Media]')
      : null;

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

  private extractMentions(
    content: ReturnType<typeof normalizeMessageContent>
  ): string[] {
    if (!content || typeof content !== 'object') return [];

    // Check extendedTextMessage for mentions (most common)
    if (content.extendedTextMessage?.contextInfo?.mentionedJid) {
      const mentioned = content.extendedTextMessage.contextInfo.mentionedJid;
      if (Array.isArray(mentioned)) {
        return mentioned.map(jid => jidNormalizedUser(jid as string)).filter(Boolean);
      }
    }

    // Check other message types that can have contextInfo
    const messageTypes = [
      content.imageMessage,
      content.videoMessage,
      content.documentMessage
    ];

    for (const msgType of messageTypes) {
      if (msgType?.contextInfo?.mentionedJid) {
        const mentioned = msgType.contextInfo.mentionedJid;
        if (Array.isArray(mentioned)) {
          return mentioned.map(jid => jidNormalizedUser(jid as string)).filter(Boolean);
        }
      }
    }

    return [];
  }

  private async enrichMessagesWithMentions<T extends { mentionedJids: string[] }>(
    userId: string,
    messages: T[]
  ): Promise<(T & { mentions?: Array<{ jid: string; name: string | null; pushName: string | null }> })[]> {
    // Collect all unique mentioned JIDs from all messages
    const allMentionedJids = new Set<string>();
    messages.forEach(msg => {
      msg.mentionedJids?.forEach(jid => allMentionedJids.add(jid));
    });

    if (allMentionedJids.size === 0) {
      return messages.map(msg => ({ ...msg, mentions: [] }));
    }

    const mentionedJidsArray = Array.from(allMentionedJids);

    // Fetch contacts by either whatsappId OR alternativeJid matching the mentioned JIDs
    const mentionedContacts = await prisma.contact.findMany({
      where: {
        userId,
        OR: [
          { whatsappId: { in: mentionedJidsArray } },
          { alternativeJid: { in: mentionedJidsArray } },
        ],
      },
      select: {
        whatsappId: true,
        alternativeJid: true,
        name: true,
        pushName: true,
      },
    });

    // Create a map for quick lookup by BOTH whatsappId and alternativeJid
    const contactMap = new Map<string, { name: string | null; pushName: string | null }>();
    
    mentionedContacts.forEach(contact => {
      const info = { name: contact.name, pushName: contact.pushName };
      // Map by primary whatsappId
      contactMap.set(contact.whatsappId, info);
      // Also map by alternativeJid if present
      if (contact.alternativeJid) {
        contactMap.set(contact.alternativeJid, info);
      }
    });

    // Enrich each message with mention data
    return messages.map(msg => ({
      ...msg,
      mentions: msg.mentionedJids?.map(jid => ({
        jid,
        name: contactMap.get(jid)?.name ?? null,
        pushName: contactMap.get(jid)?.pushName ?? null,
      })) ?? [],
    }));
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

    // Extract poll question from any poll version
    const pollMsg = content.pollCreationMessage || content.pollCreationMessageV2 || content.pollCreationMessageV3;
    if (pollMsg && typeof pollMsg === 'object' && 'name' in pollMsg) {
      return (pollMsg as any).name ?? null;
    }

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
    | 'POLL'
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
    
    // Detect polls (all versions)
    if (type === 'pollCreationMessage' || type === 'pollCreationMessageV2' || type === 'pollCreationMessageV3') {
      return 'POLL';
    }

    return 'TEXT';
  }

  async getMessagesForContact(
    userId: string,
    contactId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const messages = await prisma.message.findMany({
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

    // Enrich messages with mention contact information
    return this.enrichMessagesWithMentions(userId, messages);
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
    const message = await prisma.message.findFirst({
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

    if (!message) return null;

    const enriched = await this.enrichMessagesWithMentions(userId, [message]);
    return enriched[0];
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
    const messages = await prisma.message.findMany({
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

    return this.enrichMessagesWithMentions(userId, messages);
  }
}

export const messageService = new MessageService();
