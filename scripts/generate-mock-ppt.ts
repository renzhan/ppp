/**
 * 生成 Mock 复盘报告数据并调用 Presenton 服务生成 PPT
 * 
 * 基于 docs/复盘报告模版分析.md 中定义的模版结构
 * Mock 数据模拟一个完整的小红书营销项目复盘报告
 * 
 * 使用方式: npx tsx scripts/generate-mock-ppt.ts
 */

const PRESENTON_BASE_URL = process.env.PRESENTON_BASE_URL || 'http://localhost:5000';

// ============================================================
// Mock 数据定义
// ============================================================

const mockProject = {
  projectName: '冠益乳巴马128小红书种草项目复盘',
  brand: '冠益乳',
  category: '乳制品-酸奶',
  spu: '巴马128益生菌酸奶',
  projectType: '新品上市',
  period: '2025.03.01 - 2025.04.30',
  phases: {
    预热期: '2025.03.01 - 2025.03.15',
    爆发期: '2025.03.16 - 2025.04.10',
    持续期: '2025.04.11 - 2025.04.30',
  },
};

const mockKPI = {
  总曝光: { kpi: '800w', actual: '857w+', completion: '107%' },
  总阅读: { kpi: '150w', actual: '153w+', completion: '102%' },
  总互动: { kpi: '10w', actual: '13w+', completion: '130%' },
  CPE: { kpi: '3.5', actual: '2.27', completion: '154%' },
  CPM: { kpi: '45', actual: '34.2', completion: '132%' },
  CPC: { kpi: '0.35', actual: '0.2', completion: '175%' },
  CTR: { kpi: '15%', actual: '17.8%', completion: '119%' },
  爆文率: { kpi: '30%', actual: '59%', completion: '197%' },
  CPTI: { kpi: '1.5', actual: '0.89', completion: '169%' },
};

const mockBenchmark = {
  CPM: { actual: 34.2, benchmark: '45-68', status: '优于大盘' },
  CPC: { actual: 0.2, benchmark: '0.29-0.45', status: '优于大盘' },
  CPE: { actual: 2.27, benchmark: '3.95-6.06', status: '优于大盘' },
  CTR: { actual: '17.8%', benchmark: '7.33%-11.04%', status: '优于大盘' },
};

const mockContentAnalysis = {
  内容方向: [
    { direction: '产品直推', count: 35, impressions: '320w', reads: '58w', engagement: '4.8w', ti: '28w', cpti: '0.72', cpe: '4.21', viralCount: 12, viralRate: '34%' },
    { direction: '食欲氛围感', count: 22, impressions: '280w', reads: '52w', engagement: '4.2w', ti: '25w', cpti: '0.65', cpe: '3.85', viralCount: 15, viralRate: '68%' },
    { direction: '热点创意', count: 18, impressions: '180w', reads: '30w', engagement: '3.1w', ti: '18w', cpti: '0.89', cpe: '2.58', viralCount: 15, viralRate: '83%' },
    { direction: '测评种草', count: 12, impressions: '55w', reads: '9w', engagement: '0.7w', ti: '5w', cpti: '1.2', cpe: '8.57', viralCount: 3, viralRate: '25%' },
    { direction: '周边二创', count: 8, impressions: '22w', reads: '4w', engagement: '0.2w', ti: '2w', cpti: '2.1', cpe: '21.0', viralCount: 1, viralRate: '13%' },
  ],
  达人层级: [
    { tier: 'KOC(<1w粉)', count: 45, impressions: '180w', reads: '32w', engagement: '2.5w', ti: '15w', cpti: '0.45', cpe: '5.4', viralCount: 8, viralRate: '18%' },
    { tier: '尾部(1-5w粉)', count: 32, impressions: '380w', reads: '68w', engagement: '5.8w', ti: '35w', cpti: '0.72', cpe: '3.45', viralCount: 18, viralRate: '56%' },
    { tier: '腰部(5-50w粉)', count: 15, impressions: '220w', reads: '40w', engagement: '3.8w', ti: '22w', cpti: '1.05', cpe: '6.08', viralCount: 12, viralRate: '80%' },
    { tier: '头部(>50w粉)', count: 3, impressions: '77w', reads: '13w', engagement: '0.9w', ti: '6w', cpti: '2.8', cpe: '18.67', viralCount: 3, viralRate: '100%' },
  ],
  内容形式: [
    { type: '视频', count: 38, impressions: '520w', reads: '95w', engagement: '8.2w', cpe: '2.93', viralCount: 28, viralRate: '74%' },
    { type: '图文', count: 57, impressions: '337w', reads: '58w', engagement: '4.8w', cpe: '5.0', viralCount: 18, viralRate: '32%' },
  ],
};

