import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { messageService } from '../services/message.service';
import { contactService } from '../services/contact.service';
import { parseLimit, parseOffset } from '../utils/helpers';

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
