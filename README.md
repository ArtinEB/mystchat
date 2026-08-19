# 🎭 MystChat — Stateless Hidden-Message Telegram Bot

A production-ready, **100% stateless and zero-database** Telegram bot for sending and receiving anonymous hidden messages. Designed specifically for **Vercel Serverless Functions** and built with **TypeScript**, **AES-256-GCM authenticated encryption**, and **Telegram Custom Emojis**.

---

## 🌟 Key Features

* 🔗 **Unique Deterministic Personal Links**: Generates Telegram deep links (`https://t.me/YourBot?start=<TOKEN>`) for every user.
* 🔒 **Cryptographically Secure (AES-256-GCM + HKDF)**: Encodes and authenticates the recipient's Telegram `user_id` inside a 50-character Base64URL token, strictly within Telegram's 64-character `/start` limit.
* ⚡ **Zero Database & 100% Stateless**: No database (PostgreSQL, MongoDB), No Redis, No file system storage, and No server-side sessions. Every incoming update is processed independently.
* 🎭 **Complete Anonymity**: Messages are copied directly using Telegram's `copyMessage` without revealing sender identity, name, username, or profile links.
* ✍️ **Stateless Anonymous Replies**: Recipients can send anonymous replies back to the sender through an encrypted reply deep link.
* 🎨 **Centralized Custom Emoji System**: Complete inventory in `CUSTOM_EMOJIS.txt`, native `<tg-emoji>` HTML tag rendering, and automatic fallback to standard Unicode emojis.
* 🇮🇷 **Native Persian (Farsi) UI**: Elegant Persian messages, buttons, guides, and error handling for blocked users or tampered links.
* 🛡️ **Privacy & Safe Logging**: Automatically sanitizes tokens, decryption keys, and private message contents from logs.

---

## 📁 Architecture & File Structure

```
hidden-bot/
├── api/
│   └── webhook.ts                  # Vercel Serverless Function entrypoint (POST /api/webhook)
├── src/
│   ├── bot/
│   │   ├── bot.ts                  # Main Telegram Update router & dispatcher
│   │   ├── handlers/
│   │   │   ├── start.ts            # /start handler (personal link & anonymous prompt)
│   │   │   ├── message.ts          # Stateless reply processing & message delivery
│   │   │   ├── mylink.ts           # /link handler (display & share personal link)
│   │   │   ├── help.ts             # /help & /privacy handlers (guides & security info)
│   │   │   └── callback.ts         # Inline keyboard callback handlers
│   │   └── messages/
│   │       └── persian.ts          # Persian UI texts, templates, buttons & messages
│   ├── config/
│   │   ├── env.ts                  # Environment variables validation & parsing
│   │   └── emojis.ts               # Centralized Custom Emoji registry & loader
│   ├── crypto/
│   │   └── token.ts                # Deterministic AES-256-GCM token encryption/decryption
│   ├── telegram/
│   │   ├── client.ts               # Telegram Bot API HTTP client (sendMessage, copyMessage, etc.)
│   │   ├── types.ts                # TypeScript definitions for Telegram Bot API
│   │   └── formatting.ts           # HTML formatting, entity builder & UTF-16 code unit helpers
│   └── utils/
│       └── logger.ts               # Safe logging (protects tokens & message privacy)
├── test/                           # Comprehensive test suites (Crypto, Emojis, Formatting, Handlers)
├── CUSTOM_EMOJIS.txt               # Semantic Custom Emoji registry & documentation
├── scripts/
│   └── set-webhook.ts              # Telegram webhook registration script
├── vercel.json                     # Vercel routing configuration
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript compiler configuration
└── .env.example                    # Example environment variables template
```

---

## 🔐 Cryptographic Design & Stateless Token Architecture

### Why No Database is Needed
Telegram passes the deep-link start parameter to the bot with `/start <TOKEN>`:
`https://t.me/YourBot?start=<TOKEN>`

Telegram enforces a strict limit of **64 characters** (`[A-Za-z0-9_-]`, URL-safe Base64).

