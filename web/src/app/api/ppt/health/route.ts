import { NextResponse } from 'next/server';
import { presentonClient } from '@/lib/presenton-client';

/**
 * GET /api/ppt/health
 * 检查 Presenton 服务是否可用
 */
export async function GET() {
  const isHealthy = await presentonClient.healthCheck();

  return NextResponse.json({
    status: isHealthy ? 'ok' : 'unavailable',
    presenton_url: process.env.PRESENTON_BASE_URL || 'http://localhost:5000',
  });
}
