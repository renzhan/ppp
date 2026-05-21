import { PrismaClient } from '../../generated/prisma';

// ===== Types =====

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isEnabled?: boolean;
}

// ===== Preset Workspace Definitions =====

const PRESET_WORKSPACES = [
  {
    name: '复盘文档生成',
    description: '负责自动生成营销项目复盘报告文档',
    icon: 'file-bar-chart',
    sortOrder: 1,
  },
  {
    name: '复盘内容审校',
    description: '负责复盘报告内容的审核与校对',
    icon: 'eye',
    sortOrder: 2,
  },
  {
    name: '舆情系统',
    description: '负责舆情监控与分析',
    icon: 'trending-up',
    sortOrder: 3,
  },
  {
    name: '派芽知识库',
    description: '负责知识库管理与检索',
    icon: 'book-open',
    sortOrder: 4,
  },
  {
    name: '策划系统',
    description: '负责营销策划方案生成与管理',
    icon: 'lightbulb',
    sortOrder: 5,
  },
] as const;

// ===== Service Class =====

export class WorkspaceService {
  private prisma: InstanceType<typeof PrismaClient>;

  constructor(prismaClient?: InstanceType<typeof PrismaClient>) {
    this.prisma = prismaClient ?? new PrismaClient();
  }

  /**
   * Find all workspaces ordered by sortOrder.
   */
  async findAll() {
    return this.prisma.workspace.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create a custom workspace (isPreset=false).
   */
  async create(data: CreateWorkspaceInput) {
    return this.prisma.workspace.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        sortOrder: data.sortOrder ?? 0,
        isEnabled: true,
        isPreset: false,
      },
    });
  }

  /**
   * Update workspace properties: name, description, icon, sortOrder, isEnabled.
   */
  async update(id: string, data: UpdateWorkspaceInput) {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    return this.prisma.workspace.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a workspace.
   * - Preset workspaces (isPreset=true) cannot be deleted.
   * - Workspaces with associated Agents or KnowledgeDocuments cannot be deleted.
   */
  async delete(id: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });

    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    if (workspace.isPreset) {
      throw new Error('Cannot delete preset workspace');
    }

    // Check for associated Agents
    const agents = await this.prisma.agent.findMany({
      where: { workspaceId: id },
      select: { id: true, name: true },
    });

    // Check for associated KnowledgeDocuments
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { workspaceId: id },
      select: { id: true, fileName: true },
    });

    if (agents.length > 0 || documents.length > 0) {
      const references: string[] = [];
      if (agents.length > 0) {
        const agentNames = agents.map((a) => a.name);
        references.push(`Agents: ${agentNames.join(', ')}`);
      }
      if (documents.length > 0) {
        const docNames = documents.map((d) => d.fileName);
        references.push(`Documents: ${docNames.join(', ')}`);
      }
      throw new Error(
        `Cannot delete workspace: referenced by ${references.join('; ')}`
      );
    }

    await this.prisma.workspace.delete({ where: { id } });
  }

  /**
   * Initialize preset workspaces using upsert (idempotent).
   * Can be called by seed scripts or system startup.
   */
  async initPresets(): Promise<void> {
    for (const workspace of PRESET_WORKSPACES) {
      await this.prisma.workspace.upsert({
        where: { name: workspace.name },
        update: {
          description: workspace.description,
          icon: workspace.icon,
          sortOrder: workspace.sortOrder,
          isEnabled: true,
          isPreset: true,
        },
        create: {
          name: workspace.name,
          description: workspace.description,
          icon: workspace.icon,
          sortOrder: workspace.sortOrder,
          isEnabled: true,
          isPreset: true,
        },
      });
    }
  }
}
