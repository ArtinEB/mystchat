import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminUser } from '../src/bot/handlers/admin.js';
import { UserStore } from '../src/storage/userStore.js';
import { getAdminPanelMessage, getBroadcastSummaryMessage } from '../src/bot/messages/persian.js';
import { AppConfig } from '../src/config/env.js';
import { initCustomEmojis } from '../src/config/emojis.js';

describe('Admin & Broadcast System', () => {
  const mockConfig: AppConfig = {
    telegramBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    telegramBotUsername: 'MystChatBot',
    botSecret: 'super-secret-key-32-characters-long!',
    adminUserIds: [12345678, 87654321]
  };

  test('isAdminUser correctly verifies admin IDs', () => {
    assert.equal(isAdminUser(12345678, mockConfig), true);
    assert.equal(isAdminUser(87654321, mockConfig), true);
    assert.equal(isAdminUser(99999999, mockConfig), false);
  });

  test('UserStore tracks users and computes statistics', async () => {
    const store = UserStore.getInstance();

    await store.trackUser(111222333);
    await store.trackUser(444555666);
    await store.trackUser(111222333); // Duplicate should not increase count
    await store.recordMessageSent();

    const userIds = await store.getAllUserIds();
    assert.ok(userIds.includes(111222333));
    assert.ok(userIds.includes(444555666));

    const stats = await store.getStats();
    assert.ok(stats.totalUsers >= 2);
    assert.ok(stats.totalMessagesSent >= 1);
  });

  test('generates admin panel message with statistics', () => {
    initCustomEmojis();

    const { text, replyMarkup } = getAdminPanelMessage({
      totalUsers: 150,
      totalMessagesSent: 420,
      uptimeSeconds: 3665
    });

    assert.ok(text.includes('پنل مدیریت ربات MystChat'));
    assert.ok(text.includes('150 کاربر'));
    assert.ok(text.includes('420 پیام'));
    assert.ok(text.includes('1 ساعت'));
    assert.ok(replyMarkup.inline_keyboard.length > 0);
  });

  test('generates broadcast summary message correctly', () => {
    initCustomEmojis();

    const summary = getBroadcastSummaryMessage(100, 92, 5, 3);
    assert.ok(summary.includes('گزارش ارسال همگانی'));
    assert.ok(summary.includes('100'));
    assert.ok(summary.includes('92'));
    assert.ok(summary.includes('5'));
    assert.ok(summary.includes('3'));
  });

  test('admin messages have no duplicate emojis', () => {
    initCustomEmojis();

    const adminPanel = getAdminPanelMessage({
      totalUsers: 10,
      totalMessagesSent: 20,
      uptimeSeconds: 60
    });

    const emojiIds: string[] = [];
    const matches = adminPanel.text.matchAll(/<tg-emoji emoji-id="(\d+)">/g);
    for (const match of matches) {
      emojiIds.push(match[1]);
    }
    for (const row of adminPanel.replyMarkup.inline_keyboard) {
      for (const btn of row) {
        if (btn.icon_custom_emoji_id) {
          emojiIds.push(btn.icon_custom_emoji_id);
        }
      }
    }

    const uniqueEmojiIds = new Set(emojiIds);
    assert.equal(
      emojiIds.length,
      uniqueEmojiIds.size,
      `Admin panel contains duplicated emojis: [${emojiIds.join(', ')}]`
    );
  });
});
