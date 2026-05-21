import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'node:fs';
import {
  KnowledgeService,
  ALLOWED_FORMATS,
  MAX_FILE_SIZE,
} from '../../src/agent-management/knowledge-service';
import { getTestPrismaClient, disconnectTestClient } from '../helpers/db-transaction';

const prisma = getTestPrismaClient();

describe('Feature: agent-management, Property 16: 文件格式与大小校验', () => {
  /**
   * Validates: Requirements 5.2, 5.7
   *
   * For any file upload request, if the MIME type is not in [PDF, Word, Markdown, TXT]
   * or the file size exceeds 20MB, validateFile should return a failure result.
   * If both format and size are valid, it should return success.
   */

  const service = new KnowledgeService(prisma);

  it('非法 MIME 类型应被拒绝', () => {
    // Generate random MIME types that are NOT in ALLOWED_FORMATS
    const invalidMimeArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !ALLOWED_FORMATS.includes(s) && s.length > 0);

    fc.assert(
      fc.property(
        invalidMimeArb,
        fc.integer({ min: 1, max: MAX_FILE_SIZE }), // valid size
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimeType, size, fileName) => {
          const result = service.validateFile({
            name: fileName || 'test.bin',
            size,
            type: mimeType,
            buffer: Buffer.alloc(0),
          });

          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some((e) => e.includes('Unsupported file format'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('超大文件应被拒绝', () => {
    // Generate sizes > MAX_FILE_SIZE
    const oversizeArb = fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 3 });
    const validMimeArb = fc.constantFrom(...ALLOWED_FORMATS);

    fc.assert(
      fc.property(
        validMimeArb,
        oversizeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimeType, size, fileName) => {
          const result = service.validateFile({
            name: fileName || 'test.pdf',
            size,
            type: mimeType,
            buffer: Buffer.alloc(0),
          });

          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('非法格式且超大文件应返回两个错误', () => {
    const invalidMimeArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !ALLOWED_FORMATS.includes(s) && s.length > 0);
    const oversizeArb = fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 3 });

    fc.assert(
      fc.property(invalidMimeArb, oversizeArb, (mimeType, size) => {
        const result = service.validateFile({
          name: 'test.bin',
          size,
          type: mimeType,
          buffer: Buffer.alloc(0),
        });

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(2);
      }),
      { numRuns: 100 }
    );
  });

  it('合法格式且合法大小应通过校验', () => {
    const validMimeArb = fc.constantFrom(...ALLOWED_FORMATS);
    const validSizeArb = fc.integer({ min: 1, max: MAX_FILE_SIZE });

    fc.assert(
      fc.property(
        validMimeArb,
        validSizeArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (mimeType, size, fileName) => {
          const result = service.validateFile({
            name: fileName || 'test.pdf',
            size,
            type: mimeType,
            buffer: Buffer.alloc(0),
          });

          expect(result.valid).toBe(true);
          expect(result.errors).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: agent-management, Property 17: 文档可见性按工作区隔离', () => {
  /**
   * Validates: Requirements 5.4, 5.5
   *
   * Public documents (workspaceId=null) should be visible when querying with null.
   * Workspace-specific documents should only be visible when querying that workspace.
   * Documents from other workspaces should not appear in a workspace query.
   */

  const service = new KnowledgeService(prisma);
  const uploadedFiles: string[] = [];

  // Helper: create a workspace for tests
  async function createTestWorkspace(suffix: string) {
    return prisma.workspace.create({
      data: {
        name: `test-ws-knowledge-${suffix}-${Date.now()}`,
        description: 'Test workspace for knowledge tests',
        isPreset: false,
        isEnabled: true,
      },
    });
  }

  // Cleanup helper
  async function cleanupTestData() {
    // Delete uploaded files from filesystem
    for (const filePath of uploadedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    uploadedFiles.length = 0;

    // Clean up DB records
    await prisma.knowledgeDocument.deleteMany({
      where: { fileName: { startsWith: 'prop17-' } },
    });
    await prisma.workspace.deleteMany({
      where: { name: { startsWith: 'test-ws-knowledge-' } },
    });

    // Clean up upload directories
    try {
      const knowledgeDir = 'uploads/knowledge';
      if (fs.existsSync(knowledgeDir)) {
        const entries = fs.readdirSync(knowledgeDir);
        for (const entry of entries) {
          const fullPath = `${knowledgeDir}/${entry}`;
          if (entry.startsWith('test-ws-knowledge-') || entry === 'public') {
            // Remove test workspace directories and public test files
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              const files = fs.readdirSync(fullPath);
              for (const file of files) {
                if (file.includes('prop17-')) {
                  fs.unlinkSync(`${fullPath}/${file}`);
                }
              }
            }
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectTestClient();
  });

  it('公共文档仅在 workspaceId=null 查询中可见，专属文档仅在所属工作区查询中可见', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fileNameA: fc.string({ minLength: 1, maxLength: 20 }).map(
            (s) => `prop17-a-${s.replace(/[^a-zA-Z0-9]/g, 'x')}.txt`
          ),
          fileNameB: fc.string({ minLength: 1, maxLength: 20 }).map(
            (s) => `prop17-b-${s.replace(/[^a-zA-Z0-9]/g, 'x')}.txt`
          ),
          fileNamePublic: fc.string({ minLength: 1, maxLength: 20 }).map(
            (s) => `prop17-pub-${s.replace(/[^a-zA-Z0-9]/g, 'x')}.txt`
          ),
        }),
        async ({ fileNameA, fileNameB, fileNamePublic }) => {
          // Create two workspaces
          const workspaceA = await createTestWorkspace(`p17a-${Date.now()}`);
          const workspaceB = await createTestWorkspace(`p17b-${Date.now()}`);

          try {
            // Upload a document to workspace A
            const docA = await service.upload(
              {
                name: fileNameA,
                size: 100,
                type: 'text/plain',
                buffer: Buffer.from('Content for workspace A'),
              },
              workspaceA.id,
              'test-user'
            );
            uploadedFiles.push(docA.storagePath);

            // Upload a document to workspace B
            const docB = await service.upload(
              {
                name: fileNameB,
                size: 100,
                type: 'text/plain',
                buffer: Buffer.from('Content for workspace B'),
              },
              workspaceB.id,
              'test-user'
            );
            uploadedFiles.push(docB.storagePath);

            // Upload a public document (workspaceId=null)
            const docPublic = await service.upload(
              {
                name: fileNamePublic,
                size: 100,
                type: 'text/plain',
                buffer: Buffer.from('Public content'),
              },
              null,
              'test-user'
            );
            uploadedFiles.push(docPublic.storagePath);

            // Verify: findByWorkspace(A.id) returns only workspace A's document
            const docsA = await service.findByWorkspace(workspaceA.id);
            const docAIds = docsA.map((d) => d.id);
            expect(docAIds).toContain(docA.id);
            expect(docAIds).not.toContain(docB.id);
            expect(docAIds).not.toContain(docPublic.id);

            // Verify: findByWorkspace(B.id) returns only workspace B's document
            const docsB = await service.findByWorkspace(workspaceB.id);
            const docBIds = docsB.map((d) => d.id);
            expect(docBIds).toContain(docB.id);
            expect(docBIds).not.toContain(docA.id);
            expect(docBIds).not.toContain(docPublic.id);

            // Verify: findByWorkspace(null) returns only the public document
            const docsPublic = await service.findByWorkspace(null);
            const docPublicIds = docsPublic.map((d) => d.id);
            expect(docPublicIds).toContain(docPublic.id);
            expect(docPublicIds).not.toContain(docA.id);
            expect(docPublicIds).not.toContain(docB.id);

            // Verify: findAll() returns all documents
            const allDocs = await service.findAll();
            const allIds = allDocs.map((d) => d.id);
            expect(allIds).toContain(docA.id);
            expect(allIds).toContain(docB.id);
            expect(allIds).toContain(docPublic.id);
          } finally {
            // Cleanup uploaded files
            for (const filePath of uploadedFiles) {
              try {
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                }
              } catch {
                // Ignore
              }
            }
            uploadedFiles.length = 0;

            // Cleanup DB
            await prisma.knowledgeDocument.deleteMany({
              where: { workspaceId: { in: [workspaceA.id, workspaceB.id] } },
            });
            await prisma.knowledgeDocument.deleteMany({
              where: { fileName: fileNamePublic },
            });
            await prisma.workspace.deleteMany({
              where: { id: { in: [workspaceA.id, workspaceB.id] } },
            });
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 120000);
});
