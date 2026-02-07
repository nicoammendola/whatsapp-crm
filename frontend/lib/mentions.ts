/**
 * Utility functions for handling WhatsApp mentions in messages
 */

export interface MentionInfo {
  jid: string;
  name: string | null;
  pushName: string | null;
}

/**
 * Extract the number part from a WhatsApp JID
 * e.g., "110445201506472@lid" -> "110445201506472"
 */
export function extractNumberFromJid(jid: string): string {
  return jid.split('@')[0];
}

/**
 * Get display name for a mention (name > pushName > fallback to number)
 */
export function getMentionDisplayName(mention: MentionInfo): string {
  if (mention.name) return mention.name;
  if (mention.pushName) return mention.pushName;
  return extractNumberFromJid(mention.jid);
}

/**
 * Parse message body and identify mention positions
 * Returns segments that can be rendered with different styles
 */
export function parseMessageWithMentions(
  body: string,
  mentions: MentionInfo[]
): Array<{ text: string; isMention: boolean; mention?: MentionInfo }> {
  if (!mentions || mentions.length === 0) {
    return [{ text: body, isMention: false }];
  }

  // Create a map of number -> mention info for quick lookup
  const numberToMention = new Map<string, MentionInfo>();
  mentions.forEach(mention => {
    const number = extractNumberFromJid(mention.jid);
    numberToMention.set(number, mention);
  });

  // Regex to find @mentions in the text (@ followed by digits)
  const mentionRegex = /@(\d+)/g;
  const segments: Array<{ text: string; isMention: boolean; mention?: MentionInfo }> = [];
  
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(body)) !== null) {
    const mentionNumber = match[1];
    const matchIndex = match.index;

    // Add text before mention
    if (matchIndex > lastIndex) {
      segments.push({
        text: body.substring(lastIndex, matchIndex),
        isMention: false,
      });
    }

    // Add mention segment with display name
    const mentionInfo = numberToMention.get(mentionNumber);
    if (mentionInfo) {
      segments.push({
        text: `@${getMentionDisplayName(mentionInfo)}`,
        isMention: true,
        mention: mentionInfo,
      });
    } else {
      // Fallback to showing the number if we don't have contact info
      segments.push({
        text: match[0],
        isMention: true,
      });
    }

    lastIndex = matchIndex + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < body.length) {
    segments.push({
      text: body.substring(lastIndex),
      isMention: false,
    });
  }

  return segments;
}
