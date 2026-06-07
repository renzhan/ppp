import 'dotenv/config';
import { LingxiClient } from '../src/ingestion/lingxi-client.js';

async function main() {
  const client = new LingxiClient({
    baseUrl: process.env.LINGXI_BASE_URL || '',
    apiKey: process.env.LINGXI_API_KEY || '',
  });

  const start = Date.now();

  // brandId=550061, execStart=2026-01-19, currentEnd=2026-01-31,
  // taxonomyNames=["奶茶果汁(新)"], preStart=2026-01-06, preEnd=2026-01-18
  const r = await client.fetchLingxiData(
    '550061',
    '2026-01-19',
    '2026-01-31',
    ['奶茶果汁(新)'],
    '2026-01-06',
    '2026-01-18',
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('耗时:', elapsed + 's');
  console.log(JSON.stringify(r, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
