import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { QianguaClient } from '../src/ingestion/qiangua-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  // Direct test to see raw response
  const url = 'http://47.114.122.60:6009/api/qian_gua/stats_compare';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'abcd1234' },
    body: JSON.stringify({ brand_name: '爷爷不泡茶', params: { days: 30, brandsource: 0, notefeature: 0, hasgoods: false } }),
  });
  const raw = await res.json() as any;
  console.log('raw.data keys:', Object.keys(raw.data ?? {}));
  console.log('raw.data.Current keys:', Object.keys(raw.data?.Current ?? {}).slice(0, 5));

  const client = new QianguaClient({
    baseUrl: process.env.QIANGUA_BASE_URL || '',
    apiKey: process.env.QIANGUA_API_KEY || '',
  });

  console.log('\n=== stats ===');
  const { stats, hotNotePublish } = await client.fetchQianguaData('爷爷不泡茶');
  console.log('current keys:', Object.keys(stats.current).slice(0, 8));
  console.log('noteCount:', stats.current.NoteCount || stats.current.noteCount);
  console.log('week:', hotNotePublish.week.length, 'hour:', hotNotePublish.hour.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
