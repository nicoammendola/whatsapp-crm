import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { userSettingsService } from '../services/user-settings.service';
import { decrypt } from '../utils/encryption';
import Anthropic from '@anthropic-ai/sdk';

/**
 * GET /api/settings
 * Get user settings (without exposing raw API key)
 */
export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const settings = await userSettingsService.getSettings(userId);
    
    res.json(settings);
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

/**
 * PUT /api/settings
 * Update user settings
 */
export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;
    const { anthropic_api_key, anthropic_model } = req.body;

    await userSettingsService.upsertSettings(userId, {
      anthropicApiKey: anthropic_api_key,
      anthropicModel: anthropic_model
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Update settings error:', error);
    
    if (error.message === 'Invalid model selection') {
      res.status(400).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

/**
 * POST /api/settings/test-anthropic
 * Test Anthropic API key validity
 */
export async function testAnthropicKey(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    // Fetch encrypted API key
    const encryptedKey = await userSettingsService.getEncryptedApiKey(userId);

    if (!encryptedKey) {
      res.json({
        valid: false,
        error: 'No API key configured'
      });
      return;
    }

    // Decrypt and test
    const apiKey = decrypt(encryptedKey);

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // Simple test call
    await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 10,
      messages: [
        { role: 'user', content: 'Say "OK"' }
      ]
    });

    res.json({ valid: true });

  } catch (error: any) {
    console.error('API key test error:', error);

    if (error.status === 401) {
      res.json({
        valid: false,
        error: 'Invalid API key'
      });
      return;
    }

    res.json({
      valid: false,
      error: 'Connection test failed'
    });
  }
}
