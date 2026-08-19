import { emoji, inlineButton } from '../../config/emojis.js';
import { buildDeepLink, buildShareLink, escapeHtml } from '../../telegram/formatting.js';
import { InlineKeyboardMarkup } from '../../telegram/types.js';

/**
 * Generates the welcome message containing the user's personal link.
 */
export function getWelcomeMessage(botUsername: string, token: string): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const link = buildDeepLink(botUsername, token);
  const shareText = `🎭 به صورت کاملاً ناشناس و مخفی برای من پیام بفرست!\nروی لینک زیر کلیک کن 👇`;
  const shareUrl = buildShareLink(link, shareText);

  const text = [
    `${emoji('SPARKLES')} <b>به ربات پیام ناشناس MystChat خوش آمدید!</b>`,
    '',
    `${emoji('LINK')} <b>لینک اختصاصی شما:</b>`,
    `<code>${link}</code>`,
    '',
    `${emoji('INFO')} هر کاربری این لینک را باز کند می‌تواند بدون اینکه هویت، نام یا یوزرنیم او فاش شود، برای شما پیام مخفی ارسال کند.`,
    '',
    `${emoji('LOCK')} تمامی پیام‌ها به صورت ۱۰۰٪ امن، ناشناس و مستقیم تحویل داده می‌شوند.`
  ].join('\n');

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        inlineButton('SHARE', 'اشتراک‌گذاری با دوستان', { url: shareUrl })
      ],
      [
        inlineButton('HELP', 'راهنمای استفاده', { callback_data: 'show_help' }),
        inlineButton('SHIELD', 'حریم خصوصی و امنیت', { callback_data: 'show_privacy' })
      ]
    ]
  };

  return { text, replyMarkup };
}

/**
 * Message shown when a user clicks their own personal link.
 */
export function getSelfLinkMessage(botUsername: string, token: string): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const link = buildDeepLink(botUsername, token);
  const shareText = `🎭 به صورت کاملاً ناشناس برای من پیام بفرست:\n${link}`;
  const shareUrl = buildShareLink(link, shareText);

  const text = [
    `${emoji('WARNING')} <b>این لینک اختصاصی خود شماست!</b>`,
    '',
    `${emoji('INFO')} شما نمی‌توانید به خودتان پیام مخفی ارسال کنید.`,
    '',
    `${emoji('LINK')} برای دریافت پیام ناشناس، این لینک را برای دوستان یا در شبکه‌های اجتماعی خود به اشتراک بگذارید:`,
    `<code>${link}</code>`
  ].join('\n');

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        inlineButton('SHARE', 'اشتراک‌گذاری لینک', { url: shareUrl })
      ],
      [
        inlineButton('HELP', 'راهنما', { callback_data: 'show_help' })
      ]
    ]
  };

  return { text, replyMarkup };
}

/**
 * Prompt message asking the sender to write their hidden message.
 * Embeds the encrypted token invisibly via a zero-width space link so it can be extracted upon reply.
 */
export function getPromptSenderMessage(botUsername: string, token: string): {
  text: string;
  forceReplyPlaceholder: string;
} {
  const deepLink = buildDeepLink(botUsername, token);

  const text = [
    `${emoji('MESSAGE')} <b>در حال ارسال پیام مخفی و ناشناس...</b>`,
    '',
    `لطفاً پیام خود را (متن، عکس، وویس، ویدیو یا استیکر) <b>در پاسخ (Reply) به همین پیام</b> ارسال کنید.`,
    '',
    `${emoji('ANONYMOUS')} <b>هویت شما کاملاً محفوظ است:</b> مخاطب هیچ نام، شماره، آیدی یا عکسی از شما نخواهد دید.`,
    '',
    `${emoji('LOCK')} <i>برای ارسال، مستقیماً به این پیام ریپلای کنید.</i>`,
    // Hidden zero-width anchor embedding the token for stateless extraction:
    `<a href="${deepLink}">&#8203;</a>`
  ].join('\n');

  return {
    text,
    forceReplyPlaceholder: 'پیام مخفی خود را اینجا بنویسید...'
  };
}

/**
 * Message header attached when delivering an anonymous message to the recipient.
 */
export function getRecipientDeliveryHeader(): string {
  return `${emoji('INBOX')} <b>یک پیام جدید داری!</b>`;
}

/**
 * Reply markup for the recipient when they receive a hidden message.
 */
export function getRecipientDeliveryMarkup(
  botUsername: string,
  senderReplyToken?: string
): InlineKeyboardMarkup {
  const buttons: InlineKeyboardMarkup['inline_keyboard'] = [];

  if (senderReplyToken) {
    const replyLink = buildDeepLink(botUsername, senderReplyToken);
    buttons.push([
      inlineButton('REPLY', 'پاسخ ناشناس به این پیام', { url: replyLink })
    ]);
  }

  buttons.push([
    inlineButton('LINK', 'دریافت لینک اختصاصی خودم', { callback_data: 'my_link' })
  ]);

  return { inline_keyboard: buttons };
}

/**
 * Confirmation message sent to the sender after their message is successfully delivered.
 */
export function getSenderSuccessMessage(botUsername: string, senderToken?: string): {
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
} {
  const text = `${emoji('SUCCESS')} <b>پیام شما با موفقیت ارسال شد!</b>`;

  let replyMarkup: InlineKeyboardMarkup | undefined;
  if (senderToken) {
    replyMarkup = {
      inline_keyboard: [
        [
          inlineButton('LINK', 'دریافت لینک اختصاصی من', { callback_data: 'my_link' })
        ]
      ]
    };
  }

  return { text, replyMarkup };
}

