import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { encrypt, decrypt, mask } from '../../src/agent-management/crypto-util';

beforeAll(() => {
  // Set a stable encryption key for testing
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-property-tests-32bytes!';
});

describe('Feature: agent-management, Property 1: API Key 加密往返一致性', () => {
  /**
   * Validates: Requirements 1.4
   *
   * For any valid API Key string, encrypting then decrypting should yield
   * the original string, and the ciphertext should not contain the plaintext.
   */
  it('decrypt(encrypt(s)) === s for arbitrary strings, and ciphertext does not contain plaintext', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (plaintext) => {
          const encrypted = encrypt(plaintext);
          const decrypted = decrypt(encrypted);

          // Round-trip: decrypted value must equal original
          expect(decrypted).toBe(plaintext);

          // Security: encrypted output must not contain the original plaintext
          // (only check for strings long enough to be meaningful — single chars could appear in base64)
          if (plaintext.length >= 4) {
            expect(encrypted).not.toContain(plaintext);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles special characters and Unicode correctly', () => {
    fc.assert(
      fc.property(
        fc.unicodeString({ minLength: 1, maxLength: 200 }),
        (plaintext) => {
          const encrypted = encrypt(plaintext);
          const decrypted = decrypt(encrypted);

          expect(decrypted).toBe(plaintext);

          if (plaintext.length >= 4) {
            expect(encrypted).not.toContain(plaintext);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: agent-management, Property 2: API Key 脱敏不暴露完整密钥', () => {
  /**
   * Validates: Requirements 1.4
   *
   * For any API Key string (length 8-200), mask(key) should not contain
   * the full original key, and should retain the last 4 characters for identification.
   */
  it('mask output does not contain the full original key and retains last 4 chars', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 200 }),
        (apiKey) => {
          const masked = mask(apiKey);

          // The masked output must NOT contain the full original key
          expect(masked).not.toBe(apiKey);
          expect(masked).not.toContain(apiKey);

          // The masked output should retain the last 4 characters for identification
          const last4 = apiKey.slice(-4);
          expect(masked.endsWith(last4)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mask output contains masking characters (****)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 200 }),
        (apiKey) => {
          const masked = mask(apiKey);

          // The masked output should contain the masking pattern
          expect(masked).toContain('****');
        }
      ),
      { numRuns: 100 }
    );
  });
});
