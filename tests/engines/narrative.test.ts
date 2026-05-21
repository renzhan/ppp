import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadTemplate,
  MODULE_SUFFIXES,
  selectTone,
  ATTRIBUTION_STRATEGIES,
  getAttributionStrategies,
  substituteVariables,
  generateNarrative,
  regenerateParagraph,
  transformProblemToOpportunity,
  setLLMClient,
} from '@/engines/narrative';
import type { NarrativeRequest } from '@/engines/types';
import type { LLMClient } from '@/report/llm-client';

describe('Narrative Engine — loadTemplate', () => {
  describe('successful template loading', () => {
    it('should load and parse a valid YAML template', () => {
      const template = loadTemplate('新品上市', 'M1', 'positive');

      expect(template.name).toBe('新品上市-数据总览-积极版');
      expect(template.version).toBe('1.0.0');
      expect(template.projectType).toBe('新品上市');
      expect(template.moduleId).toBe('M1');
      expect(template.toneIntensity).toBe('positive');
      expect(template.prompt).toContain('小红书营销复盘专家');
      expect(template.variables).toBeInstanceOf(Array);
      expect(template.variables.length).toBeGreaterThan(0);
      expect(template.fallbackText).toBeTruthy();
    });

    it('should return a template with all required fields', () => {
      const template = loadTemplate('新品上市', 'M1', 'positive');

      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('version');
      expect(template).toHaveProperty('projectType');
      expect(template).toHaveProperty('moduleId');
      expect(template).toHaveProperty('toneIntensity');
      expect(template).toHaveProperty('prompt');
      expect(template).toHaveProperty('variables');
      expect(template).toHaveProperty('fallbackText');
    });

    it('should include changelog when present in YAML', () => {
      const template = loadTemplate('新品上市', 'M1', 'positive');

      expect(template.changelog).toBeDefined();
      expect(template.changelog).toBeInstanceOf(Array);
      expect(template.changelog!.length).toBeGreaterThan(0);
    });

    it('should parse variables as an array of strings', () => {
      const template = loadTemplate('新品上市', 'M1', 'positive');

      expect(template.variables).toContain('project_name');
      expect(template.variables).toContain('total_impressions');
      expect(template.variables).toContain('kpi_completion_rate');
    });
  });

  describe('error handling — missing file', () => {
    it('should throw a descriptive error for non-existent project type', () => {
      expect(() => loadTemplate('不存在的类型' as any, 'M1', 'positive')).toThrow(
        /Failed to load template file/,
      );
    });

    it('should throw a descriptive error for non-existent module', () => {
      expect(() => loadTemplate('新品上市', 'M9' as any, 'positive')).toThrow();
    });

    it('should throw a descriptive error for non-existent tone', () => {
      expect(() => loadTemplate('新品上市', 'M1', 'nonexistent' as any)).toThrow(
        /Failed to load template file/,
      );
    });

    it('should include the file path in the error message', () => {
      try {
        loadTemplate('新品上市', 'M1', 'nonexistent' as any);
      } catch (err: any) {
        expect(err.message).toContain('prompts/新品上市/M1_overview/nonexistent.yaml');
      }
    });
  });

  describe('error handling — invalid YAML content', () => {
    it('should throw for invalid YAML structure', async () => {
      // We test this by creating a temporary invalid file
      const { writeFileSync, mkdirSync, unlinkSync } = await import('fs');
      const { resolve } = await import('path');

      const dir = resolve(process.cwd(), 'prompts', '新品上市', 'M1_overview');
      const testFile = resolve(dir, 'test_invalid.yaml');

      try {
        writeFileSync(testFile, 'not: valid: yaml: [[[');
        expect(() => loadTemplate('新品上市', 'M1', 'test_invalid' as any)).toThrow(
          /Failed to parse YAML template/,
        );
      } finally {
        try { unlinkSync(testFile); } catch { /* ignore */ }
      }
    });

    it('should throw for YAML that parses to null', async () => {
      const { writeFileSync, unlinkSync } = await import('fs');
      const { resolve } = await import('path');

      const dir = resolve(process.cwd(), 'prompts', '新品上市', 'M1_overview');
      const testFile = resolve(dir, 'test_null.yaml');

      try {
        writeFileSync(testFile, '~');
        expect(() => loadTemplate('新品上市', 'M1', 'test_null' as any)).toThrow(
          /parsed content is not an object/,
        );
      } finally {
        try { unlinkSync(testFile); } catch { /* ignore */ }
      }
    });

    it('should throw for YAML missing required fields', async () => {
      const { writeFileSync, unlinkSync } = await import('fs');
      const { resolve } = await import('path');

      const dir = resolve(process.cwd(), 'prompts', '新品上市', 'M1_overview');
      const testFile = resolve(dir, 'test_missing.yaml');

      try {
        writeFileSync(testFile, 'name: "test"\nversion: "1.0.0"\n');
        expect(() => loadTemplate('新品上市', 'M1', 'test_missing' as any)).toThrow(
          /missing required fields/,
        );
      } finally {
        try { unlinkSync(testFile); } catch { /* ignore */ }
      }
    });

    it('should list all missing fields in the error message', async () => {
      const { writeFileSync, unlinkSync } = await import('fs');
      const { resolve } = await import('path');

      const dir = resolve(process.cwd(), 'prompts', '新品上市', 'M1_overview');
      const testFile = resolve(dir, 'test_fields.yaml');

      try {
        writeFileSync(testFile, 'name: "test"\nversion: "1.0.0"\n');
        try {
          loadTemplate('新品上市', 'M1', 'test_fields' as any);
        } catch (err: any) {
          expect(err.message).toContain('projectType');
          expect(err.message).toContain('moduleId');
          expect(err.message).toContain('toneIntensity');
          expect(err.message).toContain('prompt');
          expect(err.message).toContain('variables');
          expect(err.message).toContain('fallbackText');
        }
      } finally {
        try { unlinkSync(testFile); } catch { /* ignore */ }
      }
    });

    it('should throw for empty prompt string', async () => {
      const { writeFileSync, unlinkSync } = await import('fs');
      const { resolve } = await import('path');

      const dir = resolve(process.cwd(), 'prompts', '新品上市', 'M1_overview');
      const testFile = resolve(dir, 'test_empty_prompt.yaml');

      const content = [
        'name: "test"',
        'version: "1.0.0"',
        'projectType: "新品上市"',
        'moduleId: "M1"',
        'toneIntensity: "positive"',
        'prompt: ""',
        'variables: [a, b]',
        'fallbackText: "fallback"',
      ].join('\n');

      try {
        writeFileSync(testFile, content);
        expect(() => loadTemplate('新品上市', 'M1', 'test_empty_prompt' as any)).toThrow(
          /'prompt' must be a non-empty string/,
        );
      } finally {
        try { unlinkSync(testFile); } catch { /* ignore */ }
      }
    });

    it('should throw for non-array variables', async () => {
      const { writeFileSync, unlinkSync } = await import('fs');
      const { resolve } = await import('path');

      const dir = resolve(process.cwd(), 'prompts', '新品上市', 'M1_overview');
      const testFile = resolve(dir, 'test_bad_vars.yaml');

      const content = [
        'name: "test"',
        'version: "1.0.0"',
        'projectType: "新品上市"',
        'moduleId: "M1"',
        'toneIntensity: "positive"',
        'prompt: "some prompt"',
        'variables: "not an array"',
        'fallbackText: "fallback"',
      ].join('\n');

      try {
        writeFileSync(testFile, content);
        expect(() => loadTemplate('新品上市', 'M1', 'test_bad_vars' as any)).toThrow(
          /'variables' must be an array/,
        );
      } finally {
        try { unlinkSync(testFile); } catch { /* ignore */ }
      }
    });

    it('should throw for empty fallbackText', async () => {
      const { writeFileSync, unlinkSync } = await import('fs');
      const { resolve } = await import('path');

      const dir = resolve(process.cwd(), 'prompts', '新品上市', 'M1_overview');
      const testFile = resolve(dir, 'test_empty_fallback.yaml');

      const content = [
        'name: "test"',
        'version: "1.0.0"',
        'projectType: "新品上市"',
        'moduleId: "M1"',
        'toneIntensity: "positive"',
        'prompt: "some prompt"',
        'variables: [a, b]',
        'fallbackText: "   "',
      ].join('\n');

      try {
        writeFileSync(testFile, content);
        expect(() => loadTemplate('新品上市', 'M1', 'test_empty_fallback' as any)).toThrow(
          /'fallbackText' must be a non-empty string/,
        );
      } finally {
        try { unlinkSync(testFile); } catch { /* ignore */ }
      }
    });
  });

  describe('MODULE_SUFFIXES constant', () => {
    it('should map all 8 module IDs to directory names', () => {
      expect(Object.keys(MODULE_SUFFIXES)).toHaveLength(8);
      expect(MODULE_SUFFIXES.M1).toBe('M1_overview');
      expect(MODULE_SUFFIXES.M2).toBe('M2_review');
      expect(MODULE_SUFFIXES.M3).toBe('M3_highlights');
      expect(MODULE_SUFFIXES.M4).toBe('M4_underperform');
      expect(MODULE_SUFFIXES.M5).toBe('M5_content');
      expect(MODULE_SUFFIXES.M6).toBe('M6_competitor');
      expect(MODULE_SUFFIXES.M7).toBe('M7_traffic');
      expect(MODULE_SUFFIXES.M8).toBe('M8_diagnosis');
    });
  });
});


