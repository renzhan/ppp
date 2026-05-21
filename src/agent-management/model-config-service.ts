import { PrismaClient } from '../../generated/prisma';
import { encrypt, decrypt, mask } from './crypto-util.js';

// ===== Types =====

export interface CreateModelConfigInput {
  name: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  timeoutMs?: number;
  maxRetries?: number;
  isDefault?: boolean;
}

export interface UpdateModelConfigInput {
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  timeoutMs?: number;
  maxRetries?: number;
  isDefault?: boolean;
}

export interface ModelConfigListItem {
  id: string;
  name: string;
  maskedApiKey: string;
  baseUrl: string;
  modelName: string;
  timeoutMs: number;
  maxRetries: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Validation Helpers =====

/**
 * Validate that a URL starts with http:// or https://
 */
function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url);
}

/**
 * Validate required fields for model config creation.
 * Throws with a descriptive message if validation fails.
 */
function validateCreateInput(data: CreateModelConfigInput): void {
  const missing: string[] = [];

  if (!data.apiKey || data.apiKey.trim() === '') {
    missing.push('apiKey');
  }
  if (!data.baseUrl || data.baseUrl.trim() === '') {
    missing.push('baseUrl');
  }
  if (!data.modelName || data.modelName.trim() === '') {
    missing.push('modelName');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (!isValidUrl(data.baseUrl)) {
    throw new Error(`Invalid URL format for baseUrl: must start with http:// or https://`);
  }
}

/**
 * Validate URL format for update operations (only if baseUrl is provided).
 */
function validateUpdateInput(data: UpdateModelConfigInput): void {
  if (data.baseUrl !== undefined) {
    if (!data.baseUrl || data.baseUrl.trim() === '') {
      throw new Error('baseUrl cannot be empty');
    }
    if (!isValidUrl(data.baseUrl)) {
      throw new Error(`Invalid URL format for baseUrl: must start with http:// or https://`);
    }
  }
}

// ===== Service Class =====

export class ModelConfigService {
  private prisma: InstanceType<typeof PrismaClient>;

  constructor(prismaClient?: InstanceType<typeof PrismaClient>) {
    this.prisma = prismaClient ?? new PrismaClient();
  }

  /**
   * Create a new model configuration.
   * Validates required fields, URL format, encrypts API Key before storage.
   */
  async create(data: CreateModelConfigInput) {
    validateCreateInput(data);

    const encryptedApiKey = encrypt(data.apiKey);

    // If setting as default, clear existing default first
    if (data.isDefault) {
      await this.prisma.modelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const config = await this.prisma.modelConfig.create({
      data: {
        name: data.name,
        apiKey: encryptedApiKey,
        baseUrl: data.baseUrl,
        modelName: data.modelName,
        timeoutMs: data.timeoutMs ?? 30000,
        maxRetries: data.maxRetries ?? 2,
        isDefault: data.isDefault ?? false,
      },
    });

    return config;
  }

  /**
   * Update an existing model configuration.
   * Validates URL format if baseUrl is provided, re-encrypts API Key if updated.
   */
  async update(id: string, data: UpdateModelConfigInput) {
    validateUpdateInput(data);

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
    if (data.modelName !== undefined) updateData.modelName = data.modelName;
    if (data.timeoutMs !== undefined) updateData.timeoutMs = data.timeoutMs;
    if (data.maxRetries !== undefined) updateData.maxRetries = data.maxRetries;

    // Re-encrypt API Key if provided
    if (data.apiKey !== undefined) {
      updateData.apiKey = encrypt(data.apiKey);
    }

    // Handle isDefault change
    if (data.isDefault === true) {
      await this.prisma.modelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
    } else if (data.isDefault === false) {
      updateData.isDefault = false;
    }

    const config = await this.prisma.modelConfig.update({
      where: { id },
      data: updateData,
    });

    return config;
  }

  /**
   * Delete a model configuration.
   * Checks if any Agent references this config; if so, blocks deletion
   * and throws with the list of referencing agents.
   */
  async delete(id: string): Promise<void> {
    const agents = await this.prisma.agent.findMany({
      where: { modelConfigId: id },
      select: { id: true, name: true },
    });

    if (agents.length > 0) {
      const agentNames = agents.map((a) => a.name);
      throw new Error(
        `Cannot delete model config: referenced by agents: ${agentNames.join(', ')}`
      );
    }

    await this.prisma.modelConfig.delete({ where: { id } });
  }

  /**
   * Find a model configuration by ID.
   * Returns the full record (API Key remains encrypted in DB field).
   */
  async findById(id: string) {
    return this.prisma.modelConfig.findUnique({ where: { id } });
  }

  /**
   * Find all model configurations.
   * Returns list items with API Key masked for display.
   */
  async findAll(): Promise<ModelConfigListItem[]> {
    const configs = await this.prisma.modelConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((config) => {
      let maskedApiKey = '****';
      try {
        maskedApiKey = mask(decrypt(config.apiKey));
      } catch {
        // Decryption may fail if the key was encrypted with a different ENCRYPTION_KEY
        maskedApiKey = '****（解密失败）';
      }

      return {
        id: config.id,
        name: config.name,
        maskedApiKey,
        baseUrl: config.baseUrl,
        modelName: config.modelName,
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
        isDefault: config.isDefault,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    });
  }

  /**
   * Set a model configuration as the default.
   * Ensures only one config has isDefault=true at any time.
   */
  async setDefault(id: string): Promise<void> {
    // Clear all existing defaults
    await this.prisma.modelConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // Set the specified config as default
    await this.prisma.modelConfig.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  /**
   * Get the current default model configuration.
   * Returns null if no default is set.
   */
  async getDefault() {
    return this.prisma.modelConfig.findFirst({
      where: { isDefault: true },
    });
  }
}
