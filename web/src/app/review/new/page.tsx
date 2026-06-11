'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Upload, FileText, AlertCircle, ArrowLeft } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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

];

const DEFAULT_LAUNCH_PHASES: LaunchPhase[] = [

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
  const [viralThresholdLikeCommentShare, setViralThresholdLikeCommentShare] = useState<string>('');
  const [viralThresholdLikeOnly, setViralThresholdLikeOnly] = useState<string>('');
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

  // ─── Refs for scroll-to-error ────────────────────────────────────────────
  const benchmarkSectionRef = useRef<HTMLDivElement>(null);
  const calculationLogicSectionRef = useRef<HTMLDivElement>(null);
  const launchConfigSectionRef = useRef<HTMLDivElement>(null);

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
  // (No redirect — allow direct access and project selection in form)

  // Fetch all projects for project selector
  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ['all-projects-for-review'],
    queryFn: async () => {
      const res = await fetch('/api/projects?pageSize=500');
      if (!res.ok) throw new Error('获取项目列表失败');
      const data = await res.json();
      return (data.items ?? []).filter((p: Project) => p.noteCount > 0);
    },
    enabled: !preselectedProjectId && !editFromId,
  });



  // ─── Edit Mode: Load existing review config ──────────────────────────────
  const { data: editReview } = useQuery<{
    id: string;
    projectId: string;
    benchmark: Record<string, number | { min: number; max: number } | null>;
    influencerTiers: InfluencerTier[];
    kpiTargets: Record<string, number | null>;
    engagementMetric: string;
    viralMetric: string;
    viralThreshold?: number | null;
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
    if (editReview.viralThreshold != null) {
      const threshold = String(editReview.viralThreshold);
      setViralThresholdLikeCommentShare(threshold);
      setViralThresholdLikeOnly(threshold);
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
      // Upload plan file if selected (non-blocking for navigation)
      if (planFile) {
        try {
          const formData = new FormData();
          formData.append('file', planFile);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
          const uploadRes = await fetch(`/api/reviews/${review.id}/plan-upload`, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!uploadRes.ok) {
            console.error('[plan-upload] 上传失败:', await uploadRes.text());
          }
        } catch (err) {
          console.error('[plan-upload] 上传异常:', err);
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

  const addAdvertiserId = () => {
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
  };

  // ─── Validation Helpers ─────────────────────────────────────────────────
  const validateSingleBenchmark = (key: string, min: string, max: string) => {
    const minVal = min.trim() ? parseFloat(min) : null;
    const maxVal = max.trim() ? parseFloat(max) : null;
    let error: string | null = null;
    if (minVal !== null && minVal < 0) {
      error = '最小值不能为负数';
    } else if (maxVal !== null && maxVal < 0) {
      error = '最大值不能为负数';
    } else if (minVal !== null && maxVal !== null && minVal > maxVal) {
      error = '最小值不能大于最大值';
    }
    setBenchmarkErrors((prev) => ({ ...prev, [key]: error }));
  };

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
      console.warn('[复盘校验] 校验不通过 —— benchmarkValid:', benchmarkValid, 'tiersValid:', tiersValid, 'phasesValid:', phasesValid, 'benchmark state:', JSON.stringify(benchmark));
      setSubmitError('请修正表单中的错误后再提交');
      // Scroll to first error section
      if (!benchmarkValid && benchmarkSectionRef.current) {
        benchmarkSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (!tiersValid && calculationLogicSectionRef.current) {
        calculationLogicSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (!phasesValid && launchConfigSectionRef.current) {
        launchConfigSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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

    const activeViralThreshold = viralMetric === 'like_only'
      ? viralThresholdLikeOnly
      : viralThresholdLikeCommentShare;

    createReview.mutate({
      projectId: selectedProjectId,
      benchmark: parsedBenchmark,
      influencerTiers,
      kpiTargets: parsedKpi,
      engagementMetric,
      viralMetric,
      viralThreshold: activeViralThreshold ? parseInt(activeViralThreshold) : null,
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl tracking-tight text-gray-900">{editFromId ? '编辑复盘' : '新建复盘'}</h1>
        </div>
      </div>

      {/* Section: 项目信息 */}
      <FormSection title="项目信息">
        {/* Project cascade selector (shown when no projectId pre-selected) */}
        {!preselectedProjectId && !editFromId && (() => {
          const projects = allProjects ?? [];
          // Derive cascade options
          const categories = [...new Set(projects.map(p => p.category))].sort();
          const selectedCategory = projects.find(p => p.id === selectedProjectId)?.category || '';
          const brandsForCategory = [...new Set(projects.filter(p => !selectedCategory || p.category === selectedCategory).map(p => p.brand))].sort();
          const selectedBrand = projects.find(p => p.id === selectedProjectId)?.brand || '';
          const linesForBrand = [...new Set(projects.filter(p => (!selectedCategory || p.category === selectedCategory) && (!selectedBrand || p.brand === selectedBrand)).map(p => p.businessLine || ''))].filter(Boolean).sort();
          const selectedLine = projects.find(p => p.id === selectedProjectId)?.businessLine || '';
          const filteredProjects = projects.filter(p => {
            if (selectedCategory && p.category !== selectedCategory) return false;
            if (selectedBrand && p.brand !== selectedBrand) return false;
            if (selectedLine && (p.businessLine || '') !== selectedLine) return false;
            return true;
          });

          return (
            <div className="space-y-3 mb-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField label="品类">
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => {
                      if (!value) { setSelectedProjectId(''); return; }
                      const first = projects.find(p => p.category === value);
                      if (first) setSelectedProjectId(first.id);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-gray-200 focus-visible:ring-brand/20" />
                    <SelectContent>
                      <SelectItem value="">全部品类</SelectItem>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="品牌">
                  <Select
                    value={selectedBrand}
                    onValueChange={(value) => {
                      if (!value) { setSelectedProjectId(''); return; }
                      const first = projects.find(p => p.brand === value && (!selectedCategory || p.category === selectedCategory));
                      if (first) setSelectedProjectId(first.id);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-gray-200 focus-visible:ring-brand/20" />
                    <SelectContent>
                      <SelectItem value="">全部品牌</SelectItem>
                      {brandsForCategory.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="业务线">
                  <Select
                    value={selectedLine}
                    onValueChange={(value) => {
                      if (!value) return;
                      const first = projects.find(p =>
                        (!selectedCategory || p.category === selectedCategory) &&
                        (!selectedBrand || p.brand === selectedBrand) &&
                        (p.businessLine || '') === value
                      );
                      if (first) setSelectedProjectId(first.id);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg border-gray-200 focus-visible:ring-brand/20" />
                    <SelectContent>
                      <SelectItem value="">全部业务线</SelectItem>
                      {linesForBrand.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label={<><span>项目</span> <span className="text-rose-500">*</span></>}>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-200 focus-visible:ring-brand/20" />
                  <SelectContent>
                    <SelectItem value="">请选择项目</SelectItem>
                    {filteredProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.projectName}（{p.noteCount}篇笔记）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          );
        })()}

        {/* Project info display */}
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
        ) : selectedProjectId ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertCircle size={16} />
            <span>未找到项目信息</span>
          </div>
        ) : null}
      </FormSection>

    {/* Section: KPI目标配置 */}
    <FormSection title="KPI指标">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <NumberInput label="总曝光" value={kpiTargets.totalImpression} onChange={(v) => setKpiTargets({ ...kpiTargets, totalImpression: v })} />
          <NumberInput label="总阅读" value={kpiTargets.totalRead} onChange={(v) => setKpiTargets({ ...kpiTargets, totalRead: v })} />
          <NumberInput label="总互动" value={kpiTargets.totalEngagement} onChange={(v) => setKpiTargets({ ...kpiTargets, totalEngagement: v })} />
          <NumberInput label="爆文数" value={kpiTargets.viralPosts1k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts1k: v })} />
          <NumberInput label="爆文率 (%)" value={kpiTargets.viralPosts10k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts10k: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <NumberInput label="CPM (元)" value={kpiTargets.cpm} onChange={(v) => setKpiTargets({ ...kpiTargets, cpm: v })} />
          <NumberInput label="CPC (元)" value={kpiTargets.cpc} onChange={(v) => setKpiTargets({ ...kpiTargets, cpc: v })} />
          <NumberInput label="CPE (元)" value={kpiTargets.cpe} onChange={(v) => setKpiTargets({ ...kpiTargets, cpe: v })} />
          <NumberInput label="CTR (%)" value={kpiTargets.ctr} onChange={(v) => setKpiTargets({ ...kpiTargets, ctr: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <NumberInput label="品牌 AIPS 人群数" value={kpiTargets.audienceBrandTotal} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTotal: v })} />
          <NumberInput label="品牌 TI 人群数" value={kpiTargets.audienceBrandTi} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTi: v })} />
        </div>
      </FormSection>

      {/* Section: 大盘数据 */}
      <div ref={benchmarkSectionRef}>
      <FormSection title="大盘数据">
        <div className="space-y-4">
          <RangeInput
            label="CTR (%)"
            minValue={benchmark.ctr.min}
            maxValue={benchmark.ctr.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, ctr: { ...benchmark.ctr, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, ctr: { ...benchmark.ctr, max: v } })}
            onBlur={() => validateSingleBenchmark('ctr', benchmark.ctr.min, benchmark.ctr.max)}
            error={benchmarkErrors.ctr}
          />
          <RangeInput
            label="CPM (元)"
            minValue={benchmark.cpm.min}
            maxValue={benchmark.cpm.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, cpm: { ...benchmark.cpm, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, cpm: { ...benchmark.cpm, max: v } })}
            onBlur={() => validateSingleBenchmark('cpm', benchmark.cpm.min, benchmark.cpm.max)}
            error={benchmarkErrors.cpm}
          />
          <RangeInput
            label="CPC (元)"
            minValue={benchmark.cpc.min}
            maxValue={benchmark.cpc.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, cpc: { ...benchmark.cpc, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, cpc: { ...benchmark.cpc, max: v } })}
            onBlur={() => validateSingleBenchmark('cpc', benchmark.cpc.min, benchmark.cpc.max)}
            error={benchmarkErrors.cpc}
          />
          <RangeInput
            label="CPE (元)"
            minValue={benchmark.cpe.min}
            maxValue={benchmark.cpe.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, cpe: { ...benchmark.cpe, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, cpe: { ...benchmark.cpe, max: v } })}
            onBlur={() => validateSingleBenchmark('cpe', benchmark.cpe.min, benchmark.cpe.max)}
            error={benchmarkErrors.cpe}
          />
          <RangeInput
            label="互动率 (%)"
            minValue={benchmark.engagementRate.min}
            maxValue={benchmark.engagementRate.max}
            onMinChange={(v) => setBenchmark({ ...benchmark, engagementRate: { ...benchmark.engagementRate, min: v } })}
            onMaxChange={(v) => setBenchmark({ ...benchmark, engagementRate: { ...benchmark.engagementRate, max: v } })}
            onBlur={() => validateSingleBenchmark('engagementRate', benchmark.engagementRate.min, benchmark.engagementRate.max)}
            error={benchmarkErrors.engagementRate}
          />
        </div>
      </FormSection>
      </div>

      {/* Section: 计算逻辑 */}
      <div ref={calculationLogicSectionRef}>
      <FormSection title="计算逻辑">
        <div className="space-y-6">
          <FormField label="是否含非报备笔记">
            <RadioGroup
              name="hasUnofficialCooperation"
              className="gap-10"
              value={hasUnofficialCooperation ? 'yes' : 'no'}
              onValueChange={(v) => setHasUnofficialCooperation(v === 'yes')}
            >
              <RadioGroupItem value="yes">是</RadioGroupItem>
              <RadioGroupItem value="no">否</RadioGroupItem>
            </RadioGroup>
          </FormField>

          <FormField label="内容金额口径">
            <RadioGroup
              name="contentCostCaliber"
              className="gap-10"
              value={contentCostCaliber}
              onValueChange={(v) => setContentCostCaliber(v as 'consumption' | 'settlement')}
            >
              <RadioGroupItem value="consumption">资源含税成本价</RadioGroupItem>
              <RadioGroupItem value="settlement">资源含税售价</RadioGroupItem>
            </RadioGroup>
          </FormField>

          <div className="space-y-3">
            <Label className="font-normal text-gray-500">爆文统计口径</Label>
            <div className="flex gap-10">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="radio"
                id="viralMetric-like_comment_share"
                name="viralMetric"
                checked={viralMetric === 'like_comment_share'}
                onChange={() => setViralMetric('like_comment_share')}
                className="h-4 w-4 border-gray-300 text-brand focus:ring-brand/50"
              />
              <Label htmlFor="viralMetric-like_comment_share" className="cursor-pointer font-normal text-gray-700">
                转评赞
              </Label>
              <Input
                type="number"
                min={1}
                variant="form"
                value={viralThresholdLikeCommentShare}
                onChange={(e) => setViralThresholdLikeCommentShare(e.target.value)}
                placeholder="阈值"
                disabled={viralMetric !== 'like_comment_share'}
                className="w-28"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="radio"
                id="viralMetric-like_only"
                name="viralMetric"
                checked={viralMetric === 'like_only'}
                onChange={() => setViralMetric('like_only')}
                className="h-4 w-4 border-gray-300 text-brand focus:ring-brand/50"
              />
              <Label htmlFor="viralMetric-like_only" className="cursor-pointer font-normal text-gray-700">
                赞
              </Label>
              <Input
                type="number"
                min={1}
                variant="form"
                value={viralThresholdLikeOnly}
                onChange={(e) => setViralThresholdLikeOnly(e.target.value)}
                placeholder="阈值"
                disabled={viralMetric !== 'like_only'}
                className="w-28"
              />
            </div>
            </div>
          </div>

          <FormField label="互动统计口径">
            <RadioGroup
              name="engagementMetric"
              value={engagementMetric}
              onValueChange={(v) => setEngagementMetric(v as 'exclude_follow' | 'include_follow')}
            >
              <RadioGroupItem value="exclude_follow">不含关注</RadioGroupItem>
              <RadioGroupItem value="include_follow">含关注</RadioGroupItem>
            </RadioGroup>
          </FormField>

          <div className="space-y-3">
            <Label className="font-normal text-gray-500">达人层级配置</Label>
            <div className="space-y-3">
            {influencerTiers.map((tier) => (
              <div key={tier.id} className="flex flex-wrap items-center gap-3">
                <Input
                  variant="form"
                  placeholder="层级名称"
                  value={tier.name}
                  onChange={(e) => handleTierChange(tier.id, 'name', e.target.value)}
                  className="w-28"
                />
                <Input
                  type="number"
                  variant="form"
                  placeholder="粉丝下限"
                  value={tier.fanRangeMin || ''}
                  onChange={(e) => handleTierChange(tier.id, 'fanRangeMin', Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-gray-400">-</span>
                <Input
                  type="number"
                  variant="form"
                  placeholder="粉丝上限"
                  value={tier.fanRangeMax || ''}
                  onChange={(e) => handleTierChange(tier.id, 'fanRangeMax', Number(e.target.value))}
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveTier(tier.id)}
                  className="text-gray-400 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTier}
              className="border-dashed"
            >
              <Plus size={14} />
              添加层级
            </Button>
            {tierError && <p className="text-xs text-rose-500">{tierError}</p>}
          </div>
        </div>
      </FormSection>
      </div>

      {/* Section: 模块配置 */}
      <FormSection title="模块配置">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {REPORT_MODULES.map((mod) => (
            <label
              key={mod.key}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 transition hover:bg-gray-50"
            >
              <Checkbox
                checked={modules[mod.key] ?? true}
                onCheckedChange={() => handleModuleToggle(mod.key)}
              />
              <span className="text-sm text-gray-700">{mod.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModules(selectAllModules(modules))}
            className="h-auto px-2 py-1 text-gray-600 hover:text-brand"
          >
            全选
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModules(deselectAllModules(modules))}
            className="h-auto px-2 py-1 text-gray-600 hover:text-brand"
          >
            清空选择
          </Button>
        </div>
      </FormSection>

      {/* Section: 投放配置 */}
      {modules.launchAnalysis && (
        <div ref={launchConfigSectionRef}>
        <FormSection title="投放配置">
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="font-normal text-gray-500">投放ID</Label>
              <div className="flex flex-wrap gap-2">
                {advertiserIds.map((id, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
                  >
                    <span>{id}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setAdvertiserIds(advertiserIds.filter((_, i) => i !== index));
                        setAdvertiserIdError(null);
                      }}
                      className="h-6 w-6 text-gray-400 hover:text-rose-500"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  variant="form"
                  placeholder="输入投放ID（最多5个）"
                  value={advertiserIdInput}
                  onChange={(e) => {
                    setAdvertiserIdInput(e.target.value);
                    setAdvertiserIdError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAdvertiserId();
                    }
                  }}
                  className="w-64"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAdvertiserId}
                  className="border-dashed"
                >
                  <Plus size={14} />
                  添加
                </Button>
              </div>
              {advertiserIdError && (
                <p className="text-xs text-rose-500">{advertiserIdError}</p>
              )}
             
            </div>

            <div className="space-y-3">
              <Label className="font-normal text-gray-500">投放周期</Label>
              <div className="space-y-3">
              {launchPhases.map((phase) => (
                <div key={phase.id} className="flex flex-wrap items-center gap-3">
                  <Input
                    variant="form"
                    placeholder="阶段名称"
                    value={phase.name}
                    onChange={(e) => handlePhaseChange(phase.id, 'name', e.target.value)}
                    className="w-28"
                  />
                  <Input
                    type="date"
                    variant="form"
                    value={phase.startDate}
                    onChange={(e) => handlePhaseChange(phase.id, 'startDate', e.target.value)}
                    className="w-40"
                  />
                  <span className="text-gray-400">至</span>
                  <Input
                    type="date"
                    variant="form"
                    value={phase.endDate}
                    onChange={(e) => handlePhaseChange(phase.id, 'endDate', e.target.value)}
                    className="w-40"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemovePhase(phase.id)}
                    className="text-gray-400 hover:text-rose-500"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPhase}
                className="border-dashed"
              >
                <Plus size={14} />
                添加阶段
              </Button>
              {phaseError && <p className="text-xs text-rose-500">{phaseError}</p>}
            </div>
          </div>
        </FormSection>
        </div>
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
          <label className="mt-2 inline-flex cursor-pointer">
            <span className="inline-flex h-10 items-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
              选择文件
            </span>
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
        <Button
          type="button"
          variant="submit"
          onClick={handleSubmit}
          disabled={createReview.isPending}
        >
          {createReview.isPending ? <Loading size="sm" /> : null}
          开始复盘
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
    <FormField label={label}>
      <Input
        type="number"
        step="any"
        variant="form"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="--"
      />
    </FormField>
  );
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onBlur,
  error,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  onBlur?: () => void;
  error?: string | null;
}) {
  const handleChange = (value: string, onChange: (v: string) => void) => {
    const cleaned = value.replace(/[^\d.\-]/g, '');
    const result = validateRangeInput(cleaned);
    onChange(result.sanitizedValue);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <Label className="w-24 shrink-0 font-normal text-gray-700">{label}</Label>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            type="text"
            inputMode="decimal"
            variant="form"
            value={minValue}
            onChange={(e) => handleChange(e.target.value, onMinChange)}
            onBlur={onBlur}
            placeholder="最小值"
            className={error ? 'border-rose-400 bg-rose-50/30 focus-visible:ring-rose-200' : undefined}
          />
          <Input
            type="text"
            inputMode="decimal"
            variant="form"
            value={maxValue}
            onChange={(e) => handleChange(e.target.value, onMaxChange)}
            onBlur={onBlur}
            placeholder="最大值"
            className={error ? 'border-rose-400 bg-rose-50/30 focus-visible:ring-rose-200' : undefined}
          />
        </div>
      </div>
      {error && <p className="mt-1 pl-28 text-xs text-rose-500">{error}</p>}
    </div>
  );
}
