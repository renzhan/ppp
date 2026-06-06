import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/lingxi/taxonomy?accountId=xxx
 * Fetches brand taxonomy (industry categories) from Lingxi API.
 * Returns tree structure of industries with codes.
 */
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('accountId');

  if (!accountId || !accountId.trim()) {
    return NextResponse.json(
      { error: '请输入灵犀账号ID' },
      { status: 400 }
    );
  }

  const baseUrl = process.env.LINGXI_BASE_URL;
  const apiKey = process.env.LINGXI_API_KEY;

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: '灵犀 API 配置缺失' },
      { status: 500 }
    );
  }

  try {
    const url = `${baseUrl}/api/data/brand-taxonomy?profile_id=default&brand_id=${encodeURIComponent(accountId.trim())}`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `灵犀接口请求失败: HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();

    if (json.code !== 0) {
      return NextResponse.json(
        { error: json.message || `灵犀接口错误: code=${json.code}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ data: json.data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败';
    return NextResponse.json(
      { error: `灵犀接口请求异常: ${message}` },
      { status: 502 }
    );
  }
}
