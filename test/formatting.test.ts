import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  getUtf16Length,
  buildDeepLink,
  buildShareLink,
  createCustomEmojiEntity
} from '../src/telegram/formatting.js';

describe('Telegram Formatting & Entity Utilities', () => {
  test('correctly escapes HTML special characters', () => {
    const raw = 'Hello <World> & "Friends"';
    const escaped = escapeHtml(raw);
    assert.equal(escaped, 'Hello &lt;World&gt; &amp; &quot;Friends&quot;');
  });

  test('UTF-16 code units length matches Persian and Unicode characters', () => {
    const persianText = 'سلام دنیا';
    assert.equal(getUtf16Length(persianText), 9);

    const textWithEmoji = 'پیام 🎭';
    // Persian word (4 chars) + space (1 char) + surrogate emoji (2 code units) = 7
    assert.equal(getUtf16Length(textWithEmoji), 7);
  });

  test('creates correct custom_emoji entity structure', () => {
    const entity = createCustomEmojiEntity(5, 2, '5368324170671202286');
    assert.deepEqual(entity, {
      type: 'custom_emoji',
      offset: 5,
      length: 2,
      custom_emoji_id: '5368324170671202286'
    });
  });

  test('builds deep link correctly with and without @ symbol in username', () => {
    assert.equal(
      buildDeepLink('@MyHiddenBot', 'sample_token_123'),
      'https://t.me/MyHiddenBot?start=sample_token_123'
    );
    assert.equal(
      buildDeepLink('MyHiddenBot', 'sample_token_123'),
      'https://t.me/MyHiddenBot?start=sample_token_123'
    );
  });

  test('builds valid share link with encoded components', () => {
    const link = 'https://t.me/MyBot?start=token';
    const text = 'ارسال پیام ناشناس';
    const shareUrl = buildShareLink(link, text);

    assert.ok(shareUrl.startsWith('https://t.me/share/url?'));
    assert.ok(shareUrl.includes('url=https%3A%2F%2Ft.me%2FMyBot%3Fstart%3Dtoken'));
  });
});
