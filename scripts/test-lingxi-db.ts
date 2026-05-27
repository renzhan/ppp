import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '/Users/like/projects/ppp/generated/prisma/client.js';
import { DataIngestionService, PrismaDataPersistenceService } from '../src/ingestion/index.js';
import { PaichachaClient } from '../src/ingestion/paichacha-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: {
      category: '测试品类', brand: '爷爷不泡茶', projectName: '灵犀API测试',
      startDate: new Date('2026-05-01'), endDate: new Date('2026-05-31'), status: 'draft',
    },
  });
  console.log('测试项目:', project.id);

  const pgyConfig = { noteBaseUrl: process.env.PUGONGYING_NOTE_BASE_URL || '', apiKey: process.env.PUGONGYING_API_KEY || '' };
  const juguangConfig = { baseUrl: process.env.JUGUANG_BASE_URL || '', apiKey: process.env.JUGUANG_API_KEY || '' };
  const lingxiConfig = { baseUrl: process.env.LINGXI_BASE_URL || '', apiKey: process.env.LINGXI_API_KEY || '' };
  const client = new PaichachaClient(
    process.env.PAICHACHA_BASE_URL || '', process.env.PAICHACHA_API_KEY || '',
    undefined, pgyConfig, juguangConfig, lingxiConfig,
  );
  const service = new DataIngestionService(client, new PrismaDataPersistenceService());

  console.log('拉取灵犀数据...');
  const result = await service.ingestFromAPI(project.id, []);
  console.log('errors:', result.errors);

  const saved = await prisma.lingxiData.findMany({ where: { projectId: project.id }, orderBy: { dataType: 'asc' } });
  console.log(`\nDB 中共 ${saved.length} 条:`);
  for (const r of saved) {
    console.log(JSON.stringify({ dataType: r.dataType, dataContent: r.dataContent }, null, 2));
  }

  await prisma.lingxiData.deleteMany({ where: { projectId: project.id } });
  await prisma.juguangData.deleteMany({ where: { projectId: project.id } });
  await prisma.note.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  console.log('\n已清理');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
