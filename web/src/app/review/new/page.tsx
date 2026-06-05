'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Upload, FileText, AlertCircle, ArrowLeft } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { validateRangeInput } from '@/lib/range-validator';
import { selectAllModules, deselectAllModules } from '@/lib/module-toggle';

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Generate a UUID-like ID compatible with non-secure contexts (HTTP).
 * crypto.randomUUID() is only available in Secure Contexts (HTTPS/localhost).
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  projectName: string;
  category: string;
  brand: string;
  businessLine: string | null;
  noteCount: number;
}

interface InfluencerTier {
  id: string;
  name: string;
  fanRangeMin: number;
  fanRangeMax: number;
}

interface LaunchPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface BenchmarkRangeData {
  ctr: { min: string; max: string };
  cpm: { min: string; max: string };
  cpc: { min: string; max: string };
  cpe: { min: string; max: string };
  engagementRate: { min: string; max: string };
}

interface KpiTargets {
  totalImpression: string;
  totalRead: string;
  totalEngagement: string;
  viralPosts1k: string;
  viralPosts10k: string;
  cpm: string;
  cpc: string;
  cpe: string;
  ctr: string;
  audienceBrandTotal: string;
  audienceBrandTi: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_INFLUENCER_TIERS: InfluencerTier[] = [
  { id: generateId(), name: '头部', fanRangeMin: 1000000, fanRangeMax: 99999999 },
  { id: generateId(), name: '腰部', fanRangeMin: 100000, fanRangeMax: 999999 },
  { id: generateId(), name: '尾部', fanRangeMin: 10000, fanRangeMax: 99999 },
];

const DEFAULT_LAUNCH_PHASES: LaunchPhase[] = [
  { id: generateId(), name: '预热期', startDate: '', endDate: '' },
  { id: generateId(), name: '爆发期', startDate: '', endDate: '' },
  { id: generateId(), name: '持续期', startDate: '', endDate: '' },
];

const REPORT_MODULES = [
  { key: 'projectReview', label: '项目回顾' },
  { key: 'dataOverview', label: '数据总揽' },
  { key: 'highlights', label: '项目亮点' },
  { key: 'comprehensiveAnalysis', label: '综合分析' },
  { key: 'contentAnalysis', label: '内容分析（笔记侧）' },
  { key: 'launchAnalysis', label: '投流分析' },
  { key: 'optimization', label: '优化建议' },
] as const;

const ALLOWED_PLAN_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt'];

// ─── Page Component ──────────────────────────────────────────────────────────

export default function NewReviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewReviewPageContent />
    </Suspense>
  );
}

function NewReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId') || '';
  const editFromId = searchParams.get('editId') || '';
  // ─── Form State ──────────────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId);
  const [benchmark, setBenchmark] = useState<BenchmarkRangeData>({
    ctr: { min: '', max: '' },
    cpm: { min: '', max: '' },
    cpc: { min: '', max: '' },
    cpe: { min: '', max: '' },
    engagementRate: { min: '', max: '' },
  });
  const [influencerTiers, setInfluencerTiers] = useState<InfluencerTier[]>(DEFAULT_INFLUENCER_TIERS);
  const [kpiTargets, setKpiTargets] = useState<KpiTargets>({
    totalImpression: '', totalRead: '', totalEngagement: '',
    viralPosts1k: '', viralPosts10k: '',
    cpm: '', cpc: '', cpe: '', ctr: '',
    audienceBrandTotal: '',
    audienceBrandTi: '',
  });
  const [engagementMetric, setEngagementMetric] = useState<'exclude_follow' | 'include_follow'>('exclude_follow');
  const [viralMetric, setViralMetric] = useState<'like_comment_share' | 'like_only'>('like_comment_share');
  const [modules, setModules] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    REPORT_MODULES.forEach((m) => { initial[m.key] = true; });
    return initial;
  });
  const [launchPhases, setLaunchPhases] = useState<LaunchPhase[]>(DEFAULT_LAUNCH_PHASES);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [planFileName, setPlanFileName] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [contentCostCaliber, setContentCostCaliber] = useState<'consumption' | 'settlement'>('consumption');
  const [trafficCostCaliber, setTrafficCostCaliber] = useState<'consumption' | 'settlement'>('consumption');
  const [viralThreshold, setViralThreshold] = useState<string>('1000');
  const [hasUnofficialCooperation, setHasUnofficialCooperation] = useState<boolean>(false);
  const [executionPeriodStart, setExecutionPeriodStart] = useState('');
  const [executionPeriodEnd, setExecutionPeriodEnd] = useState('');
  const [historicalAcquisitionCost, setHistoricalAcquisitionCost] = useState('');
  const [advertiserIds, setAdvertiserIds] = useState<string[]>([]);
  const [advertiserIdInput, setAdvertiserIdInput] = useState('');
  const [advertiserIdError, setAdvertiserIdError] = useState<string | null>(null);
  const [benchmarkErrors, setBenchmarkErrors] = useState<Record<string, string | null>>({});
  const [tierError, setTierError] = useState<string | null>(null);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  // ─── Data Fetching ───────────────────────────────────────────────────────
  // Fetch project info by projectId (from URL param or edit mode)
  const { data: projectInfo, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: ['project-info', selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${selectedProjectId}`);
      if (!res.ok) throw new Error('获取项目信息失败');
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  // Redirect to project list if no projectId provided (and not in edit mode)
  useEffect(() => {
    if (!preselectedProjectId && !editFromId) {
      router.push('/projects?message=请从项目列表选择项目进行复盘');
    }
  }, [preselectedProjectId, editFromId, router]);



  // ─── Edit Mode: Load existing review config ──────────────────────────────
  const { data: editReview } = useQuery<{
    id: string;
    projectId: string;
    benchmark: Record<string, number | { min: number; max: number } | null>;
    influencerTiers: InfluencerTier[];
    kpiTargets: Record<string, number | null>;
    engagementMetric: string;
    viralMetric: string;
    modules: Record<string, unknown>;
    launchPhases: LaunchPhase[];
    advertiserIds: string[];
    planFileName: string | null;
    planFileUrl: string | null;
  }>({
    queryKey: ['review-for-edit', editFromId],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${editFromId}`);
      if (!res.ok) throw new Error('获取复盘配置失败');
      return res.json();
    },
    enabled: !!editFromId,
  });

  // Pre-fill form when edit data is loaded
  useEffect(() => {
    if (!editReview) return;

    setSelectedProjectId(editReview.projectId);

    // Pre-fill benchmark (backward compatible: single value → { min: value, max: value })
    if (editReview.benchmark) {
      const bm: BenchmarkRangeData = {
        ctr: { min: '', max: '' },
        cpm: { min: '', max: '' },
        cpc: { min: '', max: '' },
        cpe: { min: '', max: '' },
        engagementRate: { min: '', max: '' },
      };
      Object.entries(editReview.benchmark).forEach(([k, v]) => {
        if (k in bm) {
          if (v != null && typeof v === 'object' && 'min' in v && 'max' in v) {
            // New range format
            (bm as any)[k] = {
              min: v.min != null ? String(v.min) : '',
              max: v.max != null ? String(v.max) : '',
            };
          } else if (v != null) {
            // Old single-value format → convert to { min: value, max: value }
            const strVal = String(v);
            (bm as any)[k] = { min: strVal, max: strVal };
          }
        }
      });
      setBenchmark(bm);
    }

    // Pre-fill KPI targets (ignore removed fields)
    if (editReview.kpiTargets) {
      const removedKpiFields = ['searchIndex', 'socSov', 'audienceSpuTotal', 'audienceSpuTi'];
      const kpi: any = {};
      Object.entries(editReview.kpiTargets).forEach(([k, v]) => {
        if (!removedKpiFields.includes(k)) {
          kpi[k] = v != null ? String(v) : '';
        }
      });
      setKpiTargets((prev) => ({ ...prev, ...kpi }));
    }

    // Pre-fill influencer tiers
    if (editReview.influencerTiers?.length) {
      setInfluencerTiers(editReview.influencerTiers);
    }

    // Pre-fill engagement/viral metric
    if (editReview.engagementMetric) {
      setEngagementMetric(editReview.engagementMetric as any);
    }
    if (editReview.viralMetric) {
      setViralMetric(editReview.viralMetric as any);
    }

    // Pre-fill modules (ignore removed modules: audienceAnalysis, competitorAnalysis)
    if (editReview.modules) {
      const removedModules = ['audienceAnalysis', 'competitorAnalysis'];
      const mods: Record<string, boolean> = {};
      Object.entries(editReview.modules).forEach(([k, v]) => {
        if (k === 'contentCostCaliber') {
          setContentCostCaliber(v as any);
        } else if (k === 'trafficCostCaliber') {
          setTrafficCostCaliber(v as any);
        } else if (!removedModules.includes(k)) {
          mods[k] = !!v;
        }
      });
      if (Object.keys(mods).length > 0) setModules((prev) => ({ ...prev, ...mods }));
    }

    // Pre-fill launch phases
    if (editReview.launchPhases?.length) {
      setLaunchPhases(editReview.launchPhases);
    }

    // Pre-fill advertiser IDs
    if (editReview.advertiserIds?.length) {
      setAdvertiserIds(editReview.advertiserIds);
    }

    // Pre-fill plan file name (display only, can't restore the actual file)
    if (editReview.planFileName) {
      setPlanFileName(editReview.planFileName);
    }
  }, [editReview]);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const createReview = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '创建复盘失败');
      }
      return res.json();
    },
    onSuccess: async (review) => {
      // Upload plan file if selected
      if (planFile) {
        const formData = new FormData();
        formData.append('file', planFile);
        await fetch(`/api/reviews/${review.id}/plan-upload`, {
          method: 'POST',
          body: formData,
        });
      }

      // If advertiserIds were provided, wait for ingestion to complete before redirecting
      // The POST /api/reviews already triggered ingestion server-side,
      // but we also trigger pugongying base data fetch here and wait
      if (advertiserIds.length > 0 || selectedProjectId) {
        setSubmitError(null);
        try {
          // Trigger base data ingestion (pugongying notes) and wait
          await fetch(`/api/upload/api-fetch?projectId=${selectedProjectId}`, {
            method: 'POST',
          });
        } catch {
          // Don't block on failure — data may still come from cron
        }
      }

      // Redirect to proofread page
      router.push(`/review/${review.id}/proofread`);
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleAddTier = () => {
    setInfluencerTiers([...influencerTiers, {
      id: generateId(),
      name: '',
      fanRangeMin: 0,
      fanRangeMax: 0,
    }]);
  };

  const handleRemoveTier = (id: string) => {
    setInfluencerTiers(influencerTiers.filter((t) => t.id !== id));
  };

  const handleTierChange = (id: string, field: keyof InfluencerTier, value: string | number) => {
    setInfluencerTiers(influencerTiers.map((t) =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleAddPhase = () => {
    setLaunchPhases([...launchPhases, {
      id: generateId(),
      name: '',
      startDate: '',
      endDate: '',
    }]);
  };

  const handleRemovePhase = (id: string) => {
    setLaunchPhases(launchPhases.filter((p) => p.id !== id));
  };

  const handlePhaseChange = (id: string, field: keyof LaunchPhase, value: string) => {
    setLaunchPhases(launchPhases.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleModuleToggle = (key: string) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePlanFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_PLAN_EXTENSIONS.includes(ext)) {
      setSubmitError('策划方案仅支持 .pdf、.docx、.doc、.pptx、.ppt 格式');
      return;
    }
    setPlanFile(file);
    setPlanFileName(file.name);
    setSubmitError(null);
  };

  // ─── Validation Helpers ─────────────────────────────────────────────────
  const validateBenchmarks = (): boolean => {
    const errors: Record<string, string | null> = {};
    let valid = true;
    Object.entries(benchmark).forEach(([key, { min, max }]) => {
      const minVal = min.trim() ? parseFloat(min) : null;
      const maxVal = max.trim() ? parseFloat(max) : null;
      if (minVal !== null && minVal < 0) {
        errors[key] = '最小值不能为负数';
        valid = false;
      } else if (maxVal !== null && maxVal < 0) {
        errors[key] = '最大值不能为负数';
        valid = false;
      } else if (minVal !== null && maxVal !== null && minVal > maxVal) {
        errors[key] = '最小值不能大于最大值';
        valid = false;
      } else {
        errors[key] = null;
      }
    });
    setBenchmarkErrors(errors);
    return valid;
  };

  const validateInfluencerTiers = (): boolean => {
    if (influencerTiers.length <= 1) {
      setTierError(null);
      return true;
    }
    // Sort tiers by fanRangeMin descending (头部 first, larger fans)
    const sorted = [...influencerTiers].sort((a, b) => b.fanRangeMin - a.fanRangeMin);
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentLower = sorted[i].fanRangeMin;
      const nextUpper = sorted[i + 1].fanRangeMax;
      // The current tier's lower bound should equal the next tier's upper bound + 1 (continuous ranges)
      if (nextUpper + 1 !== currentLower) {
        setTierError(`层级"${sorted[i].name || `第${i + 1}层`}"下限(${currentLower})与"${sorted[i + 1].name || `第${i + 2}层`}"上限(${nextUpper})不连续，相邻层级应头尾相接`);
        return false;
      }
    }
    setTierError(null);
    return true;
  };

  const validateLaunchPhases = (): boolean => {
    // Only validate phases that have dates filled
    const filledPhases = launchPhases.filter((p) => p.startDate && p.endDate);
    if (filledPhases.length <= 1) {
      setPhaseError(null);
      return true;
    }
    // Check each phase's own start <= end
    for (const phase of filledPhases) {
      if (phase.startDate > phase.endDate) {
        setPhaseError(`阶段"${phase.name || '未命名'}"的开始日期晚于结束日期`);
        return false;
      }
    }
    // Sort by startDate for chronological check
    const sorted = [...filledPhases].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endDate > sorted[i + 1].startDate) {
        setPhaseError(`阶段"${sorted[i].name || `第${i + 1}阶段`}"与"${sorted[i + 1].name || `第${i + 2}阶段`}"时间存在重叠`);
        return false;
      }
    }
    setPhaseError(null);
    return true;
  };

  const handleSubmit = () => {
    setSubmitError(null);

    if (!selectedProjectId) {
      setSubmitError('请选择关联项目');
      return;
    }

    // Check note count
    if (projectInfo && projectInfo.noteCount === 0) {
      setSubmitError('请先为该项目上传笔记底表，再开始复盘');
      return;
    }

    // Validate benchmarks
    const benchmarkValid = validateBenchmarks();
    const tiersValid = validateInfluencerTiers();
    const phasesValid = validateLaunchPhases();
    if (!benchmarkValid || !tiersValid || !phasesValid) {
      setSubmitError('请修正表单中的错误后再提交');
      return;
    }

    const parsedBenchmark: Record<string, { min: number | null; max: number | null }> = {};
    Object.entries(benchmark).forEach(([k, v]) => {
      parsedBenchmark[k] = {
        min: v.min ? parseFloat(v.min) : null,
        max: v.max ? parseFloat(v.max) : null,
      };
    });

    const parsedKpi: Record<string, number | null> = {};
    Object.entries(kpiTargets).forEach(([k, v]) => {
      parsedKpi[k] = v ? parseFloat(v) : null;
    });

    createReview.mutate({
      projectId: selectedProjectId,
      benchmark: parsedBenchmark,
      influencerTiers,
      kpiTargets: parsedKpi,
      engagementMetric,
      viralMetric,
      viralThreshold: viralThreshold ? parseInt(viralThreshold) : null,
      modules: { ...modules, contentCostCaliber, trafficCostCaliber },
      launchPhases,
      hasUnofficialCooperation,
      executionPeriod: executionPeriodStart && executionPeriodEnd
        ? { start: executionPeriodStart, end: executionPeriodEnd }
        : null,
      historicalAcquisitionCost: historicalAcquisitionCost ? parseFloat(historicalAcquisitionCost) : null,
      advertiserIds: advertiserIds.filter(Boolean),
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{editFromId ? '编辑复盘' : '新建复盘'}</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">{editFromId ? '修改复盘参数，将基于新参数生成新的复盘报告' : '配置复盘参数，系统将基于笔记数据生成复盘报告'}</p>
      </div>

      {/* Section: 项目信息 */}
      <FormSection title="项目信息">
        {(isProjectLoading || (editFromId && !selectedProjectId)) ? (
          <div className="flex items-center justify-center py-4">
            <Loading size="sm" />
            <span className="ml-2 text-sm text-gray-500">加载项目信息...</span>
          </div>
        ) : projectInfo ? (
          <div className="grid grid-cols-2 gap-4 rounded-md border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4">
            <div>
              <span className="block text-xs text-gray-500">项目名称</span>
              <span className="text-sm font-medium text-gray-800">{projectInfo.projectName || '-'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">品类</span>
              <span className="text-sm font-medium text-gray-800">{projectInfo.category || '-'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">品牌</span>
              <span className="text-sm font-medium text-gray-800">{projectInfo.brand || '-'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">业务线</span>
              <span className="text-sm font-medium text-gray-800">{projectInfo.businessLine || '-'}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertCircle size={16} />
            <span>未找到项目信息，请从项目列表选择项目进行复盘</span>
          </div>
        )}
      </FormSection>



      {/* Section: 大盘数据 */}
      <FormSection title="大盘数据">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RangeInput
            label="CTR (%)"
            minValue={benchmark.ctr.min}
            maxValue={benchmark.ctr.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, ctr: { ...benchmark.ctr, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, ctr: { ...benchmark.ctr, max: v } })}
            error={benchmarkErrors.ctr}
          />
          <RangeInput
            label="CPM"
            minValue={benchmark.cpm.min}
            maxValue={benchmark.cpm.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, cpm: { ...benchmark.cpm, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, cpm: { ...benchmark.cpm, max: v } })}
            error={benchmarkErrors.cpm}
          />
          <RangeInput
            label="CPC"
            minValue={benchmark.cpc.min}
            maxValue={benchmark.cpc.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, cpc: { ...benchmark.cpc, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, cpc: { ...benchmark.cpc, max: v } })}
            error={benchmarkErrors.cpc}
          />
          <RangeInput
            label="CPE"
            minValue={benchmark.cpe.min}
            maxValue={benchmark.cpe.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, cpe: { ...benchmark.cpe, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, cpe: { ...benchmark.cpe, max: v } })}
            error={benchmarkErrors.cpe}
          />
          <RangeInput
            label="互动率 (%)"
            minValue={benchmark.engagementRate.min}
            maxValue={benchmark.engagementRate.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, engagementRate: { ...benchmark.engagementRate, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, engagementRate: { ...benchmark.engagementRate, max: v } })}
            error={benchmarkErrors.engagementRate}
          />
        </div>
      </FormSection>

      {/* Section: 达人层级配置 */}
      <FormSection title="达人层级配置">
        <div className="space-y-3">
          {influencerTiers.map((tier) => (
            <div key={tier.id} className="flex items-center gap-3">
              <input
                type="text"
                placeholder="层级名称"
                value={tier.name}
                onChange={(e) => handleTierChange(tier.id, 'name', e.target.value)}
                className="w-28 rounded-sm border border-gray-300 px-3 h-10 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <input
                type="number"
                placeholder="粉丝下限"
                value={tier.fanRangeMin || ''}
                onChange={(e) => handleTierChange(tier.id, 'fanRangeMin', Number(e.target.value))}
                className="w-32 rounded-sm border border-gray-300 px-3 h-10 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder="粉丝上限"
                value={tier.fanRangeMax || ''}
                onChange={(e) => handleTierChange(tier.id, 'fanRangeMax', Number(e.target.value))}
                className="w-32 rounded-sm border border-gray-300 px-3 h-10 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="button"
                onClick={() => handleRemoveTier(tier.id)}
                className="rounded p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddTier}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand"
          >
            <Plus size={14} />
            添加层级
          </button>
          {tierError && <p className="mt-2 text-xs text-rose-500">{tierError}</p>}
        </div>
      </FormSection>

      {/* Section: KPI目标配置 */}
      <FormSection title="复盘目标（KPI）">
        <div className="space-y-4">
          {/* 是否有（非官方）合作 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-600">是否有（非官方）合作</label>
            <div className="flex gap-4">
              <RadioOption
                name="hasUnofficialCooperation"
                value="yes"
                checked={hasUnofficialCooperation === true}
                onChange={() => setHasUnofficialCooperation(true)}
                label="是"
              />
              <RadioOption
                name="hasUnofficialCooperation"
                value="no"
                checked={hasUnofficialCooperation === false}
                onChange={() => setHasUnofficialCooperation(false)}
                label="否"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <NumberInput label="总曝光" value={kpiTargets.totalImpression} onChange={(v) => setKpiTargets({ ...kpiTargets, totalImpression: v })} />
            <NumberInput label="总阅读" value={kpiTargets.totalRead} onChange={(v) => setKpiTargets({ ...kpiTargets, totalRead: v })} />
            <NumberInput label="总互动" value={kpiTargets.totalEngagement} onChange={(v) => setKpiTargets({ ...kpiTargets, totalEngagement: v })} />
            <NumberInput label="爆文数" value={kpiTargets.viralPosts1k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts1k: v })} />
            <NumberInput label="爆文率(%)" value={kpiTargets.viralPosts10k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts10k: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <NumberInput label="CPM" value={kpiTargets.cpm} onChange={(v) => setKpiTargets({ ...kpiTargets, cpm: v })} />
            <NumberInput label="CPC" value={kpiTargets.cpc} onChange={(v) => setKpiTargets({ ...kpiTargets, cpc: v })} />
            <NumberInput label="CPE" value={kpiTargets.cpe} onChange={(v) => setKpiTargets({ ...kpiTargets, cpe: v })} />
            <NumberInput label="CTR (%)" value={kpiTargets.ctr} onChange={(v) => setKpiTargets({ ...kpiTargets, ctr: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <NumberInput label="人群资产-总-品牌" value={kpiTargets.audienceBrandTotal} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTotal: v })} />
            <NumberInput label="人群资产-TI-品牌" value={kpiTargets.audienceBrandTi} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTi: v })} />
          </div>
        </div>
      </FormSection>

      {/* Section: 统计口径选择 */}
      <FormSection title="统计口径选择">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-600">互动统计口径</label>
            <div className="flex gap-4">
              <RadioOption
                name="engagementMetric"
                value="exclude_follow"
                checked={engagementMetric === 'exclude_follow'}
                onChange={() => setEngagementMetric('exclude_follow')}
                label="不含关注"
              />
              <RadioOption
                name="engagementMetric"
                value="include_follow"
                checked={engagementMetric === 'include_follow'}
                onChange={() => setEngagementMetric('include_follow')}
                label="含关注"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-600">爆文统计口径</label>
            <div className="flex items-center gap-4">
              <RadioOption
                name="viralMetric"
                value="like_comment_share"
                checked={viralMetric === 'like_comment_share'}
                onChange={() => setViralMetric('like_comment_share')}
                label="转评赞"
              />
              <RadioOption
                name="viralMetric"
                value="like_only"
                checked={viralMetric === 'like_only'}
                onChange={() => setViralMetric('like_only')}
                label="赞"
              />
              <div className="ml-4 flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">爆文阈值（赞数）</label>
                <input
                  type="number"
                  min={1}
                  value={viralThreshold}
                  onChange={(e) => setViralThreshold(e.target.value)}
                  placeholder="1000"
                  className="w-28 rounded-sm border border-gray-300 px-3 h-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Section: 金额口径 */}
      <FormSection title="金额口径">
        <div className="space-y-4">
          {/* 内容金额口径 */}
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <label className="mb-2 block text-xs font-medium text-gray-600">内容金额口径</label>
            <div className="flex gap-4">
              <RadioOption
                name="contentCostCaliber"
                value="consumption"
                checked={contentCostCaliber === 'consumption'}
                onChange={() => setContentCostCaliber('consumption')}
                label="内容消耗金额（博主报价+平台服务费）"
              />
              <RadioOption
                name="contentCostCaliber"
                value="settlement"
                checked={contentCostCaliber === 'settlement'}
                onChange={() => setContentCostCaliber('settlement')}
                label="内容结算金额"
              />
            </div>
          </div>

          {/* 投流金额口径 */}
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <label className="mb-2 block text-xs font-medium text-gray-600">投流金额口径</label>
            <div className="flex gap-4">
              <RadioOption
                name="trafficCostCaliber"
                value="consumption"
                checked={trafficCostCaliber === 'consumption'}
                onChange={() => setTrafficCostCaliber('consumption')}
                label="投流消耗金额（聚光fee）"
              />
              <RadioOption
                name="trafficCostCaliber"
                value="settlement"
                checked={trafficCostCaliber === 'settlement'}
                onChange={() => setTrafficCostCaliber('settlement')}
                label="投流结算金额"
              />
            </div>
          </div>
        </div>
      </FormSection>

      {/* Section: 报告模块开关 */}
      <FormSection title="报告模块配置">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setModules(selectAllModules(modules))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand"
          >
            全选
          </button>
          <button
            type="button"
            onClick={() => setModules(deselectAllModules(modules))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand"
          >
            取消全选
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {REPORT_MODULES.map((mod) => (
            <label
              key={mod.key}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 transition hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={modules[mod.key] ?? true}
                onChange={() => handleModuleToggle(mod.key)}
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/50"
              />
              <span className="text-sm text-gray-700">{mod.label}</span>
            </label>
          ))}
        </div>
      </FormSection>

      {/* Section: 投流周期配置 */}
      {modules.launchAnalysis && (
        <FormSection title="投流周期配置">
          <div className="space-y-3">
            {launchPhases.map((phase) => (
              <div key={phase.id} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="阶段名称"
                  value={phase.name}
                  onChange={(e) => handlePhaseChange(phase.id, 'name', e.target.value)}
                  className="w-28 rounded-sm border border-gray-300 px-3 h-10 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <input
                  type="date"
                  value={phase.startDate}
                  onChange={(e) => handlePhaseChange(phase.id, 'startDate', e.target.value)}
                  className="rounded-sm border border-gray-300 px-3 h-10 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <span className="text-gray-400">至</span>
                <input
                  type="date"
                  value={phase.endDate}
                  onChange={(e) => handlePhaseChange(phase.id, 'endDate', e.target.value)}
                  className="rounded-sm border border-gray-300 px-3 h-10 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhase(phase.id)}
                  className="rounded p-1 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddPhase}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand"
            >
              <Plus size={14} />
              添加阶段
            </button>
            {phaseError && <p className="mt-2 text-xs text-rose-500">{phaseError}</p>}
          </div>
        </FormSection>
      )}

      {/* Section: 投放ID */}
      {modules.launchAnalysis && (
        <FormSection title="投放ID">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {advertiserIds.map((id, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
                >
                  <span>{id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAdvertiserIds(advertiserIds.filter((_, i) => i !== index));
                      setAdvertiserIdError(null);
                    }}
                    className="ml-1 rounded p-0.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="输入投放ID（纯数字）"
                value={advertiserIdInput}
                onChange={(e) => {
                  setAdvertiserIdInput(e.target.value);
                  setAdvertiserIdError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const value = advertiserIdInput.trim();
                    if (!value) return;
                    if (!/^\d+$/.test(value)) {
                      setAdvertiserIdError('投放ID必须为纯数字');
                      return;
                    }
                    if (advertiserIds.includes(value)) {
                      setAdvertiserIdError('投放ID不能重复');
                      return;
                    }
                    if (advertiserIds.length >= 5) {
                      setAdvertiserIdError('最多添加5个投放ID');
                      return;
                    }
                    setAdvertiserIds([...advertiserIds, value]);
                    setAdvertiserIdInput('');
                    setAdvertiserIdError(null);
                  }
                }}
                className="w-64 rounded-sm border border-gray-300 px-3 h-10 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="button"
                onClick={() => {
                  const value = advertiserIdInput.trim();
                  if (!value) return;
                  if (!/^\d+$/.test(value)) {
                    setAdvertiserIdError('投放ID必须为纯数字');
                    return;
                  }
                  if (advertiserIds.includes(value)) {
                    setAdvertiserIdError('投放ID不能重复');
                    return;
                  }
                  if (advertiserIds.length >= 5) {
                    setAdvertiserIdError('最多添加5个投放ID');
                    return;
                  }
                  setAdvertiserIds([...advertiserIds, value]);
                  setAdvertiserIdInput('');
                  setAdvertiserIdError(null);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand"
              >
                <Plus size={14} />
                添加
              </button>
            </div>
            {advertiserIdError && (
              <p className="text-xs text-rose-500">{advertiserIdError}</p>
            )}
            <p className="text-xs text-gray-400">最多 5 个投放ID，用于拉取聚光投流数据</p>
          </div>
        </FormSection>
      )}

      {/* Section: 策划方案上传 */}
      <FormSection title="策划方案上传">
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 transition hover:border-brand hover:bg-[#FFF8E1]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) {
              const ext = '.' + file.name.split('.').pop()?.toLowerCase();
              if (!ALLOWED_PLAN_EXTENSIONS.includes(ext)) {
                setSubmitError('策划方案仅支持 .pdf、.docx、.doc、.pptx、.ppt 格式');
                return;
              }
              setPlanFile(file);
              setPlanFileName(file.name);
              setSubmitError(null);
            }
          }}
        >
          <Upload size={24} className="mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">拖拽文件到此处，或</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            选择文件
            <input
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.ppt"
              onChange={handlePlanFileChange}
              className="hidden"
            />
          </label>
          {planFileName && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <FileText size={16} className="text-brand" />
              {planFileName}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400">支持格式：.pdf、.docx、.doc、.pptx、.ppt</p>
      </FormSection>

      {/* Error Message */}
      {submitError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <AlertCircle size={16} />
          {submitError}
          {submitError.includes('笔记底表') && selectedProjectId && (
            <a
              href={`/projects/${selectedProjectId}/edit`}
              className="ml-2 font-medium text-brand underline hover:text-brand-700"
            >
              前往上传
            </a>
          )}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={createReview.isPending}
          className="inline-flex h-[44px] items-center gap-2 rounded-md bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createReview.isPending ? (
            <Loading size="sm" />
          ) : null}
          开始复盘
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-base font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="--"
        className="block w-full rounded-sm border border-gray-300 px-3 h-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  error,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  error?: string | null;
}) {
  const handleChange = (value: string, onChange: (v: string) => void) => {
    const result = validateRangeInput(value);
    onChange(result.sanitizedValue);
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <span className="mb-0.5 block text-xs text-gray-500">最小值</span>
          <input
            type="number"
            step="any"
            value={minValue}
            onChange={(e) => handleChange(e.target.value, onMinChange)}
            placeholder="--"
            className="block w-full rounded-sm border border-gray-300 px-3 h-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <span className="mt-5 text-gray-400">~</span>
        <div className="flex-1">
          <span className="mb-0.5 block text-xs text-gray-500">最大值</span>
          <input
            type="number"
            step="any"
            value={maxValue}
            onChange={(e) => handleChange(e.target.value, onMaxChange)}
            placeholder="--"
            className="block w-full rounded-sm border border-gray-300 px-3 h-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function RadioOption({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 border-gray-300 text-brand focus:ring-brand/50"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
