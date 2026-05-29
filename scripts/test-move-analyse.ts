import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '/Users/like/projects/ppp/generated/prisma/client.js';
import { LingxiClient } from '../src/ingestion/lingxi-client.js';
import { PrismaDataPersistenceService } from '../src/ingestion/persistence-service.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!project) return;
  console.log('项目:', project.id);

  const client = new LingxiClient({
    baseUrl: process.env.LINGXI_BASE_URL || '',
    apiKey: process.env.LINGXI_API_KEY || '',
  });

  console.log('拉取灵犀数据（含投前）...');
  const endDate = new Date(); endDate.setDate(endDate.getDate()-1);
  const startDate = new Date(endDate); startDate.setMonth(startDate.getMonth()-1); startDate.setDate(startDate.getDate()+1);
  const data = await client.fetchLingxiData('爷爷不泡茶', '酸奶',
    startDate.toISOString().slice(0,10), endDate.toISOString().slice(0,10),
    ['方便速食'], '2026-03-30', '2026-04-30');

  console.log('\nbrand:', JSON.stringify(data.brand, null, 2));
  console.log('keyword:', JSON.stringify(data.keyword, null, 2));

  const persistence = new PrismaDataPersistenceService();
  await persistence.saveLingxiData(project.id, data);
  console.log('\n数据已保留');
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
