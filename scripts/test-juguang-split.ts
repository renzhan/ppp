import 'dotenv/config';
import { JuguangClient } from '../src/ingestion/juguang-client.js';

async function main() {
  const client = new JuguangClient({
    baseUrl: process.env.JUGUANG_BASE_URL || '',
    apiKey: process.env.JUGUANG_API_KEY || '',
  });

  // 3 天跨度，验证日期拆分
  console.log('参数: advertiserId=9389821, startDate=2026-04-10, endDate=2026-04-12\n');
  const start = Date.now();
  const r = await client.fetchJuguangData([9389821], '2026-04-10', '2026-04-12');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`返回 ${r.length} 条 | 耗时: ${elapsed}s`);

  // 按日期分组展示
  const byDate = new Map<string, number>();
  for (const row of r) {
    const d = row.time || '(none)';
    byDate.set(d, (byDate.get(d) || 0) + 1);
  }
  for (const [date, count] of byDate) {
    console.log(`  ${date}: ${count} 条`);
  }

  // 展示第一条
  if (r.length > 0) {
    console.log('\n示例 (第一条):');
    console.log(JSON.stringify(r[0], null, 2));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
