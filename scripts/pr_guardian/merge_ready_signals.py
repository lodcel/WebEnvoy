#!/usr/bin/env python3
"""Build and validate WebEnvoy merge-ready signal payloads."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


def load_json(path: str | Path) -> Any:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def load_json_or_null(path: str | None) -> Any:
    if not path:
        return None
    candidate = Path(path)
    if not candidate.is_file() or candidate.stat().st_size == 0:
        return None
    return load_json(candidate)


def load_changed_files(path: str | None) -> list[str]:
    if not path:
        return []
    candidate = Path(path)
    if not candidate.is_file():
        return []
    return [line.rstrip("\n") for line in candidate.read_text(encoding="utf-8").splitlines() if line.rstrip("\n")]


def canonical_json_sha256(path: str | None) -> str:
    payload = load_json_or_null(path)
    if payload is None:
        return ""
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def json_number_or_string(value: str) -> int | str:
    try:
        return int(value)
    except ValueError:
        return value


def parse_bool(value: str) -> bool:
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    raise argparse.ArgumentTypeError("expected true or false")


def build_merge_ready_input(args: argparse.Namespace) -> dict[str, Any]:
    pr_meta = load_json(args.pr_meta_file)
    checks = load_json(args.checks_file)
    implementation_record = load_json_or_null(args.implementation_record_file)
    spec_review_record = load_json_or_null(args.spec_review_record_file)
    base_sha = pr_meta.get("baseRefOid") or args.base_sha
    return {
        "schema_version": "webenvoy-merge-ready-signals/v1",
        "pr_number": args.pr_number,
        "checked_commit": args.checked_commit,
        "review_profile": args.review_profile,
        "changed_files": load_changed_files(args.changed_files_file),
        "pr": {
            "number": pr_meta.get("number", json_number_or_string(args.pr_number)),
            "title": pr_meta.get("title", ""),
            "body": pr_meta.get("body", ""),
            "url": pr_meta.get("url", ""),
            "base_ref": pr_meta.get("baseRefName", ""),
            "base_sha": base_sha,
            "head_ref": pr_meta.get("headRefName", ""),
            "head_sha": pr_meta.get("headRefOid", ""),
            "snapshot_head_sha": args.snapshot_head_sha,
            "head_repo_full_name": pr_meta.get("headRepoFullName", ""),
            "is_draft": pr_meta.get("isDraft"),
            "mergeable": pr_meta.get("mergeable", ""),
            "merge_state_status": pr_meta.get("mergeStateStatus", ""),
        },
        "review": {
            "source_authority": args.source_authority,
            "implementation_record_locator": args.implementation_record_locator,
            "implementation_record_sha256": canonical_json_sha256(args.implementation_record_file),
            "implementation_record": implementation_record,
            "spec_review_record_locator": args.spec_review_record_locator,
            "spec_review_record_sha256": canonical_json_sha256(args.spec_review_record_file),
            "spec_review_record": spec_review_record,
        },
        "github_checks": {
            "load_result": args.checks_load_result,
            "all_pass": args.checks_all_pass,
            "snapshot": checks if isinstance(checks, list) else [],
        },
        "gates": {
            "spec_review_required": args.spec_review_required,
            "live_evidence_locator": "code_review.md",
            "integration_check_locator": ".github/PULL_REQUEST_TEMPLATE.md",
        },
        "retained_host_action_results": {
            "github_review_state": {
                "reviewer": args.reviewer_for_gate,
                "expected_state": args.expected_review_state,
                "visible": args.review_state_visible,
                "head_sha": args.snapshot_head_sha,
            },
            "controlled_merge_wrapper": {
                "script": "scripts/merge-pr.sh",
                "adapter": "scripts/pr-guardian.sh",
                "action": "host_merge_after_loom_allow",
            },
        },
    }


def validate_merge_ready_result(payload: Any, *, pr_number: str, head_sha: str) -> None:
    if not isinstance(payload, dict):
        raise ValueError("Loom merge-ready result must be an object")
    checks = [
        payload.get("schema_version") == "loom-merge-ready-result/v1",
        payload.get("result") == "pass",
        payload.get("decision") == "allow",
        str((payload.get("pr") or {}).get("number")) == pr_number,
        (payload.get("pr") or {}).get("head_sha") == head_sha,
        (payload.get("pr") or {}).get("checked_commit") == head_sha,
        (payload.get("provenance") or {}).get("authority") == "loom_merge_ready",
    ]
    if not all(checks):
        missing = payload.get("missing_inputs")
        if isinstance(missing, list) and missing:
            raise ValueError("; ".join(str(item) for item in missing))
        raise ValueError("Loom merge-ready result 缺失、过期或格式错误")


def write_json(path: str | Path, payload: Any) -> None:
    with Path(path).open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def command_build(args: argparse.Namespace) -> None:
    write_json(args.output, build_merge_ready_input(args))


def command_validate(args: argparse.Namespace) -> None:
    try:
        validate_merge_ready_result(load_json(args.input), pr_number=args.pr_number, head_sha=args.head_sha)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    build = subparsers.add_parser("build-input")
    build.add_argument("--pr-number", required=True)
    build.add_argument("--pr-meta-file", required=True)
    build.add_argument("--checks-file", required=True)
    build.add_argument("--checks-load-result", required=True)
    build.add_argument("--checks-all-pass", required=True, type=parse_bool)
    build.add_argument("--reviewer-for-gate", required=True)
    build.add_argument("--expected-review-state", required=True)
    build.add_argument("--review-state-visible", required=True, type=parse_bool)
    build.add_argument("--review-profile", required=True)
    build.add_argument("--checked-commit", required=True)
    build.add_argument("--snapshot-head-sha", required=True)
    build.add_argument("--base-sha", required=True)
    build.add_argument("--source-authority", required=True)
    build.add_argument("--implementation-record-locator", default="")
    build.add_argument("--implementation-record-file", default="")
    build.add_argument("--spec-review-record-locator", default="")
    build.add_argument("--spec-review-record-file", default="")
    build.add_argument("--changed-files-file", default="")
    build.add_argument("--spec-review-required", required=True, type=parse_bool)
    build.add_argument("--output", required=True)
    build.set_defaults(func=command_build)

    validate = subparsers.add_parser("validate-result")
    validate.add_argument("--input", required=True)
    validate.add_argument("--pr-number", required=True)
    validate.add_argument("--head-sha", required=True)
    validate.set_defaults(func=command_validate)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
