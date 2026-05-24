import { PrismaClient } from '../../generated/prisma';
import { AgentManagementService } from './agent-management-service';

// ===== Types =====

export interface DispatchRequest {
  taskContent: string;
  workspaceId?: string;    // 指定则直接调用，不指定则 Master 路由
  targetAgentId?: string;  // 可直接指定 Agent
  metadata?: Record<string, unknown>;
}

export interface DispatchResult {
  logId: string;
  status: 'success' | 'error';
  response: string;
  agentId: string;
  durationMs: number;
}

/**
 * LLM caller abstraction for testability.
 * Accepts a system prompt, user message, and optional config.
 * Returns the LLM response string.
 */
export type LlmCaller = (
  systemPrompt: string,
  userMessage: string,
  config: { baseUrl?: string; apiKey?: string; modelName?: string; timeoutMs?: number; maxRetries?: number }
) => Promise<string>;

// ===== Service Class =====

export class DispatchService {
  private prisma: InstanceType<typeof PrismaClient>;
  private agentService: AgentManagementService;
  private llmCaller: LlmCaller;

  constructor(
    prismaClient?: InstanceType<typeof PrismaClient>,
    llmCaller?: LlmCaller,
    agentService?: AgentManagementService
  ) {
    this.prisma = prismaClient ?? new PrismaClient();
    this.llmCaller = llmCaller ?? (() => {
      throw new Error('LLM not configured');
    });
    this.agentService = agentService ?? new AgentManagementService(this.prisma);
  }

  /**
   * Dispatch a task to an Agent.
   *
   * Routing logic:
   * 1. If targetAgentId is provided → use that agent directly (sourceAgentId = null)
   * 2. If workspaceId is provided → find an enabled agent in that workspace
   * 3. If neither → use Master Agent to route (Master analyzes task to determine target)
   */
  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const startTime = Date.now();
    const metadataValue = request.metadata
      ? (JSON.parse(JSON.stringify(request.metadata)) as object)
      : undefined;

    let targetAgentId: string;
    let sourceAgentId: string | null = null;

