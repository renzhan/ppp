/**
 * Mock data module for raw Pugongying (蒲公英) notes.
 *
 * Simulates the data structure returned by the fetchRawNotes API
 * (developed by another team). Used for development self-testing
 * of the export Excel feature.
 */

export interface RawPugongyingNote {
  noteId: string;
  noteTitle: string;
  noteLink: string;
  kolNickName: string;
  kolId: string;
  kolFanNum: number;
  noteType: string;           // 视频/图文
  publishTime: string;        // ISO datetime
  impNum: number;             // 曝光量
  readNum: number;            // 阅读量
  engageNum: number;          // 互动量
  likeNum: number;            // 点赞量
  favNum: number;             // 收藏量
  cmtNum: number;             // 评论量
  shareNum: number;           // 分享量
  followNum: number;          // 关注量
  kolPrice: number;           // 达人报价
  serviceFee: number;         // 服务费
  totalPlatformPrice: number; // 总平台价格
  cpm: number;                // CPM
  cpe: number;                // CPE
  engageRate: number;         // 互动率
}

/**
 * Returns mock raw Pugongying notes data for development/testing.
 * Simulates what fetchRawNotes would return.
 */
export function getMockRawNotes(noteIds?: string[]): RawPugongyingNote[] {
  const allNotes: RawPugongyingNote[] = [
    {
      noteId: '6973179a000000002203aac5',
      noteTitle: '夏日清爽妆容分享｜日常通勤必备',
      noteLink: 'https://www.xiaohongshu.com/explore/6973179a000000002203aac5',
      kolNickName: '美妆小达人Luna',
      kolId: 'kol_001',
      kolFanNum: 523000,
      noteType: '视频',
      publishTime: '2025-03-15T10:30:00.000Z',
      impNum: 185000,
      readNum: 42000,
      engageNum: 3200,
      likeNum: 2100,
      favNum: 680,
      cmtNum: 320,
      shareNum: 100,
      followNum: 85,
      kolPrice: 15000,
      serviceFee: 2250,
      totalPlatformPrice: 17250,
      cpm: 93.24,
      cpe: 5.39,
      engageRate: 0.0762,
    },
    {
      noteId: '6a0c3abd000000003701d3b8',
      noteTitle: '拆箱测评！新品面霜真的好用吗？',
      noteLink: 'https://www.xiaohongshu.com/explore/6a0c3abd000000003701d3b8',
      kolNickName: '护肤研究员小周',
      kolId: 'kol_002',
      kolFanNum: 1280000,
      noteType: '图文',
      publishTime: '2025-03-18T14:00:00.000Z',
      impNum: 320000,
      readNum: 89000,
      engageNum: 7500,
      likeNum: 4800,
      favNum: 1900,
      cmtNum: 580,
      shareNum: 220,
      followNum: 150,
      kolPrice: 35000,
      serviceFee: 5250,
      totalPlatformPrice: 40250,
      cpm: 125.78,
      cpe: 5.37,
      engageRate: 0.0843,
    },
    {
      noteId: '6a0c0fc3000000003601f68b',
      noteTitle: '一周穿搭合集｜职场新人必看',
      noteLink: 'https://www.xiaohongshu.com/explore/6a0c0fc3000000003601f68b',
      kolNickName: '穿搭日记Coco',
      kolId: 'kol_003',
      kolFanNum: 89000,
      noteType: '图文',
      publishTime: '2025-03-20T09:15:00.000Z',
      impNum: 56000,
      readNum: 15000,
      engageNum: 1100,
      likeNum: 720,
      favNum: 250,
      cmtNum: 90,
      shareNum: 40,
      followNum: 30,
      kolPrice: 5000,
      serviceFee: 750,
      totalPlatformPrice: 5750,
      cpm: 102.68,
      cpe: 5.23,
      engageRate: 0.0733,
    },
    {
      noteId: '6b1a2cd0000000004502e7f1',
      noteTitle: '宝宝辅食这样做，营养又好吃！',
      noteLink: 'https://www.xiaohongshu.com/explore/6b1a2cd0000000004502e7f1',
      kolNickName: '辣妈厨房日记',
      kolId: 'kol_004',
      kolFanNum: 2150000,
      noteType: '视频',
      publishTime: '2025-03-22T16:45:00.000Z',
      impNum: 580000,
      readNum: 156000,
      engageNum: 12800,
      likeNum: 8200,
      favNum: 3400,
      cmtNum: 860,
      shareNum: 340,
      followNum: 210,
      kolPrice: 58000,
      serviceFee: 8700,
      totalPlatformPrice: 66700,
      cpm: 115.0,
      cpe: 5.21,
      engageRate: 0.0821,
    },
    {
      noteId: '6c2b3de1000000005603f802',
      noteTitle: '小个子女生如何穿出170既视感',
      noteLink: 'https://www.xiaohongshu.com/explore/6c2b3de1000000005603f802',
      kolNickName: '时尚博主安安',
      kolId: 'kol_005',
      kolFanNum: 345000,
      noteType: '图文',
      publishTime: '2025-03-25T11:20:00.000Z',
      impNum: 128000,
      readNum: 35000,
      engageNum: 2600,
      likeNum: 1700,
      favNum: 580,
      cmtNum: 230,
      shareNum: 90,
      followNum: 55,
      kolPrice: 12000,
      serviceFee: 1800,
      totalPlatformPrice: 13800,
      cpm: 107.81,
      cpe: 5.31,
      engageRate: 0.0743,
    },
    {
      noteId: '6d3c4ef2000000006704a913',
      noteTitle: '全网最火的减脂餐，吃了一个月瘦8斤',
      noteLink: 'https://www.xiaohongshu.com/explore/6d3c4ef2000000006704a913',
      kolNickName: '健身达人小王',
      kolId: 'kol_006',
      kolFanNum: 780000,
      noteType: '视频',
      publishTime: '2025-03-28T08:00:00.000Z',
      impNum: 420000,
      readNum: 112000,
      engageNum: 9800,
      likeNum: 6300,
      favNum: 2500,
      cmtNum: 720,
      shareNum: 280,
      followNum: 180,
      kolPrice: 28000,
      serviceFee: 4200,
      totalPlatformPrice: 32200,
      cpm: 76.67,
      cpe: 3.29,
      engageRate: 0.0875,
    },
    {
      noteId: '6e4d5f03000000007805ba24',
      noteTitle: '家居好物分享｜租房改造低成本方案',
      noteLink: 'https://www.xiaohongshu.com/explore/6e4d5f03000000007805ba24',
      kolNickName: '居家生活家小李',
      kolId: 'kol_007',
      kolFanNum: 156000,
      noteType: '图文',
      publishTime: '2025-04-01T13:30:00.000Z',
      impNum: 72000,
      readNum: 19000,
      engageNum: 1450,
      likeNum: 920,
      favNum: 350,
      cmtNum: 130,
      shareNum: 50,
      followNum: 40,
      kolPrice: 6500,
      serviceFee: 975,
      totalPlatformPrice: 7475,
      cpm: 103.82,
      cpe: 5.16,
      engageRate: 0.0763,
    },
  ];

  if (noteIds && noteIds.length > 0) {
    return allNotes.filter((n) => noteIds.includes(n.noteId));
  }
  return allNotes;
}
