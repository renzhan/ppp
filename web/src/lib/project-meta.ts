export const PROJECT_TYPES = [
  '新品上市',
  '日常种草',
  '节点营销',
  '竞品防御',
] as const;

export const PROJECT_STATUS_ORDER = [
  'draft',
  'uploading',
  'generating',
  'reviewing',
  'finalized',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUS_ORDER)[number];
export type LaunchPhaseKey = 'preheat' | 'burst' | 'sustain';

export interface LaunchPhaseRange {
  startDate: string;
  endDate: string;
}

export interface LaunchPhases {
  preheat: LaunchPhaseRange;
  burst: LaunchPhaseRange;
  sustain: LaunchPhaseRange;
}

export const LAUNCH_PHASES: Array<{
  key: LaunchPhaseKey;
  label: string;
  shortLabel: string;
  accentClass: string;
}> = [
  {
    key: 'preheat',
    label: '预热期',
    shortLabel: '预热',
    accentClass: 'bg-sky-50 text-sky-700',
  },
  {
    key: 'burst',
    label: '爆发期',
    shortLabel: '爆发',
    accentClass: 'bg-rose-50 text-rose-700',
  },
  {
    key: 'sustain',
    label: '持续期',
    shortLabel: '持续',
    accentClass: 'bg-lime-50 text-lime-700',
  },
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: '待复盘',
  uploading: '待复盘',
  generating: '生成中',
  reviewing: '待审校',
  finalized: '终版',
};

export const PROJECT_STATUS_BADGES: Record<ProjectStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  uploading: 'bg-gray-100 text-gray-700',
  generating: 'bg-amber-100 text-amber-700',
  reviewing: 'bg-violet-100 text-violet-700',
  finalized: 'bg-emerald-100 text-emerald-700',
};

export function isProjectType(value: string): value is ProjectType {
  return PROJECT_TYPES.includes(value as ProjectType);
}

export function createEmptyLaunchPhases(): LaunchPhases {
  return {
    preheat: { startDate: '', endDate: '' },
    burst: { startDate: '', endDate: '' },
    sustain: { startDate: '', endDate: '' },
  };
}

export function normalizeLaunchPhases(input: unknown): LaunchPhases {
  const empty = createEmptyLaunchPhases();
  if (!input || typeof input !== 'object') {
    return empty;
  }

  const source = input as Record<string, unknown>;

  const readPhase = (key: LaunchPhaseKey): LaunchPhaseRange => {
    const phase = source[key];
    if (!phase || typeof phase !== 'object') {
      return empty[key];
    }
    const record = phase as Record<string, unknown>;
    return {
      startDate: typeof record.startDate === 'string' ? record.startDate : '',
      endDate: typeof record.endDate === 'string' ? record.endDate : '',
    };
  };

  return {
    preheat: readPhase('preheat'),
    burst: readPhase('burst'),
    sustain: readPhase('sustain'),
  };
}

export function getProjectDateRange(phases: LaunchPhases): { startDate: string; endDate: string } {
  const dates = Object.values(phases)
    .flatMap((phase) => [phase.startDate, phase.endDate])
    .filter(Boolean)
    .sort();

  return {
    startDate: dates[0] || '',
    endDate: dates[dates.length - 1] || '',
  };
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '-';
  }

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}
