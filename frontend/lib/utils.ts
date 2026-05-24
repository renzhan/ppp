/**
 * Utility for merging Tailwind CSS class names.
 * Combines multiple class values into a single string, filtering out falsy values.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}
