/**
 * PPT Orchestration Layer
 *
 * Orchestrates PPT generation from marketing review reports.
 * Assembles report content into markdown format and delegates
 * AI-powered slide generation to the Presenton backend.
 *
 * Key responsibilities:
 * - Assemble report data into Presenton-compatible markdown content
 * - Call Presenton API for presentation generation
 * - Map responses to edit/download URLs
 * - Provide async job-based generation with polling
 * - Never mutate source report data
 */

import {
  PresentonClient,
  getPresentonClient,
  type GenerateRequest,
  type PresentationResponse,
} from '../lib/presenton-client.js';

// --- Data Types ---

export interface Project {
  id: string;
  name: string;
  brand: string;
  category: string;
  platform?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
}

export interface Paragraph {
  text: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ChartConfig {
  type: string;
  title?: string;
  data?: unknown;
}

export interface ModuleData {
  status: 'show' | 'hide';
  paragraphs: Paragraph[];
  tables: TableData[];
  charts: ChartConfig[];
}

export type ModuleKey = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';

export interface ReportData {
  projectId: string;
  modules: Record<ModuleKey, ModuleData>;
  metrics?: unknown;
  narrative?: unknown;
  generatedAt?: Date;
}

export interface PPTGenerateOptions {
  slideCount?: number;
  language?: string;
  template?: string;
  tone?: string;
  verbosity?: string;
  instructions?: string;
}

export interface PPTGenerateResult {
  presentationId: string;
  editUrl: string;
  downloadUrl: string;
}

// --- Job Store Types ---

export type JobStatus = 'pending' | 'completed' | 'failed';

export interface PPTJob {
  id: string;
  projectId: string;
  status: JobStatus;
  result?: PPTGenerateResult;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// --- Module Name Mapping ---

const MODULE_NAMES: Record<ModuleKey, string> = {
  M1: 'Executive Summary',
  M2: 'Market Analysis',
  M3: 'Content Performance',
  M4: 'Traffic Analysis',
  M5: 'Audience Insights',
  M6: 'Competitive Landscape',
  M7: 'Recommendations',
  M8: 'Appendix',
};

// --- Content Assembly ---

/**
 * Formats a table as a valid markdown table string.
 * Returns empty string if table has no headers or rows.
 */
export function formatMarkdownTable(table: Readonly<TableData>): string {
  if (!table.headers || table.headers.length === 0) {
    return '';
  }
  if (!table.rows || table.rows.length === 0) {
    return '';
  }

  const headerRow = `| ${table.headers.join(' | ')} |`;
  const separatorRow = `| ${table.headers.map(() => '---').join(' | ')} |`;
  const dataRows = table.rows
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');

  return `${headerRow}\n${separatorRow}\n${dataRows}`;
}

/**
 * Assembles report content into a markdown string suitable for Presenton API.
 *
 * Preconditions:
 * - project is non-null with valid name, brand, category fields
 * - reportData contains modules (may have none with status 'show')
 *
 * Postconditions:
 * - Returns non-empty markdown string with project metadata header
 * - All 'show' modules are represented in output
 * - Tables are formatted as valid markdown tables
 * - Source reportData is NOT mutated (read-only access)
 */
export function assemblePrestonContent(
  project: Readonly<Project>,
  reportData: Readonly<ReportData>
): string {
  const sections: string[] = [];

  // Project metadata header
  sections.push(`# ${project.name}`);
  sections.push('');
  sections.push(`**Brand:** ${project.brand}`);
  sections.push(`**Category:** ${project.category}`);
  if (project.platform) {
    sections.push(`**Platform:** ${project.platform}`);
  }
  sections.push('');

  // Process modules - only include those with status 'show'
  const moduleKeys = Object.keys(reportData.modules) as ModuleKey[];

  for (const key of moduleKeys) {
    const moduleData = reportData.modules[key];
    if (!moduleData || moduleData.status !== 'show') {
      continue;
    }

    const moduleName = MODULE_NAMES[key] || key;
    sections.push(`## ${moduleName}`);
    sections.push('');

    // Add paragraphs
    if (moduleData.paragraphs && moduleData.paragraphs.length > 0) {
      for (const paragraph of moduleData.paragraphs) {
        if (paragraph.text) {
          sections.push(paragraph.text);
          sections.push('');
        }
      }
    }

    // Add tables as markdown
    if (moduleData.tables && moduleData.tables.length > 0) {
      for (const table of moduleData.tables) {
        const markdownTable = formatMarkdownTable(table);
        if (markdownTable) {
          sections.push(markdownTable);
          sections.push('');
        }
      }
    }
  }

  return sections.join('\n');
}

// --- Orchestration ---

/**
 * Builds generation instructions based on project context.
 */
function buildInstructions(brand: string, category: string): string {
  return `Create a professional marketing review presentation for brand "${brand}" in the "${category}" category. Focus on key metrics, insights, and actionable recommendations.`;
}

/**
 * Orchestrates PPT generation from a marketing review report.
 *
 * Preconditions:
 * - project and reportData are valid and non-null
 * - Presenton backend is available
 *
 * Postconditions:
 * - Returns valid presentation ID and accessible URLs
 * - No mutations to the source report data
 */
export async function orchestratePPTGeneration(
  project: Readonly<Project>,
  reportData: Readonly<ReportData>,
  options: PPTGenerateOptions = {},
  client?: PresentonClient
): Promise<PPTGenerateResult> {
  const presentonClient = client ?? getPresentonClient();

  // Step 1: Assemble content from report
  const content = assemblePrestonContent(project, reportData);
  if (content.length === 0) {
    throw new Error('Assembled content is empty - cannot generate presentation');
  }

  // Step 2: Build generation request
  const instructions = options.instructions ?? buildInstructions(project.brand, project.category);

  const request: GenerateRequest = {
    content,
    n_slides: options.slideCount ?? 15,
    language: options.language ?? 'zh',
    template: options.template ?? 'general',
    tone: options.tone ?? 'professional',
    verbosity: options.verbosity ?? 'standard',
    instructions,
    include_title_slide: true,
    export_as: 'pptx',
  };

  // Step 3: Call Presenton API
  const presentonResult: PresentationResponse = await presentonClient.generatePresentation(request);

  if (!presentonResult.presentation_id) {
    throw new Error('Presenton API returned empty presentation_id');
  }

  // Step 4: Map response to URLs
  return {
    presentationId: presentonResult.presentation_id,
    editUrl: `/presentation/${presentonResult.presentation_id}`,
    downloadUrl: presentonClient.getDownloadUrl(presentonResult.path),
  };
}

// --- Async Job Store ---

const jobStore = new Map<string, PPTJob>();

let jobCounter = 0;

function generateJobId(): string {
  jobCounter += 1;
  return `ppt-job-${Date.now()}-${jobCounter}`;
}

/**
 * Starts an async PPT generation job.
 * Returns a job ID immediately; the actual generation runs in the background.
 *
 * Postconditions:
 * - Returns job ID immediately without waiting for generation
 * - Job status can be polled via getPPTJobStatus
 */
export function startPPTGeneration(
  project: Readonly<Project>,
  reportData: Readonly<ReportData>,
  options: PPTGenerateOptions = {},
  client?: PresentonClient
): string {
  const jobId = generateJobId();

  const job: PPTJob = {
    id: jobId,
    projectId: project.id,
    status: 'pending',
    createdAt: new Date(),
  };

  jobStore.set(jobId, job);

  // Run generation in the background (fire-and-forget)
  orchestratePPTGeneration(project, reportData, options, client)
    .then((result) => {
      const storedJob = jobStore.get(jobId);
      if (storedJob) {
        storedJob.status = 'completed';
        storedJob.result = result;
        storedJob.completedAt = new Date();
      }
    })
    .catch((error) => {
      const storedJob = jobStore.get(jobId);
      if (storedJob) {
        storedJob.status = 'failed';
        storedJob.error = error instanceof Error ? error.message : String(error);
        storedJob.completedAt = new Date();
      }
    });

  return jobId;
}

/**
 * Gets the current status of a PPT generation job.
 * Returns undefined if the job ID is not found.
 */
export function getPPTJobStatus(jobId: string): PPTJob | undefined {
  return jobStore.get(jobId);
}

/**
 * Clears all jobs from the store. Useful for testing.
 */
export function clearJobStore(): void {
  jobStore.clear();
  jobCounter = 0;
}
