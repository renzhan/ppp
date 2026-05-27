import { PrismaClient } from '../../../generated/prisma';
import { ChapterDataLoaderRegistry } from './types';
import { CoverDataLoader } from './chapter-01-cover';
import { ProjectReviewDataLoader } from './chapter-02-project-review';
import { DataOverviewDataLoader } from './chapter-03-data-overview';
import { HighlightsDataLoader } from './chapter-04-highlights';
import { QuadrantAnalysisDataLoader } from './chapter-05-quadrant-analysis';
import { ContentAnalysisDataLoader } from './chapter-06-content-analysis';
import { TrafficAnalysisDataLoader } from './chapter-07-traffic-analysis';
import { AudienceAssetsDataLoader } from './chapter-08-audience-assets';
import { OptimizationDataLoader } from './chapter-09-optimization';
import { EndPageDataLoader } from './chapter-10-end-page';

export { ChapterDataLoaderRegistry, BaseChapterDataLoader } from './types';
export type { ChapterDataContext, ChapterDataLoader } from './types';
export { CoverDataLoader } from './chapter-01-cover';
export { ProjectReviewDataLoader } from './chapter-02-project-review';
export { DataOverviewDataLoader } from './chapter-03-data-overview';
export { HighlightsDataLoader } from './chapter-04-highlights';
export { QuadrantAnalysisDataLoader } from './chapter-05-quadrant-analysis';
export { ContentAnalysisDataLoader } from './chapter-06-content-analysis';
export { TrafficAnalysisDataLoader } from './chapter-07-traffic-analysis';
export { AudienceAssetsDataLoader } from './chapter-08-audience-assets';
export { OptimizationDataLoader } from './chapter-09-optimization';
export { EndPageDataLoader } from './chapter-10-end-page';

/**
 * Creates a fully configured ChapterDataLoaderRegistry with all 10 chapter loaders registered.
 */
export function createChapterDataLoaderRegistry(prisma: InstanceType<typeof PrismaClient>): ChapterDataLoaderRegistry {
  const registry = new ChapterDataLoaderRegistry();

  registry.register(new CoverDataLoader(prisma));
  registry.register(new ProjectReviewDataLoader(prisma));
  registry.register(new DataOverviewDataLoader(prisma));
  registry.register(new HighlightsDataLoader(prisma));
  registry.register(new QuadrantAnalysisDataLoader(prisma));
  registry.register(new ContentAnalysisDataLoader(prisma));
  registry.register(new TrafficAnalysisDataLoader(prisma));
  registry.register(new AudienceAssetsDataLoader(prisma));
  registry.register(new OptimizationDataLoader(prisma));
  registry.register(new EndPageDataLoader(prisma));

  return registry;
}
