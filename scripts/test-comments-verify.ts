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
    data: { category:'测试', brand:'测试', projectName:'评论验证', startDate:new Date('2026-05-01'), endDate:new Date('2026-05-31'), status:'draft' },
  });

  const pgyConfig = { noteBaseUrl:process.env.PUGONGYING_NOTE_BASE_URL||'', commentBaseUrl:process.env.PUGONGYING_COMMENT_BASE_URL||'', apiKey:process.env.PUGONGYING_API_KEY||'' };
  const juguangConfig = { baseUrl:process.env.JUGUANG_BASE_URL||'', apiKey:process.env.JUGUANG_API_KEY||'' };
  const lingxiConfig = { baseUrl:process.env.LINGXI_BASE_URL||'', apiKey:process.env.LINGXI_API_KEY||'' };
  const client = new PaichachaClient(process.env.PAICHACHA_BASE_URL||'', process.env.PAICHACHA_API_KEY||'', undefined, pgyConfig, juguangConfig, lingxiConfig);
  const service = new DataIngestionService(client, new PrismaDataPersistenceService());

  const noteIds = ['6a0c3abd000000003701d3b8', '6a0c0fc3000000003601f68b'];
  const result = await service.ingestComments(project.id, noteIds);

  // Per-note breakdown
  for (const noteId of noteIds) {
    const all = await prisma.comment.findMany({ where: { projectId: project.id, noteId } });
    const first = all.filter(c => c.parentCommentId === null);
    const second = all.filter(c => c.parentCommentId !== null);

    // Verify parent-child links
    const parentIds = new Set(first.map(c => c.commentId));
    const orphans = second.filter(c => !parentIds.has(c.parentCommentId!));

    console.log(`\n${noteId}: ${all.length} 条 (一级${first.length} + 二级${second.length})`);
    if (orphans.length > 0) console.log(`  ⚠️ 孤儿二级评论: ${orphans.length} 条`);
    console.log(`  一级: ${first.map(c=>`${c.commentId.slice(-8)}:${c.content?.slice(0,15)}`).join(' | ')}`);
    console.log(`  二级: ${second.map(c=>`${c.commentId.slice(-8)}→${c.parentCommentId?.slice(-8)}:${c.content?.slice(0,15)}`).join(' | ')}`);
  }

  // Verify no empty content
  const empty = await prisma.comment.count({ where: { projectId: project.id, content: null } });
  if (empty > 0) console.log(`\n⚠️ ${empty} 条评论内容为空`);

  await prisma.comment.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } }).catch(()=>{});
  console.log('\n验证完成');
}

main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
