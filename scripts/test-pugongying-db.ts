import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '/Users/like/projects/ppp/generated/prisma/client.js';
import { DataIngestionService, PrismaDataPersistenceService } from '../src/ingestion/index.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });
const prisma = new PrismaClient();

async function main() {
  const noteIds = ['6a0c3abd000000003701d3b8', '6a0c0fc3000000003601f68b'];

  const project = await prisma.project.create({
    data: { category:'奶茶饮品', brand:'爷爷不泡茶', projectName:'爷爷不泡茶5月复盘', startDate:new Date('2026-05-01'), endDate:new Date('2026-05-31'), status:'draft' },
  });
  console.log('项目:', project.id);

  const service = new DataIngestionService();

  const result = await service.ingestFromAPI(project.id, noteIds);
  console.log('errors:', result.errors,
    '| pugongying:', result.pugongyingNotes.length,
    '| juguang:', result.juguangNotes.length);

  const notes = await prisma.note.findMany({ where: { projectId: project.id }, select: { noteId: true, kolNickName: true, impNum: true, engageNum: true } });
  console.log(`notes: ${notes.length}`);
  for (const n of notes) console.log(`  ${n.noteId} | ${n.kolNickName} | imp=${n.impNum} engage=${n.engageNum}`);

  console.log('\n数据已入库');
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
