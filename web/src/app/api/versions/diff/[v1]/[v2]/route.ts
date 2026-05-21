import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/versions/diff/[v1]/[v2]
 * Compare two report versions and return their differences.
 * v1 and v2 are version IDs.
 */
export async function GET(
  _request: Request,
  { params }: { params: { v1: string; v2: string } },
) {
  try {
    const { v1, v2 } = params;

    // Fetch both versions
    const [version1, version2] = await Promise.all([
      prisma.reportVersion.findUnique({
        where: { id: v1 },
        include: { moduleDecisions: true },
      }),
      prisma.reportVersion.findUnique({
        where: { id: v2 },
        include: { moduleDecisions: true },
      }),
    ]);

    if (!version1) {
      return NextResponse.json(
        { error: `Version ${v1} not found` },
        { status: 404 },
      );
    }

    if (!version2) {
      return NextResponse.json(
        { error: `Version ${v2} not found` },
        { status: 404 },
      );
    }

    if (version1.projectId !== version2.projectId) {
      return NextResponse.json(
        { error: 'Both versions must belong to the same project' },
        { status: 400 },
      );
    }

    const content1 = version1.content as Record<string, unknown>;
    const content2 = version2.content as Record<string, unknown>;

    // Compare module-by-module
    const allModuleIds = new Set([
      ...Object.keys(content1),
      ...Object.keys(content2),
    ]);

    const moduleDiffs: Array<{
      moduleId: string;
      changeType: 'added' | 'removed' | 'modified' | 'unchanged';
      v1Status?: string;
      v2Status?: string;
      v1Content?: unknown;
      v2Content?: unknown;
    }> = [];

    for (const moduleId of allModuleIds) {
      const mod1 = content1[moduleId] as Record<string, unknown> | undefined;
      const mod2 = content2[moduleId] as Record<string, unknown> | undefined;

      if (!mod1 && mod2) {
        moduleDiffs.push({
          moduleId,
          changeType: 'added',
          v2Status: (mod2.status as string) ?? 'unknown',
          v2Content: mod2,
        });
      } else if (mod1 && !mod2) {
        moduleDiffs.push({
          moduleId,
          changeType: 'removed',
          v1Status: (mod1.status as string) ?? 'unknown',
          v1Content: mod1,
        });
      } else if (mod1 && mod2) {
        const isEqual = JSON.stringify(mod1) === JSON.stringify(mod2);
        moduleDiffs.push({
          moduleId,
          changeType: isEqual ? 'unchanged' : 'modified',
          v1Status: (mod1.status as string) ?? 'unknown',
          v2Status: (mod2.status as string) ?? 'unknown',
          ...(isEqual ? {} : { v1Content: mod1, v2Content: mod2 }),
        });
      }
    }

    // Compare configs
    const config1 = version1.config as Record<string, unknown>;
    const config2 = version2.config as Record<string, unknown>;
    const configChanged = JSON.stringify(config1) !== JSON.stringify(config2);

    // Compare module decisions
    const decisionChanges = compareDecisions(
      version1.moduleDecisions,
      version2.moduleDecisions,
    );

    return NextResponse.json({
      v1: {
        id: version1.id,
        versionNumber: version1.versionNumber,
        generatedAt: version1.generatedAt,
        status: version1.status,
      },
      v2: {
        id: version2.id,
        versionNumber: version2.versionNumber,
        generatedAt: version2.generatedAt,
        status: version2.status,
      },
      summary: {
        totalModules: allModuleIds.size,
        added: moduleDiffs.filter((d) => d.changeType === 'added').length,
        removed: moduleDiffs.filter((d) => d.changeType === 'removed').length,
        modified: moduleDiffs.filter((d) => d.changeType === 'modified').length,
        unchanged: moduleDiffs.filter((d) => d.changeType === 'unchanged').length,
        configChanged,
      },
      moduleDiffs,
      configDiff: configChanged ? { v1: config1, v2: config2 } : null,
      decisionChanges,
    });
  } catch (error) {
    console.error('GET /api/versions/diff/[v1]/[v2] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Compare module decisions between two versions.
 */
function compareDecisions(
  decisions1: Array<{ moduleId: string; status: string; reason: string | null }>,
  decisions2: Array<{ moduleId: string; status: string; reason: string | null }>,
): Array<{ moduleId: string; v1Status: string; v2Status: string; changed: boolean }> {
  const allModuleIds = new Set([
    ...decisions1.map((d) => d.moduleId),
    ...decisions2.map((d) => d.moduleId),
  ]);

  return Array.from(allModuleIds).sort().map((moduleId) => {
    const d1 = decisions1.find((d) => d.moduleId === moduleId);
    const d2 = decisions2.find((d) => d.moduleId === moduleId);
    return {
      moduleId,
      v1Status: d1?.status ?? 'none',
      v2Status: d2?.status ?? 'none',
      changed: d1?.status !== d2?.status,
    };
  });
}