const mockTrafficAnalysis = {
  总览: {
    totalSpend: '152,680',
    totalImpressions: '4,850,000',
    totalClicks: '562,000',
    totalEngagement: '89,500',
    ctr: '11.59%',
    cpc: '0.27',
    cpm: '31.48',
    cpe: '1.71',
    ti: '185,000',
    cpti: '0.83',
  },
  广告类型: [
    { type: '信息流', spend: '98,500', impressions: '3,200,000', clicks: '384,000', engagement: '52,000', cpm: '30.78', cpc: '0.26', cpe: '1.89', ctr: '12.0%', ti: '125,000', cpti: '0.79' },
    { type: '视频流', spend: '35,200', impressions: '980,000', clicks: '112,000', engagement: '28,500', cpm: '35.92', cpc: '0.31', cpe: '1.24', ctr: '11.43%', ti: '42,000', cpti: '0.84' },
    { type: '搜索', spend: '18,980', impressions: '670,000', clicks: '66,000', engagement: '9,000', cpm: '28.33', cpc: '0.29', cpe: '2.11', ctr: '9.85%', ti: '18,000', cpti: '1.05' },
  ],
  人群定向: [
    { targeting: '平台推荐-精致中产', spend: '42,500', cpm: '28.5', cpc: '0.22', cpe: '1.45', ctr: '12.8%' },
    { targeting: '人群包-品牌资产人群', spend: '35,800', cpm: '32.1', cpc: '0.25', cpe: '1.12', ctr: '11.5%' },
    { targeting: '平台推荐-健康生活', spend: '28,600', cpm: '25.8', cpc: '0.20', cpe: '1.68', ctr: '13.2%' },
    { targeting: '行业兴趣-乳制品', spend: '22,400', cpm: '35.2', cpc: '0.30', cpe: '2.05', ctr: '10.8%' },
    { targeting: '人群包-竞品人群', spend: '15,200', cpm: '38.5', cpc: '0.32', cpe: '2.35', ctr: '9.5%' },
  ],
};

const mockHighlights = [
  '各项KPI均超额完成，总互动完成率130%，CPE完成率154%，爆文率完成率197%',
  'CPM/CPC/CPE/CTR全面优于行业大盘，其中CPC优于大盘最低值175%',
  '爆文率59%，远超KPI目标30%，千互爆文46篇，万互爆文3篇',
  '品牌搜索指数投放期间上升至5000+，"巴马128"关键词从无到有',
  'TI人群增长75w+，品牌人群资产有效扩充',
  '热点创意方向爆文率83%，验证了"热点+产品"的高效种草模型',
];

const mockOptimization = {
  内容策略: [
    '持续投放热点创意方向，爆文率83%验证了该方向的高效性，后续及时跟进平台趋势',
    '食欲氛围感方向CPE表现优秀(3.85)，建议增加视频类内容占比',
    '测评种草方向CPE偏高(8.57)，建议优化达人选择，聚焦垂类美食/健康博主',
    '周边二创方向效果不佳，建议减少投入或优化创意形式',
  ],
  达人选择: [
    '尾部达人性价比最优(CPTI 0.72, 爆文率56%)，建议作为主力投放层级',
    '腰部达人爆文率80%但CPTI偏高，建议精选优质账号集中投放',
    'KOC层级爆文率仅18%，建议提高筛选标准或减少占比',
  ],
  投流策略: [
    '信息流+视频流组合投放效果最佳，建议保持7:3预算比例',
    '精致中产和健康生活人群CTR最高，建议作为主力定向',
    '搜索场域持续进行品牌词防守和品类词占位',
    '视频流CPE最低(1.24)，建议对优质视频笔记加大视频流投放',
  ],
};

