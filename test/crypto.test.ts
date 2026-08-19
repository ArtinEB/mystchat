import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateUserToken,
  decodeUserToken,
  InvalidTokenError,
  TokenTamperedError
} from '../src/crypto/token.js';

describe('Cryptographic Token System (Stateless AES-256-GCM)', () => {
  const secret = 'super-secure-production-secret-key-32chars!';
  const testUserId = 123456789;

  test('generates deterministic token for the same user and secret', () => {
    const token1 = generateUserToken(testUserId, 'direct', secret);
    const token2 = generateUserToken(testUserId, 'direct', secret);

    assert.equal(token1, token2, 'Tokens generated with the same input must be identical (deterministic)');
  });

  test('token length satisfies Telegram 64-character start parameter limit', () => {
    const token = generateUserToken(testUserId, 'direct', secret);

    assert.ok(token.length <= 64, `Token length (${token.length}) must be <= 64 characters`);
    assert.match(token, /^[A-Za-z0-9_-]+$/, 'Token must be URL-safe Base64URL characters');
  });

  test('correctly decodes direct token and recovers user ID', () => {
    const token = generateUserToken(testUserId, 'direct', secret);
    const decoded = decodeUserToken(token, secret);

    assert.equal(decoded.userId, testUserId);
    assert.equal(decoded.type, 'direct');
  });

  test('correctly decodes reply token and recovers user ID', () => {
    const replyUserId = 987654321;
    const token = generateUserToken(replyUserId, 'reply', secret);
    const decoded = decodeUserToken(token, secret);

    assert.equal(decoded.userId, replyUserId);
    assert.equal(decoded.type, 'reply');
  });

  test('handles large 64-bit Telegram user IDs', () => {
    const largeUserId = 5000000000;
    const token = generateUserToken(largeUserId, 'direct', secret);
    const decoded = decodeUserToken(token, secret);

    assert.equal(decoded.userId, largeUserId);
  });

  test('fails decryption when secret is different (forgery resistance)', () => {
    const token = generateUserToken(testUserId, 'direct', secret);
    const wrongSecret = 'another-completely-different-secret-key!!';

    assert.throws(
      () => decodeUserToken(token, wrongSecret),
      (err: unknown) => err instanceof TokenTamperedError || err instanceof Error
    );
  });

  test('fails authentication when token is tampered with', () => {
    const token = generateUserToken(testUserId, 'direct', secret);

    // Tamper with one character
    const tamperedChar = token[10] === 'a' ? 'b' : 'a';
    const tamperedToken = token.slice(0, 10) + tamperedChar + token.slice(11);

    assert.throws(
      () => decodeUserToken(tamperedToken, secret),
      (err: unknown) => err instanceof TokenTamperedError || err instanceof InvalidTokenError
    );
  });

  test('rejects empty, invalid, or malformed tokens gracefully', () => {
    assert.throws(() => decodeUserToken('', secret), InvalidTokenError);
    assert.throws(() => decodeUserToken('invalid-short', secret), InvalidTokenError);
    assert.throws(() => decodeUserToken('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$', secret), InvalidTokenError);
  });
});
