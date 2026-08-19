import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractTokenFromMessage } from '../src/bot/handlers/message.js';
import { TelegramMessage } from '../src/telegram/types.js';
import {
  getWelcomeMessage,
  getPromptSenderMessage,
  getRecipientDeliveryHeader,
  getSelfLinkMessage,
  getRecipientDeliveryMarkup,
  getSenderSuccessMessage,
  getNoReplyGuidanceMessage,
  getHelpMessage,
  getPrivacyMessage
} from '../src/bot/messages/persian.js';
import { initCustomEmojis } from '../src/config/emojis.js';

describe('Handler & Message Utilities', () => {
  const sampleToken = 'c2FtcGxlX3Rva2VuX3dpdGhfNTBfY2hhcnNfZm9yX3Rlc3Rpbmc';

  test('extracts token from HTML text_link entity', () => {
    const message: TelegramMessage = {
      message_id: 1,
      date: 123456789,
      chat: { id: 100, type: 'private' },
      text: 'در حال ارسال پیام مخفی...',
      entities: [
        {
          type: 'text_link',
          offset: 0,
          length: 5,
          url: `https://t.me/TestBot?start=${sampleToken}`
        }
      ]
    };

    const extracted = extractTokenFromMessage(message);
    assert.equal(extracted, sampleToken);
  });

  test('extracts token from plain text start command or link', () => {
    const message: TelegramMessage = {
      message_id: 2,
      date: 123456789,
      chat: { id: 100, type: 'private' },
      text: `/start ${sampleToken}`
    };

    const extracted = extractTokenFromMessage(message);
    assert.equal(extracted, sampleToken);
  });

  test('generates welcome message in Persian with personal link', () => {
    const { text, replyMarkup } = getWelcomeMessage('TestBot', sampleToken);

    assert.ok(text.includes('به ربات پیام ناشناس و مخفی خوش آمدید!'));
    assert.ok(text.includes('https://t.me/TestBot?start=' + sampleToken));
    assert.ok(replyMarkup.inline_keyboard.length > 0);
  });

  test('generates prompt message for sender with embedded zero-width anchor link', () => {
    const { text, forceReplyPlaceholder } = getPromptSenderMessage('TestBot', sampleToken);

    assert.ok(text.includes('در حال ارسال پیام مخفی و ناشناس'));
    assert.ok(text.includes(`href="https://t.me/TestBot?start=${sampleToken}"`));
    assert.equal(forceReplyPlaceholder, 'پیام مخفی خود را اینجا بنویسید...');
  });

  test('generates recipient delivery header in Persian', () => {
    const header = getRecipientDeliveryHeader();
    assert.ok(header.includes('یک پیام مخفی جدید داری!'));
    assert.ok(header.includes('بدون افشای هویت فرستنده'));
  });
  test('all inline keyboard button labels contain plain text emojis without HTML tags', () => {
    initCustomEmojis();

    const markups = [
      getWelcomeMessage('TestBot', sampleToken).replyMarkup,
      getSelfLinkMessage('TestBot', sampleToken).replyMarkup,
      getRecipientDeliveryMarkup('TestBot', sampleToken),
      getRecipientDeliveryMarkup('TestBot'),
      getSenderSuccessMessage('TestBot', sampleToken).replyMarkup!,
      getNoReplyGuidanceMessage('TestBot', sampleToken).replyMarkup,
      getHelpMessage().replyMarkup,
      getPrivacyMessage().replyMarkup
    ];

    for (const markup of markups) {
      assert.ok(markup, 'Markup must exist');
      for (const row of markup.inline_keyboard) {
        for (const btn of row) {
          assert.ok(btn.text, 'Button text must not be empty');
          assert.ok(
            !btn.text.includes('<tg-emoji') && !btn.text.includes('</tg-emoji>'),
            `Button text "${btn.text}" must not contain <tg-emoji> tags`
          );
          assert.ok(
            !btn.text.includes('<') && !btn.text.includes('>'),
            `Button text "${btn.text}" must not contain HTML brackets`
          );
        }
      }
    }
  });
});
