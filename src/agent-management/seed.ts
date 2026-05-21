import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

/**
 * 预置工作区定义
 */
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

/**
 * 预置原生工具定义
 */
const PRESET_NATIVE_TOOLS = [
  {
    name: 'web_search',
    description: 'Web 搜索，获取互联网信息',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
        maxResults: {
          type: 'number',
          description: '最大返回结果数',
          default: 10,
        },
      },
      required: ['query'],
    },
    outputFormat: 'json',
  },
  {
    name: 'file_read',
    description: '读取指定路径的文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
        encoding: {
          type: 'string',
          description: '文件编码',
          default: 'utf-8',
        },
      },
      required: ['path'],
    },
    outputFormat: 'text',
  },
  {
    name: 'file_write',
    description: '写入内容到指定路径',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
        content: {
          type: 'string',
          description: '写入内容',
        },
        encoding: {
          type: 'string',
          description: '文件编码',
          default: 'utf-8',
        },
      },
      required: ['path', 'content'],
    },
    outputFormat: 'text',
  },
  {
    name: 'http_request',
    description: '发送 HTTP 请求到指定 URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '请求 URL',
        },
        method: {
          type: 'string',
          description: 'HTTP 方法',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          default: 'GET',
        },
        headers: {
          type: 'object',
          description: '请求头',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: '请求体',
        },
      },
      required: ['url'],
    },
    outputFormat: 'json',
  },
] as const;

/**
 * 初始化预置工作区和原生工具。
 * 使用 upsert 实现幂等逻辑，多次执行不产生重复记录。
 */
export async function seedAgentManagement(client?: PrismaClient): Promise<void> {
  const db = client ?? prisma;

  // Seed 预置工作区
  for (const workspace of PRESET_WORKSPACES) {
    await db.workspace.upsert({
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

  // Seed 预置原生工具
  for (const tool of PRESET_NATIVE_TOOLS) {
    await db.nativeTool.upsert({
      where: { name: tool.name },
      update: {
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputFormat: tool.outputFormat,
        isBuiltin: true,
      },
      create: {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputFormat: tool.outputFormat,
        isBuiltin: true,
      },
    });
  }
}

// 当直接执行此文件时运行 seed
const isDirectExecution = process.argv[1]?.includes('seed');
if (isDirectExecution) {
  seedAgentManagement()
    .then(() => {
      console.log('✅ Agent management seed completed');
    })
    .catch((e) => {
      console.error('❌ Agent management seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
