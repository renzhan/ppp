import { PrismaClient } from '../../generated/prisma';

// ===== Types =====

export interface CreateSkillInput {
  name: string;
  description: string;
  content: string;        // Markdown 格式
  scope: 'public' | 'workspace';
  workspaceId?: string;   // scope=workspace 时必填
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  content?: string;
}

// ===== Service Class =====

export class SkillManagementService {
  private prisma: InstanceType<typeof PrismaClient>;

  constructor(prismaClient?: InstanceType<typeof PrismaClient>) {
    this.prisma = prismaClient ?? new PrismaClient();
  }

  /**
   * Create a new Skill and simultaneously create a v1 SkillVersion record.
   * If scope is 'workspace', workspaceId is required.
   */
  async create(data: CreateSkillInput) {
    if (data.scope === 'workspace' && !data.workspaceId) {
      throw new Error('workspaceId is required when scope is "workspace"');
    }

    const skill = await this.prisma.skill.create({
      data: {
        name: data.name,
        description: data.description,
        content: data.content,
        scope: data.scope,
        workspaceId: data.scope === 'workspace' ? data.workspaceId : null,
        version: 1,
      },
    });

    // Create the initial version record (v1)
    await this.prisma.skillVersion.create({
      data: {
        skillId: skill.id,
        version: 1,
        content: data.content,
      },
    });

    return skill;
  }

  /**
   * Update a Skill: increment version number, create a new SkillVersion record,
   * and update the Skill's main record (content, name, description).
   */
  async update(id: string, data: UpdateSkillInput) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });

    if (!skill) {
      throw new Error(`Skill not found: ${id}`);
    }

    const newVersion = skill.version + 1;
    const newContent = data.content ?? skill.content;

    // Create a new SkillVersion record
    const skillVersion = await this.prisma.skillVersion.create({
      data: {
        skillId: id,
        version: newVersion,
        content: newContent,
      },
    });

    // Update the Skill main record
    const updateData: Record<string, unknown> = {
      version: newVersion,
      content: newContent,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    await this.prisma.skill.update({
      where: { id },
      data: updateData,
    });

    return skillVersion;
  }

  /**
   * Delete a Skill.
   * Checks if any Agent references this skill via AgentSkill;
   * if so, blocks deletion and throws with the list of referencing agent names.
   */
  async delete(id: string): Promise<void> {
    const agentSkills = await this.prisma.agentSkill.findMany({
      where: { skillId: id },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    if (agentSkills.length > 0) {
      const agentNames = agentSkills.map((as) => as.agent.name);
      throw new Error(
        `Cannot delete skill: referenced by agents: ${agentNames.join(', ')}`
      );
    }

    // Delete associated version records first (cascade should handle, but be explicit)
    await this.prisma.skillVersion.deleteMany({
      where: { skillId: id },
    });

    await this.prisma.skill.delete({ where: { id } });
  }

  /**
   * Find a Skill by ID.
   */
  async findById(id: string) {
    return this.prisma.skill.findUnique({ where: { id } });
  }

  /**
   * Find all Skills with optional filtering by scope and/or workspaceId.
   */
  async findAll(filter?: { scope?: 'public' | 'workspace'; workspaceId?: string }) {
    const where: Record<string, unknown> = {};

    if (filter?.scope) {
      where.scope = filter.scope;
    }
    if (filter?.workspaceId) {
      where.workspaceId = filter.workspaceId;
    }

    return this.prisma.skill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get the version history for a Skill, ordered by version descending.
   */
  async getVersionHistory(id: string) {
    return this.prisma.skillVersion.findMany({
      where: { skillId: id },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Get all Skills available for a given Agent.
   * Returns all public Skills + workspace Skills matching the Agent's workspaceId.
   */
  async getAvailableForAgent(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { workspaceId: true },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Build OR conditions: public skills + workspace skills for the agent's workspace
    const orConditions: Array<Record<string, unknown>> = [
      { scope: 'public' },
    ];

    if (agent.workspaceId) {
      orConditions.push({
        scope: 'workspace',
        workspaceId: agent.workspaceId,
      });
    }

    return this.prisma.skill.findMany({
      where: {
        OR: orConditions,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
