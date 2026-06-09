/**
 * Property-based tests for auth login functionality.
 *
 * Feature: schema-restructure, Property 1, 2, 3: Auth login properties
 * Validates: Requirements 2.1, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createToken, verifyToken, hashPassword, verifyPassword } from '../auth';

// --- Generators ---

/**
 * Generator for valid Chinese phone numbers (11 digits, starts with 1, second digit 3-9)
 */
const validPhoneArb = fc
  .record({
    secondDigit: fc.integer({ min: 3, max: 9 }),
    remaining: fc.array(fc.integer({ min: 0, max: 9 }), {
      minLength: 9,
      maxLength: 9,
    }),
  })
  .map(({ secondDigit, remaining }) => `1${secondDigit}${remaining.join('')}`);

/**
 * Generator for usernames (alphanumeric, 3-20 chars)
 */
const usernameArb = fc.stringMatching(/^[a-zA-Z\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff]{2,19}$/);

/**
 * Generator for user UUIDs
 */
const userIdArb = fc.uuid();

/**
 * Generator for roles
 */
const roleArb = fc.constantFrom('admin', 'AE', 'manager', 'viewer');

/**
 * Generator for arbitrary user data suitable for token creation
 */
const userWithPhoneArb = fc.record({
  id: userIdArb,
  username: usernameArb,
  phone: validPhoneArb,
  role: roleArb,
  mustChangePassword: fc.boolean(),
});

const userWithoutPhoneArb = fc.record({
  id: userIdArb,
  username: usernameArb,
  role: roleArb,
  mustChangePassword: fc.boolean(),
});

/**
 * Generator for passwords (non-empty strings, reasonable length)
 */
const passwordArb = fc.string({ minLength: 4, maxLength: 64 }).filter((s) => s.trim().length > 0);

// Feature: schema-restructure, Property 1: Phone login authentication
describe('Property 1: Phone login authentication', () => {
  /**
   * Validates: Requirements 2.1
   *
   * For any active user with phone and known password, login succeeds.
   * We test this by verifying: create a token with user data including phone,
   * then verify the token decodes correctly (simulating successful auth flow).
   */

  it('for any active user with phone, createToken produces a valid token that verifies successfully', () => {
    fc.assert(
      fc.asyncProperty(userWithPhoneArb, async (user) => {
        const token = await createToken(
          {
            id: user.id,
            username: user.username,
            phone: user.phone,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
          },
          false
        );

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);

        const decoded = await verifyToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded!.sub).toBe(user.id);
        expect(decoded!.username).toBe(user.username);
        expect(decoded!.role).toBe(user.role);
        expect(decoded!.mustChangePassword).toBe(user.mustChangePassword);
      }),
      { numRuns: 100 }
    );
  });

  it('password hash round-trip: for any password, hash then verify returns true', () => {
    fc.assert(
      fc.asyncProperty(passwordArb, async (password) => {
        const hash = await hashPassword(password);
        const result = await verifyPassword(password, hash);
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('password hash round-trip: wrong password always fails verification', () => {
    fc.assert(
      fc.asyncProperty(
        passwordArb,
        passwordArb.filter((s) => s.length >= 4),
        async (correctPassword, wrongPassword) => {
          fc.pre(correctPassword !== wrongPassword);
          const hash = await hashPassword(correctPassword);
          const result = await verifyPassword(wrongPassword, hash);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: schema-restructure, Property 2: JWT payload contains phone and username
describe('Property 2: JWT payload contains phone and username', () => {
  /**
   * Validates: Requirements 2.3
   *
   * For any successful login via phone, JWT contains both phone and username.
   * We test by creating a token with phone and verifying the decoded payload
   * contains both fields.
   */

  it('for any user with phone, decoded JWT payload contains both phone and username', () => {
    fc.assert(
      fc.asyncProperty(userWithPhoneArb, async (user) => {
        const token = await createToken(
          {
            id: user.id,
            username: user.username,
            phone: user.phone,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
          },
          false
        );

        const decoded = await verifyToken(token);
        expect(decoded).not.toBeNull();
        // JWT payload MUST contain phone
        expect(decoded!.phone).toBe(user.phone);
        // JWT payload MUST contain username
        expect(decoded!.username).toBe(user.username);
      }),
      { numRuns: 100 }
    );
  });

  it('JWT payload preserves exact phone and username values for any input', () => {
    fc.assert(
      fc.asyncProperty(
        userWithPhoneArb,
        fc.boolean(), // rememberMe
        async (user, rememberMe) => {
          const token = await createToken(
            {
              id: user.id,
              username: user.username,
              phone: user.phone,
              role: user.role,
              mustChangePassword: user.mustChangePassword,
            },
            rememberMe
          );

          const decoded = await verifyToken(token);
          expect(decoded).not.toBeNull();
          expect(decoded!.phone).toStrictEqual(user.phone);
          expect(decoded!.username).toStrictEqual(user.username);
          expect(decoded!.sub).toStrictEqual(user.id);
          expect(decoded!.role).toStrictEqual(user.role);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: schema-restructure, Property 3: Legacy username login backward compatibility
describe('Property 3: Legacy username login backward compatibility', () => {
  /**
   * Validates: Requirements 2.4
   *
   * For any active user, login via username still works.
   * We test by creating a token without phone (username-only, legacy format)
   * and verifying it decodes correctly with the username present.
   */

  it('for any user without phone (legacy), createToken still produces a valid token with username', () => {
    fc.assert(
      fc.asyncProperty(userWithoutPhoneArb, async (user) => {
        const token = await createToken(
          {
            id: user.id,
            username: user.username,
            phone: undefined,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
          },
          false
        );

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');

        const decoded = await verifyToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded!.sub).toBe(user.id);
        expect(decoded!.username).toBe(user.username);
        expect(decoded!.role).toBe(user.role);
        expect(decoded!.mustChangePassword).toBe(user.mustChangePassword);
      }),
      { numRuns: 100 }
    );
  });

  it('legacy token structure (no phone) is identical in all other fields to phone-based token', () => {
    fc.assert(
      fc.asyncProperty(userWithPhoneArb, async (user) => {
        // Create token WITH phone
        const tokenWithPhone = await createToken(
          {
            id: user.id,
            username: user.username,
            phone: user.phone,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
          },
          false
        );

        // Create token WITHOUT phone (legacy)
        const tokenWithoutPhone = await createToken(
          {
            id: user.id,
            username: user.username,
            phone: undefined,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
          },
          false
        );

        const decodedWithPhone = await verifyToken(tokenWithPhone);
        const decodedWithoutPhone = await verifyToken(tokenWithoutPhone);

        expect(decodedWithPhone).not.toBeNull();
        expect(decodedWithoutPhone).not.toBeNull();

        // Same structure fields (sub, username, role, mustChangePassword)
        expect(decodedWithoutPhone!.sub).toBe(decodedWithPhone!.sub);
        expect(decodedWithoutPhone!.username).toBe(decodedWithPhone!.username);
        expect(decodedWithoutPhone!.role).toBe(decodedWithPhone!.role);
        expect(decodedWithoutPhone!.mustChangePassword).toBe(decodedWithPhone!.mustChangePassword);

        // Legacy token should NOT have phone field (or it's undefined)
        expect(decodedWithoutPhone!.phone).toBeUndefined();
        // Phone-based token SHOULD have phone
        expect(decodedWithPhone!.phone).toBe(user.phone);
      }),
      { numRuns: 100 }
    );
  });
});
