import { AppConfig } from '../../config/env.js';
import { generateUserToken, decodeUserToken, TokenError } from '../../crypto/token.js';
import { TelegramClient, TelegramApiError } from '../../telegram/client.js';
import { TelegramMessage, MessageEntity } from '../../telegram/types.js';
import { escapeHtml } from '../../telegram/formatting.js';
import { logger } from '../../utils/logger.js';
import {
  getRecipientDeliveryHeader,
  getRecipientDeliveryMarkup,
  getSenderSuccessMessage,
  getInvalidTokenMessage,
  getRecipientBlockedMessage,
  getNoReplyGuidanceMessage,
  getSelfLinkMessage,
  getGenericErrorMessage
} from '../messages/persian.js';

/**
 * Extracts encrypted token from a message's text, entities, or links.
 */
export function extractTokenFromMessage(message: TelegramMessage): string | null {
  // 1. Check entities for text_link URLs
  const entities = [...(message.entities || []), ...(message.caption_entities || [])];
  for (const entity of entities) {
    if (entity.type === 'text_link' && entity.url) {
      const match = entity.url.match(/[?&]start=([A-Za-z0-9_-]{10,64})/);
      if (match) return match[1];
    }
  }

  // 2. Check raw text
  const text = message.text || message.caption || '';
  const textMatch = text.match(/(?:start=|\/start\s+)([A-Za-z0-9_-]{10,64})/);
  if (textMatch) return textMatch[1];

  return null;
}

export async function handleIncomingMessage(
  message: TelegramMessage,
  client: TelegramClient,
  config: AppConfig
): Promise<void> {
  const sender = message.from;
  const chatId = message.chat.id;

  if (!sender) {
    logger.warn('Received message without sender info');
    return;
  }

  // Check if message is a reply to the bot's prompt
  const replyTo = message.reply_to_message;
  let token: string | null = null;

  if (replyTo) {
    token = extractTokenFromMessage(replyTo);
  }

  // If no token was found in reply_to_message, check if the message itself contains a token
  if (!token) {
    token = extractTokenFromMessage(message);
  }

  // If still no token, the user sent an unprompted message
  if (!token) {
    const userToken = generateUserToken(sender.id, 'direct', config.botSecret);
    const { text, replyMarkup } = getNoReplyGuidanceMessage(config.telegramBotUsername, userToken);
    await client.sendMessage(chatId, text, {
      reply_markup: replyMarkup
    });
    return;
  }

  // Decrypt and validate the token
  let decoded;
  try {
    decoded = decodeUserToken(token, config.botSecret);
  } catch (error) {
    logger.warn(`Invalid token in message reply: ${error instanceof TokenError ? error.message : 'unknown'}`);
    await client.sendMessage(chatId, getInvalidTokenMessage());
    return;
  }

  const recipientId = decoded.userId;

  // Prevent sending to self
  if (recipientId === sender.id) {
    const userToken = generateUserToken(sender.id, 'direct', config.botSecret);
    const { text, replyMarkup } = getSelfLinkMessage(config.telegramBotUsername, userToken);
    await client.sendMessage(chatId, text, {
      reply_markup: replyMarkup
    });
    return;
  }

  // Generate an encrypted reply token for the sender so the recipient can anonymously reply back
  const senderReplyToken = generateUserToken(sender.id, 'reply', config.botSecret);
  const senderDirectToken = generateUserToken(sender.id, 'direct', config.botSecret);

  try {
    // Deliver message to the recipient
    if (message.text) {
      // Clean text message delivery in a single beautiful blockquote
      const deliveryText = [
        getRecipientDeliveryHeader(),
        '',
        `<blockquote>${escapeHtml(message.text)}</blockquote>`
      ].join('\n');

      await client.sendMessage(recipientId, deliveryText, {
        reply_markup: getRecipientDeliveryMarkup(config.telegramBotUsername, senderReplyToken)
      });
    } else {
      // Media message (photo, voice, video, sticker, etc.)
      await client.sendMessage(recipientId, getRecipientDeliveryHeader());
      await client.copyMessage(recipientId, chatId, message.message_id, {
        reply_markup: getRecipientDeliveryMarkup(config.telegramBotUsername, senderReplyToken)
      });
    }

    // Confirm delivery to the sender
    const { text: successText, replyMarkup: successMarkup } = getSenderSuccessMessage(
      config.telegramBotUsername,
      senderDirectToken
    );

    await client.sendMessage(chatId, successText, {
      reply_markup: successMarkup
    });

    logger.info('Anonymous message delivered successfully');
  } catch (error) {
    if (error instanceof TelegramApiError && (error.isBlocked || error.isChatNotFound)) {
      logger.warn(`Delivery failed: recipient ${recipientId} blocked the bot or chat was not found`);
      await client.sendMessage(chatId, getRecipientBlockedMessage());
    } else {
      logger.error('Failed to deliver anonymous message', error);
      await client.sendMessage(chatId, getGenericErrorMessage());
    }
  }
}