describe('Narrative Engine — selectTone', () => {
  it('should return "positive" for rating S', () => {
    expect(selectTone('S')).toBe('positive');
  });

  it('should return "positive" for rating A', () => {
    expect(selectTone('A')).toBe('positive');
  });

  it('should return "standard" for rating B', () => {
    expect(selectTone('B')).toBe('standard');
  });

  it('should return "conservative" for rating C', () => {
    expect(selectTone('C')).toBe('conservative');
  });

  it('should return "conservative" for rating D', () => {
    expect(selectTone('D')).toBe('conservative');
  });
});

describe('Narrative Engine — ATTRIBUTION_STRATEGIES', () => {
  it('should map 新品上市 to 市场突破 and 用户认知建立', () => {
    expect(ATTRIBUTION_STRATEGIES['新品上市']).toEqual(['市场突破', '用户认知建立']);
  });

  it('should map 日常种草 to 持续渗透 and 口碑积累', () => {
    expect(ATTRIBUTION_STRATEGIES['日常种草']).toEqual(['持续渗透', '口碑积累']);
  });

  it('should map 节点营销 to 节点爆发 and 流量转化', () => {
    expect(ATTRIBUTION_STRATEGIES['节点营销']).toEqual(['节点爆发', '流量转化']);
  });

  it('should map 竞品防御 to 份额保卫 and 差异化优势', () => {
    expect(ATTRIBUTION_STRATEGIES['竞品防御']).toEqual(['份额保卫', '差异化优势']);
  });

  it('should have exactly 4 project types', () => {
    expect(Object.keys(ATTRIBUTION_STRATEGIES)).toHaveLength(4);
  });
});

