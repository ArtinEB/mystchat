import { getAppConfig } from '../src/config/env.js';
import { TelegramBot } from '../src/bot/bot.js';
import { TelegramUpdate } from '../src/telegram/types.js';
import { logger } from '../src/utils/logger.js';

interface NodeReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on?: (event: string, callback: (chunk: unknown) => void) => void;
}

interface NodeRes {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  status?: (code: number) => NodeRes;
  json?: (data: unknown) => void;
  end: (data?: string) => void;
}

/**
 * Helper to extract raw JSON body from Node.js IncomingMessage if not pre-parsed.
 */
async function parseBody(req: NodeReq): Promise<TelegramUpdate | null> {
  if (req.body && typeof req.body === 'object') {
    return req.body as TelegramUpdate;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as TelegramUpdate;
    } catch {
      return null;
    }
  }

  if (typeof req.on === 'function') {
    return new Promise<TelegramUpdate | null>((resolve) => {
      const chunks: Buffer[] = [];
      req.on!('data', (chunk: unknown) => {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk, 'utf-8'));
        }
      });
      req.on!('end', () => {
        try {
          const bodyStr = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(bodyStr) as TelegramUpdate);
        } catch {
          resolve(null);
        }
      });
      req.on!('error', () => resolve(null));
    });
  }

  return null;
}

/**
 * Main Vercel Serverless Function handler (Standard Node.js req/res signature).
 */
export default async function handler(req: NodeReq, res: NodeRes): Promise<void> {
  // Health check endpoint for uptime monitors
  if (req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    if (typeof res.json === 'function') {
      res.json({ status: 'ok', message: 'Persian Hidden-Message Telegram Bot is running.' });
    } else {
      res.end(JSON.stringify({ status: 'ok', message: 'Persian Hidden-Message Telegram Bot is running.' }));
    }
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let config;
  try {
    config = getAppConfig();
  } catch (error) {
    logger.error('Failed to load application configuration', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Server misconfiguration' }));
    return;
  }

  // Verify secret token from Telegram if configured
  if (config.webhookSecret) {
    const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (receivedSecret !== config.webhookSecret) {
      logger.warn('Unauthorized webhook request: secret token mismatch');
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  const update = await parseBody(req);
  if (!update || typeof update.update_id !== 'number') {
    logger.warn('Received invalid or empty update payload');
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid update payload' }));
    return;
  }

  // Process the update asynchronously
  const bot = new TelegramBot(config);
  try {
    await bot.processUpdate(update);
  } catch (error) {
    logger.error('Error processing update in webhook', error);
  }

  // Always respond with 200 OK to Telegram so it does not retry unnecessarily
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  if (typeof res.json === 'function') {
    res.json({ ok: true });
  } else {
    res.end(JSON.stringify({ ok: true }));
  }
}
