import { TelegramClient } from '../src/telegram/client.js';

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.argv[2] || process.env.WEBHOOK_URL;
  const secretToken = process.env.WEBHOOK_SECRET;

  if (!token) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN environment variable is required.');
    process.exit(1);
  }

  if (!webhookUrl) {
    console.error('❌ Error: Webhook URL must be provided as a CLI argument or via WEBHOOK_URL env var.');
    console.error('Example: npm run set-webhook https://your-app.vercel.app/api/webhook');
    process.exit(1);
  }

  console.log(`Setting webhook to: ${webhookUrl}`);
  const client = new TelegramClient(token);

  try {
    const me = await client.getMe();
    console.log(`🤖 Bot identified: @${me.username} (${me.first_name})`);

    const result = await client.setWebhook(webhookUrl, {
      secret_token: secretToken
    });

    if (result) {
      console.log('✅ Webhook successfully set!');
    } else {
      console.log('⚠️ Telegram responded without error, but returned false.');
    }
  } catch (error) {
    console.error('❌ Failed to set webhook:', error);
    process.exit(1);
  }
}

main();
