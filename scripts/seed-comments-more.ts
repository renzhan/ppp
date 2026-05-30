import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '/Users/like/projects/ppp/generated/prisma/client.js';
import { DataIngestionService, PrismaDataPersistenceService } from '../src/ingestion/index.js';
import { PaichachaClient } from '../src/ingestion/paichacha-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { projectName: { contains: '聚光' } }, orderBy: { createdAt: 'desc' } });
  if (!project) { console.error('no project'); return; }
  console.log('项目:', project.id, project.projectName);

  const pgyConfig = { noteBaseUrl:process.env.PUGONGYING_NOTE_BASE_URL||'', commentBaseUrl:process.env.PUGONGYING_COMMENT_BASE_URL||'', apiKey:process.env.PUGONGYING_API_KEY||'' };
  const juguangConfig = { baseUrl:process.env.JUGUANG_BASE_URL||'', apiKey:process.env.JUGUANG_API_KEY||'' };
  const lingxiConfig = { baseUrl:process.env.LINGXI_BASE_URL||'', apiKey:process.env.LINGXI_API_KEY||'' };
  const qianguaConfig = { baseUrl:process.env.QIANGUA_BASE_URL||'', apiKey:process.env.QIANGUA_API_KEY||'' };
  const client = new PaichachaClient(process.env.PAICHACHA_BASE_URL||'', process.env.PAICHACHA_API_KEY||'', undefined, pgyConfig, juguangConfig, lingxiConfig, qianguaConfig);
  const service = new DataIngestionService(client, new PrismaDataPersistenceService());

  const noteIds = ['6a0c3abd000000003701d3b8', '6a0c0fc3000000003601f68b'];
  console.log('采集评论:', noteIds);

  const result = await service.ingestComments(project.id, ids);
  console.log(`已入库: ${result.count} 条, errors: ${result.errors}`);
  console.log(`DB 总评论: ${await prisma.comment.count()}`);
}

main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
