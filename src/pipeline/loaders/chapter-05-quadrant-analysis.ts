import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 5 (Quadrant Analysis) Data Loader
 * Loads per-note CPE, CPM, CPC, CTR and juguang metrics for quadrant classification.
 */
export class QuadrantAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 5;
  chapterName = '综合分析';
  requiredDataSources = ['notes', 'juguang_data'];
  requiredFields = ['per_note_metrics', 'quadrant_summary'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      // Load notes with their metrics
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          kolNickName: true,
          noteType: true,
          impNum: true,
          readNum: true,
          engageNum: true,
          kolPrice: true,
          serviceFee: true,
        },
      });

      // Load juguang data for paid metrics
      const juguangData = await this.prisma.juguangData.findMany({
        where: { projectId },
        select: {
          noteId: true,
          fee: true,
          impression: true,
          click: true,
          interaction: true,
        },
      });

      if (notes.length > 0) {
        const juguangMap = new Map(
          juguangData.filter((j) => j.noteId).map((j) => [j.noteId!, j])
        );

        const perNoteMetrics = notes.map((note) => {
          const totalCost = Number(note.kolPrice) + Number(note.serviceFee);
          const juguang = juguangMap.get(note.noteId);

          return {
            noteId: note.noteId,
            kolNickName: note.kolNickName,
            noteType: note.noteType,
            impNum: note.impNum,
            readNum: note.readNum,
            engageNum: note.engageNum,
            totalCost,
            cpm: note.impNum > 0 ? ((totalCost / note.impNum) * 1000) : 0,
            cpc: note.readNum > 0 ? (totalCost / note.readNum) : 0,
            cpe: note.engageNum > 0 ? (totalCost / note.engageNum) : 0,
            ctr: note.impNum > 0 ? ((note.readNum / note.impNum) * 100) : 0,
            hasPaidTraffic: !!juguang,
            paidFee: juguang ? Number(juguang.fee) : 0,
            paidImpression: juguang ? juguang.impression : 0,
            paidClick: juguang ? juguang.click : 0,
            paidInteraction: juguang ? juguang.interaction : 0,
          };
        });

        variables['per_note_metrics'] = JSON.stringify(perNoteMetrics);

        // Compute quadrant summary (high/low engagement vs high/low cost)
        const avgCpe = perNoteMetrics.reduce((sum, n) => sum + n.cpe, 0) / perNoteMetrics.length;
        const avgEngagement = perNoteMetrics.reduce((sum, n) => sum + n.engageNum, 0) / perNoteMetrics.length;

        const quadrants = {
          highEngLowCost: perNoteMetrics.filter((n) => n.engageNum >= avgEngagement && n.cpe <= avgCpe).length,
          highEngHighCost: perNoteMetrics.filter((n) => n.engageNum >= avgEngagement && n.cpe > avgCpe).length,
          lowEngLowCost: perNoteMetrics.filter((n) => n.engageNum < avgEngagement && n.cpe <= avgCpe).length,
          lowEngHighCost: perNoteMetrics.filter((n) => n.engageNum < avgEngagement && n.cpe > avgCpe).length,
        };

        variables['quadrant_summary'] = JSON.stringify(quadrants);
      }
    } catch (error) {
      console.warn(`[QuadrantAnalysisDataLoader] Failed to load data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
