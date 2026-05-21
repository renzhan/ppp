import { PrismaClient } from '../../generated/prisma';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ===== Types =====

export interface FileInput {
  name: string;
  size: number;
  type: string;
  buffer: Buffer;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface KnowledgeDocumentResult {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  workspaceId: string | null;
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Constants =====

export const ALLOWED_FORMATS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ===== Service Class =====

export class KnowledgeService {
  private prisma: InstanceType<typeof PrismaClient>;

  constructor(prismaClient?: InstanceType<typeof PrismaClient>) {
    this.prisma = prismaClient ?? new PrismaClient();
  }

  /**
   * Validate a file's MIME type and size.
   * Returns a result object with valid flag and any error messages.
   */
  validateFile(file: FileInput): ValidationResult {
    const errors: string[] = [];

    if (!ALLOWED_FORMATS.includes(file.type)) {
      errors.push(
        `Unsupported file format: ${file.type}. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push(
        `File size ${file.size} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (20MB)`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Upload a file to the knowledge base.
   * Validates the file, saves it to the filesystem, and creates a DB record.
   */
  async upload(
    file: FileInput,
    workspaceId: string | null,
    uploadedBy?: string
  ): Promise<KnowledgeDocumentResult> {
    // Validate file first
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join('; ')}`);
    }

    // Generate UUID for filename prefix
    const uuid = crypto.randomUUID();
    const folderName = workspaceId ?? 'public';
    const storagePath = path.join(
      'uploads',
      'knowledge',
      folderName,
      `${uuid}-${file.name}`
    );

    // Ensure directory exists
    const dir = path.dirname(storagePath);
    fs.mkdirSync(dir, { recursive: true });

    // Write file to filesystem
    fs.writeFileSync(storagePath, file.buffer);

    // Create DB record
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
        workspaceId: workspaceId ?? null,
        uploadedBy: uploadedBy ?? null,
      },
    });

    return {
      id: document.id,
      fileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      storagePath: document.storagePath,
      workspaceId: document.workspaceId,
      uploadedBy: document.uploadedBy,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Delete a knowledge document.
   * Removes the file from the filesystem and deletes the DB record.
   */
  async delete(id: string): Promise<void> {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new Error(`Knowledge document not found: ${id}`);
    }

    // Delete file from filesystem (ignore if already missing)
    try {
      if (fs.existsSync(document.storagePath)) {
        fs.unlinkSync(document.storagePath);
      }
    } catch {
      // File may already be deleted; proceed with DB cleanup
    }

    // Delete DB record
    await this.prisma.knowledgeDocument.delete({ where: { id } });
  }

  /**
   * Find all documents belonging to a specific workspace.
   * Pass null for workspaceId to get public documents.
   */
  async findByWorkspace(workspaceId: string | null): Promise<KnowledgeDocumentResult[]> {
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { workspaceId: workspaceId ?? null },
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      storagePath: doc.storagePath,
      workspaceId: doc.workspaceId,
      uploadedBy: doc.uploadedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * Find all documents, optionally filtered by workspaceId.
   */
  async findAll(filter?: { workspaceId?: string }): Promise<KnowledgeDocumentResult[]> {
    const where: Record<string, unknown> = {};

    if (filter?.workspaceId !== undefined) {
      where.workspaceId = filter.workspaceId;
    }

    const documents = await this.prisma.knowledgeDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      storagePath: doc.storagePath,
      workspaceId: doc.workspaceId,
      uploadedBy: doc.uploadedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }
}
