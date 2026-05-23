import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * Allowed file extensions for plan uploads.
 */
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt'];

/**
 * Validates whether a file name has an allowed extension for plan uploads.
 */
function isValidPlanFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * POST /api/reviews/[id]/plan-upload
 *
 * Accepts multipart/form-data with a plan file (.pdf, .docx, .doc, .pptx, .ppt).
 * Stores the file and updates ReviewConfig's planFileUrl and planFileName.
 * Returns { success: true, fileName: string, fileUrl: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if review exists
    const review = await prisma.reviewConfig.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });

    if (!review) {
      return NextResponse.json(
        { error: '复盘记录不存在', code: 'REVIEW_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Data permission check
    if (session.role !== 'admin') {
      const project = await prisma.project.findUnique({
        where: { id: review.projectId },
        select: { createdBy: true, participants: true },
      });

      if (
        project &&
        project.createdBy !== session.sub &&
        !project.participants.includes(session.sub)
      ) {
        return NextResponse.json(
          { error: '无权限', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请上传文件', code: 'NO_FILE' },
        { status: 400 }
      );
    }

    // Validate file format
    if (!isValidPlanFile(file.name)) {
      return NextResponse.json(
        { error: '仅支持 .pdf、.docx、.doc、.pptx、.ppt 格式文件', code: 'INVALID_FILE_FORMAT' },
        { status: 400 }
      );
    }

    // Generate unique filename to avoid conflicts
    const ext = path.extname(file.name).toLowerCase();
    const uniqueId = crypto.randomUUID();
    const storedFileName = `${uniqueId}${ext}`;

    // Ensure uploads/plans directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads', 'plans');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Write file to disk
    const filePath = path.join(uploadsDir, storedFileName);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    // Build file URL (relative path for serving)
    const fileUrl = `/uploads/plans/${storedFileName}`;

    // Update ReviewConfig with file info
    await prisma.reviewConfig.update({
      where: { id },
      data: {
        planFileUrl: fileUrl,
        planFileName: file.name,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileUrl,
    });
  } catch (error) {
    console.error('POST /api/reviews/[id]/plan-upload error:', error);
    return NextResponse.json(
      { error: '上传失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
