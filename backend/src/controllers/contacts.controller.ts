import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { contactService } from '../services/contact.service';

export async function getAllContacts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contacts = await contactService.getAllContacts(userId);
    res.json({ contacts });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
}

export async function getContactById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const contact = await contactService.getContactById(userId, id);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json({ contact });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
}

export async function updateContact(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const contact = await contactService.getContactById(userId, id);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    const { notes, tags } = req.body;
    const data: { notes?: string; tags?: string[] } = {};
    if (notes !== undefined && typeof notes === 'string') data.notes = notes;
    if (Array.isArray(tags)) data.tags = tags.filter((t): t is string => typeof t === 'string');
    await contactService.updateContact(userId, id, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
}
