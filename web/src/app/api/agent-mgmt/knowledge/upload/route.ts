import { NextRequest, NextResponse } from 'next/server';
import { knowledgeService } from '@/lib/agent-management';

/**
 * POST /api/agent-mgmt/knowledge/upload
 * Upload a document to the knowledge base.
 * Expects multipart/form-data with:
 *   - file: the document file
 *   - workspaceId (optional): workspace to associate the document with
 *   - uploadedBy (optional): uploader identifier
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspaceId') as string | null;
    const uploadedBy = formData.get('uploadedBy') as string | null;

    if (!file) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'file is required',
          details: { file: 'file is required' },
        },
        { status: 400 }
      );
    }

    // Convert File to FileInput format
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileInput = {
      name: file.name,
      size: file.size,
      type: file.type,
      buffer,
    };

    // Validate file before uploading
    const validation = knowledgeService.validateFile(fileInput);
    if (!validation.valid) {
      // Determine specific error type
      const hasFormatError = validation.errors.some((e) => e.includes('Unsupported file format'));
      const hasSizeError = validation.errors.some((e) => e.includes('exceeds maximum'));

      const errorType = hasFormatError ? 'FILE_FORMAT_ERROR' : hasSizeError ? 'FILE_SIZE_ERROR' : 'VALIDATION_ERROR';

      return NextResponse.json(
        {
          error: errorType,
          message: validation.errors.join('; '),
          details: { file: validation.errors.join('; ') },
        },
        { status: 400 }
      );
    }

    const document = await knowledgeService.upload(
      fileInput,
      workspaceId || null,
      uploadedBy || undefined
    );

    return NextResponse.json(document, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/agent-mgmt/knowledge/upload error:', error);

    const message = error?.message || 'Unknown error';

    if (message.includes('File validation failed')) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message,
          details: { file: message },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
