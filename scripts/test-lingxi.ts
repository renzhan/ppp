import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { LingxiClient } from '../src/ingestion/lingxi-client.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function main() {
  const client = new LingxiClient({
    baseUrl: process.env.LINGXI_BASE_URL || '',
    apiKey: process.env.LINGXI_API_KEY || '',
  });

  // 1. keyword_trend
  console.log('=== keyword_trend ===');
  const kw = await client.fetchKeywordData('爷爷不泡茶', '酸奶');
  console.log(JSON.stringify(kw, null, 2));

  // 2. asset_analyse
  console.log('\n=== asset_analyse ===');
  const brand = await client.fetchBrandData('爷爷不泡茶');
  console.log(JSON.stringify(brand, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
