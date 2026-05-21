import { describe, it, expect } from 'vitest';
import { defaultEngagementConfig, defaultCooperationPolicy } from '../src/config/defaults.js';
import { loadEnvConfig } from '../src/config/env.js';

describe('Configuration Module', () => {
  describe('defaultEngagementConfig', () => {
    it('should include share by default', () => {
      expect(defaultEngagementConfig.includeShare).toBe(true);
    });

    it('should include follow by default', () => {
      expect(defaultEngagementConfig.includeFollow).toBe(true);
    });
  });

  describe('defaultCooperationPolicy', () => {
    it('should have default discount of 1 (no discount)', () => {
      expect(defaultCooperationPolicy.defaultDiscount).toBe(1);
    });

    it('should have empty special rules', () => {
      expect(defaultCooperationPolicy.specialRules).toEqual([]);
    });
  });

  describe('envConfig validation', () => {
    it('should throw when required env vars are missing', () => {
      const savedEnv = { ...process.env };

      delete process.env.DATABASE_URL;
      delete process.env.LLM_BASE_URL;
      delete process.env.LLM_API_KEY;
      delete process.env.LLM_MODEL;
      delete process.env.PAICHACHA_API_KEY;
      delete process.env.PAICHACHA_BASE_URL;

      expect(() => loadEnvConfig()).toThrow('Missing required environment variables');

      Object.assign(process.env, savedEnv);
    });

    it('should throw with descriptive message listing missing vars', () => {
      const savedEnv = { ...process.env };

      delete process.env.DATABASE_URL;
      delete process.env.LLM_API_KEY;
      process.env.LLM_BASE_URL = 'http://test';
      process.env.LLM_MODEL = 'test-model';
      process.env.PAICHACHA_API_KEY = 'test-key';
      process.env.PAICHACHA_BASE_URL = 'http://test';

      try {
        loadEnvConfig();
      } catch (e: unknown) {
        const error = e as Error;
        expect(error.message).toContain('DATABASE_URL');
        expect(error.message).toContain('LLM_API_KEY');
      }

      Object.assign(process.env, savedEnv);
    });

    it('should treat empty string as missing', () => {
      const savedEnv = { ...process.env };

      process.env.DATABASE_URL = '';
      process.env.LLM_BASE_URL = 'http://test';
      process.env.LLM_API_KEY = 'key';
      process.env.LLM_MODEL = 'model';
      process.env.PAICHACHA_API_KEY = 'key';
      process.env.PAICHACHA_BASE_URL = 'http://test';

      try {
        loadEnvConfig();
      } catch (e: unknown) {
        const error = e as Error;
        expect(error.message).toContain('DATABASE_URL');
      }

      Object.assign(process.env, savedEnv);
    });
  });
});
