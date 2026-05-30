'use client';

import { useEffect, useRef } from 'react';

interface WordCloudProps {
  words: Array<{ word: string; count: number }>;
}

/**
 * 词云组件 - 基于 wordcloud2.js
 * 自动占满父容器，词语按频次比例缩放填满整个区域。
 */
export function WordCloud({ words }: WordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || words.length === 0) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;

    // 获取容器实际尺寸
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    if (w === 0 || h === 0) return;

    // canvas 尺寸 = 容器尺寸（不做 2x，wordcloud2 按像素布局）
    canvas.width = w;
    canvas.height = h;

    // 动态 import wordcloud2 (避免 SSR 问题)
    import('wordcloud').then((WordCloud2) => {
      const wc = WordCloud2.default || WordCloud2;

      const maxCount = words[0]?.count || 1;

      // list 格式: [[word, weight], ...]，weight 用原始 count
      const list: [string, number][] = words.map((item) => [item.word, item.count]);

      // 根据容器面积和词数计算缩放系数，让词语尽量填满
      // 经验公式：最大词的字号 ≈ 容器短边 / 4
      const maxFontSize = Math.min(w, h) / 4;
      const factor = maxFontSize / maxCount;

      // 蓝色系配色
      const colors = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

      wc(canvas, {
        list,
        gridSize: 2,
        weightFactor: (size: number) => Math.max(12, size * factor),
        fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
        color: () => colors[Math.floor(Math.random() * colors.length)],
        rotateRatio: 0.25,
        rotationSteps: 2,
        backgroundColor: 'transparent',
        drawOutOfBound: false,
      });
    });
  }, [words]);

  if (words.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
        暂无关键词数据
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