    // Step 1: Determine target agent
    if (request.targetAgentId) {
      // Direct call mode: specified targetAgentId, bypass Master
      targetAgentId = request.targetAgentId;
      sourceAgentId = null;
    } else if (request.workspaceId) {
      // Workspace mode: find an enabled agent in the workspace
      const agents = await this.prisma.agent.findMany({
        where: {
          workspaceId: request.workspaceId,
          isEnabled: true,
          type: 'workspace',
        },
        orderBy: { createdAt: 'asc' },
        take: 1,
      });

      if (agents.length === 0) {
        throw new Error(`No enabled agent found in workspace: ${request.workspaceId}`);
      }

      targetAgentId = agents[0].id;
      sourceAgentId = null;
    } else {
      // Master routing mode: use Master Agent to determine target
      const masterAgent = await this.prisma.agent.findFirst({
        where: { type: 'master' },
      });

      if (!masterAgent) {
        throw new Error('Master Agent not found. Please initialize the system first.');
      }

      sourceAgentId = masterAgent.id;

      // Use Master Agent to analyze the task and determine target workspace
      const masterSystemPrompt = await this.agentService.buildSystemPrompt(masterAgent.id);

      const routingPrompt = `You are a routing agent. Analyze the following task and determine which workspace agent should handle it.
Available workspaces will be provided in your system prompt.
Respond with ONLY the workspace ID that should handle this task.

Task: ${request.taskContent}`;

      try {
        const masterConfig = masterAgent.modelConfigId
          ? await this.prisma.modelConfig.findUnique({ where: { id: masterAgent.modelConfigId } })
          : await this.prisma.modelConfig.findFirst({ where: { isDefault: true } });

        const routingResponse = await this.llmCaller(
          masterSystemPrompt,
          routingPrompt,
          {
            baseUrl: masterConfig?.baseUrl,
            apiKey: masterConfig?.apiKey,
            modelName: masterConfig?.modelName,
            timeoutMs: masterConfig?.timeoutMs,
            maxRetries: masterConfig?.maxRetries,
          }
        );

        // Find an enabled agent in the routed workspace
        const routedWorkspaceId = routingResponse.trim();
        const agents = await this.prisma.agent.findMany({
          where: {
            workspaceId: routedWorkspaceId,
            isEnabled: true,
            type: 'workspace',
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
        });

        if (agents.length === 0) {
          throw new Error(`No enabled agent found in routed workspace: ${routedWorkspaceId}`);
        }

        targetAgentId = agents[0].id;
      } catch (err) {
        // If Master routing fails, create an error log and return
        const durationMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        const log = await this.prisma.dispatchLog.create({
          data: {
            sourceAgentId,
            targetAgentId: masterAgent.id,
            taskSummary: request.taskContent.substring(0, 1000),
            status: 'error',
            errorMessage: `Master routing failed: ${errorMessage}`,
            durationMs,
            metadata: metadataValue,
            completedAt: new Date(),
          },
        });

        return {
          logId: log.id,
          status: 'error',
          response: `Master routing failed: ${errorMessage}`,
          agentId: masterAgent.id,
          durationMs,
        };
      }
    }

    // Step 2: Check target agent's enabled status
    const targetAgent = await this.prisma.agent.findUnique({
      where: { id: targetAgentId },
    });

    if (!targetAgent) {
      throw new Error(`Target agent not found: ${targetAgentId}`);
    }

    if (!targetAgent.isEnabled) {
      // Create error log for disabled agent
      const durationMs = Date.now() - startTime;
      const log = await this.prisma.dispatchLog.create({
        data: {
          sourceAgentId,
          targetAgentId,
          taskSummary: request.taskContent.substring(0, 1000),
          status: 'error',
          errorMessage: `Agent "${targetAgent.name}" is disabled and cannot process tasks`,
          durationMs,
          metadata: metadataValue,
          completedAt: new Date(),
        },
      });

      return {
        logId: log.id,
        status: 'error',
        response: `Agent "${targetAgent.name}" is disabled and cannot process tasks`,
        agentId: targetAgentId,
        durationMs,
      };
    }

    // Step 3: Create DispatchLog with status="pending"
    const log = await this.prisma.dispatchLog.create({
      data: {
        sourceAgentId,
        targetAgentId,
        taskSummary: request.taskContent.substring(0, 1000),
        status: 'pending',
        metadata: metadataValue,
      },
    });

    // Step 4: Update status to "running"
    await this.prisma.dispatchLog.update({
      where: { id: log.id },
      data: { status: 'running' },
    });

    // Step 5: Build system prompt
    const systemPrompt = await this.agentService.buildSystemPrompt(targetAgentId);

    // Step 6: Call LLM
    try {
      const modelConfig = targetAgent.modelConfigId
        ? await this.prisma.modelConfig.findUnique({ where: { id: targetAgent.modelConfigId } })
        : await this.prisma.modelConfig.findFirst({ where: { isDefault: true } });

      const response = await this.llmCaller(
        systemPrompt,
        request.taskContent,
        {
          baseUrl: modelConfig?.baseUrl,
          apiKey: modelConfig?.apiKey,
          modelName: modelConfig?.modelName,
          timeoutMs: modelConfig?.timeoutMs,
          maxRetries: modelConfig?.maxRetries,
        }
      );

      // Step 7: Update DispatchLog with success
      const durationMs = Date.now() - startTime;
      await this.prisma.dispatchLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          response,
          durationMs,
          completedAt: new Date(),
        },
      });

      // Step 8: Return DispatchResult
      return {
        logId: log.id,
        status: 'success',
        response,
        agentId: targetAgentId,
        durationMs,
      };
    } catch (err) {
      // Step 7 (error path): Update DispatchLog with error
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.prisma.dispatchLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          errorMessage,
          durationMs,
          completedAt: new Date(),
        },
      });

      return {
        logId: log.id,
        status: 'error',
        response: errorMessage,
        agentId: targetAgentId,
        durationMs,
      };
    }
  }

  /**
   * Get a single dispatch log by ID.
   */
  async getLog(id: string) {
    return this.prisma.dispatchLog.findUnique({
      where: { id },
    });
  }

  /**
   * Get dispatch logs with optional filtering by agentId (targetAgentId) and status.
   */
  async getLogs(filter?: { agentId?: string; status?: string }) {
    const where: { targetAgentId?: string; status?: string } = {};

    if (filter?.agentId) {
      where.targetAgentId = filter.agentId;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    return this.prisma.dispatchLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }
}
