import { TelegramClient } from '../../telegram/client.js';
import { TelegramMessage } from '../../telegram/types.js';
import { getHelpMessage, getPrivacyMessage } from '../messages/persian.js';

export async function handleHelpCommand(
  message: TelegramMessage,
  client: TelegramClient
): Promise<void> {
  const { text, replyMarkup } = getHelpMessage();
  await client.sendMessage(message.chat.id, text, {
    reply_markup: replyMarkup
  });
}

export async function handlePrivacyCommand(
  message: TelegramMessage,
  client: TelegramClient
): Promise<void> {
  const { text, replyMarkup } = getPrivacyMessage();
  await client.sendMessage(message.chat.id, text, {
    reply_markup: replyMarkup
  });
}
