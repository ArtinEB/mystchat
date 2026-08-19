import {
  TelegramMessage,
  TelegramResponse,
  TelegramUser,
  TelegramChat,
  ReplyMarkup
} from './types.js';
import { logger } from '../utils/logger.js';

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'MarkdownV2';
  reply_markup?: ReplyMarkup;
  reply_to_message_id?: number;
  disable_web_page_preview?: boolean;
}

export interface CopyMessageOptions {
  caption?: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  reply_markup?: ReplyMarkup;
}

export class TelegramApiError extends Error {
  public errorCode: number;
  public isBlocked: boolean;
  public isChatNotFound: boolean;

  constructor(message: string, errorCode = 0) {
    super(message);
    this.name = 'TelegramApiError';
    this.errorCode = errorCode;
    this.isBlocked = errorCode === 403 || message.toLowerCase().includes('bot was blocked');
    this.isChatNotFound = errorCode === 400 && message.toLowerCase().includes('chat not found');
  }
}

export class TelegramClient {
  private readonly baseUrl: string;

  constructor(private readonly token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  private async request<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = (await response.json()) as TelegramResponse<T>;

    if (!data.ok) {
      const description = data.description || 'Unknown Telegram API error';
      logger.warn(`Telegram API error on ${method}: [${data.error_code}] ${description}`);
      throw new TelegramApiError(description, data.error_code);
    }

    return data.result as T;
  }

  /**
   * Sends a text message to a chat
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<TelegramMessage> {
    return this.request<TelegramMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      reply_markup: options.reply_markup,
      reply_to_message_id: options.reply_to_message_id,
      disable_web_page_preview: options.disable_web_page_preview ?? true
    });
  }

  /**
   * Copies a message of any type (text, photo, voice, video, sticker, audio, etc.)
   * to a recipient without exposing sender metadata or forward header.
   */
  async copyMessage(
    chatId: number | string,
    fromChatId: number | string,
    messageId: number,
    options: CopyMessageOptions = {}
  ): Promise<{ message_id: number }> {
    return this.request<{ message_id: number }>('copyMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      caption: options.caption,
      parse_mode: options.parse_mode || 'HTML',
      reply_markup: options.reply_markup
    });
  }

  /**
   * Answers a callback query from an inline keyboard button
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    options: { text?: string; show_alert?: boolean } = {}
  ): Promise<boolean> {
    return this.request<boolean>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: options.text,
      show_alert: options.show_alert
    });
  }

  /**
   * Sends chat action (e.g. typing)
   */
  async sendChatAction(chatId: number | string, action: 'typing' | 'upload_photo'): Promise<boolean> {
    try {
      return await this.request<boolean>('sendChatAction', {
        chat_id: chatId,
        action
      });
    } catch {
      return false;
    }
  }

  /**
   * Fetches chat / user information
   */
  async getChat(chatId: number | string): Promise<TelegramChat> {
    return this.request<TelegramChat>('getChat', {
      chat_id: chatId
    });
  }

  /**
   * Fetches the bot's own Telegram profile
   */
  async getMe(): Promise<TelegramUser> {
    return this.request<TelegramUser>('getMe', {});
  }

  /**
   * Sets webhook for Telegram updates
   */
  async setWebhook(
    url: string,
    options: { secret_token?: string; allowed_updates?: string[] } = {}
  ): Promise<boolean> {
    return this.request<boolean>('setWebhook', {
      url,
      secret_token: options.secret_token,
      allowed_updates: options.allowed_updates || ['message', 'callback_query']
    });
  }
}
