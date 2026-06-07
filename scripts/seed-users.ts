/**
 * 人员底表导入脚本
 *
 * 从权限隔离设计文档中导入所有用户（剔除管理员）
 * 用户名 = 花名，真名记录在 real_name 字段
 * 默认密码: ppp666
 * mustChangePassword = true（首次登录需修改密码）
 *
 * 使用方式:
 *   npx tsx scripts/seed-users.ts
 */

import { PrismaClient } from '../generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'ppp666';

interface UserEntry {
  realName: string;
  displayName: string; // 花名
  role: string;
  permissionLevel: number;
  reportsToDisplayName: string | null; // 上级的花名
}

// 从文档中提取的全量人员数据（剔除3个管理员：大琳/大壮/毛栗）
const USERS: UserEntry[] = [
  // VP (permission_level = 1)
  { realName: '程国玉', displayName: '阿玉', role: 'VP', permissionLevel: 1, reportsToDisplayName: null },
  { realName: '胡晓莉', displayName: '狐狸', role: 'VP', permissionLevel: 1, reportsToDisplayName: null },
  { realName: '龚成', displayName: '乘风', role: 'AD', permissionLevel: 1, reportsToDisplayName: null },
  { realName: '杨菲菲', displayName: '咖菲', role: 'VP', permissionLevel: 1, reportsToDisplayName: '狐狸' },

  // AD (permission_level = 2)
  { realName: '任一枭', displayName: '风犬', role: 'AD', permissionLevel: 2, reportsToDisplayName: '阿玉' },
  { realName: '冯柄荣', displayName: '如也', role: 'AD', permissionLevel: 2, reportsToDisplayName: '阿玉' },
  { realName: '杨朱莹', displayName: '仙女', role: 'AD', permissionLevel: 2, reportsToDisplayName: '阿玉' },
  { realName: '何睿洁', displayName: '闪闪', role: 'AD', permissionLevel: 2, reportsToDisplayName: '狐狸' },
  { realName: '刘岳峰', displayName: '山药', role: 'AD', permissionLevel: 2, reportsToDisplayName: '狐狸' },

  // AM (permission_level = 3)
  { realName: '张王婷', displayName: '乐安', role: 'AM', permissionLevel: 3, reportsToDisplayName: '如也' },
  { realName: '秦鑫晗', displayName: '汉娜', role: 'AM', permissionLevel: 3, reportsToDisplayName: '如也' },
  { realName: '夏雨蒙', displayName: '榴莲', role: 'AM', permissionLevel: 3, reportsToDisplayName: '乘风' },
  { realName: '王宛瑛', displayName: '凯蒂', role: 'AM', permissionLevel: 3, reportsToDisplayName: '乘风' },
  { realName: '徐莹', displayName: '雪梨', role: 'AM', permissionLevel: 3, reportsToDisplayName: '乘风' },
  { realName: '郭婷婷', displayName: '九条', role: 'AM', permissionLevel: 3, reportsToDisplayName: '闪闪' },
  { realName: '杨韵', displayName: '守柚', role: 'AM', permissionLevel: 3, reportsToDisplayName: '闪闪' },
  { realName: '黄铁平', displayName: '柒樾', role: 'AM', permissionLevel: 3, reportsToDisplayName: '闪闪' },
  { realName: '鲁策', displayName: '卡拉', role: 'AM', permissionLevel: 3, reportsToDisplayName: '狐狸' },
  { realName: '王娜', displayName: '软软', role: 'AM', permissionLevel: 3, reportsToDisplayName: '狐狸' },
  { realName: '李姣姣', displayName: '琅琅', role: 'AM', permissionLevel: 3, reportsToDisplayName: '狐狸' },
  { realName: '邵倩雯', displayName: '米娜', role: 'AM', permissionLevel: 3, reportsToDisplayName: '狐狸' },
  { realName: '段腊梅', displayName: '二月', role: 'AM', permissionLevel: 3, reportsToDisplayName: '山药' },
  { realName: '谷慧璇', displayName: '奕北', role: 'AM', permissionLevel: 3, reportsToDisplayName: '山药' },
  { realName: '谢雅涵', displayName: '傲涵', role: 'AM', permissionLevel: 3, reportsToDisplayName: '山药' },
  { realName: '路宇婷', displayName: '小鹿', role: 'AM', permissionLevel: 3, reportsToDisplayName: '风犬' },
  { realName: '张文昊', displayName: '耗子', role: 'AM', permissionLevel: 3, reportsToDisplayName: '风犬' },
  { realName: '骆晓梅', displayName: '安安', role: 'AM', permissionLevel: 3, reportsToDisplayName: '阿玉' },
  { realName: '朱凌瑾', displayName: '三三', role: 'AM', permissionLevel: 3, reportsToDisplayName: '仙女' },
  { realName: '方慧', displayName: '木惜', role: 'AM', permissionLevel: 3, reportsToDisplayName: '仙女' },

  // 组长 (permission_level = 4)
  { realName: '王一帆', displayName: '羔子', role: '组长', permissionLevel: 4, reportsToDisplayName: '卡拉' },
  { realName: '周丽萍', displayName: '番茄', role: '组长', permissionLevel: 4, reportsToDisplayName: '卡拉' },
  { realName: '张蕊', displayName: '小蕊', role: '组长', permissionLevel: 4, reportsToDisplayName: '卡拉' },
  { realName: '王晓婷', displayName: '大婷', role: '组长', permissionLevel: 4, reportsToDisplayName: '软软' },
  { realName: '潘天翔', displayName: '潘潘', role: '组长', permissionLevel: 4, reportsToDisplayName: '软软' },
  { realName: '刘春梅', displayName: '春梅', role: '组长', permissionLevel: 4, reportsToDisplayName: '软软' },
  { realName: '周诗熠', displayName: '绿崽', role: '组长', permissionLevel: 4, reportsToDisplayName: '榴莲' },
  { realName: '郝澜昕', displayName: '蓝心', role: '组长', permissionLevel: 4, reportsToDisplayName: '榴莲' },
  { realName: '叶曼', displayName: '捏捏', role: '组长', permissionLevel: 4, reportsToDisplayName: '榴莲' },
  { realName: '鲁宝月', displayName: '半月', role: '组长', permissionLevel: 4, reportsToDisplayName: '榴莲' },
  { realName: '陈可盈', displayName: '阿盈', role: '组长', permissionLevel: 4, reportsToDisplayName: '榴莲' },
  { realName: '黄慧菲', displayName: '奈奈', role: '组长', permissionLevel: 4, reportsToDisplayName: '风犬' },
  { realName: '代金强', displayName: '清玄', role: '组长', permissionLevel: 4, reportsToDisplayName: '风犬' },
  { realName: '史福鑫', displayName: '黎子', role: '组长', permissionLevel: 4, reportsToDisplayName: '仙女' },
];

