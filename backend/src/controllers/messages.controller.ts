import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { messageService } from '../services/message.service';
import { contactService } from '../services/contact.service';
import { baileysService } from '../services/baileys.service';
import { parseLimit, parseOffset } from '../utils/helpers';

export async function markAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { contactId } = req.body;
    if (!contactId) {
      res.status(400).json({ error: 'Contact ID required' });
      return;
    }
    await messageService.markAsRead(userId, contactId);
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
}

export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { contactId, body, mediaUrl, mediaType } = req.body;
    if (!contactId || (!body && !mediaUrl)) {
      res.status(400).json({ error: 'Contact ID and content required' });
      return;
    }
    const result = await baileysService.sendMessage(userId, contactId, { body, mediaUrl, mediaType });
    let message = null;
    if (result?.id) {
      message = await messageService.getMessageById(userId, result.id);
    }
    res.json({ success: true, message: message ?? undefined });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
}

export async function getConversations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = parseLimit(req.query.limit, 20);
    const offset = parseOffset(req.query.offset, 0);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const { conversations, hasMore } = await messageService.getConversations(userId, limit, offset, search);
    res.json({ conversations, hasMore });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}

export async function getAllMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = parseLimit(req.query.limit, 100);
    const offset = parseOffset(req.query.offset, 0);

    const messages = await messageService.getAllMessages(userId, limit, offset);
    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

export async function getContactMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = typeof req.params.contactId === 'string' ? req.params.contactId : req.params.contactId[0];
    const limit = parseLimit(req.query.limit, 50);
    const offset = parseOffset(req.query.offset, 0);

    const contact = await contactService.getContactById(userId, contactId);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    const messages = await messageService.getMessagesForContact(
      userId,
      contactId,
      limit,
      offset
    );
    res.json({ messages });
  } catch (error) {
    console.error('Get contact messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}
