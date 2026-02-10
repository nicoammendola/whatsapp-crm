import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { reminderService } from '../services/reminder.service';

function getContactId(req: AuthRequest): string {
  const id = req.params.id;
  return typeof id === 'string' ? id : id[0];
}

function getReminderId(req: AuthRequest): string {
  const id = req.params.reminderId;
  return typeof id === 'string' ? id : id[0];
}

export async function getReminders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = getContactId(req);
    const list = await reminderService.listByContact(userId, contactId);
    if (list === null) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json({ reminders: list });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
}

export async function createReminder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = getContactId(req);
    const { dueDate, notes } = req.body;
    if (!dueDate) {
      res.status(400).json({ error: 'dueDate is required' });
      return;
    }
    const created = await reminderService.create(userId, contactId, {
      dueDate: new Date(dueDate),
      notes: notes ?? null,
    });
    if (created === null) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.status(201).json({ reminder: created });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
}

export async function updateReminder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = getContactId(req);
    const reminderId = getReminderId(req);
    const { dueDate, notes } = req.body;
    const data: { dueDate?: Date; notes?: string | null } = {};
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    if (notes !== undefined) data.notes = notes;
    const updated = await reminderService.update(userId, contactId, reminderId, data);
    if (updated === null) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }
    res.json({ reminder: updated });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
}

export async function deleteReminder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = getContactId(req);
    const reminderId = getReminderId(req);
    const result = await reminderService.delete(userId, contactId, reminderId);
    if (result === null) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
}
