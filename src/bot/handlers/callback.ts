import { AppConfig } from '../../config/env.js';
import { generateUserToken } from '../../crypto/token.js';
import { TelegramClient } from '../../telegram/client.js';
import { CallbackQuery } from '../../telegram/types.js';
import { buildDeepLink } from '../../telegram/formatting.js';
import { logger } from '../../utils/logger.js';
import {
  getWelcomeMessage,
  getHelpMessage,
  getPrivacyMessage
} from '../messages/persian.js';

export async function handleCallbackQuery(
  query: CallbackQuery,
  client: TelegramClient,
  config: AppConfig
): Promise<void> {
  const data = query.data || '';
  const userId = query.from.id;
  const chatId = query.message?.chat.id || userId;

  try {
    if (data.startsWith('copy_link:')) {
      const token = data.replace('copy_link:', '');
      const link = buildDeepLink(config.telegramBotUsername, token);

      await client.answerCallbackQuery(query.id, {
        text: `🔗 لینک اختصاصی شما:\n${link}\n\n(متن بالا را انتخاب و کپی کنید)`,
        show_alert: true
      });
      return;
    }

    if (data === 'refresh_link' || data === 'my_link') {
      await client.answerCallbackQuery(query.id);
      const userToken = generateUserToken(userId, 'direct', config.botSecret);
      const { text, replyMarkup } = getWelcomeMessage(config.telegramBotUsername, userToken);
      await client.sendMessage(chatId, text, {
        reply_markup: replyMarkup
      });
      return;
    }

    if (data === 'show_help') {
      await client.answerCallbackQuery(query.id);
      const { text, replyMarkup } = getHelpMessage();
      await client.sendMessage(chatId, text, {
        reply_markup: replyMarkup
      });
      return;
    }

    if (data === 'show_privacy') {
      await client.answerCallbackQuery(query.id);
      const { text, replyMarkup } = getPrivacyMessage();
      await client.sendMessage(chatId, text, {
        reply_markup: replyMarkup
      });
      return;
    }

    // Default response for unhandled callbacks
    await client.answerCallbackQuery(query.id);
  } catch (error) {
    logger.error('Error handling callback query', error);
  }
}