describe('Narrative Engine — getAttributionStrategies', () => {
  it('should return strategies for 新品上市', () => {
    const strategies = getAttributionStrategies('新品上市');
    expect(strategies).toContain('市场突破');
    expect(strategies).toContain('用户认知建立');
  });

  it('should return strategies for 日常种草', () => {
    const strategies = getAttributionStrategies('日常种草');
    expect(strategies).toContain('持续渗透');
    expect(strategies).toContain('口碑积累');
  });

  it('should return strategies for 节点营销', () => {
    const strategies = getAttributionStrategies('节点营销');
    expect(strategies).toContain('节点爆发');
    expect(strategies).toContain('流量转化');
  });

  it('should return strategies for 竞品防御', () => {
    const strategies = getAttributionStrategies('竞品防御');
    expect(strategies).toContain('份额保卫');
    expect(strategies).toContain('差异化优势');
  });

  it('should return exactly 2 strategies per project type', () => {
    expect(getAttributionStrategies('新品上市')).toHaveLength(2);
    expect(getAttributionStrategies('日常种草')).toHaveLength(2);
    expect(getAttributionStrategies('节点营销')).toHaveLength(2);
    expect(getAttributionStrategies('竞品防御')).toHaveLength(2);
  });
});


// ============================================================
// Tests for Task 3.3: substituteVariables, generateNarrative, regenerateParagraph
// ============================================================

