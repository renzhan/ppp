import 'dotenv/config';
import type { EnvConfig } from '../shared/types.js';

const BASE_REQUIRED = ['DATABASE_URL', 'PAICHACHA_API_KEY', 'PAICHACHA_BASE_URL', 'ENCRYPTION_KEY'] as const;

const PROVIDER_REQUIRED: Record<string, (keyof EnvConfig)[]> = {
  openai: ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'],
  qwen: ['QWEN_BASE_URL', 'QWEN_MODEL_API_KEY', 'QWEN_MODEL_CHAT'],
};

/**
 * Load and validate all required environment variables.
 * Throws a descriptive error if any required variable is missing or empty.
 */
export function loadEnvConfig(): EnvConfig {
  const provider = process.env.LLM_PROVIDER || 'openai';
  const missing: string[] = [];

  for (const key of BASE_REQUIRED) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  const providerKeys = PROVIDER_REQUIRED[provider] || PROVIDER_REQUIRED.openai;
  for (const key of providerKeys) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Please ensure these are set in your .env file or environment.`
    );
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    LLM_PROVIDER: provider as 'openai' | 'qwen',
    LLM_BASE_URL: process.env.LLM_BASE_URL || '',
    LLM_API_KEY: process.env.LLM_API_KEY || '',
    LLM_MODEL: process.env.LLM_MODEL || '',
    QWEN_BASE_URL: process.env.QWEN_BASE_URL || '',
    QWEN_MODEL_API_KEY: process.env.QWEN_MODEL_API_KEY || '',
    QWEN_MODEL_CHAT: process.env.QWEN_MODEL_CHAT || '',
    QWEN_MODEL_LITE: process.env.QWEN_MODEL_LITE || '',
    QWEN_MODEL_BASE: process.env.QWEN_MODEL_BASE || '',
    QWEN_EMBEDDING_MODEL: process.env.QWEN_EMBEDDING_MODEL || '',
    PAICHACHA_API_KEY: process.env.PAICHACHA_API_KEY!,
    PAICHACHA_BASE_URL: process.env.PAICHACHA_BASE_URL!,
    PUGONGYING_NOTE_BASE_URL: process.env.PUGONGYING_NOTE_BASE_URL || '',
    PUGONGYING_COMMENT_BASE_URL: process.env.PUGONGYING_COMMENT_BASE_URL || '',
    PUGONGYING_API_KEY: process.env.PUGONGYING_API_KEY || '',
  };
}

let _envConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!_envConfig) {
    _envConfig = loadEnvConfig();
  }
  return _envConfig;
}

/** @deprecated Use getEnvConfig() for lazy loading. Kept for backward compatibility. */
export const envConfig: EnvConfig = new Proxy({} as EnvConfig, {
  get(_target, prop) {
    return getEnvConfig()[prop as keyof EnvConfig];
  },
});
