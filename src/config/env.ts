/**
 * Environment configuration and validation.
 */

export interface AppConfig {
  telegramBotToken: string;
  telegramBotUsername: string;
  botSecret: string;
  webhookSecret?: string;
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '');
  const botSecret = process.env.BOT_SECRET;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!telegramBotToken) {
    throw new Error('Missing required environment variable: TELEGRAM_BOT_TOKEN');
  }

  if (!telegramBotUsername) {
    throw new Error('Missing required environment variable: TELEGRAM_BOT_USERNAME');
  }

  if (!botSecret) {
    throw new Error('Missing required environment variable: BOT_SECRET (must be at least 32 characters or random hex)');
  }

  if (botSecret.length < 16) {
    throw new Error('BOT_SECRET is too short. Please provide a secret with at least 16 characters (recommended: 32+ characters).');
  }

  cachedConfig = {
    telegramBotToken,
    telegramBotUsername,
    botSecret,
    webhookSecret
  };

  return cachedConfig;
}