describe('Narrative Engine — substituteVariables', () => {
  it('should replace known variables with their values', () => {
    const prompt = '项目名称: {{project_name}}, 曝光量: {{total_impressions}}';
    const variables = { project_name: '测试项目', total_impressions: '100000' };
    const result = substituteVariables(prompt, variables);
    expect(result).toBe('项目名称: 测试项目, 曝光量: 100000');
  });

  it('should leave unrecognized placeholders unchanged', () => {
    const prompt = '{{known}} and {{unknown}}';
    const variables = { known: 'replaced' };
    const result = substituteVariables(prompt, variables);
    expect(result).toBe('replaced and {{unknown}}');
  });

  it('should handle empty variables record', () => {
    const prompt = '{{a}} {{b}}';
    const result = substituteVariables(prompt, {});
    expect(result).toBe('{{a}} {{b}}');
  });

  it('should handle prompt with no placeholders', () => {
    const prompt = 'No variables here';
    const result = substituteVariables(prompt, { a: '1' });
    expect(result).toBe('No variables here');
  });

  it('should handle multiple occurrences of the same variable', () => {
    const prompt = '{{x}} and {{x}} again';
    const result = substituteVariables(prompt, { x: 'val' });
    expect(result).toBe('val and val again');
  });

  it('should handle empty string values', () => {
    const prompt = 'Value: {{v}}';
    const result = substituteVariables(prompt, { v: '' });
    expect(result).toBe('Value: ');
  });
});

describe('Narrative Engine — generateNarrative', () => {
  let mockLLMClient: LLMClient;

  const baseRequest: NarrativeRequest = {
    projectType: '新品上市',
    moduleId: 'M1',
    metricRatings: [
      {
        metricName: 'impressions',
        isCostMetric: false,
        dimensions: [],
        finalRating: 'A',
      },
    ],
    toneIntensity: 'positive',
    dataContext: {
      project_name: '测试项目',
      total_impressions: '500000',
      kpi_completion_rate: '135%',
    },
  };

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn(),
    };
    setLLMClient(mockLLMClient);
  });

  afterEach(() => {
    setLLMClient(null);
  });

  it('should generate narrative with variable substitution on LLM success', async () => {
    const llmResponse = '第一段叙事文案，表现优异。\n\n第二段叙事文案，超额完成。';
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(llmResponse);

    const result = await generateNarrative(baseRequest);

    expect(result.moduleId).toBe('M1');
    expect(result.toneUsed).toBe('positive');
    expect(result.attributionUsed).toBe('市场突破');
    expect(result.paragraphs).toHaveLength(2);
    expect(result.paragraphs[0].content).toBe('第一段叙事文案，表现优异。');
    expect(result.paragraphs[1].content).toBe('第二段叙事文案，超额完成。');
    expect(result.paragraphs[0].tone).toBe('positive');
    expect(result.paragraphs[0].isTransformed).toBe(false);
    expect(result.paragraphs[0].id).toBeTruthy();
  });

  it('should pass substituted prompt to LLM client', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('响应内容');

    await generateNarrative(baseRequest);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = chatCall[0];
    // The prompt should have variables substituted
    expect(messages[0].content).not.toContain('{{project_name}}');
    expect(messages[0].content).toContain('测试项目');
  });

  it('should call LLM with 30s timeout', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('响应');

    await generateNarrative(baseRequest);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = chatCall[1];
    expect(options.timeout).toBe(30_000);
  });

  it('should fallback to template fallbackText on LLM failure', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM error'));

    const result = await generateNarrative(baseRequest);

    expect(result.paragraphs).toHaveLength(1);
    // The fallback text comes from the YAML template
    expect(result.paragraphs[0].content).toBeTruthy();
    expect(result.paragraphs[0].tone).toBe('positive');
    expect(result.moduleId).toBe('M1');
  });

  it('should fallback to template fallbackText on LLM timeout', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Request timed out'),
    );

    const result = await generateNarrative(baseRequest);

    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].content).toBeTruthy();
    expect(result.toneUsed).toBe('positive');
  });

  it('should fallback when LLM client is not configured', async () => {
    setLLMClient(null);

    const result = await generateNarrative(baseRequest);

    expect(result.paragraphs).toHaveLength(1);
    expect(result.paragraphs[0].content).toBeTruthy();
  });

  it('should use specified attributionStrategy when provided', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('内容');

    const requestWithAttribution: NarrativeRequest = {
      ...baseRequest,
      attributionStrategy: '用户认知建立',
    };

    const result = await generateNarrative(requestWithAttribution);
    expect(result.attributionUsed).toBe('用户认知建立');
  });

  it('should default to first attribution strategy when not specified', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('内容');

    const result = await generateNarrative(baseRequest);
    expect(result.attributionUsed).toBe('市场突破');
  });

  it('should include related metrics from request', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('段落内容');

    const result = await generateNarrative(baseRequest);

    expect(result.paragraphs[0].relatedMetrics).toContain('impressions');
  });
});

