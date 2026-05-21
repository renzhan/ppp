import { describe, it, expect, afterAll, beforeAll, afterEach } from 'vitest';
import { SkillManagementService } from '../../../src/agent-management/skill-management-service';
import { getTestPrismaClient, disconnectTestClient } from '../../helpers/db-transaction';

const prisma = getTestPrismaClient();
let skillService: SkillManagementService;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-integration-tests!';
  skillService = new SkillManagementService(prisma);
});

afterEach(async () => {
  // Clean up skill versions and skills
  const skills = await prisma.skill.findMany({
    where: { name: { startsWith: 'integ-skill-' } },
  });
  for (const skill of skills) {
    await prisma.skillVersion.deleteMany({ where: { skillId: skill.id } });
  }
  await prisma.skill.deleteMany({ where: { name: { startsWith: 'integ-skill-' } } });
});

afterAll(async () => {
  await disconnectTestClient();
});

describe('SkillManagementService 版本管理集成测试', () => {
  /**
   * Validates: Requirements 4.5
   * Tests Skill creation, version management, and deletion flows.
   */

  it('创建 Skill 后应自动创建 v1 版本', async () => {
    const skill = await skillService.create({
      name: 'integ-skill-create-v1',
      description: 'Test skill for version management',
      content: '# Version 1\nInitial content.',
      scope: 'public',
    });

    expect(skill.id).toBeDefined();
    expect(skill.name).toBe('integ-skill-create-v1');
    expect(skill.version).toBe(1);

    // Verify version history has v1
    const versions = await skillService.getVersionHistory(skill.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe(1);
    expect(versions[0].content).toBe('# Version 1\nInitial content.');
  });

  it('更新 Skill 后应创建新版本记录', async () => {
    const skill = await skillService.create({
      name: 'integ-skill-update-version',
      description: 'Skill to update',
      content: '# V1 Content',
      scope: 'public',
    });

    // Update content → should create v2
    await skillService.update(skill.id, {
      content: '# V2 Content - Updated',
    });

    // Update again → should create v3
    await skillService.update(skill.id, {
      content: '# V3 Content - Final',
      name: 'integ-skill-update-version-renamed',
    });

    // Verify current skill state
    const current = await skillService.findById(skill.id);
    expect(current).not.toBeNull();
    expect(current!.version).toBe(3);
    expect(current!.content).toBe('# V3 Content - Final');
    expect(current!.name).toBe('integ-skill-update-version-renamed');
  });

  it('获取版本历史应包含所有版本且递增', async () => {
    const skill = await skillService.create({
      name: 'integ-skill-history',
      description: 'Skill with history',
      content: 'Content v1',
      scope: 'public',
    });

    await skillService.update(skill.id, { content: 'Content v2' });
    await skillService.update(skill.id, { content: 'Content v3' });
    await skillService.update(skill.id, { content: 'Content v4' });

    const versions = await skillService.getVersionHistory(skill.id);
    expect(versions).toHaveLength(4);

    // Versions should be ordered descending
    expect(versions[0].version).toBe(4);
    expect(versions[1].version).toBe(3);
    expect(versions[2].version).toBe(2);
    expect(versions[3].version).toBe(1);

    // Verify content matches each version
    expect(versions[0].content).toBe('Content v4');
    expect(versions[3].content).toBe('Content v1');
  });

  it('删除 Skill 后应不再存在', async () => {
    const skill = await skillService.create({
      name: 'integ-skill-delete',
      description: 'Skill to delete',
      content: 'Delete me',
      scope: 'public',
    });

    await skillService.delete(skill.id);

    const found = await skillService.findById(skill.id);
    expect(found).toBeNull();

    // Version records should also be gone
    const versions = await prisma.skillVersion.findMany({
      where: { skillId: skill.id },
    });
    expect(versions).toHaveLength(0);
  });
});
