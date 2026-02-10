import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { llmAnalysisService } from '../services/llm-analysis.service';

/**
 * POST /api/analysis/:contactId
 * Analyze a contact's conversation using LLM
 */
export async function analyzeContact(req: AuthRequest, res: Response): Promise<void> {
  try {
    const contactId = typeof req.params.contactId === 'string' 
      ? req.params.contactId 
      : req.params.contactId[0];
    const userId = req.userId!;

    const result = await llmAnalysisService.analyzeContact(contactId, userId);

    res.json(result);

  } catch (error: any) {
    console.error('Analysis API error:', error);

    // Specific error messages
    if (error.message.includes('not found') || error.message.includes('group')) {
      res.status(404).json({
        success: false,
        error: 'Contact not found or is a group chat'
      });
      return;
    }

    if (error.message.includes('No messages')) {
      res.status(400).json({
        success: false,
        error: 'No messages found for this contact'
      });
      return;
    }

    if (error.message.includes('API key')) {
      res.status(400).json({
        success: false,
        error: 'Anthropic API key not configured. Please update your settings.'
      });
      return;
    }

    if (error.status === 401) {
      res.status(401).json({
        success: false,
        error: 'Invalid Anthropic API key. Please check your settings.'
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Analysis failed. Please try again.'
    });
  }
}
