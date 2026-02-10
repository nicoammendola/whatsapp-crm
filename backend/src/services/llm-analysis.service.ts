import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../config/database';
import { decrypt } from '../utils/encryption';
import { userSettingsService } from './user-settings.service';
import { messageService } from './message.service';

interface AnalysisAttributes {
  tone: string;
  warmth: number;
  responseSpeed: string;
  averageMessageLength: string;
  relationshipDepth: number;
  conversationBalance: number;
  engagementLevel: string;
  primaryTopics: string[];
  sharedInterests: string[];
}

interface SuggestedMessage {
  shouldSuggest: boolean;
  message: string | null;
  suggestedDate: string;
  suggestedTime: string;
  reasoning: string;
  confidence: number;
}

interface AnalysisResult {
  attributes: AnalysisAttributes;
  summary: string;
  suggestedMessage: SuggestedMessage;
}

class LLMAnalysisService {
  /**
   * Analyze a single contact's conversation
   */
  async analyzeContact(contactId: string, userId: string): Promise<{
    success: boolean;
    attributes: AnalysisAttributes;
    summary: string;
    suggestedMessage?: SuggestedMessage;
  }> {
    try {
      // 1. Load contact and verify it's not a group
      const contact = await prisma.contact.findUnique({
        where: { id: contactId, userId }
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      if (contact.isGroup) {
        throw new Error('Contact not found or is a group');
      }

      // 2. Load last 50 messages (most recent first, then reverse for chronological)
      const messages = await messageService.getMessagesForContact(userId, contactId, 50, 0);

      if (!messages || messages.length === 0) {
        throw new Error('No messages found for this contact');
      }

      // Reverse to get chronological order
      const chronologicalMessages = [...messages].reverse();

      // 3. Load user settings
      const encryptedKey = await userSettingsService.getEncryptedApiKey(userId);
      if (!encryptedKey) {
        throw new Error('Anthropic API key not configured');
      }

      const settings = await userSettingsService.getSettings(userId);

      // 4. Build prompt
      const prompt = this.buildAnalysisPrompt(contact, chronologicalMessages);

      // 5. Call Anthropic API
      const apiKey = decrypt(encryptedKey);
      const analysisResult = await this.callAnthropic(prompt, settings.anthropicModel, apiKey);

      // 6. Update contact with attributes
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          tone: analysisResult.attributes.tone,
          warmth: analysisResult.attributes.warmth,
          responseSpeed: analysisResult.attributes.responseSpeed,
          averageMessageLength: analysisResult.attributes.averageMessageLength,
          relationshipDepth: analysisResult.attributes.relationshipDepth,
          conversationBalance: analysisResult.attributes.conversationBalance,
          engagementLevel: analysisResult.attributes.engagementLevel,
          primaryTopics: analysisResult.attributes.primaryTopics,
          sharedInterests: analysisResult.attributes.sharedInterests,
          conversationSummary: analysisResult.summary,
          lastLlmAnalysis: new Date(),
          analysisVersion: '1.0'
        }
      });

      // 7. Create suggested message if recommended
      if (analysisResult.suggestedMessage.shouldSuggest && analysisResult.suggestedMessage.message) {
        await this.createSuggestedMessage(contactId, analysisResult.suggestedMessage);
      }

      return {
        success: true,
        attributes: analysisResult.attributes,
        summary: analysisResult.summary,
        suggestedMessage: analysisResult.suggestedMessage.shouldSuggest ? analysisResult.suggestedMessage : undefined
      };

    } catch (error: any) {
      console.error('LLM analysis error:', error);
      throw error;
    }
  }

  /**
   * Build analysis prompt for Anthropic
   */
  private buildAnalysisPrompt(contact: any, messages: any[]): string {
    // Calculate days since last message
    const lastMessage = messages[messages.length - 1];
    const daysSince = Math.floor(
      (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Contact display name
    const contactName = contact.name || contact.pushName || contact.phoneNumber || 'Unknown';

    // Format conversation history
    const conversationHistory = messages.map(msg => {
      const timestamp = new Date(msg.timestamp).toISOString().slice(0, 16).replace('T', ' ');
      const sender = msg.fromMe ? 'You' : contactName;
      const body = msg.body || '[media/non-text message]';
      return `[${timestamp}] ${sender}: ${body}`;
    }).join('\n');

    return `You are analyzing a WhatsApp conversation to understand communication patterns and relationship dynamics. BE CONCISE in your reasoning - use 1-2 sentences maximum.

**Contact Information:**
- Name: ${contactName}
- Contact Frequency Setting: ${contact.contactFrequency || 'not set'} (user's preference for contact cadence)
- Days Since Last Message: ${daysSince}

**Conversation History (last ${messages.length} messages):**
${conversationHistory}

**Your Task:**
Analyze this conversation and provide a JSON response. BE CONCISE - no verbose explanations.

Return ONLY valid JSON in this exact structure:
{
  "attributes": {
    "tone": "professional|casual|friendly|formal|playful",
    "warmth": 1-5,
    "responseSpeed": "instant|quick|moderate|slow|sporadic",
    "averageMessageLength": "brief|moderate|detailed|verbose",
    "relationshipDepth": 1-5,
    "conversationBalance": 1-5,
    "engagementLevel": "high|medium|low|declining",
    "primaryTopics": ["topic1", "topic2"],
    "sharedInterests": ["interest1", "interest2"]
  },
  "summary": "2-3 concise sentences about relationship and recent exchanges",
  "suggestedMessage": {
    "shouldSuggest": true|false,
    "message": "natural follow-up message matching conversation tone (or null)",
    "suggestedDate": "YYYY-MM-DD",
    "suggestedTime": "HH:mm",
    "reasoning": "1-2 sentences max - why this message/timing",
    "confidence": 0.85
  }
}

**Guidelines:**
- Consider contactFrequency setting when timing suggestions
- Don't suggest if conversation doesn't warrant one
- Match existing tone exactly
- Consider their response time patterns for timing
- Keep reasoning to 1-2 sentences - no fluff
- Confidence: 0.7+ for most cases, 0.85+ when very certain
- Return ONLY the JSON object, no additional text`;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    prompt: string,
    model: string,
    apiKey: string
  ): Promise<AnalysisResult> {
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const message = await anthropic.messages.create({
      model: model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract text from response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON (remove any markdown code blocks if present)
    const jsonText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return JSON.parse(jsonText);
  }

  /**
   * Create suggested scheduled message
   */
  private async createSuggestedMessage(
    contactId: string,
    suggestion: SuggestedMessage
  ): Promise<void> {
    if (!suggestion.message) return;

    // Combine date and time into timestamp
    const scheduledFor = new Date(`${suggestion.suggestedDate}T${suggestion.suggestedTime}:00`);

    await prisma.scheduledMessage.create({
      data: {
        contactId,
        messageText: suggestion.message,
        scheduledTime: scheduledFor,
        status: 'llmSuggested',
        llmReasoning: suggestion.reasoning,
        llmConfidence: suggestion.confidence
      }
    });
  }
}

export const llmAnalysisService = new LLMAnalysisService();