// ============================================================
// 组装 Presenton 请求内容
// ============================================================

function buildContent(): string {
  const sections: string[] = [];

  // 封面
  sections.push(`# ${mockProject.projectName}`);
  sections.push(`品牌: ${mockProject.brand} | 品类: ${mockProject.category} | SPU: ${mockProject.spu}`);
  sections.push(`项目类型: ${mockProject.projectType} | 传播周期: ${mockProject.period}`);
  sections.push('');

  // 项目回顾
  sections.push('## 项目回顾');
  sections.push('### 项目背景');
  sections.push('冠益乳在2025年重磅推出新品【巴马128】益生菌酸奶，采用源自"世界长寿之乡"广西巴马的专利益生菌。本次投放目标为快速抢占益生菌酸奶品类赛道，占领用户认知和心智，达成头部影响力。');
  sections.push('');
  sections.push('### 传播目的');
  sections.push('- 品类认知：洞察品类现状，分析差异化竞争优势，指明新品种草方向');
  sections.push('- 产品沟通：面向目标人群进行沟通和种草，高效引导促转化');
  sections.push('- 市场占位：在益生菌酸奶赛道的激烈竞争中，快速提升产品及品牌热度，抢夺市场份额');
  sections.push('');
  sections.push('### 传播节奏');
  sections.push(`| 阶段 | 时间 | 策略 | 发布篇数 |`);
  sections.push(`| --- | --- | --- | --- |`);
  sections.push(`| 预热期 | ${mockProject.phases.预热期} | 产品提前种草，口味定调，周边释出 | 25篇 |`);
  sections.push(`| 爆发期 | ${mockProject.phases.爆发期} | 直推铺量+测评，快速建立产品认知 | 52篇 |`);
  sections.push(`| 持续期 | ${mockProject.phases.持续期} | 挖掘热点热梗，放大产品热度 | 18篇 |`);
  sections.push('');

  // 数据总览
  sections.push('## 数据总览');
  sections.push('### KPI完成概况');
  sections.push('全周期发布95篇内容，项目总费用约48万元（达人费用32万+投流费用15.3万），各项KPI均超额达成。');
  sections.push('');
  sections.push('| 指标 | KPI目标 | 实际达成 | 完成率 |');
  sections.push('| --- | --- | --- | --- |');
  for (const [metric, data] of Object.entries(mockKPI)) {
    sections.push(`| ${metric} | ${data.kpi} | ${data.actual} | ${data.completion} |`);
  }
  sections.push('');
  sections.push('### 大盘对比');
  sections.push('| 指标 | 实际达成 | 行业大盘 | 表现 |');
  sections.push('| --- | --- | --- | --- |');
  for (const [metric, data] of Object.entries(mockBenchmark)) {
    sections.push(`| ${metric} | ${data.actual} | ${data.benchmark} | ${data.status} |`);
  }
  sections.push('');
  sections.push('### 数据解读');
  sections.push('本次投放整体表现优异，各项核心指标均超额完成KPI目标。CPE实际达成2.27，远优于行业大盘3.95-6.06的水平，说明内容质量和达人选择策略有效。爆文率59%大幅超越30%的KPI目标，热点创意方向贡献了最高的爆文率(83%)。投流侧各项成本均优于大盘，信息流和视频流的组合投放策略验证有效。');
  sections.push('');

  // 项目亮点
  sections.push('## 项目亮点');
  for (const highlight of mockHighlights) {
    sections.push(`- ${highlight}`);
  }
  sections.push('');
  sections.push('### 品牌声量增长');
  sections.push('- 品牌搜索指数：投放期间从0上升至5000+');
  sections.push('- "巴马128"关键词：从无到有，搜索量持续攀升');
  sections.push('- 品牌词SOC/SOV：益生菌酸奶赛道排名Top3');
  sections.push('');
  sections.push('### 人群资产增长');
  sections.push('- TI人群增长75w+，CPTI 0.89');
  sections.push('- 品牌人群资产总增长400w+');
  sections.push('- 行业渗透率提升2.3%');
  sections.push('');

  // 内容分析
  sections.push('## 内容分析');
  sections.push('### 内容概览');
  sections.push('- 总笔记数：95篇（图文57篇，视频38篇）');
  sections.push('- 水上笔记：82篇 | 水下笔记：13篇');
  sections.push('- 千互爆文：46篇 | 万互爆文：3篇');
  sections.push('');

  sections.push('### 内容方向分析');
  sections.push('| 内容方向 | 篇数 | 曝光量 | 阅读量 | 互动量 | TI人群 | CPTI | CPE | 爆文数 | 爆文率 |');
  sections.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const item of mockContentAnalysis.内容方向) {
    sections.push(`| ${item.direction} | ${item.count} | ${item.impressions} | ${item.reads} | ${item.engagement} | ${item.ti} | ${item.cpti} | ${item.cpe} | ${item.viralCount} | ${item.viralRate} |`);
  }
  sections.push('');
  sections.push('**解读：** 热点创意方向爆文率83%，互动成本最低(CPE 2.58)，验证了"热点+产品"的高效种草模型。食欲氛围感方向综合表现均衡，CPE和CPTI均处于较优水平。产品直推方向作为基本盘，覆盖面广但爆文率相对较低。');
  sections.push('');

  sections.push('### 达人层级分析');
  sections.push('| 达人层级 | 篇数 | 曝光量 | 阅读量 | 互动量 | TI人群 | CPTI | CPE | 爆文数 | 爆文率 |');
  sections.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const item of mockContentAnalysis.达人层级) {
    sections.push(`| ${item.tier} | ${item.count} | ${item.impressions} | ${item.reads} | ${item.engagement} | ${item.ti} | ${item.cpti} | ${item.cpe} | ${item.viralCount} | ${item.viralRate} |`);
  }
  sections.push('');
  sections.push('**解读：** 尾部达人(1-5w粉)性价比最优，CPTI 0.72且爆文率56%，是内容传播的核心基本盘。腰部达人爆文率高达80%，单篇效能突出。KOC层级主要承担基础曝光任务，爆文率较低(18%)。');
  sections.push('');

  sections.push('### 内容形式分析');
  sections.push('| 内容形式 | 篇数 | 曝光量 | 阅读量 | 互动量 | CPE | 爆文数 | 爆文率 |');
  sections.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const item of mockContentAnalysis.内容形式) {
    sections.push(`| ${item.type} | ${item.count} | ${item.impressions} | ${item.reads} | ${item.engagement} | ${item.cpe} | ${item.viralCount} | ${item.viralRate} |`);
  }
  sections.push('');
  sections.push('**解读：** 视频内容爆文率(74%)远高于图文(32%)，CPE也更优(2.93 vs 5.0)。视频更适合输出创意性内容进行产品深度种草，后续建议提高视频占比。');
  sections.push('');

  // 投流分析
  sections.push('## 投流分析');
  sections.push('### 投流总览');
  const t = mockTrafficAnalysis.总览;
  sections.push(`总消耗: ¥${t.totalSpend} | 总展现: ${t.totalImpressions} | 总点击: ${t.totalClicks} | 总互动: ${t.totalEngagement}`);
  sections.push(`CTR: ${t.ctr} | CPC: ¥${t.cpc} | CPM: ¥${t.cpm} | CPE: ¥${t.cpe} | TI人群: ${t.ti} | CPTI: ¥${t.cpti}`);
  sections.push('');
  sections.push('行业大盘参考：CPE 3.95~6.06，CPC 0.29~0.45，CPM 30.83~47.34');
  sections.push('本次投放各项指标均优于大盘。');
  sections.push('');

  sections.push('### 广告类型分析');
  sections.push('| 广告类型 | 消耗 | 展现量 | 点击量 | 互动量 | CPM | CPC | CPE | CTR | TI | CPTI |');
  sections.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const item of mockTrafficAnalysis.广告类型) {
    sections.push(`| ${item.type} | ¥${item.spend} | ${item.impressions} | ${item.clicks} | ${item.engagement} | ${item.cpm} | ${item.cpc} | ${item.cpe} | ${item.ctr} | ${item.ti} | ${item.cpti} |`);
  }
  sections.push('');
  sections.push('**解读：** 信息流侧重曝光阅读，CPM/CPC最低；视频流CPE最低(1.24)，互动效率最高；搜索场域进行品牌词防守和赛道占位。建议保持信息流:视频流:搜索 = 6:3:1的预算比例。');
  sections.push('');

  sections.push('### 人群定向分析');
  sections.push('| 人群定向 | 消耗 | CPM | CPC | CPE | CTR |');
  sections.push('| --- | --- | --- | --- | --- | --- |');
  for (const item of mockTrafficAnalysis.人群定向) {
    sections.push(`| ${item.targeting} | ¥${item.spend} | ${item.cpm} | ${item.cpc} | ${item.cpe} | ${item.ctr} |`);
  }
  sections.push('');
  sections.push('**解读：** 精致中产和健康生活人群CTR最高(12.8%/13.2%)，对健康类产品内容有较强兴趣。品牌资产人群CPE最低(1.12)，互动意愿强。建议主力投放精致中产+健康生活人群，品牌资产人群作为长期维护定向。');
  sections.push('');

  // 优化建议
  sections.push('## 优化建议');
  sections.push('### 内容策略优化');
  for (const item of mockOptimization.内容策略) {
    sections.push(`- ${item}`);
  }
  sections.push('');
  sections.push('### 达人选择优化');
  for (const item of mockOptimization.达人选择) {
    sections.push(`- ${item}`);
  }
  sections.push('');
  sections.push('### 投流策略优化');
  for (const item of mockOptimization.投流策略) {
    sections.push(`- ${item}`);
  }
  sections.push('');

  return sections.join('\n');
}

