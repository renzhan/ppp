import { PrismaClient } from '../../../generated/prisma';

/**
 * Context returned by a chapter data loader.
 * Contains loaded template variables and a list of fields that couldn't be loaded.
 */
export interface ChapterDataContext {
  variables: Record<string, string>; // Template variable values
  missingFields: string[];           // Fields that couldn't be loaded
  traceItems: TraceItem[];           // Paragraph-level traceability data
}

/**
 * A single trace item representing the data source for one paragraph/table in the report.
 */
export interface TraceItem {
  traceId: string;                   // e.g. "ch3_kpi_table"
  chapterNumber: number;
  label: string;                     // Display name, e.g. "KPI达成数据"
  sourceTable: string;               // e.g. "notes + kpi_targets"
  sourceQuery: string;               // SQL query text
  totalRows: number;
  columns: TraceColumn[];
  dataRows: Record<string, unknown>[];
  calculations?: CalculationTrace[];
}

export interface TraceColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

export interface CalculationTrace {
  metric: string;
  formula: string;
  inputs: Record<string, number | string>;
  result: number | string;
}

/**
 * Interface for chapter-specific data loaders.
 * Each chapter has its own loader that knows which data sources to query.
 */
export interface ChapterDataLoader {
  chapterNumber: number;
  chapterName: string;
  requiredDataSources: string[]; // e.g., ['projects', 'notes', 'kpi_targets']
  requiredFields: string[];      // All fields this loader is expected to provide

  load(projectId: string): Promise<ChapterDataContext>;
}

/**
 * Registry that maps chapter numbers to their data loader instances.
 * Provides a unified interface for loading chapter data.
 */
export class ChapterDataLoaderRegistry {
  private loaders: Map<number, ChapterDataLoader> = new Map();

  register(loader: ChapterDataLoader): void {
    this.loaders.set(loader.chapterNumber, loader);
  }

  getLoader(chapterNumber: number): ChapterDataLoader {
    const loader = this.loaders.get(chapterNumber);
    if (!loader) {
      throw new Error(`No loader registered for chapter ${chapterNumber}`);
    }
    return loader;
  }

  getAllLoaders(): ChapterDataLoader[] {
    return Array.from(this.loaders.values());
  }

  hasLoader(chapterNumber: number): boolean {
    return this.loaders.has(chapterNumber);
  }

  async loadChapterData(chapterNumber: number, projectId: string): Promise<ChapterDataContext> {
    const loader = this.getLoader(chapterNumber);
    return loader.load(projectId);
  }
}

/**
 * Base class for chapter data loaders that provides common Prisma client access
 * and graceful degradation utilities.
 */
export abstract class BaseChapterDataLoader implements ChapterDataLoader {
  abstract chapterNumber: number;
  abstract chapterName: string;
  abstract requiredDataSources: string[];
  abstract requiredFields: string[];

  constructor(protected prisma: InstanceType<typeof PrismaClient>) {}

  abstract load(projectId: string): Promise<ChapterDataContext>;

  /**
   * Helper to build a ChapterDataContext from loaded variables.
   * Automatically computes missingFields as the difference between
   * requiredFields and the keys present in variables.
   */
  protected buildContext(variables: Record<string, string>, traceItems: TraceItem[] = []): ChapterDataContext {
    const loadedKeys = Object.keys(variables).filter((k) => variables[k] !== undefined && variables[k] !== '');
    const missingFields = this.requiredFields.filter((f) => !loadedKeys.includes(f));
    // Remove empty-string entries from variables for missing fields
    const cleanVariables: Record<string, string> = {};
    for (const key of loadedKeys) {
      cleanVariables[key] = variables[key];
    }
    return { variables: cleanVariables, missingFields, traceItems };
  }
}
