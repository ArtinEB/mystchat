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
  getPrivacyMessage,
  getInvalidTokenMessage,
  getRecipientBlockedMessage,
  getGenericErrorMessage
} from '../src/bot/messages/persian.js';
import { initCustomEmojis } from '../src/config/emojis.js';

describe('Handler & Message Utilities', () => {
  const sampleToken = 'sampleToken_123';

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

    assert.ok(text.includes('به ربات پیام ناشناس MystChat خوش آمدید!'));
    assert.ok(text.includes('https://t.me/TestBot?start=' + sampleToken));
    assert.ok(replyMarkup.inline_keyboard.length > 0);
  });

  test('generates prompt message for sender with embedded zero-width anchor link', () => {
    const { text, forceReplyPlaceholder } = getPromptSenderMessage('TestBot', sampleToken);

    assert.ok(text.includes('در حال ارسال پیام مخفی و ناشناس'));
    assert.ok(text.includes(`href="https://t.me/TestBot?start=${sampleToken}"`));
    assert.equal(forceReplyPlaceholder, 'پیام خود را بنویسید...');
  });

  test('generates recipient delivery header in Persian', () => {
    const header = getRecipientDeliveryHeader();
    assert.ok(header.includes('یک پیام جدید داری!'));
  });
  test('inline keyboard buttons have icon_custom_emoji_id set and no HTML in text', () => {
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
          assert.ok(
            btn.icon_custom_emoji_id && btn.icon_custom_emoji_id.length > 0,
            `Button "${btn.text}" should have icon_custom_emoji_id set when custom emojis are initialized`
          );
        }
      }
    }
  });

  test('no single message or its buttons repeat the same emoji twice', () => {
    initCustomEmojis();

    const messages = [
      getWelcomeMessage('TestBot', sampleToken),
      getSelfLinkMessage('TestBot', sampleToken),
      {
        text: getRecipientDeliveryHeader(),
        replyMarkup: getRecipientDeliveryMarkup('TestBot', sampleToken)
      },
      getSenderSuccessMessage('TestBot', sampleToken),
      { text: getPromptSenderMessage('TestBot', sampleToken).text, replyMarkup: undefined },
      { text: getInvalidTokenMessage(), replyMarkup: undefined },
      { text: getRecipientBlockedMessage(), replyMarkup: undefined },
      getNoReplyGuidanceMessage('TestBot', sampleToken),
      getHelpMessage(),
      getPrivacyMessage(),
      { text: getGenericErrorMessage(), replyMarkup: undefined }
    ];

    for (const msg of messages) {
      const emojiIds: string[] = [];

      // Extract from message text:
      const matches = msg.text.matchAll(/<tg-emoji emoji-id="(\d+)">/g);
      for (const match of matches) {
        emojiIds.push(match[1]);
      }

      // Extract from buttons if present:
      if (msg.replyMarkup) {
        for (const row of msg.replyMarkup.inline_keyboard) {
          for (const btn of row) {
            if (btn.icon_custom_emoji_id) {
              emojiIds.push(btn.icon_custom_emoji_id);
            }
          }
        }
      }

      const uniqueEmojiIds = new Set(emojiIds);
      assert.equal(
        emojiIds.length,
        uniqueEmojiIds.size,
        `Message contains duplicated emojis: [${emojiIds.join(', ')}] in:\n${msg.text}`
      );
    }
  });
});
