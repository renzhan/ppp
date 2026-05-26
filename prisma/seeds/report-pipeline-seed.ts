import 'dotenv/config';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

/**
 * Seed configuration for the report generation pipeline test data.
 */
const SEED_CONFIG = {
  projectName: '测试品牌_日常种草_2025Q1',
  brand: '测试品牌',
  category: '美妆护肤',
  businessLine: '护肤线',
  projectType: '日常种草',
  noteCount: 35,
  juguangCoverage: 0.6, // 60% of notes have juguang data
  kpiMetrics: ['impression', 'read', 'engagement', 'cpm', 'cpc', 'cpe', 'ctr', 'viralCount'],
};

/**
 * Content directions for business annotations
 */
const CONTENT_DIRECTIONS = ['产品测评', '使用教程', '成分科普', '好物分享', '日常vlog'];
const ACCOUNT_TYPES = ['KOL', 'KOC', '素人', '品牌号'];
const KOL_TYPES = ['头部达人', '腰部达人', '尾部达人', '素人'];
const LAUNCH_PHASES = ['预热期', '爆发期', '长尾期'];
const NOTE_TYPES = ['图文', '视频'];

/**
 * Generate a random integer between min and max (inclusive).
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random decimal between min and max.
 */
function randomDecimal(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/**
 * Pick a random element from an array.
 */
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Idempotent seed function for the report generation pipeline.
 * Checks for existing data before creating duplicates.
 * Can accept an external PrismaClient for testing.
 */
export async function seedReportPipeline(client?: PrismaClient): Promise<Record<string, number>> {
  const db = client ?? prisma;
  const counts: Record<string, number> = {
    projects: 0,
    notes: 0,
    juguangData: 0,
    businessAnnotations: 0,
    kpiTargets: 0,
    reviewConfigs: 0,
    aiGeneratedContent: 0,
    lingxiData: 0,
  };

  // Check if seed data already exists (idempotent check)
  const existingProject = await db.project.findFirst({
    where: { projectName: SEED_CONFIG.projectName },
  });

  if (existingProject) {
    console.log(`ℹ️  Seed data already exists for project "${SEED_CONFIG.projectName}", skipping creation.`);

    // Count existing records for summary
    counts.projects = 1;
    counts.notes = await db.note.count({ where: { projectId: existingProject.id } });
    counts.juguangData = await db.juguangData.count({ where: { projectId: existingProject.id } });
    counts.businessAnnotations = await db.businessAnnotation.count({ where: { projectId: existingProject.id } });
    counts.kpiTargets = await db.kpiTarget.count({ where: { projectId: existingProject.id } });
    counts.reviewConfigs = await db.reviewConfig.count({ where: { projectId: existingProject.id } });
    counts.aiGeneratedContent = await db.aiGeneratedContent.count({ where: { projectId: existingProject.id } });
    counts.lingxiData = await db.lingxiData.count({ where: { projectId: existingProject.id } });

    logSummary(counts);
    return counts;
  }

  // --- Create Project ---
  const project = await db.project.create({
    data: {
      category: SEED_CONFIG.category,
      brand: SEED_CONFIG.brand,
      businessLine: SEED_CONFIG.businessLine,
      projectName: SEED_CONFIG.projectName,
      projectType: SEED_CONFIG.projectType,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      status: 'active',
      noteCount: SEED_CONFIG.noteCount,
      launchPhases: [
        { name: '预热期', startDate: '2025-01-01', endDate: '2025-01-15' },
        { name: '爆发期', startDate: '2025-01-16', endDate: '2025-02-28' },
        { name: '长尾期', startDate: '2025-03-01', endDate: '2025-03-31' },
      ],
    },
  });
  counts.projects = 1;

  // --- Create Notes (35 notes with varied metrics) ---
  const noteIds: string[] = [];
  for (let i = 1; i <= SEED_CONFIG.noteCount; i++) {
    const noteId = `note_seed_${i.toString().padStart(3, '0')}`;
    const impNum = randomInt(5000, 200000);
    const readNum = Math.floor(impNum * randomDecimal(0.1, 0.4));
    const likeNum = Math.floor(readNum * randomDecimal(0.05, 0.2));
    const favNum = Math.floor(readNum * randomDecimal(0.02, 0.1));
    const cmtNum = Math.floor(readNum * randomDecimal(0.01, 0.05));
    const shareNum = Math.floor(readNum * randomDecimal(0.005, 0.03));
    const engageNum = likeNum + favNum + cmtNum + shareNum;

    await db.note.create({
      data: {
        projectId: project.id,
        noteId,
        kolNickName: `达人${i}`,
        kolId: `kol_${i.toString().padStart(3, '0')}`,
        kolFanNum: randomInt(1000, 5000000),
        noteType: randomPick(NOTE_TYPES),
        impNum,
        readNum,
        engageNum,
        likeNum,
        favNum,
        cmtNum,
        shareNum,
        kolPrice: randomDecimal(500, 50000),
        serviceFee: randomDecimal(100, 5000),
      },
    });
    noteIds.push(noteId);
  }
  counts.notes = SEED_CONFIG.noteCount;

  // --- Create JuguangData for 60% of notes ---
  const juguangNoteCount = Math.ceil(SEED_CONFIG.noteCount * SEED_CONFIG.juguangCoverage);
  for (let i = 0; i < juguangNoteCount; i++) {
    const fee = randomDecimal(100, 10000);
    const impression = randomInt(10000, 500000);
    const click = Math.floor(impression * randomDecimal(0.02, 0.08));
    const interaction = Math.floor(click * randomDecimal(0.1, 0.4));

    await db.juguangData.create({
      data: {
        projectId: project.id,
        noteId: noteIds[i],
        fee,
        impression,
        click,
        interaction,
        iUserNum: randomInt(100, 5000),
        tiUserNum: randomInt(50, 2000),
      },
    });
  }
  counts.juguangData = juguangNoteCount;

  // --- Create BusinessAnnotation for ALL notes ---
  for (let i = 0; i < SEED_CONFIG.noteCount; i++) {
    await db.businessAnnotation.create({
      data: {
        projectId: project.id,
        noteId: noteIds[i],
        contentDirection: randomPick(CONTENT_DIRECTIONS),
        accountType: randomPick(ACCOUNT_TYPES),
        kolType: randomPick(KOL_TYPES),
        launchPhase: randomPick(LAUNCH_PHASES),
      },
    });
  }
  counts.businessAnnotations = SEED_CONFIG.noteCount;

  // --- Create KpiTarget records ---
  const kpiTargetData = [
    { metricName: 'impression', targetValue: 3000000, isCostMetric: false },
    { metricName: 'read', targetValue: 500000, isCostMetric: false },
    { metricName: 'engagement', targetValue: 100000, isCostMetric: false },
    { metricName: 'cpm', targetValue: 50, isCostMetric: true },
    { metricName: 'cpc', targetValue: 3, isCostMetric: true },
    { metricName: 'cpe', targetValue: 10, isCostMetric: true },
    { metricName: 'ctr', targetValue: 5, isCostMetric: false },
    { metricName: 'viralCount', targetValue: 5, isCostMetric: false },
  ];

  for (const kpi of kpiTargetData) {
    await db.kpiTarget.create({
      data: {
        projectId: project.id,
        metricName: kpi.metricName,
        targetValue: kpi.targetValue,
        isCostMetric: kpi.isCostMetric,
      },
    });
  }
  counts.kpiTargets = kpiTargetData.length;

  // --- Create ReviewConfig ---
  // Need a user ID for createdBy - use a deterministic UUID
  const seedUserId = '00000000-0000-0000-0000-000000000001';

  // Ensure the seed user exists
  const existingUser = await db.user.findUnique({ where: { username: 'seed_pipeline_user' } });
  let userId = existingUser?.id ?? seedUserId;
  if (!existingUser) {
    const createdUser = await db.user.create({
      data: {
        username: 'seed_pipeline_user',
        passwordHash: 'not_a_real_hash',
        displayName: '种子数据用户',
        role: 'admin',
        mustChangePassword: false,
        isActive: true,
      },
    });
    userId = createdUser.id;
  }

  await db.reviewConfig.create({
    data: {
      projectId: project.id,
      createdBy: userId,
      status: 'draft',
      benchmark: {
        cpm: 45,
        cpc: 2.5,
        cpe: 8,
        ctr: 4.5,
        viralRate: 10,
      },
      influencerTiers: [
        { name: '头部达人', minFans: 1000000, maxFans: null },
        { name: '腰部达人', minFans: 100000, maxFans: 999999 },
        { name: '尾部达人', minFans: 10000, maxFans: 99999 },
        { name: '素人', minFans: 0, maxFans: 9999 },
      ],
      kpiTargets: {
        impression: 3000000,
        read: 500000,
        engagement: 100000,
        cpm: 50,
        cpc: 3,
        cpe: 10,
        ctr: 5,
        viralCount: 5,
      },
      modules: {
        cover: true,
        projectReview: true,
        dataOverview: true,
        highlights: true,
        quadrantAnalysis: true,
        contentAnalysis: true,
        trafficAnalysis: true,
        audienceAssets: true,
        optimizationSuggestions: true,
        endPage: true,
      },
      launchPhases: [
        { name: '预热期', startDate: '2025-01-01', endDate: '2025-01-15' },
        { name: '爆发期', startDate: '2025-01-16', endDate: '2025-02-28' },
        { name: '长尾期', startDate: '2025-03-01', endDate: '2025-03-31' },
      ],
    },
  });
  counts.reviewConfigs = 1;

  // --- Create AiGeneratedContent (plan_parse) ---
  await db.aiGeneratedContent.create({
    data: {
      projectId: project.id,
      contentType: 'plan_parse',
      generatedContent: JSON.stringify({
        projectObjective: '通过小红书种草内容提升品牌在美妆护肤品类的认知度和转化率',
        strategy: '以产品测评和使用教程为核心内容方向，结合头部KOL背书和腰部KOC种草',
        targetAudience: '18-35岁女性，关注护肤、美妆，有一定消费能力',
        coreMessage: '科学护肤，精准选品，让每一分投入都有回报',
      }),
      isEdited: false,
    },
  });
  counts.aiGeneratedContent = 1;

  // --- Create LingxiData (aips) ---
  await db.lingxiData.create({
    data: {
      projectId: project.id,
      dataType: 'aips',
      dataContent: {
        awareness: { population: 1500000, rate: 0.35 },
        interest: { population: 800000, rate: 0.53 },
        purchase: { population: 200000, rate: 0.25 },
        share: { population: 50000, rate: 0.25 },
        flowRates: {
          awarenessToInterest: 0.53,
          interestToPurchase: 0.25,
          purchaseToShare: 0.25,
        },
      },
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-03-31'),
    },
  });
  counts.lingxiData = 1;

  logSummary(counts);
  return counts;
}

/**
 * Log a summary of created/existing records.
 */
function logSummary(counts: Record<string, number>): void {
  console.log('\n📊 Report Pipeline Seed Summary:');
  console.log('─'.repeat(40));
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count} records`);
  }
  console.log('─'.repeat(40));
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  console.log(`  Total: ${total} records\n`);
}

// Run directly when executed as a script
const isDirectExecution = process.argv[1]?.includes('report-pipeline-seed');
if (isDirectExecution) {
  seedReportPipeline()
    .then(() => {
      console.log('✅ Report pipeline seed completed');
    })
    .catch((e) => {
      console.error('❌ Report pipeline seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
