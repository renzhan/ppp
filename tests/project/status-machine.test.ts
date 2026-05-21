/**
 * Unit tests for the Project Status Machine.
 * Tests the pure logic functions (findTransition, isValidStatus)
 * and the transitionStatus function with mocked Prisma client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VALID_TRANSITIONS,
  findTransition,
  isValidStatus,
  transitionStatus,
  type ProjectStatus,
  type StatusTransition,
} from '../../src/project/status-machine.js';

// Mock the shared db module
vi.mock('../../src/shared/db.js', () => {
  const mockPrisma = {
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    getPrismaClient: () => mockPrisma,
    prisma: mockPrisma,
  };
});

import { getPrismaClient } from '../../src/shared/db.js';

const mockPrisma = getPrismaClient() as unknown as {
  project: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe('VALID_TRANSITIONS', () => {
  it('defines exactly 4 transitions', () => {
    expect(VALID_TRANSITIONS).toHaveLength(4);
  });

  it('covers the full lifecycle: draft → uploading → generating → reviewing → finalized', () => {
    const statePath = VALID_TRANSITIONS.map(t => `${t.from}->${t.to}`);
    expect(statePath).toEqual([
      'draft->uploading',
      'uploading->generating',
      'generating->reviewing',
      'reviewing->finalized',
    ]);
  });

  it('has unique triggers for each transition', () => {
    const triggers = VALID_TRANSITIONS.map(t => t.trigger);
    expect(new Set(triggers).size).toBe(triggers.length);
  });

  it('contains the expected triggers', () => {
    const triggers = VALID_TRANSITIONS.map(t => t.trigger);
    expect(triggers).toContain('first_upload');
    expect(triggers).toContain('generate_triggered');
    expect(triggers).toContain('generation_complete');
    expect(triggers).toContain('finalize');
  });
});

describe('isValidStatus', () => {
  it('returns true for all valid statuses', () => {
    const validStatuses: ProjectStatus[] = ['draft', 'uploading', 'generating', 'reviewing', 'finalized'];
    for (const status of validStatuses) {
      expect(isValidStatus(status)).toBe(true);
    }
  });

  it('returns false for invalid statuses', () => {
    expect(isValidStatus('unknown')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('DRAFT')).toBe(false);
    expect(isValidStatus('active')).toBe(false);
  });
});

describe('findTransition', () => {
  it('finds transition for draft + first_upload', () => {
    const result = findTransition('draft', 'first_upload');
    expect(result).toEqual({ from: 'draft', to: 'uploading', trigger: 'first_upload' });
  });

  it('finds transition for uploading + generate_triggered', () => {
    const result = findTransition('uploading', 'generate_triggered');
    expect(result).toEqual({ from: 'uploading', to: 'generating', trigger: 'generate_triggered' });
  });

  it('finds transition for generating + generation_complete', () => {
    const result = findTransition('generating', 'generation_complete');
    expect(result).toEqual({ from: 'generating', to: 'reviewing', trigger: 'generation_complete' });
  });

  it('finds transition for reviewing + finalize', () => {
    const result = findTransition('reviewing', 'finalize');
    expect(result).toEqual({ from: 'reviewing', to: 'finalized', trigger: 'finalize' });
  });

  it('returns undefined for invalid trigger on valid status', () => {
    expect(findTransition('draft', 'finalize')).toBeUndefined();
    expect(findTransition('uploading', 'first_upload')).toBeUndefined();
    expect(findTransition('finalized', 'first_upload')).toBeUndefined();
  });

  it('returns undefined for valid trigger on wrong status', () => {
    expect(findTransition('uploading', 'first_upload')).toBeUndefined();
    expect(findTransition('generating', 'generate_triggered')).toBeUndefined();
    expect(findTransition('reviewing', 'generation_complete')).toBeUndefined();
    expect(findTransition('draft', 'finalize')).toBeUndefined();
  });

  it('returns undefined for unknown trigger', () => {
    expect(findTransition('draft', 'unknown_trigger')).toBeUndefined();
  });
});

describe('transitionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully transitions from draft to uploading', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: 'draft',
      updatedAt: new Date('2024-01-01'),
    });
    mockPrisma.project.update.mockResolvedValue({
      id: 'project-1',
      status: 'uploading',
    });

    const result = await transitionStatus('project-1', 'first_upload');

    expect(result).toEqual({ success: true, newStatus: 'uploading' });
    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: {
        id: 'project-1',
        updatedAt: new Date('2024-01-01'),
      },
      data: expect.objectContaining({
        status: 'uploading',
      }),
    });
  });

  it('successfully transitions from uploading to generating', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: 'uploading',
      updatedAt: new Date('2024-01-02'),
    });
    mockPrisma.project.update.mockResolvedValue({
      id: 'project-1',
      status: 'generating',
    });

    const result = await transitionStatus('project-1', 'generate_triggered');

    expect(result).toEqual({ success: true, newStatus: 'generating' });
  });

  it('successfully transitions from generating to reviewing', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: 'generating',
      updatedAt: new Date('2024-01-03'),
    });
    mockPrisma.project.update.mockResolvedValue({
      id: 'project-1',
      status: 'reviewing',
    });

    const result = await transitionStatus('project-1', 'generation_complete');

    expect(result).toEqual({ success: true, newStatus: 'reviewing' });
  });

  it('successfully transitions from reviewing to finalized', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: 'reviewing',
      updatedAt: new Date('2024-01-04'),
    });
    mockPrisma.project.update.mockResolvedValue({
      id: 'project-1',
      status: 'finalized',
    });

    const result = await transitionStatus('project-1', 'finalize');

    expect(result).toEqual({ success: true, newStatus: 'finalized' });
  });

  it('silently rejects invalid transition (wrong trigger for status)', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: 'draft',
      updatedAt: new Date('2024-01-01'),
    });

    const result = await transitionStatus('project-1', 'finalize');

    expect(result).toEqual({ success: false });
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it('silently rejects transition from finalized state', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: 'finalized',
      updatedAt: new Date('2024-01-01'),
    });

    const result = await transitionStatus('project-1', 'first_upload');

    expect(result).toEqual({ success: false });
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it('returns error when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const result = await transitionStatus('nonexistent-id', 'first_upload');

    expect(result).toEqual({ success: false, error: 'Project not found' });
  });

  it('returns error for invalid current status in database', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: 'invalid_status',
      updatedAt: new Date('2024-01-01'),
    });

    const result = await transitionStatus('project-1', 'first_upload');

    expect(result).toEqual({ success: false, error: 'Invalid current status: invalid_status' });
  });

  it('defaults to draft status when status field is not set', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      status: undefined,
      updatedAt: new Date('2024-01-01'),
    });
    mockPrisma.project.update.mockResolvedValue({
      id: 'project-1',
      status: 'uploading',
    });

    const result = await transitionStatus('project-1', 'first_upload');

    expect(result).toEqual({ success: true, newStatus: 'uploading' });
  });

  describe('optimistic locking', () => {
    it('retries on concurrent update conflict (P2025)', async () => {
      const updatedAt1 = new Date('2024-01-01');
      const updatedAt2 = new Date('2024-01-02');

      // First attempt: findUnique returns stale data, update fails with P2025
      // Second attempt: findUnique returns fresh data, update succeeds
      mockPrisma.project.findUnique
        .mockResolvedValueOnce({ id: 'project-1', status: 'draft', updatedAt: updatedAt1 })
        .mockResolvedValueOnce({ id: 'project-1', status: 'draft', updatedAt: updatedAt2 });

      mockPrisma.project.update
        .mockRejectedValueOnce({ code: 'P2025', message: 'Record not found' })
        .mockResolvedValueOnce({ id: 'project-1', status: 'uploading' });

      const result = await transitionStatus('project-1', 'first_upload');

      expect(result).toEqual({ success: true, newStatus: 'uploading' });
      expect(mockPrisma.project.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.project.update).toHaveBeenCalledTimes(2);
    });

    it('fails after max retries on persistent conflict', async () => {
      const updatedAt = new Date('2024-01-01');

      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        status: 'draft',
        updatedAt,
      });

      mockPrisma.project.update.mockRejectedValue({ code: 'P2025', message: 'Record not found' });

      const result = await transitionStatus('project-1', 'first_upload');

      expect(result).toEqual({ success: false, error: 'Concurrent update conflict after retries' });
      expect(mockPrisma.project.findUnique).toHaveBeenCalledTimes(3);
      expect(mockPrisma.project.update).toHaveBeenCalledTimes(3);
    });

    it('does not retry on non-P2025 errors', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        status: 'draft',
        updatedAt: new Date('2024-01-01'),
      });

      mockPrisma.project.update.mockRejectedValue(new Error('Database connection lost'));

      const result = await transitionStatus('project-1', 'first_upload');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
      expect(mockPrisma.project.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.project.update).toHaveBeenCalledTimes(1);
    });
  });
});
