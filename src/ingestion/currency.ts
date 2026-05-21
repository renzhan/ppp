/**
 * Currency conversion utility
 * Converts amounts from 分 (fen) to 元 (yuan)
 */

/**
 * Converts an amount in 分 (fen) to 元 (yuan).
 *
 * @param amountInFen - Non-negative integer representing the amount in fen
 * @returns The amount in yuan, rounded to exactly 2 decimal places
 * @throws Error if input is not a non-negative integer
 */
export function normalizeAmount(amountInFen: number): number {
  if (typeof amountInFen !== 'number' || Number.isNaN(amountInFen)) {
    throw new Error('Invalid input: amount must be a number, received NaN or non-number');
  }

  if (!Number.isInteger(amountInFen)) {
    throw new Error(`Invalid input: amount must be an integer, received ${amountInFen}`);
  }

  if (amountInFen < 0) {
    throw new Error(`Invalid input: amount must be non-negative, received ${amountInFen}`);
  }

  return Math.round((amountInFen / 100) * 100) / 100;
}
