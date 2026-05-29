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
    data: { category:'奶茶饮品', brand:'爷爷不泡茶', projectName:'媒体采集测试', startDate:new Date('2026-05-01'), endDate:new Date('2026-05-31'), status:'draft' },
  });
  console.log('项目:', project.id);

  const pgyConfig = { noteBaseUrl:process.env.PUGONGYING_NOTE_BASE_URL||'', commentBaseUrl:process.env.PUGONGYING_COMMENT_BASE_URL||'', apiKey:process.env.PUGONGYING_API_KEY||'' };
  const juguangConfig = { baseUrl:process.env.JUGUANG_BASE_URL||'', apiKey:process.env.JUGUANG_API_KEY||'' };
  const lingxiConfig = { baseUrl:process.env.LINGXI_BASE_URL||'', apiKey:process.env.LINGXI_API_KEY||'' };
  const qianguaConfig = { baseUrl:process.env.QIANGUA_BASE_URL||'', apiKey:process.env.QIANGUA_API_KEY||'' };
  const client = new PaichachaClient(process.env.PAICHACHA_BASE_URL||'', process.env.PAICHACHA_API_KEY||'', undefined, pgyConfig, juguangConfig, lingxiConfig, qianguaConfig);
  const service = new DataIngestionService(client, new PrismaDataPersistenceService());

  console.log('ingestFromAPI...');
  const result = await service.ingestFromAPI(project.id, ['6a0c0fc3000000003601f68b']);
  console.log('errors:', result.errors);

  const note = await prisma.note.findFirst({ where: { projectId: project.id } });
  console.log('\nnoteId:', note?.noteId);
  console.log('coverImages:', JSON.stringify(note?.coverImages));
  console.log('videoPath:', note?.videoPath);

  // await prisma.note.deleteMany({ where: { projectId: project.id } });
  // await prisma.project.delete({ where: { id: project.id } }).catch(()=>{});
  console.log('数据已保留');
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
