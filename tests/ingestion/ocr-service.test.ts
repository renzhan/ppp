import { describe, it, expect, vi } from 'vitest';
import {
  processLingxiScreenshot,
  detectImageMimeType,
  LOW_CONFIDENCE_THRESHOLD,
} from '../../src/ingestion/ocr-service';
import type { LLMClient } from '../../src/report/llm-client';

function createMockLLMClient(response: string): LLMClient {
  return {
    chat: vi.fn().mockResolvedValue(response),
  };
}

describe('OCR Service — processLingxiScreenshot', () => {
  const sampleImageBuffer = Buffer.from('fake-png-data');

  it('should return structured OCR result for AIPS data', async () => {
    const llmResponse = JSON.stringify({
      dataType: 'aips',
      fields: [
        { key: 'awareness', value: 150000, confidence: 95 },
        { key: 'interest', value: 80000, confidence: 90 },
        { key: 'purchase', value: 20000, confidence: 85 },
        { key: 'share', value: 5000, confidence: 88 },
      ],
      rawText: 'A人群 150000 I人群 80000 P人群 20000 S人群 5000',
      overallConfidence: 90,
    });

    const client = createMockLLMClient(llmResponse);
    const result = await processLingxiScreenshot(sampleImageBuffer, 'image/png', client);

    expect(result.result.dataType).toBe('aips');
    expect(result.result.confidence).toBe(90);
    expect(result.result.data['awareness']).toBe(150000);
    expect(result.result.data['interest']).toBe(80000);
    expect(result.result.rawText).toContain('A人群');
    expect(result.isLowConfidence).toBe(false);
  });

  it('should return structured OCR result for brand_ranking data', async () => {
    const llmResponse = JSON.stringify({
      dataType: 'brand_ranking',
      fields: [
        { key: 'brandName', value: '冠益乳', confidence: 92 },
        { key: 'rank', value: 3, confidence: 95 },
        { key: 'category', value: '酸奶', confidence: 88 },
      ],
      rawText: '品牌排名 冠益乳 第3名 酸奶品类',
      overallConfidence: 91,
    });

    const client = createMockLLMClient(llmResponse);
    const result = await processLingxiScreenshot(sampleImageBuffer, 'image/jpeg', client);

    expect(result.result.dataType).toBe('brand_ranking');
    expect(result.result.data['brandName']).toBe('冠益乳');
    expect(result.result.data['rank']).toBe(3);
    expect(result.isLowConfidence).toBe(false);
  });

  it('should mark result as low confidence when overall confidence < 80', async () => {
    const llmResponse = JSON.stringify({
      dataType: 'soc_sov',
      fields: [
        { key: 'soc', value: 0.15, confidence: 60 },
        { key: 'sov', value: 0.22, confidence: 55 },
      ],
      rawText: '模糊截图内容',
      overallConfidence: 58,
    });

    const client = createMockLLMClient(llmResponse);
    const result = await processLingxiScreenshot(sampleImageBuffer, 'image/png', client);

    expect(result.result.confidence).toBe(58);
    expect(result.isLowConfidence).toBe(true);
    expect(result.lowConfidenceFields.length).toBeGreaterThan(0);
  });

  it('should identify individual low-confidence fields', async () => {
    const llmResponse = JSON.stringify({
      dataType: 'spu_ranking',
      fields: [
        { key: 'spuName', value: '冠益乳巴马', confidence: 92 },
        { key: 'rank', value: 5, confidence: 70 },
        { key: 'category', value: '酸奶', confidence: 45 },
      ],
      rawText: 'SPU排名数据',
      overallConfidence: 69,
    });

    const client = createMockLLMClient(llmResponse);
    const result = await processLingxiScreenshot(sampleImageBuffer, 'image/png', client);

    // Overall confidence is 69, below threshold
    expect(result.isLowConfidence).toBe(true);
    // All fields should be marked as low confidence since overall is below threshold
    expect(result.lowConfidenceFields.length).toBeGreaterThan(0);
  });

  it('should throw error for unsupported image format', async () => {
    const client = createMockLLMClient('{}');

    await expect(
      processLingxiScreenshot(sampleImageBuffer, 'image/gif' as any, client),
    ).rejects.toThrow('仅支持 PNG/JPG 格式');
  });

  it('should throw error when LLM returns fallback message', async () => {
    const client = createMockLLMClient('AI生成失败，请稍后重试');

    await expect(
      processLingxiScreenshot(sampleImageBuffer, 'image/png', client),
    ).rejects.toThrow('OCR识别超时，请重试');
  });

  it('should throw error when LLM returns unparseable response', async () => {
    const client = createMockLLMClient('这不是有效的JSON');

    await expect(
      processLingxiScreenshot(sampleImageBuffer, 'image/png', client),
    ).rejects.toThrow('无法识别截图内容，请确认截图来源');
  });

  it('should handle response wrapped in markdown code block', async () => {
    const llmResponse = '```json\n' + JSON.stringify({
      dataType: 'aips',
      fields: [
        { key: 'awareness', value: 100000, confidence: 90 },
      ],
      rawText: 'AIPS数据',
      overallConfidence: 90,
    }) + '\n```';

    const client = createMockLLMClient(llmResponse);
    const result = await processLingxiScreenshot(sampleImageBuffer, 'image/png', client);

    expect(result.result.dataType).toBe('aips');
    expect(result.result.data['awareness']).toBe(100000);
  });

  it('should pass image as base64 in the LLM request', async () => {
    const llmResponse = JSON.stringify({
      dataType: 'aips',
      fields: [{ key: 'awareness', value: 100, confidence: 95 }],
      overallConfidence: 95,
    });

    const client = createMockLLMClient(llmResponse);
    await processLingxiScreenshot(sampleImageBuffer, 'image/png', client);

    expect(client.chat).toHaveBeenCalledTimes(1);
    const callArgs = (client.chat as any).mock.calls[0];
    const messages = callArgs[0];
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('data:image/png;base64,');
  });
});

describe('OCR Service — detectImageMimeType', () => {
  it('should detect PNG files', () => {
    expect(detectImageMimeType('screenshot.png')).toBe('image/png');
    expect(detectImageMimeType('SCREENSHOT.PNG')).toBe('image/png');
  });

  it('should detect JPEG files', () => {
    expect(detectImageMimeType('photo.jpg')).toBe('image/jpeg');
    expect(detectImageMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(detectImageMimeType('PHOTO.JPG')).toBe('image/jpeg');
  });

  it('should return null for unsupported formats', () => {
    expect(detectImageMimeType('image.gif')).toBeNull();
    expect(detectImageMimeType('image.bmp')).toBeNull();
    expect(detectImageMimeType('document.pdf')).toBeNull();
    expect(detectImageMimeType('noextension')).toBeNull();
  });
});

describe('OCR Service — LOW_CONFIDENCE_THRESHOLD', () => {
  it('should be 80', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(80);
  });
});
