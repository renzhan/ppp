/**
 * PiAgentService - Pi Agent Framework Integration
 *
 * Wraps the pi agent framework (@earendil-works/pi-ai, @earendil-works/pi-coding-agent)
 * for marketing review report generation. Provides:
 * - Unified LLM API via pi-ai's completeSimple
 * - Prompt template loading from .pi/prompts/
 * - Skill loading from .pi/skills/
 * - Report-specific methods (optimization suggestions, narrative, plan parsing)
 */

import { completeSimple, type Model } from "@earendil-works/pi-ai";
import { type Skill } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { envConfig } from "./config/env.js";
import type {
  AllMetrics,
  Highlight,
  ProjectBackground,
} from "./shared/types.js";
import type {
  NarrativeRequest,
  NarrativeResult,
  NarrativeParagraph,
  ModuleId,
  ToneIntensity,
  ProjectType,
} from "./engines/types.js";

// ---- Constants ----

const DEFAULT_TIMEOUT_MS = 30_000;
const FALLBACK_OPTIMIZATION = `## 优化建议

基于本次项目数据分析，以下为初步优化方向：

1. **内容策略优化**：建议根据爆文特征优化内容方向，提升整体互动率。
2. **达人组合优化**：建议根据各层级达人表现调整投放比例。
3. **投流策略优化**：建议根据投流效果数据优化预算分配。
4. **转化路径优化**：建议根据组件点击数据优化转化链路。

（AI生成失败，以上为模板建议，请根据实际数据补充具体内容。）`;

const FALLBACK_PROJECT_BACKGROUND: ProjectBackground = {
  objective: "数据待补充",
  strategy: "数据待补充",
  targetAudience: "数据待补充",
  keyMessages: [],
  budget: undefined,
  timeline: undefined,
};

const CHAT_FALLBACK = "抱歉，AI助手暂时无法响应，请稍后重试。";

// ---- Pi Agent Configuration ----

export interface PiAgentConfig {
  baseURL?: string;
  model?: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  piDir?: string;
}

// ---- PiAgentService ----

export class PiAgentService {
  private model: Model<"openai-completions">;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;
  private piDir: string;

  constructor(config?: PiAgentConfig) {
    this.apiKey = config?.apiKey ?? envConfig.LLM_API_KEY;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config?.maxRetries ?? 2;
    this.piDir = config?.piDir ?? resolve(process.cwd(), ".pi");

    const baseUrl = config?.baseURL ?? envConfig.LLM_BASE_URL;
    const modelId = config?.model ?? envConfig.LLM_MODEL;

    this.model = {
      id: modelId,
      name: modelId,
      api: "openai-completions",
      provider: "openai",
      baseUrl,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 16384,
    };
  }

  // ---- Prompt & Skill Loading ----

  loadPrompt(name: string): string {
    const filePath = resolve(this.piDir, "prompts", `${name}.md`);
    if (!existsSync(filePath)) {
      throw new Error(`Prompt template not found: ${name} (${filePath})`);
    }
    return readFileSync(filePath, "utf-8");
  }

  loadPromptTemplate(name: string): PromptTemplate | null {
    try {
      const content = this.loadPrompt(name);
      return { name, content, source: "pi", filePath: resolve(this.piDir, "prompts", `${name}.md`) };
    } catch {
      return null;
    }
  }

  async loadSkills(): Promise<Skill[]> {
    const skillsDir = resolve(this.piDir, "skills");
    if (!existsSync(skillsDir)) return [];
    const result = await loadSkillsFromDir(skillsDir);
    return result.skills;
  }

  async getSystemPromptFromSkills(): Promise<string> {
    const skills = await this.loadSkills();
    if (skills.length === 0) return "";
    return skills
      .filter((s) => !s.disableModelInvocation)
      .map((s) => `<skill name="${s.name}" location="${s.filePath}">\n${s.description}\n</skill>`)
      .join("\n\n");
  }

  // ---- Core LLM ----

