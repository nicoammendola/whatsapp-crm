import { prisma } from '../config/database';
import { encrypt } from '../utils/encryption';

const VALID_MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-5-20251101',
  'claude-haiku-4-5-20251001'
];

export class UserSettingsService {
  /**
   * Get user settings by userId
   */
  async getSettings(userId: string) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: {
        anthropicModel: true,
        anthropicApiKeyEncrypted: true,
      }
    });

    return {
      anthropicModel: settings?.anthropicModel || 'claude-sonnet-4-5-20250929',
      hasApiKey: !!settings?.anthropicApiKeyEncrypted
    };
  }

  /**
   * Get encrypted API key (for internal use only)
   */
  async getEncryptedApiKey(userId: string): Promise<string | null> {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { anthropicApiKeyEncrypted: true }
    });

    return settings?.anthropicApiKeyEncrypted || null;
  }

  /**
   * Upsert user settings
   */
  async upsertSettings(
    userId: string,
    data: {
      anthropicApiKey?: string;
      anthropicModel?: string;
    }
  ) {
    // Validate model if provided
    if (data.anthropicModel && !VALID_MODELS.includes(data.anthropicModel)) {
      throw new Error('Invalid model selection');
    }

    // Build update data
    const updateData: {
      anthropicApiKeyEncrypted?: string;
      anthropicModel?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date()
    };

    // Encrypt API key if provided
    if (data.anthropicApiKey) {
      updateData.anthropicApiKeyEncrypted = encrypt(data.anthropicApiKey);
    }

    if (data.anthropicModel) {
      updateData.anthropicModel = data.anthropicModel;
    }

    // Upsert (create or update)
    await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...updateData
      },
      update: updateData
    });

    return { success: true };
  }
}

export const userSettingsService = new UserSettingsService();
