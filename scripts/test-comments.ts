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
    data: { category:'测试', brand:'测试', projectName:'评论采集测试', startDate:new Date('2026-05-01'), endDate:new Date('2026-05-31'), status:'draft' },
  });
  console.log('项目:', project.id);

  const pgyConfig = { noteBaseUrl:process.env.PUGONGYING_NOTE_BASE_URL||'', commentBaseUrl:process.env.PUGONGYING_COMMENT_BASE_URL||'', apiKey:process.env.PUGONGYING_API_KEY||'' };
  const juguangConfig = { baseUrl:process.env.JUGUANG_BASE_URL||'', apiKey:process.env.JUGUANG_API_KEY||'' };
  const lingxiConfig = { baseUrl:process.env.LINGXI_BASE_URL||'', apiKey:process.env.LINGXI_API_KEY||'' };
  const client = new PaichachaClient(process.env.PAICHACHA_BASE_URL||'', process.env.PAICHACHA_API_KEY||'', undefined, pgyConfig, juguangConfig, lingxiConfig);
  const service = new DataIngestionService(client, new PrismaDataPersistenceService());

  const noteIds = ['6a0c3abd000000003701d3b8', '6a0c0fc3000000003601f68b'];
  console.log('拉取评论...');
  const result = await service.ingestComments(project.id, noteIds);
  console.log('count:', result.count, 'errors:', result.errors);

  const saved = await prisma.comment.findMany({ where:{projectId:project.id}, orderBy:{noteId:'asc'}, take:5 });
  console.log(`\nDB 共 ${await prisma.comment.count({where:{projectId:project.id}})} 条，前5条:`);
  for (const c of saved) {
    console.log(JSON.stringify({ noteId:c.noteId, commentId:c.commentId, parentCommentId:c.parentCommentId, nickname:c.nickname, content:c.content?.slice(0,30), likes:c.likes }, null, 2));
  }

  await prisma.comment.deleteMany({ where:{projectId:project.id} });
  await prisma.project.delete({ where:{id:project.id} }).catch(()=>{});
  console.log('\n已清理');
}

main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
