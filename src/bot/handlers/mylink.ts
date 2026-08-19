import { AppConfig } from '../../config/env.js';
import { generateUserToken } from '../../crypto/token.js';
import { TelegramClient } from '../../telegram/client.js';
import { TelegramMessage } from '../../telegram/types.js';
import { logger } from '../../utils/logger.js';
import { getWelcomeMessage } from '../messages/persian.js';

export async function handleMyLinkCommand(
  message: TelegramMessage,
  client: TelegramClient,
  config: AppConfig
): Promise<void> {
  const sender = message.from;
  const chatId = message.chat.id;

  if (!sender) {
    logger.warn('Received /link without sender information');
    return;
  }

  const userToken = generateUserToken(sender.id, 'direct', config.botSecret);
  const { text, replyMarkup } = getWelcomeMessage(config.telegramBotUsername, userToken);

  await client.sendMessage(chatId, text, {
    reply_markup: replyMarkup
  });
}
