import { describe, it, expect, afterAll, beforeAll, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { KnowledgeService, ALLOWED_FORMATS, MAX_FILE_SIZE } from '../../../src/agent-management/knowledge-service';
import { getTestPrismaClient, disconnectTestClient } from '../../helpers/db-transaction';

const prisma = getTestPrismaClient();
let knowledgeService: KnowledgeService;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-integration-tests!';
  knowledgeService = new KnowledgeService(prisma);
});

afterEach(async () => {
  // Clean up knowledge documents and files
  const docs = await prisma.knowledgeDocument.findMany({
    where: { fileName: { startsWith: 'integ-knowledge-' } },
  });
  for (const doc of docs) {
    try {
      if (fs.existsSync(doc.storagePath)) {
        fs.unlinkSync(doc.storagePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  await prisma.knowledgeDocument.deleteMany({
    where: { fileName: { startsWith: 'integ-knowledge-' } },
  });
  await prisma.workspace.deleteMany({ where: { name: { startsWith: 'integ-knowledge-ws-' } } });
});

afterAll(async () => {
  await disconnectTestClient();
});

describe('KnowledgeService 文件校验与上传集成测试', () => {
  /**
   * Validates: Requirements 5.2
   * Tests file validation (format, size) and upload flow.
   */

  it('合法文件格式应通过校验', () => {
    for (const mimeType of ALLOWED_FORMATS) {
      const result = knowledgeService.validateFile({
        name: 'integ-knowledge-valid.pdf',
        size: 1024,
        type: mimeType,
        buffer: Buffer.from('test content'),
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });

  it('非法文件格式应校验失败', () => {
    const invalidTypes = [
      'application/javascript',
      'image/png',
      'application/zip',
      'text/html',
      'application/octet-stream',
    ];

    for (const mimeType of invalidTypes) {
      const result = knowledgeService.validateFile({
        name: 'integ-knowledge-invalid.exe',
        size: 1024,
        type: mimeType,
        buffer: Buffer.from('test'),
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unsupported file format');
    }
  });

  it('超大文件应校验失败', () => {
    const result = knowledgeService.validateFile({
      name: 'integ-knowledge-large.pdf',
      size: MAX_FILE_SIZE + 1, // Just over 20MB
      type: 'application/pdf',
      buffer: Buffer.from('x'),
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('exceeds maximum allowed size');
  });

  it('上传文件后应创建 DB 记录且文件存在', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: `integ-knowledge-ws-upload-${Date.now()}`,
        description: 'Test workspace for knowledge',
        isPreset: false,
        isEnabled: true,
      },
    });

    const fileContent = Buffer.from('# Test Document\nThis is test content for integration testing.');
    const result = await knowledgeService.upload(
      {
        name: 'integ-knowledge-test-doc.md',
        size: fileContent.length,
        type: 'text/markdown',
        buffer: fileContent,
      },
      workspace.id,
      'test-user'
    );

    expect(result.id).toBeDefined();
    expect(result.fileName).toBe('integ-knowledge-test-doc.md');
    expect(result.fileSize).toBe(fileContent.length);
    expect(result.mimeType).toBe('text/markdown');
    expect(result.workspaceId).toBe(workspace.id);
    expect(result.uploadedBy).toBe('test-user');

    // Verify file exists on disk
    expect(fs.existsSync(result.storagePath)).toBe(true);

    // Verify DB record
    const doc = await prisma.knowledgeDocument.findUnique({ where: { id: result.id } });
    expect(doc).not.toBeNull();
    expect(doc!.fileName).toBe('integ-knowledge-test-doc.md');

    // Cleanup file
    fs.unlinkSync(result.storagePath);
  });
});
