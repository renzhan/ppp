'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Upload, FileText, AlertCircle, Calendar } from 'lucide-react';
import { ProjectNameCombobox } from '@/components/form/project-name-combobox';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterField } from '@/components/ui/filter-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/ui/loading';
import { MetricRadioGroup } from '@/components/ui/metric-radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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

interface BenchmarkData {
  ctr: string;
  cpm: string;
  cpc: string;
  cpe: string;
  engagementRate: string;
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
  searchIndex: string;
  socSov: string;
  audienceBrandTotal: string;
  audienceSpuTotal: string;
  audienceBrandTi: string;
  audienceSpuTi: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_INFLUENCER_TIERS: InfluencerTier[] = [
  { id: generateId(), name: '头部', fanRangeMin: 50001, fanRangeMax: 999999 },
  { id: generateId(), name: '腰部', fanRangeMin: 10001, fanRangeMax: 50000 },
  { id: generateId(), name: '尾部', fanRangeMin: 0, fanRangeMax: 10000 },
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
  { key: 'audienceAnalysis', label: '人群资产分析' },
  { key: 'launchAnalysis', label: '投流分析' },
  { key: 'competitorAnalysis', label: '竞对分析' },
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
  const [projectSearch, setProjectSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterBusinessLine, setFilterBusinessLine] = useState('');
  const [benchmark, setBenchmark] = useState<BenchmarkData>({
    ctr: '', cpm: '', cpc: '', cpe: '', engagementRate: '',
  });
  const [influencerTiers, setInfluencerTiers] = useState<InfluencerTier[]>(DEFAULT_INFLUENCER_TIERS);
  const [kpiTargets, setKpiTargets] = useState<KpiTargets>({
    totalImpression: '', totalRead: '', totalEngagement: '',
    viralPosts1k: '', viralPosts10k: '',
    cpm: '', cpc: '', cpe: '', ctr: '',
    searchIndex: '', socSov: '',
    audienceBrandTotal: '', audienceSpuTotal: '',
    audienceBrandTi: '', audienceSpuTi: '',
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
  const [hasUnofficialCooperation, setHasUnofficialCooperation] = useState<boolean>(false);
  const [executionPeriodStart, setExecutionPeriodStart] = useState('');
  const [executionPeriodEnd, setExecutionPeriodEnd] = useState('');
  const [historicalAcquisitionCost, setHistoricalAcquisitionCost] = useState('');

  // ─── Data Fetching ───────────────────────────────────────────────────────
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-for-review'],
    queryFn: async () => {
      const res = await fetch('/api/projects?pageSize=1000');
      if (!res.ok) throw new Error('获取项目列表失败');
      const data = await res.json();
      return data.items ?? [];
    },
  });

  // Derive category/brand/businessLine options from existing projects
  const categoryOptions = useMemo(() => {
    if (!projects) return [];
    const set = new Set(projects.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [projects]);

  // Real-time cost calculation based on selected caliber
  const { data: costData, isLoading: isCostLoading } = useQuery<{ contentCost: number; trafficCost: number; totalCost: number }>({
    queryKey: ['project-cost', selectedProjectId, contentCostCaliber, trafficCostCaliber],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${selectedProjectId}/cost?contentCaliber=${contentCostCaliber}&trafficCaliber=${trafficCostCaliber}`);
      if (!res.ok) throw new Error('计算费用失败');
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const brandOptions = useMemo(() => {
    if (!projects) return [];
    let filtered = projects;
    if (filterCategory) filtered = filtered.filter((p) => p.category === filterCategory);
    const set = new Set(filtered.map((p) => p.brand).filter(Boolean));
    return Array.from(set).sort();
  }, [projects, filterCategory]);

  const businessLineOptions = useMemo(() => {
    if (!projects) return [];
    let filtered = projects;
    if (filterCategory) filtered = filtered.filter((p) => p.category === filterCategory);
    if (filterBrand) filtered = filtered.filter((p) => p.brand === filterBrand);
    const set = new Set(filtered.map((p) => p.businessLine).filter((v): v is string => !!v));
    return Array.from(set).sort();
  }, [projects, filterCategory, filterBrand]);

  // Filter projects by cascade selection + search keyword
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    let filtered = projects;
    if (filterCategory) filtered = filtered.filter((p) => p.category === filterCategory);
    if (filterBrand) filtered = filtered.filter((p) => p.brand === filterBrand);
    if (filterBusinessLine) filtered = filtered.filter((p) => p.businessLine === filterBusinessLine);
    if (projectSearch.trim()) {
      const keyword = projectSearch.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        p.projectName.toLowerCase().includes(keyword)
      );
    }
    return filtered;
  }, [projects, filterCategory, filterBrand, filterBusinessLine, projectSearch]);

  // Selected project info (for read-only display)
  const selectedProject = useMemo(() => {
    return projects?.find((p) => p.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  // Auto-fill cascade filters when page loads with preselected project
  useEffect(() => {
    if (preselectedProjectId && projects?.length) {
      const project = projects.find((p) => p.id === preselectedProjectId);
      if (project) {
        setFilterCategory(project.category || '');
        setFilterBrand(project.brand || '');
        setFilterBusinessLine(project.businessLine || '');
      }
    }
  }, [preselectedProjectId, projects]);

  // ─── Edit Mode: Load existing review config ──────────────────────────────
  const { data: editReview } = useQuery<{
    id: string;
    projectId: string;
    benchmark: Record<string, number | null>;
    influencerTiers: InfluencerTier[];
    kpiTargets: Record<string, number | null>;
    engagementMetric: string;
    viralMetric: string;
    modules: Record<string, unknown>;
    launchPhases: LaunchPhase[];
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

    // Pre-fill benchmark
    if (editReview.benchmark) {
      const bm: BenchmarkData = { ctr: '', cpm: '', cpc: '', cpe: '', engagementRate: '' };
      Object.entries(editReview.benchmark).forEach(([k, v]) => {
        if (v != null && k in bm) (bm as any)[k] = String(v);
      });
      setBenchmark(bm);
    }

    // Pre-fill KPI targets
    if (editReview.kpiTargets) {
      const kpi: any = {};
      Object.entries(editReview.kpiTargets).forEach(([k, v]) => {
        kpi[k] = v != null ? String(v) : '';
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

    // Pre-fill modules
    if (editReview.modules) {
      const mods: Record<string, boolean> = {};
      Object.entries(editReview.modules).forEach(([k, v]) => {
        if (k === 'contentCostCaliber') {
          setContentCostCaliber(v as any);
        } else if (k === 'trafficCostCaliber') {
          setTrafficCostCaliber(v as any);
        } else {
          mods[k] = !!v;
        }
      });
      if (Object.keys(mods).length > 0) setModules((prev) => ({ ...prev, ...mods }));
    }

    // Pre-fill launch phases
    if (editReview.launchPhases?.length) {
      setLaunchPhases(editReview.launchPhases);
    }

    // Auto-fill cascade filters
    if (projects?.length) {
      const project = projects.find((p) => p.id === editReview.projectId);
      if (project) {
        setFilterCategory(project.category || '');
        setFilterBrand(project.brand || '');
        setFilterBusinessLine(project.businessLine || '');
      }
    }
  }, [editReview, projects]);

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

      // Redirect directly to proofread page - report generation starts via SSE stream there
      router.push(`/review/${review.id}/proofread`);
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setProjectSearch('');
    // Auto-fill cascade filters based on selected project
    const project = projects?.find((p) => p.id === projectId);
    if (project) {
      setFilterCategory(project.category || '');
      setFilterBrand(project.brand || '');
      setFilterBusinessLine(project.businessLine || '');
    }
  };

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

  const allModulesSelected = REPORT_MODULES.every((m) => modules[m.key]);
  const handleToggleAllModules = () => {
    const next = !allModulesSelected;
    setModules((prev) => {
      const updated = { ...prev };
      REPORT_MODULES.forEach((m) => {
        updated[m.key] = next;
      });
      return updated;
    });
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

  const handleSubmit = () => {
    setSubmitError(null);

    if (!selectedProjectId) {
      setSubmitError('请选择关联项目');
      return;
    }

    // Check note count
    if (selectedProject && selectedProject.noteCount === 0) {
      setSubmitError('请先为该项目上传笔记底表，再开始复盘');
      return;
    }

    const parsedBenchmark: Record<string, number | null> = {};
    Object.entries(benchmark).forEach(([k, v]) => {
      parsedBenchmark[k] = v ? parseFloat(v) : null;
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
      modules: { ...modules, contentCostCaliber, trafficCostCaliber },
      launchPhases,
      hasUnofficialCooperation,
      executionPeriod: executionPeriodStart && executionPeriodEnd
        ? { start: executionPeriodStart, end: executionPeriodEnd }
        : null,
      historicalAcquisitionCost: historicalAcquisitionCost ? parseFloat(historicalAcquisitionCost) : null,
    });
  };

  const selectTriggerClass = 'h-9 rounded-md border-gray-200 text-sm';

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title={editFromId ? '编辑复盘' : '新建复盘'}
        description={
          editFromId
            ? '修改复盘参数，将基于新参数生成新的复盘报告'
            : '配置复盘参数，系统将基于笔记数据生成复盘报告'
        }
      />

      
        <div className="space-y-10">
          {/* 项目信息 */}
          <ReviewFormSection title="项目信息">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="品类">
                <Select
                  value={filterCategory}
                  onValueChange={(v) => {
                    setFilterCategory(v);
                    setFilterBrand('');
                    setFilterBusinessLine('');
                    setSelectedProjectId('');
                  }}
                >
                  <SelectTrigger className={selectTriggerClass} />
                  <SelectContent>
                    <SelectItem value="">请选择</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="品牌">
                <Select
                  value={filterBrand}
                  disabled={!filterCategory}
                  onValueChange={(v) => {
                    setFilterBrand(v);
                    setFilterBusinessLine('');
                    setSelectedProjectId('');
                  }}
                >
                  <SelectTrigger className={selectTriggerClass} />
                  <SelectContent>
                    <SelectItem value="">请选择</SelectItem>
                    {brandOptions.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="品牌业务线">
                <Select
                  value={filterBusinessLine}
                  disabled={!filterBrand}
                  onValueChange={(v) => {
                    setFilterBusinessLine(v);
                    setSelectedProjectId('');
                  }}
                >
                  <SelectTrigger className={selectTriggerClass} />
                  <SelectContent>
                    <SelectItem value="">请选择</SelectItem>
                    {businessLineOptions.map((bl) => (
                      <SelectItem key={bl} value={bl}>{bl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="项目名称">
                <ProjectNameCombobox
                  projects={filteredProjects}
                  selectedId={selectedProjectId}
                  displayValue={selectedProject?.projectName ?? ''}
                  searchValue={projectSearch}
                  onSearchChange={setProjectSearch}
                  onSelect={handleProjectChange}
                  onClearSelection={() => setSelectedProjectId('')}
                  placeholder="请输入"
                />
              </FilterField>
            </div>
            <FilterField label="项目执行周期" className="max-w-2xl">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Input
                    type="date"
                    variant="filter"
                    value={executionPeriodStart}
                    onChange={(e) => setExecutionPeriodStart(e.target.value)}
                    className="pr-9"
                  />
                  <Calendar
                    size={16}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
                <span className="shrink-0 text-sm text-gray-500">至</span>
                <div className="relative min-w-0 flex-1">
                  <Input
                    type="date"
                    variant="filter"
                    value={executionPeriodEnd}
                    onChange={(e) => setExecutionPeriodEnd(e.target.value)}
                    className="pr-9"
                  />
                  <Calendar
                    size={16}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>
            </FilterField>
            <FilterField label="历史拉新成本" className="max-w-md">
              <Input
                type="number"
                variant="filter"
                step="any"
                value={historicalAcquisitionCost}
                onChange={(e) => setHistoricalAcquisitionCost(e.target.value)}
                placeholder="请输入"
              />
            </FilterField>
          </ReviewFormSection>

 

          {/* 复盘背景（大盘数据） */}
          <ReviewFormSection title="复盘背景（大盘数据）">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <FormNumberField label="CTR" placeholder="请输入" value={benchmark.ctr} onChange={(v) => setBenchmark({ ...benchmark, ctr: v })} />
              <FormNumberField label="CPM" placeholder="请输入" value={benchmark.cpm} onChange={(v) => setBenchmark({ ...benchmark, cpm: v })} />
              <FormNumberField label="CPC" placeholder="请输入" value={benchmark.cpc} onChange={(v) => setBenchmark({ ...benchmark, cpc: v })} />
              <FormNumberField label="CPE" placeholder="请输入" value={benchmark.cpe} onChange={(v) => setBenchmark({ ...benchmark, cpe: v })} />
              <FormNumberField label="互动率" placeholder="请输入" value={benchmark.engagementRate} onChange={(v) => setBenchmark({ ...benchmark, engagementRate: v })} />
            </div>
            <div className="space-y-3 pt-2">
              {influencerTiers.map((tier, index) => (
                <div key={tier.id} className="flex flex-wrap items-center gap-3">
                  <FilterField label="达人层级名称" className="min-w-[200px] flex-1">
                    <Input
                      variant="filter"
                      placeholder="请输入"
                      value={tier.name}
                      onChange={(e) => handleTierChange(tier.id, 'name', e.target.value)}
                    />
                  </FilterField>
                  <FilterField label="范围" className="min-w-[280px] flex-[2]">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        variant="filter"
                        placeholder="请输入"
                        value={tier.fanRangeMin || ''}
                        onChange={(e) => handleTierChange(tier.id, 'fanRangeMin', Number(e.target.value))}
                      />
                      <span className="shrink-0 text-gray-400">—</span>
                      <Input
                        type="number"
                        variant="filter"
                        placeholder="请输入"
                        value={tier.fanRangeMax || ''}
                        onChange={(e) => handleTierChange(tier.id, 'fanRangeMax', Number(e.target.value))}
                      />
                    </div>
                  </FilterField>
                  {index === influencerTiers.length - 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={handleAddTier}
                      className="mt-0.5 shrink-0 rounded-full border-gray-300"
                      aria-label="添加层级"
                    >
                      <Plus size={16} />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveTier(tier.id)}
                      className="mt-0.5 shrink-0 text-gray-400 hover:text-rose-500"
                      aria-label="删除层级"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ReviewFormSection>



          {/* 复盘目标（KPI） */}
          <ReviewFormSection title="复盘目标（KPI）">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <FormNumberField label="总曝光" placeholder="请输入" value={kpiTargets.totalImpression} onChange={(v) => setKpiTargets({ ...kpiTargets, totalImpression: v })} />
              <FormNumberField label="总阅读" placeholder="请输入" value={kpiTargets.totalRead} onChange={(v) => setKpiTargets({ ...kpiTargets, totalRead: v })} />
              <FormNumberField label="总互动" placeholder="请输入" value={kpiTargets.totalEngagement} onChange={(v) => setKpiTargets({ ...kpiTargets, totalEngagement: v })} />
              <FormNumberField label="千赞文" placeholder="请输入" value={kpiTargets.viralPosts1k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts1k: v })} />
              <FormNumberField label="千互文" placeholder="请输入" value={kpiTargets.viralPosts10k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts10k: v })} />
              <FormNumberField label="搜索指数" placeholder="请输入" value={kpiTargets.searchIndex} onChange={(v) => setKpiTargets({ ...kpiTargets, searchIndex: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <FormNumberField label="CTR" placeholder="请输入" value={kpiTargets.ctr} onChange={(v) => setKpiTargets({ ...kpiTargets, ctr: v })} />
              <FormNumberField label="CPM" placeholder="请输入" value={kpiTargets.cpm} onChange={(v) => setKpiTargets({ ...kpiTargets, cpm: v })} />
              <FormNumberField label="CPC" placeholder="请输入" value={kpiTargets.cpc} onChange={(v) => setKpiTargets({ ...kpiTargets, cpc: v })} />
              <FormNumberField label="CPE" placeholder="请输入" value={kpiTargets.cpe} onChange={(v) => setKpiTargets({ ...kpiTargets, cpe: v })} />
              <FormNumberField label="品牌AIPS人群总数" placeholder="请输入" value={kpiTargets.audienceBrandTotal} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTotal: v })} />
              <FormNumberField label="品牌TI人群数" placeholder="请输入" value={kpiTargets.audienceBrandTi} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTi: v })} />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <MetricRadioGroup
                title="互动统计口径"
                name="engagementMetric"
                value={engagementMetric}
                onChange={setEngagementMetric}
                options={[
                  { value: 'exclude_follow', label: '不含关注' },
                  { value: 'include_follow', label: '含关注' },
                ]}
              />
              <MetricRadioGroup
                title="爆文统计口径"
                name="viralMetric"
                value={viralMetric}
                onChange={setViralMetric}
                options={[
                  { value: 'like_comment_share', label: '转评赞' },
                  { value: 'like_only', label: '赞' },
                ]}
              />
              <MetricRadioGroup
                title="内容金额统计口径"
                name="contentCostCaliber"
                value={contentCostCaliber}
                onChange={setContentCostCaliber}
                options={[
                  { value: 'consumption', label: '内容消耗金额' },
                  { value: 'settlement', label: '内容结算金额' },
                ]}
              />
              <MetricRadioGroup
                title="投流金额"
                name="trafficCostCaliber"
                value={trafficCostCaliber}
                onChange={setTrafficCostCaliber}
                options={[
                  { value: 'consumption', label: '投流消耗金额' },
                  { value: 'settlement', label: '投流结算金额' },
                ]}
              />
              <MetricRadioGroup
                title="是否有（非官方）合作"
                name="hasUnofficialCooperation"
                value={hasUnofficialCooperation ? 'yes' : 'no'}
                onChange={(v) => setHasUnofficialCooperation(v === 'yes')}
                options={[
                  { value: 'yes', label: '是' },
                  { value: 'no', label: '否' },
                ]}
              />
            </div>
            {selectedProjectId && (
              <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">总费用（实时计算）</span>
                  {isCostLoading ? (
                    <span className="text-sm text-gray-400">计算中...</span>
                  ) : costData ? (
                    <span className="text-base font-semibold text-brand-700">
                      ¥{costData.totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">--</span>
                  )}
                </div>
                {costData && (
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>内容：¥{costData.contentCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span>投流：¥{costData.trafficCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )}
          </ReviewFormSection>



          {/* 复盘报告模块 */}
          <ReviewFormSection
            title="复盘报告模块"
            action={
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={allModulesSelected} onCheckedChange={handleToggleAllModules} />
                <span className="text-sm text-gray-600">全选/取消全选</span>
              </label>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {REPORT_MODULES.map((mod) => (
                <label
                  key={mod.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 transition hover:bg-gray-50"
                >
                  <Checkbox
                    checked={modules[mod.key] ?? true}
                    onCheckedChange={() => handleModuleToggle(mod.key)}
                  />
                  <span className="text-sm text-gray-700">{mod.label}</span>
                </label>
              ))}
            </div>
          </ReviewFormSection>



          {modules.launchAnalysis && (
            <ReviewFormSection title="投流周期配置">
              <div className="space-y-3">
                {launchPhases.map((phase) => (
                  <div key={phase.id} className="flex flex-wrap items-center gap-3">
                    <FilterField label="阶段" className="min-w-[160px]">
                      <Input
                        variant="filter"
                        placeholder="请输入"
                        value={phase.name}
                        onChange={(e) => handlePhaseChange(phase.id, 'name', e.target.value)}
                      />
                    </FilterField>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        variant="filter"
                        value={phase.startDate}
                        onChange={(e) => handlePhaseChange(phase.id, 'startDate', e.target.value)}
                        className="w-[160px]"
                      />
                      <span className="text-sm text-gray-400">至</span>
                      <Input
                        type="date"
                        variant="filter"
                        value={phase.endDate}
                        onChange={(e) => handlePhaseChange(phase.id, 'endDate', e.target.value)}
                        className="w-[160px]"
                      />
                    </div>
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
                <Button type="button" variant="outline" size="sm" onClick={handleAddPhase} className="gap-1">
                  <Plus size={14} />
                  添加阶段
                </Button>
              </div>
            </ReviewFormSection>
          )}



          <ReviewFormSection title="策划方案上传">
            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 transition hover:border-brand/50 hover:bg-brand-50/30"
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
              <label className="mt-3 inline-flex cursor-pointer">
                <Button variant="outline" size="sm" type="button" asChild>
                  <span>选择文件</span>
                </Button>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.pptx,.ppt"
                  onChange={handlePlanFileChange}
                  className="sr-only"
                />
              </label>
              {planFileName && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <FileText size={16} className="text-brand" />
                  {planFileName}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400">支持格式：.pdf、.docx、.doc、.pptx、.ppt</p>
          </ReviewFormSection>
        </div>


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

      <div className="flex justify-center pb-8">
        <Button
          type="button"
          variant="submit"
          size="lg"
          onClick={handleSubmit}
          disabled={createReview.isPending}
          className="min-w-[150px] gap-2"
        >
          {createReview.isPending ? <Loading size="sm" /> : null}
          开始复盘
        </Button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ReviewFormSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="w-full border-b border-gray-200 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {action}
        </div>
      </div>
      {children}
    </section>
  );
}

function FormNumberField({
  label,
  value,
  onChange,
  placeholder = '请输入',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <FilterField label={label}>
      <Input
        type="number"
        step="any"
        variant="filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </FilterField>
  );
}
