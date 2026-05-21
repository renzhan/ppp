import { PrismaClient } from '../../generated/prisma';

// ===== Types =====

export interface CreateAgentInput {
  name: string;
  description?: string;
  workspaceId: string;
  modelConfigId?: string;
  systemPrompt?: string;
  skillIds?: string[];
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  modelConfigId?: string | null;
  systemPrompt?: string;
}

export interface AgentDetail {
  id: string;
  name: string;
  description: string | null;
  type: string;
  workspaceId: string | null;
  modelConfigId: string | null;
  systemPrompt: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  skills: Array<{
    id: string;
    name: string;
    description: string | null;
    scope: string;
  }>;
}

// ===== Service Class =====

export class AgentManagementService {
  private prisma: InstanceType<typeof PrismaClient>;

  constructor(prismaClient?: InstanceType<typeof PrismaClient>) {
    this.prisma = prismaClient ?? new PrismaClient();
  }

  /**
   * Ensure exactly one Master Agent exists in the system.
   * If a master agent already exists, return it. Otherwise, create one.
   */
  async initMasterAgent() {
    const existing = await this.prisma.agent.findFirst({
      where: { type: 'master' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.agent.create({
      data: {
        name: 'Master Agent',
        description: '系统主 Agent，负责调度各工作区 Agent',
        type: 'master',
        workspaceId: null,
        isEnabled: true,
      },
    });
  }

  /**
   * Create a Workspace Agent associated with a workspace.
   * Optionally links model config and skills.
   */
  async createWorkspaceAgent(data: CreateAgentInput) {
    const agent = await this.prisma.agent.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        type: 'workspace',
        workspaceId: data.workspaceId,
        modelConfigId: data.modelConfigId ?? null,
        systemPrompt: data.systemPrompt ?? null,
        isEnabled: true,
      },
    });

    // Attach skills if provided
    if (data.skillIds && data.skillIds.length > 0) {
      for (const skillId of data.skillIds) {
        await this.prisma.agentSkill.create({
          data: {
            agentId: agent.id,
            skillId,
          },
        });
      }
    }

    return agent;
  }

  /**
   * Update an Agent's properties (name, description, modelConfigId, systemPrompt).
   */
  async update(id: string, data: UpdateAgentInput) {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.modelConfigId !== undefined) updateData.modelConfigId = data.modelConfigId;
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt;

    return this.prisma.agent.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete an Agent.
   * If it's the last agent in a workspace, allow deletion but return a warning.
   */
  async delete(id: string): Promise<{ warning?: string }> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });

    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }

    // Check if this is the last agent in its workspace
    let warning: string | undefined;
    if (agent.workspaceId) {
      const workspaceAgentCount = await this.prisma.agent.count({
        where: { workspaceId: agent.workspaceId },
      });
      if (workspaceAgentCount === 1) {
        warning = `This is the last agent in the workspace. The workspace will have no agents after deletion.`;
      }
    }

    // Delete associated AgentSkill records (cascade should handle this, but be explicit)
    await this.prisma.agentSkill.deleteMany({
      where: { agentId: id },
    });

    await this.prisma.agent.delete({ where: { id } });

    return { warning };
  }

  /**
   * Find an Agent by ID, including its associated skills.
   */
  async findById(id: string): Promise<AgentDetail | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        agentSkills: {
          include: {
            skill: {
              select: {
                id: true,
                name: true,
                description: true,
                scope: true,
              },
            },
          },
        },
      },
    });

    if (!agent) {
      return null;
    }

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      type: agent.type,
      workspaceId: agent.workspaceId,
      modelConfigId: agent.modelConfigId,
      systemPrompt: agent.systemPrompt,
      isEnabled: agent.isEnabled,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      skills: agent.agentSkills.map((as) => ({
        id: as.skill.id,
        name: as.skill.name,
        description: as.skill.description,
        scope: as.skill.scope,
      })),
    };
  }

  /**
   * Find all Agents.
   */
  async findAll() {
    return this.prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find all Agents belonging to a specific workspace.
   */
  async findByWorkspace(workspaceId: string) {
    return this.prisma.agent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Toggle the enabled state of an Agent.
   */
  async toggleEnabled(id: string, enabled: boolean) {
    return this.prisma.agent.update({
      where: { id },
      data: { isEnabled: enabled },
    });
  }

  /**
   * Attach a Skill to an Agent.
   * Checks scope permissions: workspace-scoped skills can only be attached
   * to agents in the same workspace.
   */
  async attachSkill(agentId: string, skillId: string): Promise<void> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // Scope check: workspace-scoped skills can only be attached to agents in the same workspace
    if (skill.scope === 'workspace') {
      if (agent.workspaceId !== skill.workspaceId) {
        throw new Error(
          `Cannot attach workspace-scoped skill to agent in a different workspace`
        );
      }
    }

    // Create the association (unique constraint will prevent duplicates)
    await this.prisma.agentSkill.create({
      data: {
        agentId,
        skillId,
      },
    });
  }

  /**
   * Detach a Skill from an Agent by deleting the AgentSkill record.
   */
  async detachSkill(agentId: string, skillId: string): Promise<void> {
    const record = await this.prisma.agentSkill.findFirst({
      where: { agentId, skillId },
    });

    if (!record) {
      throw new Error(`Skill ${skillId} is not attached to agent ${agentId}`);
    }

    await this.prisma.agentSkill.delete({
      where: { id: record.id },
    });
  }

  /**
   * Build the complete system prompt for an Agent.
   * Concatenates the agent's own systemPrompt with all associated skill contents.
   */
  async buildSystemPrompt(agentId: string): Promise<string> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        agentSkills: {
          include: {
            skill: {
              select: {
                name: true,
                content: true,
              },
            },
          },
        },
      },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const parts: string[] = [];

    // Add agent's own system prompt
    if (agent.systemPrompt) {
      parts.push(agent.systemPrompt);
    }

    // Add each skill's content
    for (const agentSkill of agent.agentSkills) {
      parts.push(`\n\n--- Skill: ${agentSkill.skill.name} ---\n${agentSkill.skill.content}`);
    }

    return parts.join('');
  }
}
