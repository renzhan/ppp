import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '../generated/prisma/client.js';
import { DataIngestionService, PrismaDataPersistenceService } from '../src/ingestion/index.js';
import { PaichachaClient } from '../src/ingestion/paichacha-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  // 1. Create test project
  const project = await prisma.project.create({
    data: {
      category: '测试品类',
      brand: '测试品牌',
      projectName: '聚光API测试',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-30'),
      status: 'draft',
    },
  });
  console.log('测试项目:', project.id);

  // 2. Build ingestion service
  const pgyConfig = { noteBaseUrl: process.env.PUGONGYING_NOTE_BASE_URL || '', apiKey: process.env.PUGONGYING_API_KEY || '' };
  const juguangConfig = { baseUrl: process.env.JUGUANG_BASE_URL || '', apiKey: process.env.JUGUANG_API_KEY || '' };
  const lingxiConfig = { baseUrl: process.env.LINGXI_BASE_URL || '', apiKey: process.env.LINGXI_API_KEY || '' };
  const qianguaConfig = { baseUrl: process.env.QIANGUA_BASE_URL || '', apiKey: process.env.QIANGUA_API_KEY || '' };
  const client = new PaichachaClient(
    process.env.PAICHACHA_BASE_URL || '',
    process.env.PAICHACHA_API_KEY || '',
    undefined,
    pgyConfig,
    juguangConfig,
    lingxiConfig,
    qianguaConfig,
  );
  const persistence = new PrismaDataPersistenceService();
  const service = new DataIngestionService(client, persistence);

  // 3. Fetch + persist
  console.log('拉取聚光数据并入库...');
  const result = await service.ingestFromAPI(project.id, ['6a0c3abd000000003701d3b8']); // 蒲公英 noteIds 可空
  console.log('结果:', { juguangCount: result.juguangNotes.length, pugongyingCount: result.pugongyingNotes.length, errors: result.errors });

  // 4. Read back from DB
  const saved = await prisma.juguangData.findMany({
    where: { projectId: project.id },
    orderBy: { noteId: 'asc' },
  });
  console.log(`\nDB 中共 ${saved.length} 条聚光记录:`);
  for (const r of saved) {
    console.log(JSON.stringify(r, null, 2));
    console.log('---');
  }

  // 5. Cleanup
  await prisma.qianguaData.deleteMany({ where: { projectId: project.id } });
  await prisma.lingxiData.deleteMany({ where: { projectId: project.id } });
  await prisma.juguangData.deleteMany({ where: { projectId: project.id } });
  await prisma.note.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  console.log('\n测试数据已清理');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
