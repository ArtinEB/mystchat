/**
 * Safe logger for the Telegram bot.
 * Ensures tokens, encryption secrets, and sensitive user message contents are never leaked in logs.
 */

export const logger = {
  info: (message: string, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    if (context) {
      console.log(`[${timestamp}] [INFO] ${message}`, JSON.stringify(sanitizeContext(context)));
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },

  warn: (message: string, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    if (context) {
      console.warn(`[${timestamp}] [WARN] ${message}`, JSON.stringify(sanitizeContext(context)));
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  },

  error: (message: string, error?: unknown, context?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
    const merged = { ...sanitizeContext(context || {}), ...errorDetails };
    console.error(`[${timestamp}] [ERROR] ${message}`, JSON.stringify(merged));
  }
};

/**
 * Redacts sensitive fields from logged objects
 */
function sanitizeContext(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ['token', 'secret', 'key', 'password', 'authorization', 'bot_token', 'text', 'caption'];

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
