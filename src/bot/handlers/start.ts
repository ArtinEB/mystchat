import { AppConfig } from '../../config/env.js';
import { generateUserToken, decodeUserToken, TokenError } from '../../crypto/token.js';
import { TelegramClient } from '../../telegram/client.js';
import { TelegramMessage } from '../../telegram/types.js';
import { logger } from '../../utils/logger.js';
import {
  getWelcomeMessage,
  getSelfLinkMessage,
  getPromptSenderMessage,
  getInvalidTokenMessage
} from '../messages/persian.js';

export async function handleStartCommand(
  message: TelegramMessage,
  tokenParam: string | undefined,
  client: TelegramClient,
  config: AppConfig
): Promise<void> {
  const sender = message.from;
  const chatId = message.chat.id;

  if (!sender) {
    logger.warn('Received /start without sender information');
    return;
  }

  // 1. If no token is attached, display the user's personal link
  if (!tokenParam || !tokenParam.trim()) {
    const userToken = generateUserToken(sender.id, 'direct', config.botSecret);
    const { text, replyMarkup } = getWelcomeMessage(config.telegramBotUsername, userToken);

    await client.sendMessage(chatId, text, {
      reply_markup: replyMarkup
    });
    return;
  }

  // 2. Token is present -> user clicked someone's deep link
  const token = tokenParam.trim();

  let decoded;
  try {
    decoded = decodeUserToken(token, config.botSecret);
  } catch (error) {
    logger.warn(`Failed to decode token from /start: ${error instanceof TokenError ? error.message : 'unknown'}`);
    await client.sendMessage(chatId, getInvalidTokenMessage());
    return;
  }

  // 3. User clicked their own link
  if (decoded.userId === sender.id) {
    const userToken = generateUserToken(sender.id, 'direct', config.botSecret);
    const { text, replyMarkup } = getSelfLinkMessage(config.telegramBotUsername, userToken);
    await client.sendMessage(chatId, text, {
      reply_markup: replyMarkup
    });
    return;
  }

  // 4. User is sending a message to the recipient
  let targetName: string | undefined;
  try {
    const chat = await client.getChat(decoded.userId);
    targetName = chat.first_name;
  } catch (error) {
    logger.info(`Could not fetch chat profile for user ${decoded.userId}: ${error}`);
  }

  const { text, forceReplyPlaceholder } = getPromptSenderMessage(
    config.telegramBotUsername,
    token,
    targetName
  );

  await client.sendMessage(chatId, text, {
    reply_markup: {
      force_reply: true,
      input_field_placeholder: forceReplyPlaceholder
    }
  });
}
