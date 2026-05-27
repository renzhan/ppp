import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PugongyingClient } from '../src/ingestion/pugongying-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const noteBaseUrl = process.env.PUGONGYING_NOTE_BASE_URL || '';
  const apiKey = process.env.PUGONGYING_API_KEY || '';

  console.log('noteBaseUrl:', noteBaseUrl);
  console.log('apiKey:', apiKey ? '***' : '(empty)');

  if (!noteBaseUrl || !apiKey) {
    console.error('缺少蒲公英 API 配置，请检查 .env');
    process.exit(1);
  }

  const client = new PugongyingClient({ noteBaseUrl, apiKey });

  const noteIds = ['6a0c3abd000000003701d3b8', '6a0c0fc3000000003601f68b'];
  console.log('测试笔记ID:', noteIds);
  console.log('---');

  const notes = await client.fetchPugongyingData(noteIds);

  console.log(`获取到 ${notes.length} 条笔记:`);
  for (const n of notes) {
    console.log(JSON.stringify({
      noteId: n.noteId,
      kolNickName: n.kolNickName,
      noteType: n.noteType,
      brandUserName: n.brandUserName,
      spuName: n.spuName,
      impNum: n.impNum,
      readNum: n.readNum,
      engageNum: n.engageNum,
      likeNum: n.likeNum,
      favNum: n.favNum,
      cmtNum: n.cmtNum,
      shareNum: n.shareNum,
      kolPrice: n.kolPrice,
      serviceFee: n.serviceFee,
      totalPlatformPrice: n.totalPlatformPrice,
      originImpNum: n.originImpNum,
      promotionImpNum: n.promotionImpNum,
      notePublishTime: n.notePublishTime,
      cooperateType: n.cooperateType,
      components: n.components,
    }, null, 2));
    console.log('---');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
