import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_UNICODE_FALLBACKS,
  EmojiSemanticName,
  emoji,
  getFallbackEmoji,
  initCustomEmojis
} from '../src/config/emojis.js';

describe('Custom Telegram Emoji Configuration System', () => {
  test('CUSTOM_EMOJIS.txt file exists and documents all semantic emojis', () => {
    const configPath = path.resolve(process.cwd(), 'CUSTOM_EMOJIS.txt');
    assert.ok(fs.existsSync(configPath), 'CUSTOM_EMOJIS.txt must exist in project root');

    const content = fs.readFileSync(configPath, 'utf-8');
    const semanticNames = Object.keys(DEFAULT_UNICODE_FALLBACKS) as EmojiSemanticName[];

    for (const name of semanticNames) {
      assert.ok(
        content.includes(`${name} =`),
        `CUSTOM_EMOJIS.txt must document the semantic emoji name: ${name}`
      );
      assert.ok(
        content.includes(`Use case:`),
        `CUSTOM_EMOJIS.txt must document the use case for each emoji`
      );
    }
  });

  test('falls back to default Unicode emojis when custom IDs are not configured', () => {
    initCustomEmojis();

    assert.equal(emoji('SUCCESS'), DEFAULT_UNICODE_FALLBACKS.SUCCESS);
    assert.equal(emoji('ERROR'), DEFAULT_UNICODE_FALLBACKS.ERROR);
    assert.equal(emoji('LOCK'), DEFAULT_UNICODE_FALLBACKS.LOCK);
    assert.equal(emoji('LINK'), DEFAULT_UNICODE_FALLBACKS.LINK);
    assert.equal(emoji('ANONYMOUS'), DEFAULT_UNICODE_FALLBACKS.ANONYMOUS);
  });

  test('getFallbackEmoji returns valid unicode emoji for any semantic name', () => {
    const semanticNames = Object.keys(DEFAULT_UNICODE_FALLBACKS) as EmojiSemanticName[];
    for (const name of semanticNames) {
      const fallback = getFallbackEmoji(name);
      assert.ok(fallback && fallback.length > 0, `Fallback for ${name} must not be empty`);
    }
  });
});
