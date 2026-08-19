import { AppConfig } from '../../config/env.js';
import { TelegramClient, TelegramApiError } from '../../telegram/client.js';
import { TelegramMessage, CallbackQuery } from '../../telegram/types.js';
import { UserStore } from '../../storage/userStore.js';
import { getAdminPanelMessage, getBroadcastSummaryMessage } from '../messages/persian.js';
import { logger } from '../../utils/logger.js';

/**
 * Checks if a user ID belongs to the configured administrators.
 */
export function isAdminUser(userId: number, config: AppConfig): boolean {
  return config.adminUserIds.includes(userId);
}

/**
 * Handles the /admin command to show statistics and admin controls.
 */
export async function handleAdminCommand(
  message: TelegramMessage,
  client: TelegramClient,
  config: AppConfig
): Promise<void> {
  const sender = message.from;
  if (!sender || !isAdminUser(sender.id, config)) {
    return;
  }

  const userStore = UserStore.getInstance();
  const stats = await userStore.getStats();
  const { text, replyMarkup } = getAdminPanelMessage(stats);

  await client.sendMessage(message.chat.id, text, {
    reply_markup: replyMarkup
  });
}

/**
 * Handles /broadcast or /sendtoall commands to broadcast messages to all registered users.
 */
export async function handleBroadcastCommand(
  message: TelegramMessage,
  client: TelegramClient,
  config: AppConfig
): Promise<void> {
  const sender = message.from;
  const chatId = message.chat.id;

  if (!sender || !isAdminUser(sender.id, config)) {
    return;
  }

  const userStore = UserStore.getInstance();
  const userIds = await userStore.getAllUserIds();

  if (userIds.length === 0) {
    await client.sendMessage(
      chatId,
      '⚠️ هنوز کاربری در دیتابیس ربات ثبت نشده است.'
    );
    return;
  }

  const replyTo = message.reply_to_message;
  let broadcastText = '';

  if (!replyTo) {
    const rawText = message.text || message.caption || '';
    broadcastText = rawText.replace(/^\/(broadcast|sendtoall)\s*/i, '').trim();

    if (!broadcastText) {
      await client.sendMessage(
        chatId,
        '⚠️ لطفاً متن پیام مورد نظر را جلوی دستور بنویسید:\n<code>/broadcast سلام به همه کاربران</code>\nیا به یک پیام (عکس، ویدیو، وویس و ...) ریپلای کنید.'
      );
      return;
    }
  }

  const progressMsg = await client.sendMessage(
    chatId,
    `⏳ در حال ارسال همگانی به <b>${userIds.length}</b> کاربر...`
  );

  let successCount = 0;
  let blockedCount = 0;
  let failCount = 0;

  for (let i = 0; i < userIds.length; i++) {
    const targetUserId = userIds[i];

    try {
      if (replyTo) {
        // Copy the replied message with exact media and caption
        await client.copyMessage(targetUserId, chatId, replyTo.message_id);
      } else {
        await client.sendMessage(targetUserId, broadcastText);
      }
      successCount++;
    } catch (error) {
      if (error instanceof TelegramApiError && error.isBlocked) {
        blockedCount++;
      } else {
        failCount++;
        logger.warn(`Broadcast failed for user ${targetUserId}`, { error });
      }
    }

    // Rate limiting: 35ms sleep between sends (approx 28 messages per second)
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  const summary = getBroadcastSummaryMessage(
    userIds.length,
    successCount,
    blockedCount,
    failCount
  );

  await client.sendMessage(chatId, summary, {
    reply_to_message_id: progressMsg.message_id
  });
}

/**
 * Handles admin callback queries (e.g. refreshing stats).
 */
export async function handleAdminCallbackQuery(
  callbackQuery: CallbackQuery,
  client: TelegramClient,
  config: AppConfig
): Promise<void> {
  const sender = callbackQuery.from;
  if (!sender || !isAdminUser(sender.id, config)) {
    await client.answerCallbackQuery(callbackQuery.id, {
      text: 'شما دسترسی ادمین ندارید.',
      show_alert: true
    });
    return;
  }

  const data = callbackQuery.data || '';

  if (data === 'admin_refresh_stats') {
    const userStore = UserStore.getInstance();
    const stats = await userStore.getStats();
    const { text, replyMarkup } = getAdminPanelMessage(stats);

    if (callbackQuery.message) {
      await client.sendMessage(callbackQuery.message.chat.id, text, {
        reply_markup: replyMarkup
      });
    }

    await client.answerCallbackQuery(callbackQuery.id, {
      text: 'آمار با موفقیت بروزرسانی شد.'
    });
  }
}
