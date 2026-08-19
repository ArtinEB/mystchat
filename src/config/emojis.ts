import fs from 'node:fs';
import path from 'node:path';

/**
 * All semantic names for emojis used throughout the bot UI.
 */
export type EmojiSemanticName =
  | 'SUCCESS'
  | 'ERROR'
  | 'WARNING'
  | 'INFO'
  | 'ANONYMOUS'
  | 'LINK'
  | 'MESSAGE'
  | 'INBOX'
  | 'COPY'
  | 'SHARE'
  | 'HELP'
  | 'LOCK'
  | 'REPLY'
  | 'SEND'
  | 'USER'
  | 'SHIELD'
  | 'QUESTION'
  | 'SPARKLES'
  | 'REFRESH'
  | 'BLOCK';

/**
 * Default Unicode fallbacks for each semantic emoji.
 */
export const DEFAULT_UNICODE_FALLBACKS: Record<EmojiSemanticName, string> = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  ANONYMOUS: '🎭',
  LINK: '🔗',
  MESSAGE: '✉️',
  INBOX: '💌',
  COPY: '📋',
  SHARE: '🚀',
  HELP: '📖',
  LOCK: '🔒',
  REPLY: '✍️',
  SEND: '📤',
  USER: '👤',
  SHIELD: '🛡️',
  QUESTION: '❓',
  SPARKLES: '✨',
  REFRESH: '🔄',
  BLOCK: '🚫'
};

/**
 * Registry of custom emoji IDs mapped to semantic names.
 */
const customEmojiRegistry: Map<EmojiSemanticName, string> = new Map();
let isInitialized = false;

/**
 * Parses CUSTOM_EMOJIS.txt or environment variables to populate the custom emoji registry.
 */
export function initCustomEmojis(): void {
  if (isInitialized) return;

  // 1. Try reading from CUSTOM_EMOJIS.txt in project root
  try {
    const configPath = path.resolve(process.cwd(), 'CUSTOM_EMOJIS.txt');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      parseCustomEmojisText(content);
    }
  } catch {
    // If running in restricted serverless environment without fs, ignore and proceed to env vars
  }

  // 2. Override / supplement with environment variables (e.g. EMOJI_SUCCESS or CUSTOM_EMOJI_SUCCESS)
  for (const name of Object.keys(DEFAULT_UNICODE_FALLBACKS) as EmojiSemanticName[]) {
    const envVal =
      process.env[`EMOJI_${name}`] ||
      process.env[`CUSTOM_EMOJI_${name}`] ||
      process.env[name];

    if (envVal && isValidEmojiId(envVal)) {
      customEmojiRegistry.set(name, envVal.trim());
    }
  }

  isInitialized = true;
}

/**
 * Helper to parse lines formatted as `KEY = <ID>` or `KEY = 123456789`
 */
function parseCustomEmojisText(text: string): void {
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (match) {
      const semanticName = match[1].trim() as EmojiSemanticName;
      const rawValue = match[2].trim();

      if (
        Object.prototype.hasOwnProperty.call(DEFAULT_UNICODE_FALLBACKS, semanticName) &&
        isValidEmojiId(rawValue)
      ) {
        customEmojiRegistry.set(semanticName, rawValue);
      }
    }
  }
}

/**
 * Check if the provided value is a real Telegram Custom Emoji ID (digits only)
 */
function isValidEmojiId(id: string): boolean {
  if (!id) return false;
  if (id.includes('<') || id.includes('CUSTOM_EMOJI_ID')) return false;
  return /^\d{15,25}$/.test(id.trim());
}

/**
 * Returns the Telegram Custom Emoji ID for a semantic name if configured.
 */
export function getCustomEmojiId(name: EmojiSemanticName): string | undefined {
  if (!isInitialized) initCustomEmojis();
  return customEmojiRegistry.get(name);
}

/**
 * Returns the Unicode fallback emoji for a semantic name.
 */
export function getFallbackEmoji(name: EmojiSemanticName): string {
  return DEFAULT_UNICODE_FALLBACKS[name] || '▫️';
}

/**
 * Renders an emoji tag for Telegram HTML parse_mode:
 * - If a custom emoji ID is configured: `<tg-emoji emoji-id="123456">Fallback</tg-emoji>`
 * - Otherwise: Fallback Unicode emoji
 */
export function emoji(name: EmojiSemanticName): string {
  if (!isInitialized) initCustomEmojis();

  const id = customEmojiRegistry.get(name);
  const fallback = getFallbackEmoji(name);

  if (id) {
    return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
  }

  return fallback;
}
