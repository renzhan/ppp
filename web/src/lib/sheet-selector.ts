export interface SheetSelectionResult {
  success: boolean;
  sheetName: string | null;
  error: string | null;
}

const TARGET_SHEET_NAME = '已发布达人';

/**
 * 根据工作簿的sheet列表选择目标sheet。
 * - 单sheet文件：直接返回该sheet名
 * - 多sheet文件：查找名为"已发布达人"的sheet
 * - 多sheet但无目标sheet：返回错误
 */
export function selectTargetSheet(sheetNames: string[]): SheetSelectionResult {
  if (sheetNames.length === 1) {
    return { success: true, sheetName: sheetNames[0], error: null };
  }

  const target = sheetNames.find((name) => name === TARGET_SHEET_NAME);

  if (target) {
    return { success: true, sheetName: target, error: null };
  }

  return {
    success: false,
    sheetName: null,
    error: '未找到名为【已发布达人】的工作表，请检查文件格式',
  };
}