describe('Narrative Engine — regenerateParagraph', () => {
  let mockLLMClient: LLMClient;

  const baseContext: NarrativeRequest = {
    projectType: '新品上市',
    moduleId: 'M1',
    metricRatings: [
      {
        metricName: 'cpe',
        isCostMetric: true,
        dimensions: [],
        finalRating: 'B',
      },
    ],
    toneIntensity: 'positive',
    dataContext: {
      project_name: '再生成测试',
      total_impressions: '200000',
      kpi_completion_rate: '105%',
    },
  };

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn(),
    };
    setLLMClient(mockLLMClient);
  });

  afterEach(() => {
    setLLMClient(null);
  });

  it('should regenerate paragraph with new tone on LLM success', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(
      '使用积极语气重新生成的段落。',
    );

    const result = await regenerateParagraph('old-id', 'positive', baseContext);

    expect(result.tone).toBe('positive');
    expect(result.content).toBe('使用积极语气重新生成的段落。');
    expect(result.id).toBeTruthy();
    expect(result.id).not.toBe('old-id'); // New ID generated
    expect(result.isTransformed).toBe(false);
    expect(result.relatedMetrics).toContain('cpe');
  });

  it('should fallback to template text on LLM failure', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM down'));

    const result = await regenerateParagraph('old-id', 'positive', baseContext);

    expect(result.tone).toBe('positive');
    expect(result.content).toBeTruthy();
    expect(result.relatedMetrics).toContain('cpe');
  });

  it('should use the first paragraph from multi-paragraph LLM response', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(
      '第一段内容。\n\n第二段内容。',
    );

    const result = await regenerateParagraph('old-id', 'positive', baseContext);

    expect(result.content).toBe('第一段内容。');
  });

  it('should call LLM with 30s timeout', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('内容');

    await regenerateParagraph('old-id', 'positive', baseContext);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = chatCall[1];
    expect(options.timeout).toBe(30_000);
  });

  it('should fallback when LLM client is not configured', async () => {
    setLLMClient(null);

    const result = await regenerateParagraph('old-id', 'positive', baseContext);

    expect(result.content).toBeTruthy();
    expect(result.tone).toBe('positive');
  });
});


// ============================================================
// Tests for Task 3.4: transformProblemToOpportunity
// ============================================================

