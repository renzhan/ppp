'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Upload, FileText, AlertCircle, Search } from 'lucide-react';
import { Loading } from '@/components/ui/loading';

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
  { id: crypto.randomUUID(), name: '头部', fanRangeMin: 1000000, fanRangeMax: 99999999 },
  { id: crypto.randomUUID(), name: '腰部', fanRangeMin: 100000, fanRangeMax: 999999 },
  { id: crypto.randomUUID(), name: '尾部', fanRangeMin: 10000, fanRangeMax: 99999 },
];

const DEFAULT_LAUNCH_PHASES: LaunchPhase[] = [
  { id: crypto.randomUUID(), name: '预热期', startDate: '', endDate: '' },
  { id: crypto.randomUUID(), name: '爆发期', startDate: '', endDate: '' },
  { id: crypto.randomUUID(), name: '持续期', startDate: '', endDate: '' },
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

      // Trigger report generation (non-blocking, runs in background)
      fetch(`/api/generate-report/${review.id}`, { method: 'POST' }).catch((err) => {
        console.error('Report generation trigger failed:', err);
      });

      router.push(`/review/${review.id}`);
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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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

  const handleSubmit = () => {
    setSubmitError(null);

    if (!selectedProjectId) {
      setSubmitError('请选择关联项目');
      return;
    }

    // Check note count
    if (selectedProject && selectedProject.noteCount === 0) {
      setSubmitError('请先为该项目上传笔记底表，再开始复盘。');
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
      modules,
      launchPhases,
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">新建复盘</h1>
        <p className="mt-1 text-sm text-slate-500">配置复盘参数，系统将基于笔记数据生成复盘报告。</p>
      </div>

      {/* Section: 项目信息 */}
      <FormSection title="项目信息">
        {/* Cascade filters from existing projects */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">品类</label>
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setFilterBrand(''); setFilterBusinessLine(''); setSelectedProjectId(''); }}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部品类</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">品牌</label>
            <select
              value={filterBrand}
              onChange={(e) => { setFilterBrand(e.target.value); setFilterBusinessLine(''); setSelectedProjectId(''); }}
              disabled={!filterCategory}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">全部品牌</option>
              {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">业务线</label>
            <select
              value={filterBusinessLine}
              onChange={(e) => { setFilterBusinessLine(e.target.value); setSelectedProjectId(''); }}
              disabled={!filterBrand}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">全部业务线</option>
              {businessLineOptions.map((bl) => <option key={bl} value={bl}>{bl}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">选择项目</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="搜索项目名称..."
              value={selectedProject ? selectedProject.projectName : projectSearch}
              onChange={(e) => {
                setProjectSearch(e.target.value);
                if (selectedProjectId) setSelectedProjectId('');
              }}
              onFocus={() => {
                if (selectedProjectId) {
                  setProjectSearch(selectedProject?.projectName || '');
                  setSelectedProjectId('');
                }
              }}
              className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {!selectedProjectId && filteredProjects.length > 0 && projectSearch && (
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
              {filteredProjects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleProjectChange(p.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{p.projectName}</span>
                    <span className="text-xs text-slate-400">{p.category} / {p.brand}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!selectedProjectId && !projectSearch && filteredProjects.length > 0 && (
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm">
              {filteredProjects.slice(0, 10).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleProjectChange(p.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{p.projectName}</span>
                    <span className="text-xs text-slate-400">{p.category} / {p.brand}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* 选择项目后展示品类/品牌/业务线（只读） */}
        {selectedProject && (
          <div className="mt-4 grid grid-cols-3 gap-4 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div>
              <span className="block text-xs text-slate-500">品类</span>
              <span className="text-sm font-medium text-slate-800">{selectedProject.category || '-'}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">品牌</span>
              <span className="text-sm font-medium text-slate-800">{selectedProject.brand || '-'}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">业务线</span>
              <span className="text-sm font-medium text-slate-800">{selectedProject.businessLine || '-'}</span>
            </div>
          </div>
        )}
      </FormSection>

      {/* Section: 复盘背景（大盘数据） */}
      <FormSection title="复盘背景（大盘数据）">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <NumberInput label="CTR (%)" value={benchmark.ctr} onChange={(v) => setBenchmark({ ...benchmark, ctr: v })} />
          <NumberInput label="CPM" value={benchmark.cpm} onChange={(v) => setBenchmark({ ...benchmark, cpm: v })} />
          <NumberInput label="CPC" value={benchmark.cpc} onChange={(v) => setBenchmark({ ...benchmark, cpc: v })} />
          <NumberInput label="CPE" value={benchmark.cpe} onChange={(v) => setBenchmark({ ...benchmark, cpe: v })} />
          <NumberInput label="互动率 (%)" value={benchmark.engagementRate} onChange={(v) => setBenchmark({ ...benchmark, engagementRate: v })} />
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
                className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="粉丝下限"
                value={tier.fanRangeMin || ''}
                onChange={(e) => handleTierChange(tier.id, 'fanRangeMin', Number(e.target.value))}
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="粉丝上限"
                value={tier.fanRangeMax || ''}
                onChange={(e) => handleTierChange(tier.id, 'fanRangeMax', Number(e.target.value))}
                className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleRemoveTier(tier.id)}
                className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddTier}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
          >
            <Plus size={14} />
            添加层级
          </button>
        </div>
      </FormSection>

      {/* Section: KPI目标配置 */}
      <FormSection title="复盘目标（KPI）">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <NumberInput label="总曝光" value={kpiTargets.totalImpression} onChange={(v) => setKpiTargets({ ...kpiTargets, totalImpression: v })} />
            <NumberInput label="总阅读" value={kpiTargets.totalRead} onChange={(v) => setKpiTargets({ ...kpiTargets, totalRead: v })} />
            <NumberInput label="总互动" value={kpiTargets.totalEngagement} onChange={(v) => setKpiTargets({ ...kpiTargets, totalEngagement: v })} />
            <NumberInput label="千爆文数" value={kpiTargets.viralPosts1k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts1k: v })} />
            <NumberInput label="万爆文数" value={kpiTargets.viralPosts10k} onChange={(v) => setKpiTargets({ ...kpiTargets, viralPosts10k: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <NumberInput label="CPM" value={kpiTargets.cpm} onChange={(v) => setKpiTargets({ ...kpiTargets, cpm: v })} />
            <NumberInput label="CPC" value={kpiTargets.cpc} onChange={(v) => setKpiTargets({ ...kpiTargets, cpc: v })} />
            <NumberInput label="CPE" value={kpiTargets.cpe} onChange={(v) => setKpiTargets({ ...kpiTargets, cpe: v })} />
            <NumberInput label="CTR (%)" value={kpiTargets.ctr} onChange={(v) => setKpiTargets({ ...kpiTargets, ctr: v })} />
            <NumberInput label="搜索指数" value={kpiTargets.searchIndex} onChange={(v) => setKpiTargets({ ...kpiTargets, searchIndex: v })} />
            <NumberInput label="SOC/SOV" value={kpiTargets.socSov} onChange={(v) => setKpiTargets({ ...kpiTargets, socSov: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberInput label="人群资产-总-品牌" value={kpiTargets.audienceBrandTotal} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTotal: v })} />
            <NumberInput label="人群资产-总-SPU" value={kpiTargets.audienceSpuTotal} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceSpuTotal: v })} />
            <NumberInput label="人群资产-TI-品牌" value={kpiTargets.audienceBrandTi} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceBrandTi: v })} />
            <NumberInput label="人群资产-TI-SPU" value={kpiTargets.audienceSpuTi} onChange={(v) => setKpiTargets({ ...kpiTargets, audienceSpuTi: v })} />
          </div>
        </div>
      </FormSection>

      {/* Section: 统计口径选择 */}
      <FormSection title="统计口径选择">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">互动统计口径</label>
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
            <label className="mb-2 block text-xs font-medium text-slate-600">爆文统计口径</label>
            <div className="flex gap-4">
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
            </div>
          </div>
        </div>
      </FormSection>

      {/* Section: 报告模块开关 */}
      <FormSection title="报告模块配置">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {REPORT_MODULES.map((mod) => (
            <label
              key={mod.key}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={modules[mod.key] ?? true}
                onChange={() => handleModuleToggle(mod.key)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{mod.label}</span>
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
                  className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={phase.startDate}
                  onChange={(e) => handlePhaseChange(phase.id, 'startDate', e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-400">至</span>
                <input
                  type="date"
                  value={phase.endDate}
                  onChange={(e) => handlePhaseChange(phase.id, 'endDate', e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhase(phase.id)}
                  className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddPhase}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
            >
              <Plus size={14} />
              添加阶段
            </button>
          </div>
        </FormSection>
      )}

      {/* Section: 策划方案上传 */}
      <FormSection title="策划方案上传">
        <div className="flex items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <Upload size={16} />
            选择文件
            <input
              type="file"
              accept=".pdf,.docx,.doc,.pptx,.ppt"
              onChange={handlePlanFileChange}
              className="hidden"
            />
          </label>
          {planFileName && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileText size={16} className="text-blue-500" />
              {planFileName}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">支持格式：.pdf、.docx、.doc、.pptx、.ppt</p>
      </FormSection>

      {/* Error Message */}
      {submitError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <AlertCircle size={16} />
          {submitError}
          {submitError.includes('笔记底表') && selectedProjectId && (
            <a
              href={`/projects/${selectedProjectId}/edit`}
              className="ml-2 font-medium text-blue-600 underline hover:text-blue-700"
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
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
      <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
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
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="--"
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
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
        className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
