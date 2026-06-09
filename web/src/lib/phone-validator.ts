/**
 * Validates a Chinese mobile phone number.
 *
 * Rules:
 * - Must be exactly 11 digits
 * - Must start with 1
 * - Second digit must be 3-9
 *
 * @param input - The string to validate
 * @returns true if the input is a valid Chinese mobile phone number
 */
export function isValidPhone(input: string): boolean {
  return /^1[3-9]\d{9}$/.test(input);
}