describe('Narrative Engine — transformProblemToOpportunity', () => {
  let mockLLMClient: LLMClient;

  const baseContext: NarrativeRequest = {
    projectType: '新品上市',
    moduleId: 'M4',
    metricRatings: [
      {
        metricName: 'cpe',
        isCostMetric: true,
        dimensions: [],
        finalRating: 'D',
      },
    ],
    toneIntensity: 'conservative',
    dataContext: {
      project_name: '转换测试项目',
      total_impressions: '50000',
      kpi_completion_rate: '65%',
    },
  };

  const inputParagraph = {
    id: 'original-paragraph-id',
    content: 'CPE表现不佳，实际值远高于KPI目标，成本控制未达预期。',
    tone: 'conservative' as const,
    relatedMetrics: ['cpe'],
    isTransformed: false,
  };

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn(),
    };
    setLLMClient(mockLLMClient);
  });

  afterEach(() => {
    setLLMClient(null);
  });

  it('should transform paragraph content on LLM success', async () => {
    const transformedText = 'CPE存在优化空间，通过精细化投放策略可进一步降低获客成本，提升投放效率。';
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(transformedText);

    const result = await transformProblemToOpportunity(inputParagraph, baseContext);

    expect(result.content).toBe(transformedText);
    expect(result.isTransformed).toBe(true);
    expect(result.tone).toBe('conservative');
    expect(result.relatedMetrics).toEqual(['cpe']);
    expect(result.id).toBeTruthy();
    expect(result.id).not.toBe('original-paragraph-id');
  });

  it('should return original content with isTransformed=true on LLM failure', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM error'));

    const result = await transformProblemToOpportunity(inputParagraph, baseContext);

    expect(result.content).toBe(inputParagraph.content);
    expect(result.isTransformed).toBe(true);
    expect(result.tone).toBe('conservative');
    expect(result.relatedMetrics).toEqual(['cpe']);
  });

  it('should always set isTransformed to true in the output', async () => {
    // Test with LLM success
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('改进方向文案');
    const successResult = await transformProblemToOpportunity(inputParagraph, baseContext);
    expect(successResult.isTransformed).toBe(true);

    // Test with LLM failure
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
    const failResult = await transformProblemToOpportunity(inputParagraph, baseContext);
    expect(failResult.isTransformed).toBe(true);

    // Test with LLM client not configured
    setLLMClient(null);
    const noClientResult = await transformProblemToOpportunity(inputParagraph, baseContext);
    expect(noClientResult.isTransformed).toBe(true);
  });

  it('should call LLM with 30s timeout', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('转换后内容');

    await transformProblemToOpportunity(inputParagraph, baseContext);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = chatCall[1];
    expect(options.timeout).toBe(30_000);
  });

  it('should use first paragraph from multi-paragraph LLM response', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(
      '第一段转换内容。\n\n第二段不应使用。',
    );

    const result = await transformProblemToOpportunity(inputParagraph, baseContext);

    expect(result.content).toBe('第一段转换内容。');
  });

  it('should fallback when LLM client is not configured', async () => {
    setLLMClient(null);

    const result = await transformProblemToOpportunity(inputParagraph, baseContext);

    expect(result.content).toBe(inputParagraph.content);
    expect(result.isTransformed).toBe(true);
  });

  it('should generate a new UUID for the transformed paragraph on success', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('新内容');

    const result = await transformProblemToOpportunity(inputParagraph, baseContext);

    expect(result.id).not.toBe(inputParagraph.id);
    // UUID format check
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('should include transformation instructions in the LLM prompt', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('转换内容');

    await transformProblemToOpportunity(inputParagraph, baseContext);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = chatCall[0];
    const promptContent = messages[0].content;

    // Verify the prompt contains the original content and transformation instructions
    expect(promptContent).toContain(inputParagraph.content);
    expect(promptContent).toContain('改进机会');
  });
});


// ============================================================
// Tests for Task 3.5: AI Chat Function
// ============================================================

import {
  chat,
  buildChatSystemPrompt,
  CHAT_FALLBACK_MESSAGE,
} from '@/engines/narrative';
import { MODULE_NAMES } from '@/engines/types';

