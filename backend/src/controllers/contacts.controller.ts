import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { contactService } from '../services/contact.service';
import { baileysService } from '../services/baileys.service';

export async function getAllContacts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const contacts = await contactService.getAllContacts(userId, search);
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

export async function refreshProfilePicture(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const contact = await contactService.getContactById(userId, id);
    if (!contact || !contact.whatsappId) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    const sock = baileysService.getConnection(userId);
    if (!sock) {
      res.status(503).json({ error: 'WhatsApp not connected' });
      return;
    }
    const url = await sock.profilePictureUrl(contact.whatsappId, 'image', 10000);
    if (url) {
      await contactService.upsertContact(userId, {
        whatsappId: contact.whatsappId,
        profilePicUrl: url,
      });
    }
    res.json({ profilePicUrl: url ?? contact.profilePicUrl ?? null });
  } catch (error) {
    console.error('Refresh profile picture error:', error);
    res.status(500).json({ error: 'Failed to refresh profile picture' });
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

    const {
      notes,
      tags,
      birthday,
      company,
      jobTitle,
      location,
      relationshipType,
      contactFrequency,
      importance,
      customFields,
    } = req.body;

    const data: {
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
    } = {};

    if (notes !== undefined && typeof notes === 'string') data.notes = notes;
    if (Array.isArray(tags)) data.tags = tags.filter((t): t is string => typeof t === 'string');
    if (birthday !== undefined) data.birthday = birthday ? new Date(birthday) : null;
    if (company !== undefined) data.company = company;
    if (jobTitle !== undefined) data.jobTitle = jobTitle;
    if (location !== undefined) data.location = location;
    if (relationshipType !== undefined) data.relationshipType = relationshipType;
    if (contactFrequency !== undefined) data.contactFrequency = contactFrequency;
    if (importance !== undefined) data.importance = importance;
    if (customFields !== undefined) data.customFields = customFields;

    await contactService.updateContact(userId, id, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Update contact error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update contact';
    res.status(500).json({ error: errorMessage });
  }
}

export async function getContactStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    
    const contact = await contactService.getContactById(userId, id);
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    const stats = await contactService.getContactStats(userId, id);
    if (!stats) {
      res.status(404).json({ error: 'Stats not found' });
      return;
    }

    res.json(stats);
  } catch (error) {
    console.error('Get contact stats error:', error);
    res.status(500).json({ error: 'Failed to fetch contact stats' });
  }
}
