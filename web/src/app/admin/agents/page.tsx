'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Settings, Bot, Sparkles, BookOpen } from 'lucide-react';
import { ModelConfigTab } from './components/model-config-tab';
import { AgentTab } from './components/agent-tab';
import { SkillTab } from './components/skill-tab';
import { KnowledgeTab } from './components/knowledge-tab';

const TABS = [
  { key: 'models', label: 'Model 配置', icon: Settings },
  { key: 'agents', label: 'Agent', icon: Bot },
  { key: 'skills', label: 'Skill', icon: Sparkles },
  { key: 'knowledge', label: 'Knowledge', icon: BookOpen },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const DEFAULT_TAB: TabKey = 'agents';

function AgentManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = (searchParams.get('tab') as TabKey) || DEFAULT_TAB;

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent 管理</h1>
        <p className="mt-1 text-sm text-gray-500">
          管理 Model 配置、Agent、Skill 和 Knowledge 资源
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {currentTab === 'models' && <ModelConfigTab />}
        {currentTab === 'agents' && <AgentTab />}
        {currentTab === 'skills' && <SkillTab />}
        {currentTab === 'knowledge' && <KnowledgeTab />}
      </div>
    </div>
  );
}

export default function AgentManagementPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-6">加载中...</div>}>
      <AgentManagementContent />
    </Suspense>
  );
}