  async complete(
    systemPrompt: string,
    userContent: string,
    options?: { temperature?: number; timeoutMs?: number },
  ): Promise<string> {
    const result = await completeSimple(
      this.model,
      {
        systemPrompt,
        messages: [
          {
            role: "user",
            content: userContent,
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey: this.apiKey,
        maxRetries: this.maxRetries,
        timeoutMs: options?.timeoutMs ?? this.timeoutMs,
        temperature: options?.temperature ?? 0.7,
      },
    );

    if (result.stopReason === "error" || result.stopReason === "aborted") {
      throw new Error(result.errorMessage ?? "LLM request failed");
    }

    const textContent = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("");

    if (!textContent) {
      throw new Error("LLM returned empty response");
    }

    return textContent;
  }

  // ---- Report-Specific Methods ----

  async generateOptimizationSuggestions(
    metrics: AllMetrics,
    highlights: Highlight[],
  ): Promise<string> {
    try {
      const promptContent = this.loadPrompt("optimization-suggestions");

      const variables: Record<string, string> = {
        totalImpressions: metrics.projectMetrics.totalImpressions.toLocaleString(),
        totalReads: metrics.projectMetrics.totalReads.toLocaleString(),
        totalEngagement: metrics.projectMetrics.totalEngagement.toLocaleString(),
        viralCount: metrics.projectMetrics.viralCount.toString(),
        viralRate: (metrics.projectMetrics.viralRate * 100).toFixed(1),
        cpm: String(metrics.projectMetrics.cpm),
        cpc: String(metrics.projectMetrics.cpc),
        cpe: String(metrics.projectMetrics.cpe),
        ctr: String(metrics.projectMetrics.ctr),
        kpiResults: Object.entries(metrics.kpiResults)
          .map(
            ([key, val]) =>
              `- ${key}: ${val.completionRate !== null ? (val.completionRate * 100).toFixed(1) + "%" : val.label}`,
          )
          .join("\n"),
        benchmarkResults: Object.entries(metrics.benchmarkResults)
          .map(
            ([key, val]) =>
              `- ${key}: ${val.label} (${val.percentageDiff > 0 ? "+" : ""}${val.percentageDiff.toFixed(1)}%)`,
          )
          .join("\n"),
        kolTierData: metrics.kolTierAggregation
          .map(
            (tier) =>
              `- ${tier.tier}: ${tier.noteCount} notes, viral rate ${(tier.viralRate * 100).toFixed(1)}%, avg CPE=${tier.averageCPE}`,
          )
          .join("\n"),
        highlights: highlights
          .map((h) => `- [${h.type}] ${h.description}`)
          .join("\n"),
      };

      const userContent = this.substituteVariables(promptContent, variables);

      const skillContext = await this.getSystemPromptFromSkills();

      const systemPrompt = skillContext
        ? `You are a marketing review report agent.\n\n${skillContext}`
        : "You are a marketing review report agent. Generate optimization suggestions in Chinese based on the provided metrics.";

      return await this.complete(systemPrompt, userContent, { temperature: 0.7 });
    } catch (err) {
      console.error("[PiAgent] Failed to generate optimization suggestions:", err);
      return FALLBACK_OPTIMIZATION;
    }
  }

  async parsePlanDocument(documentText: string): Promise<ProjectBackground> {
    try {
      const promptContent = this.loadPrompt("plan-parsing");

      const systemPrompt = "You are a marketing plan analysis assistant. Extract structured data from planning documents.";
      const userContent = `${promptContent}\n\n## Document Content\n${documentText}`;

      const response = await this.complete(systemPrompt, userContent, { temperature: 0.3 });

      const json = this.extractJSON(response);
      const parsed = JSON.parse(json);

      return {
        objective: typeof parsed.objective === "string" ? parsed.objective : "数据待补充",
        strategy: typeof parsed.strategy === "string" ? parsed.strategy : "数据待补充",
        targetAudience: typeof parsed.targetAudience === "string" ? parsed.targetAudience : "数据待补充",
        keyMessages: Array.isArray(parsed.keyMessages)
          ? parsed.keyMessages.filter((m: unknown) => typeof m === "string")
          : [],
        budget: typeof parsed.budget === "number" ? parsed.budget : undefined,
        timeline: typeof parsed.timeline === "string" ? parsed.timeline : undefined,
      };
    } catch (err) {
      console.error("[PiAgent] Failed to parse plan document:", err);
      return FALLBACK_PROJECT_BACKGROUND;
    }
  }

  async generateNarrative(request: NarrativeRequest): Promise<NarrativeResult> {
    try {
      const promptContent = this.loadPrompt("narrative");

      const moduleName = request.moduleId;
      const tone = request.toneIntensity;
      const strategies = ATTRIBUTION_STRATEGIES[request.projectType] ?? ["综合评估"];
      const attribution = request.attributionStrategy ?? strategies[0];

      const variables: Record<string, string> = {
        moduleName,
        projectType: request.projectType,
        tone,
        attributionStrategy: attribution,
        dataContext: Object.entries(request.dataContext)
          .map(([key, value]) => `- ${key}: ${String(value ?? "")}`)
          .join("\n"),
      };

      const userContent = this.substituteVariables(promptContent, variables);
      const systemPrompt = `You are a senior Xiaohongshu marketing review analyst. Generate narrative content with a "${tone}" tone. Write in Chinese.`;

      const response = await this.complete(systemPrompt, userContent, { temperature: 0.7 });

      const rawParagraphs = response
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const paragraphs: NarrativeParagraph[] = rawParagraphs.map((content) => ({
        id: randomUUID(),
        content,
        tone: request.toneIntensity,
        relatedMetrics: request.metricRatings.map((r) => r.metricName),
        isTransformed: false,
      }));

      return {
        moduleId: request.moduleId,
        paragraphs,
        toneUsed: request.toneIntensity,
        attributionUsed: attribution,
      };
    } catch (err) {
      console.error("[PiAgent] Failed to generate narrative:", err);
      return {
        moduleId: request.moduleId,
        paragraphs: [
          {
            id: randomUUID(),
            content: "数据待补充",
            tone: request.toneIntensity,
            relatedMetrics: request.metricRatings.map((r) => r.metricName),
            isTransformed: false,
          },
        ],
        toneUsed: request.toneIntensity,
        attributionUsed: request.attributionStrategy ?? "综合评估",
      };
    }
  }

  async chat(
    messages: { role: "user" | "assistant"; content: string }[],
    context: { projectId: string; moduleId?: ModuleId },
  ): Promise<string> {
    try {
      const promptContent = this.loadPrompt("chat");

      const moduleInfo = context.moduleId
        ? `Current module: ${context.moduleId}`
        : "No specific module focused";

      const variables: Record<string, string> = {
        projectId: context.projectId,
        moduleInfo,
      };

      const systemPrompt = this.substituteVariables(promptContent, variables);

      const piMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: Date.now(),
      })) as unknown as import("@earendil-works/pi-ai").Message[];

      const result = await completeSimple(
        this.model,
        {
          systemPrompt,
          messages: piMessages,
        },
        {
          apiKey: this.apiKey,
          maxRetries: this.maxRetries,
          timeoutMs: this.timeoutMs,
          temperature: 0.7,
        },
      );

      if (result.stopReason === "error" || result.stopReason === "aborted") {
        return CHAT_FALLBACK;
      }

      const textContent = result.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("");

      return textContent || CHAT_FALLBACK;
    } catch (err) {
      console.error("[PiAgent] Chat failed:", err);
      return CHAT_FALLBACK;
    }
  }

  // ---- Utilities ----

  private substituteVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
      return varName in variables ? variables[varName] : match;
    });
  }

  private extractJSON(text: string): string {
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return jsonMatch[0];
    return text;
  }
}

