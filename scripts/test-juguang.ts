import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { JuguangClient } from '../src/ingestion/juguang-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const client = new JuguangClient({
    baseUrl: process.env.JUGUANG_BASE_URL || '',
    apiKey: process.env.JUGUANG_API_KEY || '',
  });

  console.log('拉取聚光笔记报表...');
  const notes = await client.fetchJuguangData(726286, '2026-04-12', '2026-04-18');

  console.log(`获取到 ${notes.length} 条记录\n`);

  if (notes.length > 0) {
    console.log('=== 前3条示例 ===');
    for (let i = 0; i < Math.min(3, notes.length); i++) {
      console.log(JSON.stringify(notes[i], null, 2));
      console.log('---');
    }
  }

  // 汇总
  const totalFee = notes.reduce((s, n) => s + n.fee, 0);
  const totalImp = notes.reduce((s, n) => s + n.impression, 0);
  const totalClick = notes.reduce((s, n) => s + n.click, 0);
  console.log(`\n汇总: fee=${totalFee} imp=${totalImp} click=${totalClick}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