describe('Narrative Engine — chat', () => {
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    mockLLMClient = {
      chat: vi.fn(),
    };
    setLLMClient(mockLLMClient);
  });

  afterEach(() => {
    setLLMClient(null);
  });

  it('should return LLM response on successful chat', async () => {
    const expectedResponse = '该指标表现优异，主要归因于精准的人群定向策略。';
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResponse);

    const messages = [{ role: 'user' as const, content: '为什么CPE表现这么好？' }];
    const context = { projectId: 'proj-123' };

    const result = await chat(messages, context);

    expect(result).toBe(expectedResponse);
  });

  it('should pass full message history to LLM client', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('回答');

    const messages = [
      { role: 'user' as const, content: '项目整体表现如何？' },
      { role: 'assistant' as const, content: '项目整体表现良好，多数指标达标。' },
      { role: 'user' as const, content: '具体哪些指标超预期？' },
    ];
    const context = { projectId: 'proj-456', moduleId: 'M3' as const };

    await chat(messages, context);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedMessages = chatCall[0];

    // First message should be system prompt
    expect(passedMessages[0].role).toBe('system');
    // Remaining messages should be the user conversation
    expect(passedMessages[1]).toEqual({ role: 'user', content: '项目整体表现如何？' });
    expect(passedMessages[2]).toEqual({ role: 'assistant', content: '项目整体表现良好，多数指标达标。' });
    expect(passedMessages[3]).toEqual({ role: 'user', content: '具体哪些指标超预期？' });
    expect(passedMessages).toHaveLength(4); // 1 system + 3 user/assistant
  });

  it('should return fallback message on LLM failure', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('LLM service unavailable'));

    const messages = [{ role: 'user' as const, content: '分析一下数据' }];
    const context = { projectId: 'proj-789' };

    const result = await chat(messages, context);

    expect(result).toBe(CHAT_FALLBACK_MESSAGE);
    expect(result).toBe('抱歉，AI助手暂时无法响应，请稍后重试。');
  });

  it('should return fallback message when LLM client is not configured', async () => {
    setLLMClient(null);

    const messages = [{ role: 'user' as const, content: '你好' }];
    const context = { projectId: 'proj-000' };

    const result = await chat(messages, context);

    expect(result).toBe(CHAT_FALLBACK_MESSAGE);
  });

  it('should include projectId in system prompt', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('回答');

    const messages = [{ role: 'user' as const, content: '问题' }];
    const context = { projectId: 'proj-abc-123' };

    await chat(messages, context);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const systemMessage = chatCall[0][0];
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.content).toContain('proj-abc-123');
  });

  it('should include moduleId in system prompt when provided', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('回答');

    const messages = [{ role: 'user' as const, content: '问题' }];
    const context = { projectId: 'proj-xyz', moduleId: 'M5' as const };

    await chat(messages, context);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const systemMessage = chatCall[0][0];
    expect(systemMessage.content).toContain('M5');
    expect(systemMessage.content).toContain(MODULE_NAMES['M5']);
  });

  it('should call LLM with 30s timeout', async () => {
    (mockLLMClient.chat as ReturnType<typeof vi.fn>).mockResolvedValue('回答');

    const messages = [{ role: 'user' as const, content: '问题' }];
    const context = { projectId: 'proj-timeout' };

    await chat(messages, context);

    const chatCall = (mockLLMClient.chat as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = chatCall[1];
    expect(options.timeout).toBe(30_000);
  });
});

describe('Narrative Engine — buildChatSystemPrompt', () => {
  it('should include projectId in the system prompt', () => {
    const prompt = buildChatSystemPrompt({ projectId: 'test-project-id' });
    expect(prompt).toContain('test-project-id');
  });

  it('should include moduleId and module name when provided', () => {
    const prompt = buildChatSystemPrompt({ projectId: 'proj-1', moduleId: 'M3' });
    expect(prompt).toContain('M3');
    expect(prompt).toContain('项目亮点');
  });

  it('should indicate no focused module when moduleId is not provided', () => {
    const prompt = buildChatSystemPrompt({ projectId: 'proj-1' });
    expect(prompt).toContain('当前未聚焦特定模块');
  });

  it('should establish the AI as a marketing review expert', () => {
    const prompt = buildChatSystemPrompt({ projectId: 'proj-1' });
    expect(prompt).toContain('小红书营销复盘专家');
  });

  it('should mention attribution analysis capability', () => {
    const prompt = buildChatSystemPrompt({ projectId: 'proj-1' });
    expect(prompt).toContain('归因分析');
  });

  it('should mention data query capability', () => {
    const prompt = buildChatSystemPrompt({ projectId: 'proj-1' });
    expect(prompt).toContain('数据查询');
  });

  it('should mention optimization suggestions capability', () => {
    const prompt = buildChatSystemPrompt({ projectId: 'proj-1' });
    expect(prompt).toContain('优化建议');
  });
});