// ---- Attribution Strategies (copied from engines/narrative.ts) ----

const ATTRIBUTION_STRATEGIES: Record<ProjectType, string[]> = {
  "新品上市": ["市场突破", "用户认知建立"],
  "日常种草": ["持续渗透", "口碑积累"],
  "节点营销": ["节点爆发", "流量转化"],
  "竞品防御": ["份额保卫", "差异化优势"],
};

// ---- Singleton ----

let instance: PiAgentService | null = null;

export function getPiAgentService(config?: PiAgentConfig): PiAgentService {
  if (!instance) {
    instance = new PiAgentService(config);
  }
  return instance;
}

export function resetPiAgentService(): void {
  instance = null;
}

// ---- Prompt Template type ----

export interface PromptTemplate {
  name: string;
  content: string;
  source: string;
  filePath: string;
}

/**
 * Custom loadSkillsFromDir implementation to avoid type conflicts.
 */
async function loadSkillsFromDir(dir: string): Promise<{ skills: Skill[] }> {
  const { existsSync } = await import("fs");
  const { readdir, readFile } = await import("fs/promises");
  const { resolve } = await import("path");

  if (!existsSync(dir)) return { skills: [] };

  const entries = await readdir(dir, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      const filePath = resolve(dir, entry.name);
      const content = await readFile(filePath, "utf-8");

      // Extract frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
      if (!frontmatterMatch) continue;

      const frontmatter: Record<string, string> = {};
      for (const line of frontmatterMatch[1].split("\n")) {
        const sepIdx = line.indexOf(":");
        if (sepIdx > 0) {
          frontmatter[line.slice(0, sepIdx).trim()] = line.slice(sepIdx + 1).trim();
        }
      }

      if (frontmatter.name && frontmatter.description) {
        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
          filePath,
          baseDir: dir,
          sourceInfo: { path: filePath, source: "pi", scope: "project", origin: "top-level" },
          disableModelInvocation: frontmatter["disable-model-invocation"] === "true",
        });
      }
    }
  }

  return { skills };
}