Using **AES-256-GCM** and key derivation with **HKDF-SHA256**:
1. **Plaintext Packing**: The 64-bit Telegram user ID (8 bytes) + token type identifier (1 byte) = 9 bytes total.
2. **Deterministic IV**: A 12-byte initialization vector is deterministically derived using `HMAC-SHA256` over the plaintext and derived IV key.
3. **Authenticated Encryption**: AES-256-GCM generates 9 bytes of ciphertext and a 16-byte (128-bit) authentication tag.
4. **Binary Payload**: `IV (12B) + Ciphertext (9B) + AuthTag (16B) = 37 Bytes`.
5. **Base64URL Token**: 37 bytes encodes to exactly **50 characters**, well within Telegram's 64-character limit.

### Security Guarantees
* **Confidentiality**: The Telegram user ID cannot be determined or extracted without `BOT_SECRET`.
* **Integrity & Authenticity**: The 128-bit GCM authentication tag prevents any token tampering or arbitrary user targeting. Any modified bit will immediately fail authentication.
* **Determinism**: The personal link for a user remains constant across all serverless invocations without requiring any database storage.

---

## 🎨 Custom Emoji Configuration System

All emojis used throughout the bot are defined semantically in `CUSTOM_EMOJIS.txt`.

### Configuring Custom Emoji IDs:
Set the numeric Telegram Custom Emoji IDs in `CUSTOM_EMOJIS.txt` or via environment variables (`EMOJI_<NAME>`):

```text
# Success
SUCCESS = 5206607081334906820
Use case: Used when an action is completed successfully.

# Error
ERROR = 5210952531676504517
Use case: Used for errors and failed operations.
```

If an ID is left as `<CUSTOM_EMOJI_ID>` or empty, the bot automatically falls back to standard Unicode emojis (e.g. ✅, ❌, 🎭, 🔒).

---

## 🚀 Deployment Guide (Vercel Serverless)

### 1. Environment Variables

Configure the following environment variables in Vercel (**Settings** > **Environment Variables**):

| Variable | Description | Example |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Bot API Token from [@BotFather](https://t.me/BotFather) | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `TELEGRAM_BOT_USERNAME` | Bot username (without `@`) | `MyHiddenMsgBot` |
| `BOT_SECRET` | Secret key for AES-256-GCM encryption (32+ chars hex/random) | `69db9173784529bf3047c4e8bf8d...` |
| `WEBHOOK_SECRET` | *(Optional)* Secret token for validating Telegram requests | `random_webhook_secret_key` |

> 💡 **Generate a strong secret key:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### 2. Deploying to Vercel

#### Option A: Vercel CLI
```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy to production
vercel --prod
```

#### Option B: GitHub Integration
1. Push this repository to your GitHub account.
2. In the [Vercel Dashboard](https://vercel.com), click **Add New Project** and import your repository.
3. Add the environment variables listed above.
4. Click **Deploy**.

---

### 3. Registering the Telegram Webhook

Once deployed, your Vercel deployment URL (e.g. `https://your-bot.vercel.app`) will be active.

Register the webhook using the built-in script:

```bash
TELEGRAM_BOT_TOKEN="your_bot_token" npm run set-webhook https://your-bot.vercel.app/api/webhook
```

Or directly via your browser / curl:
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://your-bot.vercel.app/api/webhook&secret_token=<WEBHOOK_SECRET>
```

---

## 🧪 Testing & Verification

The project includes 21 unit tests covering cryptography, emoji parsing, Persian text UTF-16 code units, and message handlers:

```bash
# Run unit tests
npm test

# Verify TypeScript compilation
npm run build
```

---

## 🛡️ Security Analysis & Architectural Trade-offs

| Feature / Consideration | Status | Details |
| :--- | :---: | :--- |
| **Recipient ID Confidentiality** | ✅ Guaranteed | AES-256-GCM prevents recovery of the Telegram ID without `BOT_SECRET`. |
| **Tamper & Forgery Protection** | ✅ Guaranteed | 128-bit authentication tag rejects invalid or manipulated tokens. |
| **Sender Anonymity** | ✅ Guaranteed | Uses `copyMessage`; does not forward or expose sender details. |
| **Message Data Privacy** | ✅ Guaranteed | Zero data persistence. Messages exist in memory only during the invocation. |
| **Global Rate Limiting** | ⚠️ Limitation | Without a shared database or Redis cache, global cross-instance rate limiting cannot be enforced in memory (use Cloudflare / Vercel WAF if needed). |
| **User Blocklists** | ⚠️ Limitation | Blocking specific anonymous senders per user permanently requires persistent storage. |

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
