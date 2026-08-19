import crypto from 'node:crypto';

export type TokenType = 'direct' | 'reply';

export interface DecodedToken {
  userId: number;
  type: TokenType;
}

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

export class InvalidTokenError extends TokenError {
  constructor(message = 'Token format is invalid or corrupted') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

export class TokenTamperedError extends TokenError {
  constructor(message = 'Token authentication failed or token has been tampered with') {
    super(message);
    this.name = 'TokenTamperedError';
  }
}

const TYPE_DIRECT_BYTE = 0x01;
const TYPE_REPLY_BYTE = 0x02;

const PLAINTEXT_LENGTH = 9; // 1 byte type + 8 bytes uint64 userId
const IV_LENGTH = 12; // 12 bytes standard AES-GCM IV
const TAG_LENGTH = 16; // 16 bytes standard GCM auth tag
const TOTAL_TOKEN_BYTES = IV_LENGTH + PLAINTEXT_LENGTH + TAG_LENGTH; // 37 bytes -> 50 base64url chars

/**
 * Derives encryption key and IV HMAC key from master secret using HKDF-SHA256.
 */
function deriveKeys(masterSecret: string): { encKey: Buffer; ivSaltKey: Buffer } {
  const masterKey = crypto.createHash('sha256').update(masterSecret, 'utf-8').digest();

  const encKey = Buffer.from(
    crypto.hkdfSync('sha256', masterKey, '', 'tg-hidden-msg-aes-enc-v1', 32)
  );
  const ivSaltKey = Buffer.from(
    crypto.hkdfSync('sha256', masterKey, '', 'tg-hidden-msg-iv-v1', 32)
  );

  return { encKey, ivSaltKey };
}

/**
 * Encodes and encrypts a Telegram User ID into a deterministic, authenticated Base64URL token.
 * Output fits well within Telegram's 64-character start parameter limit (exactly 50 chars).
 */
export function generateUserToken(
  userId: number,
  type: TokenType = 'direct',
  secret: string
): string {
  if (!userId || typeof userId !== 'number' || userId <= 0 || !Number.isSafeInteger(userId)) {
    throw new Error(`Invalid userId provided for token generation: ${userId}`);
  }

  const { encKey, ivSaltKey } = deriveKeys(secret);

  // 1. Pack Plaintext: [1 byte type, 8 bytes uint64 BE userId]
  const plaintext = Buffer.alloc(PLAINTEXT_LENGTH);
  plaintext.writeUInt8(type === 'direct' ? TYPE_DIRECT_BYTE : TYPE_REPLY_BYTE, 0);
  plaintext.writeBigUInt64BE(BigInt(userId), 1);

  // 2. Deterministic IV: HMAC-SHA256 of plaintext sliced to 12 bytes
  const iv = crypto.createHmac('sha256', ivSaltKey).update(plaintext).digest().subarray(0, IV_LENGTH);

  // 3. Encrypt using AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 4. Combine payload: IV (12) + Ciphertext (9) + Tag (16) = 37 bytes
  const payload = Buffer.concat([iv, ciphertext, authTag]);

  // 5. Encode as Base64URL (no padding, url-safe alphanumeric + '-' and '_')
  return payload.toString('base64url');
}

/**
 * Decrypts and authenticates a token, recovering the recipient's Telegram user ID.
 * Throws TokenError if invalid or tampered.
 */
export function decodeUserToken(token: string, secret: string): DecodedToken {
  if (!token || typeof token !== 'string') {
    throw new InvalidTokenError('Empty or non-string token provided');
  }

  const trimmed = token.trim();
  // Quick length validation (Base64url of 37 bytes is 50 chars)
  if (trimmed.length !== 50 && trimmed.length !== 48 && trimmed.length !== 52) {
    // Check if within reasonable bounds
    if (trimmed.length > 64 || trimmed.length < 32) {
      throw new InvalidTokenError('Token length is invalid for start parameter');
    }
  }

  let payload: Buffer;
  try {
    payload = Buffer.from(trimmed, 'base64url');
  } catch {
    throw new InvalidTokenError('Token is not valid Base64URL');
  }

  if (payload.length !== TOTAL_TOKEN_BYTES) {
    throw new InvalidTokenError(`Invalid token payload length: expected ${TOTAL_TOKEN_BYTES} bytes, got ${payload.length}`);
  }

  const { encKey, ivSaltKey } = deriveKeys(secret);

  const iv = payload.subarray(0, IV_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, IV_LENGTH + PLAINTEXT_LENGTH);
  const authTag = payload.subarray(IV_LENGTH + PLAINTEXT_LENGTH, TOTAL_TOKEN_BYTES);

  let plaintext: Buffer;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(authTag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new TokenTamperedError('Failed to decrypt token: authentication tag mismatch or corrupted data');
  }

  if (plaintext.length !== PLAINTEXT_LENGTH) {
    throw new TokenTamperedError('Decrypted plaintext length is invalid');
  }

  // Verify that IV matches the deterministic HMAC
  const expectedIv = crypto.createHmac('sha256', ivSaltKey).update(plaintext).digest().subarray(0, IV_LENGTH);
  if (!crypto.timingSafeEqual(iv, expectedIv)) {
    throw new TokenTamperedError('Token IV verification failed');
  }

  // Parse type and userId
  const typeByte = plaintext.readUInt8(0);
  const rawUserId = plaintext.readBigUInt64BE(1);

  if (rawUserId <= 0n || rawUserId > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvalidTokenError('Decrypted userId out of safe integer range');
  }

  const type: TokenType = typeByte === TYPE_REPLY_BYTE ? 'reply' : 'direct';

  return {
    userId: Number(rawUserId),
    type
  };
}
