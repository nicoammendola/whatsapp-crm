import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { scheduledMessageService } from '../services/scheduled-message.service';

function getContactIdParam(req: AuthRequest): string {
  const id = req.params.contactId;
  return typeof id === 'string' ? id : id[0];
}

function getIdParam(req: AuthRequest): string {
  const id = req.params.id;
  return typeof id === 'string' ? id : id[0];
}

export async function createScheduledMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = req.body.contactId;
    if (!contactId || typeof contactId !== 'string') {
      res.status(400).json({ error: 'contactId is required' });
      return;
    }
    const { messageText, scheduledTime } = req.body;
    if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
      res.status(400).json({ error: 'messageText is required' });
      return;
    }
    if (!scheduledTime) {
      res.status(400).json({ error: 'scheduledTime is required (ISO string)' });
      return;
    }
    const at = new Date(scheduledTime);
    if (isNaN(at.getTime())) {
      res.status(400).json({ error: 'Invalid scheduledTime' });
      return;
    }
    const created = await scheduledMessageService.create(userId, contactId, {
      messageText: messageText.trim(),
      scheduledTime: at,
    });
    if (created === null) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.status(201).json({ scheduledMessage: created });
  } catch (error: any) {
    console.error('Create scheduled message error:', error);
    res.status(400).json({ error: error.message || 'Failed to create scheduled message' });
  }
}

export async function getScheduledMessagesByContact(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const contactId = getContactIdParam(req);
    const list = await scheduledMessageService.getByContact(userId, contactId);
    if (list === null) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json({ scheduledMessages: list });
  } catch (error) {
    console.error('Get scheduled messages error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled messages' });
  }
}

export async function updateScheduledMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = getIdParam(req);
    const { messageText, scheduledTime } = req.body;
    const data: { messageText?: string; scheduledTime?: Date } = {};
    if (messageText !== undefined) {
      if (typeof messageText !== 'string' || !messageText.trim()) {
        res.status(400).json({ error: 'messageText must be a non-empty string' });
        return;
      }
      data.messageText = messageText.trim();
    }
    if (scheduledTime !== undefined) {
      const at = new Date(scheduledTime);
      if (isNaN(at.getTime())) {
        res.status(400).json({ error: 'Invalid scheduledTime' });
        return;
      }
      data.scheduledTime = at;
    }
    const updated = await scheduledMessageService.update(userId, id, data);
    if (updated === null) {
      res.status(404).json({ error: 'Scheduled message not found' });
      return;
    }
    res.json({ scheduledMessage: updated });
  } catch (error: any) {
    console.error('Update scheduled message error:', error);
    res.status(400).json({ error: error.message || 'Failed to update scheduled message' });
  }
}

export async function deleteScheduledMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = getIdParam(req);
    const result = await scheduledMessageService.cancel(userId, id);
    if (result === null) {
      res.status(404).json({ error: 'Scheduled message not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete scheduled message error:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel scheduled message' });
  }
}

export async function approveScheduledMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = getIdParam(req);
    const result = await scheduledMessageService.approve(userId, id);
    if (result === null) {
      res.status(404).json({ error: 'Scheduled message not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Approve scheduled message error:', error);
    res.status(400).json({ error: error.message || 'Failed to approve scheduled message' });
  }
}

export async function rejectScheduledMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const id = getIdParam(req);
    const result = await scheduledMessageService.reject(userId, id);
    if (result === null) {
      res.status(404).json({ error: 'Scheduled message not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Reject scheduled message error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject scheduled message' });
  }
}