/**
 * Error message shown when a link or token is invalid or tampered with.
 */
export function getInvalidTokenMessage(): string {
  return [
    `${emoji('ERROR')} <b>لینک نامعتبر یا منقضی شده است!</b>`,
    '',
    `${emoji('WARNING')} توکن این لینک نامعتبر است یا دستکاری شده است.`,
    'لطفاً لینک صحیح و کامل را از مخاطب مورد نظر دریافت کنید.',
    '',
    `${emoji('INFO')} برای دریافت لینک اختصاصی خودتان دستور /start را ارسال کنید.`
  ].join('\n');
}

/**
 * Error message shown when the recipient has blocked the bot or disabled messages.
 */
export function getRecipientBlockedMessage(): string {
  return [
    `${emoji('BLOCK')} <b>امکان ارسال پیام وجود ندارد!</b>`,
    '',
    `${emoji('ERROR')} متأسفانه کاربر مورد نظر، ربات را مسدود (بلاک) کرده است یا حساب کاربری ایشان در دسترس نیست.`,
    'پیام شما تحویل داده نشد.'
  ].join('\n');
}

/**
 * Guidance message shown when a user sends a normal message without replying to a prompt.
 */
export function getNoReplyGuidanceMessage(botUsername: string, userToken: string): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const link = buildDeepLink(botUsername, userToken);

  const text = [
    `${emoji('WARNING')} <b>متوجه پیام شما نشدم!</b>`,
    '',
    `${emoji('INFO')} برای <b>ارسال پیام مخفی</b> به دیگران، ابتدا باید روی لینک اختصاصی آن شخص کلیک کنید و در پاسخ (Reply) به پیام ربات، متن خود را ارسال کنید.`,
    '',
    `${emoji('LINK')} <b>لینک اختصاصی خود شما:</b>`,
    `<code>${link}</code>`
  ].join('\n');

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        inlineButton('SHARE', 'اشتراک لینک من', {
          url: buildShareLink(link, '🎭 برای من پیام ناشناس بفرست!')
        })
      ],
      [
        inlineButton('HELP', 'راهنمای ربات', { callback_data: 'show_help' })
      ]
    ]
  };

  return { text, replyMarkup };
}

/**
 * Help guide message explaining how the system works.
 */
export function getHelpMessage(): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const text = [
    `${emoji('HELP')} <b>راهنمای استفاده از ربات پیام مخفی:</b>`,
    '',
    `۱. با دستور /start یا /link <b>لینک اختصاصی</b> خود را دریافت کنید.`,
    `۲. لینک خود را در شبکه‌های اجتماعی (اینستاگرام، تلگرام و ...) با دوستانتان به اشتراک بگذارید.`,
    `۳. هر کسی این لینک را باز کند، مستقیماً وارد ربات می‌شود و می‌تواند برای شما پیام مخفی ارسال کند.`,
    `۴. تمام پیام‌ها (متن، عکس، وویس، ویدیو، استیکر و ...) مستقیماً برای شما ارسال می‌شوند بدون اینکه فرستنده مشخص باشد.`,
    `۵. می‌توانید با کلیک روی دکمه «پاسخ ناشناس»، به صورت دوطرفه و کاملاً ناشناس با فرستنده گفتگو کنید!`,
    '',
    `${emoji('LOCK')} <b>هیچ پیامی در سرور ذخیره نمی‌شود و امنیت شما تضمین شده است.</b>`
  ].join('\n');

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        inlineButton('LINK', 'لینک اختصاصی من', { callback_data: 'my_link' }),
        inlineButton('SHIELD', 'امنیت و حریم خصوصی', { callback_data: 'show_privacy' })
      ]
    ]
  };

  return { text, replyMarkup };
}

/**
 * Privacy and security explanation message.
 */
export function getPrivacyMessage(): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  const text = [
    `${emoji('SHIELD')} <b>امنیت و حریم خصوصی ربات:</b>`,
    '',
    `${emoji('SPARKLES')} <b>ساختار کاملاً بدون دیتابیس (Stateless):</b>`,
    `این ربات بر روی سرورهای ابری سرورلس اجرا می‌شود و هیچ‌گونه دیتابیس یا ذخیره‌سازی محلی ندارد. پیام‌های شما بلافاصله پس از ارسال از حافظه حذف می‌شوند.`,
    '',
    `${emoji('ANONYMOUS')} <b>ناشناسی ۱۰۰٪:</b>`,
    `هویت فرستنده (نام، آیدی عددی و یوزرنیم) به هیچ عنوان به گیرنده نمایش داده نمی‌شود و پیام‌ها فوروارد نمی‌شوند (ارسال مستقیم).`,
    '',
    `${emoji('LOCK')} <b>رمزنگاری پیشرفته توکن‌ها (AES-256-GCM):</b>`,
    `لینک‌های اختصاصی با استانداردهای قدرتمند رمزنگاری احراز هویت شده ساخته شده‌اند و هیچ فردی امکان دستکاری یا هدف‌گیری حساب‌های دیگر را ندارد.`
  ].join('\n');

  const replyMarkup: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        inlineButton('HELP', 'بازگشت به راهنما', { callback_data: 'show_help' }),
        inlineButton('LINK', 'لینک اختصاصی من', { callback_data: 'my_link' })
      ]
    ]
  };

  return { text, replyMarkup };
}

/**
 * Generic server error message.
 */
export function getGenericErrorMessage(): string {
  return [
    `${emoji('ERROR')} <b>متأسفانه خطایی در پردازش رخ داد.</b>`,
    'لطفاً چند لحظه دیگر مجدداً تلاش نمایید.'
  ].join('\n');
}
