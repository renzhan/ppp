import 'dotenv/config';
import { JuguangClient } from '../src/ingestion/juguang-client.js';

async function main() {
  const client = new JuguangClient({
    baseUrl: process.env.JUGUANG_BASE_URL || '',
    apiKey: process.env.JUGUANG_API_KEY || '',
  });

  console.log('调用 fetchJuguangData...');
  const start = Date.now();
  const r = await client.fetchJuguangData([9389821], '2026-04-12', '2026-04-12');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`返回 ${r.length} 条 | 耗时: ${elapsed}s`);
  console.log(JSON.stringify(r, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
