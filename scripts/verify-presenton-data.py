#!/usr/bin/env python3
"""
Presenton Data Migration Verification Script

Compares Presenton presentation records before and after migration to confirm
byte-for-byte data preservation. Since Presenton uses a separate SQLite/PostgreSQL
database with no cross-DB dependencies, migration preserves data by definition —
this script verifies that invariant.

Usage:
    python scripts/verify-presenton-data.py --before snapshots/presenton-before.json --after snapshots/presenton-after.json

The script:
    1. Reads serialized presentation records from --before and --after snapshot files
    2. Computes SHA-256 checksums for each record
    3. Compares checksums to confirm byte-for-byte preservation
    4. Outputs PASS/FAIL result with details

Requirements: 9.1, 9.2, 9.4, 9.5
"""

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

@dataclass
class VerificationResult:
    passed: bool
    total_records: int
    matched_records: int
    mismatched_records: list[str]
    missing_in_after: list[str]
    extra_in_after: list[str]


# ---------------------------------------------------------------------------
# Core verification logic
# ---------------------------------------------------------------------------

def compute_record_checksum(record: dict[str, Any]) -> str:
    """
    Compute a deterministic SHA-256 checksum for a presentation record.
    Uses sorted keys for consistent serialization.
    """
    serialized = json.dumps(record, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def load_snapshot(path: str) -> dict[str, Any]:
    """Load and parse a snapshot file."""
    file_path = Path(path)
    if not file_path.exists():
        print(f"Error: Snapshot file not found: {path}", file=sys.stderr)
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data.get("records"), list):
        print(
            f'Error: Invalid snapshot format in {path} — expected "records" array',
            file=sys.stderr,
        )
        sys.exit(1)

    return data


def verify_data_preservation(
    before_records: list[dict[str, Any]],
    after_records: list[dict[str, Any]],
) -> VerificationResult:
    """
    Verify that all records in the 'before' snapshot are preserved
    byte-for-byte in the 'after' snapshot.
    """
    before_map: dict[str, str] = {}
    after_map: dict[str, str] = {}

    # Build checksum maps keyed by record ID
    for record in before_records:
        record_id = record.get("id", "")
        before_map[record_id] = compute_record_checksum(record)

    for record in after_records:
        record_id = record.get("id", "")
        after_map[record_id] = compute_record_checksum(record)

    mismatched_records: list[str] = []
    missing_in_after: list[str] = []
    extra_in_after: list[str] = []
    matched_records = 0

    # Check all 'before' records exist in 'after' with same checksum
    for record_id, before_checksum in before_map.items():
        after_checksum = after_map.get(record_id)
        if after_checksum is None:
            missing_in_after.append(record_id)
        elif before_checksum != after_checksum:
            mismatched_records.append(record_id)
        else:
            matched_records += 1

    # Check for unexpected new records in 'after'
    for record_id in after_map:
        if record_id not in before_map:
            extra_in_after.append(record_id)

    passed = (
        len(mismatched_records) == 0
        and len(missing_in_after) == 0
        and len(extra_in_after) == 0
    )

    return VerificationResult(
        passed=passed,
        total_records=len(before_records),
        matched_records=matched_records,
        mismatched_records=mismatched_records,
        missing_in_after=missing_in_after,
        extra_in_after=extra_in_after,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify Presenton presentation data preservation during migration"
    )
    parser.add_argument(
        "--before",
        required=True,
        help="Path to pre-migration snapshot JSON file",
    )
    parser.add_argument(
        "--after",
        required=True,
        help="Path to post-migration snapshot JSON file",
    )
    args = parser.parse_args()

    print("═" * 59)
    print("  Presenton Data Migration Verification")
    print("═" * 59)
    print()
    print(f"  Before snapshot: {args.before}")
    print(f"  After snapshot:  {args.after}")
    print()

    before_snapshot = load_snapshot(args.before)
    after_snapshot = load_snapshot(args.after)

    before_records = before_snapshot["records"]
    after_records = after_snapshot["records"]

    print(
        f"  Before: {len(before_records)} records ({before_snapshot.get('timestamp', 'N/A')})"
    )
    print(
        f"  After:  {len(after_records)} records ({after_snapshot.get('timestamp', 'N/A')})"
    )
    print()

    result = verify_data_preservation(before_records, after_records)

    if result.passed:
        print("  ✅ PASS — All records preserved byte-for-byte")
        print(f"     {result.matched_records}/{result.total_records} records verified")
    else:
        print("  ❌ FAIL — Data integrity issues detected")
        print()

        if result.mismatched_records:
            print(f"  Mismatched records ({len(result.mismatched_records)}):")
            for record_id in result.mismatched_records:
                print(f"    - {record_id}")

        if result.missing_in_after:
            print(f"  Missing in after-migration ({len(result.missing_in_after)}):")
            for record_id in result.missing_in_after:
                print(f"    - {record_id}")

        if result.extra_in_after:
            print(f"  Unexpected new records ({len(result.extra_in_after)}):")
            for record_id in result.extra_in_after:
                print(f"    - {record_id}")

    print()
    print("═" * 59)

    sys.exit(0 if result.passed else 1)


if __name__ == "__main__":
    main()
