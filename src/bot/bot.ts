import { AppConfig } from '../config/env.js';
import { TelegramClient } from '../telegram/client.js';
import { TelegramUpdate } from '../telegram/types.js';
import { logger } from '../utils/logger.js';
import { handleStartCommand } from './handlers/start.js';
import { handleIncomingMessage } from './handlers/message.js';
import { handleMyLinkCommand } from './handlers/mylink.js';
import { handleHelpCommand, handlePrivacyCommand } from './handlers/help.js';
import { handleCallbackQuery } from './handlers/callback.js';
import { handleAdminCommand, handleBroadcastCommand, isAdminUser } from './handlers/admin.js';
import { UserStore } from '../storage/userStore.js';

export class TelegramBot {
  private readonly client: TelegramClient;

  constructor(private readonly config: AppConfig) {
    this.client = new TelegramClient(config.telegramBotToken);
  }

  /**
   * Main entry point to process a single Telegram update in a completely stateless manner.
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    try {
      // 1. Handle Callback Queries from Inline Keyboards
      if (update.callback_query) {
        if (update.callback_query.from?.id) {
          UserStore.getInstance().trackUser(update.callback_query.from.id).catch(() => {});
        }
        await handleCallbackQuery(update.callback_query, this.client, this.config);
        return;
      }

      // 2. Handle Messages
      const message = update.message;
      if (!message) {
        return;
      }

      if (message.from?.id) {
        UserStore.getInstance().trackUser(message.from.id).catch(() => {});
      }

      const text = message.text?.trim() || message.caption?.trim() || '';

      // Check for Admin Commands
      if (message.from && isAdminUser(message.from.id, this.config)) {
        if (text.startsWith('/admin') || text.startsWith('/stats') || text.startsWith('/panel')) {
          await handleAdminCommand(message, this.client, this.config);
          return;
        }

        if (text.startsWith('/broadcast') || text.startsWith('/sendtoall')) {
          await handleBroadcastCommand(message, this.client, this.config);
          return;
        }
      }

      // Check for user commands
      if (text.startsWith('/start')) {
        const parts = text.split(/\s+/);
        const tokenParam = parts.length > 1 ? parts[1] : undefined;
        await handleStartCommand(message, tokenParam, this.client, this.config);
        return;
      }

      if (text.startsWith('/link') || text.startsWith('/mylink')) {
        await handleMyLinkCommand(message, this.client, this.config);
        return;
      }

      if (text.startsWith('/help') || text.startsWith('/guide') || text.startsWith('/start_help')) {
        await handleHelpCommand(message, this.client);
        return;
      }

      if (text.startsWith('/privacy') || text.startsWith('/about')) {
        await handlePrivacyCommand(message, this.client);
        return;
      }

      // Handle standard message (text, photo, voice, video, sticker, etc.)
      await handleIncomingMessage(message, this.client, this.config);
    } catch (error) {
      logger.error('Unhandled error while processing Telegram update', error, {
        update_id: update.update_id
      });
    }
  }
}
