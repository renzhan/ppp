/**
 * PPP Data Migration Verification Script
 *
 * Compares PPP project records before and after migration to confirm
 * byte-for-byte data preservation. Since PPP uses a separate PostgreSQL
 * database with no cross-DB dependencies, migration preserves data by
 * definition — this script verifies that invariant.
 *
 * Usage:
 *   npx tsx scripts/verify-ppp-data.ts --before snapshots/ppp-before.json --after snapshots/ppp-after.json
 *
 * The script:
 *   1. Reads serialized project records from --before and --after snapshot files
 *   2. Computes SHA-256 checksums for each record
 *   3. Compares checksums to confirm byte-for-byte preservation
 *   4. Outputs PASS/FAIL result with details
 *
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectRecord {
  id: string;
  name: string;
  brand: string;
  category: string;
  platform?: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface Snapshot {
  timestamp: string;
  recordCount: number;
  records: ProjectRecord[];
}

interface VerificationResult {
  passed: boolean;
  totalRecords: number;
  matchedRecords: number;
  mismatchedRecords: string[];
  missingInAfter: string[];
  extraInAfter: string[];
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { before: string; after: string } {
  const args = process.argv.slice(2);
  let before = '';
  let after = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--before' && args[i + 1]) {
      before = args[++i];
    } else if (args[i] === '--after' && args[i + 1]) {
      after = args[++i];
    }
  }

  if (!before || !after) {
    console.error('Usage: npx tsx scripts/verify-ppp-data.ts --before <path> --after <path>');
    console.error('');
    console.error('Options:');
    console.error('  --before  Path to pre-migration snapshot JSON file');
    console.error('  --after   Path to post-migration snapshot JSON file');
    process.exit(1);
  }

  return { before, after };
}

// ---------------------------------------------------------------------------
// Core verification logic
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic SHA-256 checksum for a project record.
 * Uses JSON.stringify with sorted keys to ensure consistent serialization.
 */
export function computeRecordChecksum(record: ProjectRecord): string {
  const serialized = JSON.stringify(record, Object.keys(record).sort());
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Load and parse a snapshot file.
 */
function loadSnapshot(path: string): Snapshot {
  if (!existsSync(path)) {
    console.error(`Error: Snapshot file not found: ${path}`);
    process.exit(1);
  }

  const content = readFileSync(path, 'utf8');
  const data = JSON.parse(content) as Snapshot;

  if (!Array.isArray(data.records)) {
    console.error(`Error: Invalid snapshot format in ${path} — expected "records" array`);
    process.exit(1);
  }

  return data;
}

/**
 * Verify that all records in the "before" snapshot are preserved
 * byte-for-byte in the "after" snapshot.
 */
export function verifyDataPreservation(
  beforeRecords: ProjectRecord[],
  afterRecords: ProjectRecord[]
): VerificationResult {
  const beforeMap = new Map<string, string>();
  const afterMap = new Map<string, string>();

  // Build checksum maps keyed by record ID
  for (const record of beforeRecords) {
    beforeMap.set(record.id, computeRecordChecksum(record));
  }
  for (const record of afterRecords) {
    afterMap.set(record.id, computeRecordChecksum(record));
  }

  const mismatchedRecords: string[] = [];
  const missingInAfter: string[] = [];
  const extraInAfter: string[] = [];
  let matchedRecords = 0;

  // Check all "before" records exist in "after" with same checksum
  for (const [id, beforeChecksum] of beforeMap) {
    const afterChecksum = afterMap.get(id);
    if (afterChecksum === undefined) {
      missingInAfter.push(id);
    } else if (beforeChecksum !== afterChecksum) {
      mismatchedRecords.push(id);
    } else {
      matchedRecords++;
    }
  }

  // Check for unexpected new records in "after"
  for (const id of afterMap.keys()) {
    if (!beforeMap.has(id)) {
      extraInAfter.push(id);
    }
  }

  const passed =
    mismatchedRecords.length === 0 &&
    missingInAfter.length === 0 &&
    extraInAfter.length === 0;

  return {
    passed,
    totalRecords: beforeRecords.length,
    matchedRecords,
    mismatchedRecords,
    missingInAfter,
    extraInAfter,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { before, after } = parseArgs();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PPP Data Migration Verification');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Before snapshot: ${before}`);
  console.log(`  After snapshot:  ${after}`);
  console.log('');

  const beforeSnapshot = loadSnapshot(before);
  const afterSnapshot = loadSnapshot(after);

  console.log(`  Before: ${beforeSnapshot.records.length} records (${beforeSnapshot.timestamp})`);
  console.log(`  After:  ${afterSnapshot.records.length} records (${afterSnapshot.timestamp})`);
  console.log('');

  const result = verifyDataPreservation(beforeSnapshot.records, afterSnapshot.records);

  if (result.passed) {
    console.log('  ✅ PASS — All records preserved byte-for-byte');
    console.log(`     ${result.matchedRecords}/${result.totalRecords} records verified`);
  } else {
    console.log('  ❌ FAIL — Data integrity issues detected');
    console.log('');

    if (result.mismatchedRecords.length > 0) {
      console.log(`  Mismatched records (${result.mismatchedRecords.length}):`);
      for (const id of result.mismatchedRecords) {
        console.log(`    - ${id}`);
      }
    }

    if (result.missingInAfter.length > 0) {
      console.log(`  Missing in after-migration (${result.missingInAfter.length}):`);
      for (const id of result.missingInAfter) {
        console.log(`    - ${id}`);
      }
    }

    if (result.extraInAfter.length > 0) {
      console.log(`  Unexpected new records (${result.extraInAfter.length}):`);
      for (const id of result.extraInAfter) {
        console.log(`    - ${id}`);
      }
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');

  process.exit(result.passed ? 0 : 1);
}

main();
