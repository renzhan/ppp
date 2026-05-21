import path from 'path';
import dotenv from 'dotenv';
import { prisma } from './prisma';
import { ModelConfigService } from '../../../src/agent-management/model-config-service';
import { WorkspaceService } from '../../../src/agent-management/workspace-service';
import { AgentManagementService } from '../../../src/agent-management/agent-management-service';
import { SkillManagementService } from '../../../src/agent-management/skill-management-service';
import { KnowledgeService } from '../../../src/agent-management/knowledge-service';
import { DispatchService } from '../../../src/agent-management/dispatch-service';

// Ensure env is loaded (for ENCRYPTION_KEY used by CryptoUtil)
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

// Singleton instances of agent management services
const globalForServices = globalThis as unknown as {
  modelConfigService: ModelConfigService | undefined;
  workspaceService: WorkspaceService | undefined;
  agentManagementService: AgentManagementService | undefined;
  skillManagementService: SkillManagementService | undefined;
  knowledgeService: KnowledgeService | undefined;
  dispatchService: DispatchService | undefined;
};

export const modelConfigService =
  globalForServices.modelConfigService ?? new ModelConfigService(prisma as any);

export const workspaceService =
  globalForServices.workspaceService ?? new WorkspaceService(prisma as any);

export const agentManagementService =
  globalForServices.agentManagementService ?? new AgentManagementService(prisma as any);

export const skillManagementService =
  globalForServices.skillManagementService ?? new SkillManagementService(prisma as any);

export const knowledgeService =
  globalForServices.knowledgeService ?? new KnowledgeService(prisma as any);

export const dispatchService =
  globalForServices.dispatchService ?? new DispatchService(prisma as any, undefined, agentManagementService as any);

if (process.env.NODE_ENV !== 'production') {
  globalForServices.modelConfigService = modelConfigService;
  globalForServices.workspaceService = workspaceService;
  globalForServices.agentManagementService = agentManagementService;
  globalForServices.skillManagementService = skillManagementService;
  globalForServices.knowledgeService = knowledgeService;
  globalForServices.dispatchService = dispatchService;
}
