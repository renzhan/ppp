import { describe, it, expect } from 'vitest';
import { parseNoteIds } from './note-id-parser';

describe('parseNoteIds', () => {
  describe('基本分隔符支持', () => {
    it('应解析逗号分隔的笔记 ID', () => {
      const result = parseNoteIds('abc123,def456,ghi789');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应解析换行分隔的笔记 ID', () => {
      const result = parseNoteIds('abc123\ndef456\nghi789');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应解析 Windows 换行符 (\\r\\n) 分隔的笔记 ID', () => {
      const result = parseNoteIds('abc123\r\ndef456\r\nghi789');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应解析混合分隔符（逗号 + 换行）', () => {
      const result = parseNoteIds('abc123,def456\nghi789');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应解析混合分隔符（逗号 + Windows 换行）', () => {
      const result = parseNoteIds('abc123,def456\r\nghi789');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });
  });

  describe('空白处理', () => {
    it('应去除每个 ID 前后的空白', () => {
      const result = parseNoteIds('  abc123 , def456 , ghi789  ');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应去除换行分隔时每个 ID 前后的空白', () => {
      const result = parseNoteIds('  abc123  \n  def456  \n  ghi789  ');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应过滤空字符串（连续分隔符）', () => {
      const result = parseNoteIds('abc123,,def456,,,ghi789');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应过滤连续换行产生的空项', () => {
      const result = parseNoteIds('abc123\n\n\ndef456');
      expect(result).toEqual(['abc123', 'def456']);
    });
  });

  describe('去重', () => {
    it('应去除重复的笔记 ID', () => {
      const result = parseNoteIds('abc123,def456,abc123,ghi789,def456');
      expect(result).toEqual(['abc123', 'def456', 'ghi789']);
    });

    it('应保持首次出现的顺序', () => {
      const result = parseNoteIds('ghi789,abc123,def456,abc123');
      expect(result).toEqual(['ghi789', 'abc123', 'def456']);
    });
  });

  describe('边界情况', () => {
    it('空字符串应返回空数组', () => {
      expect(parseNoteIds('')).toEqual([]);
    });

    it('仅空白字符应返回空数组', () => {
      expect(parseNoteIds('   ')).toEqual([]);
    });

    it('仅分隔符应返回空数组', () => {
      expect(parseNoteIds(',,,\n\n,')).toEqual([]);
    });

    it('单个 ID 应返回包含该 ID 的数组', () => {
      expect(parseNoteIds('abc123')).toEqual(['abc123']);
    });

    it('单个 ID 带空白应返回去除空白后的 ID', () => {
      expect(parseNoteIds('  abc123  ')).toEqual(['abc123']);
    });
  });
});
