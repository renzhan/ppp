import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '/Users/like/projects/ppp/generated/prisma/client.js';
import { LingxiClient } from '../src/ingestion/lingxi-client.js';
import { PrismaDataPersistenceService } from '../src/ingestion/persistence-service.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: { category:'奶茶饮品', brand:'爷爷不泡茶', projectName:'灵犀move_analyse测试', startDate:new Date('2026-05-01'), endDate:new Date('2026-05-31'), status:'draft' },
  });
  console.log('项目:', project.id);

  const client = new LingxiClient({
    baseUrl: process.env.LINGXI_BASE_URL || '',
    apiKey: process.env.LINGXI_API_KEY || '',
  });

  console.log('拉取灵犀数据...');
  const data = await client.fetchLingxiData('爷爷不泡茶', '酸奶');
  console.log('brand:', JSON.stringify(data.brand, null, 2));
  console.log('keyword:', JSON.stringify(data.keyword, null, 2));

  const persistence = new PrismaDataPersistenceService();
  await persistence.saveLingxiData(project.id, data);

  const saved = await prisma.lingxiData.findMany({ where: { projectId: project.id } });
  console.log(`\n入库: ${saved.length} 条`);
  for (const r of saved) {
    console.log(`${r.dataType}:`, JSON.stringify(r.dataContent, null, 2).slice(0, 500));
  }

  console.log('\n数据已保留');
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
