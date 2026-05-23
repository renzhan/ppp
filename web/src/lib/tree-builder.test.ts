import { describe, it, expect } from 'vitest';
import { buildTreeStructure, flattenTreeToTuples, type ProjectRow } from './tree-builder';

describe('buildTreeStructure', () => {
  it('should build a nested tree from flat rows', () => {
    const rows: ProjectRow[] = [
      { category: '美妆', brand: '兰蔻', businessLine: '护肤' },
      { category: '美妆', brand: '兰蔻', businessLine: '彩妆' },
      { category: '美妆', brand: '雅诗兰黛', businessLine: '护肤' },
      { category: '食品', brand: '三只松鼠', businessLine: '坚果' },
    ];

    const tree = buildTreeStructure(rows);

    expect(tree).toHaveLength(2);

    const beauty = tree.find((n) => n.label === '美妆');
    expect(beauty).toBeDefined();
    expect(beauty!.children).toHaveLength(2);

    const lancome = beauty!.children!.find((n) => n.label === '兰蔻');
    expect(lancome).toBeDefined();
    expect(lancome!.children).toHaveLength(2);
    expect(lancome!.children!.map((n) => n.label).sort()).toEqual(['彩妆', '护肤']);

    const estee = beauty!.children!.find((n) => n.label === '雅诗兰黛');
    expect(estee).toBeDefined();
    expect(estee!.children).toHaveLength(1);
    expect(estee!.children![0].label).toBe('护肤');

    const food = tree.find((n) => n.label === '食品');
    expect(food).toBeDefined();
    expect(food!.children).toHaveLength(1);
    expect(food!.children![0].label).toBe('三只松鼠');
    expect(food!.children![0].children![0].label).toBe('坚果');
  });

  it('should deduplicate identical rows', () => {
    const rows: ProjectRow[] = [
      { category: '美妆', brand: '兰蔻', businessLine: '护肤' },
      { category: '美妆', brand: '兰蔻', businessLine: '护肤' },
      { category: '美妆', brand: '兰蔻', businessLine: '护肤' },
    ];

    const tree = buildTreeStructure(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].children).toHaveLength(1);
  });

  it('should return empty array for empty input', () => {
    const tree = buildTreeStructure([]);
    expect(tree).toEqual([]);
  });
});

describe('flattenTreeToTuples', () => {
  it('should flatten tree back to tuple strings', () => {
    const rows: ProjectRow[] = [
      { category: '美妆', brand: '兰蔻', businessLine: '护肤' },
      { category: '美妆', brand: '兰蔻', businessLine: '彩妆' },
      { category: '食品', brand: '三只松鼠', businessLine: '坚果' },
    ];

    const tree = buildTreeStructure(rows);
    const tuples = flattenTreeToTuples(tree);

    expect(tuples.size).toBe(3);
    expect(tuples.has('美妆|兰蔻|护肤')).toBe(true);
    expect(tuples.has('美妆|兰蔻|彩妆')).toBe(true);
    expect(tuples.has('食品|三只松鼠|坚果')).toBe(true);
  });

  it('should return empty set for empty tree', () => {
    const tuples = flattenTreeToTuples([]);
    expect(tuples.size).toBe(0);
  });

  it('should handle tree nodes without children gracefully', () => {
    const tree = [{ id: 'cat1', label: 'cat1' }];
    const tuples = flattenTreeToTuples(tree);
    expect(tuples.size).toBe(0);
  });

  it('roundtrip: buildTreeStructure then flattenTreeToTuples preserves unique tuples', () => {
    const rows: ProjectRow[] = [
      { category: 'A', brand: 'B1', businessLine: 'L1' },
      { category: 'A', brand: 'B1', businessLine: 'L2' },
      { category: 'A', brand: 'B2', businessLine: 'L1' },
      { category: 'C', brand: 'B3', businessLine: 'L3' },
      // duplicate
      { category: 'A', brand: 'B1', businessLine: 'L1' },
    ];

    const tree = buildTreeStructure(rows);
    const tuples = flattenTreeToTuples(tree);

    const expectedTuples = new Set(
      rows.map((r) => `${r.category}|${r.brand}|${r.businessLine}`)
    );

    expect(tuples.size).toBe(expectedTuples.size);
    for (const t of expectedTuples) {
      expect(tuples.has(t)).toBe(true);
    }
  });
});
