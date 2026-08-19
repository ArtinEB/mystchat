import { MessageEntity } from './types.js';

/**
 * Escapes characters that have special meaning in Telegram HTML parse mode:
 * &, <, >, "
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Calculates UTF-16 code units length of a string.
 * Telegram Bot API requires entity offset and length to be in UTF-16 code units.
 * In JavaScript, string.length is natively the UTF-16 code unit count.
 */
export function getUtf16Length(str: string): number {
  return str.length;
}

/**
 * Constructs a custom_emoji MessageEntity for manual entity construction.
 */
export function createCustomEmojiEntity(
  offset: number,
  length: number,
  customEmojiId: string
): MessageEntity {
  return {
    type: 'custom_emoji',
    offset,
    length,
    custom_emoji_id: customEmojiId
  };
}

/**
 * Builds Telegram deep-link URL: https://t.me/BotUsername?start=TOKEN
 */
export function buildDeepLink(botUsername: string, token: string): string {
  const cleanUsername = botUsername.replace(/^@/, '');
  return `https://t.me/${cleanUsername}?start=${token}`;
}

/**
 * Builds Telegram share link: https://t.me/share/url?url=...&text=...
 */
export function buildShareLink(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
