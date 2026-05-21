/**
 * 笔记 ID 解析器
 * 支持逗号分隔、换行分隔、混合分隔的笔记 ID 批量解析
 */

/**
 * 解析用户输入的笔记 ID 字符串，返回去重、去空白的 ID 数组。
 *
 * 支持的分隔符：
 * - 逗号 (,)
 * - 换行符 (\n, \r\n, \r)
 * - 混合使用以上分隔符
 *
 * @param input - 用户输入的原始字符串
 * @returns 去重后的笔记 ID 数组（保持首次出现顺序）
 */
export function parseNoteIds(input: string): string[] {
  if (!input || !input.trim()) {
    return [];
  }

  // 使用正则按逗号或换行符分割
  const ids = input
    .split(/[,\n\r]+/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  // 去重（保持首次出现顺序）
  return [...new Set(ids)];
}