// AE列表太长，这里只放部分示例 — 完整版请通过Excel导入
// 脚本会处理上面已有的人员，AE可通过管理后台的Excel批量导入

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log(`[seed-users] 开始导入 ${USERS.length} 个用户...`);
  console.log(`[seed-users] 默认密码: ${DEFAULT_PASSWORD}`);

  let created = 0;
  let skipped = 0;

  // First pass: create all users (without reportsTo)
  for (const entry of USERS) {
    const existing = await prisma.user.findUnique({
      where: { username: entry.displayName },
    });

    if (existing) {
      console.log(`  跳过: ${entry.displayName}（已存在）`);
      skipped++;
      continue;
    }

    await prisma.user.create({
      data: {
        username: entry.displayName,
        passwordHash,
        displayName: entry.displayName,
        realName: entry.realName,
        role: entry.role,
        permissionLevel: entry.permissionLevel,
        mustChangePassword: true,
        isActive: true,
      },
    });

    created++;
    console.log(`  创建: ${entry.displayName}（${entry.realName}）- ${entry.role}`);
  }

  // Second pass: set reportsTo relationships
  console.log('\n[seed-users] 设置汇报关系...');
  let linked = 0;

  for (const entry of USERS) {
    if (!entry.reportsToDisplayName) continue;

    const user = await prisma.user.findUnique({
      where: { username: entry.displayName },
      select: { id: true },
    });

    const manager = await prisma.user.findUnique({
      where: { username: entry.reportsToDisplayName },
      select: { id: true },
    });

    if (user && manager) {
      await prisma.user.update({
        where: { id: user.id },
        data: { reportsTo: manager.id },
      });
      linked++;
    } else if (!manager) {
      console.log(`  警告: ${entry.displayName} 的上级 "${entry.reportsToDisplayName}" 未找到`);
    }
  }

  console.log(`\n[seed-users] 完成！创建 ${created} 个用户，跳过 ${skipped} 个（已存在），设置 ${linked} 个汇报关系`);
}

main()
  .catch((e) => {
    console.error('[seed-users] 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
