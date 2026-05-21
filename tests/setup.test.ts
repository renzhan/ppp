import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have vitest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should resolve path aliases', async () => {
    const shared = await import('@/shared/index');
    expect(shared).toBeDefined();
  });
});
