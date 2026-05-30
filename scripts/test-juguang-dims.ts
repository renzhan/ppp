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
    data: { category:'奶茶饮品', brand:'爷爷不泡茶', projectName:'聚光多维测试', startDate:new Date('2026-05-01'), endDate:new Date('2026-05-31'), status:'draft' },
  });
  console.log('项目:', project.id);

  const pgyConfig = { noteBaseUrl:process.env.PUGONGYING_NOTE_BASE_URL||'', commentBaseUrl:process.env.PUGONGYING_COMMENT_BASE_URL||'', apiKey:process.env.PUGONGYING_API_KEY||'' };
  const juguangConfig = { baseUrl:process.env.JUGUANG_BASE_URL||'', apiKey:process.env.JUGUANG_API_KEY||'' };
  const lingxiConfig = { baseUrl:process.env.LINGXI_BASE_URL||'', apiKey:process.env.LINGXI_API_KEY||'' };
  const qianguaConfig = { baseUrl:process.env.QIANGUA_BASE_URL||'', apiKey:process.env.QIANGUA_API_KEY||'' };
  const client = new PaichachaClient(process.env.PAICHACHA_BASE_URL||'', process.env.PAICHACHA_API_KEY||'', undefined, pgyConfig, juguangConfig, lingxiConfig, qianguaConfig);
  const service = new DataIngestionService(client, new PrismaDataPersistenceService());

  console.log('拉取聚光数据...');
  const result = await service.ingestFromAPI(project.id, []);
  console.log('errors:', result.errors);

  const rows = await prisma.juguangData.findMany({ where: { projectId: project.id }, take: 10 });
  console.log(`\n共 ${await prisma.juguangData.count({ where: { projectId: project.id } })} 条，取 10 条:`);
  for (const r of rows) {
    console.log(`noteId=${r.noteId?.slice(-12)} fee=${r.fee} placement=${r.placement??'-'} keyword=${r.keyword??'-'}`);
  }

  // 维度统计
  const dimStats = await prisma.$queryRawUnsafe<Array<{placement:string|null,cnt:number}>>(
    `SELECT placement, count(*) as cnt FROM juguang_data WHERE project_id=$1 GROUP BY placement ORDER BY cnt DESC`, project.id
  );
  const kwStats = await prisma.$queryRawUnsafe<Array<{keyword:string|null,cnt:number}>>(
    `SELECT keyword, count(*) as cnt FROM juguang_data WHERE project_id=$1 GROUP BY keyword ORDER BY cnt DESC LIMIT 5`, project.id
  );
  console.log('\nplacement 分布:', dimStats);
  console.log('keyword top5:', kwStats);

  await prisma.juguangData.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } }).catch(()=>{});
  console.log('\n已清理');
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
