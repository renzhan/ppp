import 'dotenv/config';

const BASE = process.env.JUGUANG_BASE_URL || '';
const KEY = process.env.JUGUANG_API_KEY || '';

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function fetchPage(advertiserId: number, date: string, page: number): Promise<any> {
  const url = `${BASE}/api/v1/juguang/proxy/reports/note`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      start_date: date,
      end_date: date,
      page_num: page,
      page_size: 500,
      time_unit: 'SUMMARY',
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as any;
  if (json.code !== 0) throw new Error(`API error: code=${json.code}`);
  return json;
}

async function fetchAll(advertiserId: number, date: string): Promise<string[]> {
  const noteIds = new Set<string>();
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const json = await fetchPage(advertiserId, date, page);
    const rows = json.data?.data_list ?? [];
    for (const r of rows) if (r.note_id) noteIds.add(r.note_id);
    hasMore = page * 500 < (json.data?.total_count ?? 0);
    page++;
  }
  return [...noteIds].sort();
}

async function main() {
  const dates = dateRange('2026-05-29', '2026-06-10');
  const allNotes = new Set<string>();
  const byDate: Record<string, string[]> = {};

  for (const date of dates) {
    try {
      const ids = await fetchAll(9389821, date);
      byDate[date] = ids;
      ids.forEach(id => allNotes.add(id));
      console.log(`${date}: ${ids.length} 条`);
    } catch (e: any) {
      console.log(`${date}: 失败 (${e.message})`);
    }
  }

  console.log(`\n--- 汇总 ---`);
  console.log(`共 ${allNotes.size} 个不重复 noteId`);
  console.log(`\n各天明细:`);
  for (const date of dates) {
    const ids = byDate[date] || [];
    console.log(`${date}: ${ids.join(', ') || '(无)'}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });

/*
这个脚本执行为 npx tsx scripts/check-juguang-notes.ts

https://uwqzuoh533d.feishu.cn/sheets/M37KsSjfZh0sVXt6kDFcPLzTn1c

以下为您提供的ID在每日数据中出现的情况列表（按ID排序，日期范围2026-05-29至2026-06-10）：

- `6a1c1ac80000000035029463`：2026-06-01、2026-06-02、2026-06-03
- `6a1c2434000000003601c0cc`：2026-06-01、2026-06-02、2026-06-03
- `6a1c2af70000000006036621`：2026-06-01、2026-06-02、2026-06-03、2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-10（注：缺2026-06-09）
- `6a1c312e000000003601bbf6`：2026-06-01、2026-06-02、2026-06-03
- `6a200f120000000036032a08`：2026-06-03、2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a2014d800000000350386b8`：2026-06-03、2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a2116ec00000000350240e1`：2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a213297000000000702e290`：2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a21344a0000000022024980`：2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a21346c0000000022014d40`：2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a214af700000000370376da`：2026-06-04、2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a2261980000000021008204`：2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a2270950000000008000bd3`：2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a22762b000000003601f875`：2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a228b69000000003600232c`：2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a22a0c2000000002202bdb9`：2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a22a2230000000006034f15`：2026-06-05、2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a23d31100000000150260b7`：2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a23d95200000000220173cb`：2026-06-06、2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a251fef0000000017009356`：2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a253a9a000000002202ded8`：2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a2546f3000000001700bde7`：2026-06-07、2026-06-08、2026-06-09、2026-06-10
- `6a265ba30000000035024948`：2026-06-08、2026-06-09、2026-06-10
- `6a2666c4000000001702fee5`：2026-06-08、2026-06-09、2026-06-10
- `6a2668950000000021008a14`：2026-06-08、2026-06-09、2026-06-10
- `6a2691c40000000022016288`：2026-06-09、2026-06-10

以上即为所有命中ID的逐日出现情况。
*/