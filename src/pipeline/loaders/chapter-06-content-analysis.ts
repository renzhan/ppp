import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 6 (Content Analysis) Data Loader
 * Loads metrics grouped by contentDirection, noteType, kolType
 * from notes joined with business_annotations.
 */
export class ContentAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 6;
  chapterName = '内容分析';
  requiredDataSources = ['notes', 'business_annotations'];
  requiredFields = ['by_content_direction', 'by_note_type', 'by_kol_type'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      // Load notes
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          noteType: true,
          impNum: true,
          readNum: true,
          engageNum: true,
          kolPrice: true,
          serviceFee: true,
        },
      });

      // Load business annotations
      const annotations = await this.prisma.businessAnnotation.findMany({
        where: { projectId },
        select: {
          noteId: true,
          contentDirection: true,
          kolType: true,
        },
      });

      if (notes.length > 0) {
        const annotationMap = new Map(annotations.map((a) => [a.noteId, a]));

        // Group by content direction
        const byContentDirection = new Map<string, { count: number; imp: number; read: number; engage: number; cost: number }>();
        // Group by note type
        const byNoteType = new Map<string, { count: number; imp: number; read: number; engage: number; cost: number }>();
        // Group by kol type
        const byKolType = new Map<string, { count: number; imp: number; read: number; engage: number; cost: number }>();

        for (const note of notes) {
          const annotation = annotationMap.get(note.noteId);
          const cost = Number(note.kolPrice) + Number(note.serviceFee);

          // By content direction
          const direction = annotation?.contentDirection || '未分类';
          if (!byContentDirection.has(direction)) {
            byContentDirection.set(direction, { count: 0, imp: 0, read: 0, engage: 0, cost: 0 });
          }
          const dirGroup = byContentDirection.get(direction)!;
          dirGroup.count++;
          dirGroup.imp += note.impNum;
          dirGroup.read += note.readNum;
          dirGroup.engage += note.engageNum;
          dirGroup.cost += cost;

          // By note type
          const noteType = note.noteType || '未分类';
          if (!byNoteType.has(noteType)) {
            byNoteType.set(noteType, { count: 0, imp: 0, read: 0, engage: 0, cost: 0 });
          }
          const typeGroup = byNoteType.get(noteType)!;
          typeGroup.count++;
          typeGroup.imp += note.impNum;
          typeGroup.read += note.readNum;
          typeGroup.engage += note.engageNum;
          typeGroup.cost += cost;

          // By kol type
          const kolType = annotation?.kolType || '未分类';
          if (!byKolType.has(kolType)) {
            byKolType.set(kolType, { count: 0, imp: 0, read: 0, engage: 0, cost: 0 });
          }
          const kolGroup = byKolType.get(kolType)!;
          kolGroup.count++;
          kolGroup.imp += note.impNum;
          kolGroup.read += note.readNum;
          kolGroup.engage += note.engageNum;
          kolGroup.cost += cost;
        }

        const mapToArray = (map: Map<string, { count: number; imp: number; read: number; engage: number; cost: number }>) =>
          Array.from(map.entries()).map(([name, data]) => ({
            name,
            ...data,
            cpm: data.imp > 0 ? ((data.cost / data.imp) * 1000).toFixed(2) : '0',
            cpc: data.read > 0 ? (data.cost / data.read).toFixed(2) : '0',
            cpe: data.engage > 0 ? (data.cost / data.engage).toFixed(2) : '0',
            ctr: data.imp > 0 ? ((data.read / data.imp) * 100).toFixed(2) : '0',
          }));

        variables['by_content_direction'] = JSON.stringify(mapToArray(byContentDirection));
        variables['by_note_type'] = JSON.stringify(mapToArray(byNoteType));
        variables['by_kol_type'] = JSON.stringify(mapToArray(byKolType));
      }
    } catch (error) {
      console.warn(`[ContentAnalysisDataLoader] Failed to load data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