// ============================================================
// 调用 Presenton API
// ============================================================

async function generatePPT() {
  const content = buildContent();

  console.log('📝 生成的内容长度:', content.length, '字符');
  console.log('📋 内容预览（前500字）:');
  console.log(content.substring(0, 500));
  console.log('...\n');

  // 读取模版分析文档作为完整提示词
  const { readFileSync } = await import('fs');
  let templateGuide = '';
  try {
    templateGuide = readFileSync('docs/复盘报告模版分析.md', 'utf-8');
    console.log('📄 已加载模版分析文档作为提示词，长度:', templateGuide.length, '字符');
  } catch {
    console.warn('⚠️ 未找到 docs/复盘报告模版分析.md，使用内置提示词');
  }

  const instructions = templateGuide
    ? `你是一个专业的小红书营销项目复盘报告PPT生成助手。请严格按照以下模版规范生成PPT。

品牌: ${mockProject.brand}, 品类: ${mockProject.category}, SPU: ${mockProject.spu}

## 模版规范（基于18个真实复盘PDF分析得出）

${templateGuide}

## 生成要求
- 严格按照模版规范中"第四章 基础PPT模版规范"的章节结构和页数生成
- 数据用表格和图表展示，避免纯文字堆砌
- KPI完成率用数据卡片展示（KPI目标值/实际达成/完成率三行）
- 大盘对比用"优于大盘XX%"的标记
- 内容分析表格必须包含标准列：内容方向|篇数|曝光量|阅读量|互动量|TI人群|CPTI|CPE|爆文篇数|爆文率
- 投流分析表格必须包含：广告类型|消费|展现量|点击量|互动量|CPM|CPC|CPE|CTR|Ti|CPTi
- 每个数据模块后必须配AI文字解读段落
- 保持专业商务风格，横版16:9比例
- 配色以蓝色系为主`
    : `这是一份小红书营销项目复盘报告PPT。品牌: ${mockProject.brand}, 品类: ${mockProject.category}, SPU: ${mockProject.spu}。
请按以下章节结构生成：
1. 封面（1页）
2. 项目回顾（2页：项目背景+传播节奏）
3. 数据总览（3页：KPI完成+大盘对比+数据解读）
4. 项目亮点（2页：核心亮点+品牌声量/人群增长）
5. 内容分析（5页：内容方向表格+达人层级表格+内容形式+优质笔记+解读）
6. 投流分析（4页：总览+广告类型+人群定向+解读）
7. 优化建议（2页：内容/达人/投流三维度建议）
8. 尾页（1页）

要求：
- 数据用表格和图表展示，避免纯文字堆砌
- KPI完成率用进度条或对比卡片展示
- 大盘对比用"优于大盘XX%"的标记
- 保持专业商务风格，配色以蓝色系为主
- 每个数据模块后配文字解读`;

  const requestBody = {
    content,
    n_slides: 22,
    language: '中文',
    template: 'general',
    tone: 'professional' as const,
    verbosity: 'standard' as const,
    instructions,
    include_title_slide: true,
    include_table_of_contents: false,
    export_as: 'pptx' as const,
  };

  const AUTH_USERNAME = process.env.PRESENTON_USERNAME || 'admin';
  const AUTH_PASSWORD = process.env.PRESENTON_PASSWORD || 'admin123';
  const authHeader = 'Basic ' + Buffer.from(`${AUTH_USERNAME}:${AUTH_PASSWORD}`).toString('base64');

  console.log('🚀 正在调用 Presenton API...');
  console.log(`   URL: ${PRESENTON_BASE_URL}/api/v1/ppt/presentation/generate`);
  console.log(`   认证: ${AUTH_USERNAME}:***`);
  console.log(`   请求幻灯片数: ${requestBody.n_slides}`);
  console.log('');

  try {
    const response = await fetch(`${PRESENTON_BASE_URL}/api/v1/ppt/presentation/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API 错误 (${response.status}):`, errorText);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ PPT 生成成功！');
    console.log('   Presentation ID:', result.presentation_id);
    console.log('   下载路径:', result.path);
    console.log('   编辑路径:', result.edit_path);
    console.log('');
    console.log(`📎 编辑器 URL: ${PRESENTON_BASE_URL}/presentation?id=${result.presentation_id}`);
    console.log(`📥 下载 URL: ${PRESENTON_BASE_URL}${result.path}`);

    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('❌ 无法连接到 Presenton 服务');
      console.error(`   请确保 Presenton 服务已启动: ${PRESENTON_BASE_URL}`);
      console.error('   启动命令: docker-compose up presenton');
    } else {
      console.error('❌ 请求失败:', error);
    }
    process.exit(1);
  }
}

// ============================================================
// 同时输出 mock 数据为 JSON（供其他模块使用）
// ============================================================

async function outputMockData() {
  const mockData = {
    project: mockProject,
    kpi: mockKPI,
    benchmark: mockBenchmark,
    contentAnalysis: mockContentAnalysis,
    trafficAnalysis: mockTrafficAnalysis,
    highlights: mockHighlights,
    optimization: mockOptimization,
  };

  const { writeFileSync } = await import('fs');
  const outputPath = 'docs/mock-report-data.json';
  writeFileSync(outputPath, JSON.stringify(mockData, null, 2), 'utf-8');
  console.log(`💾 Mock 数据已保存到: ${outputPath}`);
  console.log('');
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('  小红书营销项目复盘报告 - Mock PPT 生成');
  console.log('='.repeat(60));
  console.log('');

  // 输出 mock 数据
  await outputMockData();

  // 生成 PPT
  await generatePPT();
}

main().catch(console.error);
