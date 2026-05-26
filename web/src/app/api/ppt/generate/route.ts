import { NextRequest, NextResponse } from 'next/server';
import { presentonClient } from '@/lib/presenton-client';
import { getSession } from '@/lib/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * POST /api/ppt/generate
 * 
 * 将复盘报告内容发送给 Presenton（内部服务 localhost:8000）生成 PPT。
 * 
 * 流程：
 * 1. JWT 验证（通过 getSession）
 * 2. 接收前端传来的 modules 数据
 * 3. 读取 复盘报告模版分析.md 作为生成指引
 * 4. 组装完整的 content（包含数据表格、KPI等）
 * 5. 调用 Presenton API 生成 PPT（不带 auth headers，内部服务无需认证）
 * 
 * 注意：Presenton 生成是同步阻塞的，通常需要 2-5 分钟。
 */
export const maxDuration = 300;

// 加载模版规范（精简版，避免 instructions 过长导致超时）
let templateInstructions = '';
try {
  const fullDoc = readFileSync(join(process.cwd(), '..', 'docs', '复盘报告模版分析.md'), 'utf-8');
  // 只提取"第四章 基础PPT模版规范"中的章节结构表格部分
  const match = fullDoc.match(/### 模版章节详细规范[\s\S]*?(?=### 各章节详细内容规范)/);
  templateInstructions = match ? match[0] : '';
} catch {
  try {
    const fullDoc = readFileSync(join(process.cwd(), 'docs', '复盘报告模版分析.md'), 'utf-8');
    const match = fullDoc.match(/### 模版章节详细规范[\s\S]*?(?=### 各章节详细内容规范)/);
    templateInstructions = match ? match[0] : '';
  } catch {
    // 文件不存在，使用内置指引
  }
}

// Mock 数据（当实际数据不足时补充）
const MOCK_DATA = {
  kpi: {
    总曝光: { kpi: '800w', actual: '857w+', completion: '107%' },
    总阅读: { kpi: '150w', actual: '153w+', completion: '102%' },
    总互动: { kpi: '10w', actual: '13w+', completion: '130%' },
    CPE: { kpi: '3.5', actual: '2.27', completion: '154%' },
    CPM: { kpi: '45', actual: '34.2', completion: '132%' },
    CPC: { kpi: '0.35', actual: '0.2', completion: '175%' },
    爆文率: { kpi: '30%', actual: '59%', completion: '197%' },
  },
  benchmark: { CPM: '45-68', CPC: '0.29-0.45', CPE: '3.95-6.06', CTR: '7.33%-11.04%' },
  contentAnalysis: [
    { direction: '产品直推', count: 35, impressions: '320w', reads: '58w', engagement: '4.8w', ti: '28w', cpti: '0.72', cpe: '4.21', viralCount: 12, viralRate: '34%' },
    { direction: '食欲氛围感', count: 22, impressions: '280w', reads: '52w', engagement: '4.2w', ti: '25w', cpti: '0.65', cpe: '3.85', viralCount: 15, viralRate: '68%' },
    { direction: '热点创意', count: 18, impressions: '180w', reads: '30w', engagement: '3.1w', ti: '18w', cpti: '0.89', cpe: '2.58', viralCount: 15, viralRate: '83%' },
    { direction: '测评种草', count: 12, impressions: '55w', reads: '9w', engagement: '0.7w', ti: '5w', cpti: '1.2', cpe: '8.57', viralCount: 3, viralRate: '25%' },
  ],
  tierAnalysis: [
    { tier: 'KOC(<1w粉)', count: 45, impressions: '180w', reads: '32w', engagement: '2.5w', ti: '15w', cpti: '0.45', cpe: '5.4', viralCount: 8, viralRate: '18%' },
    { tier: '尾部(1-5w粉)', count: 32, impressions: '380w', reads: '68w', engagement: '5.8w', ti: '35w', cpti: '0.72', cpe: '3.45', viralCount: 18, viralRate: '56%' },
    { tier: '腰部(5-50w粉)', count: 15, impressions: '220w', reads: '40w', engagement: '3.8w', ti: '22w', cpti: '1.05', cpe: '6.08', viralCount: 12, viralRate: '80%' },
  ],
  trafficOverview: { totalSpend: '152,680', impressions: '4,850,000', clicks: '562,000', engagement: '89,500', ctr: '11.59%', cpc: '0.27', cpm: '31.48', cpe: '1.71' },
  trafficByType: [
    { type: '信息流', spend: '98,500', impressions: '3,200,000', clicks: '384,000', engagement: '52,000', cpm: '30.78', cpc: '0.26', cpe: '1.89', ctr: '12.0%' },
    { type: '视频流', spend: '35,200', impressions: '980,000', clicks: '112,000', engagement: '28,500', cpm: '35.92', cpc: '0.31', cpe: '1.24', ctr: '11.43%' },
    { type: '搜索', spend: '18,980', impressions: '670,000', clicks: '66,000', engagement: '9,000', cpm: '28.33', cpc: '0.29', cpe: '2.11', ctr: '9.85%' },
  ],
};

export async function POST(request: NextRequest) {
  // 1. JWT 验证
  const session = await getSession(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      projectName,
      brand,
      category,
      modules,
      n_slides,
      language = '中文',
      tone = 'professional',
    } = body;

    if (!projectName) {
      return NextResponse.json({ error: '缺少 projectName' }, { status: 400 });
    }

    // 组装完整的 PPT 内容（包含数据）
    const content = buildFullContent(projectName, brand, category, modules);

    // 构建 instructions
    const instructions = buildInstructions(brand, category);

    // Use the three-step flow: create → outlines → prepare
    // Then the PPT editor can stream slide generation
    const PRESENTON_URL = process.env.PRESENTON_INTERNAL_URL || 'http://localhost:8000';

    // Step 1: Create presentation record
    const createRes = await fetch(`${PRESENTON_URL}/api/v1/ppt/presentation/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        n_slides: n_slides || 15,
        language,
        tone: tone || 'professional',
        verbosity: 'standard',
        instructions,
        include_title_slide: true,
        include_table_of_contents: false,
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text().catch(() => 'Presenton create failed');
      throw new Error(`Presenton create error (${createRes.status}): ${errorText}`);
    }

    const presentationRecord = await createRes.json();
    const presentationId = presentationRecord.id;

    // Step 2: Generate outlines via SSE stream (consume the stream to completion)
    const outlinesRes = await fetch(`${PRESENTON_URL}/api/v1/ppt/outlines/stream/${presentationId}`, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
    });

    if (!outlinesRes.ok) {
      const errorText = await outlinesRes.text().catch(() => 'Outlines generation failed');
      throw new Error(`Presenton outlines error (${outlinesRes.status}): ${errorText}`);
    }

    // Parse SSE stream to extract the presentation data (which includes outlines)
    const outlinesBody = await outlinesRes.text();
    let outlines: Array<{ content: string; title?: string }> = [];
    let presentationTitle = '';

    // SSE format: "event: response\ndata: {json}\n\n"
    const sseLines = outlinesBody.split('\n');
    for (const line of sseLines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6); // Remove "data: " prefix
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === 'complete' && parsed.presentation) {
          // The complete event contains the full presentation record with outlines
          const presData = parsed.presentation;
          if (presData.outlines?.slides) {
            outlines = presData.outlines.slides;
          }
          if (presData.title) {
            presentationTitle = presData.title;
          }
        }
      } catch {
        // Skip non-JSON or malformed events
      }
    }

    if (outlines.length === 0) {
      // Check if there was an error in the stream
      for (const line of sseLines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === 'error') {
            throw new Error(`Outline generation failed: ${parsed.detail}`);
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Outline generation')) throw e;
        }
      }
      throw new Error('Failed to generate presentation outlines - no outlines received');
    }

    // Step 3: Prepare the presentation with a minimal layout
    // We construct a basic layout inline to avoid needing the export runtime
    // or Next.js template API for schema extraction.
    const minimalLayout = {
      name: 'general',
      ordered: false,
      icon_weight: 'regular',
      slides: [
        {
          id: 'general:intro-slide',
          name: 'Intro Slide',
          description: 'A clean slide with title, description, and presenter info',
          json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Main title of the slide' },
              description: { type: 'string', description: 'Main description text' },
              presenterName: { type: 'string', description: 'Presenter name' },
              presentationDate: { type: 'string', description: 'Date of presentation' },
            },
          },
        },
        {
          id: 'general:bullet-with-icons',
          name: 'Bullet Points with Icons',
          description: 'Slide with bullet points and icons',
          json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Section title' },
              bullets: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, icon: { type: 'string' } } }, description: 'List of bullet points' },
            },
          },
        },
        {
          id: 'general:basic-info',
          name: 'Basic Info',
          description: 'Simple text content slide',
          json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Slide title' },
              content: { type: 'string', description: 'Main content text' },
            },
          },
        },
        {
          id: 'general:metrics',
          name: 'Metrics',
          description: 'Slide showing key metrics/numbers',
          json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Section title' },
              metrics: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' }, description: { type: 'string' } } }, description: 'Key metrics to display' },
            },
          },
        },
        {
          id: 'general:chart-with-bullets',
          name: 'Chart with Bullets',
          description: 'Slide with a chart and bullet points',
          json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Chart title' },
              chartData: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } } }, description: 'Chart data points' },
              bullets: { type: 'array', items: { type: 'string' }, description: 'Key takeaways' },
            },
          },
        },
        {
          id: 'general:table-info',
          name: 'Table',
          description: 'Slide with tabular data',
          json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Table title' },
              headers: { type: 'array', items: { type: 'string' }, description: 'Column headers' },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Table rows' },
            },
          },
        },
        {
          id: 'general:numbered-bullets',
          name: 'Numbered Bullets',
          description: 'Slide with numbered list items',
          json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Section title' },
              items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } } }, description: 'Numbered items' },
            },
          },
        },
      ],
    };

    // Call prepare with outlines and the minimal layout
    const prepareRes = await fetch(`${PRESENTON_URL}/api/v1/ppt/presentation/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presentation_id: presentationId,
        outlines,
        layout: minimalLayout,
        title: presentationTitle || projectName,
      }),
    });

    if (!prepareRes.ok) {
      const errorText = await prepareRes.text().catch(() => 'Prepare failed');
      throw new Error(`Presenton prepare error (${prepareRes.status}): ${errorText}`);
    }

    return NextResponse.json({
      presentationId,
      editUrl: `/review/${body.reviewId || ''}/ppt-editor/${presentationId}`,
    });
  } catch (error: unknown) {
    console.error('PPT generation failed:', error);
    const message = error instanceof Error ? error.message : 'PPT 生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * 构建 instructions（精简版，避免过长导致超时）
 */
function buildInstructions(brand: string, category: string): string {
  const base = `你是小红书营销项目复盘报告PPT生成助手。品牌: ${brand}, 品类: ${category}。

## PPT章节结构（共15页左右）
1. 封面（1页）：品牌名+项目名+时间
2. 项目回顾（1-2页）：项目背景+传播节奏
3. 数据总览（2页）：KPI完成率卡片+大盘对比
4. 项目亮点（1-2页）：核心亮点数据
5. 内容分析（3-4页）：内容方向表格+达人层级表格+解读
6. 投流分析（2-3页）：投流总览+广告类型+解读
7. 优化建议（1-2页）：分维度建议
8. 尾页（1页）

## 展示规范
- KPI用卡片展示：目标值/实际达成/完成率
- 内容分析表格列：内容方向|篇数|曝光量|阅读量|互动量|TI人群|CPTI|CPE|爆文数|爆文率
- 投流表格列：广告类型|消费|展现量|点击量|互动量|CPM|CPC|CPE|CTR
- 每个数据模块后配1-2句解读
- 专业商务风格`;

  if (templateInstructions) {
    return base + '\n\n## 参考模版结构\n' + templateInstructions.substring(0, 1500);
  }
  return base;
}

/**
 * 将 modules 数据组装为完整的 Presenton content
 * 当实际数据不足时，用 mock 数据补充
 */
function buildFullContent(
  projectName: string,
  brand: string,
  category: string,
  modules: Record<string, { status?: string; paragraphs?: Array<{ content: string }>; tables?: Array<{ title?: string; headers: string[]; rows: string[][] }> }>
): string {
  const sections: string[] = [];

  sections.push(`# ${projectName} - 小红书种草项目复盘`);
  sections.push(`品牌: ${brand} | 品类: ${category}`);
  sections.push('');

  // M2: 项目回顾
  sections.push('## 项目回顾');
  const m2 = modules?.M2;
  if (m2?.paragraphs?.length) {
    for (const p of m2.paragraphs) sections.push(p.content);
  } else {
    sections.push(`${brand}本次在小红书平台开展新品种草营销项目，通过达人合作+投流组合策略，实现品牌声量提升和产品种草转化。`);
  }
  sections.push('');

  // M1: 数据总览（核心，必须有数据）
  sections.push('## 数据总览');
  const m1 = modules?.M1;
  if (m1?.paragraphs?.length) {
    for (const p of m1.paragraphs) sections.push(p.content);
  }
  // 补充 KPI 数据表格
  if (m1?.tables?.length) {
    for (const table of m1.tables) {
      if (table.title) sections.push(`### ${table.title}`);
      sections.push(`| ${table.headers.join(' | ')} |`);
      sections.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
      for (const row of table.rows) sections.push(`| ${row.join(' | ')} |`);
    }
  } else {
    // 使用 mock KPI 数据
    sections.push('### KPI完成概况');
    sections.push('| 指标 | KPI目标 | 实际达成 | 完成率 |');
    sections.push('| --- | --- | --- | --- |');
    for (const [metric, data] of Object.entries(MOCK_DATA.kpi)) {
      sections.push(`| ${metric} | ${data.kpi} | ${data.actual} | ${data.completion} |`);
    }
    sections.push('');
    sections.push('### 大盘对比');
    sections.push(`行业大盘参考：CPM ${MOCK_DATA.benchmark.CPM}，CPC ${MOCK_DATA.benchmark.CPC}，CPE ${MOCK_DATA.benchmark.CPE}，CTR ${MOCK_DATA.benchmark.CTR}`);
    sections.push('本次投放各项指标均优于大盘。');
  }
  sections.push('');

  // M3: 项目亮点
  const m3 = modules?.M3;
  if (m3?.status === 'show' || m3?.paragraphs?.length) {
    sections.push('## 项目亮点');
    if (m3?.paragraphs?.length) {
      for (const p of m3.paragraphs) sections.push(p.content);
    } else {
      sections.push('- 各项KPI均超额完成，总互动完成率130%，CPE完成率154%');
      sections.push('- CPM/CPC/CPE全面优于行业大盘');
      sections.push('- 爆文率59%，远超KPI目标30%');
      sections.push('- 品牌搜索指数投放期间显著上升');
    }
    sections.push('');
  }

  // M5: 内容分析
  sections.push('## 内容分析');
  const m5 = modules?.M5;
  if (m5?.paragraphs?.length) {
    for (const p of m5.paragraphs) sections.push(p.content);
  }
  if (m5?.tables?.length) {
    for (const table of m5.tables) {
      if (table.title) sections.push(`### ${table.title}`);
      sections.push(`| ${table.headers.join(' | ')} |`);
      sections.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
      for (const row of table.rows) sections.push(`| ${row.join(' | ')} |`);
    }
  } else {
    // Mock 内容方向分析
    sections.push('### 内容方向分析');
    sections.push('| 内容方向 | 篇数 | 曝光量 | 阅读量 | 互动量 | TI人群 | CPTI | CPE | 爆文数 | 爆文率 |');
    sections.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const item of MOCK_DATA.contentAnalysis) {
      sections.push(`| ${item.direction} | ${item.count} | ${item.impressions} | ${item.reads} | ${item.engagement} | ${item.ti} | ${item.cpti} | ${item.cpe} | ${item.viralCount} | ${item.viralRate} |`);
    }
    sections.push('');
    sections.push('**解读：** 热点创意方向爆文率最高(83%)，食欲氛围感方向综合性价比最优。');
    sections.push('');

    // Mock 达人层级分析
    sections.push('### 达人层级分析');
    sections.push('| 达人层级 | 篇数 | 曝光量 | 阅读量 | 互动量 | TI人群 | CPTI | CPE | 爆文数 | 爆文率 |');
    sections.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const item of MOCK_DATA.tierAnalysis) {
      sections.push(`| ${item.tier} | ${item.count} | ${item.impressions} | ${item.reads} | ${item.engagement} | ${item.ti} | ${item.cpti} | ${item.cpe} | ${item.viralCount} | ${item.viralRate} |`);
    }
    sections.push('');
    sections.push('**解读：** 尾部达人性价比最优(CPTI 0.72, 爆文率56%)，腰部达人爆文率最高(80%)。');
  }
  sections.push('');

  // M7: 投流分析
  sections.push('## 投流分析');
  const m7 = modules?.M7;
  if (m7?.paragraphs?.length) {
    for (const p of m7.paragraphs) sections.push(p.content);
  }
  if (m7?.tables?.length) {
    for (const table of m7.tables) {
      if (table.title) sections.push(`### ${table.title}`);
      sections.push(`| ${table.headers.join(' | ')} |`);
      sections.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
      for (const row of table.rows) sections.push(`| ${row.join(' | ')} |`);
    }
  } else {
    // Mock 投流数据
    const t = MOCK_DATA.trafficOverview;
    sections.push('### 投流总览');
    sections.push(`总消耗: ¥${t.totalSpend} | 总展现: ${t.impressions} | 总点击: ${t.clicks} | 总互动: ${t.engagement}`);
    sections.push(`CTR: ${t.ctr} | CPC: ¥${t.cpc} | CPM: ¥${t.cpm} | CPE: ¥${t.cpe}`);
    sections.push('');
    sections.push('### 广告类型分析');
    sections.push('| 广告类型 | 消耗 | 展现量 | 点击量 | 互动量 | CPM | CPC | CPE | CTR |');
    sections.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const item of MOCK_DATA.trafficByType) {
      sections.push(`| ${item.type} | ¥${item.spend} | ${item.impressions} | ${item.clicks} | ${item.engagement} | ${item.cpm} | ${item.cpc} | ${item.cpe} | ${item.ctr} |`);
    }
    sections.push('');
    sections.push('**解读：** 信息流CPM/CPC最低，视频流CPE最低(1.24)，搜索场域进行品牌词防守。');
  }
  sections.push('');

  // M8: 优化建议
  sections.push('## 优化建议');
  const m8 = modules?.M8;
  if (m8?.paragraphs?.length) {
    for (const p of m8.paragraphs) sections.push(p.content);
  } else {
    sections.push('### 内容策略');
    sections.push('- 持续投放热点创意方向，爆文率验证了该方向的高效性');
    sections.push('- 增加视频类内容占比，视频爆文率(74%)远高于图文(32%)');
    sections.push('### 达人选择');
    sections.push('- 尾部达人作为主力投放层级，性价比最优');
    sections.push('- 腰部达人精选优质账号集中投放');
    sections.push('### 投流策略');
    sections.push('- 保持信息流:视频流:搜索 = 6:3:1的预算比例');
    sections.push('- 视频流对优质视频笔记加大投放');
  }

  return sections.join('\n');
}
