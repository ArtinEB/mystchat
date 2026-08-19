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

const CIPHER_BLOCK_BYTES = 8; // 64-bit block for user ID & type
const MAC_BYTES = 3; // 24-bit authentication tag
const TOTAL_TOKEN_BYTES = CIPHER_BLOCK_BYTES + MAC_BYTES; // 11 bytes -> exactly 15 Base64URL characters

/**
 * Derives Feistel round keys and MAC key from master secret using HKDF-SHA256.
 */
function deriveKeys(masterSecret: string): {
  roundKeys: [Buffer, Buffer, Buffer, Buffer];
  authKey: Buffer;
} {
  const masterKey = crypto.createHash('sha256').update(masterSecret, 'utf-8').digest();

  const k1 = Buffer.from(crypto.hkdfSync('sha256', masterKey, '', 'tg-feistel-k1', 32));
  const k2 = Buffer.from(crypto.hkdfSync('sha256', masterKey, '', 'tg-feistel-k2', 32));
  const k3 = Buffer.from(crypto.hkdfSync('sha256', masterKey, '', 'tg-feistel-k3', 32));
  const k4 = Buffer.from(crypto.hkdfSync('sha256', masterKey, '', 'tg-feistel-k4', 32));
  const authKey = Buffer.from(crypto.hkdfSync('sha256', masterKey, '', 'tg-feistel-auth', 32));

  return { roundKeys: [k1, k2, k3, k4], authKey };
}

/**
 * 32-bit round function using HMAC-SHA256.
 */
function roundFunction(subKey: Buffer, halfBlock: number): number {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32BE(halfBlock >>> 0, 0);
  const hash = crypto.createHmac('sha256', subKey).update(buf).digest();
  return hash.readUInt32BE(0);
}

/**
 * 4-round Feistel permutation on a 64-bit integer.
 */
function feistelEncrypt(value: bigint, roundKeys: [Buffer, Buffer, Buffer, Buffer]): Buffer {
  const block = Buffer.allocUnsafe(8);
  block.writeBigUInt64BE(value, 0);

  let l = block.readUInt32BE(0);
  let r = block.readUInt32BE(4);

  for (let i = 0; i < 4; i++) {
    const f = roundFunction(roundKeys[i], r);
    const nextL = r;
    const nextR = (l ^ f) >>> 0;
    l = nextL;
    r = nextR;
  }

  const out = Buffer.allocUnsafe(8);
  out.writeUInt32BE(l, 0);
  out.writeUInt32BE(r, 4);
  return out;
}

/**
 * Decrypts a 64-bit block using reversed Feistel rounds.
 */
function feistelDecrypt(block: Buffer, roundKeys: [Buffer, Buffer, Buffer, Buffer]): bigint {
  let l = block.readUInt32BE(0);
  let r = block.readUInt32BE(4);

  for (let i = 3; i >= 0; i--) {
    const prevR = l;
    const f = roundFunction(roundKeys[i], prevR);
    const prevL = (r ^ f) >>> 0;
    l = prevL;
    r = prevR;
  }

  const out = Buffer.allocUnsafe(8);
  out.writeUInt32BE(l, 0);
  out.writeUInt32BE(r, 4);
  return out.readBigUInt64BE(0);
}

/**
 * Computes truncated 24-bit HMAC authentication tag.
 */
function computeMac(authKey: Buffer, ciphertext: Buffer): Buffer {
  return crypto.createHmac('sha256', authKey).update(ciphertext).digest().subarray(0, MAC_BYTES);
}

/**
 * Encodes and encrypts a Telegram User ID into a compact 15-character Base64URL token.
 */
export function generateUserToken(
  userId: number,
  type: TokenType = 'direct',
  secret: string
): string {
  if (!userId || typeof userId !== 'number' || userId <= 0 || !Number.isSafeInteger(userId)) {
    throw new Error(`Invalid userId provided for token generation: ${userId}`);
  }

  const { roundKeys, authKey } = deriveKeys(secret);

  // Pack type into MSB (bit 63): 0 for direct, 1 for reply
  const typeBit = type === 'reply' ? 1n : 0n;
  const packed = (BigInt(userId) & 0x7FFFFFFFFFFFFFFFn) | (typeBit << 63n);

  // Encrypt packed 64-bit integer
  const ciphertext = feistelEncrypt(packed, roundKeys);

  // Compute 24-bit authentication tag
  const mac = computeMac(authKey, ciphertext);

  // Combine: 8 bytes ciphertext + 3 bytes MAC = 11 bytes (15 Base64URL chars)
  const payload = Buffer.concat([ciphertext, mac]);

  return payload.toString('base64url');
}

/**
 * Decrypts and authenticates a compact 15-character token, recovering the recipient's Telegram user ID.
 * Throws TokenError if invalid or tampered.
 */
export function decodeUserToken(token: string, secret: string): DecodedToken {
  if (!token || typeof token !== 'string') {
    throw new InvalidTokenError('Empty or non-string token provided');
  }

  const trimmed = token.trim();
  if (trimmed.length !== 15) {
    throw new InvalidTokenError(`Token length is invalid: expected 15 characters, got ${trimmed.length}`);
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

  const { roundKeys, authKey } = deriveKeys(secret);

  const ciphertext = payload.subarray(0, CIPHER_BLOCK_BYTES);
  const providedMac = payload.subarray(CIPHER_BLOCK_BYTES, TOTAL_TOKEN_BYTES);

  const expectedMac = computeMac(authKey, ciphertext);
  if (!crypto.timingSafeEqual(expectedMac, providedMac)) {
    throw new TokenTamperedError('Token authentication failed or token has been tampered with');
  }

  const packed = feistelDecrypt(ciphertext, roundKeys);

  const typeBit = (packed >> 63n) & 1n;
  const rawUserId = packed & 0x7FFFFFFFFFFFFFFFn;

  if (rawUserId <= 0n || rawUserId > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InvalidTokenError('Decrypted userId out of safe integer range');
  }

  const type: TokenType = typeBit === 1n ? 'reply' : 'direct';

  return {
    userId: Number(rawUserId),
    type
  };
}
