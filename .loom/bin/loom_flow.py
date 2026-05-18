#!/usr/bin/env python3
"""Daily execution CLI for Loom checkpoints, workspace lifecycle, and purity checks."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fact_chain_support import (
    STATUS_FIELDS,
    STATUS_SOURCE_FIELDS,
    inspect_fact_chain,
    load_json_file,
    markdown_sections,
    parse_key_value_section,
    parse_recovery_entry,
    parse_work_item,
    path_boundary_missing_details,
    resolve_repo_relative_path,
)
from governance_surface import (
    build_governance_surface,
    derive_execution_budget_risk,
    EXTERNAL_ORCHESTRATOR_OPERATIONS,
    empty_hook_extension_profile,
    empty_target_release_status,
    empty_tool_availability,
    workspace_lifecycle_expectations,
)
from runtime_paths import shared_asset, shared_script
from runtime_state import detect_runtime_state

PR_TEMPLATE_SECTIONS = (
    "## Summary",
    "## Validation",
    "## Risks And Follow-ups",
    "## Related Work",
)
ADOPTION_PR_BODY_SECTIONS = (*PR_TEMPLATE_SECTIONS, "## Review Artifacts")
ADOPTION_REVIEW_ARTIFACT_LABELS = (
    "Active Work Item",
    "Active Recovery Entry",
    "Status Surface",
    "Review Record",
    "Spec Review Record",
)

OWNED_TEMP_ROOTS = (
    ".loom/.tmp",
    ".loom/tmp",
    ".loom/runtime/cache",
    ".loom/runtime/tmp",
    ".loom/flow/tmp",
)
OWNED_RUNTIME_EVIDENCE_ROOTS = (
    ".loom/runtime/review",
    ".loom/runtime/attempts",
)

TERMINAL_CHECKPOINTS = {
    "retired",
    "done",
    "closed",
    "merged",
    "archived",
}

RUNTIME_EVIDENCE_FIELDS = (
    "run_entry",
    "logs_entry",
    "diagnostics_entry",
    "verification_entry",
    "lane_entry",
)

RECOVERY_FIELD_LABELS = {
    "current_checkpoint": "Current Checkpoint",
    "current_stop": "Current Stop",
    "next_step": "Next Step",
    "blockers": "Blockers",
    "latest_validation_summary": "Latest Validation Summary",
    "recovery_boundary": "Recovery Boundary",
    "current_lane": "Current Lane",
}

WORK_ITEM_FIELD_LABELS = {
    "item_id": "Item ID",
    "goal": "Goal",
    "scope": "Scope",
    "execution_path": "Execution Path",
    "workspace_entry": "Workspace Entry",
    "recovery_entry": "Recovery Entry",
    "validation_entry": "Validation Entry",
    "closing_condition": "Closing Condition",
}

REVIEW_DECISIONS = {"allow", "block", "fallback"}
REVIEW_KINDS = {"general_review", "code_review", "spec_review"}
REVIEW_FINDING_SEVERITIES = {"warn", "block"}
REVIEW_FINDING_DISPOSITION_STATUSES = {"accepted", "rejected", "deferred"}
DEFAULT_REVIEW_ENGINE = "codex"
DEFAULT_REVIEW_ADAPTER = "loom/default-codex-exec"
CODEX_APP_REVIEW_ADAPTER = "loom/codex-app-review"
CODEX_APP_REVIEW_ENGINE = "codex-app-review"
CODEX_APP_REVIEW_SHADOW_ADAPTER = CODEX_APP_REVIEW_ADAPTER
AUTHORITATIVE_REVIEW_ADAPTERS = {DEFAULT_REVIEW_ADAPTER, CODEX_APP_REVIEW_ADAPTER}
SHADOW_REVIEW_ADAPTERS = {CODEX_APP_REVIEW_SHADOW_ADAPTER}
CODEX_APP_REVIEW_ENDPOINT_ENV = "LOOM_CODEX_APP_REVIEW_ENDPOINT"
CODEX_APP_REVIEW_THREAD_ID_ENV = "LOOM_CODEX_APP_REVIEW_THREAD_ID"
CODEX_APP_REVIEW_CWD_ENV = "LOOM_CODEX_APP_REVIEW_CWD"
CODEX_THREAD_ID_ENV = "CODEX_THREAD_ID"
DEFAULT_REVIEW_ENGINE_TIMEOUT_SECONDS: int | None = None
REVIEW_ENGINE_PROFILE_SCHEMA = "loom-review-engine-profile/v1"
REVIEW_ENGINE_PROFILE_IDS = {"default", "high-risk", "spec-review", "repeated-blocker"}
REVIEW_ENGINE_REASONING_EFFORTS = {"low", "medium", "high", "xhigh"}
PR_MERGE_GATE_SCHEMA = "loom-pr-merge-gate/v1"
CONTROLLED_MERGE_SCHEMA = "loom-controlled-merge/v1"
PR_MERGE_GATE_CHECK_NAME = "loom-pr-merge-gate"
LIVE_SMOKE_SCHEMA = "loom-live-smoke/v1"
HOST_ADAPTER_LIVE_DRIFT_SCHEMA = "loom-host-adapter-live-drift/v1"
DYNAMIC_TOOL_LIVE_AVAILABILITY_SCHEMA = "loom-dynamic-tool-live-availability/v1"
HOOK_ENVELOPE_SCHEMA = "loom-hook-envelope/v1"
HOOK_ENVELOPE_LIVE_CHECK_SCHEMA = "loom-hook-envelope-check/v1"
HOOKS_EXTENSION_PROFILE_SCHEMA = "loom-hooks-extension-profile/v1"
EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA = "loom-external-orchestrator-conformance/v1"
LIVE_SMOKE_RETRY_FALLBACK = "live-smoke-retry-or-record-unavailable"
LIVE_SMOKE_REPLAY_FALLBACK = "record-prior-evidence"
LIVE_SMOKE_CONFIG_FALLBACK = "live-smoke-config-repair"
HOOK_ENVELOPE_CATEGORIES = {"context_injection", "blocking_decision", "runtime_evidence"}
HOOK_ENVELOPE_FAILURE_CLASSIFICATIONS = {
    "invalid_envelope",
    "missing_required_input",
    "unsupported",
    "not_applicable",
    "permission_unavailable",
    "unsafe",
    "host_mapping_failed",
}
HOOK_ENVELOPE_FALLBACKS = {
    None,
    "admission",
    "pre_review",
    "review",
    "build",
    "merge_ready",
    "closeout",
    "manual_repair",
    "workspace cleanup|retire",
}
HOOK_ENVELOPE_FORBIDDEN_FIELDS = {
    "authored_progress",
    "recovery_truth",
    "status_truth",
    "review_verdict",
    "validation_summary",
    "host_action_result",
    "closeout_basis",
    "current_stop",
    "next_step",
    "blockers",
    "latest_validation_summary",
    "current_checkpoint",
    "current_lane",
    "recovery_boundary",
    "closing_condition",
}
EXTERNAL_ORCHESTRATOR_FORBIDDEN_FIELDS = {
    "scheduler_state",
    "attempt_ownership",
    "authored_progress",
    "current_checkpoint",
    "next_step",
    "blockers",
    "latest_validation_summary",
    "status_truth",
    "gate_verdict",
    "review_verdict",
    "validation_summary",
    "host_action_result",
    "closeout_basis",
    "daemon",
    "scheduler_queue",
    "branch_ownership",
    "pr_ownership",
    "worktree_ownership",
    "worker_lifecycle",
}
EXTERNAL_ORCHESTRATOR_ALLOWED_FALLBACKS = {
    "work_item",
    "admission",
    "binding_repair",
    "current_checkpoint",
    "spec_gate",
    "build_gate",
    "review_gate",
    "merge_gate",
    "build",
    "review",
    "merge_ready",
    "closeout",
}
HOOK_CLEANUP_ALLOWED_OWNERSHIPS = {"loom_owned"}
HOOK_LIFECYCLES = {"before-run", "after-run", "cleanup"}
HOOK_ADAPTER_RESULTS = {"supported", "not_applicable", "advisory", "unsafe"}
REVIEW_ENGINE_PROFILES: dict[str, dict[str, Any]] = {
    "default": {
        "profile_id": "default",
        "model": "gpt-5.2",
        "reasoning_effort": "medium",
        "timeout_seconds": DEFAULT_REVIEW_ENGINE_TIMEOUT_SECONDS,
        "context_policy": "minimal-review-baseline",
        "selection_reason": "default implementation review profile for normal-risk changes",
    },
    "high-risk": {
        "profile_id": "high-risk",
        "model": "gpt-5.2",
        "reasoning_effort": "high",
        "timeout_seconds": DEFAULT_REVIEW_ENGINE_TIMEOUT_SECONDS,
        "context_policy": "expanded-risk-baseline",
        "selection_reason": "high-risk review profile for shared contracts, security, permissions, sandbox, or host-boundary changes",
    },
    "spec-review": {
        "profile_id": "spec-review",
        "model": "gpt-5.2",
        "reasoning_effort": "high",
        "timeout_seconds": DEFAULT_REVIEW_ENGINE_TIMEOUT_SECONDS,
        "context_policy": "formal-spec-suite-baseline",
        "selection_reason": "formal spec review profile",
    },
    "repeated-blocker": {
        "profile_id": "repeated-blocker",
        "model": "gpt-5.2",
        "reasoning_effort": "high",
        "timeout_seconds": DEFAULT_REVIEW_ENGINE_TIMEOUT_SECONDS,
        "context_policy": "recent-findings-and-dispositions",
        "selection_reason": "repeated blocker review profile",
    },
}
ENGINE_FAILURE_REASONS = {
    "engine_unavailable",
    "schema_drift",
    "runtime_conflict",
    "repo_diff_detected",
}
SHADOW_PARITY_SURFACES = ("admission", "review", "merge_ready", "closeout")
ADOPTION_DECISIONS_SCHEMA = "loom-adoption-decisions/v1"
GUIDED_ADOPTION_PLAN_SCHEMA = "loom-guided-adoption-plan/v1"
COMPANION_GENERATION_SCHEMA = "loom-companion-generation/v1"
EXECUTION_ATTEMPT_SCHEMA = "loom-execution-attempt/v1"
EXECUTION_ATTEMPT_RESULTS = {"pass", "block", "fallback"}
EXECUTION_FAILURE_SCHEMA = "loom-execution-failure/v1"
EXECUTION_FAILURE_STATUSES = {"present", "not_applicable", "stale", "missing", "invalid"}
EXECUTION_FAILURE_CLASSIFICATIONS = {
    "none",
    "stall",
    "timeout",
    "retry_exhaustion",
    "unknown",
}
RETRY_EVIDENCE_SCHEMA = "loom-retry-evidence/v1"
RETRY_EVIDENCE_STATUSES = {"present", "not_applicable", "stale", "missing", "invalid"}
EXECUTION_ATTEMPT_FAILURE_CATEGORIES = {
    "none",
    "runtime_state",
    "fact_chain",
    "state_check",
    "runtime_evidence",
    "checkpoint",
    "review",
    "repo_specific",
    "recovery_readiness",
    "unknown",
}
EXECUTION_ATTEMPT_FORBIDDEN_AUTHORED_FIELDS = {
    "current_stop",
    "next_step",
    "blockers",
    "latest_validation_summary",
    "current_checkpoint",
    "current_lane",
    "recovery_boundary",
    "closing_condition",
}
REVIEW_CONTEXT_PACK_SCHEMA = "loom-review-context-pack/v1"
REPEATED_BLOCKER_SIGNAL_SCHEMA = "loom-repeated-blocker-signal/v1"
BUILD_EVIDENCE_SCHEMA = "loom-build-evidence/v1"
SUBAGENT_OWNERSHIP_SCHEMA = "loom-subagent-ownership/v1"
ATTACH_ONLY_FACT_CHAIN_MODE = "repo-native attach-only"

ADOPTION_DECISION_QUESTIONS: dict[str, str] = {
    "fr_work_item_layer": "Which host planning object owns the FR layer, and how does each FR point to its Work Item?",
    "closeout_reconciliation_read": "Which repo-native or host-owned closeout and reconciliation result should Loom read without taking ownership?",
    "repo_interface": "Which repo-specific requirements, specialized gates, metadata contracts, or context fields must remain repo companion-owned?",
    "repo_interop": "Which retained host action results, repo-native carriers, and shadow parity surfaces should Loom read?",
    "github_controlled_merge": "Which GitHub-controlled merge evidence proves the host merge boundary is ready without Loom taking over the host action?",
    "repo_specific_residue": "Which repo-specific residue must stay repo-owned instead of becoming Loom core?",
    "authority_boundary": "Where is the authority-of-truth for repo-native results, overrides, and fallback decisions?",
    "guardian_integration_contract": "Which guardian or integration-contract verdicts should be read as repo-native evidence rather than promoted into Loom core?",
}

ADOPTION_DECISION_SOURCES: dict[str, str] = {
    "fr_work_item_layer": "docs/adoption/github-profile-upgrade.md",
    "closeout_reconciliation_read": "docs/adoption/repo-interop-contract.md",
    "repo_interface": "docs/adoption/repo-companion-contract.md",
    "repo_interop": "docs/adoption/repo-interop-contract.md",
    "github_controlled_merge": "docs/adoption/github-profile.md",
    "repo_specific_residue": "docs/adoption/repo-companion-contract.md",
    "authority_boundary": "docs/adoption/repo-interop-contract.md",
    "guardian_integration_contract": "docs/adoption/repo-interop-contract.md",
}

ADOPTION_DECISION_WRITE_TARGETS: dict[str, list[str]] = {
    "fr_work_item_layer": [".loom/companion/repo-interface.json"],
    "closeout_reconciliation_read": [".loom/companion/interop.json"],
    "repo_interface": [".loom/companion/manifest.json", ".loom/companion/repo-interface.json"],
    "repo_interop": [".loom/companion/interop.json"],
    "github_controlled_merge": [],
    "repo_specific_residue": [".loom/companion/README.md", ".loom/companion/repo-interface.json"],
    "authority_boundary": [".loom/companion/interop.json"],
    "guardian_integration_contract": [".loom/companion/interop.json"],
}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Loom daily execution checks against a target repository.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    checkpoint = subparsers.add_parser("checkpoint", help="Evaluate a Loom checkpoint against the fact chain")
    checkpoint.add_argument("stage", choices=("admission", "build", "merge"))
    checkpoint.add_argument("--target", required=True, help="Target repository root")
    checkpoint.add_argument("--item", help="Expected current item id")
    checkpoint.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    workspace = subparsers.add_parser("workspace", help="Manage Loom workspace lifecycle semantics")
    workspace.add_argument("operation", choices=("create", "locate", "attach", "cleanup", "retire"))
    workspace.add_argument("--target", required=True, help="Target repository root")
    workspace.add_argument("--item", help="Expected current item id")
    workspace.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    purity = subparsers.add_parser("purity-check", help="Evaluate Loom workspace purity from the fact chain")
    purity.add_argument("--target", required=True, help="Target repository root")
    purity.add_argument("--item", help="Expected current item id")
    purity.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    fact_chain = subparsers.add_parser("fact-chain", help="Read and validate the Loom fact chain")
    fact_chain.add_argument("--target", required=True, help="Target repository root")
    fact_chain.add_argument("--item", help="Expected current item id")
    fact_chain.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    runtime = subparsers.add_parser("runtime-evidence", help="Read runtime evidence from the Loom fact chain")
    runtime.add_argument("--target", required=True, help="Target repository root")
    runtime.add_argument("--item", help="Expected current item id")
    runtime.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    runtime_state = subparsers.add_parser("runtime-state", help="Read the Loom runtime scene/carrier state")
    runtime_state.add_argument("--target", required=True, help="Target repository root")
    runtime_state.add_argument("--item", help="Expected current item id")
    runtime_state.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    adopt = subparsers.add_parser("adopt", help="Validate Loom downstream adoption contracts")
    adopt.add_argument("operation", choices=("verify",))
    adopt.add_argument("--target", required=True, help="Target repository root")
    adopt.add_argument("--item", help="Expected current item id")
    adopt.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    carrier = subparsers.add_parser("carrier", help="Refresh Loom-owned carrier metadata")
    carrier.add_argument("operation", choices=("refresh",))
    carrier.add_argument("--target", required=True, help="Target repository root")
    carrier.add_argument("--item", help="Expected current item id")
    carrier.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    carrier.add_argument("--dry-run", action="store_true", default=True, help="Preview refresh actions without writing files; this is the default")
    carrier.add_argument("--write", dest="dry_run", action="store_false", help="Write Loom-owned carrier metadata refreshes")

    host_binding = subparsers.add_parser("host-binding", help="Validate host issue, PR, branch, and SHA bindings")
    host_binding.add_argument("operation", choices=("validate",))
    host_binding.add_argument("--target", required=True, help="Target repository root")
    host_binding.add_argument("--owner", help="GitHub owner; auto-detected from origin when omitted")
    host_binding.add_argument("--repo", dest="repo_name", help="GitHub repository name; auto-detected from origin when omitted")
    host_binding.add_argument("--issue", type=int, help="GitHub Work Item issue number")
    host_binding.add_argument("--pr", type=int, help="GitHub implementation PR number")
    host_binding.add_argument("--branch", help="GitHub branch name")
    host_binding.add_argument("--head-sha", help="Implementation head SHA to validate")
    host_binding.add_argument("--base-sha", help="Base SHA used for diff validation")

    pr_gate = subparsers.add_parser("pr-gate", help="Evaluate PR-specific semantic approval before host merge")
    pr_gate.add_argument("operation", choices=("check",))
    pr_gate.add_argument("--target", required=True, help="Target repository root")
    pr_gate.add_argument("--item", help="Expected Loom Work Item id; must match PR body when both are present")
    pr_gate.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    pr_gate.add_argument("--owner", help="GitHub owner; auto-detected from origin when omitted")
    pr_gate.add_argument("--repo", dest="repo_name", help="GitHub repository name; auto-detected from origin when omitted")
    pr_gate.add_argument("--pr", type=int, help="GitHub implementation PR number")
    pr_gate.add_argument("--head-sha", help="Expected PR head SHA")
    pr_gate.add_argument("--branch", help="Optional PR branch/ref used to infer a PR number")
    pr_gate.add_argument("--pr-payload-file", help="Optional repo-relative PR payload JSON fixture")

    controlled_merge = subparsers.add_parser("controlled-merge", help="Check or execute Loom-controlled PR merge")
    controlled_merge.add_argument("operation", choices=("check", "merge"))
    controlled_merge.add_argument("--target", required=True, help="Target repository root")
    controlled_merge.add_argument("--item", help="Expected Loom Work Item id")
    controlled_merge.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    controlled_merge.add_argument("--owner", help="GitHub owner; auto-detected from origin when omitted")
    controlled_merge.add_argument("--repo", dest="repo_name", help="GitHub repository name; auto-detected from origin when omitted")
    controlled_merge.add_argument("--pr", type=int, required=True, help="GitHub implementation PR number")
    controlled_merge.add_argument("--head-sha", help="Expected PR head SHA")
    controlled_merge.add_argument("--merge-method", choices=("squash", "merge", "rebase"), default="squash")
    controlled_merge.add_argument("--delete-branch", action="store_true", help="Delete branch after a successful host merge")
    controlled_merge.add_argument("--execute", action="store_true", help="Actually delegate to gh pr merge when all gates pass")
    controlled_merge.add_argument("--pr-payload-file", help="Optional repo-relative PR payload JSON fixture")
    controlled_merge.add_argument("--status-checks-file", help="Optional repo-relative statusCheckRollup JSON fixture")
    controlled_merge.add_argument("--branch-protection-file", help="Optional repo-relative branch protection JSON fixture")
    controlled_merge.add_argument("--ruleset-file", help="Optional repo-relative branch rules/ruleset JSON fixture")

    state = subparsers.add_parser(
        "state-check",
        help="Check active-state consistency, checkpoint completeness, and scope overflow signals",
    )
    state.add_argument("--target", required=True, help="Target repository root")
    state.add_argument("--item", help="Expected current item id")
    state.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    review = subparsers.add_parser("review", help="Read, run, or record a Loom formal review artifact")
    review.add_argument("operation", choices=("read", "run", "record"))
    review.add_argument("--target", required=True, help="Target repository root")
    review.add_argument("--item", help="Expected current item id")
    review.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    review.add_argument("--review-file", help="Optional review artifact path relative to the target root")
    review.add_argument("--decision", choices=tuple(sorted(REVIEW_DECISIONS)))
    review.add_argument("--kind", choices=tuple(sorted(REVIEW_KINDS)))
    review.add_argument("--summary", help="Stable review conclusion summary")
    review.add_argument("--reviewer", help="Reviewer identity")
    review.add_argument("--fallback-to", choices=("admission", "build", "merge"))
    review.add_argument("--findings-file", help="Optional findings JSON path relative to the target root")
    review.add_argument(
        "--engine-adapter",
        choices=tuple(sorted(AUTHORITATIVE_REVIEW_ADAPTERS)),
        help=(
            "Optional authoritative review engine adapter for review run/record. "
            "When omitted, verified Codex App sessions use loom/codex-app-review; headless/CI fallback remains loom/default-codex-exec."
        ),
    )
    review.add_argument("--engine-evidence", help="Optional review engine evidence path relative to the target root")
    review.add_argument("--normalized-findings", help="Optional normalized findings path relative to the target root")
    review.add_argument(
        "--codex-app-review-app-server",
        help=f"Codex App app-server/session locator. Defaults to ${CODEX_APP_REVIEW_ENDPOINT_ENV} when available.",
    )
    review.add_argument(
        "--codex-app-review-thread-id",
        help=f"Codex App thread id. Defaults to ${CODEX_APP_REVIEW_THREAD_ID_ENV}, or ${CODEX_THREAD_ID_ENV} when an endpoint is present.",
    )
    review.add_argument(
        "--codex-app-review-cwd",
        help=f"Codex App thread cwd proof. Defaults to ${CODEX_APP_REVIEW_CWD_ENV}.",
    )
    review.add_argument(
        "--codex-app-review-raw-file",
        help="Optional repo-relative Codex App normalized review output captured from review/start or same-thread normalization.",
    )
    review.add_argument("--engine-profile", choices=tuple(sorted(REVIEW_ENGINE_PROFILE_IDS)), help="Optional deterministic review engine profile override for review run")
    review.add_argument("--engine-model", help="Optional review engine model override for review run")
    review.add_argument("--engine-reasoning", choices=tuple(sorted(REVIEW_ENGINE_REASONING_EFFORTS)), help="Optional review engine reasoning effort override for review run")
    review.add_argument("--engine-override-reason", help="Required reason when overriding review engine profile, model, or reasoning")
    review.add_argument(
        "--shadow-engine-adapter",
        choices=tuple(sorted(SHADOW_REVIEW_ADAPTERS)),
        help="Optional shadow-only review adapter. Does not replace the default authoritative review engine.",
    )
    review.add_argument(
        "--shadow-review-raw-file",
        help="Optional repo-relative captured Codex App review text to normalize as shadow evidence.",
    )
    review.add_argument("--blocking-issue", action="append", default=[], help="Blocking review finding")
    review.add_argument("--follow-up", action="append", default=[], help="Follow-up item recorded by the review")

    recovery = subparsers.add_parser("recovery", help="Write the authored Loom recovery entry")
    recovery.add_argument("operation", choices=("writeback",))
    recovery.add_argument("--target", required=True, help="Target repository root")
    recovery.add_argument("--item", help="Expected current item id")
    recovery.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    recovery.add_argument("--current-checkpoint", help="Updated checkpoint value")
    recovery.add_argument("--current-stop", help="Updated current stop")
    recovery.add_argument("--next-step", help="Updated next step")
    recovery.add_argument("--blockers", help="Updated blockers summary")
    recovery.add_argument("--latest-validation-summary", help="Updated validation summary")
    recovery.add_argument("--recovery-boundary", help="Updated recovery boundary")
    recovery.add_argument("--current-lane", help="Updated current lane")

    work_item = subparsers.add_parser("work-item", help="Create or update a Loom work item")
    work_item.add_argument("operation", choices=("create", "update"))
    work_item.add_argument("--target", required=True, help="Target repository root")
    work_item.add_argument("--item", required=True, help="Work item id")
    work_item.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    work_item.add_argument("--goal", help="Static goal")
    work_item.add_argument("--scope", help="Static scope")
    work_item.add_argument("--execution-path", help="Execution path")
    work_item.add_argument("--workspace-entry", help="Workspace entry")
    work_item.add_argument("--recovery-entry", help="Recovery entry path relative to the target root")
    work_item.add_argument("--validation-entry", help="Validation entry command")
    work_item.add_argument("--closing-condition", help="Closing condition")
    work_item.add_argument("--artifact", action="append", default=[], help="Associated artifact for create")
    work_item.add_argument("--add-artifact", action="append", default=[], help="Associated artifact to append")
    work_item.add_argument("--remove-artifact", action="append", default=[], help="Associated artifact to remove")
    work_item.add_argument("--activate", action="store_true", help="Activate this item in the current fact chain")
    work_item.add_argument("--init-recovery", action="store_true", help="Initialize the recovery entry when creating")

    host = subparsers.add_parser("host-lifecycle", help="Classify host objects against Loom lifecycle boundaries")
    host.add_argument("--target", required=True, help="Target repository root")
    host.add_argument("--item", help="Expected current item id")
    host.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    closeout = subparsers.add_parser("closeout", help="Check or sync Loom closeout state with GitHub control plane")
    closeout.add_argument("operation", choices=("check", "sync"))
    closeout.add_argument("--target", required=True, help="Target repository root")
    closeout.add_argument("--issue", type=int, help="GitHub issue number to validate or sync")
    closeout.add_argument("--pr", type=int, help="GitHub pull request number to validate or sync")
    closeout.add_argument("--project", type=int, help="GitHub project number to validate or sync")
    closeout.add_argument("--phase", type=int, help="GitHub Phase issue number")
    closeout.add_argument("--fr", type=int, help="GitHub FR issue number")
    closeout.add_argument("--branch", help="GitHub branch name bound to the work item")
    closeout.add_argument("--owner", help="GitHub owner; auto-detected from origin when omitted")
    closeout.add_argument("--repo", dest="repo_name", help="GitHub repository name; auto-detected from origin when omitted")
    closeout.add_argument("--comment", help="Optional closeout comment for issue sync")
    closeout.add_argument("--skip-gate", action="store_true", help="Skip local loom_check execution during closeout")

    reconciliation = subparsers.add_parser("reconciliation", help="Audit Loom GitHub drift before closeout reconciliation")
    reconciliation.add_argument("operation", choices=("audit", "sync"))
    reconciliation.add_argument("--target", required=True, help="Target repository root")
    reconciliation.add_argument("--issue", type=int, help="GitHub issue number to audit")
    reconciliation.add_argument("--pr", type=int, help="GitHub pull request number to audit")
    reconciliation.add_argument("--project", type=int, help="GitHub project number to audit")
    reconciliation.add_argument("--phase", type=int, help="GitHub Phase issue number")
    reconciliation.add_argument("--fr", type=int, help="GitHub FR issue number")
    reconciliation.add_argument("--branch", help="GitHub branch name bound to the work item")
    reconciliation.add_argument("--owner", help="GitHub owner; auto-detected from origin when omitted")
    reconciliation.add_argument("--repo", dest="repo_name", help="GitHub repository name; auto-detected from origin when omitted")
    reconciliation.add_argument("--comment", help="Optional closeout comment for issue sync")
    reconciliation.add_argument("--comment-file", help="Read closeout comment body from a file")
    reconciliation.add_argument("--dry-run", action="store_true", help="Preview reconciliation sync actions without writing GitHub state")

    shadow = subparsers.add_parser("shadow-parity", help="Compare Loom and repo-native parity surfaces without changing merge gates")
    shadow.add_argument("--target", required=True, help="Target repository root")
    shadow.add_argument(
        "--surface",
        choices=(*SHADOW_PARITY_SURFACES, "all"),
        default="all",
        help="Shadow surface to compare; defaults to all supported surfaces",
    )
    shadow.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    shadow.add_argument(
        "--mode",
        choices=("validation-only", "blocking"),
        default="validation-only",
        help="Shadow parity enforcement mode; defaults to validation-only.",
    )
    shadow.add_argument(
        "--blocking",
        action="store_true",
        help="Shortcut for --mode blocking. This is explicit opt-in and never the default.",
    )

    runtime_parity = subparsers.add_parser(
        "runtime-parity",
        help="Validate Loom core strong-governance runtime parity without host-specific orchestration",
    )
    runtime_parity.add_argument("operation", choices=("validate",))
    runtime_parity.add_argument("--target", required=True, help="Target repository root")
    runtime_parity.add_argument("--item", help="Expected current item id")
    runtime_parity.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )

    governance_profile = subparsers.add_parser(
        "governance-profile",
        help="Read Loom governance maturity and upgrade requirements",
    )
    governance_profile.add_argument("operation", choices=("status", "upgrade-plan", "upgrade", "binding"))
    governance_profile.add_argument("--target", required=True, help="Target repository root")
    governance_profile.add_argument("--to", choices=("standard", "strong"), help="Target maturity for governance-profile upgrade")
    governance_profile.add_argument("--dry-run", action="store_true", default=True, help="Preview upgrade actions without writing files; this is the default")
    governance_profile.add_argument("--apply", dest="dry_run", action="store_false", help="Apply Loom-owned scaffold writes")
    governance_profile.add_argument("--force", action="store_true", help="Allow replacement of existing Loom-owned scaffold files during upgrade apply")
    governance_profile.add_argument("--owner", help="GitHub owner; auto-detected from origin when omitted")
    governance_profile.add_argument("--repo", dest="repo_name", help="GitHub repository name; auto-detected from origin when omitted")
    governance_profile.add_argument("--phase", type=int, help="GitHub Phase issue number")
    governance_profile.add_argument("--fr", type=int, help="GitHub FR issue number")
    governance_profile.add_argument("--issue", type=int, help="GitHub Work Item issue number")
    governance_profile.add_argument("--pr", type=int, help="GitHub implementation PR number")
    governance_profile.add_argument("--branch", help="GitHub branch name bound to the work item")
    governance_profile.add_argument("--sync", action="store_true", help="Preview host binding repairs; writes are intentionally disabled in this phase")

    live_smoke = subparsers.add_parser(
        "live-smoke",
        help="Run or replay versioned adopted-repo live smoke evidence without changing core gates",
    )
    live_smoke.add_argument(
        "operation",
        choices=(
            "run",
            "replay",
            "host-adapter-drift",
            "dynamic-tool-availability",
            "hook-envelope",
            "hooks-extension",
            "external-orchestrator-interop",
        ),
    )
    live_smoke.add_argument("--target", help="Adopted repository root for live smoke run")
    live_smoke.add_argument("--item", default="INIT-0001", help="Expected current item id for the optional resume smoke")
    live_smoke.add_argument("--prior-evidence", help="Versioned prior-pass evidence to replay without running adopted-repo commands")
    live_smoke.add_argument("--dry-run", action="store_true", help="Preview the live smoke command plan without running adopted-repo commands")
    live_smoke.add_argument(
        "--surface",
        choices=("attempt_time", "review", "merge_ready", "closeout", "build", "admission", "pre_review", "all"),
        default="attempt_time",
        help="Dynamic tool live availability surface; defaults to attempt_time",
    )
    live_smoke.add_argument("--envelope", help="Repo-relative Loom hook envelope path for live-smoke hook-envelope")
    live_smoke.add_argument(
        "--requirement",
        choices=("required", "optional", "advisory"),
        default="required",
        help="Hook envelope requirement level; defaults to required",
    )
    live_smoke.add_argument(
        "--include-blocking-shadow",
        action="store_true",
        help="Explicitly include shadow-parity --blocking in the smoke command set",
    )

    flow = subparsers.add_parser("flow", help="Run a bundled high-frequency Loom flow")
    flow.add_argument("operation", choices=("build", "story", "pre-review", "review", "spec-review", "resume", "handoff", "merge-ready"))
    flow.add_argument("--target", required=True, help="Target repository root")
    flow.add_argument("--item", help="Expected current item id")
    flow.add_argument(
        "--output",
        default=".loom/bootstrap/init-result.json",
        help="Init-result path relative to the target root",
    )
    flow.add_argument("--build-evidence", help="Optional build evidence JSON path relative to the target root")

    return parser.parse_args(argv)


def emit(payload: dict[str, Any]) -> int:
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    result = payload.get("result")
    return 0 if result == "pass" else 1


def attach_only_carrier_guard(
    *,
    command: str,
    operation: str,
    output_path: Path,
    output_relative: str,
) -> dict[str, Any] | None:
    try:
        init_result = load_json_file(output_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return {
            "command": command,
            "operation": operation,
            "result": "block",
            "summary": f"{command} command could not inspect init-result before Loom carrier authoring.",
            "missing_inputs": [f"invalid init-result: {output_relative}: {exc}"],
            "fallback_to": "admission",
        }

    fact_chain = init_result.get("fact_chain")
    mode = fact_chain.get("mode") if isinstance(fact_chain, dict) else None
    if mode != ATTACH_ONLY_FACT_CHAIN_MODE:
        return None

    return {
        "command": command,
        "operation": operation,
        "result": "block",
        "summary": (
            f"{command} carrier authoring is disabled because the repository is in "
            f"{ATTACH_ONLY_FACT_CHAIN_MODE} fact-chain mode."
        ),
        "missing_inputs": [
            "repo-native attach-only mode forbids Loom-authored work-item, recovery, review, and status carriers."
        ],
        "fallback_to": "repo-native carriers",
        "fact_chain_mode": ATTACH_ONLY_FACT_CHAIN_MODE,
        "blocked_writes": [".loom/work-items", ".loom/progress", ".loom/reviews", ".loom/status"],
    }


def attach_only_host_write_guard(
    *,
    command: str,
    operation: str,
    target_root: Path,
) -> dict[str, Any] | None:
    output_relative = ".loom/bootstrap/init-result.json"
    output_path, output_errors = resolve_repo_relative_path(target_root, output_relative, label="init-result locator")
    if output_errors:
        return {
            "command": command,
            "operation": operation,
            "result": "block",
            "summary": f"{command} sync requires a safe init-result locator before host control-plane writes.",
            "missing_inputs": output_errors,
            "fallback_to": "manual-reconciliation",
        }
    assert output_path is not None
    if not output_path.exists():
        return {
            "command": command,
            "operation": operation,
            "result": "block",
            "summary": f"{command} sync requires an existing init-result before host control-plane writes.",
            "missing_inputs": [f"missing init-result: {output_relative}"],
            "fallback_to": "manual-reconciliation",
        }

    try:
        init_result = load_json_file(output_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return {
            "command": command,
            "operation": operation,
            "result": "block",
            "summary": f"{command} sync could not inspect init-result before host control-plane writes.",
            "missing_inputs": [f"invalid init-result: {output_relative}: {exc}"],
            "fallback_to": "manual-reconciliation",
        }

    fact_chain = init_result.get("fact_chain")
    mode = fact_chain.get("mode") if isinstance(fact_chain, dict) else None
    if mode != ATTACH_ONLY_FACT_CHAIN_MODE:
        return None

    return {
        "command": command,
        "operation": operation,
        "result": "block",
        "summary": (
            f"{command} host control-plane writes are disabled because the repository is in "
            f"{ATTACH_ONLY_FACT_CHAIN_MODE} fact-chain mode."
        ),
        "missing_inputs": [
            "repo-native attach-only mode forbids Loom-authored GitHub issue closing or project status sync."
        ],
        "fallback_to": "repo-native-closeout",
        "fact_chain_mode": ATTACH_ONLY_FACT_CHAIN_MODE,
        "blocked_writes": ["gh issue comment", "gh issue close", "GitHub Project item status sync"],
    }


def runtime_state_payload(target_root: Path) -> dict[str, Any]:
    return detect_runtime_state(__file__, "loom-flow", target_root=target_root)


def story_flow_payload(
    *,
    target_root: Path,
    runtime_state: dict[str, Any],
    steps: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "command": "flow",
        "operation": "story",
        "result": "pass",
        "summary": "story intake contract summary is available; runtime does not generate product truth without caller-provided context.",
        "missing_inputs": [],
        "fallback_to": None,
        "runtime_state": runtime_state,
        "target": str(target_root),
        "steps": steps
        + [
            {
                "name": "story-contract",
                "result": "pass",
                "summary": "User Story and Story Readiness contracts are separated from delivery state.",
                "missing_inputs": [],
                "fallback_to": None,
            }
        ],
        "contract_summary": {
            "mode": "contract-summary",
            "authority": "docs/methodology/governance/story-intake.md",
            "runtime_generates_story": False,
        },
        "story_contract": {
            "schema_version": "loom-user-story/v1",
            "required_fields": [
                "actor",
                "capability",
                "outcome",
                "business_value",
                "acceptance_scenarios",
                "provenance",
            ],
            "forbidden_fields": [
                "delivery_handoff",
                "spec_locator",
                "plan_locator",
                "recovery_state",
                "review_findings",
                "pr_summary",
                "merge_ready_result",
                "closeout_result",
            ],
            "scenario_dimensions": [
                "happy_path",
                "negative_path",
                "edge_case",
                "alternative_path",
                "security_permission",
                "environment_interruption",
            ],
        },
        "readiness_contract": {
            "schema_version": "loom-story-readiness/v1",
            "decisions": ["ready", "needs-shaping", "blocked", "not-applicable"],
            "required_fields": ["decision", "rationale", "story_locator", "checks", "missing_inputs", "fallback_to"],
            "checks": [
                "actor_specificity",
                "outcome_clarity",
                "value_signal",
                "acceptance_scenario_quality",
                "unresolved_blockers",
                "story_size",
            ],
            "authority_boundary": "readiness judges entry into spec / plan, not product strategy correctness.",
        },
        "delivery_consumption_contract": {
            "execution_entry": "Work Item",
            "spec_consumes": "story scenario id / locator as behavior contract input",
            "plan_consumes": "story scenario id mapped to tests, checks, manual validation, or not_applicable evidence",
            "forbidden": "story must not author recovery, review, PR, merge-ready, or closeout state",
        },
        "contract": {
            "story_intake": "docs/methodology/governance/story-intake.md",
            "story_template": "docs/methodology/templates/scaffold/user-story.md",
            "spec_suite": "docs/methodology/templates/spec-suite.md",
        },
    }


def runtime_state_block_payload(
    *,
    command: str,
    runtime_state: dict[str, Any],
    summary: str,
    operation: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "command": command,
        "result": "block",
        "summary": summary,
        "missing_inputs": list(runtime_state.get("missing_inputs", [])),
        "fallback_to": runtime_state.get("fallback_to"),
        "runtime_state": runtime_state,
    }
    if operation is not None:
        payload["operation"] = operation
    return payload


def command_target(target_root: Path) -> str:
    return shlex.quote(str(target_root))


def current_iso_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def discover_loom_flow_entrypoint() -> Path:
    source_repo_root = os.environ.get("LOOM_SOURCE_REPO_ROOT")
    if source_repo_root:
        candidate = Path(source_repo_root).expanduser().resolve() / "tools/loom_flow.py"
        if candidate.exists():
            return candidate
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "tools/loom_flow.py"
        if candidate.exists():
            return candidate
    return current


def live_smoke_command(args: list[str]) -> str:
    return " ".join(shlex.quote(part) for part in [sys.executable, str(discover_loom_flow_entrypoint()), *args])


def live_smoke_target_metadata(target_root: Path) -> dict[str, Any]:
    return {
        "path": str(target_root),
        "exists": target_root.exists(),
        "worktree": str(target_root),
        "git_branch": git_branch(target_root),
        "head_sha": git_head_sha(target_root),
    }


def live_smoke_release_interpretation(status: str) -> str:
    if status == "passed":
        return "fresh live smoke evidence raises release confidence and remains non-blocking by default."
    if status == "replayed":
        return "versioned prior-pass evidence can be consumed as release confidence input without rerunning adopted-repo commands."
    if status == "dry_run":
        return "dry-run only previews the live smoke command plan and does not create fresh adopted-repo evidence."
    if status == "unavailable":
        return "explicit unavailable evidence is a non-blocking confidence input and does not silently pass."
    return "profile-local live smoke failure lowers release confidence but does not replace orchestration-core gate results."


def current_host_adapter_version() -> str | None:
    source_repo_root = os.environ.get("LOOM_SOURCE_REPO_ROOT")
    candidates: list[tuple[Path, str]] = []
    if source_repo_root:
        candidates.append((Path(source_repo_root).expanduser().resolve() / "plugins/loom/.codex-plugin/plugin.json", "plugin"))
    installed_skills_root = os.environ.get("LOOM_INSTALLED_SKILLS_ROOT")
    if installed_skills_root:
        installed_root = Path(installed_skills_root).expanduser().resolve()
        candidates.append((installed_root / "loom-init" / "loom-package.json", "package"))
        candidates.append((installed_root / "loom-adopt" / "loom-package.json", "package"))
    for path, source in candidates:
        if not path.exists():
            continue
        try:
            payload = load_json_file(path)
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            continue
        if not isinstance(payload, dict):
            continue
        if source == "plugin":
            x_loom = payload.get("x-loom")
            version = x_loom.get("host_adapter_version") if isinstance(x_loom, dict) else None
        else:
            version = payload.get("host_adapter_version")
        if isinstance(version, str) and version.strip():
            return version.strip()
    return None


def host_adapter_live_drift_command(target_root: Path) -> str:
    return live_smoke_command(["live-smoke", "host-adapter-drift", "--target", str(target_root)])


def dynamic_tool_live_availability_command(target_root: Path, *, surface: str) -> str:
    return live_smoke_command(["live-smoke", "dynamic-tool-availability", "--target", str(target_root), "--surface", surface])


def hook_envelope_command(target_root: Path, *, envelope: str, requirement: str) -> str:
    return live_smoke_command(
        [
            "live-smoke",
            "hook-envelope",
            "--target",
            str(target_root),
            "--envelope",
            envelope,
            "--requirement",
            requirement,
        ]
    )


def host_adapter_live_drift_command_plan(target_root: Path, host_adapters: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    target = command_target(target_root)
    plan = [
        {
            "id": "target-check",
            "command": f"test -d {target}",
            "description": "Confirm the adopted-repo target path exists before reading host adapter retained result locators.",
        },
        {
            "id": "repo-interop-contract",
            "command": f"read {target_root / '.loom/companion/interop.json'}",
            "description": "Read the repo interop contract and discover declared host adapter retained result locators.",
        },
    ]
    for index, entry in enumerate(host_adapters or []):
        entry_id = entry.get("id") if isinstance(entry, dict) else None
        locator = entry.get("locator") if isinstance(entry, dict) else None
        plan.append(
            {
                "id": str(entry_id or f"host-adapter-{index}"),
                "command": f"read {locator if isinstance(locator, str) and locator else '<missing-locator>'}",
                "description": "Read the retained host action result envelope declared in repo interop.",
            }
        )
    return plan


def dynamic_tool_live_availability_command_plan(
    target_root: Path,
    *,
    surface: str,
    declared_tools: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    target = command_target(target_root)
    plan = [
        {
            "id": "target-check",
            "command": f"test -d {target}",
            "description": "Confirm the adopted-repo target path exists before reading dynamic tool handshake declarations.",
        },
        {
            "id": "repo-interface-contract",
            "command": f"read {target_root / '.loom/companion/repo-interface.json'}",
            "description": "Read the repo companion interface and discover declared dynamic tool availability locators.",
        },
    ]
    for index, entry in enumerate(declared_tools or []):
        entry_id = entry.get("id") if isinstance(entry, dict) else None
        locator = entry.get("locator") if isinstance(entry, dict) else None
        plan.append(
            {
                "id": str(entry_id or f"dynamic-tool-{index}"),
                "command": f"read {locator if isinstance(locator, str) and locator else '<missing-locator>'}",
                "description": f"Read the dynamic tool handshake declaration for surface `{surface}`.",
            }
        )
    return plan


def hook_envelope_command_plan(target_root: Path, *, envelope: str | None) -> list[dict[str, Any]]:
    target = command_target(target_root)
    return [
        {
            "id": "target-check",
            "command": f"test -d {target}",
            "description": "Confirm the adopted-repo target path exists before reading the mapped hook envelope.",
        },
        {
            "id": "hook-envelope",
            "command": f"read {envelope if isinstance(envelope, str) and envelope else '<missing-envelope>'}",
            "description": "Read the repo-relative Loom-mapped hook envelope without executing any hook.",
        },
    ]


def hooks_extension_command_plan(target_root: Path) -> list[dict[str, Any]]:
    target = command_target(target_root)
    return [
        {
            "id": "target-check",
            "command": f"test -d {target}",
            "description": "Confirm the adopted-repo target path exists before reading hooks extension declarations.",
        },
        {
            "id": "repo-interface-contract",
            "command": f"read {target_root / '.loom/companion/repo-interface.json'}",
            "description": "Read hook_locators from repo companion without executing hooks or writing host state.",
        },
    ]


def external_orchestrator_conformance_command_plan(
    target_root: Path,
    external_orchestrators: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    target = command_target(target_root)
    plan = [
        {
            "id": "target-check",
            "command": f"test -d {target}",
            "description": "Confirm the adopted-repo target path exists before reading external orchestrator declarations.",
        },
        {
            "id": "repo-interop-contract",
            "command": f"read {target_root / '.loom/companion/interop.json'} external_orchestrators",
            "description": "Read external orchestrator locator declarations without starting a scheduler or daemon.",
        },
        {
            "id": "status-consumer-view",
            "command": f"{shlex.quote(sys.executable)} tools/loom_status.py --target {shlex.quote(str(target_root))} --item INIT-0001",
            "description": "Confirm status/gate consumption reuses Loom status control plane v2 and the existing gate chain.",
        },
    ]
    for index, entry in enumerate(external_orchestrators or []):
        entry_id = entry.get("id") if isinstance(entry, dict) else None
        locator = entry.get("locator") if isinstance(entry, dict) else None
        plan.append(
            {
                "id": str(entry_id or f"external-orchestrator-{index}"),
                "command": f"read {locator if isinstance(locator, str) and locator else '<missing-locator>'}",
                "description": "Read external orchestrator retained evidence without accepting scheduler-owned status or gate truth.",
            }
        )
    return plan


def find_forbidden_hook_envelope_fields(value: object, *, prefix: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, nested in value.items():
            key_label = str(key)
            nested_prefix = f"{prefix}.{key_label}"
            if key_label in HOOK_ENVELOPE_FORBIDDEN_FIELDS:
                found.append(nested_prefix)
            found.extend(find_forbidden_hook_envelope_fields(nested, prefix=nested_prefix))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            found.extend(find_forbidden_hook_envelope_fields(nested, prefix=f"{prefix}[{index}]"))
    return found


def find_forbidden_external_orchestrator_fields(value: object, *, prefix: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, nested in value.items():
            key_label = str(key)
            nested_prefix = f"{prefix}.{key_label}"
            if key_label in EXTERNAL_ORCHESTRATOR_FORBIDDEN_FIELDS:
                found.append(nested_prefix)
            found.extend(find_forbidden_external_orchestrator_fields(nested, prefix=nested_prefix))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            found.extend(find_forbidden_external_orchestrator_fields(nested, prefix=f"{prefix}[{index}]"))
    return found


def find_unsafe_hook_cleanup_targets(value: object, *, prefix: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        targets = value.get("cleanup_targets")
        if isinstance(targets, list):
            for index, target in enumerate(targets):
                target_prefix = f"{prefix}.cleanup_targets[{index}]"
                if not isinstance(target, dict):
                    found.append(f"{target_prefix} must be an object")
                    continue
                ownership = target.get("ownership")
                if ownership not in HOOK_CLEANUP_ALLOWED_OWNERSHIPS:
                    found.append(f"{target_prefix}.ownership must be `loom_owned`")
        for key_label, nested in value.items():
            found.extend(find_unsafe_hook_cleanup_targets(nested, prefix=f"{prefix}.{key_label}"))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            found.extend(find_unsafe_hook_cleanup_targets(nested, prefix=f"{prefix}[{index}]"))
    return found


def validate_hook_envelope_payload(envelope: object) -> dict[str, Any]:
    missing_inputs: list[str] = []
    evidence: dict[str, Any] = {
        "schema_status": "unknown",
        "output_category": None,
        "failure_classification": None,
    }
    if not isinstance(envelope, dict):
        return {
            "result": "block",
            "classification": "invalid_envelope",
            "summary": "hook envelope must be a JSON object.",
            "missing_inputs": ["hook envelope must be a JSON object"],
            "fallback_to": "manual_repair",
            "evidence": evidence,
        }

    if envelope.get("schema_version") != HOOK_ENVELOPE_SCHEMA:
        missing_inputs.append("schema_version must be `loom-hook-envelope/v1`")
    else:
        evidence["schema_status"] = "valid"

    hook = envelope.get("hook")
    if not isinstance(hook, dict):
        missing_inputs.append("hook envelope missing `hook` object")
    else:
        for field in ("id", "locator"):
            value = hook.get(field)
            if not isinstance(value, str) or not value.strip():
                missing_inputs.append(f"hook missing `{field}`")
        lifecycle = hook.get("lifecycle")
        if lifecycle not in HOOK_LIFECYCLES:
            missing_inputs.append("hook.lifecycle must be `before-run`, `after-run`, or `cleanup`")

    input_payload = envelope.get("input")
    adapter_result = None
    if not isinstance(input_payload, dict):
        missing_inputs.append("hook envelope missing `input` object")
    else:
        for field in ("item_locator", "workspace_locator", "attempt_locator"):
            value = input_payload.get(field)
            if not isinstance(value, str) or not value.strip():
                missing_inputs.append(f"input missing `{field}`")
        mapping = input_payload.get("host_adapter_mapping")
        if not isinstance(mapping, dict):
            missing_inputs.append("input missing `host_adapter_mapping` object")
        else:
            for field in ("host", "event"):
                value = mapping.get(field)
                if not isinstance(value, str) or not value.strip():
                    missing_inputs.append(f"host_adapter_mapping missing `{field}`")
            if mapping.get("adapter_result") not in HOOK_ADAPTER_RESULTS:
                missing_inputs.append(
                    "host_adapter_mapping.adapter_result must be `supported`, `not_applicable`, `advisory`, or `unsafe`"
                )
            else:
                adapter_result = mapping.get("adapter_result")

    output = envelope.get("output")
    output_category = None
    if not isinstance(output, dict):
        missing_inputs.append("hook envelope missing `output` object")
    else:
        output_category = output.get("category")
        evidence["output_category"] = output_category
        if output_category not in HOOK_ENVELOPE_CATEGORIES:
            missing_inputs.append("output.category must be `context_injection`, `blocking_decision`, or `runtime_evidence`")
        summary = output.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            missing_inputs.append("output missing `summary`")

    forbidden_fields = find_forbidden_hook_envelope_fields(envelope)
    if forbidden_fields:
        missing_inputs.append(f"hook envelope must not carry authored or host truth fields: {', '.join(forbidden_fields)}")
    unsafe_cleanup_targets = find_unsafe_hook_cleanup_targets(envelope)
    if unsafe_cleanup_targets:
        missing_inputs.append(
            "hook envelope cleanup intent must target Loom-owned residue only: "
            + ", ".join(unsafe_cleanup_targets)
        )

    failure = envelope.get("failure")
    failure_classification = None
    fallback_to = None
    if failure is not None:
        if not isinstance(failure, dict):
            missing_inputs.append("failure must be an object when present")
        else:
            failure_classification = failure.get("classification")
            evidence["failure_classification"] = failure_classification
            if failure_classification not in HOOK_ENVELOPE_FAILURE_CLASSIFICATIONS:
                missing_inputs.append("failure.classification is outside the stable hook envelope vocabulary")
            fallback_to = failure.get("fallback_to")
            if fallback_to not in HOOK_ENVELOPE_FALLBACKS:
                missing_inputs.append("failure.fallback_to must point to a Loom surface or manual repair path")
            summary = failure.get("summary")
            if failure_classification and (not isinstance(summary, str) or not summary.strip()):
                missing_inputs.append("failure with classification must include `summary`")

    if missing_inputs:
        return {
            "result": "block",
            "classification": "invalid_envelope",
            "summary": "hook envelope is invalid or truth-polluting.",
            "missing_inputs": missing_inputs,
            "fallback_to": "manual_repair",
            "evidence": evidence,
        }

    if adapter_result == "unsafe":
        return {
            "result": "block",
            "classification": "unsafe",
            "summary": "hook adapter mapping reports unsafe.",
            "missing_inputs": ["host_adapter_mapping.adapter_result is unsafe"],
            "fallback_to": "manual_repair",
            "evidence": evidence,
        }
    if adapter_result == "not_applicable":
        return {
            "result": "warn",
            "classification": "not_applicable",
            "summary": "hook adapter mapping reports not_applicable.",
            "missing_inputs": [],
            "fallback_to": None,
            "evidence": evidence,
        }
    if adapter_result == "advisory":
        return {
            "result": "warn",
            "classification": "unsupported",
            "summary": "hook adapter mapping is advisory and remains profile-local evidence.",
            "missing_inputs": [],
            "fallback_to": None,
            "evidence": evidence,
        }

    if failure_classification == "not_applicable":
        return {
            "result": "warn",
            "classification": "not_applicable",
            "summary": "hook envelope reports not_applicable.",
            "missing_inputs": [],
            "fallback_to": None,
            "evidence": evidence,
        }
    if failure_classification:
        result = "block" if failure_classification in {"permission_unavailable", "unsafe", "host_mapping_failed"} else "warn"
        return {
            "result": result,
            "classification": failure_classification,
            "summary": str(failure.get("summary") if isinstance(failure, dict) else "hook envelope reports failure."),
            "missing_inputs": [f"hook envelope reported {failure_classification}"] if result == "block" else [],
            "fallback_to": fallback_to if result == "block" else None,
            "evidence": evidence,
        }
    return {
        "result": "pass",
        "classification": "none",
        "summary": f"hook envelope maps output as `{output_category}`.",
        "missing_inputs": [],
        "fallback_to": None,
        "evidence": evidence,
    }


def host_adapter_permission_unavailable(payload: dict[str, Any]) -> bool:
    candidates: list[str] = []
    for key in ("status", "result", "classification", "failure_category"):
        value = payload.get(key)
        if isinstance(value, str):
            candidates.append(value)
    read_status = payload.get("read_status")
    if isinstance(read_status, dict):
        for key in ("status", "result", "classification", "failure_category"):
            value = read_status.get(key)
            if isinstance(value, str):
                candidates.append(value)
    normalized = {value.strip().lower().replace("-", "_") for value in candidates if value.strip()}
    return "permission_unavailable" in normalized


def host_adapter_envelope_version(payload: dict[str, Any]) -> str | None:
    direct = payload.get("host_adapter_version")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    version_context = payload.get("version_context")
    if isinstance(version_context, dict):
        nested = version_context.get("host_adapter_version")
        if isinstance(nested, str) and nested.strip():
            return nested.strip()
    return None


def host_adapter_drift_check(
    target_root: Path,
    *,
    entry: object,
    index: int,
    expected_host_adapter_version: str | None,
) -> dict[str, Any]:
    prefix = f"host_adapters[{index}]"
    if not isinstance(entry, dict):
        return {
            "id": f"invalid-{index}",
            "owner": "unknown",
            "requirement": "required",
            "surfaces": [],
            "locator": None,
            "result": "block",
            "classification": "invalid_declaration",
            "summary": f"{prefix} must be an object.",
            "missing_inputs": [f"{prefix} must be an object"],
            "fallback_to": "admission",
            "evidence": {"locator_status": "invalid"},
        }

    entry_id = str(entry.get("id") or f"host-adapter-{index}")
    requirement = str(entry.get("requirement") or "required")
    fallback_to = entry.get("fallback_to") if isinstance(entry.get("fallback_to"), str) and entry.get("fallback_to") else "admission"
    owner = str(entry.get("owner") or "unknown")
    surfaces = entry.get("surfaces")
    locator_value = entry.get("locator")
    missing_inputs: list[str] = []
    if not isinstance(entry.get("summary"), str) or not entry.get("summary"):
        missing_inputs.append(f"{prefix} missing `summary`")
    if owner not in {"repo", "repo-companion", "host", "host-adapter", "platform", "external-tool"}:
        missing_inputs.append(f"{prefix} owner must stay repo/host/platform-owned, not Loom core")
    if requirement not in {"required", "optional", "advisory"}:
        missing_inputs.append(f"{prefix} requirement must be `required`, `optional`, or `advisory`")
    if not isinstance(surfaces, list) or not surfaces:
        missing_inputs.append(f"{prefix} must include `surfaces` as a non-empty list")
    else:
        for surface_index, surface in enumerate(surfaces):
            if surface not in {"admission", "pre_review", "review", "build", "merge_ready", "closeout"}:
                missing_inputs.append(
                    f"{prefix}.surfaces[{surface_index}] must be one of `admission`, `pre_review`, `review`, `build`, `merge_ready`, `closeout`"
                )
    if not isinstance(locator_value, str) or not locator_value.strip():
        classification = "locator_missing"
        result = "block" if requirement == "required" else "warn"
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": surfaces if isinstance(surfaces, list) else [],
            "locator": locator_value,
            "result": result,
            "classification": classification,
            "summary": "host adapter locator is missing.",
            "missing_inputs": [*missing_inputs, f"{prefix} `{entry_id}` locator missing `locator`"],
            "fallback_to": fallback_to if result == "block" else None,
            "evidence": {"locator_status": "missing"},
        }
    if missing_inputs:
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": surfaces if isinstance(surfaces, list) else [],
            "locator": locator_value,
            "result": "block",
            "classification": "invalid_declaration",
            "summary": "host adapter declaration is incomplete or invalid.",
            "missing_inputs": missing_inputs,
            "fallback_to": fallback_to,
            "evidence": {"locator_status": "invalid"},
        }

    locator_path, locator_errors = resolve_repo_relative_path(
        target_root,
        locator_value,
        label=f"{prefix} `{entry_id}` locator",
    )
    if locator_errors:
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": list(surfaces),
            "locator": locator_value,
            "result": "block",
            "classification": "unsafe_locator",
            "summary": "host adapter locator is outside the repository boundary or otherwise unsafe.",
            "missing_inputs": locator_errors,
            "fallback_to": fallback_to,
            "evidence": {"locator_status": "unsafe"},
        }
    assert locator_path is not None
    if not locator_path.exists():
        result = "block" if requirement == "required" else "warn"
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": list(surfaces),
            "locator": locator_value,
            "result": result,
            "classification": "locator_missing",
            "summary": "host adapter locator points to a missing retained result path.",
            "missing_inputs": [f"{prefix} locator points to missing path `{locator_value}`"],
            "fallback_to": fallback_to if result == "block" else None,
            "evidence": {"locator_status": "missing"},
        }
    if locator_path.is_dir():
        result = "block" if requirement == "required" else "warn"
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": list(surfaces),
            "locator": locator_value,
            "result": result,
            "classification": "locator_unreadable",
            "summary": "host adapter locator points to a directory, not a retained result envelope.",
            "missing_inputs": [f"{prefix} locator points to a directory `{locator_value}`"],
            "fallback_to": fallback_to if result == "block" else None,
            "evidence": {"locator_status": "directory"},
        }
    try:
        envelope = load_json_file(locator_path)
    except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
        result = "block" if requirement == "required" else "warn"
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": list(surfaces),
            "locator": locator_value,
            "result": result,
            "classification": "locator_unreadable",
            "summary": "host adapter retained result envelope is unreadable.",
            "missing_inputs": [f"{prefix} locator is unreadable: {exc}"],
            "fallback_to": fallback_to if result == "block" else None,
            "evidence": {"locator_status": "unreadable"},
        }
    if not isinstance(envelope, dict):
        result = "block" if requirement == "required" else "warn"
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": list(surfaces),
            "locator": locator_value,
            "result": result,
            "classification": "locator_unreadable",
            "summary": "host adapter retained result envelope must be a JSON object.",
            "missing_inputs": [f"{prefix} locator must expose a JSON object envelope"],
            "fallback_to": fallback_to if result == "block" else None,
            "evidence": {"locator_status": "invalid-envelope"},
        }

    declared_version = host_adapter_envelope_version(envelope)
    evidence = {
        "locator_status": "readable",
        "envelope_status": str(envelope.get("status") or envelope.get("result") or "present"),
        "declared_host_adapter_version": declared_version,
        "expected_host_adapter_version": expected_host_adapter_version,
    }
    summary = str(envelope.get("summary") or "host adapter retained result envelope is readable.")
    if host_adapter_permission_unavailable(envelope):
        result = "block" if requirement == "required" else "warn"
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": list(surfaces),
            "locator": locator_value,
            "result": result,
            "classification": "permission_unavailable",
            "summary": summary,
            "missing_inputs": [f"host adapter `{entry_id}` reported permission_unavailable"],
            "fallback_to": fallback_to if result == "block" else None,
            "evidence": evidence,
        }
    if declared_version and expected_host_adapter_version and declared_version != expected_host_adapter_version:
        return {
            "id": entry_id,
            "owner": owner,
            "requirement": requirement,
            "surfaces": list(surfaces),
            "locator": locator_value,
            "result": "warn",
            "classification": "version_drift",
            "summary": summary,
            "missing_inputs": [
                f"host adapter `{entry_id}` version drift: expected `{expected_host_adapter_version}`, found `{declared_version}`"
            ],
            "fallback_to": None,
            "evidence": evidence,
        }
    return {
        "id": entry_id,
        "owner": owner,
        "requirement": requirement,
        "surfaces": list(surfaces),
        "locator": locator_value,
        "result": "pass",
        "classification": "none",
        "summary": summary,
        "missing_inputs": [],
        "fallback_to": None,
        "evidence": evidence,
    }


def host_adapter_live_drift_payload(target_root: Path) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    target = live_smoke_target_metadata(target_root)
    payload: dict[str, Any] = {
        "command": "live-smoke",
        "operation": "host-adapter-drift",
        "schema_version": HOST_ADAPTER_LIVE_DRIFT_SCHEMA,
        "runtime_state": runtime_state,
        "target": target,
        "command_plan": host_adapter_live_drift_command_plan(target_root),
        "reports": [],
        "missing_inputs": [],
        "fallback_to": None,
    }
    if runtime_state.get("result") != "pass":
        payload.update(
            {
                "result": "block",
                "summary": "host adapter live drift is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": live_smoke_missing_inputs([str(message) for message in runtime_state.get("missing_inputs", [])]),
                "fallback_to": runtime_state.get("fallback_to"),
                "profile_check": {"id": "host-adapter-live-drift", "result": "block"},
                "host_adapter_drift": {
                    "contract_locator": ".loom/companion/interop.json",
                    "availability": "runtime-blocked",
                    "expected_host_adapter_version": current_host_adapter_version(),
                    "checks": [],
                },
            }
        )
        return payload

    target_report = live_smoke_target_check_report(target_root)
    payload["reports"] = [target_report]
    payload["missing_inputs"] = list(target_report.get("missing_inputs", []))
    if target_report["result"] != "pass":
        payload.update(
            {
                "result": "warn",
                "summary": "host adapter live drift recorded explicit unavailable evidence for the adopted-repo target.",
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "profile_check": {"id": "host-adapter-live-drift", "result": "warn"},
                "host_adapter_drift": {
                    "contract_locator": ".loom/companion/interop.json",
                    "availability": "target-unavailable",
                    "expected_host_adapter_version": current_host_adapter_version(),
                    "checks": [],
                },
            }
        )
        return payload

    governance_surface = build_governance_surface(target_root)
    repo_interop = governance_surface.get("repo_interop")
    expected_version = current_host_adapter_version()
    contract_locator = ".loom/companion/interop.json"
    availability = "absent"
    if isinstance(repo_interop, dict):
        availability = str(repo_interop.get("availability") or "absent")
        contract = repo_interop.get("contract")
        if isinstance(contract, dict) and isinstance(contract.get("locator"), str) and contract.get("locator"):
            contract_locator = str(contract["locator"])
    interop_report = {
        "id": "repo-interop-contract",
        "attempted": True,
        "command": f"read {target_root / contract_locator}",
        "reported_command": "repo-interop-contract",
        "reported_result": availability,
        "result": "pass",
        "summary": "repo interop contract is readable.",
        "missing_inputs": [],
        "fallback_to": None,
    }
    payload["reports"].append(interop_report)

    if availability == "absent":
        interop_report.update(
            {
                "result": "warn",
                "summary": "repo interop contract is absent, so no host adapter retained result can be consumed.",
                "missing_inputs": ["repo interop contract is absent"],
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "warn",
                "summary": interop_report["summary"],
                "missing_inputs": interop_report["missing_inputs"],
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "profile_check": {"id": "host-adapter-live-drift", "result": "warn"},
                "host_adapter_drift": {
                    "contract_locator": contract_locator,
                    "availability": "absent",
                    "expected_host_adapter_version": expected_version,
                    "checks": [],
                },
            }
        )
        return payload

    interop_payload, interop_errors = load_repo_interop_contract(repo_interop, target_root=target_root)
    if interop_errors or not isinstance(interop_payload, dict):
        interop_report.update(
            {
                "result": "block",
                "summary": "repo interop contract is incomplete or unreadable for host adapter live drift.",
                "missing_inputs": interop_errors or ["repo interop contract is unreadable"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": interop_report["summary"],
                "missing_inputs": list(interop_report["missing_inputs"]),
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "host-adapter-live-drift", "result": "block"},
                "host_adapter_drift": {
                    "contract_locator": contract_locator,
                    "availability": "incomplete",
                    "expected_host_adapter_version": expected_version,
                    "checks": [],
                },
            }
        )
        return payload

    host_adapters = interop_payload.get("host_adapters")
    if not isinstance(host_adapters, list):
        interop_report.update(
            {
                "result": "block",
                "summary": "repo interop contract does not expose a readable host_adapters list.",
                "missing_inputs": ["repo interop contract must include `host_adapters` as a list"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": interop_report["summary"],
                "missing_inputs": list(interop_report["missing_inputs"]),
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "host-adapter-live-drift", "result": "block"},
                "host_adapter_drift": {
                    "contract_locator": contract_locator,
                    "availability": "incomplete",
                    "expected_host_adapter_version": expected_version,
                    "checks": [],
                },
            }
        )
        return payload

    payload["command_plan"] = host_adapter_live_drift_command_plan(target_root, host_adapters=host_adapters)
    if not host_adapters:
        interop_report.update(
            {
                "result": "warn",
                "summary": "repo interop contract is readable but declares no host adapters.",
                "missing_inputs": ["repo interop contract declares no host adapters"],
                "fallback_to": None,
            }
        )
        payload.update(
            {
                "result": "warn",
                "summary": interop_report["summary"],
                "missing_inputs": list(interop_report["missing_inputs"]),
                "fallback_to": None,
                "profile_check": {"id": "host-adapter-live-drift", "result": "warn"},
                "host_adapter_drift": {
                    "contract_locator": contract_locator,
                    "availability": "present",
                    "expected_host_adapter_version": expected_version,
                    "checks": [],
                },
            }
        )
        return payload

    checks = [
        host_adapter_drift_check(
            target_root,
            entry=entry,
            index=index,
            expected_host_adapter_version=expected_version,
        )
        for index, entry in enumerate(host_adapters)
    ]
    for check in checks:
        payload["reports"].append(
            {
                "id": str(check["id"]),
                "attempted": True,
                "command": f"read {check.get('locator') or '<missing-locator>'}",
                "reported_command": "host-adapter-retained-result",
                "reported_result": str(check["classification"]),
                "result": str(check["result"]),
                "summary": str(check["summary"]),
                "missing_inputs": list(check.get("missing_inputs", [])),
                "fallback_to": check.get("fallback_to"),
            }
        )
    missing_inputs = live_smoke_missing_inputs(
        [message for report in payload["reports"] for message in report.get("missing_inputs", [])]
    )
    has_block = any(check["result"] == "block" for check in checks)
    has_warn = any(check["result"] == "warn" for check in checks)
    result = "block" if has_block else "warn" if has_warn else "pass"
    summary = "host adapter retained result locators are readable and show no drift."
    if result == "warn":
        summary = "host adapter live drift produced profile-local warnings."
    if result == "block":
        summary = "host adapter live drift found blocking retained result declaration or readability gaps."
    payload.update(
        {
            "result": result,
            "summary": summary,
            "missing_inputs": missing_inputs,
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK if result == "block" else None,
            "profile_check": {"id": "host-adapter-live-drift", "result": result},
            "host_adapter_drift": {
                "contract_locator": contract_locator,
                "availability": "present",
                "expected_host_adapter_version": expected_version,
                "checks": checks,
            },
        }
    )
    return payload


def hook_envelope_payload(target_root: Path, *, envelope: str, requirement: str) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    target = live_smoke_target_metadata(target_root)
    payload: dict[str, Any] = {
        "command": "live-smoke",
        "operation": "hook-envelope",
        "schema_version": HOOK_ENVELOPE_LIVE_CHECK_SCHEMA,
        "runtime_state": runtime_state,
        "target": target,
        "command_plan": hook_envelope_command_plan(target_root, envelope=envelope),
        "reports": [],
        "missing_inputs": [],
        "fallback_to": None,
    }
    if requirement not in {"required", "optional", "advisory"}:
        payload.update(
            {
                "result": "block",
                "summary": "hook envelope check requires requirement to be required, optional, or advisory.",
                "missing_inputs": ["--requirement must be `required`, `optional`, or `advisory`"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "hook-envelope", "result": "block"},
                "hook_envelope": {
                    "contract_locator": envelope,
                    "availability": "invalid-declaration",
                    "requirement": requirement,
                    "checks": [],
                },
            }
        )
        return payload
    if runtime_state.get("result") != "pass":
        payload.update(
            {
                "result": "block",
                "summary": "hook envelope check is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": live_smoke_missing_inputs([str(message) for message in runtime_state.get("missing_inputs", [])]),
                "fallback_to": runtime_state.get("fallback_to"),
                "profile_check": {"id": "hook-envelope", "result": "block"},
                "hook_envelope": {
                    "contract_locator": envelope,
                    "availability": "runtime-blocked",
                    "requirement": requirement,
                    "checks": [],
                },
            }
        )
        return payload

    target_report = live_smoke_target_check_report(target_root)
    payload["reports"] = [target_report]
    payload["missing_inputs"] = list(target_report.get("missing_inputs", []))
    if target_report["result"] != "pass":
        payload.update(
            {
                "result": "warn",
                "summary": "hook envelope check recorded explicit unavailable evidence for the adopted-repo target.",
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "profile_check": {"id": "hook-envelope", "result": "warn"},
                "hook_envelope": {
                    "contract_locator": envelope,
                    "availability": "target-unavailable",
                    "requirement": requirement,
                    "checks": [],
                },
            }
        )
        return payload

    envelope_path, envelope_errors = resolve_repo_relative_path(target_root, envelope, label="hook envelope locator")
    if envelope_errors:
        check = {
            "id": "hook-envelope",
            "requirement": requirement,
            "locator": envelope,
            "result": "block",
            "classification": "unsafe",
            "summary": "hook envelope locator is outside the repository boundary or otherwise unsafe.",
            "missing_inputs": envelope_errors,
            "fallback_to": "manual_repair",
            "evidence": {"locator_status": "unsafe"},
        }
        payload["reports"].append(
            {
                "id": "hook-envelope",
                "attempted": True,
                "command": f"read {envelope}",
                "reported_command": "hook-envelope",
                "reported_result": "unsafe",
                "result": "block",
                "summary": check["summary"],
                "missing_inputs": envelope_errors,
                "fallback_to": "manual_repair",
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": "hook envelope check found an unsafe locator.",
                "missing_inputs": live_smoke_missing_inputs(envelope_errors),
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "hook-envelope", "result": "block"},
                "hook_envelope": {
                    "contract_locator": envelope,
                    "availability": "incomplete",
                    "requirement": requirement,
                    "checks": [check],
                },
            }
        )
        return payload
    assert envelope_path is not None

    if not envelope_path.exists():
        result = "block" if requirement == "required" else "warn"
        missing_inputs = [f"hook envelope locator points to missing path `{envelope}`"]
        check = {
            "id": "hook-envelope",
            "requirement": requirement,
            "locator": envelope,
            "result": result,
            "classification": "missing_required_input" if result == "block" else "not_applicable",
            "summary": "hook envelope locator is missing.",
            "missing_inputs": missing_inputs,
            "fallback_to": "manual_repair" if result == "block" else None,
            "evidence": {"locator_status": "missing"},
        }
        payload["reports"].append(
            {
                "id": "hook-envelope",
                "attempted": True,
                "command": f"read {envelope}",
                "reported_command": "hook-envelope",
                "reported_result": "missing",
                "result": result,
                "summary": check["summary"],
                "missing_inputs": missing_inputs,
                "fallback_to": check["fallback_to"],
            }
        )
        payload.update(
            {
                "result": result,
                "summary": "hook envelope locator is missing.",
                "missing_inputs": live_smoke_missing_inputs(missing_inputs) if result == "block" else [],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK if result == "block" else None,
                "profile_check": {"id": "hook-envelope", "result": result},
                "hook_envelope": {
                    "contract_locator": envelope,
                    "availability": "incomplete",
                    "requirement": requirement,
                    "checks": [check],
                },
            }
        )
        return payload

    try:
        envelope_payload = load_json_file(envelope_path)
    except (FileNotFoundError, json.JSONDecodeError, OSError) as exc:
        result = "block" if requirement == "required" else "warn"
        missing_inputs = [f"hook envelope locator is unreadable: {exc}"]
        check = {
            "id": "hook-envelope",
            "requirement": requirement,
            "locator": envelope,
            "result": result,
            "classification": "invalid_envelope",
            "summary": "hook envelope locator is unreadable.",
            "missing_inputs": missing_inputs,
            "fallback_to": "manual_repair" if result == "block" else None,
            "evidence": {"locator_status": "unreadable"},
        }
    else:
        check = {
            "id": "hook-envelope",
            "requirement": requirement,
            "locator": envelope,
            **validate_hook_envelope_payload(envelope_payload),
        }
        check["evidence"] = {"locator_status": "readable", **dict(check.get("evidence", {}))}
        if requirement in {"optional", "advisory"} and check["result"] == "block":
            check["result"] = "warn"
            check["fallback_to"] = None
            check["missing_inputs"] = []

    payload["reports"].append(
        {
            "id": "hook-envelope",
            "attempted": True,
            "command": f"read {envelope}",
            "reported_command": "hook-envelope",
            "reported_result": str(check["classification"]),
            "result": str(check["result"]),
            "summary": str(check["summary"]),
            "missing_inputs": list(check.get("missing_inputs", [])),
            "fallback_to": check.get("fallback_to"),
        }
    )
    result = str(check["result"])
    payload.update(
        {
            "result": result,
            "summary": "hook envelope is valid." if result == "pass" else "hook envelope check produced warnings." if result == "warn" else "hook envelope check found blocking errors.",
            "missing_inputs": live_smoke_missing_inputs(list(check.get("missing_inputs", []))) if result == "block" else [],
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK if result == "block" else None,
            "profile_check": {"id": "hook-envelope", "result": result},
            "hook_envelope": {
                "contract_locator": envelope,
                "availability": "present",
                "requirement": requirement,
                "checks": [check],
            },
        }
    )
    return payload


def hooks_extension_payload(target_root: Path) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    target = live_smoke_target_metadata(target_root)
    payload: dict[str, Any] = {
        "command": "live-smoke",
        "operation": "hooks-extension",
        "schema_version": HOOKS_EXTENSION_PROFILE_SCHEMA,
        "runtime_state": runtime_state,
        "target": target,
        "command_plan": hooks_extension_command_plan(target_root),
        "reports": [],
        "missing_inputs": [],
        "fallback_to": None,
    }
    if runtime_state.get("result") != "pass":
        hook_profile = empty_hook_extension_profile()
        hook_profile.update({"status": "runtime-blocked", "result": "block"})
        payload.update(
            {
                "result": "block",
                "summary": "hooks extension profile is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": live_smoke_missing_inputs([str(message) for message in runtime_state.get("missing_inputs", [])]),
                "fallback_to": runtime_state.get("fallback_to"),
                "profile_check": {"id": "hooks-extension", "result": "block"},
                "core_profile": {"id": "orchestration-core", "hook_enforcement": "not_applicable", "result": "pass"},
                "hooks_extension": hook_profile,
            }
        )
        return payload

    target_report = live_smoke_target_check_report(target_root)
    payload["reports"] = [target_report]
    if target_report["result"] != "pass":
        hook_profile = empty_hook_extension_profile()
        hook_profile.update({"status": "target-unavailable", "result": "warn"})
        payload.update(
            {
                "result": "warn",
                "summary": "hooks extension profile recorded explicit unavailable evidence for the adopted-repo target.",
                "missing_inputs": list(target_report.get("missing_inputs", [])),
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "profile_check": {"id": "hooks-extension", "result": "warn"},
                "core_profile": {"id": "orchestration-core", "hook_enforcement": "not_applicable", "result": "pass"},
                "hooks_extension": hook_profile,
            }
        )
        return payload

    governance_surface = build_governance_surface(target_root)
    repo_interface = governance_surface.get("repo_interface")
    if not isinstance(repo_interface, dict):
        hook_profile = empty_hook_extension_profile()
    else:
        hook_profile = repo_interface.get("hook_profile")
        if not isinstance(hook_profile, dict):
            hook_profile = empty_hook_extension_profile()

    result = str(hook_profile.get("result") or "pass")
    if result not in {"pass", "warn", "block"}:
        result = "block"
    payload["reports"].append(
        {
            "id": "hooks-extension",
            "attempted": True,
            "command": f"read {target_root / '.loom/companion/repo-interface.json'}",
            "reported_command": "repo-interface.hook_locators",
            "reported_result": str(hook_profile.get("status") or "not_applicable"),
            "result": result,
            "summary": str(hook_profile.get("summary") or "hooks extension profile is not enabled."),
            "missing_inputs": list(hook_profile.get("missing_inputs", [])) if result == "block" else [],
            "fallback_to": "manual_repair" if result == "block" else None,
        }
    )
    payload.update(
        {
            "result": result,
            "summary": str(hook_profile.get("summary") or "hooks extension profile is not enabled."),
            "missing_inputs": live_smoke_missing_inputs(list(hook_profile.get("missing_inputs", []))) if result == "block" else [],
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK if result == "block" else None,
            "profile_check": {"id": "hooks-extension", "result": result},
            "core_profile": {"id": "orchestration-core", "hook_enforcement": "not_applicable", "result": "pass"},
            "hooks_extension": hook_profile,
        }
    )
    return payload


def empty_external_orchestrator_conformance() -> dict[str, Any]:
    return {
        "schema_version": EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA,
        "profile_id": "orchestration-extension/external-orchestrator",
        "enabled": False,
        "result": "pass",
        "status": "not_applicable",
        "summary": "external orchestrator interop profile is not enabled for this repository.",
        "missing_inputs": [],
        "missing_optional": [],
        "checks": [],
        "non_goals": {
            "daemon": False,
            "scheduler_state_machine": False,
            "tracker_polling_product": False,
            "second_status_surface": False,
            "host_lifecycle_ownership": False,
        },
    }


def external_orchestrator_conformance_check(
    target_root: Path,
    *,
    entry: object,
    index: int,
) -> dict[str, Any]:
    prefix = f"external_orchestrators[{index}]"
    if not isinstance(entry, dict):
        return {
            "id": f"invalid-{index}",
            "requirement": "required",
            "operations": [],
            "locator": "",
            "result": "block",
            "classification": "invalid_declaration",
            "summary": f"{prefix} must be an object.",
            "missing_inputs": [f"{prefix} must be an object"],
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
            "evidence": {"locator_status": "invalid-declaration"},
        }

    entry_id = entry.get("id") if isinstance(entry.get("id"), str) and entry.get("id") else f"external-orchestrator-{index}"
    requirement = entry.get("requirement") if isinstance(entry.get("requirement"), str) else "required"
    locator = entry.get("locator") if isinstance(entry.get("locator"), str) else ""
    fallback_to = entry.get("fallback_to") if isinstance(entry.get("fallback_to"), str) else "admission"
    operations = entry.get("operations") if isinstance(entry.get("operations"), list) else []
    blocking: list[str] = []
    optional: list[str] = []

    if requirement not in {"required", "optional", "advisory"}:
        blocking.append(f"{prefix}.requirement must be required, optional, or advisory")
        requirement = "required"
    if not operations:
        blocking.append(f"{prefix}.operations must be a non-empty list")
    unsupported = [str(operation) for operation in operations if operation not in EXTERNAL_ORCHESTRATOR_OPERATIONS]
    if unsupported:
        blocking.append(f"{prefix}.operations contains unsupported operations: {', '.join(unsupported)}")
    if isinstance(fallback_to, str) and fallback_to not in EXTERNAL_ORCHESTRATOR_ALLOWED_FALLBACKS:
        blocking.append(f"{prefix}.fallback_to must point back to a Loom checkpoint or gate repair surface")

    locator_path, locator_errors = resolve_repo_relative_path(target_root, locator, label=f"{prefix} locator")
    if locator_errors:
        blocking.extend(locator_errors)
    elif locator_path is None or not locator_path.exists() or locator_path.is_dir():
        message = f"{prefix} locator points to missing or unreadable retained evidence `{locator}`"
        if requirement in {"optional", "advisory"}:
            optional.append(message)
        else:
            blocking.append(message)

    payload: object = None
    if locator_path is not None and locator_path.exists() and locator_path.is_file():
        try:
            payload = load_json_file(locator_path)
        except (json.JSONDecodeError, OSError) as exc:
            blocking.append(f"{prefix} retained evidence is not readable JSON: {exc}")
    if payload is not None and not isinstance(payload, dict):
        blocking.append(f"{prefix} retained evidence must be a JSON object")
    if isinstance(payload, dict):
        forbidden = find_forbidden_external_orchestrator_fields(payload)
        if forbidden:
            blocking.append(f"{prefix} retained evidence contains forbidden authored/scheduler fields: {', '.join(forbidden)}")
        payload_operation = payload.get("operation")
        if isinstance(payload_operation, str) and operations and payload_operation not in operations:
            blocking.append(f"{prefix} retained evidence operation is not declared by the locator")
        if payload.get("operation") in {"status_read", "gate_read"}:
            if payload.get("source_layer") != "derived_surface":
                blocking.append(f"{prefix} status/gate reads must consume the derived status surface")
            if payload.get("consumed_as") != "summary":
                blocking.append(f"{prefix} status/gate reads must be consumed as summary")
        if payload.get("host_lifecycle_ownership") not in {None, "host", "external"}:
            blocking.append(f"{prefix} retained evidence must not claim Loom owns host lifecycle")
        payload_fallback = payload.get("fallback_to")
        if isinstance(payload_fallback, str) and payload_fallback not in EXTERNAL_ORCHESTRATOR_ALLOWED_FALLBACKS:
            blocking.append(f"{prefix} retained evidence fallback_to must point back to Loom")

    result = "block" if blocking else "warn" if optional else "pass"
    if result == "warn" and requirement in {"required"}:
        result = "block"
    return {
        "id": entry_id,
        "requirement": requirement,
        "operations": operations,
        "locator": locator,
        "result": result,
        "classification": "truth_pollution" if blocking and isinstance(payload, dict) and find_forbidden_external_orchestrator_fields(payload) else "locator_or_contract",
        "summary": (
            "external orchestrator retained evidence is readable and respects Loom truth boundaries."
            if result == "pass"
            else "external orchestrator retained evidence has profile-local warnings."
            if result == "warn"
            else "external orchestrator retained evidence violates interop conformance boundaries."
        ),
        "missing_inputs": blocking if result == "block" else [],
        "missing_optional": optional,
        "fallback_to": fallback_to if result == "block" else None,
        "evidence": {
            "locator_status": "readable" if isinstance(payload, dict) else "missing_or_invalid",
            "payload_schema_version": payload.get("schema_version") if isinstance(payload, dict) else None,
            "payload_operation": payload.get("operation") if isinstance(payload, dict) else None,
        },
    }


def external_orchestrator_conformance_payload(target_root: Path) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    target = live_smoke_target_metadata(target_root)
    payload: dict[str, Any] = {
        "command": "live-smoke",
        "operation": "external-orchestrator-interop",
        "schema_version": EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA,
        "runtime_state": runtime_state,
        "target": target,
        "command_plan": external_orchestrator_conformance_command_plan(target_root),
        "reports": [],
        "missing_inputs": [],
        "fallback_to": None,
    }
    if runtime_state.get("result") != "pass":
        conformance = empty_external_orchestrator_conformance()
        conformance.update({"status": "runtime-blocked", "result": "block"})
        payload.update(
            {
                "result": "block",
                "summary": "external orchestrator conformance is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": live_smoke_missing_inputs([str(message) for message in runtime_state.get("missing_inputs", [])]),
                "fallback_to": runtime_state.get("fallback_to"),
                "profile_check": {"id": "external-orchestrator-interop", "result": "block"},
                "core_profile": {"id": "orchestration-core", "external_orchestrator_enforcement": "not_applicable", "result": "pass"},
                "external_orchestrator": conformance,
            }
        )
        return payload

    target_report = live_smoke_target_check_report(target_root)
    payload["reports"] = [target_report]
    if target_report["result"] != "pass":
        conformance = empty_external_orchestrator_conformance()
        conformance.update({"status": "target-unavailable", "result": "warn"})
        payload.update(
            {
                "result": "warn",
                "summary": "external orchestrator conformance recorded explicit unavailable evidence for the adopted-repo target.",
                "missing_inputs": list(target_report.get("missing_inputs", [])),
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "profile_check": {"id": "external-orchestrator-interop", "result": "warn"},
                "core_profile": {"id": "orchestration-core", "external_orchestrator_enforcement": "not_applicable", "result": "pass"},
                "external_orchestrator": conformance,
            }
        )
        return payload

    interop_path = target_root / ".loom" / "companion" / "interop.json"
    if not interop_path.exists():
        conformance = empty_external_orchestrator_conformance()
        payload["reports"].append(
            {
                "id": "external-orchestrator-interop",
                "attempted": True,
                "command": f"read {interop_path}",
                "reported_command": "repo-interop.external_orchestrators",
                "reported_result": "not_applicable",
                "result": "pass",
                "summary": "repo interop does not declare external orchestrators.",
                "missing_inputs": [],
                "fallback_to": None,
            }
        )
        payload.update(
            {
                "result": "pass",
                "summary": conformance["summary"],
                "profile_check": {"id": "external-orchestrator-interop", "result": "pass"},
                "core_profile": {"id": "orchestration-core", "external_orchestrator_enforcement": "not_applicable", "result": "pass"},
                "external_orchestrator": conformance,
            }
        )
        return payload

    try:
        interop_payload = load_json_file(interop_path)
    except (json.JSONDecodeError, OSError) as exc:
        conformance = empty_external_orchestrator_conformance()
        conformance.update(
            {
                "enabled": True,
                "result": "block",
                "status": "invalid_declaration",
                "summary": "repo interop contract is unreadable for external orchestrator conformance.",
                "missing_inputs": [f"repo interop contract is unreadable: {exc}"],
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": conformance["summary"],
                "missing_inputs": conformance["missing_inputs"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "external-orchestrator-interop", "result": "block"},
                "core_profile": {"id": "orchestration-core", "external_orchestrator_enforcement": "not_applicable", "result": "pass"},
                "external_orchestrator": conformance,
            }
        )
        return payload
    external_orchestrators = interop_payload.get("external_orchestrators", []) if isinstance(interop_payload, dict) else []
    if not isinstance(external_orchestrators, list) or not external_orchestrators:
        conformance = empty_external_orchestrator_conformance()
        payload["reports"].append(
            {
                "id": "external-orchestrator-interop",
                "attempted": True,
                "command": f"read {interop_path}",
                "reported_command": "repo-interop.external_orchestrators",
                "reported_result": "not_applicable",
                "result": "pass",
                "summary": "repo interop is readable but declares no external orchestrators.",
                "missing_inputs": [],
                "fallback_to": None,
            }
        )
        payload.update(
            {
                "result": "pass",
                "summary": conformance["summary"],
                "profile_check": {"id": "external-orchestrator-interop", "result": "pass"},
                "core_profile": {"id": "orchestration-core", "external_orchestrator_enforcement": "not_applicable", "result": "pass"},
                "external_orchestrator": conformance,
            }
        )
        return payload

    checks = [
        external_orchestrator_conformance_check(target_root, entry=entry, index=index)
        for index, entry in enumerate(external_orchestrators)
    ]
    for check in checks:
        payload["reports"].append(
            {
                "id": str(check["id"]),
                "attempted": True,
                "command": f"read {check.get('locator') or '<missing-locator>'}",
                "reported_command": "repo-interop.external_orchestrator",
                "reported_result": str(check["classification"]),
                "result": str(check["result"]),
                "summary": str(check["summary"]),
                "missing_inputs": list(check.get("missing_inputs", [])),
                "fallback_to": check.get("fallback_to"),
            }
        )

    has_block = any(check["result"] == "block" for check in checks)
    has_warn = any(check["result"] == "warn" for check in checks)
    result = "block" if has_block else "warn" if has_warn else "pass"
    conformance = empty_external_orchestrator_conformance()
    conformance.update(
        {
            "enabled": True,
            "result": result,
            "status": "present",
            "summary": (
                "external orchestrator conformance passed without introducing a daemon, scheduler state, or second status surface."
                if result == "pass"
                else "external orchestrator conformance produced profile-local warnings."
                if result == "warn"
                else "external orchestrator conformance found blocking interop drift."
            ),
            "missing_inputs": live_smoke_missing_inputs([message for check in checks for message in check.get("missing_inputs", [])]),
            "missing_optional": [message for check in checks for message in check.get("missing_optional", [])],
            "checks": checks,
        }
    )
    payload.update(
        {
            "result": result,
            "summary": conformance["summary"],
            "missing_inputs": conformance["missing_inputs"],
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK if result == "block" else None,
            "profile_check": {"id": "external-orchestrator-interop", "result": result},
            "core_profile": {"id": "orchestration-core", "external_orchestrator_enforcement": "not_applicable", "result": "pass"},
            "external_orchestrator": conformance,
            "command_plan": external_orchestrator_conformance_command_plan(target_root, external_orchestrators=external_orchestrators),
        }
    )
    return payload


def dynamic_tool_live_availability_payload(target_root: Path, *, surface: str) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    target = live_smoke_target_metadata(target_root)
    payload: dict[str, Any] = {
        "command": "live-smoke",
        "operation": "dynamic-tool-availability",
        "schema_version": DYNAMIC_TOOL_LIVE_AVAILABILITY_SCHEMA,
        "runtime_state": runtime_state,
        "target": target,
        "command_plan": dynamic_tool_live_availability_command_plan(target_root, surface=surface),
        "reports": [],
        "missing_inputs": [],
        "fallback_to": None,
    }
    if runtime_state.get("result") != "pass":
        payload.update(
            {
                "result": "block",
                "summary": "dynamic tool live availability is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": live_smoke_missing_inputs([str(message) for message in runtime_state.get("missing_inputs", [])]),
                "fallback_to": runtime_state.get("fallback_to"),
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "block"},
                "dynamic_tool_availability": {
                    "contract_locator": ".loom/companion/repo-interface.json",
                    "availability": "runtime-blocked",
                    "surface": surface,
                    "tool_availability": empty_tool_availability(),
                },
            }
        )
        return payload

    target_report = live_smoke_target_check_report(target_root)
    payload["reports"] = [target_report]
    payload["missing_inputs"] = list(target_report.get("missing_inputs", []))
    if target_report["result"] != "pass":
        payload.update(
            {
                "result": "warn",
                "summary": "dynamic tool live availability recorded explicit unavailable evidence for the adopted-repo target.",
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "warn"},
                "dynamic_tool_availability": {
                    "contract_locator": ".loom/companion/repo-interface.json",
                    "availability": "target-unavailable",
                    "surface": surface,
                    "tool_availability": empty_tool_availability(),
                },
            }
        )
        return payload

    governance_surface = build_governance_surface(target_root)
    repo_interface = governance_surface.get("repo_interface")
    contract_locator = ".loom/companion/repo-interface.json"
    availability = "absent"
    if isinstance(repo_interface, dict):
        availability = str(repo_interface.get("availability") or "absent")
    interface_report = {
        "id": "repo-interface-contract",
        "attempted": True,
        "command": f"read {target_root / contract_locator}",
        "reported_command": "repo-interface-contract",
        "reported_result": availability,
        "result": "pass",
        "summary": "repo companion interface is readable.",
        "missing_inputs": [],
        "fallback_to": None,
    }
    payload["reports"].append(interface_report)

    if availability in {"absent", "companion_docs_only"}:
        summary = "repo companion interface is absent, so no dynamic tool live evidence can be consumed."
        if availability == "companion_docs_only":
            summary = "legacy companion docs are present, but no machine-readable repo companion interface declares dynamic tools."
        interface_report.update(
            {
                "result": "warn",
                "summary": summary,
                "missing_inputs": ["repo companion interface is absent"],
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "warn",
                "summary": summary,
                "missing_inputs": ["repo companion interface is absent"],
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "warn"},
                "dynamic_tool_availability": {
                    "contract_locator": contract_locator,
                    "availability": "absent",
                    "surface": surface,
                    "tool_availability": empty_tool_availability(),
                },
            }
        )
        return payload

    if not isinstance(repo_interface, dict) or availability == "incomplete":
        missing_inputs = []
        if isinstance(repo_interface, dict) and isinstance(repo_interface.get("missing_inputs"), list):
            missing_inputs = [str(message) for message in repo_interface.get("missing_inputs", [])]
        if not missing_inputs:
            missing_inputs = ["repo companion interface is unreadable"]
        interface_report.update(
            {
                "result": "block",
                "summary": "repo companion interface is incomplete or unreadable for dynamic tool live availability.",
                "missing_inputs": missing_inputs,
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": interface_report["summary"],
                "missing_inputs": live_smoke_missing_inputs(missing_inputs),
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "block"},
                "dynamic_tool_availability": {
                    "contract_locator": contract_locator,
                    "availability": "incomplete",
                    "surface": surface,
                    "tool_availability": empty_tool_availability(),
                },
            }
        )
        return payload

    if availability != "present":
        interface_report.update(
            {
                "result": "block",
                "summary": "repo companion interface returned an unknown availability state for dynamic tool live availability.",
                "missing_inputs": [f"unknown repo companion availability: {availability}"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": interface_report["summary"],
                "missing_inputs": interface_report["missing_inputs"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "block"},
                "dynamic_tool_availability": {
                    "contract_locator": contract_locator,
                    "availability": "incomplete",
                    "surface": surface,
                    "tool_availability": empty_tool_availability(),
                },
            }
        )
        return payload

    tool_availability = repo_interface.get("tool_availability") if surface == "all" else tool_availability_for_surface(repo_interface, surface=surface)
    if not isinstance(tool_availability, dict):
        interface_report.update(
            {
                "result": "block",
                "summary": "repo companion interface does not expose readable dynamic tool availability evidence.",
                "missing_inputs": ["repo companion interface must expose `tool_availability`"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": interface_report["summary"],
                "missing_inputs": interface_report["missing_inputs"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "block"},
                "dynamic_tool_availability": {
                    "contract_locator": contract_locator,
                    "availability": "incomplete",
                    "surface": surface,
                    "tool_availability": empty_tool_availability(),
                },
            }
        )
        return payload

    declared_tools = tool_availability.get("declared_tools")
    if not isinstance(declared_tools, list):
        interface_report.update(
            {
                "result": "block",
                "summary": "dynamic tool live availability did not expose a readable declared_tools list.",
                "missing_inputs": ["tool_availability must include `declared_tools` as a list"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
            }
        )
        payload.update(
            {
                "result": "block",
                "summary": interface_report["summary"],
                "missing_inputs": interface_report["missing_inputs"],
                "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "block"},
                "dynamic_tool_availability": {
                    "contract_locator": contract_locator,
                    "availability": "incomplete",
                    "surface": surface,
                    "tool_availability": empty_tool_availability(),
                },
            }
        )
        return payload

    payload["command_plan"] = dynamic_tool_live_availability_command_plan(
        target_root,
        surface=surface,
        declared_tools=declared_tools,
    )
    if not declared_tools:
        interface_report.update(
            {
                "result": "pass",
                "summary": "repo companion interface is readable and no dynamic tools apply to this live profile.",
                "missing_inputs": [],
                "fallback_to": None,
            }
        )
        payload.update(
            {
                "result": "pass",
                "summary": interface_report["summary"],
                "missing_inputs": [],
                "fallback_to": None,
                "profile_check": {"id": "dynamic-tool-live-availability", "result": "pass"},
                "dynamic_tool_availability": {
                    "contract_locator": contract_locator,
                    "availability": "present",
                    "surface": surface,
                    "tool_availability": tool_availability,
                },
            }
        )
        return payload

    advisory_messages: list[str] = []
    for tool in declared_tools:
        if not isinstance(tool, dict):
            continue
        report_result = "pass"
        if tool.get("result") == "block":
            report_result = "block"
        elif tool.get("status") != "advertised":
            report_result = "warn"
        report_missing_inputs = [str(message) for message in tool.get("missing_inputs", [])]
        if report_result == "warn":
            report_missing_inputs = [str(message) for message in tool.get("advisory", [])]
            for message in report_missing_inputs:
                if message not in advisory_messages:
                    advisory_messages.append(message)
        payload["reports"].append(
            {
                "id": str(tool.get("id") or "dynamic-tool"),
                "attempted": True,
                "command": f"read {tool.get('locator') or '<missing-locator>'}",
                "reported_command": "dynamic-tool-handshake",
                "reported_result": str(tool.get("status") or tool.get("failure_category") or "unknown"),
                "result": report_result,
                "summary": str(tool.get("summary") or "dynamic tool handshake declaration was read."),
                "missing_inputs": report_missing_inputs,
                "fallback_to": tool.get("fallback_to") if report_result == "block" else None,
            }
        )

    blocking_messages = [
        message
        for report in payload["reports"]
        if report.get("result") == "block"
        for message in report.get("missing_inputs", [])
    ]
    missing_inputs = live_smoke_missing_inputs([*blocking_messages, *advisory_messages])
    has_block = tool_availability.get("result") == "block"
    has_warn = any(report.get("result") == "warn" for report in payload["reports"])
    result = "block" if has_block else "warn" if has_warn else "pass"
    summary = "dynamic tool handshake declarations are readable and advertised for this live profile."
    if result == "warn":
        summary = "dynamic tool live availability produced profile-local warnings."
    if result == "block":
        summary = "dynamic tool live availability found blocking handshake declaration or availability gaps."
    payload.update(
        {
            "result": result,
            "summary": summary,
            "missing_inputs": missing_inputs,
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK if result == "block" else None,
            "profile_check": {"id": "dynamic-tool-live-availability", "result": result},
            "dynamic_tool_availability": {
                "contract_locator": contract_locator,
                "availability": "present",
                "surface": surface,
                "tool_availability": tool_availability,
            },
        }
    )
    return payload


def live_smoke_command_plan(target_root: Path, *, item: str, include_blocking_shadow: bool) -> list[dict[str, Any]]:
    target = command_target(target_root)
    plan = [
        {
            "id": "target-check",
            "command": f"test -d {target}",
            "description": "Confirm the adopted-repo target path exists before running live smoke checks.",
        },
        {
            "id": "governance-profile-status",
            "command": live_smoke_command(["governance-profile", "status", "--target", str(target_root)]),
            "description": "Read the adopted repo governance maturity surface.",
        },
        {
            "id": "governance-profile-upgrade-plan",
            "command": live_smoke_command(["governance-profile", "upgrade-plan", "--target", str(target_root)]),
            "description": "Record upgrade requirements as live confidence input.",
        },
        {
            "id": "runtime-parity",
            "command": live_smoke_command(["runtime-parity", "validate", "--target", str(target_root)]),
            "description": "Check Loom core runtime parity against the adopted repo surface.",
        },
        {
            "id": "shadow-parity",
            "command": live_smoke_command(["shadow-parity", "--target", str(target_root)]),
            "description": "Read validation-only shadow parity without changing merge gates.",
        },
        {
            "id": "flow-resume",
            "command": live_smoke_command(["flow", "resume", "--target", str(target_root), "--item", item]),
            "description": "Exercise resume flow on the adopted repo when the requested item exists.",
        },
    ]
    if include_blocking_shadow:
        plan.append(
            {
                "id": "shadow-parity-blocking",
                "command": live_smoke_command(["shadow-parity", "--target", str(target_root), "--blocking"]),
                "description": "Optional explicit blocking-mode shadow parity check; not sufficient blocking-upgrade evidence on its own.",
            }
        )
    return plan


def live_smoke_missing_inputs(messages: list[str]) -> list[str]:
    return list(dict.fromkeys(message for message in messages if isinstance(message, str) and message))


def live_smoke_target_check_report(target_root: Path) -> dict[str, Any]:
    if target_root.exists():
        return {
            "id": "target-check",
            "attempted": True,
            "command": f"test -d {command_target(target_root)}",
            "reported_command": "target-check",
            "reported_result": "pass",
            "result": "pass",
            "summary": "adopted-repo target root exists.",
            "missing_inputs": [],
            "fallback_to": None,
        }
    return {
        "id": "target-check",
        "attempted": True,
        "command": f"test -d {command_target(target_root)}",
        "reported_command": "target-check",
        "reported_result": "unavailable",
        "result": "warn",
        "summary": "adopted-repo target root is unavailable.",
        "missing_inputs": [f"adopted repo target is unavailable: {target_root}"],
        "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
    }


def live_smoke_command_report(target_root: Path, *, report_id: str, args: list[str]) -> dict[str, Any]:
    payload, errors = local_command_json(target_root, args)
    command = live_smoke_command(args)
    if payload is None:
        return {
            "id": report_id,
            "attempted": True,
            "command": command,
            "reported_command": args[0],
            "reported_result": "invalid-output",
            "result": "block",
            "summary": f"{args[0]} did not return readable JSON output.",
            "missing_inputs": live_smoke_missing_inputs(errors),
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
        }
    reported_result = str(payload.get("result") or "unknown")
    return {
        "id": report_id,
        "attempted": True,
        "command": command,
        "reported_command": payload.get("command"),
        "reported_result": reported_result,
        "result": "pass" if reported_result == "pass" else "warn",
        "summary": str(payload.get("summary") or f"{args[0]} completed without a summary."),
        "missing_inputs": live_smoke_missing_inputs([str(message) for message in payload.get("missing_inputs", [])]),
        "fallback_to": payload.get("fallback_to"),
    }


def parse_live_smoke_code_block(lines: list[str]) -> list[str]:
    commands: list[str] = []
    in_block = False
    for raw_line in lines:
        stripped = raw_line.strip()
        if stripped.startswith("```"):
            if in_block:
                break
            in_block = True
            continue
        if in_block and stripped:
            commands.append(stripped)
    return commands


def strip_inline_code(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if stripped.startswith("`") and stripped.endswith("`") and len(stripped) >= 2:
        return stripped[1:-1]
    return stripped or None


def live_smoke_replay_payload(prior_evidence_path: Path, *, runtime_state: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "command": "live-smoke",
        "operation": "replay",
        "schema_version": LIVE_SMOKE_SCHEMA,
        "runtime_state": runtime_state,
        "command_plan": [],
        "reports": [],
        "missing_inputs": [],
        "fallback_to": None,
    }
    if runtime_state.get("result") != "pass":
        payload.update(
            {
                "result": "block",
                "summary": "live smoke replay is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": live_smoke_missing_inputs([str(message) for message in runtime_state.get("missing_inputs", [])]),
                "fallback_to": runtime_state.get("fallback_to"),
                "live_smoke": {
                    "status": "failed",
                    "executed_at": current_iso_timestamp(),
                    "release_interpretation": live_smoke_release_interpretation("failed"),
                },
            }
        )
        return payload
    if not prior_evidence_path.exists():
        payload.update(
            {
                "result": "block",
                "summary": "live smoke replay could not read the requested prior evidence.",
                "missing_inputs": [f"prior evidence path is unavailable: {prior_evidence_path}"],
                "fallback_to": LIVE_SMOKE_REPLAY_FALLBACK,
                "live_smoke": {
                    "status": "failed",
                    "executed_at": current_iso_timestamp(),
                    "release_interpretation": live_smoke_release_interpretation("failed"),
                },
                "prior_evidence": {
                    "path": str(prior_evidence_path),
                    "status": "missing",
                },
            }
        )
        return payload

    relative_path = str(prior_evidence_path)
    if prior_evidence_path.is_absolute():
        relative_path = str(prior_evidence_path.resolve())
    sections = markdown_sections(prior_evidence_path)
    commands = parse_live_smoke_code_block(sections.get("2. Commands", []))
    target_lines = sections.get("1. Target", [])
    availability_lines = sections.get("4. Current PR Availability Evidence", [])
    text = prior_evidence_path.read_text(encoding="utf-8")
    status_match = re.search(r"Current release evidence status:\s*`([^`]+)`", text)
    if status_match is None or "Release interpretation:" not in text:
        payload.update(
            {
                "result": "block",
                "summary": "live smoke replay evidence is missing required status or interpretation fields.",
                "missing_inputs": [f"{relative_path}: missing Current release evidence status or Release interpretation"],
                "fallback_to": LIVE_SMOKE_REPLAY_FALLBACK,
                "live_smoke": {
                    "status": "failed",
                    "executed_at": current_iso_timestamp(),
                    "release_interpretation": live_smoke_release_interpretation("failed"),
                },
                "prior_evidence": {
                    "path": relative_path,
                    "status": "invalid",
                },
            }
        )
        return payload

    def find_prefix(lines: list[str], prefix: str) -> str | None:
        for raw_line in lines:
            stripped = raw_line.strip()
            if stripped.startswith(prefix):
                return stripped[len(prefix) :].strip()
        return None

    prior_status = status_match.group(1).strip()
    release_interpretation = find_prefix(availability_lines, "- Release interpretation:") or live_smoke_release_interpretation("replayed")
    replay_report = {
        "id": "prior-evidence",
        "attempted": False,
        "command": f"read {relative_path}",
        "reported_command": "prior-evidence",
        "reported_result": prior_status,
        "result": "pass",
        "summary": "versioned prior-pass live smoke evidence was replayed without rerunning adopted-repo commands.",
        "missing_inputs": [],
        "fallback_to": None,
    }
    payload.update(
        {
            "result": "pass",
            "summary": "versioned prior-pass live smoke evidence was replayed.",
            "command_plan": [
                {
                    "id": "prior-evidence-read",
                    "command": live_smoke_command(["live-smoke", "replay", "--prior-evidence", relative_path]),
                    "description": "Replay versioned prior-pass evidence without rerunning adopted-repo commands.",
                }
            ],
            "reports": [replay_report],
            "live_smoke": {
                "status": "replayed",
                "executed_at": current_iso_timestamp(),
                "release_interpretation": release_interpretation,
            },
            "prior_evidence": {
                "path": relative_path,
                "status": prior_status,
                "target_family": find_prefix(target_lines, "- Adopted repo family:"),
                "smoke_branch": strip_inline_code(find_prefix(target_lines, "- Smoke branch recorded there:")),
                "smoke_commit": strip_inline_code(find_prefix(target_lines, "- Smoke commit recorded there:")),
                "smoke_worktree": strip_inline_code(find_prefix(target_lines, "- Smoke worktree recorded there:")),
                "commands": commands,
            },
        }
    )
    return payload


def live_smoke_run_payload(
    target_root: Path,
    *,
    item: str,
    dry_run: bool,
    include_blocking_shadow: bool,
) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    command_plan = live_smoke_command_plan(target_root, item=item, include_blocking_shadow=include_blocking_shadow)
    target = live_smoke_target_metadata(target_root)
    payload: dict[str, Any] = {
        "command": "live-smoke",
        "operation": "run",
        "schema_version": LIVE_SMOKE_SCHEMA,
        "runtime_state": runtime_state,
        "target": target,
        "command_plan": command_plan,
        "reports": [],
        "missing_inputs": [],
        "fallback_to": None,
    }
    if runtime_state.get("result") != "pass":
        payload.update(
            {
                "result": "block",
                "summary": "live smoke is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": live_smoke_missing_inputs([str(message) for message in runtime_state.get("missing_inputs", [])]),
                "fallback_to": runtime_state.get("fallback_to"),
                "live_smoke": {
                    "status": "failed",
                    "executed_at": current_iso_timestamp(),
                    "release_interpretation": live_smoke_release_interpretation("failed"),
                },
            }
        )
        return payload

    target_report = live_smoke_target_check_report(target_root)
    payload["reports"] = [target_report]
    payload["missing_inputs"] = list(target_report.get("missing_inputs", []))
    if target_report["result"] != "pass":
        payload.update(
            {
                "result": "warn",
                "summary": "live smoke recorded explicit unavailable evidence for the adopted-repo target.",
                "fallback_to": LIVE_SMOKE_RETRY_FALLBACK,
                "live_smoke": {
                    "status": "unavailable",
                    "executed_at": current_iso_timestamp(),
                    "release_interpretation": live_smoke_release_interpretation("unavailable"),
                },
            }
        )
        return payload

    if dry_run:
        payload.update(
            {
                "result": "pass",
                "summary": "live smoke command plan was generated without running adopted-repo commands.",
                "live_smoke": {
                    "status": "dry_run",
                    "executed_at": current_iso_timestamp(),
                    "release_interpretation": live_smoke_release_interpretation("dry_run"),
                },
            }
        )
        return payload

    reports = [target_report]
    for report_id, args in (
        ("governance-profile-status", ["governance-profile", "status", "--target", str(target_root)]),
        ("governance-profile-upgrade-plan", ["governance-profile", "upgrade-plan", "--target", str(target_root)]),
        ("runtime-parity", ["runtime-parity", "validate", "--target", str(target_root)]),
        ("shadow-parity", ["shadow-parity", "--target", str(target_root)]),
        ("flow-resume", ["flow", "resume", "--target", str(target_root), "--item", item]),
    ):
        reports.append(live_smoke_command_report(target_root, report_id=report_id, args=args))
    if include_blocking_shadow:
        reports.append(
            live_smoke_command_report(
                target_root,
                report_id="shadow-parity-blocking",
                args=["shadow-parity", "--target", str(target_root), "--blocking"],
            )
        )

    missing_inputs = live_smoke_missing_inputs(
        [message for report in reports for message in report.get("missing_inputs", [])]
    )
    has_internal_block = any(report.get("result") == "block" for report in reports)
    has_warning = any(report.get("result") == "warn" for report in reports)
    result = "block" if has_internal_block else "warn" if has_warning else "pass"
    status = "failed" if has_warning else "passed"
    summary = "live smoke produced explicit profile-local warnings." if result == "warn" else "live smoke completed across the planned command set."
    if result == "block":
        summary = "live smoke failed to produce stable command output."
    payload.update(
        {
            "result": result,
            "summary": summary,
            "reports": reports,
            "missing_inputs": missing_inputs,
            "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK if result == "block" else LIVE_SMOKE_RETRY_FALLBACK if result == "warn" else None,
            "live_smoke": {
                "status": status,
                "executed_at": current_iso_timestamp(),
                "release_interpretation": live_smoke_release_interpretation(status),
            },
        }
    )
    return payload


def adoption_validation_commands(target_root: Path) -> list[str]:
    target = command_target(target_root)
    return [
        f"python3 tools/loom_flow.py governance-profile upgrade-plan --target {target}",
        f"python3 tools/loom_flow.py adopt verify --target {target}",
    ]


def adoption_decision_reasoning(decision_id: str, detail: dict[str, Any]) -> str:
    if decision_id == "guardian_integration_contract":
        return "Guardian and integration-contract verdicts are repo-native evidence; Loom may read them through interop but must not promote their rules into core."
    if decision_id == "authority_boundary":
        return "Blocking ownership, fallback, override, and authority-of-truth stay outside interop; interop only declares read locators."
    if decision_id == "repo_specific_residue":
        return "Repo-specific rules and residue stay in repo companion so Loom can consume them without turning single-repo practice into defaults."
    recommended = detail.get("recommended_action")
    if isinstance(recommended, str) and recommended:
        return recommended
    return "This judgment is required before Loom can turn adoption guidance into generated writeback and verification evidence."


def adoption_judgment_status(decision_id: str, missing: set[str]) -> str:
    if decision_id in missing:
        return "blocked" if not ADOPTION_DECISION_WRITE_TARGETS.get(decision_id) else "missing"
    if decision_id == "repo_specific_residue" and "repo_interface" in missing:
        return "missing"
    if decision_id in {"authority_boundary", "guardian_integration_contract"} and "repo_interop" in missing:
        return "missing"
    return "answered"


def adoption_decisions_payload(
    target_root: Path,
    *,
    target_level: str | None,
    maturity: dict[str, Any],
) -> dict[str, Any]:
    missing_by_level = maturity.get("missing_by_level")
    missing_details_by_level = maturity.get("missing_details_by_level")
    missing = (
        list(missing_by_level.get(target_level, []))
        if isinstance(missing_by_level, dict) and isinstance(target_level, str)
        else []
    )
    details = (
        list(missing_details_by_level.get(target_level, []))
        if isinstance(missing_details_by_level, dict) and isinstance(target_level, str)
        else []
    )
    detail_by_id = {row.get("id"): row for row in details if isinstance(row, dict)}
    missing_set = {str(item) for item in missing}
    ordered_ids = list(dict.fromkeys([*missing, "repo_specific_residue", "authority_boundary", "guardian_integration_contract"]))
    judgments: list[dict[str, Any]] = []
    for raw_id in ordered_ids:
        decision_id = str(raw_id)
        detail = detail_by_id.get(decision_id, {})
        source_locator = ADOPTION_DECISION_SOURCES.get(decision_id, "docs/adoption/github-profile-upgrade.md")
        write_targets = ADOPTION_DECISION_WRITE_TARGETS.get(decision_id, [".loom/companion/repo-interface.json"])
        verification_commands = adoption_validation_commands(target_root)
        if decision_id in {"repo_interop", "closeout_reconciliation_read", "authority_boundary", "guardian_integration_contract"}:
            verification_commands.append(f"python3 tools/loom_flow.py shadow-parity --target {command_target(target_root)}")
        judgments.append(
            {
                "id": decision_id,
                "question": ADOPTION_DECISION_QUESTIONS.get(decision_id, f"How should Loom satisfy `{decision_id}` without creating a second truth source?"),
                "source_locator": source_locator,
                "reasoning": adoption_decision_reasoning(decision_id, detail),
                "write_targets": write_targets,
                "verification_commands": verification_commands,
                "status": adoption_judgment_status(decision_id, missing_set),
                "layer": detail.get("layer"),
            }
        )
    return {
        "schema_version": ADOPTION_DECISIONS_SCHEMA,
        "target_maturity": target_level,
        "summary": "Fixed adoption judgments bind every repo-specific decision to source locators, write targets, and verification commands.",
        "judgments": judgments,
    }


def guided_adoption_plan_payload(decisions: dict[str, Any]) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []
    for judgment in decisions.get("judgments", []):
        if not isinstance(judgment, dict):
            continue
        for phase, action in (
            ("read", f"Read `{judgment.get('source_locator')}` and the target repository surface that motivated `{judgment.get('id')}`."),
            ("judge", str(judgment.get("question"))),
            ("write", "Apply only the declared write targets; leave repo-owned residue repo-owned."),
            ("verify", "Run the declared verification commands and keep the evidence with the adoption closeout."),
        ):
            steps.append(
                {
                    "phase": phase,
                    "judgment_id": judgment.get("id"),
                    "action": action,
                    "source_locator": judgment.get("source_locator"),
                    "write_targets": list(judgment.get("write_targets", [])),
                    "verification_commands": list(judgment.get("verification_commands", [])),
                    "status": judgment.get("status"),
                }
            )
    return {
        "schema_version": GUIDED_ADOPTION_PLAN_SCHEMA,
        "phase_order": ["read", "judge", "write", "verify"],
        "summary": "Agent-assisted adoption proceeds through read, judge, write, and verify without requiring hand-authored companion or interop evidence.",
        "steps": steps,
    }


def default_companion_manifest() -> dict[str, Any]:
    return {
        "schema_version": "loom-repo-companion-manifest/v1",
        "companion_entry": ".loom/companion/README.md",
        "repo_interface": ".loom/companion/repo-interface.json",
    }


def default_repo_interface() -> dict[str, Any]:
    return {
        "schema_version": "loom-repo-interface/v2",
        "companion_entry": ".loom/companion/README.md",
        "repo_specific_requirements": {"review": [], "merge_ready": [], "closeout": []},
        "specialized_gates": [],
        "review_instruction_locators": {
            "spec_review": {"locator": "loom_default", "mode": "loom_default"},
            "implementation_review": {"locator": "loom_default", "mode": "loom_default"},
        },
        "metadata_contract": {"fields": []},
        "context_schema": {"fields": []},
        "dynamic_tool_locators": [],
        "policy_locators": [],
        "hook_locators": [],
        "release_targets": {
            "catalog_locator": ".loom/companion/releases/catalog.json",
            "current_target_locator": ".loom/companion/releases/current.json",
            "enforcement": "blocking",
            "status_locator": ".loom/companion/releases/status.json",
        },
    }


def default_repo_interop() -> dict[str, Any]:
    return {
        "schema_version": "loom-repo-interop/v1",
        "host_adapters": [],
        "repo_native_carriers": [
            {
                "id": "generated-companion-residue",
                "summary": "Repo-owned adoption residue generated as explicit write targets; Loom reads it without promoting the repo-specific rules into core.",
                "surfaces": list(SHADOW_PARITY_SURFACES),
                "locator": ".loom/companion",
                "owner": "repo-companion",
                "requirement": "required",
                "fallback_to": "adoption",
            }
        ],
        "shadow_surfaces": {
            surface: {
                "summary": f"Compare {surface} parity between Loom and the repo-native result.",
                "loom_locator": f".loom/shadow/{surface.replace('_', '-')}-loom.json",
                "repo_locator": f".loom/shadow/{surface.replace('_', '-')}-repo.json",
            }
            for surface in SHADOW_PARITY_SURFACES
        },
    }


def default_shadow_source(target_root: Path, *, surface: str, side: str) -> str | None:
    loom_sources = {
        "admission": [".loom/work-items/INIT-0001.md", ".loom/status/current.md", ".loom/README.md"],
        "review": [".loom/reviews/INIT-0001.json", ".loom/status/current.md", ".loom/README.md"],
        "merge_ready": [".loom/status/current.md", ".github/PULL_REQUEST_TEMPLATE.md", ".loom/README.md"],
        "closeout": [".loom/status/current.md", ".loom/README.md"],
    }
    repo_sources = {
        "admission": [".loom/companion/checkpoints.md", ".loom/companion/README.md"],
        "review": [".loom/companion/review.md", ".loom/companion/README.md"],
        "merge_ready": [".loom/companion/merge-ready.md", ".loom/companion/README.md"],
        "closeout": [".loom/companion/closeout.md", ".loom/companion/README.md"],
    }
    candidates = loom_sources.get(surface, []) if side == "loom" else repo_sources.get(surface, [])
    for candidate in candidates:
        if (target_root / candidate).exists():
            return candidate
    return None


def companion_text_payloads() -> dict[str, str]:
    return {
        ".loom/companion/README.md": (
            "# Repo Companion\n\n"
            "This companion records repo-specific adoption residue while Loom core remains the upstream governance source.\n"
        ),
        ".loom/companion/review.md": "# Companion Review Surface\n",
        ".loom/companion/merge-ready.md": "# Companion Merge-Ready Surface\n",
        ".loom/companion/closeout.md": "# Companion Closeout Surface\n",
        ".loom/companion/checkpoints.md": "# Companion Checkpoints\n",
        ".loom/companion/releases/changelog.md": "# Changelog\n\n- Bootstrap release intake example.\n",
        ".loom/companion/releases/release-notes.md": "# Release Notes\n\n- Bootstrap release target is ready for Loom-derived status consumption.\n",
        ".loom/companion/releases/migration-notes.md": "# Migration Notes\n\n- not_applicable\n",
        ".loom/companion/releases/rollback.md": "# Rollback Basis\n\n- Revert the companion-owned release target declaration and rerun Loom checks.\n",
    }


def companion_json_payloads() -> dict[str, dict[str, Any]]:
    return {
        ".loom/companion/manifest.json": default_companion_manifest(),
        ".loom/companion/repo-interface.json": default_repo_interface(),
        ".loom/companion/interop.json": default_repo_interop(),
        ".loom/companion/releases/catalog.json": {
            "schema_version": "loom-target-release-catalog/v1",
            "current_release_id": "bootstrap-v0.1.0",
            "releases": [
                {
                    "release_id": "bootstrap-v0.1.0",
                    "locator": ".loom/companion/releases/current.json",
                }
            ],
        },
        ".loom/companion/releases/current.json": {
            "schema_version": "loom-target-release/v1",
            "release_id": "bootstrap-v0.1.0",
            "display_name": "Bootstrap v0.1.0",
            "target_branch": "main",
            "release_goal": "Bootstrap the first executable Loom path for this repository.",
            "status": "unreleased",
            "included_scope": {
                "phase": [{"id": "bootstrap-phase", "locator": ".loom/companion/checkpoints.md", "delivery_status": "planned"}],
                "fr": [],
                "work_item": [{"id": "INIT-0001", "locator": ".loom/work-items/INIT-0001.md", "delivery_status": "unmerged"}],
                "implementation_pr": [],
                "merge_commit": [],
            },
            "evidence": {
                "changelog_locator": ".loom/companion/releases/changelog.md",
                "release_notes_locator": ".loom/companion/releases/release-notes.md",
                "migration_notes_locator": ".loom/companion/releases/migration-notes.md",
                "tag_or_artifact_locator": ".loom/companion/README.md",
                "rollback_basis_locator": ".loom/companion/releases/rollback.md",
            },
            "authority": {
                "owner": "repo-companion",
                "source_kind": "repo_owned_locator",
                "source_locator": ".loom/companion/releases/current.json",
            },
        },
        ".loom/companion/releases/status.json": {
            "schema_version": "loom-target-release-status/v1",
            "result": "pass",
            "summary": "repo-owned release status example is readable.",
        },
    }


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def shadow_evidence_payload(target_root: Path, *, source: str, value: str) -> dict[str, Any]:
    source_path = target_root / source
    return {
        "result": value,
        "source_files": [source],
        "source_sha256": {source: sha256_file(source_path)},
    }


def companion_artifact_rows(target_root: Path, *, written_files: list[str] | None = None) -> list[dict[str, Any]]:
    written = set(written_files or [])
    paths = [
        *companion_text_payloads().keys(),
        *companion_json_payloads().keys(),
    ]
    rows = []
    for relative in paths:
        path = target_root / relative
        rows.append(
            {
                "path": relative,
                "kind": "json" if relative.endswith(".json") else "text",
                "owner": "repo-owned" if relative.startswith(".loom/companion/") else "loom-owned",
                "action": "keep_existing" if path.exists() and relative not in written else "write_scaffold",
                "status": "written" if relative in written else "present" if path.exists() else "planned",
                "source_judgment": "repo_interop" if "interop" in relative or "/shadow/" in relative else "repo_interface",
            }
        )
    return rows


def apply_companion_generation(target_root: Path, *, force: bool) -> tuple[list[str], list[str]]:
    blockers: list[str] = []
    written: list[str] = []
    for relative, content in companion_text_payloads().items():
        path = target_root / relative
        if path.exists():
            if path.read_text(encoding="utf-8") != content:
                blockers.append(f"refusing to overwrite repo-owned adoption artifact: {relative}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        written.append(relative)
    for relative, payload in companion_json_payloads().items():
        path = target_root / relative
        content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        if path.exists():
            if path.read_text(encoding="utf-8") != content:
                blockers.append(f"refusing to overwrite repo-owned adoption artifact: {relative}")
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        written.append(relative)
    return written, blockers


def companion_generation_payload(
    target_root: Path,
    decisions: dict[str, Any],
    *,
    dry_run: bool,
    written_files: list[str] | None = None,
    blockers: list[str] | None = None,
) -> dict[str, Any]:
    missing_inputs = blockers or []
    return {
        "schema_version": COMPANION_GENERATION_SCHEMA,
        "result": "block" if missing_inputs else "pass",
        "summary": "repo companion and interop artifacts are generated from bounded adoption decisions.",
        "dry_run": dry_run,
        "source_decisions": [
            judgment.get("id")
            for judgment in decisions.get("judgments", [])
            if isinstance(judgment, dict)
        ],
        "artifacts": companion_artifact_rows(target_root, written_files=written_files),
        "missing_inputs": missing_inputs,
        "verification_commands": adoption_validation_commands(target_root),
    }


def repo_specific_default_fallback(surface: str) -> str:
    return {
        "spec_review": "build",
        "review": "build",
        "merge_ready": "merge",
        "closeout": "merge",
    }[surface]


def tool_availability_for_surface(repo_interface: object, *, surface: str) -> dict[str, Any]:
    empty_payload = {
        "schema_version": "loom-dynamic-tool-handshake/v1",
        "surface": surface,
        "result": "pass",
        "summary": "no dynamic tool handshake evidence applies to this surface.",
        "declared_tools": [],
        "blocking_tools": [],
        "advisory_tools": [],
        "failure_summary": {
            "required_blocking": [],
            "optional_advisory": [],
            "by_status": {
                "advertised": 0,
                "failed": 0,
                "unavailable": 0,
                "unsupported": 0,
            },
        },
        "missing_inputs": [],
        "fallback_to": None,
    }
    if not isinstance(repo_interface, dict):
        return empty_payload
    tool_availability = repo_interface.get("tool_availability")
    if not isinstance(tool_availability, dict):
        return empty_payload
    declared_tools = tool_availability.get("declared_tools")
    if not isinstance(declared_tools, list):
        return empty_payload

    applicable: list[dict[str, Any]] = []
    for tool in declared_tools:
        if not isinstance(tool, dict):
            continue
        tool_surface = tool.get("surface")
        if tool_surface in {surface, "attempt_time"}:
            applicable.append(tool)
    by_status = {
        "advertised": 0,
        "failed": 0,
        "unavailable": 0,
        "unsupported": 0,
    }
    blocking_tools: list[dict[str, Any]] = []
    advisory_tools: list[dict[str, Any]] = []
    missing_inputs: list[str] = []
    fallback_to: str | None = None
    for tool in applicable:
        status = tool.get("status")
        if isinstance(status, str) and status in by_status:
            by_status[status] += 1
        if tool.get("result") == "block":
            blocking_tools.append(tool)
            fallback = tool.get("fallback_to")
            if fallback_to is None and isinstance(fallback, str) and fallback:
                fallback_to = fallback
            for message in tool.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(str(message))
        elif tool.get("status") != "advertised":
            advisory_tools.append(tool)

    result = "block" if blocking_tools else "pass"
    if blocking_tools:
        summary = "required dynamic tool handshake evidence blocks this surface."
    elif advisory_tools:
        summary = "only optional or advisory dynamic tool handshake failures apply to this surface."
    elif applicable:
        summary = "dynamic tool handshake evidence is advertised for this surface."
    else:
        summary = empty_payload["summary"]
    return {
        **empty_payload,
        "result": result,
        "summary": summary,
        "declared_tools": applicable,
        "blocking_tools": blocking_tools,
        "advisory_tools": advisory_tools,
        "failure_summary": {
            "required_blocking": blocking_tools,
            "optional_advisory": advisory_tools,
            "by_status": by_status,
        },
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to if result == "block" else None,
    }


def policy_readiness_for_surface(repo_interface: object, *, surface: str) -> dict[str, Any]:
    empty_payload = {
        "schema_version": "loom-policy-readiness/v1",
        "surface": surface,
        "result": "pass",
        "summary": "no approval or sandbox policy evidence applies to this surface.",
        "declared_policies": [],
        "blocking_policies": [],
        "advisory_policies": [],
        "approval_policy": None,
        "sandbox_policy": None,
        "risk_summary": {
            "blocking": [],
            "advisory": [],
            "by_status": {
                "conflict": 0,
                "declared": 0,
                "missing": 0,
                "unsafe": 0,
            },
            "by_policy": {
                "approval": "missing",
                "sandbox": "missing",
            },
        },
        "missing_inputs": [],
        "fallback_to": None,
    }
    if not isinstance(repo_interface, dict):
        return empty_payload
    policy_readiness = repo_interface.get("policy_readiness")
    if not isinstance(policy_readiness, dict):
        return empty_payload
    declared_policies = policy_readiness.get("declared_policies")
    if not isinstance(declared_policies, list):
        return empty_payload

    applicable: list[dict[str, Any]] = []
    for policy in declared_policies:
        if not isinstance(policy, dict):
            continue
        policy_surface = policy.get("surface")
        if policy_surface in {surface, "attempt_time"}:
            applicable.append(policy)

    by_status = {
        "conflict": 0,
        "declared": 0,
        "missing": 0,
        "unsafe": 0,
    }
    by_policy = {
        "approval": "missing",
        "sandbox": "missing",
    }
    blocking_policies: list[dict[str, Any]] = []
    advisory_policies: list[dict[str, Any]] = []
    missing_inputs: list[str] = []
    fallback_to: str | None = None
    latest_by_policy: dict[str, dict[str, Any]] = {}
    for policy in applicable:
        status = policy.get("status")
        if isinstance(status, str) and status in by_status:
            by_status[status] += 1
        policy_type = policy.get("policy")
        if isinstance(policy_type, str) and policy_type in by_policy:
            by_policy[policy_type] = str(status or "missing")
            latest_by_policy[policy_type] = policy
        if policy.get("result") == "block":
            blocking_policies.append(policy)
            fallback = policy.get("fallback_to")
            if fallback_to is None and isinstance(fallback, str) and fallback:
                fallback_to = fallback
            for message in policy.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(str(message))
        elif policy.get("status") != "declared":
            advisory_policies.append(policy)

    result = "block" if blocking_policies else "pass"
    if blocking_policies:
        summary = "required approval or sandbox policy evidence blocks this surface."
    elif advisory_policies:
        summary = "only optional or advisory approval/sandbox policy risk applies to this surface."
    elif applicable:
        summary = "approval and sandbox policy evidence is declared for this surface."
    else:
        summary = empty_payload["summary"]
    return {
        **empty_payload,
        "result": result,
        "summary": summary,
        "declared_policies": applicable,
        "blocking_policies": blocking_policies,
        "advisory_policies": advisory_policies,
        "approval_policy": latest_by_policy.get("approval"),
        "sandbox_policy": latest_by_policy.get("sandbox"),
        "risk_summary": {
            "blocking": blocking_policies,
            "advisory": advisory_policies,
            "by_status": by_status,
            "by_policy": by_policy,
        },
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to if result == "block" else None,
    }


def repo_specific_requirements_payload(
    repo_interface: object,
    *,
    target_root: Path,
    surface: str,
) -> dict[str, Any]:
    empty_payload = {
        "surface": surface,
        "result": "pass",
        "source_locator": None,
        "declared_requirements": [],
        "blocking_requirements": [],
        "advisory_requirements": [],
        "summary": "no repo companion requirements are declared for this surface.",
        "missing_inputs": [],
        "fallback_to": None,
        "tool_availability": tool_availability_for_surface(repo_interface, surface=surface),
        "policy_readiness": policy_readiness_for_surface(repo_interface, surface=surface),
    }
    if not isinstance(repo_interface, dict):
        return {
            **empty_payload,
            "result": "block",
            "summary": "repo companion interface could not be read from governance_surface.",
            "missing_inputs": ["governance_surface.repo_interface"],
            "fallback_to": repo_specific_default_fallback(surface),
        }

    availability = repo_interface.get("availability")
    if availability == "absent":
        return {
            **empty_payload,
            "summary": "no repo companion interface is declared for this repository.",
        }
    if availability == "companion_docs_only":
        return {
            **empty_payload,
            "summary": "legacy companion docs are present, but no machine-readable repo companion requirements are declared.",
        }
    if availability == "incomplete":
        missing_inputs = repo_interface.get("missing_inputs")
        return {
            **empty_payload,
            "result": "block",
            "summary": "repo companion interface is incomplete, so Loom cannot safely consume repo-specific requirements.",
            "missing_inputs": list(missing_inputs) if isinstance(missing_inputs, list) else ["repo companion interface"],
            "fallback_to": repo_specific_default_fallback(surface),
        }
    if availability != "present":
        return {
            **empty_payload,
            "result": "block",
            "summary": "repo companion interface returned an unknown availability state.",
            "missing_inputs": [f"unknown repo companion availability: {availability}"],
            "fallback_to": repo_specific_default_fallback(surface),
        }

    repo_specific_locator = repo_interface.get("repo_specific_requirements")
    declared_locator = (
        repo_specific_locator.get("locator")
        if isinstance(repo_specific_locator, dict)
        else ".loom/companion/repo-interface.json"
    )
    repo_specific_path, locator_errors = resolve_repo_relative_path(
        target_root,
        str(declared_locator),
        label="repo companion requirements locator",
    )
    if locator_errors:
        return {
            **empty_payload,
            "result": "block",
            "summary": "repo companion requirements locator is unsafe.",
            "missing_inputs": locator_errors,
            "fallback_to": repo_specific_default_fallback(surface),
        }
    assert repo_specific_path is not None
    blocking: list[dict[str, Any]] = []
    advisory: list[dict[str, Any]] = []
    declared: list[dict[str, Any]] = []
    try:
        payload = load_json_file(repo_specific_path)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {
            **empty_payload,
            "result": "block",
            "summary": "repo companion requirements are declared, but the machine-readable interface could not be loaded.",
            "missing_inputs": [f"missing repo companion interface: {repo_specific_path}"],
            "fallback_to": repo_specific_default_fallback(surface),
        }

    requirements = payload.get("repo_specific_requirements") if isinstance(payload, dict) else None
    entries = requirements.get(surface) if isinstance(requirements, dict) else None
    if not isinstance(entries, list):
        return {
            **empty_payload,
            "result": "block",
            "summary": "repo companion interface is missing the requested surface requirements.",
            "missing_inputs": [f"repo companion surface missing: {surface}"],
            "fallback_to": repo_specific_default_fallback(surface),
        }

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        declared.append(entry)
        if entry.get("enforcement") == "blocking":
            blocking.append(entry)
        elif entry.get("enforcement") == "advisory":
            advisory.append(entry)

    if blocking:
        summary = (
            "companion-declared blocking requirements remain outside Loom core and must be handled before this surface can pass."
        )
        result = "block"
        fallback_to = repo_specific_default_fallback(surface)
        missing_inputs = [f"repo companion requirement: {entry.get('id', 'unknown')}" for entry in blocking]
    elif advisory:
        summary = "only companion-declared advisory requirements are present for this surface."
        result = "pass"
        fallback_to = None
        missing_inputs = []
    else:
        summary = "no repo companion requirements are declared for this surface."
        result = "pass"
        fallback_to = None
        missing_inputs = []

    tool_availability = tool_availability_for_surface(repo_interface, surface=surface)
    if tool_availability.get("result") == "block":
        result = "block"
        fallback_to = fallback_to or tool_availability.get("fallback_to") or repo_specific_default_fallback(surface)
        for message in tool_availability.get("missing_inputs", []):
            if message not in missing_inputs:
                missing_inputs.append(str(message))
        if not blocking:
            summary = "required dynamic tool handshake evidence blocks this surface."
    policy_readiness = policy_readiness_for_surface(repo_interface, surface=surface)
    if policy_readiness.get("result") == "block":
        result = "block"
        fallback_to = fallback_to or policy_readiness.get("fallback_to") or repo_specific_default_fallback(surface)
        for message in policy_readiness.get("missing_inputs", []):
            if message not in missing_inputs:
                missing_inputs.append(str(message))
        if not blocking and tool_availability.get("result") != "block":
            summary = "required approval or sandbox policy evidence blocks this surface."
    return {
        "surface": surface,
        "result": result,
        "source_locator": declared_locator,
        "declared_requirements": declared,
        "blocking_requirements": blocking,
        "advisory_requirements": advisory,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to,
        "tool_availability": tool_availability,
        "policy_readiness": policy_readiness,
    }


def load_repo_interop_contract(repo_interop: object, *, target_root: Path) -> tuple[dict[str, Any] | None, list[str]]:
    if not isinstance(repo_interop, dict):
        return None, ["governance_surface.repo_interop"]
    availability = repo_interop.get("availability")
    if availability == "absent":
        return None, ["repo interop contract is absent"]
    if availability == "incomplete":
        missing_inputs = repo_interop.get("missing_inputs")
        return None, list(missing_inputs) if isinstance(missing_inputs, list) else ["repo interop contract is incomplete"]
    if availability != "present":
        return None, [f"unknown repo interop availability: {availability}"]

    contract_locator = repo_interop.get("contract")
    declared_locator = (
        contract_locator.get("locator")
        if isinstance(contract_locator, dict)
        else ".loom/companion/interop.json"
    )
    interop_path, locator_errors = resolve_repo_relative_path(
        target_root,
        str(declared_locator),
        label="repo interop contract locator",
    )
    if locator_errors:
        return None, locator_errors
    assert interop_path is not None
    try:
        payload = load_json_file(interop_path)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None, [f"missing repo interop contract: {interop_path}"]
    if not isinstance(payload, dict):
        return None, [f"repo interop contract is unreadable: {interop_path}"]
    return payload, []


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repo_relative_path(target_root: Path, relative: str) -> Path | None:
    candidate, errors = resolve_repo_relative_path(target_root, relative, label="repo locator")
    return None if errors else candidate


def path_boundary_details_from_messages(errors: list[str]) -> list[dict[str, object]]:
    details: list[dict[str, object]] = []
    for message in errors:
        if "must stay" not in message and "repo-relative" not in message and "non-empty repo-relative" not in message:
            continue
        label = message.split(" must ", 1)[0] if " must " in message else "repo locator"
        locator = message.rsplit(": ", 1)[-1] if ": " in message else ""
        details.extend(path_boundary_missing_details(label=label, locator=locator, errors=[message]))
    return details


def validate_shadow_sources(payload: dict[str, Any], *, path: Path, target_root: Path) -> tuple[dict[str, Any], list[str]]:
    source_files = payload.get("source_files")
    source_sha256 = payload.get("source_sha256")
    errors: list[str] = []
    if not isinstance(source_files, list) or not source_files:
        errors.append(f"shadow evidence `{path}` must declare non-empty `source_files`")
        source_files = []
    if not isinstance(source_sha256, dict) or not source_sha256:
        errors.append(f"shadow evidence `{path}` must declare non-empty `source_sha256`")
        source_sha256 = {}

    normalized_sources: list[str] = []
    for index, source in enumerate(source_files, start=1):
        if not isinstance(source, str) or not source.strip():
            errors.append(f"shadow evidence `{path}` source_files[{index}] must be a non-empty relative path")
            continue
        source = source.strip()
        if Path(source).is_absolute() or ".." in Path(source).parts:
            errors.append(f"shadow evidence `{path}` source `{source}` must stay inside the repository")
            continue
        source_path = repo_relative_path(target_root, source)
        if source_path is None:
            errors.append(f"shadow evidence `{path}` source `{source}` must stay inside the repository")
            continue
        if not source_path.exists() or source_path.is_dir():
            errors.append(f"shadow evidence `{path}` source `{source}` must be an existing file")
            continue
        normalized_sources.append(source)

    source_keys = set(normalized_sources)
    hash_keys = {key for key in source_sha256.keys() if isinstance(key, str)}
    if source_keys != hash_keys:
        errors.append(f"shadow evidence `{path}` source_files and source_sha256 keys must match exactly")
    for source in sorted(source_keys & hash_keys):
        expected = source_sha256.get(source)
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", expected):
            errors.append(f"shadow evidence `{path}` source `{source}` must declare a 64-character sha256")
            continue
        actual = sha256_file(target_root / source)
        if actual.lower() != expected.lower():
            errors.append(f"shadow evidence `{path}` source `{source}` sha256 drifted")

    return {
        "source_files": normalized_sources,
        "source_sha256": {source: source_sha256.get(source) for source in normalized_sources if isinstance(source_sha256.get(source), str)},
    }, errors


def declared_shadow_locators(interop_payload: dict[str, Any]) -> set[str]:
    shadow_surfaces = interop_payload.get("shadow_surfaces")
    declared: set[str] = set()
    if not isinstance(shadow_surfaces, dict):
        return declared
    for entry in shadow_surfaces.values():
        if not isinstance(entry, dict):
            continue
        for key in ("loom_locator", "repo_locator"):
            value = entry.get(key)
            if isinstance(value, str) and value.strip():
                declared.add(value.strip())
    return declared


def undeclared_shadow_evidence_errors(target_root: Path, interop_payload: dict[str, Any]) -> list[str]:
    shadow_root = target_root / ".loom/shadow"
    if not shadow_root.exists():
        return []
    declared = declared_shadow_locators(interop_payload)
    errors: list[str] = []
    for path in sorted(shadow_root.glob("*.json")):
        relative = path.relative_to(target_root).as_posix()
        if relative == ".loom/shadow/shadow-parity.json":
            continue
        if relative not in declared:
            errors.append(f"shadow evidence `{relative}` is not declared in repo interop shadow_surfaces")
    return errors


def normalized_shadow_value(path: Path, *, target_root: Path) -> tuple[dict[str, Any], str | None]:
    try:
        if path.is_dir():
            return {"normalized_value": None}, f"shadow parity locator points to a directory: {path}"
        raw_text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return {"normalized_value": None}, f"cannot read shadow parity locator `{path}`: {exc.strerror or exc}"
    if not raw_text.strip():
        return {"normalized_value": None}, f"shadow parity locator is empty: {path}"

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError:
        payload = None

    if isinstance(payload, dict):
        source_evidence, source_errors = validate_shadow_sources(payload, path=path, target_root=target_root)
        for key in ("parity_value", "result", "decision", "status", "verdict", "value"):
            value = payload.get(key)
            if isinstance(value, (str, int, float, bool)) and str(value).strip():
                comparable: object = str(value).strip().lower()
                semantic_evidence = {
                    semantic_key: payload[semantic_key]
                    for semantic_key in ("source_semantics", "evidence_body")
                    if semantic_key in payload
                }
                if semantic_evidence:
                    comparable = {
                        "value": comparable,
                        **semantic_evidence,
                    }
                normalized = (
                    comparable
                    if isinstance(comparable, str)
                    else json.dumps(comparable, ensure_ascii=False, sort_keys=True)
                )
                return {**source_evidence, "normalized_value": normalized}, "; ".join(source_errors) if source_errors else None
        return {**source_evidence, "normalized_value": json.dumps(payload, ensure_ascii=False, sort_keys=True)}, "; ".join(source_errors) if source_errors else None
    if isinstance(payload, list):
        return {"normalized_value": json.dumps(payload, ensure_ascii=False, sort_keys=True)}, f"shadow evidence `{path}` must be a JSON object with source_files/source_sha256"
    if isinstance(payload, (str, int, float, bool)) and str(payload).strip():
        return {"normalized_value": str(payload).strip().lower()}, f"shadow evidence `{path}` must be a JSON object with source_files/source_sha256"

    for line in raw_text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            return {"normalized_value": stripped.lower()}, f"shadow evidence `{path}` must be a JSON object with source_files/source_sha256"
    return {"normalized_value": None}, f"shadow parity locator does not expose a comparable value: {path}"


def shadow_parity_report(
    repo_interop: object,
    *,
    target_root: Path,
    surface: str,
) -> dict[str, Any]:
    empty_report = {
        "surface": surface,
        "result": "unreadable",
        "classification": "gate_failure",
        "blocking": False,
        "summary": "shadow parity could not be evaluated for this surface.",
        "missing_inputs": [],
        "recommended_action": "restore the declared Loom and repo-native shadow parity locators before treating this surface as authoritative.",
        "host_adapters": [],
        "repo_native_carriers": [],
        "loom_surface": {
            "status": "missing",
            "locator": "unknown",
            "normalized_value": None,
        },
        "repo_surface": {
            "status": "missing",
            "locator": "unknown",
            "normalized_value": None,
        },
    }
    interop_payload, interop_errors = load_repo_interop_contract(repo_interop, target_root=target_root)
    if interop_errors:
        missing_details = path_boundary_details_from_messages(interop_errors)
        payload = {
            **empty_report,
            "summary": "shadow parity is unavailable because the repo interop contract is missing or incomplete.",
            "missing_inputs": interop_errors,
        }
        if missing_details:
            payload["missing_details"] = missing_details
        return {
            **payload,
        }
    if not isinstance(interop_payload, dict):
        return empty_report

    host_adapters = interop_payload.get("host_adapters")
    repo_native_carriers = interop_payload.get("repo_native_carriers")
    shadow_surfaces = interop_payload.get("shadow_surfaces")
    if not isinstance(host_adapters, list) or not isinstance(repo_native_carriers, list) or not isinstance(shadow_surfaces, dict):
        return {
            **empty_report,
            "summary": "shadow parity is unavailable because the repo interop contract cannot be consumed safely.",
            "missing_inputs": ["repo interop contract"],
        }

    relevant_host_adapters = [
        entry for entry in host_adapters if isinstance(entry, dict) and surface in entry.get("surfaces", [])
    ]
    relevant_repo_native_carriers = [
        entry for entry in repo_native_carriers if isinstance(entry, dict) and surface in entry.get("surfaces", [])
    ]
    declared_surface = shadow_surfaces.get(surface)
    if not isinstance(declared_surface, dict):
        return {
            **empty_report,
            "summary": "shadow parity is unavailable because this surface is not declared in the repo interop contract.",
            "missing_inputs": [f"shadow surface missing: {surface}"],
            "host_adapters": relevant_host_adapters,
            "repo_native_carriers": relevant_repo_native_carriers,
        }

    loom_locator = declared_surface.get("loom_locator")
    repo_locator = declared_surface.get("repo_locator")
    loom_path, loom_locator_errors = resolve_repo_relative_path(
        target_root,
        str(loom_locator),
        label=f"shadow surface `{surface}` loom_locator",
    )
    repo_path, repo_locator_errors = resolve_repo_relative_path(
        target_root,
        str(repo_locator),
        label=f"shadow surface `{surface}` repo_locator",
    )
    if loom_locator_errors or repo_locator_errors:
        missing_details = [
            *path_boundary_missing_details(
                label=f"shadow surface `{surface}` loom_locator",
                locator=loom_locator,
                errors=loom_locator_errors,
            ),
            *path_boundary_missing_details(
                label=f"shadow surface `{surface}` repo_locator",
                locator=repo_locator,
                errors=repo_locator_errors,
            ),
        ]
        return {
            **empty_report,
            "summary": "shadow parity is unavailable because a declared surface locator is unsafe.",
            "missing_inputs": [*loom_locator_errors, *repo_locator_errors],
            "missing_details": missing_details,
            "host_adapters": relevant_host_adapters,
            "repo_native_carriers": relevant_repo_native_carriers,
        }
    assert loom_path is not None
    assert repo_path is not None

    loom_surface = {
        "status": "missing",
        "locator": str(loom_locator),
        "normalized_value": None,
    }
    repo_surface = {
        "status": "missing",
        "locator": str(repo_locator),
        "normalized_value": None,
    }

    global_errors = undeclared_shadow_evidence_errors(target_root, interop_payload)
    loom_evidence, loom_error = normalized_shadow_value(loom_path, target_root=target_root)
    repo_evidence, repo_error = normalized_shadow_value(repo_path, target_root=target_root)
    loom_value = loom_evidence.get("normalized_value")
    repo_value = repo_evidence.get("normalized_value")

    missing_inputs: list[str] = []
    missing_inputs.extend(global_errors)
    if loom_error:
        missing_inputs.append(loom_error)
    if repo_error:
        missing_inputs.append(repo_error)

    loom_surface = {
        **loom_evidence,
        "status": "readable" if loom_error is None else "missing",
        "locator": str(loom_locator),
    }
    repo_surface = {
        **repo_evidence,
        "status": "readable" if repo_error is None else "missing",
        "locator": str(repo_locator),
    }

    if global_errors or loom_error or repo_error or loom_value is None or repo_value is None:
        return {
            **empty_report,
            "summary": "shadow parity is unreadable because one or both declared surfaces cannot be normalized.",
            "missing_inputs": missing_inputs,
            "host_adapters": relevant_host_adapters,
            "repo_native_carriers": relevant_repo_native_carriers,
            "loom_surface": loom_surface,
            "repo_surface": repo_surface,
        }
    if loom_value == repo_value:
        return {
            "surface": surface,
            "result": "match",
            "classification": None,
            "blocking": False,
            "summary": "Loom and repo-native surfaces report the same normalized result.",
            "missing_inputs": [],
            "recommended_action": "no shadow parity action required.",
            "host_adapters": relevant_host_adapters,
            "repo_native_carriers": relevant_repo_native_carriers,
            "loom_surface": loom_surface,
            "repo_surface": repo_surface,
        }
    return {
        "surface": surface,
        "result": "mismatch",
        "classification": "drift",
        "blocking": False,
        "summary": "Loom and repo-native surfaces disagree on the normalized result.",
        "missing_inputs": [],
        "recommended_action": "resolve the parity mismatch or explicitly choose the authoritative surface outside repo interop before enabling blocking consumption.",
        "host_adapters": relevant_host_adapters,
        "repo_native_carriers": relevant_repo_native_carriers,
        "loom_surface": loom_surface,
        "repo_surface": repo_surface,
    }


def normalize_checkpoint(raw: str) -> str:
    lowered = raw.strip().lower()
    if "commit checkpoint" in lowered or "admission checkpoint" in lowered:
        return "admission"
    if "build checkpoint" in lowered:
        return "build"
    if "merge checkpoint" in lowered:
        return "merge"
    if "retired" in lowered:
        return "retired"
    return lowered.replace(" checkpoint", "").strip()


def checkpoint_rank(name: str) -> int:
    ranks = {
        "admission": 1,
        "build": 2,
        "merge": 3,
        "retired": 99,
    }
    return ranks.get(name, -1)


def run_git(root: Path, args: list[str]) -> subprocess.CompletedProcess[str] | None:
    if not (root / ".git").exists():
        return None
    try:
        return subprocess.run(
            ["git", *args],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None


def run_process(args: list[str], cwd: Path, *, timeout_seconds: float | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )


def git_branch(root: Path) -> str | None:
    result = run_git(root, ["rev-parse", "--abbrev-ref", "HEAD"])
    if result is None or result.returncode != 0:
        return None
    branch = result.stdout.strip()
    return branch or None


def git_head_sha(root: Path) -> str | None:
    result = run_git(root, ["rev-parse", "HEAD"])
    if result is None or result.returncode != 0:
        return None
    sha = result.stdout.strip()
    return sha or None


def git_changed_paths(root: Path, base: str, head: str) -> tuple[list[str], list[str]]:
    result = run_git(root, ["diff", "--name-only", "--no-renames", f"{base}..{head}"])
    if result is None:
        return [], ["git is unavailable while comparing reviewed HEAD to current HEAD"]
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git diff failed"
        return [], [detail]
    paths = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return paths, []


def git_tracked_diff_fingerprint(root: Path) -> tuple[str | None, list[str]]:
    result = run_git(root, ["diff", "--binary", "--no-ext-diff", "HEAD", "--"])
    if result is None:
        return None, ["git is unavailable while fingerprinting tracked changes"]
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git diff failed"
        return None, [detail]
    return result.stdout, []


def git_remote_origin(root: Path) -> str | None:
    result = run_git(root, ["remote", "get-url", "origin"])
    if result is None or result.returncode != 0:
        return None
    remote = result.stdout.strip()
    return remote or None


def detect_github_repo(root: Path) -> tuple[str | None, str | None]:
    remote = git_remote_origin(root)
    if not remote:
        return None, None
    match = re.search(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?$", remote)
    if not match:
        return None, None
    return match.group("owner"), match.group("repo")


def read_text_file(path_str: str) -> tuple[str | None, list[str]]:
    path = Path(path_str).expanduser()
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return None, [f"failed to read {path}: {exc.strerror or exc}"]
    return text, []


def read_repo_relative_text_file(root: Path, path_str: str, *, label: str) -> tuple[str | None, list[str]]:
    path, errors = resolve_repo_relative_path(root, path_str, label=label)
    if errors:
        return None, errors
    if path is None:
        return None, [f"{label} is unavailable"]
    if not path.exists() or not path.is_file():
        return None, [f"{label} points to a missing file: {path_str}"]
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return None, [f"failed to read {path_str}: {exc.strerror or exc}"]
    return text, []


def write_json_file(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def truthy_env(name: str) -> bool:
    value = os.environ.get(name)
    if value is None:
        return False
    return value.strip().lower() not in {"", "0", "false", "no", "off"}


def non_empty_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def execution_attempt_directory(target_root: Path, item_id: str) -> Path:
    return target_root / ".loom/runtime/attempts" / item_id


def execution_attempt_locator(item_id: str, filename: str = "latest.json") -> str:
    return f".loom/runtime/attempts/{item_id}/{filename}"


def collect_forbidden_execution_attempt_paths(payload: Any, prefix: str = "") -> list[str]:
    found: list[str] = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            if key in EXECUTION_ATTEMPT_FORBIDDEN_AUTHORED_FIELDS:
                found.append(path)
            found.extend(collect_forbidden_execution_attempt_paths(value, path))
    elif isinstance(payload, list):
        for index, value in enumerate(payload):
            found.extend(collect_forbidden_execution_attempt_paths(value, f"{prefix}[{index}]"))
    return found


def execution_attempt_failure_category(payload: dict[str, Any]) -> str:
    if payload.get("result") == "pass":
        return "none"
    missing_inputs = payload.get("missing_inputs")
    haystack = " ".join(str(item).lower() for item in missing_inputs if isinstance(missing_inputs, list))
    steps = payload.get("steps")
    if isinstance(steps, list):
        for step in steps:
            if not isinstance(step, dict) or step.get("result") not in {"block", "fallback"}:
                continue
            name = str(step.get("name") or "")
            if "runtime-state" in name:
                return "runtime_state"
            if "fact-chain" in name:
                return "fact_chain"
            if "state-check" in name:
                return "state_check"
            if "runtime-evidence" in name:
                return "runtime_evidence"
            if "checkpoint" in name:
                return "checkpoint"
            if "review" in name:
                return "review"
    if "runtime state" in haystack:
        return "runtime_state"
    if "fact-chain" in haystack or "fact chain" in haystack:
        return "fact_chain"
    if "runtime_evidence" in haystack or "runtime evidence" in haystack:
        return "runtime_evidence"
    if "checkpoint" in haystack:
        return "checkpoint"
    if "review" in haystack:
        return "review"
    if "repo-specific" in haystack or "companion" in haystack:
        return "repo_specific"
    if "recovery readiness" in haystack:
        return "recovery_readiness"
    return "unknown"


def classify_execution_failure_text(text: str) -> str:
    lowered = text.strip().lower()
    if not lowered:
        return "unknown"
    if "retry_exhaustion" in lowered or "retry exhaustion" in lowered or "retries exhausted" in lowered:
        return "retry_exhaustion"
    if "timed out" in lowered or re.search(r"\btimeout\b", lowered):
        return "timeout"
    if "stall" in lowered or "stalled" in lowered:
        return "stall"
    return "unknown"


def execution_failure_details(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("result") == "pass":
        return {
            "classification": "none",
            "summary": "latest execution attempt completed without an execution failure classification.",
            "fallback_to": None,
        }

    explicit = payload.get("execution_failure")
    if isinstance(explicit, dict):
        classification = explicit.get("classification") or explicit.get("kind")
        summary = explicit.get("summary")
        fallback_to = explicit.get("fallback_to")
        if isinstance(classification, str) and classification in EXECUTION_FAILURE_CLASSIFICATIONS:
            normalized_summary = (
                str(summary).strip()
                if isinstance(summary, str) and str(summary).strip()
                else f"execution failure classified as `{classification}`."
            )
            return {
                "classification": classification,
                "summary": normalized_summary,
                "fallback_to": str(fallback_to) if isinstance(fallback_to, str) and fallback_to.strip() else payload.get("fallback_to"),
            }

    texts: list[str] = []
    summary = payload.get("summary")
    if isinstance(summary, str) and summary.strip():
        texts.append(summary.strip())
    missing_inputs = payload.get("missing_inputs")
    if isinstance(missing_inputs, list):
        texts.extend(str(item).strip() for item in missing_inputs if str(item).strip())
    steps = payload.get("steps")
    if isinstance(steps, list):
        for step in steps:
            if not isinstance(step, dict):
                continue
            for field in ("summary", "name"):
                value = step.get(field)
                if isinstance(value, str) and value.strip():
                    texts.append(value.strip())
            step_missing = step.get("missing_inputs")
            if isinstance(step_missing, list):
                texts.extend(str(item).strip() for item in step_missing if str(item).strip())
    engine = payload.get("engine")
    if isinstance(engine, dict):
        failure_reason = engine.get("failure_reason")
        if isinstance(failure_reason, str) and failure_reason.strip():
            texts.append(failure_reason.strip())

    classification = "unknown"
    matched_summary: str | None = None
    for candidate in texts:
        classification = classify_execution_failure_text(candidate)
        if classification != "unknown":
            matched_summary = candidate
            break

    summary_text = next((candidate for candidate in texts if candidate), None)
    return {
        "classification": classification,
        "summary": matched_summary or summary_text or "execution attempt blocked without a classified execution failure.",
        "fallback_to": payload.get("fallback_to"),
    }


def execution_attempt_summary_from_envelope(envelope: dict[str, Any]) -> dict[str, Any]:
    evidence = envelope.get("evidence") if isinstance(envelope.get("evidence"), dict) else {}
    failure = envelope.get("failure") if isinstance(envelope.get("failure"), dict) else {}
    return {
        "schema_version": EXECUTION_ATTEMPT_SCHEMA,
        "attempt_id": envelope.get("attempt_id"),
        "item_id": envelope.get("item_id"),
        "command": envelope.get("command"),
        "operation": envelope.get("operation"),
        "result": envelope.get("result"),
        "failure_category": failure.get("category"),
        "execution_classification": failure.get("execution_classification"),
        "execution_summary": failure.get("execution_summary"),
        "fallback_to": failure.get("fallback_to"),
        "evidence": {
            "status": evidence.get("status"),
            "locator": evidence.get("locator"),
            "latest_locator": evidence.get("latest_locator"),
        },
    }


def build_execution_attempt_envelope(
    context: dict[str, Any],
    *,
    command: str,
    operation: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    head_sha = git_head_sha(context["target_root"]) or "unknown-head"
    created_at = utc_now_iso()
    fingerprint = hashlib.sha256(
        json.dumps(
            {
                "item_id": context["item_id"],
                "command": command,
                "operation": operation,
                "head_sha": head_sha,
                "created_at": created_at,
                "result": payload.get("result"),
            },
            sort_keys=True,
            ensure_ascii=False,
        ).encode("utf-8")
    ).hexdigest()[:12]
    attempt_id = f"{context['item_id']}-{operation}-{head_sha[:12]}-{fingerprint}".replace("/", "-")
    attempt_locator = execution_attempt_locator(context["item_id"], f"{attempt_id}.json")
    latest_locator = execution_attempt_locator(context["item_id"])
    result = payload.get("result") if payload.get("result") in EXECUTION_ATTEMPT_RESULTS else "block"
    missing_inputs = payload.get("missing_inputs")
    if not isinstance(missing_inputs, list):
        missing_inputs = []
    failure_category = execution_attempt_failure_category(payload)
    if failure_category not in EXECUTION_ATTEMPT_FAILURE_CATEGORIES:
        failure_category = "unknown"
    execution_failure = execution_failure_details(payload)
    steps = payload.get("steps")
    step_summary = []
    if isinstance(steps, list):
        for step in steps:
            if not isinstance(step, dict):
                continue
            step_summary.append(
                {
                    "name": step.get("name"),
                    "result": step.get("result"),
                    "fallback_to": step.get("fallback_to"),
                    "missing_count": len(step.get("missing_inputs", [])) if isinstance(step.get("missing_inputs"), list) else 0,
                }
            )
    return {
        "schema_version": EXECUTION_ATTEMPT_SCHEMA,
        "attempt_id": attempt_id,
        "item_id": context["item_id"],
        "command": command,
        "operation": operation,
        "result": result,
        "created_at": created_at,
        "head_sha": head_sha,
        "branch": git_branch(context["target_root"]) or "unknown-branch",
        "workspace": {
            "entry": context["workspace_entry"],
            "path": relative_to_root(context["workspace_path"], context["target_root"]),
        },
        "failure": {
            "category": failure_category,
            "execution_classification": execution_failure["classification"],
            "execution_summary": execution_failure["summary"],
            "missing_inputs": missing_inputs,
            "fallback_to": execution_failure["fallback_to"],
        },
        "steps": step_summary,
        "evidence": {
            "status": "present",
            "locator": attempt_locator,
            "latest_locator": latest_locator,
        },
    }


def persist_execution_attempt(
    context: dict[str, Any],
    *,
    command: str,
    operation: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    envelope = build_execution_attempt_envelope(context, command=command, operation=operation, payload=payload)
    forbidden = collect_forbidden_execution_attempt_paths(envelope)
    if forbidden:
        envelope["evidence"] = {
            "status": "invalid",
            "locator": None,
            "latest_locator": execution_attempt_locator(context["item_id"]),
            "missing_inputs": [f"execution_attempt includes authored progress field `{path}`" for path in forbidden],
        }
        return execution_attempt_summary_from_envelope(envelope)

    evidence = envelope["evidence"]
    try:
        attempt_path, attempt_errors = resolve_repo_relative_path(
            context["target_root"],
            str(evidence["locator"]),
            label="execution_attempt evidence locator",
        )
        latest_path, latest_errors = resolve_repo_relative_path(
            context["target_root"],
            str(evidence["latest_locator"]),
            label="execution_attempt latest locator",
        )
        if attempt_errors or latest_errors:
            raise ValueError("; ".join([*attempt_errors, *latest_errors]))
        assert attempt_path is not None
        assert latest_path is not None
        write_json_file(attempt_path, envelope)
        write_json_file(latest_path, envelope)
    except Exception as exc:
        envelope["evidence"] = {
            "status": "missing",
            "locator": evidence.get("locator"),
            "latest_locator": evidence.get("latest_locator"),
            "missing_inputs": [f"execution_attempt evidence could not be written: {exc}"],
        }
    return execution_attempt_summary_from_envelope(envelope)


def validate_execution_attempt_envelope(
    payload: Any,
    *,
    target_root: Path,
    expected_item: str,
    expected_head: str | None = None,
) -> tuple[dict[str, Any] | None, list[str], str]:
    if not isinstance(payload, dict):
        return None, ["execution_attempt evidence must be a JSON object"], "invalid"
    errors: list[str] = []
    if payload.get("schema_version") != EXECUTION_ATTEMPT_SCHEMA:
        errors.append(f"execution_attempt schema_version must be `{EXECUTION_ATTEMPT_SCHEMA}`")
    for field in ("attempt_id", "item_id", "command", "operation", "created_at", "head_sha"):
        if not isinstance(payload.get(field), str) or not str(payload.get(field)).strip():
            errors.append(f"execution_attempt `{field}` must be a non-empty string")
    if payload.get("item_id") != expected_item:
        errors.append(f"execution_attempt item_id does not match `{expected_item}`")
    if payload.get("result") not in EXECUTION_ATTEMPT_RESULTS:
        errors.append("execution_attempt result must be pass, block, or fallback")
    workspace = payload.get("workspace")
    if not isinstance(workspace, dict):
        errors.append("execution_attempt workspace must be an object")
    else:
        for field in ("entry", "path"):
            if not isinstance(workspace.get(field), str) or not workspace.get(field):
                errors.append(f"execution_attempt workspace.{field} must be a non-empty string")
    failure = payload.get("failure")
    if not isinstance(failure, dict):
        errors.append("execution_attempt failure must be an object")
    else:
        if failure.get("category") not in EXECUTION_ATTEMPT_FAILURE_CATEGORIES:
            errors.append("execution_attempt failure.category is outside the stable vocabulary")
        if failure.get("execution_classification") not in EXECUTION_FAILURE_CLASSIFICATIONS:
            errors.append("execution_attempt failure.execution_classification is outside the stable vocabulary")
        if not isinstance(failure.get("execution_summary"), str) or not str(failure.get("execution_summary")).strip():
            errors.append("execution_attempt failure.execution_summary must be a non-empty string")
        if not isinstance(failure.get("missing_inputs"), list):
            errors.append("execution_attempt failure.missing_inputs must be a list")
    evidence = payload.get("evidence")
    if not isinstance(evidence, dict):
        errors.append("execution_attempt evidence must be an object")
    else:
        locator = evidence.get("locator")
        if not isinstance(locator, str) or not locator.strip():
            errors.append("execution_attempt evidence.locator must be a non-empty string")
        elif resolve_repo_relative_path(target_root, locator, label="execution_attempt evidence locator")[1]:
            errors.append("execution_attempt evidence.locator must stay inside the target root")
        if evidence.get("status") not in {"present", "missing", "invalid"}:
            errors.append("execution_attempt evidence.status must be present, missing, or invalid")
    forbidden = collect_forbidden_execution_attempt_paths(payload)
    for path in forbidden:
        errors.append(f"execution_attempt must not include authored progress field `{path}`")
    if errors:
        return payload, errors, "invalid"
    if expected_head and payload.get("head_sha") != expected_head:
        return payload, [], "stale"
    return payload, [], "fresh"


def latest_execution_attempt_payload(target_root: Path, item_id: str) -> dict[str, Any]:
    locator = execution_attempt_locator(item_id)
    path, path_errors = resolve_repo_relative_path(target_root, locator, label="execution_attempt latest locator")
    if path_errors:
        return {
            "schema_version": EXECUTION_ATTEMPT_SCHEMA,
            "status": "missing",
            "freshness": "missing",
            "summary": "latest execution attempt evidence locator is invalid.",
            "evidence": {"locator": locator, "status": "missing"},
            "missing_inputs": path_errors,
            "attempt": None,
        }
    assert path is not None
    if not path.exists():
        return {
            "schema_version": EXECUTION_ATTEMPT_SCHEMA,
            "status": "missing",
            "freshness": "missing",
            "summary": "latest execution attempt evidence is not present.",
            "evidence": {"locator": locator, "status": "missing"},
            "missing_inputs": [f"missing execution_attempt evidence: {locator}"],
            "attempt": None,
        }
    try:
        raw = load_json_file(path)
    except Exception as exc:
        return {
            "schema_version": EXECUTION_ATTEMPT_SCHEMA,
            "status": "invalid",
            "freshness": "unreadable",
            "summary": "latest execution attempt evidence is unreadable.",
            "evidence": {"locator": locator, "status": "invalid"},
            "missing_inputs": [str(exc)],
            "attempt": None,
        }
    current_head = git_head_sha(target_root) or "unknown-head"
    envelope, errors, freshness = validate_execution_attempt_envelope(
        raw,
        target_root=target_root,
        expected_item=item_id,
        expected_head=current_head,
    )
    status = "present" if freshness == "fresh" else ("stale" if freshness == "stale" else "invalid")
    summary = (
        "latest execution attempt evidence is fresh for the current item and HEAD."
        if freshness == "fresh"
        else "latest execution attempt evidence exists but is stale for the current HEAD."
        if freshness == "stale"
        else "latest execution attempt evidence is invalid."
    )
    return {
        "schema_version": EXECUTION_ATTEMPT_SCHEMA,
        "status": status,
        "freshness": freshness,
        "summary": summary,
        "evidence": {"locator": locator, "status": "present" if freshness in {"fresh", "stale"} else "invalid"},
        "missing_inputs": errors,
        "attempt": envelope,
    }


def execution_attempt_history_payload(target_root: Path, item_id: str) -> list[dict[str, Any]]:
    directory = execution_attempt_directory(target_root, item_id)
    if not directory.exists():
        return []
    attempts: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.json")):
        if path.name == "latest.json":
            continue
        try:
            payload = load_json_file(path)
        except Exception:
            continue
        envelope, errors, _ = validate_execution_attempt_envelope(
            payload,
            target_root=target_root,
            expected_item=item_id,
            expected_head=None,
        )
        if errors or envelope is None:
            continue
        attempts.append(envelope)
    attempts.sort(key=lambda entry: (str(entry.get("created_at") or ""), str(entry.get("attempt_id") or "")))
    return attempts


def latest_execution_failure_payload(latest_attempt: dict[str, Any]) -> dict[str, Any]:
    evidence = latest_attempt.get("evidence") if isinstance(latest_attempt, dict) else {}
    locator = evidence.get("locator") if isinstance(evidence, dict) else None
    freshness = latest_attempt.get("freshness") if isinstance(latest_attempt, dict) else None
    status = latest_attempt.get("status") if isinstance(latest_attempt, dict) else None
    provenance = {
        "source_layer": "derived_surface",
        "source_locator": locator,
        "source_binding": "latest_execution_attempt",
        "freshness": freshness if isinstance(freshness, str) else "missing",
        "conflict": "none",
    }
    if status == "missing":
        return {
            "schema_version": EXECUTION_FAILURE_SCHEMA,
            "status": "missing",
            "classification": "unknown",
            "summary": latest_attempt.get("summary") if isinstance(latest_attempt.get("summary"), str) else "latest execution attempt evidence is missing.",
            "fallback_to": None,
            "provenance": provenance,
        }
    if status == "invalid":
        return {
            "schema_version": EXECUTION_FAILURE_SCHEMA,
            "status": "invalid",
            "classification": "unknown",
            "summary": latest_attempt.get("summary") if isinstance(latest_attempt.get("summary"), str) else "latest execution attempt evidence is invalid.",
            "fallback_to": None,
            "provenance": provenance,
        }

    attempt = latest_attempt.get("attempt") if isinstance(latest_attempt, dict) else None
    failure = attempt.get("failure") if isinstance(attempt, dict) else None
    classification = failure.get("execution_classification") if isinstance(failure, dict) else None
    if not isinstance(classification, str) or classification not in EXECUTION_FAILURE_CLASSIFICATIONS:
        classification = "unknown"
    summary = failure.get("execution_summary") if isinstance(failure, dict) else None
    fallback_to = failure.get("fallback_to") if isinstance(failure, dict) else None
    normalized_summary = (
        str(summary).strip()
        if isinstance(summary, str) and str(summary).strip()
        else "latest execution attempt did not record a readable execution failure summary."
    )
    if freshness == "stale":
        return {
            "schema_version": EXECUTION_FAILURE_SCHEMA,
            "status": "stale",
            "classification": classification,
            "summary": "latest execution failure evidence exists but is stale for the current HEAD.",
            "fallback_to": str(fallback_to) if isinstance(fallback_to, str) and fallback_to.strip() else None,
            "provenance": provenance,
        }
    if classification == "none":
        return {
            "schema_version": EXECUTION_FAILURE_SCHEMA,
            "status": "not_applicable",
            "classification": "none",
            "summary": normalized_summary,
            "fallback_to": None,
            "provenance": provenance,
        }
    return {
        "schema_version": EXECUTION_FAILURE_SCHEMA,
        "status": "present",
        "classification": classification,
        "summary": normalized_summary,
        "fallback_to": str(fallback_to) if isinstance(fallback_to, str) and fallback_to.strip() else None,
        "provenance": provenance,
    }


def latest_retry_evidence_payload(target_root: Path, item_id: str) -> dict[str, Any]:
    latest_attempt = latest_execution_attempt_payload(target_root, item_id)
    history = execution_attempt_history_payload(target_root, item_id)
    evidence = latest_attempt.get("evidence") if isinstance(latest_attempt, dict) else {}
    locator = evidence.get("locator") if isinstance(evidence, dict) else None
    freshness = latest_attempt.get("freshness") if isinstance(latest_attempt, dict) else None
    provenance = {
        "source_layer": "derived_surface",
        "source_locator": locator,
        "source_binding": "execution_attempt_history",
        "freshness": freshness if isinstance(freshness, str) else "missing",
        "conflict": "none",
    }
    if latest_attempt.get("status") == "missing":
        return {
            "schema_version": RETRY_EVIDENCE_SCHEMA,
            "status": "missing",
            "attempt_count": 0,
            "retry_count": 0,
            "latest_attempt_id": None,
            "latest_attempt_result": None,
            "latest_failure_classification": "unknown",
            "latest_failure_summary": latest_attempt.get("summary"),
            "exhausted": False,
            "scheduler_ownership": "external",
            "stale_attempt_count": 0,
            "provenance": provenance,
        }
    if latest_attempt.get("status") == "invalid":
        return {
            "schema_version": RETRY_EVIDENCE_SCHEMA,
            "status": "invalid",
            "attempt_count": 0,
            "retry_count": 0,
            "latest_attempt_id": None,
            "latest_attempt_result": None,
            "latest_failure_classification": "unknown",
            "latest_failure_summary": latest_attempt.get("summary"),
            "exhausted": False,
            "scheduler_ownership": "external",
            "stale_attempt_count": 0,
            "provenance": provenance,
        }

    latest_envelope = latest_attempt.get("attempt") if isinstance(latest_attempt.get("attempt"), dict) else {}
    current_head = git_head_sha(target_root) or "unknown-head"
    current_attempts = [entry for entry in history if entry.get("head_sha") == current_head]
    stale_attempts = [entry for entry in history if entry.get("head_sha") != current_head]
    failure = latest_envelope.get("failure") if isinstance(latest_envelope, dict) else {}
    classification = failure.get("execution_classification") if isinstance(failure, dict) else None
    if not isinstance(classification, str) or classification not in EXECUTION_FAILURE_CLASSIFICATIONS:
        classification = "unknown"
    summary = failure.get("execution_summary") if isinstance(failure, dict) else latest_attempt.get("summary")
    latest_attempt_id = latest_envelope.get("attempt_id") if isinstance(latest_envelope, dict) else None
    latest_attempt_result = latest_envelope.get("result") if isinstance(latest_envelope, dict) else None
    attempt_count = len(current_attempts)
    retry_count = max(0, attempt_count - 1)
    if latest_attempt.get("freshness") == "stale":
        status = "stale"
    elif attempt_count <= 1 and classification == "none":
        status = "not_applicable"
    else:
        status = "present"
    return {
        "schema_version": RETRY_EVIDENCE_SCHEMA,
        "status": status,
        "attempt_count": attempt_count,
        "retry_count": retry_count,
        "latest_attempt_id": latest_attempt_id if isinstance(latest_attempt_id, str) and latest_attempt_id else None,
        "latest_attempt_result": latest_attempt_result if isinstance(latest_attempt_result, str) else None,
        "latest_failure_classification": classification,
        "latest_failure_summary": str(summary).strip() if isinstance(summary, str) and str(summary).strip() else None,
        "exhausted": classification == "retry_exhaustion",
        "scheduler_ownership": "external",
        "stale_attempt_count": len(stale_attempts),
        "provenance": provenance,
    }


def cleanup_scratch_tree(target_root: Path, scratch_dir: Path) -> None:
    shutil.rmtree(scratch_dir, ignore_errors=True)
    for candidate in (scratch_dir.parent, scratch_dir.parent.parent):
        try:
            candidate.relative_to(target_root)
        except ValueError:
            continue
        try:
            candidate.rmdir()
        except OSError:
            pass


def gh_json(root: Path, args: list[str]) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        result = run_process(["gh", *args], root, timeout_seconds=20)
    except FileNotFoundError:
        return None, ["gh command is unavailable in PATH"]
    except subprocess.TimeoutExpired:
        return None, [f"gh {' '.join(args)} timed out after 20s"]
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "gh command failed"
        return None, [detail]
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return None, [f"invalid JSON from gh {' '.join(args)}: {exc.msg}"]
    if not isinstance(payload, dict):
        return None, [f"gh {' '.join(args)} did not return a JSON object"]
    return payload, []


def gh_rest_json(root: Path, path: str) -> tuple[dict[str, Any] | None, list[str]]:
    payload, errors = gh_json(root, ["api", path])
    if payload is not None or not errors:
        return payload, errors
    fallback_payload, fallback_errors = github_public_rest_json(path)
    if fallback_payload is not None:
        return fallback_payload, []
    return None, errors + [f"public REST fallback: {message}" for message in fallback_errors]


def github_public_rest_json(path: str) -> tuple[dict[str, Any] | None, list[str]]:
    url = f"https://api.github.com/{path.lstrip('/')}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "loom-governance-runtime",
    }
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=20) as response:
            text = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        return None, [f"HTTP {exc.code} {exc.reason}: {detail or url}"]
    except URLError as exc:
        return None, [f"REST request failed: {exc.reason}"]
    except OSError as exc:
        return None, [f"REST request failed: {exc}"]
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        return None, [f"invalid JSON from public REST endpoint: {exc.msg}"]
    if not isinstance(payload, dict):
        return None, ["public REST endpoint did not return a JSON object"]
    return payload, []


def github_public_rest_list(path: str) -> tuple[list[dict[str, Any]], list[str]]:
    url = f"https://api.github.com/{path.lstrip('/')}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "loom-governance-runtime",
    }
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=20) as response:
            text = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        return [], [f"HTTP {exc.code} {exc.reason}: {detail or url}"]
    except URLError as exc:
        return [], [f"REST request failed: {exc.reason}"]
    except OSError as exc:
        return [], [f"REST request failed: {exc}"]
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        return [], [f"invalid JSON from public REST endpoint: {exc.msg}"]
    if not isinstance(payload, list):
        return [], ["public REST endpoint did not return a list"]
    return [entry for entry in payload if isinstance(entry, dict)], []


def github_issue_state(value: Any) -> str:
    return str(value or "unknown").upper()


def github_pr_state(payload: dict[str, Any]) -> str:
    if payload.get("merged_at"):
        return "MERGED"
    return str(payload.get("state") or "unknown").upper()


def normalize_rest_issue(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": payload.get("node_id"),
        "databaseId": payload.get("id"),
        "number": payload.get("number"),
        "state": github_issue_state(payload.get("state")),
        "title": payload.get("title"),
        "body": payload.get("body"),
        "url": payload.get("html_url"),
    }


def normalize_rest_pr(payload: dict[str, Any]) -> dict[str, Any]:
    head = payload.get("head") if isinstance(payload.get("head"), dict) else {}
    base = payload.get("base") if isinstance(payload.get("base"), dict) else {}
    merge_commit_sha = payload.get("merge_commit_sha")
    return {
        "number": payload.get("number"),
        "state": github_pr_state(payload),
        "title": payload.get("title"),
        "body": payload.get("body"),
        "url": payload.get("html_url"),
        "isDraft": bool(payload.get("draft")),
        "mergedAt": payload.get("merged_at"),
        "mergeCommit": {"oid": merge_commit_sha} if isinstance(merge_commit_sha, str) and merge_commit_sha else None,
        "mergeStateStatus": str(payload.get("mergeable_state")).upper() if payload.get("mergeable_state") else None,
        "headRefName": head.get("ref"),
        "headRefOid": head.get("sha"),
        "baseRefName": base.get("ref"),
    }


def github_issue_payload(root: Path, owner: str, repo_name: str, issue_number: int) -> tuple[dict[str, Any] | None, list[str]]:
    payload, errors = gh_rest_json(root, f"repos/{owner}/{repo_name}/issues/{issue_number}")
    if errors or payload is None:
        return None, errors
    return normalize_rest_issue(payload), []


def github_pr_payload(root: Path, owner: str, repo_name: str, pr_number: int) -> tuple[dict[str, Any] | None, list[str]]:
    payload, errors = gh_rest_json(root, f"repos/{owner}/{repo_name}/pulls/{pr_number}")
    if errors or payload is None:
        return None, errors
    return normalize_rest_pr(payload), []


def github_branch_payload(root: Path, owner: str, repo_name: str, branch_name: str) -> tuple[dict[str, Any] | None, list[str]]:
    payload, errors = gh_rest_json(root, f"repos/{owner}/{repo_name}/branches/{quote(branch_name, safe='')}")
    if errors or payload is None:
        return None, errors
    commit = payload.get("commit") if isinstance(payload.get("commit"), dict) else {}
    return {
        "name": payload.get("name") or branch_name,
        "protected": bool(payload.get("protected")),
        "commit": {"sha": commit.get("sha")} if isinstance(commit.get("sha"), str) else None,
    }, []


def gh_json_list(root: Path, args: list[str], key: str) -> tuple[list[dict[str, Any]], list[str]]:
    payload, errors = gh_json(root, args)
    if errors or payload is None:
        return [], errors
    value = payload.get(key)
    if not isinstance(value, list):
        return [], [f"gh {' '.join(args)} is missing `{key}`"]
    return [entry for entry in value if isinstance(entry, dict)], []


def gh_graphql(root: Path, query: str, variables: dict[str, Any]) -> tuple[dict[str, Any] | None, list[str]]:
    args = ["api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        args.extend(["-F", f"{key}={value}"])
    payload, errors = gh_json(root, args)
    if errors or payload is None:
        return None, errors
    data = payload.get("data")
    if not isinstance(data, dict):
        return None, ["gh api graphql is missing `data`"]
    return data, []


def graphql_budget_guard(scope: str, errors: list[str] | None = None) -> dict[str, Any]:
    return {
        "graphql_only": True,
        "budget_scope": scope,
        "status": "unavailable" if errors else "guarded",
        "errors": list(errors or []),
        "fallback_to": "manual-reconciliation" if errors else None,
        "recommended_action": (
            "Retry this GraphQL-only host read with explicit operator intent, or continue with REST-backed issue/PR evidence when ProjectV2/native sub-issue data is not required."
            if errors
            else "Use this GraphQL-only host read sparingly; high-frequency repo, issue, and PR reads must stay on REST."
        ),
    }


def git_dirty_entries(root: Path) -> list[dict[str, str]]:
    result = run_git(root, ["status", "--porcelain=v1"])
    if result is None or result.returncode != 0:
        return []

    entries: list[dict[str, str]] = []
    for line in result.stdout.splitlines():
        if not line:
            continue
        status = line[:2]
        remainder = line[3:]
        path_text = remainder.split(" -> ", 1)[-1].strip()
        if not path_text:
            continue
        entries.append({"status": status, "path": path_text})
    return entries


def git_tracked_files(root: Path, relative: str) -> list[str]:
    result = run_git(root, ["ls-files", "--", relative])
    if result is None or result.returncode != 0:
        return []
    return [line for line in result.stdout.splitlines() if line.strip()]


def relative_to_root(path: Path, root: Path) -> str:
    return str(path.resolve().relative_to(root.resolve()))


def resolve_workspace_path(target_root: Path, workspace_entry: str) -> tuple[Path | None, list[str]]:
    errors: list[str] = []
    if not workspace_entry.strip():
        return None, ["missing workspace entry locator"]
    raw = Path(workspace_entry)
    if raw.is_absolute():
        resolved = raw.resolve()
    else:
        resolved = (target_root / raw).resolve()
    try:
        resolved.relative_to(target_root.resolve())
    except ValueError:
        return None, [f"workspace entry escapes target root: {workspace_entry}"]
    return resolved, errors


def current_cwd_relative(target_root: Path) -> str | None:
    cwd = Path.cwd().resolve()
    try:
        return str(cwd.relative_to(target_root.resolve()))
    except ValueError:
        return None


def update_markdown_bullet(path: Path, label: str, value: str) -> None:
    pattern = re.compile(rf"(?m)^- {re.escape(label)}:\s*.*$")
    replacement = f"- {label}: {value}"
    text = path.read_text(encoding="utf-8")
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"unable to update `{label}` in {path}")
    path.write_text(updated, encoding="utf-8")


def replace_markdown_section(path: Path, section_name: str, new_lines: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"(?ms)(^## {re.escape(section_name)}\n\n)(.*?)(?=^## |\Z)"
    )
    replacement = "\\1" + "\n".join(new_lines).rstrip() + "\n\n"
    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"unable to update `{section_name}` in {path}")
    path.write_text(updated, encoding="utf-8")


def render_status_surface(report: dict[str, Any], runtime_evidence: dict[str, dict[str, Any]]) -> str:
    facts = report["facts"]
    status_path = report["fact_chain"]["entry_points"]["status_surface"]
    return (
        "# Current Status\n\n"
        "## Derived Fact Chain View\n\n"
        f"- Item ID: {facts['item_id']['value']}\n"
        f"- Goal: {facts['goal']['value']}\n"
        f"- Scope: {facts['scope']['value']}\n"
        f"- Execution Path: {facts['execution_path']['value']}\n"
        f"- Workspace Entry: {facts['workspace_entry']['value']}\n"
        f"- Recovery Entry: {facts['recovery_entry']['value']}\n"
        f"- Review Entry: {facts['review_entry']['value']}\n"
        f"- Validation Entry: {facts['validation_entry']['value']}\n"
        f"- Closing Condition: {facts['closing_condition']['value']}\n"
        f"- Current Checkpoint: {facts['current_checkpoint']['value']}\n"
        f"- Current Stop: {facts['current_stop']['value']}\n"
        f"- Next Step: {facts['next_step']['value']}\n"
        f"- Blockers: {facts['blockers']['value']}\n"
        f"- Latest Validation Summary: {facts['latest_validation_summary']['value']}\n"
        f"- Recovery Boundary: {facts['recovery_boundary']['value']}\n"
        f"- Current Lane: {facts['current_lane']['value']}\n\n"
        "## Runtime Evidence\n\n"
        f"- Run Entry: {runtime_evidence['run_entry']['value']}\n"
        f"- Logs Entry: {runtime_evidence['logs_entry']['value']}\n"
        f"- Diagnostics Entry: {runtime_evidence['diagnostics_entry']['value']}\n"
        f"- Verification Entry: {runtime_evidence['verification_entry']['value']}\n"
        f"- Lane Entry: {runtime_evidence['lane_entry']['value']}\n\n"
        "## Sources\n\n"
        f"- Static Truth: {report['fact_chain']['entry_points']['work_item']}\n"
        f"- Dynamic Truth: {report['fact_chain']['entry_points']['recovery_entry']}\n"
        "- Locator Truth: .loom/bootstrap/init-result.json\n"
        f"- Fact Chain CLI: {report['fact_chain']['read_entry']}\n"
    )


def sync_status_surface(target_root: Path, output_relative: str, runtime_evidence: dict[str, dict[str, Any]]) -> tuple[dict[str, Any], list[str]]:
    output_path, output_errors = resolve_repo_relative_path(target_root, output_relative, label="init-result locator")
    if output_errors:
        return {}, output_errors
    assert output_path is not None
    try:
        init_result = load_json_file(output_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return {}, [f"invalid init-result JSON: {exc}"]

    fact_chain = init_result.get("fact_chain")
    if not isinstance(fact_chain, dict):
        return {}, ["init-result is missing required section: fact_chain"]
    entry_points = fact_chain.get("entry_points")
    if not isinstance(entry_points, dict):
        return {}, ["init-result.fact_chain.entry_points must be an object"]

    work_item_ref = str(entry_points.get("work_item", ""))
    recovery_ref = str(entry_points.get("recovery_entry", ""))
    status_ref = str(entry_points.get("status_surface", ""))
    work_item_path, work_item_errors = resolve_repo_relative_path(target_root, work_item_ref, label="work item locator")
    recovery_path, recovery_errors = resolve_repo_relative_path(target_root, recovery_ref, label="recovery entry locator")
    status_path, status_errors = resolve_repo_relative_path(target_root, status_ref, label="status surface locator")
    locator_errors = [*work_item_errors, *recovery_errors, *status_errors]
    if locator_errors:
        return {}, locator_errors
    assert work_item_path is not None
    assert recovery_path is not None
    assert status_path is not None
    if not work_item_path.exists() or not recovery_path.exists():
        return {}, ["fact-chain carrier is missing during status sync"]
    work_item, work_item_errors = parse_work_item(work_item_path, target_root)
    recovery_entry, recovery_errors = parse_recovery_entry(recovery_path, target_root)
    errors = [*work_item_errors, *recovery_errors]
    if errors:
        return {}, errors
    pseudo_report = {
        "fact_chain": {
            "read_entry": str(fact_chain.get("read_entry", "python3 .loom/bin/loom_init.py fact-chain --target .")),
            "entry_points": {
                "work_item": work_item_ref,
                "recovery_entry": recovery_ref,
                "status_surface": status_ref,
            },
        },
        "facts": {
            "item_id": {"value": str(work_item["item_id"])},
            "goal": {"value": str(work_item["goal"])},
            "scope": {"value": str(work_item["scope"])},
            "execution_path": {"value": str(work_item["execution_path"])},
            "workspace_entry": {"value": str(work_item["workspace_entry"])},
            "recovery_entry": {"value": str(work_item["recovery_entry"])},
            "review_entry": {"value": str(work_item["review_entry"])},
            "validation_entry": {"value": str(work_item["validation_entry"])},
            "closing_condition": {"value": str(work_item["closing_condition"])},
            "current_checkpoint": {"value": recovery_entry["current_checkpoint"]},
            "current_stop": {"value": recovery_entry["current_stop"]},
            "next_step": {"value": recovery_entry["next_step"]},
            "blockers": {"value": recovery_entry["blockers"]},
            "latest_validation_summary": {"value": recovery_entry["latest_validation_summary"]},
            "recovery_boundary": {"value": recovery_entry["recovery_boundary"]},
            "current_lane": {"value": recovery_entry["current_lane"]},
        },
    }
    status_path.write_text(render_status_surface(pseudo_report, runtime_evidence), encoding="utf-8")
    refreshed, refresh_errors = load_fact_chain_report(target_root, output_relative)
    if refresh_errors:
        return {}, refresh_errors
    return refreshed, []


def read_runtime_evidence(target_root: Path, status_relative: str) -> tuple[dict[str, dict[str, Any]], list[str]]:
    status_path, locator_errors = resolve_repo_relative_path(target_root, status_relative, label="status surface locator")
    if locator_errors:
        return {}, locator_errors
    assert status_path is not None
    if not status_path.exists():
        return {}, [f"missing status surface: {status_relative}"]
    sections = markdown_sections(status_path)
    values, errors = parse_key_value_section(
        sections,
        "Runtime Evidence",
        {
            "Run Entry": "run_entry",
            "Logs Entry": "logs_entry",
            "Diagnostics Entry": "diagnostics_entry",
            "Verification Entry": "verification_entry",
            "Lane Entry": "lane_entry",
        },
        status_relative,
    )
    if errors:
        return {}, errors
    return {
        key: {
            "value": values[key],
            "status": "not_applicable" if values[key] == "not_applicable" else "present",
        }
        for key in RUNTIME_EVIDENCE_FIELDS
    }, []


def default_review_path(item_id: str) -> str:
    return f".loom/reviews/{item_id}.json"


def default_spec_review_path(item_id: str) -> str:
    return f".loom/reviews/{item_id}.spec.json"


def shadow_evidence_paths_for_sources(target_root: Path, source_paths: set[str]) -> set[str]:
    shadow_root = target_root / ".loom/shadow"
    if not shadow_root.exists():
        return set()

    evidence_paths: set[str] = set()
    for evidence_path in sorted(shadow_root.glob("*.json")):
        relative = evidence_path.relative_to(target_root).as_posix()
        if relative == ".loom/shadow/shadow-parity.json":
            continue
        try:
            payload = load_json_file(evidence_path)
        except (OSError, ValueError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        source_files = payload.get("source_files")
        if not isinstance(source_files, list):
            continue
        if any(isinstance(source, str) and source in source_paths for source in source_files):
            evidence_paths.add(relative)
    return evidence_paths


def allowed_post_review_carrier_paths(context: dict[str, Any], *review_paths: str) -> set[str]:
    source_paths = {
        *review_paths,
        str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"]),
        str(context["report"]["fact_chain"]["entry_points"]["status_surface"]),
    }
    allowed = {
        *source_paths,
    }
    allowed.update(shadow_evidence_paths_for_sources(context["target_root"], source_paths))
    review_shadow_root = context["target_root"] / ".loom/shadow"
    if review_shadow_root.exists():
        for evidence_path in sorted(review_shadow_root.glob("review-*.json")):
            try:
                payload = load_json_file(evidence_path)
            except (OSError, ValueError, json.JSONDecodeError):
                continue
            if isinstance(payload, dict):
                allowed.add(evidence_path.relative_to(context["target_root"]).as_posix())
    item_id = context.get("item_id")
    if isinstance(item_id, str) and item_id.strip():
        for runtime_root in OWNED_RUNTIME_EVIDENCE_ROOTS:
            item_runtime_root = context["target_root"] / runtime_root / item_id
            if item_runtime_root.exists():
                for evidence_path in sorted(path for path in item_runtime_root.rglob("*") if path.is_file()):
                    allowed.add(evidence_path.relative_to(context["target_root"]).as_posix())
    return allowed


def formal_spec_path(context: dict[str, Any]) -> str | None:
    preferred = f".loom/specs/{context['item_id']}/spec.md"
    if (context["target_root"] / preferred).exists():
        return preferred

    for artifact in context.get("associated_artifacts", []):
        if (
            isinstance(artifact, str)
            and artifact == preferred
            and (context["target_root"] / artifact).exists()
        ):
            return artifact

    fallback = context["target_root"] / ".loom/specs/INIT-0001/spec.md"
    if context["item_id"] == "INIT-0001" and fallback.exists():
        return ".loom/specs/INIT-0001/spec.md"
    return None


def formal_spec_suite_status(context: dict[str, Any]) -> tuple[dict[str, str], list[str]]:
    suite = spec_suite_paths(context)
    missing = [
        path
        for path in (suite["spec"], suite["plan"], suite["implementation_contract"])
        if not (context["target_root"] / path).is_file()
    ]
    return suite, missing


def spec_suite_paths(context: dict[str, Any]) -> dict[str, str]:
    item_id = context["item_id"]
    candidates = [
        {
            "spec": f".loom/specs/{item_id}/spec.md",
            "plan": f".loom/specs/{item_id}/plan.md",
            "implementation_contract": f".loom/specs/{item_id}/implementation-contract.md",
        },
    ]
    if item_id == "INIT-0001":
        candidates.append(
            {
                "spec": ".loom/specs/INIT-0001/spec.md",
                "plan": ".loom/specs/INIT-0001/plan.md",
                "implementation_contract": ".loom/specs/INIT-0001/implementation-contract.md",
            }
        )
    for suite in candidates:
        if (context["target_root"] / suite["spec"]).exists():
            return suite
    return candidates[0]


def review_head_binding(
    target_root: Path,
    *,
    reviewed_head: str | None,
    allowed_paths: set[str],
) -> tuple[dict[str, Any], list[str]]:
    current_head = git_head_sha(target_root)
    payload: dict[str, Any] = {
        "reviewed_head": reviewed_head,
        "current_head": current_head,
        "status": "unknown",
        "stale": None,
        "changed_paths": [],
        "disallowed_paths": [],
    }
    if not isinstance(reviewed_head, str) or not reviewed_head.strip():
        return payload, ["review artifact is missing reviewed_head"]
    if not isinstance(current_head, str) or not current_head.strip():
        return payload, ["current HEAD is unavailable"]
    if reviewed_head == current_head:
        payload["status"] = "fresh"
        payload["stale"] = False
        return payload, []

    changed_paths, head_errors = git_changed_paths(target_root, reviewed_head, current_head)
    if head_errors:
        return payload, [f"review HEAD comparison failed: {detail}" for detail in head_errors]

    payload["changed_paths"] = changed_paths
    disallowed_paths = [path for path in changed_paths if path not in allowed_paths]
    payload["disallowed_paths"] = disallowed_paths
    if changed_paths and not disallowed_paths:
        payload["status"] = "carrier-only"
        payload["stale"] = False
        return payload, []

    if disallowed_paths and len(disallowed_paths) == len(changed_paths):
        payload["status"] = "implementation-drift-only"
        payload["stale"] = True
        return payload, ["review artifact has implementation drift after review"]

    payload["status"] = "stale"
    payload["stale"] = True
    if not changed_paths:
        return payload, ["review artifact was recorded against a different HEAD"]
    return payload, ["review artifact is stale for the current HEAD"]


def spec_review_head_binding(
    context: dict[str, Any],
    *,
    reviewed_head: str | None,
    review_path: str,
) -> tuple[dict[str, Any], list[str]]:
    current_head = git_head_sha(context["target_root"])
    payload: dict[str, Any] = {
        "reviewed_head": reviewed_head,
        "current_head": current_head,
        "status": "unknown",
        "stale": None,
        "changed_paths": [],
        "spec_changed_paths": [],
    }
    if not isinstance(reviewed_head, str) or not reviewed_head.strip():
        return payload, ["review artifact is missing reviewed_head"]
    if not isinstance(current_head, str) or not current_head.strip():
        return payload, ["current HEAD is unavailable"]
    if reviewed_head == current_head:
        payload["status"] = "fresh"
        payload["stale"] = False
        return payload, []

    changed_paths, head_errors = git_changed_paths(context["target_root"], reviewed_head, current_head)
    if head_errors:
        return payload, [f"review HEAD comparison failed: {detail}" for detail in head_errors]

    suite = spec_suite_paths(context)
    watched_paths = {
        suite["spec"],
        suite["plan"],
        suite["implementation_contract"],
    }
    spec_changed_paths = [path for path in changed_paths if path in watched_paths]
    payload["changed_paths"] = changed_paths
    payload["spec_changed_paths"] = spec_changed_paths
    if spec_changed_paths:
        payload["status"] = "stale"
        payload["stale"] = True
        return payload, ["spec review is stale because the formal spec path changed after approval"]

    payload["status"] = "implementation-drift-only"
    payload["stale"] = False
    return payload, []


def review_gate_payload(
    context: dict[str, Any],
    *,
    review_path: str,
    expected_kind: str,
    gate_name: str,
    required: bool,
    path_label: str | None = None,
) -> dict[str, Any]:
    review_record, _, review_errors = load_review_record(
        context["target_root"],
        context["item_id"],
        review_path,
    )
    head_binding = {
        "reviewed_head": None,
        "current_head": git_head_sha(context["target_root"]),
        "status": "unknown",
        "stale": None,
        "changed_paths": [],
        "disallowed_paths": [],
    }
    missing_inputs: list[str] = []
    result = "pass" if required else "not_applicable"
    fallback_to: str | None = None

    if path_label is not None and not path_label.strip():
        missing_inputs.append(f"missing formal {gate_name.replace('_', ' ')} path")
        result = "block"
        fallback_to = "build"

    if review_errors:
        missing_inputs.extend(review_errors)
        result = "block"
        fallback_to = "build"
    elif review_record is None:
        if required:
            missing_inputs.append(f"missing {gate_name.replace('_', ' ')} artifact: {review_path}")
            result = "block"
            fallback_to = "build"
    else:
        if review_record.get("kind") != expected_kind:
            missing_inputs.append(
                f"{gate_name.replace('_', ' ')} artifact must declare kind `{expected_kind}`"
            )
            result = "block"
            fallback_to = "build"
        decision = review_record.get("decision")
        if decision == "allow":
            if expected_kind == "spec_review":
                binding_payload, binding_errors = spec_review_head_binding(
                    context,
                    reviewed_head=review_record.get("reviewed_head"),
                    review_path=review_path,
                )
            else:
                binding_payload, binding_errors = review_head_binding(
                    context["target_root"],
                    reviewed_head=review_record.get("reviewed_head"),
                    allowed_paths=allowed_post_review_carrier_paths(context, review_path),
                )
            head_binding = binding_payload
            if binding_errors:
                missing_inputs.extend(binding_errors)
                result = "block"
                fallback_to = "build"
        elif decision == "fallback":
            missing_inputs.append(f"{gate_name.replace('_', ' ')} decision is fallback: {review_record['summary']}")
            result = "fallback"
            fallback_to = review_record.get("fallback_to") or "build"
        else:
            missing_inputs.append(f"{gate_name.replace('_', ' ')} decision is blocking: {review_record['summary']}")
            result = "block"
            fallback_to = "build"

    summary = (
        f"{gate_name.replace('_', ' ')} is not required for the current item."
        if result == "not_applicable"
        else (
            f"{gate_name.replace('_', ' ')} is approved for the current HEAD."
            if result == "pass"
            else f"{gate_name.replace('_', ' ')} is missing, stale, or not approved."
        )
    )
    return {
        "path": review_path,
        "required": required,
        **({"formal_spec_path": path_label} if path_label is not None else {}),
        "result": result,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to,
        "record": review_record,
        "head_binding": head_binding,
    }


def spec_review_gate_payload(context: dict[str, Any]) -> dict[str, Any]:
    suite, missing_suite_paths = formal_spec_suite_status(context)
    spec_path = suite["spec"] if not missing_suite_paths else formal_spec_path(context)
    payload = review_gate_payload(
        context,
        review_path=default_spec_review_path(context["item_id"]),
        expected_kind="spec_review",
        gate_name="spec_review",
        required=not missing_suite_paths,
        path_label=spec_path,
    )
    payload["formal_spec_suite"] = suite
    if missing_suite_paths:
        payload["result"] = "block"
        payload["summary"] = "spec review is blocked until the complete formal spec suite is present."
        payload["missing_inputs"] = [
            f"missing formal spec suite file: {path}" for path in missing_suite_paths
        ] + list(payload.get("missing_inputs", []))
        payload["fallback_to"] = "build"
    return payload


def implementation_review_status_payload(context: dict[str, Any]) -> dict[str, Any]:
    review_record, review_path, review_errors = load_review_record(
        context["target_root"],
        context["item_id"],
        context["review_entry"],
    )
    missing_inputs = list(review_errors)
    head_binding = {
        "reviewed_head": None,
        "current_head": git_head_sha(context["target_root"]),
        "status": "unknown",
        "stale": None,
        "changed_paths": [],
        "disallowed_paths": [],
    }
    result = "pass"
    fallback_to: str | None = None
    if review_record is None and not review_errors:
        missing_inputs.append(f"missing implementation review artifact: {review_path}")
        result = "block"
        fallback_to = "build"
    elif review_record is not None:
        if review_record.get("kind") not in {"general_review", "code_review"}:
            missing_inputs.append("implementation review artifact must declare kind `general_review` or `code_review`")
            result = "block"
            fallback_to = "build"
        binding_payload, binding_errors = review_head_binding(
            context["target_root"],
            reviewed_head=review_record.get("reviewed_head"),
            allowed_paths=allowed_post_review_carrier_paths(context, review_path),
        )
        head_binding = binding_payload
        if binding_errors:
            missing_inputs.extend(binding_errors)
            result = "block"
            fallback_to = "build"
    if review_record is not None and review_record.get("decision") == "block":
        missing_inputs.append(f"implementation review decision is blocking: {review_record['summary']}")
        result = "block"
        fallback_to = "build"
    elif review_record is not None and review_record.get("decision") == "fallback":
        missing_inputs.append(f"implementation review decision is fallback: {review_record['summary']}")
        result = "fallback"
        fallback_to = review_record.get("fallback_to") or "build"
    return {
        "path": review_path,
        "result": result,
        "summary": (
            "implementation review is approved for the current HEAD."
            if result == "pass"
            else "implementation review is missing, stale, or not approved."
        ),
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to,
        "record": review_record,
        "head_binding": head_binding,
    }


def compat_findings_from_lists(
    *,
    decision: str | None,
    blocking_issues: list[str],
    follow_ups: list[str],
) -> list[dict[str, Any]]:
    del decision
    findings: list[dict[str, Any]] = []
    for index, summary in enumerate(blocking_issues, start=1):
        findings.append(
            {
                "id": f"compat-block-{index}",
                "summary": summary,
                "severity": "block",
                "rebuttal": None,
                "disposition": {
                    "status": "rejected",
                    "summary": "Projected from compatibility `blocking_issues`.",
                },
            }
        )
    for index, summary in enumerate(follow_ups, start=1):
        findings.append(
            {
                "id": f"compat-follow-up-{index}",
                "summary": summary,
                "severity": "warn",
                "rebuttal": None,
                "disposition": {
                    "status": "deferred",
                    "summary": "Projected from compatibility `follow_ups`.",
                },
            }
        )
    return findings


def compat_lists_from_findings(findings: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    blocking_issues: list[str] = []
    follow_ups: list[str] = []
    for finding in findings:
        summary = finding.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            continue
        if finding.get("severity") == "block":
            blocking_issues.append(summary.strip())
        elif finding.get("severity") == "warn":
            follow_ups.append(summary.strip())
    return blocking_issues, follow_ups


def normalize_review_findings(raw_findings: Any, *, relative: str) -> tuple[list[dict[str, Any]], list[str]]:
    if not isinstance(raw_findings, list):
        return [], [f"review artifact `{relative}` `findings` must be a list"]

    findings: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, finding in enumerate(raw_findings, start=1):
        if not isinstance(finding, dict):
            errors.append(f"review artifact `{relative}` findings[{index}] must be a JSON object")
            continue
        normalized = dict(finding)
        finding_id = normalized.get("id")
        summary = normalized.get("summary")
        severity = normalized.get("severity")
        rebuttal = normalized.get("rebuttal")
        disposition = normalized.get("disposition")
        if not isinstance(finding_id, str) or not finding_id.strip():
            errors.append(f"review artifact `{relative}` findings[{index}] must include non-empty `id`")
        else:
            normalized["id"] = finding_id.strip()
        if not isinstance(summary, str) or not summary.strip():
            errors.append(f"review artifact `{relative}` findings[{index}] must include non-empty `summary`")
        else:
            normalized["summary"] = summary.strip()
        if severity not in REVIEW_FINDING_SEVERITIES:
            errors.append(
                f"review artifact `{relative}` findings[{index}] severity must be one of "
                f"{', '.join(sorted(REVIEW_FINDING_SEVERITIES))}"
            )
        if rebuttal is not None:
            if not isinstance(rebuttal, str) or not rebuttal.strip():
                errors.append(f"review artifact `{relative}` findings[{index}] `rebuttal` must be null or a non-empty string")
            else:
                normalized["rebuttal"] = rebuttal.strip()
        if disposition is not None:
            if not isinstance(disposition, dict):
                errors.append(f"review artifact `{relative}` findings[{index}] `disposition` must be null or an object")
            else:
                status = disposition.get("status")
                disposition_summary = disposition.get("summary")
                if status not in REVIEW_FINDING_DISPOSITION_STATUSES:
                    errors.append(
                        f"review artifact `{relative}` findings[{index}] disposition status must be one of "
                        f"{', '.join(sorted(REVIEW_FINDING_DISPOSITION_STATUSES))}"
                    )
                if not isinstance(disposition_summary, str) or not disposition_summary.strip():
                    errors.append(
                        f"review artifact `{relative}` findings[{index}] disposition must include non-empty `summary`"
                    )
                else:
                    normalized["disposition"] = {
                        **disposition,
                        "status": status,
                        "summary": disposition_summary.strip(),
                    }
        findings.append(normalized)
    return findings, errors


def target_relative_label(target_root: Path, path: Path) -> str:
    try:
        return str(path.resolve().relative_to(target_root.resolve()))
    except ValueError:
        return str(path.resolve())


def load_findings_file(target_root: Path, findings_file: str) -> tuple[list[dict[str, Any]] | None, list[str]]:
    findings_path, locator_errors = resolve_repo_relative_path(target_root, findings_file, label="findings file locator")
    if locator_errors:
        return None, locator_errors
    assert findings_path is not None
    label = target_relative_label(target_root, findings_path)
    try:
        payload = json.loads(findings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return None, [f"invalid findings file `{label}`: {exc}"]

    if isinstance(payload, dict):
        payload = payload.get("findings")

    findings, errors = normalize_review_findings(payload, relative=label)
    if errors:
        return None, errors
    return findings, []


def repeated_blocker_key(finding: dict[str, Any]) -> str:
    finding_id = finding.get("id")
    if isinstance(finding_id, str) and finding_id.strip():
        return re.sub(r"[^a-z0-9]+", "-", finding_id.lower()).strip("-")
    summary = str(finding.get("summary", "")).lower()
    words = re.findall(r"[a-z0-9]+", summary)
    return "-".join(words[:10]) or "unknown"


def review_context_finding_entry(
    *,
    source: str,
    source_kind: str,
    reviewed_head: str | None,
    validation_summary: str | None,
    finding: dict[str, Any],
) -> dict[str, Any]:
    disposition = finding.get("disposition")
    disposition_status = disposition.get("status") if isinstance(disposition, dict) else None
    disposition_summary = disposition.get("summary") if isinstance(disposition, dict) else None
    return {
        "source": source,
        "source_kind": source_kind,
        "reviewed_head": reviewed_head,
        "validation_summary": validation_summary,
        "id": finding.get("id"),
        "summary": finding.get("summary"),
        "severity": finding.get("severity"),
        "disposition": {
            "status": disposition_status,
            "summary": disposition_summary,
        } if disposition_status or disposition_summary else None,
        "repeat_key": repeated_blocker_key(finding),
    }


def build_review_context_pack(context: dict[str, Any], review_path: str) -> dict[str, Any]:
    governance_surface = build_governance_surface(context["target_root"])
    github_control_plane = (
        governance_surface.get("github_control_plane")
        if isinstance(governance_surface, dict)
        else None
    )
    execution_budget = (
        github_control_plane.get("api_snapshot", {}).get("budget")
        if isinstance(github_control_plane, dict)
        else None
    )
    budget_risk = derive_execution_budget_risk(execution_budget)
    recent_findings: list[dict[str, Any]] = []
    review_record, _, review_errors = load_review_record(context["target_root"], context["item_id"], review_path)
    if review_record and not review_errors:
        for finding in review_record.get("findings", []):
            if isinstance(finding, dict):
                recent_findings.append(
                    review_context_finding_entry(
                        source=review_path,
                        source_kind="review_record",
                        reviewed_head=review_record.get("reviewed_head"),
                        validation_summary=review_record.get("reviewed_validation_summary"),
                        finding=finding,
                    )
                )

    runtime_history_root = context["target_root"] / ".loom/runtime/review" / context["item_id"]
    if runtime_history_root.exists():
        for findings_path in sorted(runtime_history_root.glob("*/normalized-findings.json")):
            try:
                payload = load_json_file(findings_path)
            except (OSError, ValueError, json.JSONDecodeError):
                continue
            raw_findings = payload.get("findings") if isinstance(payload, dict) else None
            findings, errors = normalize_review_findings(raw_findings, relative=relative_to_root(findings_path, context["target_root"]))
            if errors:
                continue
            metadata_path = findings_path.parent / "engine-metadata.json"
            metadata: dict[str, Any] = {}
            if metadata_path.exists():
                try:
                    loaded = load_json_file(metadata_path)
                    if isinstance(loaded, dict):
                        metadata = loaded
                except (OSError, ValueError, json.JSONDecodeError):
                    metadata = {}
            for finding in findings:
                recent_findings.append(
                    review_context_finding_entry(
                        source=relative_to_root(findings_path, context["target_root"]),
                        source_kind="normalized_findings",
                        reviewed_head=metadata.get("reviewed_head") if isinstance(metadata.get("reviewed_head"), str) else None,
                        validation_summary=metadata.get("validation_summary") if isinstance(metadata.get("validation_summary"), str) else None,
                        finding=finding,
                    )
                )

    groups: dict[str, list[dict[str, Any]]] = {}
    for finding in recent_findings:
        if finding.get("severity") == "block":
            groups.setdefault(str(finding.get("repeat_key") or "unknown"), []).append(finding)
    candidates = [
        {
            "repeat_key": key,
            "count": len(entries),
            "sources": [entry["source"] for entry in entries],
            "summaries": [entry["summary"] for entry in entries if entry.get("summary")],
            "recommended_action": "treat as a root-cause candidate before repeating another local patch",
        }
        for key, entries in sorted(groups.items())
        if len(entries) >= 2
    ]
    return {
        "schema_version": REVIEW_CONTEXT_PACK_SCHEMA,
        "item_id": context["item_id"],
        "review_path": review_path,
        "current_head": git_head_sha(context["target_root"]) or "unknown-head",
        "validation_summary": context["latest_validation_summary"],
        "history_available": bool(recent_findings),
        "history_policy": "not_applicable when no prior review record or normalized findings are available",
        "recent_findings": recent_findings[-20:],
        "budget_risk": budget_risk,
        "repeated_blocker_signal": {
            "schema_version": REPEATED_BLOCKER_SIGNAL_SCHEMA,
            "result": "present" if candidates else "absent",
            "enforcement": "advisory",
            "summary": (
                "Repeated blocker candidates are present; reviewer should classify root-cause risk."
                if candidates
                else "No repeated blocker candidates detected in available review history."
            ),
            "candidates": candidates,
        },
    }


def load_review_record(
    target_root: Path,
    item_id: str,
    review_file: str | None = None,
) -> tuple[dict[str, Any] | None, str, list[str]]:
    relative = review_file or default_review_path(item_id)
    review_path, locator_errors = resolve_repo_relative_path(target_root, relative, label="review artifact locator")
    if locator_errors:
        return None, relative, locator_errors
    assert review_path is not None
    if not review_path.exists():
        return None, relative, []
    try:
        payload = load_json_file(review_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return None, relative, [f"invalid review artifact `{relative}`: {exc}"]
    if not isinstance(payload, dict):
        return None, relative, [f"review artifact `{relative}` must be a JSON object"]
    errors: list[str] = []
    if payload.get("schema_version") != "loom-review/v1":
        errors.append(f"review artifact `{relative}` schema_version must be `loom-review/v1`")
    for field in ("item_id", "decision", "kind", "summary", "reviewer", "reviewed_head", "reviewed_validation_summary"):
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"review artifact `{relative}` is missing `{field}`")
    if payload.get("item_id") != item_id:
        errors.append(f"review artifact `{relative}` item_id does not match `{item_id}`")
    if payload.get("decision") not in REVIEW_DECISIONS:
        errors.append(f"review artifact `{relative}` decision must be one of {', '.join(sorted(REVIEW_DECISIONS))}")
    if payload.get("kind") not in REVIEW_KINDS:
        errors.append(f"review artifact `{relative}` kind must be one of {', '.join(sorted(REVIEW_KINDS))}")
    fallback_to = payload.get("fallback_to")
    if fallback_to not in {None, "admission", "build", "merge"}:
        errors.append(f"review artifact `{relative}` fallback_to must be null, admission, build, or merge")
    compatibility_lists: dict[str, list[str]] = {}
    for list_field in ("blocking_issues", "follow_ups"):
        value = payload.get(list_field)
        if value is not None and not isinstance(value, list):
            errors.append(f"review artifact `{relative}` `{list_field}` must be a list when present")
            continue
        entries: list[str] = []
        for index, entry in enumerate(value or [], start=1):
            if not isinstance(entry, str) or not entry.strip():
                errors.append(f"review artifact `{relative}` `{list_field}`[{index}] must be a non-empty string")
                continue
            entries.append(entry.strip())
        compatibility_lists[list_field] = entries

    findings_value = payload.get("findings")
    if findings_value is None:
        findings = compat_findings_from_lists(
            decision=payload.get("decision") if isinstance(payload.get("decision"), str) else None,
            blocking_issues=compatibility_lists.get("blocking_issues", []),
            follow_ups=compatibility_lists.get("follow_ups", []),
        )
    else:
        findings, finding_errors = normalize_review_findings(findings_value, relative=relative)
        errors.extend(finding_errors)

    blocking_issues, follow_ups = compat_lists_from_findings(findings)
    normalized_payload = dict(payload)
    normalized_payload["findings"] = findings
    normalized_payload["blocking_issues"] = blocking_issues
    normalized_payload["follow_ups"] = follow_ups
    return normalized_payload, relative, errors


def build_review_flow_payload(
    target_root: Path,
    output_relative: str,
    expected_item: str | None,
    *,
    operation: str = "review",
) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    steps: list[dict[str, Any]] = [
        {
            "name": "runtime-state",
            "result": runtime_state["result"],
            "summary": runtime_state["summary"],
            "missing_inputs": runtime_state["missing_inputs"],
            "fallback_to": runtime_state["fallback_to"],
        }
    ]
    if runtime_state["result"] != "pass":
        return {
            "command": "flow",
            "operation": operation,
            "result": "block",
            "summary": "flow command is blocked because the Loom runtime state is inconsistent.",
            "missing_inputs": runtime_state["missing_inputs"],
            "fallback_to": runtime_state["fallback_to"],
            "steps": steps,
            "runtime_state": runtime_state,
        }

    context, errors = load_context(target_root, output_relative, expected_item)
    if errors:
        return {
            "command": "flow",
            "operation": operation,
            "result": "block",
            "summary": "flow command could not read a valid Loom fact chain.",
            "missing_inputs": [f"fact-chain: {message}" for message in errors],
            "fallback_to": "admission",
            "steps": steps,
            "runtime_state": runtime_state,
            **fact_chain_error_contract(errors, output_relative=output_relative),
        }

    steps.append(
        {
            "name": "fact-chain",
            "result": "block" if report_blocking_failures(context["report"]) else "pass",
            "summary": (
                "fact chain is readable from a single entry."
                if not report_blocking_failures(context["report"])
                else "fact chain is readable, but provenance or derived-surface drift is blocking."
            ),
            "missing_inputs": report_blocking_messages(context["report"]),
            "fallback_to": "admission" if report_blocking_failures(context["report"]) else None,
            "blocking_failures": report_blocking_failures(context["report"]),
        }
    )

    state_payload = state_check_payload(context)
    steps.append(
        {
            "name": "state-check",
            "result": state_payload["result"],
            "summary": state_payload["summary"],
            "missing_inputs": state_payload["missing_inputs"],
            "fallback_to": state_payload["fallback_to"],
        }
    )

    runtime_fields, runtime_missing = runtime_evidence_from_report(context["report"])
    runtime_result = "pass" if not runtime_missing else "block"
    steps.append(
        {
            "name": "runtime-evidence",
            "result": runtime_result,
            "summary": (
                "runtime evidence entries are readable."
                if runtime_result == "pass"
                else "runtime evidence entries are incomplete or inconsistent."
            ),
            "missing_inputs": runtime_missing,
            "fallback_to": "admission" if runtime_missing else None,
            "runtime_evidence": runtime_fields,
        }
    )

    build_payload = checkpoint_payload("build", context)
    governance_surface = build_governance_surface(target_root)
    github_control_plane = (
        governance_surface.get("github_control_plane")
        if isinstance(governance_surface, dict)
        else None
    )
    execution_budget = (
        github_control_plane.get("api_snapshot", {}).get("budget")
        if isinstance(github_control_plane, dict)
        else None
    )
    budget_risk = derive_execution_budget_risk(execution_budget)
    surface_name = "review"
    repo_specific_requirements = repo_specific_requirements_payload(
        governance_surface.get("repo_interface"),
        target_root=target_root,
        surface=surface_name,
    )
    if operation == "spec-review":
        review_path = default_spec_review_path(context["item_id"])
        review_record, _, review_errors = load_review_record(target_root, context["item_id"], review_path)
        review_step_name = "spec-review-entry"
        review_step_result = "pass" if review_record and not review_errors else "block"
        review_step_summary = (
            "spec review artifact is readable and ready for authoring."
            if review_record and not review_errors
            else "spec review artifact is missing or invalid."
        )
        review_step_missing = review_errors or ([] if review_record else [f"missing review artifact: {review_path}"])
        review_step_fallback = "build" if (review_errors or review_record is None) else None
        review_payload = {
            "path": review_path,
            "record": review_record,
        }
        extra_steps: list[dict[str, Any]] = []
    else:
        review_path = context["review_entry"]
        review_record, _, review_errors = load_review_record(target_root, context["item_id"], review_path)
        review_payload = review_gate_payload(
            context,
            review_path=review_path,
            expected_kind=implementation_review_kind(context),
            gate_name="implementation_review",
            required=True,
        )
        spec_gate = spec_review_gate_payload(context)
        extra_steps = [
            {
                "name": "spec-review-gate",
                "result": (
                    "pass"
                    if spec_gate["result"] in {"pass", "not_applicable"}
                    else ("fallback" if spec_gate["result"] == "fallback" else "block")
                ),
                "summary": spec_gate["summary"],
                "missing_inputs": spec_gate["missing_inputs"],
                "fallback_to": spec_gate["fallback_to"],
            }
        ]
        review_step_name = "review-entry"
        review_step_result = "pass" if review_record and not review_errors else "block"
        review_step_summary = (
            "formal review artifact is readable."
            if review_record and not review_errors
            else "formal review artifact is missing or invalid."
        )
        review_step_missing = review_errors or ([] if review_record else [f"missing review artifact: {review_path}"])
        review_step_fallback = "build" if (review_errors or review_record is None) else None
    steps.extend(
        [
            {
                "name": "checkpoint-build",
                "result": build_payload["result"],
                "summary": build_payload["summary"],
                "missing_inputs": build_payload["missing_inputs"],
                "fallback_to": build_payload["fallback_to"],
            },
            *extra_steps,
            {
                "name": review_step_name,
                "result": review_step_result,
                "summary": review_step_summary,
                "missing_inputs": review_step_missing,
                "fallback_to": review_step_fallback,
            },
        ]
    )

    result = "pass"
    fallback_to: str | None = None
    for step in steps:
        step_result = step["result"]
        if step_result == "fallback":
            result = "fallback"
            fallback_to = step.get("fallback_to") or "admission"
            break
        if step_result == "block" and result == "pass":
            result = "block"
            fallback_to = step.get("fallback_to")
    if result != "block" and repo_specific_requirements["result"] == "block":
        result = "block"
        fallback_to = fallback_to or repo_specific_requirements["fallback_to"]

    if result == "block" and repo_specific_requirements["result"] == "block":
        summary = (
            "spec-review flow exposed companion-declared blocking requirements instead of pretending Loom core already covers them."
            if operation == "spec-review"
            else "review flow exposed companion-declared blocking requirements instead of pretending Loom core already covers them."
        )
    else:
        summary = (
            "spec-review flow prepared the formal spec review context and exposed the spec gate artifact."
            if operation == "spec-review" and result == "pass"
            else (
                "spec-review flow found missing spec review material or earlier blocking signals."
                if operation == "spec-review"
                else (
                    "review flow prepared the semantic review context and exposed the formal review artifact."
                    if result == "pass"
                    else "review flow found missing review material or earlier blocking signals."
                )
            )
        )

    missing_inputs: list[str] = []
    for step in steps:
        if step["result"] in {"block", "fallback"}:
            for message in step.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(message)
    if repo_specific_requirements["result"] == "block":
        for message in repo_specific_requirements.get("missing_inputs", []):
            if message not in missing_inputs:
                missing_inputs.append(message)
    recovery_readiness = report_recovery_readiness(context["report"])
    if recovery_readiness.get("result") == "block" and result == "pass":
        result = "block"
        fallback_to = fallback_to or recovery_readiness.get("fallback_to") or "admission"
        summary = f"{operation} flow rebuilt context but recovery readiness is blocking."

    return {
        "command": "flow",
        "operation": operation,
        "item": {
            "id": context["item_id"],
            "goal": context["goal"],
            "scope": context["scope"],
            "execution_path": context["execution_path"],
        },
        "result": result,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to,
        "steps": steps,
        "runtime_state": runtime_state,
        "provenance": report_provenance(context["report"]),
        "recovery_readiness": recovery_readiness,
        "blocking_failures": report_blocking_failures(context["report"]),
        "state_check": {
            "result": state_payload["result"],
            "summary": state_payload["summary"],
            "missing_inputs": state_payload["missing_inputs"],
            "fallback_to": state_payload["fallback_to"],
            "checks": state_payload["checks"],
        },
        "runtime_evidence": runtime_fields,
        "budget_risk": budget_risk,
        "build_checkpoint": {
            "result": build_payload["result"],
            "summary": build_payload["summary"],
            "missing_inputs": build_payload["missing_inputs"],
            "fallback_to": build_payload["fallback_to"],
        },
        **(
            {
                "spec_review": review_payload,
            }
            if operation == "spec-review"
            else {
                "review": {
                    "path": review_path,
                    "record": review_record,
                },
                "spec_review": spec_gate,
            }
        ),
        "repo_specific_requirements": repo_specific_requirements,
        "current_checkpoint": {
            "raw": context["current_checkpoint_raw"],
            "normalized": context["current_checkpoint"],
        },
    }


def run_default_review_engine(
    context: dict[str, Any],
    build_payload: dict[str, Any],
    review_path: str,
    engine_profile: dict[str, Any],
    *,
    review_kind: str | None = None,
    adapter_selection: dict[str, Any] | None = None,
) -> dict[str, Any]:
    reviewed_head = git_head_sha(context["target_root"]) or "unknown-head"
    selection_metadata = review_adapter_selection_metadata(
        adapter_selection
        or {
            "adapter": DEFAULT_REVIEW_ADAPTER,
            "selection_source": "explicit-or-legacy-default",
            "fallback_reason": None,
            "binding_summary": codex_app_binding_summary(
                context["target_root"],
                app_server=None,
                thread_id=None,
                thread_cwd=None,
                reviewed_head=reviewed_head,
                raw_file=None,
            ),
        },
        reviewed_head=reviewed_head,
    )
    runtime_root = review_runtime_root(context, reviewed_head)
    prompt_path = runtime_root / "prompt.txt"
    result_path = runtime_root / "engine-result.json"
    findings_path = runtime_root / "normalized-findings.json"
    metadata_path = runtime_root / "engine-metadata.json"
    context_pack_path = runtime_root / "context-pack.json"
    scratch_dir = context["target_root"] / ".loom/runtime/tmp" / "review-engine" / context["item_id"]
    context_pack = build_review_context_pack(context, review_path)
    runtime_root.mkdir(parents=True, exist_ok=True)
    write_json_file(context_pack_path, context_pack)
    prompt_text = build_default_review_prompt(
        context=context,
        build_payload=build_payload,
        runtime_fields=runtime_evidence_from_report(context["report"])[0],
        review_path=review_path,
        context_pack=context_pack,
    )
    prompt_path.write_text(prompt_text, encoding="utf-8")

    effective_kind = review_kind or default_review_kind(context)
    raw_timeout_seconds = engine_profile.get("timeout_seconds")
    timeout_seconds = int(raw_timeout_seconds) if raw_timeout_seconds is not None else None

    before_fingerprint, fingerprint_errors = git_tracked_diff_fingerprint(context["target_root"])
    if fingerprint_errors:
        cleanup_scratch_tree(context["target_root"], scratch_dir)
        return {
            "result": "block",
            "summary": "default review engine could not verify tracked-change purity before execution.",
            "missing_inputs": [f"engine preflight: {message}" for message in fingerprint_errors],
            "fallback_to": None,
            "engine": {
                "engine": DEFAULT_REVIEW_ENGINE,
                "adapter": DEFAULT_REVIEW_ADAPTER,
                "profile": engine_profile,
                "result": "block",
                "failure_reason": "runtime_conflict",
                "reviewed_head": reviewed_head,
                "evidence": {
                    "runtime_root": relative_to_root(runtime_root, context["target_root"]),
                    "prompt": relative_to_root(prompt_path, context["target_root"]),
                    "raw_result": relative_to_root(result_path, context["target_root"]),
                    "normalized_findings": relative_to_root(findings_path, context["target_root"]),
                    "metadata": relative_to_root(metadata_path, context["target_root"]),
                    "context_pack": relative_to_root(context_pack_path, context["target_root"]),
                },
            },
            "engine_metadata": selection_metadata,
        }

    scratch_dir.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    scratch_dir_text = str(scratch_dir.resolve())
    env["TMPDIR"] = scratch_dir_text
    env["TMP"] = scratch_dir_text
    env["TEMP"] = scratch_dir_text

    failure_reason: str | None = None
    failure_detail: str | None = None
    raw_payload: dict[str, Any] | None = None
    try:
        completed = subprocess.run(
            [
                DEFAULT_REVIEW_ENGINE,
                "exec",
                "-C",
                str(context["target_root"]),
                "-m",
                str(engine_profile["model"]),
                "-c",
                f"model_reasoning_effort={json.dumps(engine_profile['reasoning_effort'])}",
                "-s",
                "workspace-write",
                "--output-schema",
                str(review_engine_schema_path()),
                "-o",
                str(result_path),
                "-",
            ],
            cwd=context["target_root"],
            env=env,
            input=prompt_text,
            text=True,
            capture_output=True,
            check=False,
            timeout=timeout_seconds,
        )
    except FileNotFoundError:
        failure_reason = "engine_unavailable"
        failure_detail = f"default review engine `{DEFAULT_REVIEW_ENGINE}` is unavailable in PATH"
    except subprocess.TimeoutExpired:
        failure_reason = "runtime_conflict"
        failure_detail = f"default review engine timed out after {timeout_seconds}s"
    else:
        if completed.returncode != 0:
            failure_reason = "runtime_conflict"
            failure_detail = completed.stderr.strip() or completed.stdout.strip() or "default review engine returned a non-zero exit status"
        else:
            try:
                if result_path.exists():
                    raw_payload = load_json_file(result_path)
                elif completed.stdout.strip():
                    raw_payload = json.loads(completed.stdout)
                else:
                    failure_reason = "schema_drift"
                    failure_detail = "default review engine did not emit a structured result"
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                failure_reason = "schema_drift"
                failure_detail = f"default review engine returned invalid JSON: {exc}"

    after_fingerprint, after_errors = git_tracked_diff_fingerprint(context["target_root"])
    if after_errors and failure_reason is None:
        failure_reason = "runtime_conflict"
        failure_detail = after_errors[0]
    elif failure_reason is None and before_fingerprint != after_fingerprint:
        failure_reason = "repo_diff_detected"
        failure_detail = "default review engine modified tracked repository content"

    if failure_reason is None and raw_payload is None:
        failure_reason = "schema_drift"
        failure_detail = "default review engine did not produce a readable review result"

    engine_evidence = {
        "runtime_root": relative_to_root(runtime_root, context["target_root"]),
        "prompt": relative_to_root(prompt_path, context["target_root"]),
        "raw_result": relative_to_root(result_path, context["target_root"]),
        "normalized_findings": relative_to_root(findings_path, context["target_root"]),
        "metadata": relative_to_root(metadata_path, context["target_root"]),
        "context_pack": relative_to_root(context_pack_path, context["target_root"]),
    }

    if failure_reason is not None:
        write_json_file(
            metadata_path,
            {
                "engine": DEFAULT_REVIEW_ENGINE,
                "adapter": DEFAULT_REVIEW_ADAPTER,
                "profile": engine_profile,
                **selection_metadata,
                "context_pack": relative_to_root(context_pack_path, context["target_root"]),
                "failure_reason": failure_reason,
                "summary": failure_detail,
                "reviewed_head": reviewed_head,
            },
        )
        cleanup_scratch_tree(context["target_root"], scratch_dir)
        return {
            "result": "block",
            "summary": "default review engine failed closed before a formal review record could be authored.",
            "missing_inputs": [failure_detail or f"default review engine failed: {failure_reason}"],
            "fallback_to": None,
            "engine": {
                "engine": DEFAULT_REVIEW_ENGINE,
                "adapter": DEFAULT_REVIEW_ADAPTER,
                "profile": engine_profile,
                "result": "block",
                "failure_reason": failure_reason,
                "reviewed_head": reviewed_head,
                "evidence": engine_evidence,
            },
            "engine_metadata": selection_metadata,
        }

    if raw_payload is not None and not result_path.exists():
        write_json_file(result_path, raw_payload)

    normalized_payload, normalization_errors = normalize_engine_review_result(
        raw_payload,
        relative=relative_to_root(result_path, context["target_root"]),
    )
    if normalization_errors or normalized_payload is None:
        write_json_file(
            metadata_path,
            {
                "engine": DEFAULT_REVIEW_ENGINE,
                "adapter": DEFAULT_REVIEW_ADAPTER,
                "profile": engine_profile,
                **selection_metadata,
                "context_pack": relative_to_root(context_pack_path, context["target_root"]),
                "failure_reason": "schema_drift",
                "summary": "normalized engine output did not satisfy Loom review schema",
                "errors": normalization_errors,
                "reviewed_head": reviewed_head,
            },
        )
        cleanup_scratch_tree(context["target_root"], scratch_dir)
        return {
            "result": "block",
            "summary": "default review engine returned a structured payload that Loom could not safely normalize.",
            "missing_inputs": normalization_errors,
            "fallback_to": None,
            "engine": {
                "engine": DEFAULT_REVIEW_ENGINE,
                "adapter": DEFAULT_REVIEW_ADAPTER,
                "profile": engine_profile,
                "result": "block",
                "failure_reason": "schema_drift",
                "reviewed_head": reviewed_head,
                "evidence": engine_evidence,
            },
            "engine_metadata": selection_metadata,
        }

    write_json_file(findings_path, {"findings": normalized_payload["findings"]})
    write_json_file(
        metadata_path,
            {
                "engine": DEFAULT_REVIEW_ENGINE,
                "adapter": DEFAULT_REVIEW_ADAPTER,
                "profile": engine_profile,
                **selection_metadata,
                "context_pack": relative_to_root(context_pack_path, context["target_root"]),
                "result": "pass",
                "reviewed_head": reviewed_head,
                "decision": normalized_payload["decision"],
                "summary": normalized_payload["summary"],
                "kind": effective_kind,
                "validation_summary": context["latest_validation_summary"],
            },
        )
    cleanup_scratch_tree(context["target_root"], scratch_dir)
    return {
        "result": "pass",
        "summary": "default review engine produced a Loom-normalized formal review draft.",
        "missing_inputs": [],
        "fallback_to": None,
        "engine": {
            "engine": DEFAULT_REVIEW_ENGINE,
            "adapter": DEFAULT_REVIEW_ADAPTER,
            "profile": engine_profile,
            "result": "pass",
            "failure_reason": None,
            "reviewed_head": reviewed_head,
            "evidence": engine_evidence,
        },
        "engine_metadata": {
            **selection_metadata,
            "context_pack": relative_to_root(context_pack_path, context["target_root"]),
            "raw_result": relative_to_root(result_path, context["target_root"]),
            "normalized_findings": relative_to_root(findings_path, context["target_root"]),
            "metadata": relative_to_root(metadata_path, context["target_root"]),
        },
        "review_record_input": {
            "decision": normalized_payload["decision"],
            "summary": normalized_payload["summary"],
            "reviewer": DEFAULT_REVIEW_ADAPTER,
            "kind": effective_kind,
            "findings_file": relative_to_root(findings_path, context["target_root"]),
            "engine_adapter": DEFAULT_REVIEW_ADAPTER,
            "engine_evidence": relative_to_root(result_path, context["target_root"]),
            "engine_profile": engine_profile,
            "context_pack": relative_to_root(context_pack_path, context["target_root"]),
            "normalized_findings": relative_to_root(findings_path, context["target_root"]),
            "budget_risk": context_pack.get("budget_risk"),
        },
    }


def render_work_item(data: dict[str, Any]) -> str:
    return (
        f"# {data['item_id']}\n\n"
        "## Static Facts\n\n"
        f"- Item ID: {data['item_id']}\n"
        f"- Goal: {data['goal']}\n"
        f"- Scope: {data['scope']}\n"
        f"- Execution Path: {data['execution_path']}\n"
        f"- Workspace Entry: {data['workspace_entry']}\n"
        f"- Recovery Entry: {data['recovery_entry']}\n"
        f"- Review Entry: {data['review_entry']}\n"
        f"- Validation Entry: {data['validation_entry']}\n"
        f"- Closing Condition: {data['closing_condition']}\n\n"
        "## Associated Artifacts\n\n"
        + "".join(f"- `{artifact}`\n" for artifact in data["associated_artifacts"])
    )


def render_recovery_entry(item_id: str, values: dict[str, str]) -> str:
    return (
        f"# {item_id} Progress\n\n"
        "## Dynamic Facts\n\n"
        f"- Item ID: {item_id}\n"
        f"- Current Checkpoint: {values['current_checkpoint']}\n"
        f"- Current Stop: {values['current_stop']}\n"
        f"- Next Step: {values['next_step']}\n"
        f"- Blockers: {values['blockers']}\n"
        f"- Latest Validation Summary: {values['latest_validation_summary']}\n"
        f"- Recovery Boundary: {values['recovery_boundary']}\n"
        f"- Current Lane: {values['current_lane']}\n\n"
        "## Execution Ledger\n\n"
        "- Ledger Binding: recovery_entry\n"
        "- Plan Locator: not_applicable\n"
        "- Acceptance Locator: not_applicable\n"
        "- Validation Evidence Locator: not_applicable\n"
        "- Handoff Notes Locator: not_applicable\n"
        "- Evidence Freshness: not_applicable\n"
    )


def check_pr_template(target_root: Path) -> tuple[dict[str, Any], list[str]]:
    path = target_root / ".github/PULL_REQUEST_TEMPLATE.md"
    if not path.exists():
        return {"exists": False, "path": ".github/PULL_REQUEST_TEMPLATE.md", "sections": {}}, ["missing PR template"]

    text = path.read_text(encoding="utf-8")
    sections = {section: (section in text) for section in PR_TEMPLATE_SECTIONS}
    missing = [f"PR template missing section: {section}" for section, present in sections.items() if not present]
    return {
        "exists": True,
        "path": ".github/PULL_REQUEST_TEMPLATE.md",
        "sections": sections,
    }, missing


def render_adoption_pr_body(context: dict[str, Any]) -> str:
    item_id = context["item_id"]
    review_record = context["review_entry"]
    spec_review_record = default_spec_review_path(item_id)
    return (
        "## Summary\n\n"
        f"- Problem: Adopt Loom governance carriers for `{item_id}`.\n"
        "- Scope: Loom-owned carrier and review metadata only.\n\n"
        "## Validation\n\n"
        "- [x] Verified by Loom adoption round-trip.\n\n"
        "## Risks And Follow-ups\n\n"
        "- Risks: None identified by the generated adoption body.\n"
        "- Follow-ups: Keep repo-specific gates repo-owned.\n\n"
        "## Related Work\n\n"
        f"- Issue: {item_id}\n"
        f"- Spec / plan: .loom/specs/{item_id}/spec.md\n\n"
        "## Review Artifacts\n\n"
        f"- Active Work Item: {context['report']['fact_chain']['entry_points']['work_item']}\n"
        f"- Active Recovery Entry: {context['report']['fact_chain']['entry_points']['recovery_entry']}\n"
        f"- Status Surface: {context['report']['fact_chain']['entry_points']['status_surface']}\n"
        f"- Review Record: {review_record}\n"
        f"- Spec Review Record: {spec_review_record}\n"
    )


def adoption_pr_body_sections(body: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in body.splitlines():
        if line.startswith("## "):
            current = line.strip()
            sections[current] = []
            continue
        if current is not None:
            sections[current].append(line.rstrip())
    return {section: "\n".join(lines).strip() for section, lines in sections.items()}


def parse_review_artifact_locators(section: str) -> tuple[dict[str, str], list[str]]:
    locators: dict[str, str] = {}
    errors: list[str] = []
    for raw_line in section.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        match = re.match(r"^- ([^:]+):\s*(.+?)\s*$", stripped)
        if not match:
            errors.append(f"invalid Review Artifacts bullet: {stripped}")
            continue
        label = match.group(1).strip()
        value = match.group(2).strip().strip("`")
        if label in locators:
            errors.append(f"duplicate Review Artifacts field: {label}")
            continue
        locators[label] = value
    for label in ADOPTION_REVIEW_ARTIFACT_LABELS:
        if label not in locators:
            errors.append(f"Review Artifacts missing `{label}`")
    return locators, errors


def validate_adoption_pr_body(body: str, *, target_root: Path) -> dict[str, Any]:
    sections = adoption_pr_body_sections(body)
    missing_sections = [section for section in ADOPTION_PR_BODY_SECTIONS if section not in sections]
    missing_inputs: list[str] = [f"PR body missing section: {section}" for section in missing_sections]
    artifact_section = sections.get("## Review Artifacts", "")
    locators, locator_errors = parse_review_artifact_locators(artifact_section)
    missing_inputs.extend(locator_errors)

    locator_status: dict[str, dict[str, Any]] = {}
    for label, locator in locators.items():
        path, errors = resolve_repo_relative_path(target_root, locator, label=f"Review Artifacts `{label}`")
        exists = bool(path and path.exists() and path.is_file())
        if errors:
            missing_inputs.extend(errors)
        elif not exists:
            missing_inputs.append(f"Review Artifacts `{label}` points to missing file: {locator}")
        locator_status[label] = {
            "locator": locator,
            "status": "present" if exists and not errors else "missing",
        }

    return {
        "result": "pass" if not missing_inputs else "block",
        "missing_inputs": missing_inputs,
        "sections": {section: section in sections for section in ADOPTION_PR_BODY_SECTIONS},
        "review_artifacts": locator_status,
    }


def judgment_closure_payload(
    target_root: Path,
    decisions: dict[str, Any],
    companion_generation: dict[str, Any],
    governance_surface: dict[str, Any],
) -> dict[str, Any]:
    missing_inputs: list[str] = []
    required_fields = {"id", "question", "source_locator", "reasoning", "write_targets", "verification_commands", "status"}
    for judgment in decisions.get("judgments", []):
        if not isinstance(judgment, dict):
            missing_inputs.append("judgment is not an object")
            continue
        missing = sorted(required_fields - set(judgment))
        if missing:
            missing_inputs.append(f"judgment `{judgment.get('id')}` missing fields: {', '.join(missing)}")
        for target in judgment.get("write_targets", []):
            if not isinstance(target, str):
                missing_inputs.append(f"judgment `{judgment.get('id')}` has non-string write target")
                continue
            path, errors = resolve_repo_relative_path(target_root, target, label=f"judgment `{judgment.get('id')}` write target")
            missing_inputs.extend(errors)
            if path is not None and not path.exists():
                missing_inputs.append(f"judgment `{judgment.get('id')}` write target missing: {target}")
        if not judgment.get("verification_commands"):
            missing_inputs.append(f"judgment `{judgment.get('id')}` missing verification commands")
    repo_interface = governance_surface.get("repo_interface")
    if isinstance(repo_interface, dict) and repo_interface.get("availability") not in {"present", "absent"}:
        missing_inputs.extend(f"repo_interface: {message}" for message in repo_interface.get("missing_inputs", []))
    repo_interop = governance_surface.get("repo_interop")
    if isinstance(repo_interop, dict) and repo_interop.get("availability") not in {"present", "absent"}:
        missing_inputs.extend(f"repo_interop: {message}" for message in repo_interop.get("missing_inputs", []))
    if companion_generation.get("result") != "pass":
        missing_inputs.extend(str(message) for message in companion_generation.get("missing_inputs", []))
    return {
        "result": "pass" if not missing_inputs else "block",
        "summary": (
            "adoption judgments have source locators, reasoning, write targets, and verification evidence."
            if not missing_inputs
            else "adoption judgment closure is incomplete."
        ),
        "missing_inputs": list(dict.fromkeys(missing_inputs)),
    }


def local_command_json(target_root: Path, args: list[str]) -> tuple[dict[str, Any] | None, list[str]]:
    result = run_process([sys.executable, str(Path(__file__)), *args], target_root)
    if not result.stdout.strip():
        detail = result.stderr.strip() or "command produced no JSON output"
        return None, [detail]
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return None, [f"invalid JSON from {' '.join(args)}: {exc.msg}"]
    if not isinstance(payload, dict):
        return None, [f"{' '.join(args)} did not return a JSON object"]
    return payload, []


def generated_companion_consumption_payload(
    target_root: Path,
    expected_item: str | None,
    governance_surface: dict[str, Any],
) -> dict[str, Any]:
    missing_inputs: list[str] = []
    repo_interface = governance_surface.get("repo_interface")
    repo_interop = governance_surface.get("repo_interop")
    governance_status = "pass"
    if not isinstance(repo_interface, dict) or repo_interface.get("availability") != "present":
        governance_status = "block"
        missing_inputs.append("governance_surface did not consume generated repo companion interface")
    if not isinstance(repo_interop, dict) or repo_interop.get("availability") != "present":
        governance_status = "block"
        missing_inputs.append("governance_surface did not consume generated repo interop contract")

    item_args = ["--item", expected_item] if expected_item else []
    review_payload, review_errors = local_command_json(
        target_root,
        ["flow", "review", "--target", str(target_root), *item_args],
    )
    merge_payload, merge_errors = local_command_json(
        target_root,
        ["flow", "merge-ready", "--target", str(target_root), *item_args],
    )
    shadow_payload, shadow_errors = local_command_json(
        target_root,
        ["shadow-parity", "--target", str(target_root)],
    )

    def flow_consumption(payload: dict[str, Any] | None, errors: list[str], *, surface: str) -> dict[str, Any]:
        if errors or payload is None:
            return {"status": "block", "missing_inputs": errors or [f"{surface} flow did not return JSON"]}
        requirements = payload.get("repo_specific_requirements")
        if not isinstance(requirements, dict):
            return {
                "status": "block",
                "result": payload.get("result"),
                "missing_inputs": [f"{surface} flow did not expose repo_specific_requirements"],
            }
        if requirements.get("source_locator") != ".loom/companion/repo-interface.json":
            return {
                "status": "block",
                "result": payload.get("result"),
                "repo_specific_requirements": requirements,
                "missing_inputs": [f"{surface} flow did not consume .loom/companion/repo-interface.json"],
            }
        return {
            "status": "pass" if payload.get("result") == "pass" else "consumed",
            "result": payload.get("result"),
            "summary": payload.get("summary"),
            "repo_specific_requirements": requirements,
            "missing_inputs": [],
        }

    review = flow_consumption(review_payload, review_errors, surface="review")
    merge_ready = flow_consumption(merge_payload, merge_errors, surface="merge_ready")
    if shadow_errors or shadow_payload is None:
        shadow_parity = {"status": "block", "missing_inputs": shadow_errors or ["shadow parity did not return JSON"]}
    else:
        reports = shadow_payload.get("reports")
        shadow_missing = list(shadow_payload.get("missing_inputs", [])) if isinstance(shadow_payload.get("missing_inputs"), list) else []
        if shadow_payload.get("result") != "pass":
            shadow_missing.append(f"shadow parity result was {shadow_payload.get('result')}")
        if not isinstance(reports, list) or not reports:
            shadow_parity = {
                "status": "block",
                "result": shadow_payload.get("result"),
                "missing_inputs": ["shadow parity did not expose per-surface reports"],
            }
        elif shadow_missing:
            shadow_parity = {
                "status": "block",
                "result": shadow_payload.get("result"),
                "summary": shadow_payload.get("summary"),
                "missing_inputs": shadow_missing,
            }
        else:
            report_rows = [
                {
                    "surface": report.get("surface"),
                    "result": report.get("result"),
                    "loom_locator": report.get("loom_surface", {}).get("locator") if isinstance(report.get("loom_surface"), dict) else None,
                    "repo_locator": report.get("repo_surface", {}).get("locator") if isinstance(report.get("repo_surface"), dict) else None,
                }
                for report in reports
                if isinstance(report, dict)
            ]
            report_missing = [
                f"shadow parity surface {row.get('surface')} did not match"
                for row in report_rows
                if row.get("result") != "match"
            ]
            shadow_parity = {
                "status": "pass" if not report_missing else "block",
                "result": shadow_payload.get("result"),
                "summary": shadow_payload.get("summary"),
                "reports": report_rows,
                "missing_inputs": report_missing,
            }

    for label, entry in (("review", review), ("merge_ready", merge_ready), ("shadow_parity", shadow_parity)):
        if entry.get("status") not in {"pass", "consumed"}:
            for message in entry.get("missing_inputs", []):
                missing_inputs.append(f"{label}: {message}")

    return {
        "schema_version": "loom-generated-companion-consumption/v1",
        "result": "pass" if not missing_inputs else "block",
        "summary": "generated companion and interop carriers were consumed through governance_surface, review, merge-ready, and shadow parity.",
        "missing_inputs": missing_inputs,
        "governance_surface": {
            "status": governance_status,
            "repo_interface_availability": repo_interface.get("availability") if isinstance(repo_interface, dict) else None,
            "repo_interop_availability": repo_interop.get("availability") if isinstance(repo_interop, dict) else None,
        },
        "review": review,
        "merge_ready": merge_ready,
        "shadow_parity": shadow_parity,
    }


def active_workspace_conflicts(target_root: Path, item_id: str, workspace_entry: str) -> list[str]:
    work_items_dir = target_root / ".loom/work-items"
    if not work_items_dir.exists():
        return []

    conflicts: list[str] = []
    for candidate in sorted(work_items_dir.glob("*.md")):
        try:
            parsed_item, errors = parse_work_item(candidate, target_root)
        except OSError:
            continue
        if errors:
            continue
        other_item_id = str(parsed_item["item_id"])
        if other_item_id == item_id:
            continue
        if str(parsed_item["workspace_entry"]) != workspace_entry:
            continue
        recovery_rel = str(parsed_item["recovery_entry"])
        recovery_path, recovery_errors = resolve_repo_relative_path(
            target_root,
            recovery_rel,
            label="work item recovery entry locator",
        )
        if recovery_errors or recovery_path is None:
            conflicts.append(other_item_id)
            continue
        if not recovery_path.exists():
            conflicts.append(other_item_id)
            continue
        try:
            recovery_data, recovery_errors = parse_recovery_entry(recovery_path, target_root)
        except OSError:
            conflicts.append(other_item_id)
            continue
        if recovery_errors:
            conflicts.append(other_item_id)
            continue
        if normalize_checkpoint(recovery_data["current_checkpoint"]) not in TERMINAL_CHECKPOINTS:
            conflicts.append(other_item_id)
    return conflicts


def collect_temp_paths(target_root: Path) -> list[Path]:
    paths: list[Path] = []
    for relative in OWNED_TEMP_ROOTS:
        candidate = target_root / relative
        if candidate.exists():
            paths.append(candidate)
    return paths


def cleanup_candidates(target_root: Path) -> tuple[list[Path], list[str]]:
    candidates: list[Path] = []
    unsafe: list[str] = []
    for temp_root in collect_temp_paths(target_root):
        if temp_root.is_file():
            unsafe.append(relative_to_root(temp_root, target_root))
            continue
        for child in sorted(temp_root.iterdir(), key=lambda path: path.name):
            marker = child / ".loom-owned" if child.is_dir() else child.with_name(f"{child.name}.loom-owned")
            if marker.exists():
                candidates.append(child)
            else:
                unsafe.append(relative_to_root(child, target_root))
    return candidates, unsafe


def path_matches_owned_roots(path: str, roots: tuple[str, ...]) -> bool:
    normalized = path.rstrip("/")
    for root in roots:
        owned_root = root.rstrip("/")
        if normalized == owned_root:
            return True
        if normalized.startswith(f"{owned_root}/"):
            return True
    return False


def owned_dirty_path_kind(target_root: Path, path: str) -> str | None:
    if path_matches_owned_roots(path, OWNED_TEMP_ROOTS):
        return "temp"
    if path_matches_owned_roots(path, OWNED_RUNTIME_EVIDENCE_ROOTS):
        return "evidence"

    normalized = path.rstrip("/")
    for root in OWNED_TEMP_ROOTS:
        candidate = target_root / root
        if candidate.exists() and root.rstrip("/").startswith(f"{normalized}/"):
            return "temp"
    for root in OWNED_RUNTIME_EVIDENCE_ROOTS:
        candidate = target_root / root
        if candidate.exists() and root.rstrip("/").startswith(f"{normalized}/"):
            return "evidence"
    return None


def dirty_paths_by_owner(target_root: Path) -> tuple[list[str], list[str]]:
    owned: list[str] = []
    foreign: list[str] = []
    for entry in git_dirty_entries(target_root):
        path = entry["path"]
        if owned_dirty_path_kind(target_root, path) == "temp":
            owned.append(path)
        else:
            foreign.append(path)
    return owned, foreign


def dirty_runtime_evidence_paths(target_root: Path) -> list[str]:
    evidence: list[str] = []
    for entry in git_dirty_entries(target_root):
        path = entry["path"]
        if owned_dirty_path_kind(target_root, path) == "evidence":
            evidence.append(path)
    return evidence


def declared_scope_paths(scope_text: str) -> list[str]:
    candidates: list[str] = []
    for raw in re.findall(r"`([^`]+)`", scope_text):
        token = raw.strip()
        if not token:
            continue
        if token.startswith("/"):
            token = token.lstrip("/")
        if token.startswith("./"):
            token = token[2:]
        if token in {".", ""}:
            continue
        if "/" not in token and not token.endswith(".md"):
            continue
        candidates.append(token.rstrip("/"))

    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        deduped.append(candidate)
    return deduped


def path_in_scope(path: str, scope_paths: list[str]) -> bool:
    return any(path == scope_path or path.startswith(f"{scope_path}/") for scope_path in scope_paths)


def load_context(target_root: Path, output_relative: str, expected_item: str | None) -> tuple[dict[str, Any], list[str]]:
    report, errors = load_fact_chain_report(target_root, output_relative)
    if errors:
        return {}, errors

    item_id = report["fact_chain"]["entry_points"]["current_item_id"]
    if expected_item and expected_item != item_id:
        return {}, [f"current item mismatch: expected `{expected_item}`, got `{item_id}`"]

    facts = report["facts"]
    workspace_entry = str(facts["workspace_entry"]["value"])
    workspace_path, workspace_errors = resolve_workspace_path(target_root, workspace_entry)
    if workspace_errors:
        return {}, workspace_errors
    if workspace_path is None:
        return {}, [f"unable to resolve workspace entry: {workspace_entry}"]

    work_item_path, work_item_errors = resolve_repo_relative_path(
        target_root,
        str(report["fact_chain"]["entry_points"]["work_item"]),
        label="work item locator",
    )
    recovery_path, recovery_errors = resolve_repo_relative_path(
        target_root,
        str(report["fact_chain"]["entry_points"]["recovery_entry"]),
        label="recovery entry locator",
    )
    status_path, status_errors = resolve_repo_relative_path(
        target_root,
        str(report["fact_chain"]["entry_points"]["status_surface"]),
        label="status surface locator",
    )
    locator_errors = [*work_item_errors, *recovery_errors, *status_errors]
    if locator_errors:
        return {}, locator_errors
    assert work_item_path is not None
    assert recovery_path is not None
    assert status_path is not None

    context = {
        "target_root": target_root,
        "output_relative": output_relative,
        "report": report,
        "item_id": item_id,
        "work_item_path": work_item_path,
        "recovery_path": recovery_path,
        "status_path": status_path,
        "workspace_entry": workspace_entry,
        "workspace_path": workspace_path,
        "validation_entry": str(facts["validation_entry"]["value"]),
        "review_entry": str(facts["review_entry"]["value"]),
        "current_checkpoint_raw": str(facts["current_checkpoint"]["value"]),
        "current_checkpoint": normalize_checkpoint(str(facts["current_checkpoint"]["value"])),
        "goal": str(facts["goal"]["value"]),
        "scope": str(facts["scope"]["value"]),
        "execution_path": str(facts["execution_path"]["value"]),
        "associated_artifacts": list(facts["associated_artifacts"]["value"]),
        "current_stop": str(facts["current_stop"]["value"]),
        "next_step": str(facts["next_step"]["value"]),
        "blockers": str(facts["blockers"]["value"]),
        "latest_validation_summary": str(facts["latest_validation_summary"]["value"]),
        "recovery_boundary": str(facts["recovery_boundary"]["value"]),
        "current_lane": str(facts["current_lane"]["value"]),
        "closing_condition": str(facts["closing_condition"]["value"]),
        "read_entry": str(report["fact_chain"]["read_entry"]),
    }
    return context, []


def review_runtime_root(context: dict[str, Any], reviewed_head: str | None = None) -> Path:
    head = (reviewed_head or git_head_sha(context["target_root"]) or "unknown-head").strip() or "unknown-head"
    safe_head = re.sub(r"[^A-Za-z0-9_.-]", "-", head)
    return context["target_root"] / ".loom/runtime/review" / context["item_id"] / safe_head


def default_review_kind(context: dict[str, Any]) -> str:
    scope_paths = declared_scope_paths(context["scope"])
    if scope_paths and all(path.endswith(".md") or path.startswith(".loom/") for path in scope_paths):
        return "general_review"
    return "code_review"


def implementation_review_kind(context: dict[str, Any]) -> str:
    scope_paths = declared_scope_paths(context["scope"])
    if scope_paths and all(path.endswith(".md") or path.startswith(".loom/") for path in scope_paths):
        return "general_review"
    return "code_review"


def review_engine_profile_selection(context: dict[str, Any], review_kind: str) -> tuple[str, str]:
    if review_kind == "spec_review":
        return "spec-review", "spec review requires the formal spec profile instead of inheriting host defaults"
    haystack = " ".join(
        str(context.get(key, ""))
        for key in (
            "goal",
            "scope",
            "execution_path",
            "current_stop",
            "next_step",
            "blockers",
            "latest_validation_summary",
        )
    ).lower()
    high_risk_terms = (
        "security",
        "permission",
        "approval",
        "sandbox",
        "host",
        "adapter",
        "shared contract",
        "contract",
        "runtime",
        "release",
    )
    if any(term in haystack for term in high_risk_terms):
        return "high-risk", "risk terms in the active item require the high-risk formal review profile"
    if "repeated blocker" in haystack or "repeated-blocker" in haystack:
        return "repeated-blocker", "active item references repeated blocker review handling"
    return "default", "default implementation review profile for normal-risk changes"


def resolve_review_engine_profile(
    context: dict[str, Any],
    review_kind: str,
    *,
    adapter: str = DEFAULT_REVIEW_ADAPTER,
    requested_profile: str | None = None,
    requested_model: str | None = None,
    requested_reasoning: str | None = None,
    override_reason: str | None = None,
) -> tuple[dict[str, Any] | None, list[str]]:
    if adapter not in AUTHORITATIVE_REVIEW_ADAPTERS:
        return None, [f"unsupported authoritative review adapter: {adapter}"]
    selected_profile, selection_reason = review_engine_profile_selection(context, review_kind)
    if requested_profile:
        selected_profile = requested_profile
        selection_reason = f"profile override requested `{requested_profile}`"
    base_profile = dict(REVIEW_ENGINE_PROFILES[selected_profile])
    base_profile["selection_reason"] = selection_reason
    previous_profile = dict(base_profile)
    override_requested = any(value for value in (requested_profile, requested_model, requested_reasoning))
    reason = override_reason.strip() if isinstance(override_reason, str) else ""
    if override_requested and not reason:
        return None, ["review engine profile override requires --engine-override-reason"]
    if requested_model:
        base_profile["model"] = requested_model.strip()
    if requested_reasoning:
        base_profile["reasoning_effort"] = requested_reasoning
    if not isinstance(base_profile.get("model"), str) or not base_profile["model"].strip():
        return None, ["review engine profile model must be non-empty"]
    if base_profile.get("reasoning_effort") not in REVIEW_ENGINE_REASONING_EFFORTS:
        return None, ["review engine profile reasoning effort is outside the stable vocabulary"]
    resolved = {
        "schema_version": REVIEW_ENGINE_PROFILE_SCHEMA,
        "profile_id": base_profile["profile_id"],
        "adapter": adapter,
        "engine": CODEX_APP_REVIEW_ENGINE if adapter == CODEX_APP_REVIEW_ADAPTER else DEFAULT_REVIEW_ENGINE,
        "model": base_profile["model"],
        "reasoning_effort": base_profile["reasoning_effort"],
        "timeout_seconds": int(base_profile["timeout_seconds"]) if base_profile["timeout_seconds"] is not None else None,
        "context_policy": base_profile["context_policy"],
        "selection_reason": base_profile["selection_reason"],
        "override_reason": reason or None,
    }
    if override_requested:
        resolved["override"] = {
            "previous_profile": previous_profile,
            "selected_profile": {
                "profile_id": resolved["profile_id"],
                "model": resolved["model"],
                "reasoning_effort": resolved["reasoning_effort"],
                "timeout_seconds": resolved["timeout_seconds"],
                "context_policy": resolved["context_policy"],
            },
            "reason": reason,
        }
    return resolved, []


def review_focus_paths(context: dict[str, Any]) -> list[str]:
    result = run_git(context["target_root"], ["diff", "--name-only", "--no-renames", "HEAD", "--"])
    if result is not None and result.returncode == 0:
        tracked_paths = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        if tracked_paths:
            return tracked_paths
    scope_paths = declared_scope_paths(context["scope"])
    if scope_paths:
        return scope_paths
    return [relative_to_root(context["workspace_path"], context["target_root"])]


def review_engine_schema_path() -> Path:
    return shared_asset(__file__, "review/loom-review-result-schema.json")


def normalize_engine_review_result(payload: Any, *, relative: str) -> tuple[dict[str, Any] | None, list[str]]:
    if not isinstance(payload, dict):
        return None, [f"engine result `{relative}` must be a JSON object"]

    decision = payload.get("decision")
    summary = payload.get("summary")
    findings_payload = payload.get("findings")
    errors: list[str] = []
    if decision not in REVIEW_DECISIONS:
        errors.append(f"engine result `{relative}` decision must be one of {', '.join(sorted(REVIEW_DECISIONS))}")
    if not isinstance(summary, str) or not summary.strip():
        errors.append(f"engine result `{relative}` must include non-empty `summary`")
    findings, finding_errors = normalize_review_findings(findings_payload, relative=relative)
    errors.extend(finding_errors)
    if errors:
        return None, errors

    return {
        **payload,
        "decision": decision,
        "summary": summary.strip(),
        "findings": findings,
    }, []


def normalize_codex_app_review_text(raw_text: str, *, relative: str) -> tuple[dict[str, Any] | None, list[str]]:
    text = raw_text.strip()
    if not text:
        return None, [f"Codex App review raw output `{relative}` is empty"]
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, dict):
        normalized, errors = normalize_engine_review_result(parsed, relative=relative)
        if normalized is not None and not errors:
            return normalized, []

    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    summary = first_line[:240] if first_line else "Codex App review returned raw text."
    return {
        "decision": "fallback",
        "summary": "Codex App review raw output was captured as shadow evidence and normalized for comparison only.",
        "findings": [
            {
                "id": "codex-app-review-raw-output",
                "summary": summary,
                "severity": "warn",
                "rebuttal": None,
                "disposition": {
                    "status": "deferred",
                    "summary": "Shadow-only finding; formal disposition must still be authored through the single review record.",
                },
                "details": text[:4000],
            }
        ],
    }, []


def normalize_authoritative_codex_app_review_text(raw_text: str, *, relative: str) -> tuple[dict[str, Any] | None, list[str]]:
    text = raw_text.strip()
    if not text:
        return None, [f"Codex App authoritative review output `{relative}` is empty"]
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        return None, [f"Codex App authoritative review output `{relative}` must be normalized JSON: {exc}"]
    normalized, errors = normalize_engine_review_result(parsed, relative=relative)
    if errors or normalized is None:
        return None, errors
    return normalized, []


def codex_app_endpoint_socket_path(app_server: str | None) -> Path | None:
    endpoint = non_empty_str(app_server)
    if endpoint is None:
        return None
    if endpoint.startswith("unix://"):
        path_text = endpoint.removeprefix("unix://")
    elif endpoint.startswith("/"):
        path_text = endpoint
    else:
        return None
    if not path_text:
        return None
    return Path(path_text).expanduser()


def codex_app_endpoint_is_live_capable(app_server: str | None) -> bool:
    socket_path = codex_app_endpoint_socket_path(app_server)
    return socket_path is not None and socket_path.exists()


def codex_app_review_bindings_from_args_env(args: argparse.Namespace) -> dict[str, str | None]:
    app_server = non_empty_str(args.codex_app_review_app_server) or non_empty_str(os.environ.get(CODEX_APP_REVIEW_ENDPOINT_ENV))
    thread_id = (
        non_empty_str(args.codex_app_review_thread_id)
        or non_empty_str(os.environ.get(CODEX_APP_REVIEW_THREAD_ID_ENV))
        or (non_empty_str(os.environ.get(CODEX_THREAD_ID_ENV)) if app_server else None)
    )
    thread_cwd = non_empty_str(args.codex_app_review_cwd) or non_empty_str(os.environ.get(CODEX_APP_REVIEW_CWD_ENV))
    raw_file = non_empty_str(args.codex_app_review_raw_file)
    return {
        "app_server": app_server,
        "thread_id": thread_id,
        "thread_cwd": thread_cwd,
        "raw_file": raw_file,
    }


def codex_app_binding_summary(
    target_root: Path,
    *,
    app_server: str | None,
    thread_id: str | None,
    thread_cwd: str | None,
    reviewed_head: str,
    raw_file: str | None,
) -> dict[str, Any]:
    cwd_match: bool | None = None
    cwd_summary: str | None = thread_cwd
    if non_empty_str(thread_cwd):
        try:
            cwd_path = Path(str(thread_cwd)).expanduser().resolve()
        except OSError:
            cwd_match = False
        else:
            cwd_match = cwd_path == target_root
            cwd_summary = str(cwd_path)
    raw_source: str | None = None
    if non_empty_str(raw_file):
        raw_path, raw_errors = resolve_repo_relative_path(target_root, str(raw_file), label="Codex App authoritative review raw file")
        if raw_path is not None and not raw_errors:
            raw_source = relative_to_root(raw_path, target_root)
        else:
            raw_source = str(raw_file)
    return {
        "app_server": app_server,
        "thread_id": thread_id,
        "thread_cwd": cwd_summary,
        "thread_cwd_matches_target_root": cwd_match,
        "target_root": str(target_root),
        "reviewed_head": reviewed_head,
        "raw_source": raw_source,
        "live_endpoint_capable": codex_app_endpoint_is_live_capable(app_server),
    }


def select_review_adapter(
    args: argparse.Namespace,
    target_root: Path,
    *,
    reviewed_head: str,
) -> dict[str, Any]:
    bindings = codex_app_review_bindings_from_args_env(args)
    explicit_adapter = non_empty_str(args.engine_adapter)
    if explicit_adapter:
        return {
            "adapter": explicit_adapter,
            "selection_source": "explicit-cli",
            "fallback_reason": None,
            **bindings,
            "binding_summary": codex_app_binding_summary(target_root, reviewed_head=reviewed_head, **bindings),
        }

    if truthy_env("CI") or truthy_env("CODEX_CI"):
        return {
            "adapter": DEFAULT_REVIEW_ADAPTER,
            "selection_source": "headless-fallback",
            "fallback_reason": "ci-or-codex-ci",
            **bindings,
            "binding_summary": codex_app_binding_summary(target_root, reviewed_head=reviewed_head, **bindings),
        }

    app_server = bindings["app_server"]
    thread_id = bindings["thread_id"]
    thread_cwd = bindings["thread_cwd"]
    raw_file = bindings["raw_file"]
    if not app_server or not thread_id or not thread_cwd:
        return {
            "adapter": DEFAULT_REVIEW_ADAPTER,
            "selection_source": "host-proof-fallback",
            "fallback_reason": "missing-codex-app-host-proof",
            **bindings,
            "binding_summary": codex_app_binding_summary(target_root, reviewed_head=reviewed_head, **bindings),
        }
    if not raw_file and not codex_app_endpoint_is_live_capable(app_server):
        return {
            "adapter": DEFAULT_REVIEW_ADAPTER,
            "selection_source": "host-proof-fallback",
            "fallback_reason": "app-server-unavailable",
            **bindings,
            "binding_summary": codex_app_binding_summary(target_root, reviewed_head=reviewed_head, **bindings),
        }
    return {
        "adapter": CODEX_APP_REVIEW_ADAPTER,
        "selection_source": "codex-app-host-default",
        "fallback_reason": None,
        **bindings,
        "binding_summary": codex_app_binding_summary(target_root, reviewed_head=reviewed_head, **bindings),
    }


def review_adapter_selection_metadata(selection: dict[str, Any], *, reviewed_head: str) -> dict[str, Any]:
    return {
        "selected_adapter": selection["adapter"],
        "selection_source": selection.get("selection_source"),
        "fallback_reason": selection.get("fallback_reason"),
        "app_server": selection.get("app_server"),
        "thread_id": selection.get("thread_id"),
        "thread_cwd": selection.get("thread_cwd"),
        "target_root": selection.get("binding_summary", {}).get("target_root")
        if isinstance(selection.get("binding_summary"), dict)
        else None,
        "reviewed_head": reviewed_head,
        "thread_target_binding": selection.get("binding_summary"),
    }


def jsonrpc_send_request(stdin: Any, *, request_id: int, method: str, params: dict[str, Any]) -> None:
    stdin.write(json.dumps({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}) + "\n")
    stdin.flush()


def jsonrpc_read_response(stdout: Any, *, request_id: int) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[str]]:
    notifications: list[dict[str, Any]] = []
    while True:
        line = stdout.readline()
        if not line:
            return None, notifications, [f"app-server closed before response id {request_id}"]
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(payload, dict):
            continue
        if payload.get("id") == request_id:
            return payload, notifications, []
        notifications.append(payload)


def find_exited_review_text(payload: Any) -> str | None:
    if isinstance(payload, dict):
        if payload.get("type") == "exitedReviewMode" and isinstance(payload.get("review"), str):
            return payload["review"]
        for value in payload.values():
            found = find_exited_review_text(value)
            if found is not None:
                return found
    elif isinstance(payload, list):
        for value in payload:
            found = find_exited_review_text(value)
            if found is not None:
                return found
    return None


def find_normalized_review_payload(payload: Any) -> dict[str, Any] | None:
    normalized, errors = normalize_engine_review_result(payload, relative="app-server turn/start output")
    if normalized is not None and not errors:
        return normalized
    if isinstance(payload, dict):
        for value in payload.values():
            found = find_normalized_review_payload(value)
            if found is not None:
                return found
    elif isinstance(payload, list):
        for value in payload:
            found = find_normalized_review_payload(value)
            if found is not None:
                return found
    return None


def app_server_proxy_command(app_server: str) -> list[str] | None:
    socket_path = codex_app_endpoint_socket_path(app_server)
    if socket_path is None:
        return None
    return ["codex", "app-server", "proxy", "--sock", str(socket_path)]


def run_codex_app_live_review(
    *,
    app_server: str,
    thread_id: str,
    reviewed_head: str,
    thread_cwd: str,
    prompt_text: str,
) -> tuple[str | None, dict[str, Any], list[str]]:
    command = app_server_proxy_command(app_server)
    if command is None:
        return None, {}, [f"unsupported Codex App review endpoint: {app_server}"]
    try:
        process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except OSError as exc:
        return None, {}, [f"Codex App review endpoint is unavailable: {exc}"]
    assert process.stdin is not None
    assert process.stdout is not None
    metadata: dict[str, Any] = {"review_target": {"type": "commit", "sha": reviewed_head}}
    try:
        jsonrpc_send_request(process.stdin, request_id=1, method="initialize", params={"clientInfo": {"name": "loom", "version": "stage3"}, "capabilities": {}})
        initialize_response, _, initialize_errors = jsonrpc_read_response(process.stdout, request_id=1)
        if initialize_errors:
            return None, metadata, initialize_errors
        if isinstance(initialize_response, dict) and isinstance(initialize_response.get("error"), dict):
            return None, metadata, [f"Codex App initialize failed: {initialize_response['error']}"]

        jsonrpc_send_request(
            process.stdin,
            request_id=2,
            method="review/start",
            params={
                "threadId": thread_id,
                "delivery": "inline",
                "target": {"type": "commit", "sha": reviewed_head},
            },
        )
        review_response, review_notifications, review_errors = jsonrpc_read_response(process.stdout, request_id=2)
        if review_errors:
            return None, metadata, review_errors
        if isinstance(review_response, dict) and isinstance(review_response.get("error"), dict):
            return None, metadata, [f"Codex App review/start failed: {review_response['error']}"]
        result = review_response.get("result") if isinstance(review_response, dict) else None
        if isinstance(result, dict):
            metadata["review_thread_id"] = result.get("reviewThreadId")
        review_text = find_exited_review_text(result) or find_exited_review_text(review_notifications)
        if not isinstance(review_text, str) or not review_text.strip():
            return None, metadata, ["Codex App review/start did not return exitedReviewMode.review"]

        parsed_review, parsed_errors = normalize_authoritative_codex_app_review_text(review_text, relative="app-server review/start output")
        if parsed_review is not None and not parsed_errors:
            metadata["normalization_source"] = "review-start-json"
            return review_text, {**metadata, "normalized": parsed_review}, []

        jsonrpc_send_request(
            process.stdin,
            request_id=3,
            method="turn/start",
            params={
                "threadId": metadata.get("review_thread_id") or thread_id,
                "cwd": thread_cwd,
                "input": [
                    {
                        "type": "text",
                        "text": (
                            "Normalize this Codex App review output into the provided JSON schema. "
                            "Return only the structured review result.\n\n"
                            f"{review_text}"
                        ),
                    }
                ],
                "outputSchema": load_json_file(review_engine_schema_path()),
            },
        )
        turn_response, turn_notifications, turn_errors = jsonrpc_read_response(process.stdout, request_id=3)
        if turn_errors:
            return review_text, metadata, turn_errors
        if isinstance(turn_response, dict) and isinstance(turn_response.get("error"), dict):
            return review_text, metadata, [f"Codex App turn/start normalization failed: {turn_response['error']}"]
        normalized = find_normalized_review_payload(turn_response.get("result") if isinstance(turn_response, dict) else None)
        if normalized is None:
            normalized = find_normalized_review_payload(turn_notifications)
        if normalized is None:
            return review_text, metadata, ["Codex App turn/start did not return a Loom review result"]
        metadata["normalization_source"] = "turn-start-output-schema"
        return review_text, {**metadata, "normalized": normalized}, []
    finally:
        try:
            process.terminate()
        except OSError:
            pass


def shadow_adapter_slug(adapter: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "-", adapter).strip("-") or "unknown-adapter"


def compare_review_findings(default_findings: list[dict[str, Any]], shadow_findings: list[dict[str, Any]]) -> dict[str, Any]:
    default_ids = {str(finding.get("id")) for finding in default_findings if isinstance(finding, dict) and finding.get("id")}
    shadow_ids = {str(finding.get("id")) for finding in shadow_findings if isinstance(finding, dict) and finding.get("id")}
    shared = sorted(default_ids & shadow_ids)
    default_only = sorted(default_ids - shadow_ids)
    shadow_only = sorted(shadow_ids - default_ids)
    result = "match" if not default_only and not shadow_only else "difference"
    return {
        "schema_version": "loom-review-shadow-diff/v1",
        "result": result,
        "summary": (
            "Shadow review findings match the default review finding ids."
            if result == "match"
            else "Shadow review findings differ from the default review finding ids."
        ),
        "default_finding_ids": sorted(default_ids),
        "shadow_finding_ids": sorted(shadow_ids),
        "shared_finding_ids": shared,
        "default_only_finding_ids": default_only,
        "shadow_only_finding_ids": shadow_only,
    }


def run_codex_app_review_shadow_adapter(
    context: dict[str, Any],
    *,
    adapter: str | None,
    raw_file: str | None,
    default_engine_payload: dict[str, Any],
) -> dict[str, Any] | None:
    if not adapter:
        return None
    reviewed_head = git_head_sha(context["target_root"]) or "unknown-head"
    runtime_root = review_runtime_root(context, reviewed_head)
    shadow_root = runtime_root / "shadow" / shadow_adapter_slug(adapter)
    raw_path = shadow_root / "raw-review.txt"
    findings_path = shadow_root / "normalized-findings.json"
    metadata_path = shadow_root / "metadata.json"
    diff_path = shadow_root / "parity-diff.json"
    evidence = {
        "runtime_root": relative_to_root(shadow_root, context["target_root"]),
        "raw_review": relative_to_root(raw_path, context["target_root"]),
        "normalized_findings": relative_to_root(findings_path, context["target_root"]),
        "metadata": relative_to_root(metadata_path, context["target_root"]),
        "parity_diff": relative_to_root(diff_path, context["target_root"]),
    }

    if adapter != CODEX_APP_REVIEW_SHADOW_ADAPTER:
        return {
            "adapter": adapter,
            "result": "unavailable",
            "summary": "Unsupported shadow review adapter.",
            "missing_inputs": [f"unsupported shadow review adapter: {adapter}"],
            "blocking": False,
            "authoritative": False,
            "evidence": evidence,
        }

    if not raw_file:
        metadata = {
            "schema_version": "loom-review-shadow-metadata/v1",
            "adapter": adapter,
            "result": "unavailable",
            "reviewed_head": reviewed_head,
            "summary": "Codex App review shadow adapter requires captured raw review text or a future live app-server runner.",
            "missing_inputs": ["--shadow-review-raw-file"],
            "authoritative": False,
        }
        shadow_root.mkdir(parents=True, exist_ok=True)
        write_json_file(metadata_path, metadata)
        return {
            "adapter": adapter,
            "result": "unavailable",
            "summary": "Codex App review shadow adapter was requested but no raw review evidence was provided.",
            "missing_inputs": ["--shadow-review-raw-file"],
            "blocking": False,
            "authoritative": False,
            "evidence": evidence,
        }

    source_path, source_errors = resolve_repo_relative_path(context["target_root"], raw_file, label="shadow review raw file")
    if source_errors or source_path is None:
        shadow_root.mkdir(parents=True, exist_ok=True)
        write_json_file(
            metadata_path,
            {
                "schema_version": "loom-review-shadow-metadata/v1",
                "adapter": adapter,
                "result": "block",
                "reviewed_head": reviewed_head,
                "missing_inputs": source_errors,
                "authoritative": False,
            },
        )
        return {
            "adapter": adapter,
            "result": "block",
            "summary": "Codex App review shadow adapter refused an unsafe raw review locator.",
            "missing_inputs": source_errors,
            "blocking": False,
            "authoritative": False,
            "evidence": evidence,
        }

    try:
        raw_text = source_path.read_text(encoding="utf-8")
    except OSError as exc:
        return {
            "adapter": adapter,
            "result": "block",
            "summary": "Codex App review shadow adapter could not read raw review evidence.",
            "missing_inputs": [f"shadow review raw file: {exc.strerror or exc}"],
            "blocking": False,
            "authoritative": False,
            "evidence": evidence,
        }

    shadow_root.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(raw_text, encoding="utf-8")
    normalized, normalization_errors = normalize_codex_app_review_text(
        raw_text,
        relative=relative_to_root(source_path, context["target_root"]),
    )
    if normalization_errors or normalized is None:
        write_json_file(
            metadata_path,
            {
                "schema_version": "loom-review-shadow-metadata/v1",
                "adapter": adapter,
                "result": "block",
                "reviewed_head": reviewed_head,
                "missing_inputs": normalization_errors,
                "raw_source": relative_to_root(source_path, context["target_root"]),
                "authoritative": False,
            },
        )
        return {
            "adapter": adapter,
            "result": "block",
            "summary": "Codex App review shadow output could not be normalized safely.",
            "missing_inputs": normalization_errors,
            "blocking": False,
            "authoritative": False,
            "evidence": evidence,
        }

    write_json_file(findings_path, {"findings": normalized["findings"]})
    default_findings: list[dict[str, Any]] = []
    review_record_input = default_engine_payload.get("review_record_input")
    if isinstance(review_record_input, dict):
        default_findings_file = review_record_input.get("findings_file")
        if isinstance(default_findings_file, str):
            loaded_findings, _ = load_findings_file(context["target_root"], default_findings_file)
            if isinstance(loaded_findings, list):
                default_findings = loaded_findings
    parity_diff = compare_review_findings(default_findings, normalized["findings"])
    write_json_file(diff_path, parity_diff)
    write_json_file(
        metadata_path,
        {
            "schema_version": "loom-review-shadow-metadata/v1",
            "adapter": adapter,
            "result": "pass",
            "reviewed_head": reviewed_head,
            "raw_source": relative_to_root(source_path, context["target_root"]),
            "normalized_findings": relative_to_root(findings_path, context["target_root"]),
            "parity_diff": relative_to_root(diff_path, context["target_root"]),
            "authoritative": False,
            "summary": normalized["summary"],
        },
    )
    return {
        "adapter": adapter,
        "result": "pass",
        "summary": "Codex App review shadow evidence was captured and normalized for comparison only.",
        "missing_inputs": [],
        "blocking": False,
        "authoritative": False,
        "evidence": evidence,
        "decision": normalized["decision"],
        "parity_diff": parity_diff,
    }


def run_codex_app_review_authoritative_adapter(
    context: dict[str, Any],
    build_payload: dict[str, Any],
    review_path: str,
    engine_profile: dict[str, Any],
    *,
    review_kind: str,
    app_server: str | None,
    thread_id: str | None,
    thread_cwd: str | None,
    raw_file: str | None,
    adapter_selection: dict[str, Any] | None = None,
) -> dict[str, Any]:
    reviewed_head = git_head_sha(context["target_root"]) or "unknown-head"
    selection_metadata = review_adapter_selection_metadata(
        adapter_selection
        or {
            "adapter": CODEX_APP_REVIEW_ADAPTER,
            "selection_source": "explicit-cli",
            "fallback_reason": None,
            "app_server": app_server,
            "thread_id": thread_id,
            "thread_cwd": thread_cwd,
            "raw_file": raw_file,
            "binding_summary": codex_app_binding_summary(
                context["target_root"],
                app_server=app_server,
                thread_id=thread_id,
                thread_cwd=thread_cwd,
                reviewed_head=reviewed_head,
                raw_file=raw_file,
            ),
        },
        reviewed_head=reviewed_head,
    )
    runtime_root = review_runtime_root(context, reviewed_head)
    raw_path = runtime_root / "engine-result.json"
    findings_path = runtime_root / "normalized-findings.json"
    metadata_path = runtime_root / "engine-metadata.json"
    context_pack_path = runtime_root / "context-pack.json"
    instructions_path = runtime_root / "prompt.txt"
    context_pack = build_review_context_pack(context, review_path)
    evidence = {
        "runtime_root": relative_to_root(runtime_root, context["target_root"]),
        "prompt": relative_to_root(instructions_path, context["target_root"]),
        "raw_result": relative_to_root(raw_path, context["target_root"]),
        "normalized_findings": relative_to_root(findings_path, context["target_root"]),
        "metadata": relative_to_root(metadata_path, context["target_root"]),
        "context_pack": relative_to_root(context_pack_path, context["target_root"]),
    }
    runtime_root.mkdir(parents=True, exist_ok=True)
    write_json_file(context_pack_path, context_pack)
    instructions_path.write_text(
        build_default_review_prompt(
            context=context,
            build_payload=build_payload,
            runtime_fields=runtime_evidence_from_report(context["report"])[0],
            review_path=review_path,
            context_pack=context_pack,
        ),
        encoding="utf-8",
    )

    missing_inputs: list[str] = []
    for label, value in (
        ("--codex-app-review-app-server", app_server),
        ("--codex-app-review-thread-id", thread_id),
        ("--codex-app-review-cwd", thread_cwd),
    ):
        if not isinstance(value, str) or not value.strip():
            missing_inputs.append(label)

    cwd_relative: str | None = None
    if isinstance(thread_cwd, str) and thread_cwd.strip():
        try:
            cwd_path = Path(thread_cwd).expanduser().resolve()
        except OSError as exc:
            missing_inputs.append(f"Codex App review cwd could not be resolved: {exc}")
        else:
            if cwd_path != context["target_root"]:
                missing_inputs.append(
                    f"Codex App review cwd `{cwd_path}` does not match target root `{context['target_root']}`"
                )
            else:
                cwd_relative = relative_to_root(cwd_path, context["target_root"])

    source_path: Path | None = None
    source_relative: str | None = None
    if isinstance(raw_file, str) and raw_file.strip():
        source_path, source_errors = resolve_repo_relative_path(
            context["target_root"],
            raw_file,
            label="Codex App authoritative review raw file",
        )
        missing_inputs.extend(source_errors)
        if source_path is not None:
            source_relative = relative_to_root(source_path, context["target_root"])
    elif not codex_app_endpoint_is_live_capable(app_server):
        missing_inputs.append("--codex-app-review-raw-file or live app-server endpoint")

    if missing_inputs:
        write_json_file(
            metadata_path,
            {
                "schema_version": "loom-review-engine-metadata/v1",
                "engine": CODEX_APP_REVIEW_ENGINE,
                "adapter": CODEX_APP_REVIEW_ADAPTER,
                "profile": engine_profile,
                **selection_metadata,
                "context_pack": relative_to_root(context_pack_path, context["target_root"]),
                "result": "block",
                "failure_reason": "runtime_conflict",
                "summary": "Codex App authoritative review adapter is missing required live binding proof.",
                "missing_inputs": missing_inputs,
                "reviewed_head": reviewed_head,
                "app_server": app_server,
                "thread_id": thread_id,
                "thread_cwd": cwd_relative or thread_cwd,
            },
        )
        return {
            "result": "block",
            "summary": "Codex App authoritative review adapter failed closed before a formal review record could be authored.",
            "missing_inputs": missing_inputs,
            "fallback_to": None,
            "engine": {
                "engine": CODEX_APP_REVIEW_ENGINE,
                "adapter": CODEX_APP_REVIEW_ADAPTER,
                "profile": engine_profile,
                "result": "block",
                "failure_reason": "runtime_conflict",
                "reviewed_head": reviewed_head,
                "evidence": evidence,
            },
            "engine_metadata": {
                **selection_metadata,
                "app_server": app_server,
                "thread_id": thread_id,
                "thread_cwd": cwd_relative or thread_cwd,
                "raw_source": source_relative,
            },
        }

    live_metadata: dict[str, Any] = {}
    if source_path is not None:
        try:
            raw_text = source_path.read_text(encoding="utf-8")
        except OSError as exc:
            raw_text = ""
            normalization_errors = [f"Codex App authoritative review raw file: {exc.strerror or exc}"]
            normalized = None
        else:
            normalized, normalization_errors = normalize_authoritative_codex_app_review_text(
                raw_text,
                relative=source_relative or str(raw_file),
            )
    else:
        raw_text, live_metadata, normalization_errors = run_codex_app_live_review(
            app_server=str(app_server),
            thread_id=str(thread_id),
            reviewed_head=reviewed_head,
            thread_cwd=str(thread_cwd),
            prompt_text=instructions_path.read_text(encoding="utf-8"),
        )
        normalized = live_metadata.get("normalized") if isinstance(live_metadata.get("normalized"), dict) else None
        if raw_text is None:
            raw_text = ""

    if normalization_errors or normalized is None:
        if raw_text:
            raw_path.write_text(raw_text, encoding="utf-8")
        write_json_file(
            metadata_path,
            {
                "schema_version": "loom-review-engine-metadata/v1",
                "engine": CODEX_APP_REVIEW_ENGINE,
                "adapter": CODEX_APP_REVIEW_ADAPTER,
                "profile": engine_profile,
                **selection_metadata,
                "context_pack": relative_to_root(context_pack_path, context["target_root"]),
                "result": "block",
                "failure_reason": "schema_drift",
                "summary": "Codex App authoritative review output did not satisfy the Loom review result schema.",
                "errors": normalization_errors,
                "reviewed_head": reviewed_head,
                "app_server": app_server,
                "thread_id": thread_id,
                "thread_cwd": cwd_relative,
                "raw_source": source_relative,
                **({"live_review": live_metadata} if live_metadata else {}),
            },
        )
        return {
            "result": "block",
            "summary": "Codex App authoritative review output could not be normalized safely.",
            "missing_inputs": normalization_errors,
            "fallback_to": None,
            "engine": {
                "engine": CODEX_APP_REVIEW_ENGINE,
                "adapter": CODEX_APP_REVIEW_ADAPTER,
                "profile": engine_profile,
                "result": "block",
                "failure_reason": "schema_drift",
                "reviewed_head": reviewed_head,
                "evidence": evidence,
            },
            "engine_metadata": {
                **selection_metadata,
                "app_server": app_server,
                "thread_id": thread_id,
                "thread_cwd": cwd_relative,
                "raw_source": source_relative,
                **({"live_review": live_metadata} if live_metadata else {}),
            },
        }

    raw_path.write_text(raw_text, encoding="utf-8")
    write_json_file(findings_path, {"findings": normalized["findings"]})
    metadata = {
        "schema_version": "loom-review-engine-metadata/v1",
        "engine": CODEX_APP_REVIEW_ENGINE,
        "adapter": CODEX_APP_REVIEW_ADAPTER,
        "profile": engine_profile,
        **selection_metadata,
        "context_pack": relative_to_root(context_pack_path, context["target_root"]),
        "result": "pass",
        "reviewed_head": reviewed_head,
        "decision": normalized["decision"],
        "summary": normalized["summary"],
        "kind": review_kind,
        "validation_summary": context["latest_validation_summary"],
        "app_server": app_server,
        "thread_id": thread_id,
        "thread_cwd": cwd_relative,
        "raw_source": source_relative,
        "raw_result": relative_to_root(raw_path, context["target_root"]),
        "normalized_findings": relative_to_root(findings_path, context["target_root"]),
        "metadata": relative_to_root(metadata_path, context["target_root"]),
        "review_thread_id": live_metadata.get("review_thread_id") if live_metadata else (thread_id if source_path is not None else None),
        **({"live_review": {key: value for key, value in live_metadata.items() if key != "normalized"}} if live_metadata else {}),
        "authority_boundary": "normalized review_record_input only; raw Codex App output remains runtime evidence",
    }
    write_json_file(metadata_path, metadata)
    return {
        "result": "pass",
        "summary": "Codex App authoritative review adapter produced a Loom-normalized formal review draft.",
        "missing_inputs": [],
        "fallback_to": None,
        "engine": {
            "engine": CODEX_APP_REVIEW_ENGINE,
            "adapter": CODEX_APP_REVIEW_ADAPTER,
            "profile": engine_profile,
            "result": "pass",
            "failure_reason": None,
            "reviewed_head": reviewed_head,
            "evidence": evidence,
        },
        "engine_metadata": metadata,
        "review_record_input": {
            "decision": normalized["decision"],
            "summary": normalized["summary"],
            "reviewer": CODEX_APP_REVIEW_ADAPTER,
            "kind": review_kind,
            "findings_file": relative_to_root(findings_path, context["target_root"]),
            "engine_adapter": CODEX_APP_REVIEW_ADAPTER,
            "engine_evidence": relative_to_root(raw_path, context["target_root"]),
            "engine_profile": engine_profile,
            "context_pack": relative_to_root(context_pack_path, context["target_root"]),
            "normalized_findings": relative_to_root(findings_path, context["target_root"]),
            "budget_risk": context_pack.get("budget_risk"),
        },
    }


def manual_review_payload(
    *,
    context: dict[str, Any],
    findings_file: str | None,
    kind: str,
    review_record_path: str,
) -> dict[str, Any]:
    command = [
        "python3",
        "tools/loom_flow.py",
        "review",
        "record",
        "--target",
        str(context["target_root"]),
        "--item",
        context["item_id"],
        "--decision",
        "<allow|block|fallback>",
        "--kind",
        kind,
        "--summary",
        "<stable review summary>",
        "--reviewer",
        "<reviewer-id>",
    ]
    if findings_file:
        command.extend(["--findings-file", findings_file])
    return {
        "summary": "If the default engine is blocked, complete formal review by writing the same review record manually.",
        "review_record_path": review_record_path,
        "findings_file": findings_file,
        "recommended_kind": kind,
        "command": command,
    }


def build_default_review_prompt(
    *,
    context: dict[str, Any],
    build_payload: dict[str, Any],
    runtime_fields: dict[str, dict[str, Any]],
    review_path: str,
    context_pack: dict[str, Any],
) -> str:
    focus_paths = review_focus_paths(context)
    is_spec_review = review_path == default_spec_review_path(context["item_id"])
    spec_path = formal_spec_path(context) if is_spec_review else None
    if spec_path and spec_path not in focus_paths:
        focus_paths = [spec_path, *focus_paths]
    workspace_path = relative_to_root(context["workspace_path"], context["target_root"])
    runtime_lines = [
        f"- {field}: {runtime_fields[field]['value']}"
        for field in RUNTIME_EVIDENCE_FIELDS
    ]
    path_lines = [f"- `{path}`" for path in focus_paths[:20]]
    if len(focus_paths) > 20:
        path_lines.append(f"- ... ({len(focus_paths) - 20} more paths omitted)")
    recent_findings = context_pack.get("recent_findings") if isinstance(context_pack.get("recent_findings"), list) else []
    recent_lines = [
        f"- {entry.get('severity')}: {entry.get('summary')} (disposition={((entry.get('disposition') or {}).get('status') if isinstance(entry.get('disposition'), dict) else None) or 'none'}, source={entry.get('source')})"
        for entry in recent_findings[:10]
        if isinstance(entry, dict)
    ]
    if not recent_lines:
        recent_lines = ["- not_applicable: no prior review findings were available."]
    repeated_signal = context_pack.get("repeated_blocker_signal") if isinstance(context_pack.get("repeated_blocker_signal"), dict) else {}
    budget_risk = context_pack.get("budget_risk") if isinstance(context_pack.get("budget_risk"), dict) else {}
    repeated_candidates = repeated_signal.get("candidates") if isinstance(repeated_signal.get("candidates"), list) else []
    repeated_lines = [
        f"- {candidate.get('repeat_key')}: count={candidate.get('count')}, sources={', '.join(str(source) for source in candidate.get('sources', []))}"
        for candidate in repeated_candidates[:10]
        if isinstance(candidate, dict)
    ]
    if not repeated_lines:
        repeated_lines = ["- absent: no repeated blocker candidate detected."]
    return "\n".join(
        [
            "你是 Loom 默认 formal reviewer。",
            "请基于当前仓库工作树做正式语义审查，并只输出符合 schema 的 JSON 结果。",
            "优先阅读当前事项直接相关的文件与差异，不要做整仓广播式探索。",
            "",
            "Loom 审查边界：",
            "- 你负责 reviewer rubric：判断方向、边界、语义正确性、风险与验证充分性。",
            "- 你不是 merge gate；不要输出 safe_to_merge、guardian verdict 或宿主按钮决策。",
            "- 你的输出只是 review evidence；最终正式真相会被回写到单一 review record。",
            "- 若阻断项成立，decision 设为 `block`；若当前输入不足以形成正式结论，decision 设为 `fallback`。",
            *(
                [
                    "- 当前任务是 spec review；必须优先判断 formal spec 是否完整、边界是否清晰、接受条件是否足以支撑后续实现 review。",
                    f"- Formal Spec Path: {spec_path}",
                ]
                if spec_path
                else []
            ),
            "",
            "当前事项：",
            f"- Item ID: {context['item_id']}",
            f"- Goal: {context['goal']}",
            f"- Scope: {context['scope']}",
            f"- Execution Path: {context['execution_path']}",
            f"- Workspace Entry: {context['workspace_entry']}",
            f"- Workspace Path: {workspace_path}",
            f"- Review Record Path: {review_path}",
            f"- Latest Validation Summary: {context['latest_validation_summary']}",
            "",
            "Build Checkpoint：",
            f"- Result: {build_payload['result']}",
            f"- Summary: {build_payload['summary']}",
            "",
            "Runtime Evidence Entrypoints：",
            *runtime_lines,
            "",
            "优先审查这些路径：",
            *path_lines,
            "",
            "Recent Review Context Pack：",
            f"- Schema: {context_pack.get('schema_version')}",
            f"- History Available: {context_pack.get('history_available')}",
            (
                "- Budget Risk: "
                f"{budget_risk.get('highest_risk', 'none')} "
                f"(status={budget_risk.get('status', 'not_applicable')}, "
                f"enforcement={budget_risk.get('enforcement', 'advisory')})"
            ),
            f"- Budget Risk Summary: {budget_risk.get('summary', 'not_applicable')}",
            f"- Repeated Blocker Signal: {repeated_signal.get('result', 'absent')} ({repeated_signal.get('enforcement', 'advisory')})",
            "Recent Findings:",
            *recent_lines,
            "Repeated Blocker Candidates:",
            *repeated_lines,
            "- 请将发现分类为 new、unresolved 或 repeated/root-cause candidate；不要在没有证据时把 repeat 自动升级成 hard gate。",
            "",
            "Findings 写作要求：",
            "- 每条 finding 必须包含 `id`、`summary`、`severity`、`rebuttal`、`disposition`。",
            "- `severity` 只允许 `warn` 或 `block`。",
            "- `disposition.status` 只允许 `accepted`、`rejected`、`deferred`。",
            "- 若没有阻断项但仍有后续动作，可输出 `warn` findings。",
            "",
            "Decision 规则：",
            "- `allow`: 当前事项已通过 formal review。",
            "- `block`: 存在明确阻断项。",
            "- `fallback`: 当前输入不足或需要先回到前序 checkpoint 再继续。",
        ]
    ).rstrip() + "\n"


def load_fact_chain_report(target_root: Path, output_relative: str) -> tuple[dict[str, Any], list[str]]:
    report, errors = inspect_fact_chain(target_root, output_relative)
    if errors and all("missing section `Runtime Evidence`" in message for message in errors):
        report, errors = inspect_fact_chain_legacy(target_root, output_relative)
    if errors:
        return {}, errors
    if not report:
        return {}, ["no fact-chain report was produced"]
    return report, []


def inspect_fact_chain_legacy(target_root: Path, output_relative: str) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    output_path, output_errors = resolve_repo_relative_path(target_root, output_relative, label="init-result locator")
    if output_errors:
        return {}, output_errors
    assert output_path is not None
    if not output_path.exists():
        return {}, [f"missing init-result: {output_relative}"]

    try:
        init_result = load_json_file(output_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return {}, [f"invalid init-result JSON: {exc}"]

    fact_chain = init_result.get("fact_chain")
    if not isinstance(fact_chain, dict):
        return {}, ["init-result is missing required section: fact_chain"]

    read_entry = fact_chain.get("read_entry")
    mode = fact_chain.get("mode")
    entry_points = fact_chain.get("entry_points")
    if not isinstance(read_entry, str) or not read_entry:
        errors.append("init-result.fact_chain.read_entry must be a non-empty string")
    if not isinstance(mode, str) or not mode:
        errors.append("init-result.fact_chain.mode must be a non-empty string")
    if not isinstance(entry_points, dict):
        errors.append("init-result.fact_chain.entry_points must be an object")
        entry_points = {}

    work_item_ref = entry_points.get("work_item")
    recovery_ref = entry_points.get("recovery_entry")
    status_ref = entry_points.get("status_surface")
    current_item_id = entry_points.get("current_item_id")
    for label, value in (
        ("work_item", work_item_ref),
        ("recovery_entry", recovery_ref),
        ("status_surface", status_ref),
        ("current_item_id", current_item_id),
    ):
        if not isinstance(value, str) or not value:
            errors.append(f"init-result.fact_chain.entry_points.{label} must be a non-empty string")
    if errors:
        return {}, errors

    work_item_path, work_item_path_errors = resolve_repo_relative_path(target_root, str(work_item_ref), label="work item locator")
    recovery_path, recovery_path_errors = resolve_repo_relative_path(target_root, str(recovery_ref), label="recovery entry locator")
    status_path, status_path_errors = resolve_repo_relative_path(target_root, str(status_ref), label="status surface locator")
    errors.extend(work_item_path_errors)
    errors.extend(recovery_path_errors)
    errors.extend(status_path_errors)
    if errors:
        return {}, errors
    assert work_item_path is not None
    assert recovery_path is not None
    assert status_path is not None
    for label, path in (
        ("work_item", work_item_path),
        ("recovery_entry", recovery_path),
        ("status_surface", status_path),
    ):
        if not path.exists():
            errors.append(f"declared fact-chain carrier is missing on disk: {label} -> {path.relative_to(target_root)}")
    if errors:
        return {}, errors

    work_item, work_item_errors = parse_work_item(work_item_path, target_root)
    recovery_entry, recovery_errors = parse_recovery_entry(recovery_path, target_root)
    status_sections = markdown_sections(status_path)
    status_values, status_errors = parse_key_value_section(
        status_sections,
        "Derived Fact Chain View",
        STATUS_FIELDS,
        str(status_path.relative_to(target_root)),
    )
    status_sources, source_errors = parse_key_value_section(
        status_sections,
        "Sources",
        STATUS_SOURCE_FIELDS,
        str(status_path.relative_to(target_root)),
    )
    errors.extend(work_item_errors)
    errors.extend(recovery_errors)
    errors.extend(status_errors)
    errors.extend(source_errors)
    if errors:
        return {}, errors

    if str(work_item["item_id"]) != str(recovery_entry["item_id"]):
        errors.append(
            "work item and recovery entry disagree on item id: "
            f"{work_item['item_id']} vs {recovery_entry['item_id']}"
        )
    if str(work_item["recovery_entry"]) != str(recovery_ref):
        errors.append(
            "work item recovery entry does not match init-result locator: "
            f"{work_item['recovery_entry']} vs {recovery_ref}"
        )
    if str(work_item["item_id"]) != str(current_item_id):
        errors.append(
            "init-result.fact_chain.entry_points.current_item_id does not match work item id: "
            f"{current_item_id} vs {work_item['item_id']}"
        )

    expected_status = {
        "item_id": str(work_item["item_id"]),
        "goal": str(work_item["goal"]),
        "scope": str(work_item["scope"]),
        "execution_path": str(work_item["execution_path"]),
        "workspace_entry": str(work_item["workspace_entry"]),
        "recovery_entry": str(work_item["recovery_entry"]),
        "review_entry": str(work_item["review_entry"]),
        "validation_entry": str(work_item["validation_entry"]),
        "closing_condition": str(work_item["closing_condition"]),
        "current_checkpoint": recovery_entry["current_checkpoint"],
        "current_stop": recovery_entry["current_stop"],
        "next_step": recovery_entry["next_step"],
        "blockers": recovery_entry["blockers"],
        "latest_validation_summary": recovery_entry["latest_validation_summary"],
        "recovery_boundary": recovery_entry["recovery_boundary"],
        "current_lane": recovery_entry["current_lane"],
    }
    for field_name, expected_value in expected_status.items():
        actual_value = status_values.get(field_name)
        if actual_value != expected_value:
            errors.append(
                "status surface mismatch for "
                f"`{field_name}`: expected `{expected_value}`, got `{actual_value}`"
            )

    expected_sources = {
        "work_item": str(work_item_ref),
        "recovery_entry": str(recovery_ref),
        "init_result": output_relative,
        "read_entry": str(read_entry),
    }
    for source_key, expected_value in expected_sources.items():
        actual_value = status_sources.get(source_key)
        if actual_value != expected_value:
            errors.append(
                "status surface source mismatch for "
                f"`{source_key}`: expected `{expected_value}`, got `{actual_value}`"
            )
    if errors:
        return {}, errors

    report = {
        "target": str(target_root),
        "fact_chain": {
            "mode": str(mode),
            "read_entry": str(read_entry),
            "entry_points": {
                "current_item_id": str(current_item_id),
                "work_item": str(work_item_ref),
                "recovery_entry": str(recovery_ref),
                "status_surface": str(status_ref),
            },
        },
        "facts": {
            "item_id": {"value": str(work_item["item_id"])},
            "goal": {"value": str(work_item["goal"])},
            "scope": {"value": str(work_item["scope"])},
            "execution_path": {"value": str(work_item["execution_path"])},
            "associated_artifacts": {"value": list(work_item["associated_artifacts"])},
            "workspace_entry": {"value": str(work_item["workspace_entry"])},
            "recovery_entry": {"value": str(work_item["recovery_entry"])},
            "review_entry": {"value": str(work_item["review_entry"])},
            "validation_entry": {"value": str(work_item["validation_entry"])},
            "closing_condition": {"value": str(work_item["closing_condition"])},
            "current_checkpoint": {"value": recovery_entry["current_checkpoint"]},
            "current_stop": {"value": recovery_entry["current_stop"]},
            "next_step": {"value": recovery_entry["next_step"]},
            "blockers": {"value": recovery_entry["blockers"]},
            "latest_validation_summary": {"value": recovery_entry["latest_validation_summary"]},
            "recovery_boundary": {"value": recovery_entry["recovery_boundary"]},
            "current_lane": {"value": recovery_entry["current_lane"]},
        },
        "runtime_evidence": {},
        "derived_status_surface": {
            "path": str(status_ref),
            "values": expected_status,
            "runtime_evidence": {},
            "sources": expected_sources,
        },
    }
    return report, []


def purity_report_from_context(context: dict[str, Any], fact_chain_errors: list[str] | None = None) -> dict[str, Any]:
    target_root = context["target_root"]
    workspace_path = context["workspace_path"]
    workspace_entry = context["workspace_entry"]
    item_id = context["item_id"]

    hard_failures: list[str] = []
    report_only: list[str] = []

    if fact_chain_errors:
        hard_failures.extend(f"fact-chain: {message}" for message in fact_chain_errors)

    if not workspace_path.exists():
        hard_failures.append(f"declared workspace entry does not exist on disk: {workspace_entry}")
    elif not workspace_path.is_dir():
        hard_failures.append(f"declared workspace entry is not a directory: {workspace_entry}")

    cwd_relative = current_cwd_relative(target_root)
    workspace_relative = relative_to_root(workspace_path, target_root)
    if cwd_relative is not None:
        if workspace_relative != "." and cwd_relative != workspace_relative and not cwd_relative.startswith(f"{workspace_relative}/"):
            hard_failures.append(
                f"current working directory is outside the declared workspace: cwd={cwd_relative}, workspace={workspace_relative}"
            )

    owned_dirty, foreign_dirty = dirty_paths_by_owner(target_root)
    evidence_dirty = dirty_runtime_evidence_paths(target_root)
    foreign_dirty = [path for path in foreign_dirty if path not in evidence_dirty]
    if foreign_dirty:
        preview = ", ".join(sorted(foreign_dirty)[:5])
        hard_failures.append(f"workspace contains untriaged residual changes: {preview}")
    if owned_dirty:
        preview = ", ".join(sorted(owned_dirty)[:5])
        hard_failures.append(f"loom-owned temporary residue is still present: {preview}")
    if evidence_dirty:
        preview = ", ".join(sorted(evidence_dirty)[:5])
        report_only.append(f"runtime review evidence is present and does not block purity on its own: {preview}")

    scope_paths = declared_scope_paths(context["scope"])
    out_of_scope_changes: list[str] = []
    if scope_paths:
        for path in foreign_dirty:
            if not path_in_scope(path, scope_paths):
                out_of_scope_changes.append(path)
        if out_of_scope_changes:
            preview = ", ".join(sorted(out_of_scope_changes)[:5])
            hard_failures.append(f"scope overflow detected: {preview}")

    conflicts = active_workspace_conflicts(target_root, item_id, workspace_entry)
    if conflicts:
        hard_failures.append(
            "workspace is bound to multiple active work items: " + ", ".join(sorted(conflicts))
        )

    branch = git_branch(target_root)
    if branch:
        report_only.append(f"branch purity is host-managed and reported via host-lifecycle: current branch `{branch}`")
    else:
        report_only.append("branch purity is host-managed and reported via host-lifecycle: no branch information available")

    report_only.append("PR purity is host-managed and reported via host-lifecycle")

    state = "failed" if hard_failures else "clean"
    return {
        "state": state,
        "workspace_entry": workspace_entry,
        "workspace_path": workspace_relative,
        "scope_assessment": {
            "mode": "constrained" if scope_paths else "unconstrained",
            "declared_paths": scope_paths,
            "out_of_scope_changes": sorted(out_of_scope_changes),
        },
        "hard_failures": hard_failures,
        "report_only": report_only,
    }


def base_workspace_payload(context: dict[str, Any], operation: str) -> dict[str, Any]:
    purity = purity_report_from_context(context)
    workspace_profile = workspace_profile_from_context(context)
    lifecycle_expectations = workspace_lifecycle_expectations(workspace_profile)
    return {
        "command": "workspace",
        "operation": operation,
        "item": {
            "id": context["item_id"],
            "goal": context["goal"],
            "scope": context["scope"],
            "execution_path": context["execution_path"],
        },
        "workspace": {
            "entry": context["workspace_entry"],
            "path": relative_to_root(context["workspace_path"], context["target_root"]),
            "exists": context["workspace_path"].exists(),
            "profile": workspace_profile,
        },
        "recovery": {
            "path": str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"]),
            "current_stop": context["current_stop"],
            "next_step": context["next_step"],
            "latest_validation_summary": context["latest_validation_summary"],
        },
        "checkpoint": {
            "raw": context["current_checkpoint_raw"],
            "normalized": context["current_checkpoint"],
        },
        "purity": purity,
        "lifecycle_expectations": lifecycle_expectations,
        "missing_inputs": [],
        "fallback_to": None,
    }


def select_workspace_profile_name(workspace_entry: str, item_id: str) -> tuple[str, str]:
    normalized = workspace_entry.strip().replace("\\", "/")
    if normalized == ".":
        return "single-workspace", "workspace_entry points at the repository root"
    if normalized.startswith(".worktrees/") or (item_id and item_id in normalized):
        return "per-item-worktree", "workspace_entry is item-scoped or under `.worktrees/`"
    return "attach-existing", "workspace_entry points at an existing repo-defined workspace"


def workspace_profile_from_context(context: dict[str, Any]) -> dict[str, Any]:
    selected, reason = select_workspace_profile_name(context["workspace_entry"], context["item_id"])
    return {
        "schema_version": "loom-workspace-profile/v1",
        "selected": selected,
        "selection_reason": reason,
        "workspace_entry": context["workspace_entry"],
        "workspace_path": relative_to_root(context["workspace_path"], context["target_root"]),
        "workspace_exists": context["workspace_path"].exists(),
        "host_worktree": {
            "ownership": "host",
            "cwd_within_repo": current_cwd_relative(context["target_root"]) or "outside_target_repo",
            "status": "host_managed",
        },
        "recommended_action": (
            "keep workspace_entry as `.` unless isolation becomes necessary"
            if selected == "single-workspace"
            else "ensure workspace, branch, Work Item, and PR bindings stay aligned"
            if selected == "per-item-worktree"
            else "keep repo-specific workspace locator declared and host lifecycle ownership external"
        ),
    }


def checkpoint_payload(stage: str, context: dict[str, Any]) -> dict[str, Any]:
    purity = purity_report_from_context(context)
    missing_inputs: list[str] = []
    result = "pass"
    fallback_to: str | None = None

    if purity["hard_failures"]:
        missing_inputs.append("purity")
        result = "fallback"
        fallback_to = "admission"

    required = {
        "admission": (
            ("goal", context["goal"]),
            ("scope", context["scope"]),
            ("execution_path", context["execution_path"]),
            ("workspace_entry", context["workspace_entry"]),
            ("recovery_entry", str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"])),
            ("validation_entry", context["validation_entry"]),
            ("closing_condition", context["closing_condition"]),
            ("current_checkpoint", context["current_checkpoint_raw"]),
            ("current_stop", context["current_stop"]),
            ("next_step", context["next_step"]),
        ),
        "build": (
            ("goal", context["goal"]),
            ("scope", context["scope"]),
            ("execution_path", context["execution_path"]),
            ("workspace_entry", context["workspace_entry"]),
            ("recovery_entry", str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"])),
            ("status_surface", str(context["report"]["fact_chain"]["entry_points"]["status_surface"])),
            ("validation_entry", context["validation_entry"]),
            ("latest_validation_summary", context["latest_validation_summary"]),
            ("current_lane", context["current_lane"]),
            ("closing_condition", context["closing_condition"]),
        ),
        "merge": (
            ("goal", context["goal"]),
            ("scope", context["scope"]),
            ("execution_path", context["execution_path"]),
            ("workspace_entry", context["workspace_entry"]),
            ("recovery_entry", str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"])),
            ("review_entry", context["review_entry"]),
            ("status_surface", str(context["report"]["fact_chain"]["entry_points"]["status_surface"])),
            ("validation_entry", context["validation_entry"]),
            ("latest_validation_summary", context["latest_validation_summary"]),
            ("current_lane", context["current_lane"]),
            ("recovery_boundary", context["recovery_boundary"]),
            ("blockers", context["blockers"]),
            ("closing_condition", context["closing_condition"]),
        ),
    }[stage]

    for label, value in required:
        if not str(value).strip():
            missing_inputs.append(label)

    current_rank = checkpoint_rank(context["current_checkpoint"])
    requested_rank = checkpoint_rank(stage)
    if context["current_checkpoint"] in TERMINAL_CHECKPOINTS:
        result = "fallback"
        fallback_to = context["current_checkpoint"]
    elif current_rank != -1 and current_rank < requested_rank:
        result = "fallback"
        fallback_to = context["current_checkpoint"]

    blocker_text = context["blockers"].strip().lower()
    if blocker_text not in {"none", "none recorded", "none recorded."}:
        result = "block" if result == "pass" else result

    pr_template: dict[str, Any] | None = None
    review_record: dict[str, Any] | None = None
    review_path: str | None = None
    spec_review: dict[str, Any] | None = None
    budget_risk: dict[str, Any] | None = None
    if stage == "merge":
        governance_surface = build_governance_surface(context["target_root"])
        github_control_plane = (
            governance_surface.get("github_control_plane")
            if isinstance(governance_surface, dict)
            else None
        )
        execution_budget = (
            github_control_plane.get("api_snapshot", {}).get("budget")
            if isinstance(github_control_plane, dict)
            else None
        )
        budget_risk = derive_execution_budget_risk(execution_budget)
        pr_template, pr_template_errors = check_pr_template(context["target_root"])
        if pr_template_errors:
            missing_inputs.extend(pr_template_errors)
            if result == "pass":
                result = "block"
        spec_review = spec_review_gate_payload(context)
        if spec_review["result"] in {"block", "fallback"}:
            missing_inputs.extend(spec_review["missing_inputs"])
            if spec_review["result"] == "fallback" and result == "pass":
                result = "fallback"
                fallback_to = spec_review["fallback_to"] or "build"
            elif result == "pass":
                result = "block"
        review_record, review_path, review_errors = load_review_record(
            context["target_root"],
            context["item_id"],
            context["review_entry"],
        )
        if review_errors:
            missing_inputs.extend(review_errors)
            if result == "pass":
                result = "block"
        elif review_record is None:
            missing_inputs.append(f"missing review artifact: {review_path}")
            if result == "pass":
                result = "block"
        else:
            decision = review_record["decision"]
            if review_record.get("reviewed_validation_summary") != context["latest_validation_summary"]:
                missing_inputs.append("review artifact does not match the latest validation summary")
                if result == "pass":
                    result = "block"
            binding_payload, binding_errors = review_head_binding(
                context["target_root"],
                reviewed_head=review_record.get("reviewed_head"),
                allowed_paths=allowed_post_review_carrier_paths(context, review_path),
            )
            review_record["head_binding"] = binding_payload
            if binding_errors:
                missing_inputs.extend(binding_errors)
                if result == "pass":
                    result = "block"
            if decision == "block":
                if result == "pass":
                    result = "block"
                missing_inputs.append(f"review decision is blocking: {review_record['summary']}")
            elif decision == "fallback":
                result = "fallback"
                fallback_to = review_record.get("fallback_to") or "build"

    if missing_inputs and result == "pass":
        result = "block"

    if result == "pass":
        summary = f"{stage} checkpoint can be consumed from the current Loom fact chain."
    elif result == "block":
        summary = f"{stage} checkpoint is missing execution material but does not require a checkpoint rollback."
    else:
        fallback_label = fallback_to or "admission"
        summary = f"{stage} checkpoint cannot proceed from the current state; fall back to `{fallback_label}`."
    if stage == "merge" and isinstance(budget_risk, dict) and budget_risk.get("status") == "present":
        summary = f"{summary} Budget risk remains advisory: {budget_risk.get('summary')}"

    payload = {
        "command": "checkpoint",
        "checkpoint": stage,
        "item": {
            "id": context["item_id"],
            "goal": context["goal"],
            "scope": context["scope"],
            "execution_path": context["execution_path"],
        },
        "workspace": {
            "entry": context["workspace_entry"],
            "path": relative_to_root(context["workspace_path"], context["target_root"]),
        },
        "recovery": {
            "path": str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"]),
            "current_checkpoint": context["current_checkpoint_raw"],
            "current_stop": context["current_stop"],
            "next_step": context["next_step"],
            "latest_validation_summary": context["latest_validation_summary"],
            "current_lane": context["current_lane"],
        },
        "review": {
            "path": context["review_entry"],
        },
        "purity": purity,
        "result": result,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to,
    }
    if pr_template is not None:
        payload["pr_template"] = pr_template
    if review_path is not None:
        payload["review"] = {
            "path": review_path,
            "record": review_record,
        }
    if spec_review is not None:
        payload["spec_review"] = spec_review
    if budget_risk is not None:
        payload["budget_risk"] = budget_risk
    return payload


def handle_checkpoint(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        return emit(
            {
                "command": "checkpoint",
                "checkpoint": args.stage,
                "result": "fallback",
                "summary": "checkpoint evaluation could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
            }
        )
    return emit(checkpoint_payload(args.stage, context))


def handle_workspace(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        return emit(
            runtime_state_block_payload(
                command="workspace",
                operation=args.operation,
                runtime_state=runtime_state,
                summary="workspace lifecycle command is blocked because the Loom runtime state is inconsistent.",
            )
        )
    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        return emit(
            {
                "command": "workspace",
                "operation": args.operation,
                "result": "block",
                "summary": "workspace lifecycle command could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
                "runtime_state": runtime_state,
            }
        )

    def emit_workspace(payload: dict[str, Any]) -> int:
        payload["runtime_state"] = runtime_state
        return emit(payload)

    payload = base_workspace_payload(context, args.operation)
    workspace_path = context["workspace_path"]
    purity = payload["purity"]

    if args.operation in {"locate", "attach"}:
        payload["result"] = "pass" if not purity["hard_failures"] else "block"
        payload["summary"] = (
            "workspace was attached by resolving an existing workspace_entry binding."
            if args.operation == "attach"
            else "workspace location was resolved from the fact chain."
        )
        if purity["hard_failures"]:
            payload["summary"] = (
                "workspace attachment resolved, but the workspace is not execution-ready."
                if args.operation == "attach"
                else "workspace location resolved, but the workspace is not execution-ready."
            )
            payload["missing_inputs"] = list(purity["hard_failures"])
        return emit_workspace(payload)

    if args.operation == "create":
        if purity["hard_failures"] and any("does not exist on disk" not in failure for failure in purity["hard_failures"]):
            payload["result"] = "block"
            payload["summary"] = "workspace creation is blocked until the current workspace state is clean."
            payload["missing_inputs"] = list(purity["hard_failures"])
            return emit_workspace(payload)

        created = False
        if not workspace_path.exists():
            workspace_path.mkdir(parents=True, exist_ok=True)
            created = True

        refreshed, refresh_errors = load_context(target_root, args.output, args.item)
        if refresh_errors:
            payload["result"] = "block"
            payload["summary"] = "workspace path was created, but the fact chain could not be reloaded."
            payload["missing_inputs"] = [f"fact-chain: {message}" for message in refresh_errors]
            return emit_workspace(payload)

        payload = base_workspace_payload(refreshed, args.operation)
        payload["created"] = created
        payload["result"] = "pass"
        payload["summary"] = "workspace semantics are established from `workspace_entry`."
        return emit_workspace(payload)

    if args.operation == "cleanup":
        owned_dirty, foreign_dirty = dirty_paths_by_owner(target_root)
        temp_paths, unsafe_temp_paths = cleanup_candidates(target_root)
        if foreign_dirty:
            payload["result"] = "block"
            payload["summary"] = "cleanup stopped because the workspace contains non-Loom changes."
            payload["missing_inputs"] = [f"non-loom residue: {path}" for path in foreign_dirty]
            return emit_workspace(payload)
        if unsafe_temp_paths:
            payload["result"] = "block"
            payload["summary"] = "cleanup stopped because a Loom temp root contains unmarked content."
            payload["missing_inputs"] = [f"unmarked temp content: {path}" for path in unsafe_temp_paths]
            payload["retained_paths"] = unsafe_temp_paths
            return emit_workspace(payload)

        removed: list[str] = []
        for temp_path in temp_paths:
            relative = relative_to_root(temp_path, target_root)
            tracked = git_tracked_files(target_root, relative)
            if tracked:
                payload["result"] = "block"
                payload["summary"] = "cleanup refused to delete tracked files from a Loom temporary path."
                payload["missing_inputs"] = [f"tracked temp path: {relative}"]
                return emit_workspace(payload)
            if temp_path.is_dir():
                shutil.rmtree(temp_path)
                removed.append(relative)
            else:
                temp_path.unlink()
                removed.append(relative)

        if owned_dirty and not removed:
            payload["result"] = "block"
            payload["summary"] = "cleanup found Loom temporary residue in git status, but no owned temp paths could be removed."
            payload["missing_inputs"] = [f"owned temp residue: {path}" for path in owned_dirty]
            return emit_workspace(payload)

        payload["removed_paths"] = removed
        payload["result"] = "pass"
        payload["summary"] = "cleanup removed Loom-owned temporary residue." if removed else "cleanup found no Loom-owned temporary residue."
        payload["purity"] = purity_report_from_context(context)
        return emit_workspace(payload)

    cleanup_payload = base_workspace_payload(context, "cleanup")
    owned_dirty, foreign_dirty = dirty_paths_by_owner(target_root)
    if foreign_dirty:
        cleanup_payload["result"] = "block"
        cleanup_payload["summary"] = "retire cannot proceed because cleanup is blocked by non-Loom changes."
        cleanup_payload["missing_inputs"] = [f"non-loom residue: {path}" for path in foreign_dirty]
        return emit_workspace(cleanup_payload)

    temp_paths, unsafe_temp_paths = cleanup_candidates(target_root)
    if unsafe_temp_paths:
        cleanup_payload["result"] = "block"
        cleanup_payload["summary"] = "retire cannot proceed because cleanup would touch unmarked temp content."
        cleanup_payload["missing_inputs"] = [f"unmarked temp content: {path}" for path in unsafe_temp_paths]
        cleanup_payload["retained_paths"] = unsafe_temp_paths
        return emit_workspace(cleanup_payload)

    for temp_path in temp_paths:
        relative = relative_to_root(temp_path, target_root)
        tracked = git_tracked_files(target_root, relative)
        if tracked:
            cleanup_payload["result"] = "block"
            cleanup_payload["summary"] = "retire cannot proceed because cleanup would need to delete tracked files."
            cleanup_payload["missing_inputs"] = [f"tracked temp path: {relative}"]
            return emit_workspace(cleanup_payload)
        if temp_path.is_dir():
            shutil.rmtree(temp_path)
        else:
            temp_path.unlink()

    update_markdown_bullet(context["recovery_path"], "Current Checkpoint", "retired")
    if context["status_path"].exists():
        update_markdown_bullet(context["status_path"], "Current Checkpoint", "retired")

    refreshed, refresh_errors = load_context(target_root, args.output, args.item)
    if refresh_errors:
        return emit(
            {
                "command": "workspace",
                "operation": "retire",
                "result": "block",
                "summary": "retire wrote `retired`, but the fact chain no longer reads cleanly.",
                "missing_inputs": [f"fact-chain: {message}" for message in refresh_errors],
                "fallback_to": "admission",
                "runtime_state": runtime_state,
            }
        )

    payload = base_workspace_payload(refreshed, "retire")
    payload["result"] = "pass"
    payload["summary"] = "workspace was retired by updating the recovery entry checkpoint to `retired`."
    payload["retired"] = True
    payload["removed_paths"] = [path for path in owned_dirty if any(path == root or path.startswith(f"{root}/") for root in OWNED_TEMP_ROOTS)]
    return emit_workspace(payload)


def handle_purity(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        return emit(
            runtime_state_block_payload(
                command="purity-check",
                runtime_state=runtime_state,
                summary="purity-check is blocked because the Loom runtime state is inconsistent.",
            )
        )
    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        payload = {
            "command": "purity-check",
            "result": "block",
            "summary": "purity-check could not read a valid Loom fact chain.",
            "missing_inputs": [f"fact-chain: {message}" for message in errors],
            "fallback_to": "admission",
            "runtime_state": runtime_state,
            "purity": {
                "state": "failed",
                "hard_failures": [f"fact-chain: {message}" for message in errors],
                "report_only": [
                    "branch purity is report-only in v1",
                    "PR purity is report-only in v1",
                ],
            },
        }
        return emit(payload)

    purity = purity_report_from_context(context)
    result = "pass" if not purity["hard_failures"] else "block"
    summary = "workspace purity is compatible with continued execution." if result == "pass" else "workspace purity requires cleanup or re-scoping before review."
    payload = {
        "command": "purity-check",
        "item": {
            "id": context["item_id"],
            "goal": context["goal"],
            "scope": context["scope"],
            "execution_path": context["execution_path"],
        },
        "workspace": {
            "entry": context["workspace_entry"],
            "path": relative_to_root(context["workspace_path"], context["target_root"]),
        },
        "checkpoint": {
            "raw": context["current_checkpoint_raw"],
            "normalized": context["current_checkpoint"],
        },
        "purity": purity,
        "result": result,
        "summary": summary,
        "missing_inputs": list(purity["hard_failures"]),
        "fallback_to": "admission" if purity["hard_failures"] else None,
        "runtime_state": runtime_state,
    }
    return emit(payload)


def handle_fact_chain(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    report, errors = load_fact_chain_report(target_root, args.output)
    if errors:
        return emit(
            {
                "command": "fact-chain",
                "result": "block",
                "summary": "fact-chain command could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
                **fact_chain_error_contract(errors, output_relative=args.output),
            }
        )

    item_id = report["fact_chain"]["entry_points"]["current_item_id"]
    if args.item and args.item != item_id:
        return emit(
            {
                "command": "fact-chain",
                "result": "block",
                "summary": "fact-chain command found an item mismatch.",
                "missing_inputs": [f"current item mismatch: expected `{args.item}`, got `{item_id}`"],
                "fallback_to": "admission",
            }
        )

    blocking_failures = report_blocking_failures(report)
    result = "block" if blocking_failures else "pass"
    return emit(
        {
            "command": "fact-chain",
            "result": result,
            "summary": (
                "fact chain can be read and validated from a single entry."
                if result == "pass"
                else "fact chain is readable, but provenance or derived-surface drift is blocking."
            ),
            "missing_inputs": report_blocking_messages(report),
            "fallback_to": "admission" if result == "block" else None,
            "provenance": report_provenance(report),
            "recovery_readiness": report_recovery_readiness(report),
            "derived_status_surface": report.get("derived_status_surface"),
            "blocking_failures": blocking_failures,
            "report": report,
        }
    )


def runtime_evidence_from_report(report: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    runtime_evidence = report.get("runtime_evidence")
    missing_inputs: list[str] = []
    fields: dict[str, Any] = {}
    if not isinstance(runtime_evidence, dict):
        missing_inputs.append("runtime_evidence is missing from fact-chain report")
        return fields, missing_inputs

    for key in RUNTIME_EVIDENCE_FIELDS:
        entry = runtime_evidence.get(key)
        if not isinstance(entry, dict):
            missing_inputs.append(f"runtime_evidence.{key} is missing")
            continue
        value = entry.get("value")
        status = entry.get("status")
        if not isinstance(value, str) or not value.strip():
            missing_inputs.append(f"runtime_evidence.{key}.value must be a non-empty string")
        if status not in {"present", "not_applicable"}:
            missing_inputs.append(f"runtime_evidence.{key}.status must be `present` or `not_applicable`")
        elif status == "present" and value == "not_applicable":
            missing_inputs.append(f"runtime_evidence.{key} is `present` but uses `not_applicable`")
        elif status == "not_applicable" and value != "not_applicable":
            missing_inputs.append(f"runtime_evidence.{key} is `not_applicable` but value is `{value}`")
        fields[key] = {
            "value": value,
            "status": status,
            "source": entry.get("source"),
        }
    return fields, missing_inputs


def report_provenance(report: dict[str, Any]) -> list[dict[str, Any]]:
    provenance = report.get("provenance")
    return provenance if isinstance(provenance, list) else []


def report_recovery_readiness(report: dict[str, Any]) -> dict[str, Any]:
    readiness = report.get("recovery_readiness")
    if isinstance(readiness, dict):
        return readiness
    return {
        "result": "block",
        "summary": "recovery readiness was not reported by the fact-chain reader.",
        "missing_inputs": ["fact-chain recovery_readiness"],
        "fallback_to": "admission",
        "checks": {},
    }


def report_execution_ledger(report: dict[str, Any]) -> dict[str, Any]:
    ledger = report.get("execution_ledger")
    if isinstance(ledger, dict):
        return ledger
    return {
        "authoritative_carrier": "recovery_entry",
        "status": "missing",
        "completeness": "missing",
        "freshness": "missing",
        "fields": {},
        "missing_fields": ["execution_ledger"],
        "forbidden_authored_fields": [],
    }


def report_blocking_failures(report: dict[str, Any]) -> list[dict[str, Any]]:
    failures = report.get("blocking_failures")
    return failures if isinstance(failures, list) else []


def report_blocking_messages(report: dict[str, Any]) -> list[str]:
    messages: list[str] = []
    for failure in report_blocking_failures(report):
        if not isinstance(failure, dict):
            continue
        message = failure.get("message") or failure.get("summary") or failure.get("kind")
        if isinstance(message, str) and message and message not in messages:
            messages.append(message)
    readiness = report_recovery_readiness(report)
    if readiness.get("result") == "block":
        for message in readiness.get("missing_inputs", []):
            if isinstance(message, str) and message not in messages:
                messages.append(message)
    return messages


def fact_chain_error_contract(
    errors: list[str],
    *,
    output_relative: str = ".loom/bootstrap/init-result.json",
) -> dict[str, Any]:
    missing_inputs = [f"fact-chain: {message}" for message in errors]
    blocking_failures = [
        {
            "category": "gate_failure",
            "kind": "fact_chain_unreadable",
            "carrier": "init_result",
            "field": "fact_chain",
            "authority": "locator_discovery",
            "message": message,
            "blocking": True,
            "fallback_to": "admission",
            "locator": output_relative,
        }
        for message in missing_inputs
    ]
    return {
        "provenance": [
            {
                "kind": "host_control_mirror",
                "carrier": "init_result",
                "field": "fact_chain",
                "authority": "locator_discovery",
                "freshness": "unreadable",
                "trusted_because": "init-result must be readable before authored truth carriers can be selected.",
                "locator": output_relative,
            }
        ],
        "recovery_readiness": {
            "result": "block",
            "status": "blocked",
            "summary": "recovery is blocked because fact-chain locator discovery failed.",
            "missing_inputs": missing_inputs,
            "fallback_to": "admission",
            "checks": {
                "locator_discovery": "block",
                "authored_work_item": "unknown",
                "authored_recovery_entry": "unknown",
                "derived_status_surface": "unknown",
                "parallel_truth": "unknown",
            },
            "authoritative_carrier": "recovery_entry",
            "authoritative_path": None,
            "parallel_truth_drift": [],
            "blocking_failures": blocking_failures,
        },
        "blocking_failures": blocking_failures,
    }


def handle_runtime_evidence(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        return emit(
            {
                "command": "runtime-evidence",
                "result": "block",
                "summary": "runtime-evidence is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": runtime_state["missing_inputs"],
                "fallback_to": runtime_state["fallback_to"],
                "runtime_state": runtime_state,
            }
        )
    report, errors = load_fact_chain_report(target_root, args.output)
    if errors:
        return emit(
            {
                "command": "runtime-evidence",
                "result": "block",
                "summary": "runtime-evidence command could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
                "runtime_state": runtime_state,
            }
        )

    item_id = report["fact_chain"]["entry_points"]["current_item_id"]
    if args.item and args.item != item_id:
        return emit(
            {
                "command": "runtime-evidence",
                "result": "block",
                "summary": "runtime-evidence command found an item mismatch.",
                "missing_inputs": [f"current item mismatch: expected `{args.item}`, got `{item_id}`"],
                "fallback_to": "admission",
                "runtime_state": runtime_state,
            }
        )

    fields, missing_inputs = runtime_evidence_from_report(report)

    result = "pass" if not missing_inputs else "block"
    summary = (
        "runtime evidence entries are readable and distinguish `present` from `not_applicable`."
        if result == "pass"
        else "runtime evidence entries are incomplete or inconsistent."
    )
    return emit(
        {
            "command": "runtime-evidence",
            "item_id": item_id,
            "result": result,
            "summary": summary,
            "missing_inputs": missing_inputs,
            "fallback_to": "admission" if missing_inputs else None,
            "runtime_evidence": fields,
            "runtime_state": runtime_state,
        }
    )


def state_check_payload(context: dict[str, Any]) -> dict[str, Any]:
    purity = purity_report_from_context(context)
    active_state_failures: list[str] = []
    checkpoint_failures: list[str] = []
    scope_failures: list[str] = []

    current_checkpoint = context["current_checkpoint"]
    if current_checkpoint in TERMINAL_CHECKPOINTS:
        active_state_failures.append(f"current checkpoint is terminal: `{current_checkpoint}`")

    active_conflicts = active_workspace_conflicts(context["target_root"], context["item_id"], context["workspace_entry"])
    if active_conflicts:
        active_state_failures.append(
            "workspace is shared by multiple active items: " + ", ".join(sorted(active_conflicts))
        )

    known_checkpoints = {"admission", "build", "merge", "retired"} | TERMINAL_CHECKPOINTS
    if current_checkpoint not in known_checkpoints:
        checkpoint_failures.append(f"unknown checkpoint value: `{context['current_checkpoint_raw']}`")
    if current_checkpoint in {"admission", "build", "merge"}:
        for field_name in ("current_stop", "next_step", "latest_validation_summary", "recovery_boundary", "current_lane"):
            value = str(context[field_name]).strip()
            if not value:
                checkpoint_failures.append(f"checkpoint integrity missing `{field_name}`")

    scope_assessment = purity.get("scope_assessment")
    if isinstance(scope_assessment, dict):
        out_of_scope_changes = scope_assessment.get("out_of_scope_changes")
        if isinstance(out_of_scope_changes, list) and out_of_scope_changes:
            preview = ", ".join(out_of_scope_changes[:5])
            scope_failures.append(f"out-of-scope changes detected: {preview}")

    missing_inputs: list[str] = []
    for collection in (purity["hard_failures"], active_state_failures, checkpoint_failures, scope_failures):
        for message in collection:
            if message not in missing_inputs:
                missing_inputs.append(message)

    result = "pass" if not missing_inputs else "block"
    summary = (
        "active state, checkpoint integrity, and scope signals are consistent."
        if result == "pass"
        else "state-check found active-state conflicts, checkpoint gaps, or scope overflow signals."
    )
    return {
        "command": "state-check",
        "item": {
            "id": context["item_id"],
            "goal": context["goal"],
            "scope": context["scope"],
            "execution_path": context["execution_path"],
        },
        "checkpoint": {
            "raw": context["current_checkpoint_raw"],
            "normalized": current_checkpoint,
        },
        "workspace": {
            "entry": context["workspace_entry"],
            "path": relative_to_root(context["workspace_path"], context["target_root"]),
        },
        "checks": {
            "active_state_failures": active_state_failures,
            "checkpoint_failures": checkpoint_failures,
            "scope_failures": scope_failures,
        },
        "purity": purity,
        "result": result,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "fallback_to": "admission" if missing_inputs else None,
    }


def handle_state_check(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        return emit(
            {
                "command": "state-check",
                "result": "block",
                "summary": "state-check is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": runtime_state["missing_inputs"],
                "fallback_to": runtime_state["fallback_to"],
                "runtime_state": runtime_state,
            }
        )
    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        return emit(
            {
                "command": "state-check",
                "result": "block",
                "summary": "state-check could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
                "runtime_state": runtime_state,
            }
        )
    payload = state_check_payload(context)
    payload["runtime_state"] = runtime_state
    return emit(payload)


def handle_runtime_state(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    return emit(
        {
            "command": "runtime-state",
            "result": runtime_state["result"],
            "summary": runtime_state["summary"],
            "missing_inputs": runtime_state["missing_inputs"],
            "fallback_to": runtime_state["fallback_to"],
            "runtime_state": runtime_state,
        }
    )


def adoption_verify_payload(target_root: Path, output_relative: str, expected_item: str | None) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    context, context_errors = load_context(target_root, output_relative, expected_item)
    pr_template, pr_template_errors = check_pr_template(target_root)
    governance_surface = build_governance_surface(target_root)

    if context_errors:
        return {
            "command": "adopt",
            "operation": "verify",
            "schema_version": "loom-adoption-verify/v1",
            "result": "block",
            "summary": "adoption verify could not read the Loom fact chain.",
            "missing_inputs": [f"fact-chain: {message}" for message in context_errors],
            "fallback_to": "adoption",
            "runtime_state": runtime_state,
            "governance_surface": governance_surface,
            "pr_template": pr_template,
        }

    produced_body = render_adoption_pr_body(context)
    produced_validation = validate_adoption_pr_body(produced_body, target_root=target_root)
    bypass_body = produced_body.replace("\n## Review Artifacts\n\n", "\n## Omitted Review Artifacts\n\n", 1)
    bypass_validation = validate_adoption_pr_body(bypass_body, target_root=target_root)

    review_record, review_path, review_errors = load_review_record(target_root, context["item_id"], context["review_entry"])
    spec_review_record, spec_review_path, spec_review_errors = load_review_record(
        target_root,
        context["item_id"],
        default_spec_review_path(context["item_id"]),
    )
    review_missing = list(review_errors)
    if review_record is None and not review_errors:
        review_missing.append(f"missing review artifact: {review_path}")
    spec_review_missing = list(spec_review_errors)
    if spec_review_record is None and not spec_review_errors:
        spec_review_missing.append(f"missing spec review artifact: {spec_review_path}")

    missing_inputs: list[str] = []
    if runtime_state.get("result") != "pass":
        missing_inputs.extend(str(message) for message in runtime_state.get("missing_inputs", []))
    missing_inputs.extend(pr_template_errors)
    missing_inputs.extend(produced_validation["missing_inputs"])
    missing_inputs.extend(review_missing)
    missing_inputs.extend(spec_review_missing)
    if bypass_validation["result"] != "block":
        missing_inputs.append("consumer bypass check failed: removing Review Artifacts must block")

    control_plane = governance_surface.get("governance_control_plane")
    maturity = control_plane.get("maturity") if isinstance(control_plane, dict) else {}
    target_level = maturity.get("next") if isinstance(maturity, dict) and isinstance(maturity.get("next"), str) else maturity.get("current") if isinstance(maturity, dict) and isinstance(maturity.get("current"), str) else None
    decisions = adoption_decisions_payload(target_root, target_level=target_level, maturity=maturity if isinstance(maturity, dict) else {})
    guided_plan = guided_adoption_plan_payload(decisions)
    generation = companion_generation_payload(target_root, decisions, dry_run=True)
    closure = judgment_closure_payload(target_root, decisions, generation, governance_surface)
    consumption = generated_companion_consumption_payload(target_root, context["item_id"], governance_surface)
    missing_inputs.extend(closure["missing_inputs"])
    missing_inputs.extend(consumption["missing_inputs"])

    result = "pass" if not missing_inputs else "block"
    return {
        "command": "adopt",
        "operation": "verify",
        "schema_version": "loom-adoption-verify/v1",
        "result": result,
        "summary": (
            "downstream adoption producer/consumer round-trip is valid."
            if result == "pass"
            else "downstream adoption round-trip has blocking contract gaps."
        ),
        "missing_inputs": missing_inputs,
        "fallback_to": None if result == "pass" else "adoption",
        "runtime_state": runtime_state,
        "governance_surface": governance_surface,
        "pr_template": pr_template,
        "producer_consumer_roundtrip": {
            "producer": {
                "status": "pass",
                "body_sections": list(ADOPTION_PR_BODY_SECTIONS),
            },
            "consumer": produced_validation,
            "bypass_check": {
                "scenario": "Review Artifacts section omitted",
                "result": "pass" if bypass_validation["result"] == "block" else "block",
                "consumer_result": bypass_validation["result"],
                "missing_inputs": bypass_validation["missing_inputs"],
            },
        },
        "reviews": {
            "implementation": {
                "path": review_path,
                "status": "present" if review_record is not None and not review_errors else "missing",
            },
            "spec": {
                "path": spec_review_path,
                "status": "present" if spec_review_record is not None and not spec_review_errors else "missing",
            },
        },
        "adoption_decisions": decisions,
        "guided_adoption_plan": guided_plan,
        "companion_generation": generation,
        "generated_companion_consumption": consumption,
        "judgment_closure": closure,
    }


def handle_adopt(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    return emit(adoption_verify_payload(target_root, args.output, args.item))


def runtime_artifact_updates(target_root: Path, payload: dict[str, Any], *, source: str) -> list[dict[str, Any]]:
    artifacts = payload.get("artifacts")
    if not isinstance(artifacts, list):
        artifacts = payload.get("initial_artifacts")
    if not isinstance(artifacts, list):
        return []
    updates: list[dict[str, Any]] = []
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        relative = artifact.get("path")
        if not isinstance(relative, str) or not relative.startswith(".loom/bin/"):
            continue
        path, errors = resolve_repo_relative_path(target_root, relative, label=f"{source} artifact path")
        if errors or path is None or not path.exists() or not path.is_file():
            updates.append(
                {
                    "path": relative,
                    "source": source,
                    "status": "block",
                    "missing_inputs": errors or [f"missing runtime artifact: {relative}"],
                }
            )
            continue
        expected = sha256_file(path)
        current = artifact.get("sha256")
        updates.append(
            {
                "path": relative,
                "source": source,
                "status": "current" if current == expected else "refresh-needed",
                "current_sha256": current if isinstance(current, str) else None,
                "expected_sha256": expected,
            }
        )
    return updates


def apply_runtime_artifact_updates(payload: dict[str, Any], updates: list[dict[str, Any]], *, source: str) -> None:
    artifacts = payload.get("artifacts")
    if not isinstance(artifacts, list):
        artifacts = payload.get("initial_artifacts")
    if not isinstance(artifacts, list):
        return
    expected_by_path = {
        update["path"]: update.get("expected_sha256")
        for update in updates
        if update.get("source") == source and update.get("status") == "refresh-needed"
    }
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        relative = artifact.get("path")
        if isinstance(relative, str) and relative in expected_by_path:
            artifact["sha256"] = expected_by_path[relative]


def refresh_shadow_evidence_actions(target_root: Path) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    shadow_root = target_root / ".loom/shadow"
    if not shadow_root.exists():
        return actions
    for path in sorted(shadow_root.glob("*.json")):
        relative = path.relative_to(target_root).as_posix()
        if relative == ".loom/shadow/shadow-parity.json":
            actions.append(
                {
                    "path": relative,
                    "kind": "shadow-evidence-summary",
                    "status": "skipped",
                    "summary": "shadow-parity.json is an aggregate command output; per-surface evidence carries source hashes.",
                }
            )
            continue
        try:
            payload = load_json_file(path)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            actions.append({"path": relative, "kind": "shadow-evidence", "status": "block", "missing_inputs": [str(exc)]})
            continue
        if not isinstance(payload, dict):
            actions.append({"path": relative, "kind": "shadow-evidence", "status": "block", "missing_inputs": ["shadow evidence must be a JSON object"]})
            continue
        source_files = payload.get("source_files")
        if not isinstance(source_files, list) or not source_files:
            actions.append({"path": relative, "kind": "shadow-evidence", "status": "block", "missing_inputs": ["source_files"]})
            continue
        refreshed: dict[str, str] = {}
        missing: list[str] = []
        for source in source_files:
            if not isinstance(source, str):
                missing.append("source_files entries must be strings")
                continue
            source_path, errors = resolve_repo_relative_path(target_root, source, label=f"{relative} source")
            if errors or source_path is None or not source_path.exists() or source_path.is_dir():
                missing.extend(errors or [f"missing source file: {source}"])
                continue
            refreshed[source] = sha256_file(source_path)
        if missing:
            actions.append({"path": relative, "kind": "shadow-evidence", "status": "block", "missing_inputs": missing})
            continue
        current = payload.get("source_sha256")
        actions.append(
            {
                "path": relative,
                "kind": "shadow-evidence",
                "status": "current" if current == refreshed else "refresh-needed",
                "expected_source_sha256": refreshed,
            }
        )
    return actions


def apply_shadow_evidence_actions(target_root: Path, actions: list[dict[str, Any]]) -> None:
    for action in actions:
        if action.get("kind") != "shadow-evidence" or action.get("status") != "refresh-needed":
            continue
        relative = action.get("path")
        expected = action.get("expected_source_sha256")
        if not isinstance(relative, str) or not isinstance(expected, dict):
            continue
        path, errors = resolve_repo_relative_path(target_root, relative, label="shadow evidence path")
        if errors or path is None:
            continue
        payload = load_json_file(path)
        if isinstance(payload, dict):
            payload["source_sha256"] = expected
            write_json_file(path, payload)


def carrier_refresh_payload(target_root: Path, output_relative: str, expected_item: str | None, *, dry_run: bool) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    context, context_errors = load_context(target_root, output_relative, expected_item)
    missing_inputs: list[str] = [f"fact-chain: {message}" for message in context_errors]

    manifest_path, manifest_path_errors = resolve_repo_relative_path(target_root, ".loom/bootstrap/manifest.json", label="bootstrap manifest")
    init_path, init_path_errors = resolve_repo_relative_path(target_root, output_relative, label="init-result locator")
    missing_inputs.extend(manifest_path_errors)
    missing_inputs.extend(init_path_errors)
    manifest_payload: dict[str, Any] = {}
    init_payload: dict[str, Any] = {}
    for label, path in (("manifest", manifest_path), ("init-result", init_path)):
        if path is None:
            continue
        try:
            payload = load_json_file(path)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            missing_inputs.append(f"invalid {label}: {exc}")
            continue
        if label == "manifest":
            manifest_payload = payload
        else:
            init_payload = payload

    actions: list[dict[str, Any]] = []
    actions.extend(runtime_artifact_updates(target_root, manifest_payload, source="manifest"))
    actions.extend(runtime_artifact_updates(target_root, init_payload, source="init-result"))
    actions.extend(refresh_shadow_evidence_actions(target_root))
    for action in actions:
        if action.get("status") == "block":
            missing_inputs.extend(str(message) for message in action.get("missing_inputs", []))
    if runtime_state.get("result") != "pass":
        refreshable_runtime_drift = {
            f"bootstrap runtime artifact `{action.get('path')}` sha256 drifted"
            for action in actions
            if action.get("kind") is None and action.get("status") == "refresh-needed" and action.get("path")
        }
        for message in runtime_state.get("missing_inputs", []):
            if str(message) not in refreshable_runtime_drift:
                missing_inputs.append(f"runtime-state: {message}")

    review_status: dict[str, Any] = {"status": "not_checked"}
    if not context_errors:
        assert context
        review_record, review_path, review_errors = load_review_record(target_root, context["item_id"], context["review_entry"])
        spec_review_path = default_spec_review_path(context["item_id"])
        allowed_paths = allowed_post_review_carrier_paths(context, review_path, spec_review_path)
        if review_errors or review_record is None:
            review_status = {"status": "missing", "path": review_path, "missing_inputs": review_errors or [f"missing review artifact: {review_path}"]}
        else:
            binding, binding_errors = review_head_binding(
                target_root,
                reviewed_head=str(review_record.get("reviewed_head", "")),
                allowed_paths=allowed_paths,
            )
            review_status = {"path": review_path, "head_binding": binding, "missing_inputs": binding_errors}
            if binding.get("status") in {"implementation-drift-only", "stale"}:
                review_status["status"] = "block"
                missing_inputs.append("review artifact is stale because non-carrier drift is present")
            elif binding.get("status") == "carrier-only":
                review_status["status"] = "refresh-needed"
            else:
                review_status["status"] = "current"

    if not dry_run and not missing_inputs:
        if manifest_path is not None:
            apply_runtime_artifact_updates(manifest_payload, actions, source="manifest")
            write_json_file(manifest_path, manifest_payload)
        if init_path is not None:
            apply_runtime_artifact_updates(init_payload, actions, source="init-result")
            write_json_file(init_path, init_payload)
        apply_shadow_evidence_actions(target_root, actions)

    refresh_needed = [action for action in actions if action.get("status") == "refresh-needed"]
    result = "block" if missing_inputs else "pass"
    return {
        "command": "carrier",
        "operation": "refresh",
        "schema_version": "loom-carrier-refresh/v1",
        "result": result,
        "summary": (
            "carrier refresh completed." if result == "pass" and not dry_run
            else "carrier refresh dry-run completed." if result == "pass"
            else "carrier refresh found blocking drift."
        ),
        "missing_inputs": missing_inputs,
        "fallback_to": None if result == "pass" else "adoption",
        "dry_run": dry_run,
        "runtime_state": runtime_state,
        "actions": actions,
        "refresh_needed": refresh_needed,
        "review": review_status,
    }


def handle_carrier(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    return emit(carrier_refresh_payload(target_root, args.output, args.item, dry_run=args.dry_run))


def github_commit_pulls(root: Path, owner: str, repo_name: str, head_sha: str) -> tuple[list[dict[str, Any]], list[str]]:
    path = f"repos/{owner}/{repo_name}/commits/{head_sha}/pulls"
    result = run_process(
        [
            "gh",
            "api",
            path,
            "-H",
            "Accept: application/vnd.github+json",
        ],
        root,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "gh api commit pulls failed"
        pulls, fallback_errors = github_public_rest_list(path)
        if pulls:
            return pulls, []
        return [], [detail, *[f"public REST fallback: {message}" for message in fallback_errors]]
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return [], [f"invalid JSON from commit pulls REST endpoint: {exc.msg}"]
    if not isinstance(payload, list):
        return [], ["commit pulls REST endpoint did not return a list"]
    return [entry for entry in payload if isinstance(entry, dict)], []


def host_binding_validate_payload(
    *,
    target_root: Path,
    owner: str | None,
    repo_name: str | None,
    issue_number: int | None,
    pr_number: int | None,
    branch_name: str | None,
    head_sha: str | None,
    base_sha: str | None,
) -> dict[str, Any]:
    detected_owner, detected_repo = detect_github_repo(target_root)
    owner = owner or detected_owner
    repo_name = repo_name or detected_repo
    missing_inputs: list[str] = []
    inferences: list[dict[str, Any]] = []

    if not owner or not repo_name:
        missing_inputs.append("owner/repo")

    inferred_pr = pr_number
    inferred_branch = branch_name
    if owner and repo_name and head_sha and inferred_pr is None:
        pulls, pull_errors = github_commit_pulls(target_root, owner, repo_name, head_sha)
        if pull_errors:
            missing_inputs.extend(f"head_sha: {message}" for message in pull_errors)
        elif len(pulls) == 1:
            inferred_pr = int(pulls[0].get("number"))
            head = pulls[0].get("head")
            if inferred_branch is None and isinstance(head, dict) and isinstance(head.get("ref"), str):
                inferred_branch = head.get("ref")
            inferences.append({"from": "head_sha", "to": "pr", "status": "inferred", "pr": inferred_pr})
        elif len(pulls) > 1:
            missing_inputs.append("head_sha resolves to multiple PRs; pass --pr explicitly")
        else:
            missing_inputs.append("issue_or_pr_binding")

    if inferred_branch is None and head_sha is None and inferred_pr is None and issue_number is None:
        missing_inputs.append("branch | head-sha | pr | issue")

    branch_payload: dict[str, Any] | None = None
    branch_errors: list[str] = []
    if owner and repo_name and inferred_branch:
        branch_payload, branch_errors = github_branch_payload(target_root, owner, repo_name, inferred_branch)
        missing_inputs.extend(f"branch: {message}" for message in branch_errors)

    binding_payload = github_binding_payload(
        target_root=target_root,
        owner=owner,
        repo_name=repo_name,
        phase_number=None,
        fr_number=None,
        issue_number=issue_number,
        pr_number=inferred_pr,
        branch_name=inferred_branch,
        sync=False,
        dry_run=True,
        require_complete_chain=False,
    )
    binding_missing = [
        message
        for message in binding_payload.get("missing_inputs", [])
        if message not in {"work_item issue", "binding_chain"}
    ]
    if issue_number is not None or inferred_pr is not None:
        missing_inputs.extend(str(message) for message in binding_missing)
    findings = binding_payload.get("binding", {}).get("findings") if isinstance(binding_payload.get("binding"), dict) else []
    if findings:
        missing_inputs.append("binding_findings")

    sha_validation: dict[str, Any] = {
        "head_sha": head_sha,
        "base_sha": base_sha,
        "status": "not_requested" if not head_sha else "validated",
    }
    if head_sha and branch_payload is not None:
        branch_head = branch_payload.get("commit", {}).get("sha") if isinstance(branch_payload.get("commit"), dict) else None
        sha_validation["branch_head_sha"] = branch_head
        if branch_head and branch_head != head_sha:
            sha_validation["status"] = "drift"
            missing_inputs.append("head_sha does not match branch head")
    if base_sha and head_sha:
        changed_paths, diff_errors = git_changed_paths(target_root, base_sha, head_sha)
        sha_validation["diff"] = {"changed_paths": changed_paths, "errors": diff_errors}
        if diff_errors:
            missing_inputs.extend(f"diff: {message}" for message in diff_errors)

    result = "pass" if not missing_inputs else "block"
    return {
        "command": "host-binding",
        "operation": "validate",
        "schema_version": "loom-host-binding/v1",
        "result": result,
        "summary": (
            "host binding inputs are readable and sufficiently bound."
            if result == "pass"
            else "host binding inputs are missing or ambiguous."
        ),
        "missing_inputs": missing_inputs,
        "fallback_to": None if result == "pass" else "github-profile-binding",
        "repository": {"owner": owner, "name": repo_name},
        "inputs": {
            "issue": issue_number,
            "pr": pr_number,
            "branch": branch_name,
            "head_sha": head_sha,
            "base_sha": base_sha,
        },
        "inferences": inferences,
        "binding": binding_payload.get("binding"),
        "branch": {
            "name": inferred_branch,
            "status": "present" if branch_payload is not None else ("unreadable" if branch_errors else "not_requested"),
            "errors": branch_errors,
        },
        "sha_validation": sha_validation,
    }


def handle_host_binding(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    return emit(
        host_binding_validate_payload(
            target_root=target_root,
            owner=args.owner,
            repo_name=args.repo_name,
            issue_number=args.issue,
            pr_number=args.pr,
            branch_name=args.branch,
            head_sha=args.head_sha,
            base_sha=args.base_sha,
        )
    )


def load_optional_json_fixture(target_root: Path, fixture: str | None, *, label: str) -> tuple[Any | None, list[str]]:
    if not fixture:
        return None, []
    path, errors = resolve_repo_relative_path(target_root, fixture, label=label)
    if errors:
        return None, errors
    assert path is not None
    if not path.exists() or not path.is_file():
        return None, [f"{label} points to a missing file: {fixture}"]
    try:
        return json.loads(path.read_text(encoding="utf-8")), []
    except (OSError, json.JSONDecodeError) as exc:
        return None, [f"invalid {label} `{fixture}`: {exc}"]


def normalize_pr_fixture_payload(payload: Any) -> tuple[dict[str, Any] | None, list[str]]:
    if not isinstance(payload, dict):
        return None, ["PR payload fixture must be a JSON object"]
    normalized = dict(payload)
    if "isDraft" not in normalized and "draft" in normalized:
        normalized["isDraft"] = bool(normalized.get("draft"))
    if "headRefOid" not in normalized:
        head = normalized.get("head") if isinstance(normalized.get("head"), dict) else None
        if isinstance(head, dict) and isinstance(head.get("sha"), str):
            normalized["headRefOid"] = head.get("sha")
    if "headRefName" not in normalized:
        head = normalized.get("head") if isinstance(normalized.get("head"), dict) else None
        if isinstance(head, dict) and isinstance(head.get("ref"), str):
            normalized["headRefName"] = head.get("ref")
    if "baseRefName" not in normalized:
        base = normalized.get("base") if isinstance(normalized.get("base"), dict) else None
        if isinstance(base, dict) and isinstance(base.get("ref"), str):
            normalized["baseRefName"] = base.get("ref")
    if "state" in normalized:
        normalized["state"] = str(normalized.get("state") or "unknown").upper()
    else:
        normalized["state"] = "OPEN"
    return normalized, []


def infer_pr_number_from_ref(ref: str | None) -> int | None:
    if not isinstance(ref, str):
        return None
    for pattern in (r"(?:^|/)pr[-/](\d+)(?:[-/]|$)", r"pull/(\d+)/(?:head|merge)$"):
        match = re.search(pattern, ref, flags=re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None


def pr_work_item_from_body(body: Any) -> str | None:
    if not isinstance(body, str):
        return None
    patterns = (
        r"(?im)^\s*[-*]?\s*Loom Work Item\s*:\s*`?([A-Z]+-\d+|INIT-\d+)`?\s*$",
        r"(?im)^\s*[-*]?\s*Work Item\s*:\s*`?([A-Z]+-\d+|INIT-\d+)`?\s*$",
        r"(?im)^\s*[-*]?\s*Loom-Work-Item\s*:\s*`?([A-Z]+-\d+|INIT-\d+)`?\s*$",
    )
    for pattern in patterns:
        match = re.search(pattern, body)
        if match:
            return match.group(1).strip()
    return None


def pr_body_mentions_item(body: Any, item_id: str) -> bool:
    if not isinstance(body, str):
        return False
    return bool(re.search(rf"(?<![A-Z0-9-]){re.escape(item_id)}(?![A-Z0-9-])", body))


def load_pr_payload_for_gate(
    *,
    target_root: Path,
    owner: str | None,
    repo_name: str | None,
    pr_number: int | None,
    head_sha: str | None,
    branch_name: str | None,
    pr_payload_file: str | None,
) -> tuple[dict[str, Any] | None, int | None, list[str], list[dict[str, Any]]]:
    missing_inputs: list[str] = []
    inferences: list[dict[str, Any]] = []
    fixture, fixture_errors = load_optional_json_fixture(target_root, pr_payload_file, label="PR payload fixture")
    if fixture_errors:
        return None, pr_number, fixture_errors, inferences
    if fixture is not None:
        payload, errors = normalize_pr_fixture_payload(fixture)
        if errors:
            return None, pr_number, errors, inferences
        inferred_number = pr_number or (int(payload["number"]) if isinstance(payload.get("number"), int) else None)
        return payload, inferred_number, [], inferences

    inferred_pr = pr_number or infer_pr_number_from_ref(branch_name)
    if inferred_pr is not None and pr_number is None:
        inferences.append({"from": "branch", "to": "pr", "status": "inferred", "pr": inferred_pr})

    if inferred_pr is None and owner and repo_name and head_sha:
        pulls, pull_errors = github_commit_pulls(target_root, owner, repo_name, head_sha)
        if pull_errors:
            missing_inputs.extend(f"head_sha: {message}" for message in pull_errors)
        elif len(pulls) == 1 and isinstance(pulls[0].get("number"), int):
            inferred_pr = int(pulls[0]["number"])
            inferences.append({"from": "head_sha", "to": "pr", "status": "inferred", "pr": inferred_pr})
        elif len(pulls) > 1:
            missing_inputs.append("head_sha resolves to multiple PRs; pass --pr explicitly")

    if inferred_pr is None:
        return None, None, missing_inputs or ["pr | head-sha | branch"], inferences
    if not owner or not repo_name:
        return None, inferred_pr, ["owner/repo"], inferences
    payload, errors = github_pr_payload(target_root, owner, repo_name, inferred_pr)
    return payload, inferred_pr, errors, inferences


def pr_gate_failure_taxonomy(missing_inputs: list[str], gate_result: str) -> list[str]:
    categories: set[str] = set()
    for message in missing_inputs:
        lowered = str(message).lower()
        if "pr" in lowered and ("unreadable" in lowered or "payload" in lowered or "head_sha" in lowered):
            categories.add("pr_unreadable")
        if "work item" in lowered or "current item mismatch" in lowered:
            categories.add("work_item_binding_conflict" if "mismatch" in lowered else "work_item_binding_missing")
        if "fact-chain" in lowered or "fact chain" in lowered:
            categories.add("fact_chain_unreadable")
        if "missing review" in lowered or "missing implementation review" in lowered or "missing review artifact" in lowered:
            categories.add("review_missing")
        if "schema_version" in lowered or "invalid review" in lowered:
            categories.add("review_schema_invalid")
        if "decision is blocking" in lowered or "decision is fallback" in lowered or "not approved" in lowered:
            categories.add("review_not_approved")
        if "stale" in lowered or "implementation drift" in lowered:
            categories.add("review_stale")
        if "validation summary" in lowered:
            categories.add("validation_summary_drift")
        if "reviewed_head" in lowered or "head binding" in lowered:
            categories.add("head_binding_drift")
        if "checkout head" in lowered:
            categories.add("checkout_head_drift")
        if "raw" in lowered or "shadow" in lowered:
            categories.add("raw_evidence_bypass")
        if "required check" in lowered or "branch protection" in lowered or "ruleset" in lowered:
            categories.add("host_enforcement_unverified")
    if gate_result == "fallback":
        categories.add("prior_gate_fallback")
    return sorted(categories)


def pr_gate_payload(
    *,
    target_root: Path,
    output_relative: str,
    expected_item: str | None,
    owner: str | None,
    repo_name: str | None,
    pr_number: int | None,
    head_sha: str | None,
    branch_name: str | None,
    pr_payload_file: str | None,
) -> dict[str, Any]:
    detected_owner, detected_repo = detect_github_repo(target_root)
    owner = owner or detected_owner
    repo_name = repo_name or detected_repo
    missing_inputs: list[str] = []
    steps: list[dict[str, Any]] = []

    runtime_state = runtime_state_payload(target_root)
    steps.append(
        {
            "name": "runtime-state",
            "result": runtime_state["result"],
            "summary": runtime_state["summary"],
            "missing_inputs": runtime_state["missing_inputs"],
            "fallback_to": runtime_state["fallback_to"],
        }
    )
    if runtime_state["result"] != "pass":
        missing_inputs.extend(str(message) for message in runtime_state.get("missing_inputs", []))

    pr_payload, effective_pr, pr_errors, inferences = load_pr_payload_for_gate(
        target_root=target_root,
        owner=owner,
        repo_name=repo_name,
        pr_number=pr_number,
        head_sha=head_sha,
        branch_name=branch_name,
        pr_payload_file=pr_payload_file,
    )
    if pr_errors:
        missing_inputs.extend(f"pr: {message}" for message in pr_errors)

    body_item = pr_work_item_from_body(pr_payload.get("body") if isinstance(pr_payload, dict) else None)
    effective_item = expected_item or body_item
    if expected_item and body_item and expected_item != body_item:
        missing_inputs.append(f"PR body Work Item `{body_item}` does not match expected `{expected_item}`")
    if effective_item is None:
        missing_inputs.append("PR body is missing `Loom Work Item: <item>`")

    context: dict[str, Any] = {}
    context_errors: list[str] = []
    if effective_item is not None:
        context, context_errors = load_context(target_root, output_relative, effective_item)
    else:
        context, context_errors = load_context(target_root, output_relative, expected_item)
    if context_errors:
        missing_inputs.extend(f"fact-chain: {message}" for message in context_errors)

    pr_head = head_sha
    if isinstance(pr_payload, dict) and isinstance(pr_payload.get("headRefOid"), str):
        if pr_head and pr_payload["headRefOid"] != pr_head:
            missing_inputs.append("PR payload headRefOid does not match --head-sha")
        pr_head = pr_payload["headRefOid"]
    if not pr_head:
        missing_inputs.append("PR head SHA is unavailable")

    pr_state = pr_payload.get("state") if isinstance(pr_payload, dict) else None
    if pr_payload is not None:
        if pr_state not in {"OPEN"}:
            missing_inputs.append(f"PR state must be OPEN before controlled merge: {pr_state}")
        if pr_payload.get("isDraft") is True:
            missing_inputs.append("PR is draft")
        if context and not pr_body_mentions_item(pr_payload.get("body"), context["item_id"]):
            missing_inputs.append(f"PR body does not mention Loom Work Item `{context['item_id']}`")

    current_head = git_head_sha(target_root)
    if pr_head and current_head and pr_head != current_head:
        missing_inputs.append("checkout head does not match PR head")

    merge_checkpoint: dict[str, Any] = {
        "result": "block",
        "summary": "merge checkpoint was not evaluated.",
        "missing_inputs": ["fact-chain"],
        "fallback_to": "admission",
    }
    review_approval: dict[str, Any] = {
        "status": "unavailable",
        "path": None,
        "decision": None,
        "reviewed_head": None,
        "head_binding": None,
    }
    if context:
        merge_checkpoint = checkpoint_payload("merge", context)
        review_record, review_path, review_errors = load_review_record(target_root, context["item_id"], context["review_entry"])
        if review_record is None:
            review_approval = {
                "status": "missing",
                "path": review_path,
                "decision": None,
                "reviewed_head": None,
                "head_binding": None,
                "missing_inputs": review_errors or [f"missing review artifact: {review_path}"],
            }
        else:
            review_approval = {
                "status": "approved" if review_record.get("decision") == "allow" and not review_errors else "not_approved",
                "path": review_path,
                "decision": review_record.get("decision"),
                "reviewed_head": review_record.get("reviewed_head"),
                "reviewed_validation_summary": review_record.get("reviewed_validation_summary"),
                "head_binding": review_record.get("head_binding"),
                "missing_inputs": review_errors,
            }
        if merge_checkpoint.get("result") in {"block", "fallback"}:
            missing_inputs.extend(str(message) for message in merge_checkpoint.get("missing_inputs", []))
        steps.append(
            {
                "name": "checkpoint-merge",
                "result": merge_checkpoint.get("result"),
                "summary": merge_checkpoint.get("summary"),
                "missing_inputs": merge_checkpoint.get("missing_inputs", []),
                "fallback_to": merge_checkpoint.get("fallback_to"),
            }
        )

    # Make the bypass boundary explicit even when raw evidence is present in the repository.
    if context:
        runtime_review_root = target_root / ".loom/runtime/review" / context["item_id"]
        raw_evidence_present = runtime_review_root.exists() and any(runtime_review_root.glob("**/*"))
    else:
        raw_evidence_present = False

    result = "pass"
    fallback_to: str | None = None
    for step in steps:
        if step.get("result") == "fallback":
            result = "fallback"
            fallback_to = step.get("fallback_to") or "build"
            break
        if step.get("result") == "block" and result == "pass":
            result = "block"
            fallback_to = step.get("fallback_to")
    if missing_inputs and result == "pass":
        result = "block"
        fallback_to = fallback_to or "build"

    failure_taxonomy = pr_gate_failure_taxonomy(missing_inputs, result)
    if raw_evidence_present and review_approval.get("status") != "approved" and "raw_evidence_bypass" not in failure_taxonomy:
        failure_taxonomy.append("raw_evidence_bypass")
    return {
        "command": "pr-gate",
        "operation": "check",
        "schema_version": PR_MERGE_GATE_SCHEMA,
        "result": result,
        "summary": (
            "PR merge gate found fresh authored semantic review approval for the current PR head."
            if result == "pass"
            else "PR merge gate is blocked or falling back before host merge."
        ),
        "missing_inputs": sorted(set(missing_inputs)),
        "fallback_to": fallback_to,
        "repository": {"owner": owner, "name": repo_name},
        "pr": {
            "number": effective_pr,
            "state": pr_state,
            "isDraft": pr_payload.get("isDraft") if isinstance(pr_payload, dict) else None,
            "headRefName": pr_payload.get("headRefName") if isinstance(pr_payload, dict) else branch_name,
            "baseRefName": pr_payload.get("baseRefName") if isinstance(pr_payload, dict) else None,
            "head_sha": pr_head,
            "url": pr_payload.get("url") if isinstance(pr_payload, dict) else None,
            "work_item_from_body": body_item,
        },
        "work_item": {
            "id": context.get("item_id") if context else effective_item,
            "path": relative_to_root(context["work_item_path"], target_root) if context else None,
            "review_entry": context.get("review_entry") if context else None,
        },
        "review_approval": review_approval,
        "merge_checkpoint": merge_checkpoint,
        "host_enforcement": {
            "stable_check_name": PR_MERGE_GATE_CHECK_NAME,
            "status": "not_checked",
            "reason": "pr-gate check proves PR-local semantic approval; controlled-merge checks host required status.",
        },
        "approval_boundary": {
            "authored_truth": "work_item.review_entry",
            "raw_review_evidence_satisfies_approval": False,
            "shadow_evidence_satisfies_approval": False,
            "ci_success_satisfies_approval": False,
            "raw_evidence_present": raw_evidence_present,
        },
        "failure_taxonomy": sorted(failure_taxonomy),
        "steps": steps,
        "inferences": inferences,
    }


def handle_pr_gate(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    return emit(
        pr_gate_payload(
            target_root=target_root,
            output_relative=args.output,
            expected_item=args.item,
            owner=args.owner,
            repo_name=args.repo_name,
            pr_number=args.pr,
            head_sha=args.head_sha,
            branch_name=args.branch,
            pr_payload_file=args.pr_payload_file,
        )
    )


def required_status_contexts_from_protection(payload: Any) -> list[str]:
    if not isinstance(payload, dict):
        return []
    required_status = payload.get("required_status_checks")
    if not isinstance(required_status, dict):
        return []
    contexts = required_status.get("contexts")
    if isinstance(contexts, list):
        return [str(context) for context in contexts if isinstance(context, str) and context.strip()]
    checks = required_status.get("checks")
    if isinstance(checks, list):
        return [str(check.get("context")) for check in checks if isinstance(check, dict) and isinstance(check.get("context"), str)]
    return []


def required_status_contexts_from_branch_rules(payload: Any) -> list[str]:
    rules = payload
    if isinstance(payload, dict):
        rules = payload.get("rules") or payload.get("data")
    if not isinstance(rules, list):
        return []
    contexts: list[str] = []
    for rule in rules:
        if not isinstance(rule, dict) or rule.get("type") != "required_status_checks":
            continue
        parameters = rule.get("parameters") if isinstance(rule.get("parameters"), dict) else {}
        checks = parameters.get("required_status_checks")
        if isinstance(checks, list):
            for check in checks:
                if isinstance(check, dict) and isinstance(check.get("context"), str):
                    contexts.append(check["context"])
                elif isinstance(check, str):
                    contexts.append(check)
        for fallback_key in ("contexts", "required_contexts"):
            fallback_contexts = parameters.get(fallback_key)
            if isinstance(fallback_contexts, list):
                contexts.extend(str(context) for context in fallback_contexts if isinstance(context, str) and context.strip())
    return sorted(set(contexts))


def required_check_status_payload(status_rollup: Any, required_contexts: list[str]) -> dict[str, Any]:
    runs = status_rollup if isinstance(status_rollup, list) else []
    by_name: dict[str, list[dict[str, Any]]] = {}
    for run in runs:
        if not isinstance(run, dict):
            continue
        name = run.get("name") or run.get("context")
        if isinstance(name, str):
            by_name.setdefault(name, []).append(run)
    missing: list[str] = []
    pending: list[str] = []
    failing: list[str] = []
    for context in required_contexts:
        entries = by_name.get(context, [])
        if not entries:
            missing.append(context)
            continue
        if any(entry.get("conclusion") == "SUCCESS" or entry.get("state") == "SUCCESS" for entry in entries):
            continue
        if any(entry.get("status") not in {None, "COMPLETED"} for entry in entries):
            pending.append(context)
        else:
            failing.append(context)
    result = "pass" if not missing and not pending and not failing else "block"
    return {
        "result": result,
        "required_contexts": required_contexts,
        "missing": missing,
        "pending": pending,
        "failing": failing,
    }


def controlled_merge_payload(
    *,
    target_root: Path,
    output_relative: str,
    expected_item: str | None,
    owner: str | None,
    repo_name: str | None,
    pr_number: int,
    head_sha: str | None,
    merge_method: str,
    delete_branch: bool,
    execute: bool,
    pr_payload_file: str | None,
    status_checks_file: str | None,
    branch_protection_file: str | None,
    ruleset_file: str | None,
) -> dict[str, Any]:
    detected_owner, detected_repo = detect_github_repo(target_root)
    owner = owner or detected_owner
    repo_name = repo_name or detected_repo
    pr_gate = pr_gate_payload(
        target_root=target_root,
        output_relative=output_relative,
        expected_item=expected_item,
        owner=owner,
        repo_name=repo_name,
        pr_number=pr_number,
        head_sha=head_sha,
        branch_name=None,
        pr_payload_file=pr_payload_file,
    )
    missing_inputs = [f"pr-gate: {message}" for message in pr_gate.get("missing_inputs", [])]
    result = pr_gate.get("result")
    fallback_to = pr_gate.get("fallback_to")

    pr_payload = pr_gate.get("pr") if isinstance(pr_gate.get("pr"), dict) else {}
    base_ref = pr_payload.get("baseRefName") if isinstance(pr_payload, dict) else None

    protection_payload, protection_errors = load_optional_json_fixture(
        target_root,
        branch_protection_file,
        label="branch protection fixture",
    )
    if protection_payload is None and not protection_errors and owner and repo_name and isinstance(base_ref, str) and base_ref:
        protection_payload, protection_errors = gh_rest_json(
            target_root,
            f"repos/{owner}/{repo_name}/branches/{quote(base_ref, safe='')}/protection",
        )
    if protection_errors:
        missing_inputs.extend(f"branch protection: {message}" for message in protection_errors)

    ruleset_payload, ruleset_errors = load_optional_json_fixture(
        target_root,
        ruleset_file,
        label="branch rules/ruleset fixture",
    )
    if ruleset_payload is None and not ruleset_errors and owner and repo_name and isinstance(base_ref, str) and base_ref:
        ruleset_payload, ruleset_errors = github_public_rest_list(
            f"repos/{owner}/{repo_name}/rules/branches/{quote(base_ref, safe='')}",
        )
    if ruleset_errors:
        missing_inputs.extend(f"branch rules/ruleset: {message}" for message in ruleset_errors)

    status_payload, status_errors = load_optional_json_fixture(
        target_root,
        status_checks_file,
        label="status checks fixture",
    )
    if status_payload is None and not status_errors:
        status_payload, status_errors = gh_json(
            target_root,
            ["pr", "view", str(pr_number), "--json", "statusCheckRollup"],
        )
    if status_errors:
        missing_inputs.extend(f"status checks: {message}" for message in status_errors)

    protection_contexts = required_status_contexts_from_protection(protection_payload)
    ruleset_contexts = required_status_contexts_from_branch_rules(ruleset_payload)
    required_contexts = sorted(set(protection_contexts + ruleset_contexts))
    required_checks = required_check_status_payload(
        status_payload.get("statusCheckRollup") if isinstance(status_payload, dict) else status_payload,
        required_contexts,
    )
    if protection_payload is None and ruleset_payload is None:
        missing_inputs.append("branch protection or ruleset readback is unavailable")
    if PR_MERGE_GATE_CHECK_NAME not in required_contexts:
        missing_inputs.append(f"required check `{PR_MERGE_GATE_CHECK_NAME}` is not enforced")
    if required_checks["result"] != "pass":
        labels = {"missing": "missing", "pending": "pending", "failing": "failing"}
        for key in ("missing", "pending", "failing"):
            for context in required_checks[key]:
                missing_inputs.append(f"required check `{context}` is {labels[key]}")

    merge_result: dict[str, Any] = {
        "attempted": False,
        "executed": False,
        "dry_run": not execute,
        "method": merge_method,
        "delete_branch": delete_branch,
    }
    if missing_inputs and result == "pass":
        result = "block"
        fallback_to = fallback_to or "merge"
    if result == "pass" and execute:
        command = ["gh", "pr", "merge", str(pr_number), f"--{merge_method}"]
        if delete_branch:
            command.append("--delete-branch")
        completed = run_process(command, target_root)
        merge_result["attempted"] = True
        merge_result["command"] = command
        merge_result["returncode"] = completed.returncode
        merge_result["stdout"] = completed.stdout.strip()
        merge_result["stderr"] = completed.stderr.strip()
        if completed.returncode == 0:
            merge_result["executed"] = True
        else:
            result = "block"
            fallback_to = "merge"
            missing_inputs.append(completed.stderr.strip() or completed.stdout.strip() or "gh pr merge failed")

    return {
        "command": "controlled-merge",
        "operation": "merge" if execute else "check",
        "schema_version": CONTROLLED_MERGE_SCHEMA,
        "result": result,
        "summary": (
            "controlled merge preconditions passed and host merge was delegated."
            if result == "pass" and execute
            else "controlled merge preconditions passed; host merge was not executed."
            if result == "pass"
            else "controlled merge is blocked before host merge delegation."
        ),
        "missing_inputs": sorted(set(str(message) for message in missing_inputs)),
        "fallback_to": fallback_to,
        "repository": {"owner": owner, "name": repo_name},
        "pr_gate": pr_gate,
        "required_checks": required_checks,
        "host_enforcement": {
            "stable_check_name": PR_MERGE_GATE_CHECK_NAME,
            "required_contexts": required_contexts,
            "required": PR_MERGE_GATE_CHECK_NAME in required_contexts,
            "branch_protection_readable": protection_payload is not None,
            "branch_protection_required_contexts": protection_contexts,
            "ruleset_readable": ruleset_payload is not None,
            "ruleset_required_contexts": ruleset_contexts,
        },
        "merge": merge_result,
    }


def handle_controlled_merge(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    return emit(
        controlled_merge_payload(
            target_root=target_root,
            output_relative=args.output,
            expected_item=args.item,
            owner=args.owner,
            repo_name=args.repo_name,
            pr_number=args.pr,
            head_sha=args.head_sha,
            merge_method=args.merge_method,
            delete_branch=args.delete_branch,
            execute=args.execute and args.operation == "merge",
            pr_payload_file=args.pr_payload_file,
            status_checks_file=args.status_checks_file,
            branch_protection_file=args.branch_protection_file,
            ruleset_file=args.ruleset_file,
        )
    )


def host_lifecycle_payload(context: dict[str, Any]) -> dict[str, Any]:
    branch = git_branch(context["target_root"])
    purity = purity_report_from_context(context)
    workspace_profile = workspace_profile_from_context(context)
    lifecycle_expectations = workspace_lifecycle_expectations(workspace_profile)
    worktree_root = current_cwd_relative(context["target_root"])
    branch_status = "report_only" if branch else "host_managed_without_local_branch"
    pr_status = "report_only"
    worktree_status = "host_managed"
    missing_inputs: list[str] = []
    if worktree_root is None:
        worktree_observation = "current process is outside the target repository"
    else:
        worktree_observation = worktree_root
    if any(message.startswith("branch purity") for message in purity["report_only"]):
        branch_next = "keep branch lifecycle on the host platform; Loom only reports purity and closeout dependencies."
    else:
        branch_next = "branch lifecycle remains host-managed."
    return {
        "command": "host-lifecycle",
        "item": {
            "id": context["item_id"],
            "goal": context["goal"],
            "scope": context["scope"],
            "execution_path": context["execution_path"],
        },
        "result": "pass",
        "summary": "workspace is Loom-managed; branch, PR, and git worktree lifecycles remain host-managed with explicit boundary checks.",
        "missing_inputs": missing_inputs,
        "fallback_to": None,
        "objects": {
            "workspace": {
                "ownership": "loom",
                "entry": context["workspace_entry"],
                "path": relative_to_root(context["workspace_path"], context["target_root"]),
                "profile": workspace_profile,
                "lifecycle_entry": "python3 .loom/bin/loom_flow.py workspace create|locate|attach|cleanup|retire",
                "lifecycle_expectations": lifecycle_expectations,
            },
            "branch": {
                "ownership": "host",
                "current_branch": branch,
                "purity_status": branch_status,
                "next_action": branch_next,
            },
            "pr": {
                "ownership": "host",
                "purity_status": pr_status,
                "next_action": "use host PR lifecycle; Loom only consumes PR template, required checks, and closeout sync state.",
            },
            "worktree": {
                "ownership": "host",
                "cwd_within_repo": worktree_observation,
                "next_action": "Loom models execution workspace semantics and does not create or retire git worktrees itself.",
                "status": worktree_status,
            },
        },
        "purity": purity,
        "lifecycle_expectations": lifecycle_expectations,
    }


def governance_profile_payload(target_root: Path, operation: str) -> dict[str, Any]:
    governance_surface = build_governance_surface(target_root)
    control_plane = governance_surface.get("governance_control_plane")
    maturity = control_plane.get("maturity") if isinstance(control_plane, dict) else None
    if not isinstance(maturity, dict):
        return {
            "command": "governance-profile",
            "operation": operation,
            "result": "block",
            "summary": "governance profile maturity could not be read from the unified control plane.",
            "missing_inputs": ["governance_control_plane.maturity"],
            "fallback_to": "admission",
            "governance_surface": governance_surface,
        }

    current = maturity.get("current")
    next_level = maturity.get("next")
    target_level = next_level if isinstance(next_level, str) else current if isinstance(current, str) else None
    gate_rollout = maturity.get("gate_rollout")
    workspace_profile = control_plane.get("workspace_profile") if isinstance(control_plane, dict) else None
    gate_starter = control_plane.get("gate_starter") if isinstance(control_plane, dict) else None
    github_control_plane = governance_surface.get("github_control_plane")
    ci_check_presence = (
        github_control_plane.get("ci_check_presence")
        if isinstance(github_control_plane, dict)
        else None
    )
    host_enforcement = (
        github_control_plane.get("host_enforcement")
        if isinstance(github_control_plane, dict)
        else None
    )
    api_snapshot = (
        github_control_plane.get("api_snapshot")
        if isinstance(github_control_plane, dict)
        else None
    )
    host_verification_status = (
        api_snapshot.get("verification_status")
        if isinstance(api_snapshot, dict)
        else "unverified"
    )
    missing_by_level = maturity.get("missing_by_level")
    missing_details_by_level = maturity.get("missing_details_by_level")
    missing_inputs: list[Any] = []
    missing_details: list[Any] = []
    if operation == "upgrade-plan" and isinstance(next_level, str) and isinstance(missing_by_level, dict):
        raw_missing = missing_by_level.get(next_level, [])
        if isinstance(raw_missing, list):
            missing_inputs = raw_missing
        if isinstance(missing_details_by_level, dict):
            raw_details = missing_details_by_level.get(next_level, [])
            if isinstance(raw_details, list):
                missing_details = raw_details
    result = "pass" if not missing_inputs else "block"
    summary = (
        f"governance profile is already at `{current}` maturity."
        if operation == "status" or result == "pass"
        else f"governance profile can upgrade toward `{next_level}` after the missing contracts are installed."
    )
    decisions = adoption_decisions_payload(target_root, target_level=target_level, maturity=maturity)
    guided_plan = guided_adoption_plan_payload(decisions)
    generation = companion_generation_payload(target_root, decisions, dry_run=True)
    return {
        "command": "governance-profile",
        "operation": operation,
        "result": result,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "missing_details": missing_details,
        "recommended_action": "run governance-profile upgrade --dry-run" if result == "block" else None,
        "fallback_to": None if result == "pass" else "adoption",
        "maturity": maturity,
        "workspace_profile": workspace_profile,
        "gate_starter": gate_starter,
        "ci_check_presence": ci_check_presence,
        "host_enforcement": host_enforcement,
        "host_verification_status": host_verification_status,
        "gate_rollout": gate_rollout,
        "governance_control_plane": control_plane,
        "adoption_decisions": decisions,
        "guided_adoption_plan": guided_plan,
        "companion_generation": generation,
    }


UPGRADE_SCAFFOLD: dict[str, str] = {
    **companion_text_payloads(),
    **{
        relative: json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        for relative, payload in companion_json_payloads().items()
    },
}


def governance_upgrade_actions(target_root: Path, target_level: str, maturity: dict[str, Any]) -> list[dict[str, Any]]:
    missing_by_level = maturity.get("missing_by_level")
    missing_details_by_level = maturity.get("missing_details_by_level")
    missing = missing_by_level.get(target_level, []) if isinstance(missing_by_level, dict) else []
    missing_details = missing_details_by_level.get(target_level, []) if isinstance(missing_details_by_level, dict) else []
    actions: list[dict[str, Any]] = []
    for relative, content in UPGRADE_SCAFFOLD.items():
        path = target_root / relative
        owner = "loom-owned" if relative.startswith(".loom/") else "repo-owned"
        actions.append(
            {
                "action": "write_scaffold" if not path.exists() else "keep_existing",
                "path": relative,
                "owner": owner,
                "status": "present" if path.exists() else "planned",
                "reason": "required by governance profile upgrade path",
                "bytes": len(content.encode("utf-8")),
            }
        )
    for item in missing if isinstance(missing, list) else []:
        detail = next((row for row in missing_details if isinstance(row, dict) and row.get("id") == item), {})
        actions.append(
            {
                "action": "satisfy_missing_input",
                "id": item,
                "owner": (
                    "loom-owned"
                    if str(item) in {"repo_interface", "repo_interop"}
                    else "profile"
                ),
                "status": "planned",
                "layer": detail.get("layer"),
                "recommended_action": detail.get("recommended_action"),
                "reason": f"`{target_level}` maturity currently reports this missing input.",
            }
        )
    return actions


def governance_profile_upgrade_payload(
    *,
    target_root: Path,
    target_level: str | None,
    dry_run: bool,
    force: bool,
) -> dict[str, Any]:
    if target_level is None:
        return {
            "command": "governance-profile",
            "operation": "upgrade",
            "result": "block",
            "summary": "governance profile upgrade requires `--to standard` or `--to strong`.",
            "missing_inputs": ["to"],
            "fallback_to": "adoption",
        }
    base = governance_profile_payload(target_root, "upgrade-plan")
    maturity = base.get("maturity") if isinstance(base.get("maturity"), dict) else {}
    workspace_profile = base.get("workspace_profile")
    gate_starter = base.get("gate_starter")
    ci_check_presence = base.get("ci_check_presence")
    host_enforcement = base.get("host_enforcement")
    host_verification_status = base.get("host_verification_status")
    actions = governance_upgrade_actions(target_root, target_level, maturity if isinstance(maturity, dict) else {})
    blockers: list[str] = []
    written_files: list[str] = []
    decisions = adoption_decisions_payload(target_root, target_level=target_level, maturity=maturity if isinstance(maturity, dict) else {})
    if not dry_run:
        written_files, companion_blockers = apply_companion_generation(target_root, force=force)
        blockers.extend(companion_blockers)
    result = "block" if blockers else "pass"
    guided_plan = guided_adoption_plan_payload(decisions)
    generation = companion_generation_payload(
        target_root,
        decisions,
        dry_run=dry_run,
        written_files=written_files,
        blockers=blockers,
    )
    return {
        "command": "governance-profile",
        "operation": "upgrade",
        "schema_version": "loom-governance-upgrade/v1",
        "result": result,
        "summary": (
            f"governance profile upgrade toward `{target_level}` produced a dry-run action plan."
            if dry_run and result == "pass"
            else f"governance profile upgrade toward `{target_level}` applied Loom-owned scaffold writes."
            if result == "pass"
            else f"governance profile upgrade toward `{target_level}` is blocked by unsafe writes."
        ),
        "missing_inputs": blockers,
        "fallback_to": None if result == "pass" else "adoption",
        "target_maturity": target_level,
        "dry_run": dry_run,
        "force": force,
        "actions": actions,
        "written_files": written_files,
        "maturity": maturity,
        "workspace_profile": workspace_profile,
        "gate_starter": gate_starter,
        "ci_check_presence": ci_check_presence,
        "host_enforcement": host_enforcement,
        "host_verification_status": host_verification_status,
        "gate_rollout": maturity.get("gate_rollout") if isinstance(maturity, dict) else None,
        "adoption_decisions": decisions,
        "guided_adoption_plan": guided_plan,
        "companion_generation": generation,
    }


def maturity_upgrade_path(governance_surface: dict[str, Any], target_root: Path) -> dict[str, Any]:
    control_plane = governance_surface.get("governance_control_plane")
    maturity = control_plane.get("maturity") if isinstance(control_plane, dict) else None
    if not isinstance(maturity, dict):
        return {
            "result": "block",
            "current": "unknown",
            "next": None,
            "missing_inputs": ["governance_control_plane.maturity"],
            "missing_details": [],
            "fallback_to": "admission",
            "upgrade_entry": None,
            "validation_entries": [],
        }
    current = maturity.get("current")
    next_level = maturity.get("next")
    target_level = next_level if isinstance(next_level, str) else current if isinstance(current, str) else None
    gate_rollout = maturity.get("gate_rollout")
    missing_by_level = maturity.get("missing_by_level")
    missing_details_by_level = maturity.get("missing_details_by_level")
    missing_inputs = []
    missing_details = []
    if isinstance(next_level, str):
        if isinstance(missing_by_level, dict) and isinstance(missing_by_level.get(next_level), list):
            missing_inputs = list(missing_by_level[next_level])
        if isinstance(missing_details_by_level, dict) and isinstance(missing_details_by_level.get(next_level), list):
            missing_details = list(missing_details_by_level[next_level])
    decisions = adoption_decisions_payload(target_root, target_level=target_level, maturity=maturity)
    guided_plan = guided_adoption_plan_payload(decisions)
    return {
        "result": "pass" if next_level is None else "block",
        "current": current,
        "next": next_level,
        "missing_inputs": missing_inputs,
        "missing_details": missing_details,
        "fallback_to": None if next_level is None else "adoption",
        "upgrade_entry": (
            f"python3 tools/loom_flow.py governance-profile upgrade --target {command_target(target_root)} --to {next_level} --dry-run"
            if isinstance(next_level, str)
            else None
        ),
        "validation_entries": [
            f"python3 tools/loom_flow.py governance-profile status --target {command_target(target_root)}",
            f"python3 tools/loom_flow.py governance-profile upgrade-plan --target {command_target(target_root)}",
        ],
        "gate_rollout": gate_rollout,
        "adoption_decisions": decisions,
        "guided_adoption_plan": guided_plan,
    }


def issue_binding_entry(role: str, number: int | None, payload: dict[str, Any] | None, errors: list[str]) -> dict[str, Any]:
    status = "present" if payload is not None else "missing"
    if errors:
        status = "unreadable"
    return {
        "role": role,
        "number": number,
        "status": status,
        "state": payload.get("state") if payload else None,
        "title": payload.get("title") if payload else None,
        "url": payload.get("url") if payload else None,
        "errors": errors,
    }


def text_mentions_issue(text: object, issue_number: int) -> bool:
    if not isinstance(text, str):
        return False
    pattern = re.compile(rf"(?i)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs?|related)\s+#?{issue_number}\b|#{issue_number}\b")
    return bool(pattern.search(text))


def github_binding_payload(
    *,
    target_root: Path,
    owner: str | None,
    repo_name: str | None,
    phase_number: int | None,
    fr_number: int | None,
    issue_number: int | None,
    pr_number: int | None,
    branch_name: str | None,
    sync: bool,
    dry_run: bool,
    require_complete_chain: bool = True,
) -> dict[str, Any]:
    detected_owner, detected_repo = detect_github_repo(target_root)
    owner = owner or detected_owner
    repo_name = repo_name or detected_repo
    missing_inputs: list[str] = []
    findings: list[dict[str, Any]] = []
    repair_plan: list[dict[str, Any]] = []

    if not owner or not repo_name:
        missing_inputs.append("owner/repo")
    if issue_number is None:
        missing_inputs.append("work_item issue")
    if sync and not dry_run:
        missing_inputs.append("dry-run")
        findings.append(
            {
                "category": "gate_failure",
                "kind": "binding_failure",
                "severity": "block",
                "subject": "governance-profile binding sync",
                "why_blocking": "binding sync is read-only in this phase unless --dry-run is set.",
                "fallback_to": "github-profile-binding",
                "evidence": {"sync": sync, "dry_run": dry_run},
            }
        )

    phase_payload: dict[str, Any] | None = None
    fr_payload: dict[str, Any] | None = None
    issue_payload: dict[str, Any] | None = None
    pr_payload: dict[str, Any] | None = None
    branch_payload: dict[str, Any] | None = None
    phase_errors: list[str] = []
    fr_errors: list[str] = []
    issue_errors: list[str] = []
    pr_errors: list[str] = []
    branch_errors: list[str] = []

    if owner and repo_name:
        if phase_number is not None:
            phase_payload, phase_errors = github_issue_payload(target_root, owner, repo_name, phase_number)
            missing_inputs.extend(f"phase: {message}" for message in phase_errors)
        if fr_number is not None:
            fr_payload, fr_errors = github_issue_payload(target_root, owner, repo_name, fr_number)
            missing_inputs.extend(f"fr: {message}" for message in fr_errors)
        if issue_number is not None:
            issue_payload, issue_errors = github_issue_payload(target_root, owner, repo_name, issue_number)
            missing_inputs.extend(f"work_item: {message}" for message in issue_errors)
        if pr_number is not None:
            pr_payload, pr_errors = github_pr_payload(target_root, owner, repo_name, pr_number)
            missing_inputs.extend(f"pr: {message}" for message in pr_errors)

    inferred_branch = branch_name
    if inferred_branch is None and pr_payload is not None and isinstance(pr_payload.get("headRefName"), str):
        inferred_branch = pr_payload.get("headRefName")
    if owner and repo_name and inferred_branch:
        branch_payload, branch_errors = github_branch_payload(target_root, owner, repo_name, inferred_branch)
        missing_inputs.extend(f"branch: {message}" for message in branch_errors)

    if issue_payload is not None and pr_payload is not None:
        pr_body = pr_payload.get("body")
        if not text_mentions_issue(pr_body, int(issue_payload.get("number") or issue_number or 0)):
            findings.append(
                {
                    "category": "gate_failure",
                    "kind": "binding_failure",
                    "severity": "block",
                    "subject": f"PR #{pr_number} -> Work Item #{issue_number}",
                    "why_blocking": "implementation PR body does not mention the Work Item issue.",
                    "fallback_to": "github-profile-binding",
                    "evidence": {
                        "pr_number": pr_number,
                        "issue_number": issue_number,
                        "expected_reference": f"#{issue_number}",
                    },
                }
            )
            repair_plan.append(
                {
                    "action": "update_pr_body",
                    "subject": f"PR #{pr_number}",
                    "body_append": f"\n\nRelated Work\n\n- Closes #{issue_number}\n",
                    "mode": "dry-run" if dry_run else "not-applied",
                }
            )
    if issue_payload is not None and fr_payload is not None and not text_mentions_issue(issue_payload.get("body"), int(fr_number or 0)):
        findings.append(
            {
                "category": "gate_failure",
                "kind": "binding_failure",
                "severity": "block",
                "subject": f"Work Item #{issue_number} -> FR #{fr_number}",
                "why_blocking": "Work Item issue body does not mention the FR issue.",
                "fallback_to": "github-profile-binding",
                "evidence": {"work_item": issue_number, "fr": fr_number, "expected_reference": f"#{fr_number}"},
            }
        )
    if fr_payload is not None and phase_payload is not None and not text_mentions_issue(fr_payload.get("body"), int(phase_number or 0)):
        findings.append(
            {
                "category": "gate_failure",
                "kind": "binding_failure",
                "severity": "block",
                "subject": f"FR #{fr_number} -> Phase #{phase_number}",
                "why_blocking": "FR issue body does not mention the Phase issue.",
                "fallback_to": "github-profile-binding",
                "evidence": {"fr": fr_number, "phase": phase_number, "expected_reference": f"#{phase_number}"},
            }
        )

    merge_commit = pr_payload.get("mergeCommit") if isinstance(pr_payload, dict) else None
    merge_commit_sha = merge_commit.get("oid") if isinstance(merge_commit, dict) else None
    target_branch = pr_payload.get("baseRefName") if isinstance(pr_payload, dict) else None
    binding = {
        "schema_version": "loom-github-binding/v1",
        "repository": {"owner": owner, "name": repo_name},
        "objects": {
            "phase": issue_binding_entry("phase", phase_number, phase_payload, phase_errors),
            "fr": issue_binding_entry("fr", fr_number, fr_payload, fr_errors),
            "work_item": issue_binding_entry("work_item", issue_number, issue_payload, issue_errors),
            "branch": {
                "role": "branch",
                "name": inferred_branch,
                "status": "present" if branch_payload is not None else ("unreadable" if branch_errors else "missing"),
                "head_sha": branch_payload.get("commit", {}).get("sha") if isinstance(branch_payload, dict) and isinstance(branch_payload.get("commit"), dict) else None,
                "errors": branch_errors,
            },
            "implementation_pr": {
                "role": "implementation_pr",
                "number": pr_number,
                "status": "present" if pr_payload is not None else ("unreadable" if pr_errors else "missing"),
                "state": pr_payload.get("state") if pr_payload else None,
                "isDraft": pr_payload.get("isDraft") if pr_payload else None,
                "headRefName": pr_payload.get("headRefName") if pr_payload else None,
                "baseRefName": pr_payload.get("baseRefName") if pr_payload else None,
                "url": pr_payload.get("url") if pr_payload else None,
                "errors": pr_errors,
            },
            "merge_commit": {
                "role": "merge_commit",
                "sha": merge_commit_sha,
                "status": "present" if merge_commit_sha else "missing",
            },
            "target_branch": {
                "role": "target_branch",
                "name": target_branch,
                "status": "present" if target_branch else "missing",
            },
        },
        "chain": [
            {"from": "phase", "to": "fr", "status": "present" if phase_payload and fr_payload else "missing"},
            {"from": "fr", "to": "work_item", "status": "present" if fr_payload and issue_payload else "missing"},
            {"from": "work_item", "to": "implementation_pr", "status": "present" if issue_payload and pr_payload else "missing"},
            {"from": "implementation_pr", "to": "merge_commit", "status": "present" if merge_commit_sha else "missing"},
            {"from": "merge_commit", "to": "target_branch", "status": "present" if merge_commit_sha and target_branch else "missing"},
        ],
        "findings": findings,
        "repair_plan": repair_plan if sync or dry_run else [],
    }
    if require_complete_chain:
        chain_complete = all(entry.get("status") == "present" for entry in binding["chain"])
    else:
        required_edges = []
        if issue_number is not None and pr_number is not None:
            required_edges.append(("work_item", "implementation_pr"))
        if pr_number is not None and pr_payload is not None and pr_payload.get("state") == "MERGED":
            required_edges.extend([("implementation_pr", "merge_commit"), ("merge_commit", "target_branch")])
        chain_complete = all(
            entry.get("status") == "present"
            for entry in binding["chain"]
            if (entry.get("from"), entry.get("to")) in required_edges
        )
    if not chain_complete and "binding_chain" not in missing_inputs:
        missing_inputs.append("binding_chain")
    result = "pass" if not missing_inputs and not findings and chain_complete else "block"
    return {
        "command": "governance-profile",
        "operation": "binding",
        "schema_version": "loom-github-binding/v1",
        "result": result,
        "summary": (
            "GitHub profile binding chain is readable."
            if result == "pass"
            else "GitHub profile binding chain is incomplete or inconsistent."
        ),
        "missing_inputs": missing_inputs,
        "fallback_to": None if result == "pass" else "github-profile-binding",
        "binding": binding,
    }


def handle_governance_profile(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    if args.operation == "upgrade":
        return emit(
            governance_profile_upgrade_payload(
                target_root=target_root,
                target_level=args.to,
                dry_run=args.dry_run,
                force=args.force,
            )
        )
    if args.operation == "binding":
        return emit(
            github_binding_payload(
                target_root=target_root,
                owner=args.owner,
                repo_name=args.repo_name,
                phase_number=args.phase,
                fr_number=args.fr,
                issue_number=args.issue,
                pr_number=args.pr,
                branch_name=args.branch,
                sync=args.sync,
                dry_run=args.dry_run,
            )
        )
    return emit(governance_profile_payload(target_root, args.operation))


def handle_host_lifecycle(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        return emit(
            {
                "command": "host-lifecycle",
                "result": "block",
                "summary": "host-lifecycle could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
            }
        )
    return emit(host_lifecycle_payload(context))


def project_status_context(root: Path, owner: str, project_number: int) -> tuple[dict[str, Any], list[str]]:
    project_view, view_errors = gh_json(root, ["project", "view", str(project_number), "--owner", owner, "--format", "json"])
    if view_errors or project_view is None:
        return {}, view_errors
    field_list_payload, field_errors = gh_json(root, ["project", "field-list", str(project_number), "--owner", owner, "--format", "json"])
    if field_errors or field_list_payload is None:
        return {}, field_errors
    fields = field_list_payload.get("fields")
    if not isinstance(fields, list):
        return {}, ["project field list is missing `fields`"]
    status_field_id: str | None = None
    done_option_id: str | None = None
    for field in fields:
        if not isinstance(field, dict):
            continue
        if field.get("name") != "Status":
            continue
        status_field_id = str(field.get("id"))
        options = field.get("options")
        if isinstance(options, list):
            for option in options:
                if isinstance(option, dict) and option.get("name") == "Done":
                    done_option_id = str(option.get("id"))
    project_id = project_view.get("id")
    if not isinstance(project_id, str) or not project_id:
        return {}, ["project view is missing `id`"]
    if not status_field_id or not done_option_id:
        return {}, ["project is missing a `Status` field with a `Done` option"]
    item_list = run_process(["gh", "project", "item-list", str(project_number), "--owner", owner, "--format", "json"], root)
    if item_list.returncode != 0:
        detail = item_list.stderr.strip() or item_list.stdout.strip() or "gh project item-list failed"
        return {}, [detail]
    try:
        payload = json.loads(item_list.stdout)
    except json.JSONDecodeError as exc:
        return {}, [f"invalid JSON from gh project item-list: {exc.msg}"]
    items = payload.get("items")
    if not isinstance(items, list):
        return {}, ["project item list is missing `items`"]
    return {
        "project_id": project_id,
        "status_field_id": status_field_id,
        "done_option_id": done_option_id,
        "items": items,
    }, []


def find_project_item(items: list[dict[str, Any]], number: int, kind: str) -> dict[str, Any] | None:
    for item in items:
        content = item.get("content")
        if not isinstance(content, dict):
            continue
        if content.get("number") != number:
            continue
        item_type = content.get("type")
        if kind == "issue" and item_type == "Issue":
            return item
        if kind == "pr" and item_type == "PullRequest":
            return item
    return None


def project_item_for_issue(root: Path, issue_id: str, project_number: int) -> tuple[dict[str, Any] | None, list[str]]:
    # GraphQL-only for now: GitHub ProjectV2 item field values are not covered by the REST budget-hardening pass.
    query = """
query($id: ID!) {
  node(id: $id) {
    ... on Issue {
      projectItems(first: 50) {
        nodes {
          id
          project {
            number
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
                name
              }
            }
          }
        }
      }
    }
  }
}
"""
    data, errors = gh_graphql(root, query, {"id": issue_id})
    if errors or data is None:
        return None, errors
    node = data.get("node")
    if not isinstance(node, dict):
        return None, ["issue graphql payload is missing `node`"]
    project_items = node.get("projectItems")
    if not isinstance(project_items, dict):
        return None, ["issue graphql payload is missing `projectItems`"]
    nodes = project_items.get("nodes")
    if not isinstance(nodes, list):
        return None, ["issue graphql payload is missing `projectItems.nodes`"]
    for entry in nodes:
        if not isinstance(entry, dict):
            continue
        project = entry.get("project")
        if not isinstance(project, dict) or project.get("number") != project_number:
            continue
        status_name = None
        field_values = entry.get("fieldValues")
        if isinstance(field_values, dict):
            values = field_values.get("nodes")
            if isinstance(values, list):
                for value in values:
                    if not isinstance(value, dict):
                        continue
                    field = value.get("field")
                    if isinstance(field, dict) and field.get("name") == "Status":
                        name = value.get("name")
                        if isinstance(name, str) and name:
                            status_name = name
        return {
            "id": entry.get("id"),
            "content": {"number": None, "type": "Issue"},
            "status": status_name,
            "budget_guard": graphql_budget_guard("project_v2_item_field_values"),
        }, []
    return None, []


def set_project_item_done(root: Path, project_id: str, item_id: str, status_field_id: str, done_option_id: str) -> list[str]:
    result = run_process(
        [
            "gh",
            "project",
            "item-edit",
            "--id",
            item_id,
            "--project-id",
            project_id,
            "--field-id",
            status_field_id,
            "--single-select-option-id",
            done_option_id,
        ],
        root,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "gh project item-edit failed"
        return [detail]
    return []


def issue_tree_payload(root: Path, owner: str, repo_name: str, issue_number: int) -> tuple[dict[str, Any] | None, list[str]]:
    # GraphQL-only for now: native parent/sub-issue tree shape is outside the high-frequency REST replacement scope.
    query = """
query($owner:String!, $name:String!, $number:Int!) {
  repository(owner:$owner, name:$name) {
    issue(number:$number) {
      id
      number
      title
      state
      url
      parent {
        id
        number
        title
        state
        url
        subIssues(first:50) {
          nodes {
            id
            number
            title
            state
            url
          }
        }
      }
      subIssues(first:50) {
        nodes {
          id
          number
          title
          state
          url
        }
      }
    }
  }
}
"""
    data, errors = gh_graphql(root, query, {"owner": owner, "name": repo_name, "number": issue_number})
    if errors or data is None:
        return None, errors
    repository = data.get("repository")
    if not isinstance(repository, dict):
        return None, ["issue tree graphql payload is missing `repository`"]
    issue = repository.get("issue")
    if not isinstance(issue, dict):
        return None, [f"issue #{issue_number} is missing from GraphQL payload"]
    issue["budget_guard"] = graphql_budget_guard("native_parent_sub_issue_tree")
    return issue, []


def github_compare_contains_commit(
    root: Path,
    *,
    owner: str,
    repo_name: str,
    merge_commit_sha: str,
    target_branch: str,
) -> bool:
    payload, errors = gh_rest_json(
        root,
        f"repos/{owner}/{repo_name}/compare/{quote(merge_commit_sha, safe='')}...{quote(target_branch, safe='')}",
    )
    if errors or payload is None:
        return False
    return payload.get("status") in {"ahead", "identical"}


def contains_merged_commit(
    root: Path,
    merge_commit_sha: str,
    target_branch: str = "main",
    *,
    owner: str | None = None,
    repo_name: str | None = None,
) -> bool:
    remote_ref = f"refs/remotes/origin/{target_branch}"
    fetched_ref = f"refs/heads/{target_branch}:{remote_ref}"
    fetched = run_git(root, ["fetch", "origin", fetched_ref])
    if fetched is not None and fetched.returncode == 0:
        contains = run_git(root, ["merge-base", "--is-ancestor", merge_commit_sha, remote_ref])
        if contains is not None and contains.returncode == 0:
            return True
    if owner is None or repo_name is None:
        detected_owner, detected_repo = detect_github_repo(root)
        owner = owner or detected_owner
        repo_name = repo_name or detected_repo
    if not owner or not repo_name:
        return False
    return github_compare_contains_commit(
        root,
        owner=owner,
        repo_name=repo_name,
        merge_commit_sha=merge_commit_sha,
        target_branch=target_branch,
    )


def make_reconciliation_finding(
    *,
    kind: str,
    severity: str,
    subject: str,
    evidence: dict[str, Any],
    recommended_action: str,
    category: str = "drift",
    fallback_to: str | None = None,
) -> dict[str, Any]:
    if fallback_to is None:
        fallback_to = "manual-reconciliation" if severity == "block" else "reconciliation-sync"
    return {
        "category": category,
        "kind": kind,
        "severity": severity,
        "subject": subject,
        "evidence": evidence,
        "recommended_action": recommended_action,
        "fallback_to": fallback_to,
    }


def reconciliation_result(findings: list[dict[str, Any]]) -> str:
    if not findings:
        return "pass"
    rank = {"warn": 1, "fix-needed": 2, "block": 3}
    highest = max(rank.get(str(finding.get("severity")), 0) for finding in findings)
    if highest == 3:
        return "block"
    if highest == 2:
        return "fix-needed"
    return "warn"


def reconciliation_audit_payload(
    *,
    target_root: Path,
    phase_number: int | None,
    fr_number: int | None,
    issue_number: int | None,
    pr_number: int | None,
    project_number: int | None,
    branch_name: str | None,
    owner: str,
    repo_name: str,
) -> tuple[dict[str, Any], list[str]]:
    missing_inputs: list[str] = []
    findings: list[dict[str, Any]] = []

    if issue_number is None and pr_number is None and project_number is None:
        missing_inputs.append("issue/pr/project")

    binding_payload = github_binding_payload(
        target_root=target_root,
        owner=owner,
        repo_name=repo_name,
        phase_number=phase_number,
        fr_number=fr_number,
        issue_number=issue_number,
        pr_number=pr_number,
        branch_name=branch_name,
        sync=False,
        dry_run=False,
        require_complete_chain=False,
    )
    binding = binding_payload.get("binding") if isinstance(binding_payload.get("binding"), dict) else None
    binding_findings = binding.get("findings") if isinstance(binding, dict) else None
    if isinstance(binding_findings, list):
        for finding in binding_findings:
            if isinstance(finding, dict):
                findings.append(
                    make_reconciliation_finding(
                        kind="binding_failure",
                        severity="block",
                        subject=str(finding.get("subject") or "github profile binding"),
                        evidence={"binding": finding.get("evidence", {}), "binding_result": binding_payload.get("result")},
                        recommended_action="repair the GitHub profile binding chain before reconciliation or closeout.",
                        category="gate_failure",
                        fallback_to="manual-reconciliation",
                    )
                )

    issue_payload: dict[str, Any] | None = None
    issue_id: str | None = None
    parent_payload: dict[str, Any] | None = None
    if issue_number is not None:
        issue_payload, issue_errors = github_issue_payload(target_root, owner, repo_name, issue_number)
        if issue_errors:
            missing_inputs.extend(f"issue: {message}" for message in issue_errors)
        elif issue_payload is not None:
            raw_issue_id = issue_payload.get("id")
            if isinstance(raw_issue_id, str) and raw_issue_id:
                issue_id = raw_issue_id
            issue_tree, issue_tree_errors = issue_tree_payload(target_root, owner, repo_name, issue_number)
            if issue_tree_errors:
                issue_payload["sub_issue_tree"] = {
                    "status": "unavailable",
                    "reason": "GraphQL-only parent/sub-issue tree could not be read.",
                    "errors": issue_tree_errors,
                    "budget_guard": graphql_budget_guard("native_parent_sub_issue_tree", issue_tree_errors),
                }
            elif issue_tree is not None:
                issue_payload = {**issue_payload, **issue_tree}
                parent = issue_payload.get("parent")
                if isinstance(parent, dict):
                    parent_payload = parent

    pr_payload: dict[str, Any] | None = None
    merge_commit_sha: str | None = None
    merge_commit_in_main = False
    if pr_number is not None:
        pr_payload, pr_errors = github_pr_payload(target_root, owner, repo_name, pr_number)
        if pr_errors:
            missing_inputs.extend(f"pr: {message}" for message in pr_errors)
        elif pr_payload is not None:
            merge_commit = pr_payload.get("mergeCommit")
            if isinstance(merge_commit, dict):
                oid = merge_commit.get("oid")
                if isinstance(oid, str) and oid:
                    merge_commit_sha = oid
                    base_ref = pr_payload.get("baseRefName")
                    if isinstance(base_ref, str) and base_ref:
                        merge_commit_in_main = contains_merged_commit(target_root, merge_commit_sha, base_ref)
                    else:
                        findings.append(
                            make_reconciliation_finding(
                                kind="merge_signal_drift",
                                severity="block",
                                subject=f"PR #{pr_number} merge signal",
                                evidence={
                                    "pr_state": pr_payload.get("state"),
                                    "merge_commit": merge_commit_sha,
                                    "baseRefName": base_ref,
                                },
                                recommended_action="re-read the PR base branch before closeout or reconciliation.",
                                category="binding_failure",
                                fallback_to="manual-reconciliation",
                            )
                        )
            if pr_payload.get("state") == "MERGED" and (not merge_commit_sha or not merge_commit_in_main):
                findings.append(
                    make_reconciliation_finding(
                        kind="merge_signal_drift",
                        severity="block",
                        subject=f"PR #{pr_number} merge signal",
                        evidence={
                            "pr_state": pr_payload.get("state"),
                            "merge_commit": merge_commit_sha,
                            "merge_commit_in_main": merge_commit_in_main,
                        },
                        recommended_action="repair or re-read the merge commit basis before closeout.",
                        category="drift",
                        fallback_to="manual-reconciliation",
                    )
                )

    merged_issue_open = False
    if issue_payload is not None and pr_payload is not None:
        if issue_payload.get("state") == "OPEN" and pr_payload.get("state") == "MERGED" and merge_commit_sha and merge_commit_in_main:
            merged_issue_open = True
            findings.append(
                make_reconciliation_finding(
                    kind="merged_but_open",
                    severity="fix-needed",
                    subject=f"issue #{issue_number}",
                    evidence={
                        "issue_state": issue_payload.get("state"),
                        "pr_number": pr_number,
                        "pr_state": pr_payload.get("state"),
                        "merge_commit": merge_commit_sha,
                        "merge_commit_in_main": merge_commit_in_main,
                    },
                    recommended_action="close the merged issue or run reconciliation sync after reviewing the evidence.",
                )
            )

    parent_scope: dict[str, Any] | None = None
    if parent_payload is not None:
        parent_scope = parent_payload
    elif isinstance(issue_payload, dict):
        sub_issues = issue_payload.get("subIssues")
        if isinstance(sub_issues, dict) and isinstance(sub_issues.get("nodes"), list) and sub_issues.get("nodes"):
            parent_scope = issue_payload

    if parent_scope is not None:
        raw_children = parent_scope.get("subIssues")
        child_nodes = raw_children.get("nodes") if isinstance(raw_children, dict) else None
        unresolved_children: list[dict[str, Any]] = []
        resolved_children: list[dict[str, Any]] = []
        if isinstance(child_nodes, list):
            for child in child_nodes:
                if not isinstance(child, dict):
                    continue
                child_number = child.get("number")
                child_state = child.get("state")
                if child_state == "CLOSED":
                    resolved_children.append(child)
                    continue
                if child_number == issue_number and merged_issue_open:
                    resolved_children.append(child)
                    continue
                unresolved_children.append(child)
        parent_number = parent_scope.get("number")
        parent_state = parent_scope.get("state")
        if parent_state == "CLOSED" and unresolved_children:
            findings.append(
                make_reconciliation_finding(
                    kind="parent_drift",
                    severity="block",
                    subject=f"parent issue #{parent_number}",
                    evidence={
                        "parent_state": parent_state,
                        "unresolved_children": [
                            {"number": child.get("number"), "state": child.get("state"), "title": child.get("title")}
                            for child in unresolved_children
                        ],
                    },
                    recommended_action="reopen the parent issue or finish the unresolved child issues before treating the parent as closed out.",
                )
            )
        elif parent_state == "OPEN" and child_nodes and not unresolved_children:
            findings.append(
                make_reconciliation_finding(
                    kind="parent_drift",
                    severity="fix-needed",
                    subject=f"parent issue #{parent_number}",
                    evidence={
                        "parent_state": parent_state,
                        "resolved_children": [
                            {"number": child.get("number"), "state": child.get("state"), "title": child.get("title")}
                            for child in resolved_children
                        ],
                    },
                    recommended_action="reconcile the parent issue because all child gaps are already closed or absorbed.",
                )
            )

    project_payload: dict[str, Any] | None = None
    project_drift_details: list[dict[str, Any]] = []
    if project_number is not None:
        project_context, project_errors = project_status_context(target_root, owner, project_number)
        if project_errors:
            if any("unknown owner type" in message for message in project_errors):
                project_payload = {
                    "number": project_number,
                    "status": "unavailable",
                    "reason": "GitHub ProjectV2 CLI owner resolution is unavailable in this environment.",
                    "errors": project_errors,
                    "budget_guard": graphql_budget_guard("project_v2_status_surface", project_errors),
                }
            else:
                missing_inputs.extend(f"project: {message}" for message in project_errors)
        else:
            items = project_context["items"]
            issue_item = find_project_item(items, issue_number, "issue") if issue_number is not None else None
            issue_item_budget_guard: dict[str, Any] | None = None
            if issue_item is None and issue_id is not None and issue_number is not None:
                issue_item, issue_item_errors = project_item_for_issue(target_root, issue_id, project_number)
                if issue_item_errors:
                    issue_item_budget_guard = graphql_budget_guard(
                        "project_v2_issue_item_lookup",
                        issue_item_errors,
                    )
            pr_item = find_project_item(items, pr_number, "pr") if pr_number is not None else None
            project_payload = {
                "number": project_number,
                "project_id": project_context["project_id"],
                "status_field_id": project_context["status_field_id"],
                "done_option_id": project_context["done_option_id"],
                "issue_item": issue_item,
                "pr_item": pr_item,
            }
            if issue_item_budget_guard is not None:
                project_payload["issue_item_budget_guard"] = issue_item_budget_guard

            if issue_number is not None:
                expected_done = issue_payload is not None and (issue_payload.get("state") == "CLOSED" or merged_issue_open)
                if issue_item is None:
                    project_drift_details.append(
                        {
                            "subject": f"issue #{issue_number}",
                            "reason": "issue is missing from project",
                            "expected_done": expected_done,
                        }
                    )
                else:
                    status = issue_item.get("status")
                    if expected_done and status != "Done":
                        project_drift_details.append(
                            {
                                "subject": f"issue #{issue_number}",
                                "reason": "issue project status is not Done",
                                "expected_done": True,
                                "actual_status": status,
                            }
                        )
                    if not expected_done and status == "Done":
                        project_drift_details.append(
                            {
                                "subject": f"issue #{issue_number}",
                                "reason": "issue project status is Done while the issue still has an open gap",
                                "expected_done": False,
                                "actual_status": status,
                            }
                        )

            if pr_number is not None:
                expected_done = pr_payload is not None and pr_payload.get("state") == "MERGED"
                if pr_item is not None:
                    status = pr_item.get("status")
                    if expected_done and status != "Done":
                        project_drift_details.append(
                            {
                                "subject": f"pr #{pr_number}",
                                "reason": "pr project status is not Done",
                                "expected_done": True,
                                "actual_status": status,
                            }
                        )
                    if not expected_done and status == "Done":
                        project_drift_details.append(
                            {
                                "subject": f"pr #{pr_number}",
                                "reason": "pr project status is Done while the PR is not merged",
                                "expected_done": False,
                                "actual_status": status,
                            }
                        )

    if project_drift_details:
        findings.append(
            make_reconciliation_finding(
                kind="project_drift",
                severity="fix-needed",
                subject=f"project {project_number}",
                evidence={"drifts": project_drift_details},
                recommended_action="align the project items with the audited issue/PR state before closeout.",
            )
        )

    if missing_inputs:
        findings.append(
            make_reconciliation_finding(
                kind="host_signal_drift",
                severity="block",
                subject="github control plane",
                evidence={"missing_inputs": missing_inputs},
                recommended_action="restore readable GitHub issue, PR, project, or repository signals before closeout.",
                category="drift",
                fallback_to="manual-reconciliation",
            )
        )
        result = "block"
        summary = "reconciliation audit could not complete because required GitHub inputs were missing."
    else:
        result = reconciliation_result(findings)
        summary = (
            "reconciliation audit found no merged-but-open, absorbed-but-open, parent-drift, host-signal-drift, or project-drift findings."
            if result == "pass"
            else "reconciliation audit found GitHub drift that must be reviewed before closeout."
        )
    return (
        {
            "command": "reconciliation",
            "operation": "audit",
            "result": result,
            "summary": summary,
            "missing_inputs": missing_inputs,
            "fallback_to": None if result == "pass" else "manual-reconciliation",
            "repo": {"owner": owner, "name": repo_name},
            "issue": issue_payload,
            "parent": parent_payload,
            "pr": pr_payload,
            "project": project_payload,
            "binding": binding,
            "findings": findings,
        },
        [],
    )


def reconciliation_sync_plan(audit_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    plan: list[dict[str, Any]] = []
    skipped_actions: list[dict[str, Any]] = []
    findings = audit_payload.get("findings")
    if not isinstance(findings, list):
        return plan, skipped_actions
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        severity = finding.get("severity")
        kind = finding.get("kind")
        subject = finding.get("subject")
        evidence = finding.get("evidence")
        if severity != "fix-needed":
            continue
        if kind in {"merged_but_open", "absorbed_but_open"}:
            plan.append(
                {
                    "kind": kind,
                    "subject": subject,
                    "action": "close_issue",
                    "issue_number": audit_payload.get("issue", {}).get("number"),
                }
            )
            continue
        if kind == "project_drift":
            project = audit_payload.get("project")
            if not isinstance(project, dict):
                skipped_actions.append(
                    {
                        "kind": kind,
                        "subject": subject,
                        "action": "set_project_status",
                        "reason": "project_drift is missing project context",
                    }
                )
                continue
            drifts = evidence.get("drifts") if isinstance(evidence, dict) else None
            if not isinstance(drifts, list):
                skipped_actions.append(
                    {
                        "kind": kind,
                        "subject": subject,
                        "action": "set_project_status",
                        "reason": "project_drift is missing drift details",
                    }
                )
                continue
            for drift in drifts:
                if not isinstance(drift, dict):
                    continue
                drift_subject = drift.get("subject")
                reason = str(drift.get("reason", ""))
                expected_done = drift.get("expected_done")
                if expected_done is not True:
                    skipped_actions.append(
                        {
                            "kind": kind,
                            "subject": drift_subject,
                            "action": "set_project_status",
                            "reason": f"requires manual reconciliation: {reason}",
                        }
                    )
                    continue
                item_key = None
                if isinstance(drift_subject, str) and drift_subject.startswith("issue #"):
                    item_key = "issue_item"
                elif isinstance(drift_subject, str) and drift_subject.startswith("pr #"):
                    item_key = "pr_item"
                item = project.get(item_key) if item_key else None
                if not isinstance(item, dict):
                    skipped_actions.append(
                        {
                            "kind": kind,
                            "subject": drift_subject,
                            "action": "set_project_status",
                            "reason": "cannot be synced because the project item is missing",
                        }
                    )
                    continue
                item_id = item.get("id")
                project_id = project.get("project_id")
                status_field_id = project.get("status_field_id")
                done_option_id = project.get("done_option_id")
                if not all(isinstance(value, str) and value for value in (item_id, project_id, status_field_id, done_option_id)):
                    skipped_actions.append(
                        {
                            "kind": kind,
                            "subject": drift_subject,
                            "action": "set_project_status",
                            "reason": "is missing project status identifiers",
                        }
                    )
                    continue
                plan.append(
                    {
                        "kind": kind,
                        "subject": drift_subject,
                        "action": "set_project_done",
                        "project_number": project.get("number"),
                        "project_id": project_id,
                        "item_id": item_id,
                        "status_field_id": status_field_id,
                        "done_option_id": done_option_id,
                    }
                )
            continue
        if kind == "parent_drift":
            parent = audit_payload.get("parent")
            parent_number = parent.get("number") if isinstance(parent, dict) else None
            if parent_number is None:
                skipped_actions.append(
                    {
                        "kind": kind,
                        "subject": subject,
                        "action": "close_issue",
                        "reason": "parent_drift is missing parent issue context",
                    }
                )
                continue
            plan.append(
                {
                    "kind": kind,
                    "subject": subject,
                    "action": "close_issue",
                    "issue_number": parent_number,
                }
            )
            continue
        skipped_actions.append(
            {
                "kind": kind,
                "subject": subject,
                "action": "unsupported",
                "reason": f"unsupported reconciliation finding `{kind}`",
            }
        )
    return plan, skipped_actions


def closeout_reconciliation_result(
    audit_payload: dict[str, Any] | None,
) -> tuple[str | None, str | None]:
    if not isinstance(audit_payload, dict):
        return None, None
    result = audit_payload.get("result")
    if result == "fix-needed":
        return "reconciliation-sync", "closeout requires reconciliation sync before it can pass."
    if result == "block":
        return "manual-reconciliation", "closeout requires manual reconciliation because the audit itself is blocked."
    return None, None


def runtime_parity_check(
    name: str,
    *,
    result: str,
    summary: str,
    evidence: dict[str, Any] | None = None,
    missing_inputs: list[str] | None = None,
    fallback_to: str | None = None,
) -> dict[str, Any]:
    return {
        "name": name,
        "result": result,
        "summary": summary,
        "evidence": evidence or {},
        "missing_inputs": missing_inputs or [],
        "fallback_to": fallback_to,
    }


def runtime_parity_payload(
    *,
    target_root: Path,
    output_relative: str,
    expected_item: str | None,
) -> dict[str, Any]:
    runtime_state = runtime_state_payload(target_root)
    checks: list[dict[str, Any]] = []
    if runtime_state["result"] != "pass":
        checks.append(
            runtime_parity_check(
                "runtime_state",
                result="block",
                summary="runtime carrier is not consistent enough to prove runtime parity.",
                missing_inputs=list(runtime_state.get("missing_inputs", [])),
                fallback_to=runtime_state.get("fallback_to"),
                evidence={"runtime_state": runtime_state},
            )
        )
        return {
            "command": "runtime-parity",
            "operation": "validate",
            "schema_version": "loom-runtime-parity/v1",
            "result": "block",
            "summary": "Loom core runtime parity validation is blocked by runtime-state drift.",
            "missing_inputs": list(runtime_state.get("missing_inputs", [])),
            "fallback_to": runtime_state.get("fallback_to"),
            "runtime_state": runtime_state,
            "checks": checks,
        }

    context, context_errors = load_context(target_root, output_relative, expected_item)
    governance_surface = build_governance_surface(target_root)
    control_plane = governance_surface.get("governance_control_plane")
    carrier_summary = governance_surface.get("carrier_summary")

    if context_errors:
        checks.append(
            runtime_parity_check(
                "work_item",
                result="block",
                summary="runtime parity could not read the Work Item fact chain.",
                missing_inputs=[f"fact-chain: {message}" for message in context_errors],
                fallback_to="admission",
            )
        )
    else:
        checks.append(
            runtime_parity_check(
                "work_item",
                result="pass",
                summary="Work Item is readable as the single execution entry.",
                evidence={
                    "item_id": context["item_id"],
                    "work_item": context["report"]["fact_chain"]["entry_points"]["work_item"],
                    "recovery_entry": context["report"]["fact_chain"]["entry_points"]["recovery_entry"],
                    "status_surface": context["report"]["fact_chain"]["entry_points"]["status_surface"],
                },
            )
        )

    if isinstance(control_plane, dict) and control_plane.get("schema_version") == "loom-governance-control/v1":
        checks.append(
            runtime_parity_check(
                "status_control_plane",
                result="pass",
                summary="governance control plane is available as a machine-readable runtime surface.",
                evidence={
                    "schema_version": control_plane.get("schema_version"),
                    "taxonomy": sorted((control_plane.get("taxonomy") or {}).keys())
                    if isinstance(control_plane.get("taxonomy"), dict)
                    else [],
                    "maturity": (control_plane.get("maturity") or {}).get("current")
                    if isinstance(control_plane.get("maturity"), dict)
                    else None,
                },
            )
        )
    else:
        checks.append(
            runtime_parity_check(
                "status_control_plane",
                result="block",
                summary="governance control plane is missing or unreadable.",
                missing_inputs=["governance_control_plane"],
                fallback_to="admission",
            )
        )

    expected_gate_order = [
        "work_item_admission",
        "spec_gate",
        "build_gate",
        "review_gate",
        "merge_gate",
        "github_controlled_merge",
        "closeout",
    ]
    gate_chain = control_plane.get("gate_chain") if isinstance(control_plane, dict) else None
    actual_gate_order = [entry.get("id") for entry in gate_chain if isinstance(entry, dict)] if isinstance(gate_chain, (list, tuple)) else []
    checks.append(
        runtime_parity_check(
            "gate_chain",
            result="pass" if actual_gate_order == expected_gate_order else "block",
            summary=(
                "strong governance gate chain is available in runtime order."
                if actual_gate_order == expected_gate_order
                else "strong governance gate chain does not match the runtime parity contract."
            ),
            evidence={"gate_order": actual_gate_order, "expected_gate_order": expected_gate_order},
            missing_inputs=[] if actual_gate_order == expected_gate_order else ["governance_control_plane.gate_chain"],
            fallback_to=None if actual_gate_order == expected_gate_order else "admission",
        )
    )

    host_binding = control_plane.get("host_binding") if isinstance(control_plane, dict) else None
    required_objects = host_binding.get("required_objects") if isinstance(host_binding, dict) else None
    controlled_merge_ready = (
        isinstance(host_binding, dict)
        and isinstance(required_objects, dict)
        and {"implementation_pr", "merge_commit", "closeout"}.issubset(required_objects.keys())
    )
    checks.append(
        runtime_parity_check(
            "controlled_merge_contract",
            result="pass" if controlled_merge_ready else "block",
            summary=(
                "controlled merge contract exposes PR, merge commit, and closeout host-owned bindings."
                if controlled_merge_ready
                else "controlled merge contract is missing required host-owned bindings."
            ),
            evidence={
                "host_binding_result": host_binding.get("result") if isinstance(host_binding, dict) else None,
                "required_objects": sorted(required_objects.keys()) if isinstance(required_objects, dict) else [],
            },
            missing_inputs=[] if controlled_merge_ready else ["governance_control_plane.host_binding"],
            fallback_to=None if controlled_merge_ready else "merge",
        )
    )

    closeout_gate = next((entry for entry in gate_chain or [] if isinstance(entry, dict) and entry.get("id") == "closeout"), {})
    closeout_requires = closeout_gate.get("requires") if isinstance(closeout_gate, dict) else None
    closeout_ready = isinstance(closeout_requires, (list, tuple)) and "reconciliation_audit" in closeout_requires
    checks.append(
        runtime_parity_check(
            "closeout_reconciliation",
            result="pass" if closeout_ready else "block",
            summary=(
                "closeout gate consumes reconciliation audit as a runtime prerequisite."
                if closeout_ready
                else "closeout gate does not expose reconciliation audit as a runtime prerequisite."
            ),
            evidence={
                "closeout_requires": closeout_requires if isinstance(closeout_requires, (list, tuple)) else [],
                "repo_interop_availability": (governance_surface.get("repo_interop") or {}).get("availability")
                if isinstance(governance_surface.get("repo_interop"), dict)
                else None,
            },
            missing_inputs=[] if closeout_ready else ["governance_control_plane.gate_chain.closeout"],
            fallback_to=None if closeout_ready else "reconciliation-sync",
        )
    )

    checks.append(
        runtime_parity_check(
            "shadow_parity_boundary",
            result="pass",
            summary="shadow parity remains validation-only in Loom core runtime parity.",
            evidence={
                "default_result_contract": ["pass", "warn"],
                "blocking_default": False,
                "surfaces": list(SHADOW_PARITY_SURFACES),
            },
        )
    )

    if not isinstance(carrier_summary, dict):
        checks.append(
            runtime_parity_check(
                "carrier_summary",
                result="block",
                summary="carrier summary is missing from governance surface.",
                missing_inputs=["governance_surface.carrier_summary"],
                fallback_to="admission",
            )
        )

    missing_inputs: list[str] = []
    fallback_to: str | None = None
    for check in checks:
        if check["result"] == "block":
            fallback_to = fallback_to or check.get("fallback_to")
            for message in check.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(message)

    result = "pass" if not missing_inputs else "block"
    return {
        "command": "runtime-parity",
        "operation": "validate",
        "schema_version": "loom-runtime-parity/v1",
        "result": result,
        "summary": (
            "Loom core runtime parity is machine-readable across Work Item, status, gates, controlled merge, closeout, and shadow boundary."
            if result == "pass"
            else "Loom core runtime parity validation found missing or unreadable runtime surfaces."
        ),
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to,
        "runtime_state": runtime_state,
        "checks": checks,
    }


def closeout_payload(
    *,
    target_root: Path,
    phase_number: int | None,
    fr_number: int | None,
    issue_number: int | None,
    pr_number: int | None,
    project_number: int | None,
    branch_name: str | None,
    owner: str,
    repo_name: str,
    skip_gate: bool,
) -> tuple[dict[str, Any], list[str]]:
    missing_inputs: list[str] = []
    context, context_errors = load_context(target_root, ".loom/bootstrap/init-result.json", None)
    fact_chain_context: dict[str, Any] | None = context if not context_errors else None
    if context_errors:
        missing_inputs.extend(f"fact-chain: {message}" for message in context_errors)
    elif fact_chain_context is not None:
        missing_inputs.extend(report_blocking_messages(fact_chain_context["report"]))
    governance_surface = build_governance_surface(target_root)
    repo_interface = governance_surface.get("repo_interface")
    repo_specific_requirements = repo_specific_requirements_payload(
        repo_interface,
        target_root=target_root,
        surface="closeout",
    )
    release_targets = repo_interface.get("release_targets") if isinstance(repo_interface, dict) else None
    target_release = (
        release_targets.get("target_release")
        if isinstance(release_targets, dict)
        else empty_target_release_status()
    )
    release_enforcement = (
        release_targets.get("enforcement")
        if isinstance(release_targets, dict) and isinstance(release_targets.get("enforcement"), str)
        else "unknown"
    )
    closeout_findings: list[dict[str, Any]] = []
    gate: dict[str, Any] = {"skipped": skip_gate}
    if not skip_gate:
        repo_gate = target_root / ".loom/bin/loom_check.py"
        if repo_gate.exists():
            gate_command = ["python3", ".loom/bin/loom_check.py", "."]
        else:
            gate_command = ["python3", str(shared_script(__file__, "loom_check.py")), str(target_root)]
        gate_result = run_process(gate_command, target_root)
        gate["command"] = " ".join(gate_command)
        gate["exit_code"] = gate_result.returncode
        gate["stdout"] = gate_result.stdout.strip()
        if gate_result.returncode != 0:
            missing_inputs.append("loom_check")

    reconciliation_payload: dict[str, Any] | None = None
    closeout_fallback: str | None = None
    closeout_summary_override: str | None = None
    if issue_number is not None or pr_number is not None or project_number is not None:
        reconciliation_payload, reconciliation_errors = reconciliation_audit_payload(
            target_root=target_root,
            phase_number=phase_number,
            fr_number=fr_number,
            issue_number=issue_number,
            pr_number=pr_number,
            project_number=project_number,
            branch_name=branch_name,
            owner=owner,
            repo_name=repo_name,
        )
        if reconciliation_errors:
            missing_inputs.extend(f"reconciliation: {message}" for message in reconciliation_errors)
        else:
            closeout_fallback, closeout_summary_override = closeout_reconciliation_result(reconciliation_payload)
            if closeout_fallback == "reconciliation-sync":
                missing_inputs.append("reconciliation audit requires sync")
            if closeout_fallback == "manual-reconciliation":
                missing_inputs.append("reconciliation audit is blocked")

    issue_payload: dict[str, Any] | None = None
    issue_id: str | None = None
    if issue_number is not None:
        issue_payload, issue_errors = github_issue_payload(target_root, owner, repo_name, issue_number)
        if issue_errors:
            missing_inputs.extend(f"issue: {message}" for message in issue_errors)
        elif issue_payload is not None:
            raw_issue_id = issue_payload.get("id")
            if isinstance(raw_issue_id, str) and raw_issue_id:
                issue_id = raw_issue_id

    pr_payload: dict[str, Any] | None = None
    merge_commit_sha: str | None = None
    if pr_number is not None:
        pr_payload, pr_errors = github_pr_payload(target_root, owner, repo_name, pr_number)
        if pr_errors:
            missing_inputs.extend(f"pr: {message}" for message in pr_errors)
        elif pr_payload is not None:
            merge_commit = pr_payload.get("mergeCommit")
            if isinstance(merge_commit, dict):
                oid = merge_commit.get("oid")
                if isinstance(oid, str) and oid:
                    merge_commit_sha = oid
            if pr_payload.get("state") != "MERGED":
                missing_inputs.append("pr is not merged")
            if merge_commit_sha:
                base_ref = pr_payload.get("baseRefName")
                if isinstance(base_ref, str) and base_ref:
                    if not contains_merged_commit(target_root, merge_commit_sha, base_ref):
                        missing_inputs.append(f"origin/{base_ref} does not contain the merged PR commit")
                else:
                    missing_inputs.append("pr baseRefName is missing")

    project_payload: dict[str, Any] | None = None
    if project_number is not None:
        project_context, project_errors = project_status_context(target_root, owner, project_number)
        if project_errors:
            if any("unknown owner type" in message for message in project_errors):
                project_payload = {
                    "number": project_number,
                    "status": "unavailable",
                    "reason": "GitHub ProjectV2 CLI owner resolution is unavailable in this environment.",
                    "errors": project_errors,
                    "budget_guard": graphql_budget_guard("project_v2_status_surface", project_errors),
                }
            else:
                missing_inputs.extend(f"project: {message}" for message in project_errors)
        else:
            items = project_context["items"]
            issue_item = find_project_item(items, issue_number, "issue") if issue_number is not None else None
            issue_item_budget_guard: dict[str, Any] | None = None
            if issue_item is None and issue_id is not None and issue_number is not None:
                issue_item, issue_item_errors = project_item_for_issue(target_root, issue_id, project_number)
                if issue_item_errors:
                    issue_item_budget_guard = graphql_budget_guard(
                        "project_v2_issue_item_lookup",
                        issue_item_errors,
                    )
            pr_item = find_project_item(items, pr_number, "pr") if pr_number is not None else None
            if issue_number is not None and issue_item is None:
                missing_inputs.append("issue is missing from project")
            project_payload = {
                "number": project_number,
                "project_id": project_context["project_id"],
                "status_field_id": project_context["status_field_id"],
                "done_option_id": project_context["done_option_id"],
                "issue_item": issue_item,
                "pr_item": pr_item,
            }
            if issue_item_budget_guard is not None:
                project_payload["issue_item_budget_guard"] = issue_item_budget_guard
            for label, item in (("issue", issue_item), ("pr", pr_item)):
                if item is None:
                    continue
                status = item.get("status")
                if isinstance(status, str) and status != "Done":
                    missing_inputs.append(f"{label} project status is not Done")

    if issue_payload is not None and issue_payload.get("state") != "CLOSED":
        missing_inputs.append("issue is not closed")

    target_release_gaps = target_release.get("closeout_gaps") if isinstance(target_release, dict) else []
    if not isinstance(target_release_gaps, list):
        target_release_gaps = []
    delivery_chain = target_release.get("delivery_chain") if isinstance(target_release, dict) else {}
    unreleased = delivery_chain.get("unreleased") if isinstance(delivery_chain, dict) else []
    unreconciled = delivery_chain.get("unreconciled") if isinstance(delivery_chain, dict) else []
    if not isinstance(unreleased, list):
        unreleased = []
    if not isinstance(unreconciled, list):
        unreconciled = []
    if isinstance(target_release, dict) and target_release.get("result") == "block" and release_enforcement == "blocking":
        missing_inputs.extend(
            f"target_release: {message}"
            for message in target_release.get("missing_inputs", [])
        )
        closeout_findings.append(
            {
                "category": "gate_failure",
                "kind": "target_release_unreadable",
                "severity": "block",
                "subject": target_release.get("release_id") or "target release",
                "why_blocking": "target repository release/version truth is declared as blocking but unreadable.",
                "fallback_to": "closeout",
                "evidence": {"missing_inputs": target_release.get("missing_inputs", [])},
            }
        )
    if target_release_gaps and release_enforcement == "blocking":
        missing_inputs.extend(f"target_release gap: {gap}" for gap in target_release_gaps)
        closeout_findings.append(
            {
                "category": "gate_failure",
                "kind": "release_evidence_gap",
                "severity": "block",
                "subject": target_release.get("release_id") or "target release",
                "why_blocking": "target release closeout evidence is incomplete.",
                "fallback_to": "merge",
                "evidence": {"gaps": target_release_gaps},
            }
        )
    if unreleased:
        missing_inputs.append("target release contains merged but unreleased work")
        closeout_findings.append(
            {
                "category": "gate_failure",
                "kind": "merged_but_unreleased",
                "severity": "block",
                "subject": target_release.get("release_id") or "target release",
                "why_blocking": "merged work is still marked unreleased in the target release surface.",
                "fallback_to": "merge",
                "evidence": {"unreleased": unreleased},
            }
        )
    if unreconciled:
        missing_inputs.append("target release contains released but unreconciled work")
        closeout_findings.append(
            {
                "category": "drift",
                "kind": "released_but_unreconciled",
                "severity": "block",
                "subject": target_release.get("release_id") or "target release",
                "why_blocking": "released work is still marked unreconciled in the target release surface.",
                "fallback_to": "reconciliation-sync",
                "evidence": {"unreconciled": unreconciled},
            }
        )

    result = "pass" if not missing_inputs else "block"
    summary = (
        "closeout state is consistent across gate, GitHub issue/PR, project, and main."
        if result == "pass"
        else "closeout state is not yet consistent across gate, GitHub issue/PR, project, and main."
    )
    fallback_to = None if result == "pass" else "merge"
    if result == "block" and closeout_summary_override is not None:
        summary = closeout_summary_override
        fallback_to = closeout_fallback
    elif result == "block" and closeout_findings:
        primary_finding = closeout_findings[0]
        summary = str(primary_finding.get("why_blocking") or summary)
        fallback_value = primary_finding.get("fallback_to")
        if isinstance(fallback_value, str) and fallback_value:
            fallback_to = fallback_value
    elif result == "pass" and isinstance(reconciliation_payload, dict) and reconciliation_payload.get("result") == "warn":
        summary = "closeout state is consistent, but reconciliation audit reported non-blocking warnings that still need review."
    if result == "pass" and repo_specific_requirements["result"] == "block":
        result = "block"
        summary = repo_specific_requirements["summary"]
        fallback_to = repo_specific_requirements["fallback_to"]
        missing_inputs.extend(repo_specific_requirements["missing_inputs"])
    return (
        {
            "command": "closeout",
            "operation": "check",
            "result": result,
            "summary": summary,
            "missing_inputs": missing_inputs,
            "fallback_to": fallback_to,
            "repo": {"owner": owner, "name": repo_name},
            "gate": gate,
            "issue": issue_payload,
            "pr": pr_payload,
            "project": project_payload,
            "repo_specific_requirements": repo_specific_requirements,
            "target_release": target_release,
            "findings": closeout_findings,
            **(
                {
                    "provenance": report_provenance(fact_chain_context["report"]),
                    "recovery_readiness": report_recovery_readiness(fact_chain_context["report"]),
                    "blocking_failures": report_blocking_failures(fact_chain_context["report"]),
                }
                if fact_chain_context is not None
                else fact_chain_error_contract(context_errors)
            ),
            **({"reconciliation": reconciliation_payload} if reconciliation_payload is not None else {}),
        },
        [],
    )


def handle_closeout(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        return emit(
            runtime_state_block_payload(
                command="closeout",
                operation=args.operation,
                runtime_state=runtime_state,
                summary="closeout is blocked because the Loom runtime state is inconsistent.",
            )
        )
    owner = args.owner
    repo_name = args.repo_name
    if not owner or not repo_name:
        detected_owner, detected_repo = detect_github_repo(target_root)
        owner = owner or detected_owner
        repo_name = repo_name or detected_repo
    if not owner or not repo_name:
        return emit(
            {
                "command": "closeout",
                "operation": args.operation,
                "result": "block",
                "summary": "closeout could not determine the GitHub repository.",
                "missing_inputs": ["owner/repo"],
                "fallback_to": "merge",
                "runtime_state": runtime_state,
            }
        )
    if args.operation == "sync":
        attach_only_block = attach_only_host_write_guard(
            command="closeout",
            operation="sync",
            target_root=target_root,
        )
        if attach_only_block is not None:
            attach_only_block["runtime_state"] = runtime_state
            return emit(attach_only_block)

    payload, errors = closeout_payload(
        target_root=target_root,
        phase_number=args.phase,
        fr_number=args.fr,
        issue_number=args.issue,
        pr_number=args.pr,
        project_number=args.project,
        branch_name=args.branch,
        owner=owner,
        repo_name=repo_name,
        skip_gate=args.skip_gate,
    )
    if errors:
        return emit(
            {
                "command": "closeout",
                "operation": args.operation,
                "result": "block",
                "summary": "closeout command hit an unexpected internal error.",
                "missing_inputs": errors,
                "fallback_to": "merge",
                "runtime_state": runtime_state,
            }
        )

    payload["runtime_state"] = runtime_state
    if args.operation == "check":
        return emit(payload)

    reconciliation = payload.get("reconciliation")
    repo_specific_requirements = payload.get("repo_specific_requirements")
    if isinstance(repo_specific_requirements, dict) and repo_specific_requirements.get("result") == "block":
        return emit(
            {
                **payload,
                "operation": "sync",
                "result": "block",
                "summary": "closeout sync is blocked until companion-declared blocking requirements are handled.",
                "fallback_to": repo_specific_requirements.get("fallback_to") or "merge",
                "runtime_state": runtime_state,
            }
        )
    if isinstance(reconciliation, dict):
        reconciliation_result = reconciliation.get("result")
        if reconciliation_result in {"fix-needed", "block"}:
            return emit(
                {
                    **payload,
                    "operation": "sync",
                    "result": "block",
                    "summary": (
                        "closeout sync is blocked until reconciliation sync repairs the audited drift."
                        if reconciliation_result == "fix-needed"
                        else "closeout sync is blocked because reconciliation audit could not complete."
                    ),
                    "fallback_to": "reconciliation-sync" if reconciliation_result == "fix-needed" else "manual-reconciliation",
                    "runtime_state": runtime_state,
                }
            )

    sync_missing: list[str] = []
    if args.issue is not None:
        issue = payload.get("issue")
        if isinstance(issue, dict) and issue.get("state") != "CLOSED":
            if args.comment:
                comment_result = run_process(
                    [
                        "gh",
                        "issue",
                        "comment",
                        str(args.issue),
                        "--repo",
                        f"{owner}/{repo_name}",
                        "--body",
                        args.comment,
                    ],
                    target_root,
                )
                if comment_result.returncode != 0:
                    sync_missing.append(comment_result.stderr.strip() or "failed to comment on issue")
            close_result = run_process(
                ["gh", "issue", "close", str(args.issue), "--repo", f"{owner}/{repo_name}"],
                target_root,
            )
            if close_result.returncode != 0:
                sync_missing.append(close_result.stderr.strip() or "failed to close issue")

    if args.project is not None:
        project = payload.get("project")
        if isinstance(project, dict):
            for key in ("issue_item", "pr_item"):
                item = project.get(key)
                if not isinstance(item, dict):
                    continue
                status = item.get("status")
                item_id = item.get("id")
                if not isinstance(item_id, str) or not item_id:
                    continue
                if status != "Done":
                    sync_missing.extend(
                        set_project_item_done(
                            target_root,
                            project["project_id"],
                            item_id,
                            project["status_field_id"],
                            project["done_option_id"],
                        )
                    )

    refreshed_payload, errors = closeout_payload(
        target_root=target_root,
        phase_number=args.phase,
        fr_number=args.fr,
        issue_number=args.issue,
        pr_number=args.pr,
        project_number=args.project,
        branch_name=args.branch,
        owner=owner,
        repo_name=repo_name,
        skip_gate=args.skip_gate,
    )
    if errors:
        sync_missing.extend(errors)
    refreshed_payload["operation"] = "sync"

    if sync_missing:
        refreshed_payload["result"] = "block"
        refreshed_payload["summary"] = "closeout sync could not fully align GitHub control-plane state."
        refreshed_payload["missing_inputs"] = list(dict.fromkeys(sync_missing + list(refreshed_payload.get("missing_inputs", []))))
        refreshed_payload["fallback_to"] = "merge"
    refreshed_payload["runtime_state"] = runtime_state
    return emit(refreshed_payload)


def handle_reconciliation(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        return emit(
            runtime_state_block_payload(
                command="reconciliation",
                operation=args.operation,
                runtime_state=runtime_state,
                summary="reconciliation is blocked because the Loom runtime state is inconsistent.",
            )
        )
    if args.comment and args.comment_file:
        return emit(
            {
                "command": "reconciliation",
                "operation": args.operation,
                "result": "block",
                "summary": "reconciliation sync accepts either --comment or --comment-file, not both.",
                "missing_inputs": ["choose one comment source"],
                "fallback_to": "manual-reconciliation",
                "runtime_state": runtime_state,
            }
        )

    comment_body = args.comment
    if args.comment_file:
        comment_body, comment_errors = read_repo_relative_text_file(target_root, args.comment_file, label="reconciliation comment file")
        if comment_errors:
            return emit(
                {
                    "command": "reconciliation",
                    "operation": args.operation,
                    "result": "block",
                    "summary": "reconciliation sync could not read the requested comment file.",
                    "missing_inputs": comment_errors,
                    "fallback_to": "manual-reconciliation",
                    "runtime_state": runtime_state,
                }
            )
    owner = args.owner
    repo_name = args.repo_name
    if not owner or not repo_name:
        detected_owner, detected_repo = detect_github_repo(target_root)
        owner = owner or detected_owner
        repo_name = repo_name or detected_repo
    if not owner or not repo_name:
        return emit(
            {
                "command": "reconciliation",
                "operation": args.operation,
                "result": "block",
                "summary": "reconciliation could not determine the GitHub repository.",
                "missing_inputs": ["owner/repo"],
                "fallback_to": "manual-reconciliation",
                "runtime_state": runtime_state,
            }
        )
    if args.operation == "sync" and not args.dry_run:
        attach_only_block = attach_only_host_write_guard(
            command="reconciliation",
            operation="sync",
            target_root=target_root,
        )
        if attach_only_block is not None:
            attach_only_block["runtime_state"] = runtime_state
            return emit(attach_only_block)

    payload, errors = reconciliation_audit_payload(
        target_root=target_root,
        phase_number=args.phase,
        fr_number=args.fr,
        issue_number=args.issue,
        pr_number=args.pr,
        project_number=args.project,
        branch_name=args.branch,
        owner=owner,
        repo_name=repo_name,
    )
    if errors:
        return emit(
            {
                "command": "reconciliation",
                "operation": args.operation,
                "result": "block",
                "summary": "reconciliation command hit an unexpected internal error.",
                "missing_inputs": errors,
                "fallback_to": "manual-reconciliation",
                "runtime_state": runtime_state,
            }
        )
    payload["runtime_state"] = runtime_state
    if args.operation == "audit":
        return emit(payload)

    if payload.get("result") == "block":
        return emit(
            {
                **payload,
                "operation": "sync",
                "summary": "reconciliation sync stopped because audit returned block findings or missing inputs.",
                "applied_actions": [],
                "skipped_actions": [],
                "remaining_findings": list(payload.get("findings", [])),
                "runtime_state": runtime_state,
            }
        )

    applied_actions, skipped_actions = reconciliation_sync_plan(payload)
    remaining_findings = [
        finding
        for finding in payload.get("findings", [])
        if isinstance(finding, dict) and finding.get("severity") == "warn"
    ]
    sync_missing: list[str] = []

    if args.dry_run:
        dry_run_actions = [{**action, "dry_run": True} for action in applied_actions]
        has_unresolved_fix_needed = any(
            isinstance(finding, dict) and finding.get("severity") == "fix-needed"
            for finding in payload.get("findings", [])
        ) and bool(skipped_actions)
        return emit(
            {
                **payload,
                "operation": "sync",
                "result": "block" if has_unresolved_fix_needed else "pass",
                "summary": (
                    "reconciliation sync dry-run produced the planned control-plane actions."
                    if not has_unresolved_fix_needed
                    else "reconciliation sync dry-run found fix-needed drift that still requires manual reconciliation."
                ),
                "applied_actions": dry_run_actions,
                "skipped_actions": skipped_actions,
                "remaining_findings": list(payload.get("findings", [])),
                "dry_run": True,
                "fallback_to": None if not has_unresolved_fix_needed else "manual-reconciliation",
                "runtime_state": runtime_state,
            }
        )

    executed_actions: list[dict[str, Any]] = []
    for action in applied_actions:
        step_kind = action.get("action")
        subject = action.get("subject")
        if step_kind == "close_issue":
            issue_number = action.get("issue_number")
            if not isinstance(issue_number, int):
                sync_missing.append(f"{subject} is missing an issue number for reconciliation sync")
                skipped_actions.append(
                    {
                        "kind": action.get("kind"),
                        "subject": subject,
                        "action": step_kind,
                        "reason": "missing issue number for reconciliation sync",
                    }
                )
                continue
            if comment_body and issue_number == args.issue:
                comment_result = run_process(
                    [
                        "gh",
                        "issue",
                        "comment",
                        str(issue_number),
                        "--repo",
                        f"{owner}/{repo_name}",
                        "--body",
                        comment_body,
                    ],
                    target_root,
                )
                if comment_result.returncode != 0:
                    sync_missing.append(comment_result.stderr.strip() or f"failed to comment on issue #{issue_number}")
                    skipped_actions.append(
                        {
                            "kind": action.get("kind"),
                            "subject": subject,
                            "action": step_kind,
                            "reason": f"failed to comment on issue #{issue_number}",
                        }
                    )
                    continue
            close_result = run_process(
                ["gh", "issue", "close", str(issue_number), "--repo", f"{owner}/{repo_name}"],
                target_root,
            )
            if close_result.returncode != 0:
                sync_missing.append(close_result.stderr.strip() or f"failed to close issue #{issue_number}")
                skipped_actions.append(
                    {
                        "kind": action.get("kind"),
                        "subject": subject,
                        "action": step_kind,
                        "reason": close_result.stderr.strip() or f"failed to close issue #{issue_number}",
                    }
                )
                continue
            executed_actions.append(action)
            continue
        if step_kind == "set_project_done":
            step_errors = set_project_item_done(
                target_root,
                action["project_id"],
                action["item_id"],
                action["status_field_id"],
                action["done_option_id"],
            )
            if step_errors:
                sync_missing.extend(step_errors)
                skipped_actions.append(
                    {
                        "kind": action.get("kind"),
                        "subject": subject,
                        "action": step_kind,
                        "reason": "; ".join(step_errors),
                    }
                )
                continue
            executed_actions.append(action)
            continue
        sync_missing.append(f"{subject} uses unsupported sync action `{step_kind}`")
        skipped_actions.append(
            {
                "kind": action.get("kind"),
                "subject": subject,
                "action": step_kind,
                "reason": f"unsupported sync action `{step_kind}`",
            }
        )

    refreshed_payload, refreshed_errors = reconciliation_audit_payload(
        target_root=target_root,
        phase_number=args.phase,
        fr_number=args.fr,
        issue_number=args.issue,
        pr_number=args.pr,
        project_number=args.project,
        branch_name=args.branch,
        owner=owner,
        repo_name=repo_name,
    )
    if refreshed_errors:
        sync_missing.extend(refreshed_errors)
        refreshed_payload = payload
    remaining_findings = [finding for finding in refreshed_payload.get("findings", []) if isinstance(finding, dict)]
    unresolved_fix_needed = any(finding.get("severity") == "fix-needed" for finding in remaining_findings)

    result = "pass"
    summary = "reconciliation sync aligned the requested GitHub control-plane state."
    fallback_to = None
    if sync_missing or unresolved_fix_needed:
        result = "block"
        summary = "reconciliation sync could not fully align the requested GitHub control-plane state."
        fallback_to = "manual-reconciliation"

    return emit(
        {
            **refreshed_payload,
            "operation": "sync",
            "result": result,
            "summary": summary,
            "missing_inputs": list(dict.fromkeys(sync_missing + list(refreshed_payload.get("missing_inputs", [])))),
            "fallback_to": fallback_to,
            "applied_actions": executed_actions,
            "skipped_actions": skipped_actions,
            "remaining_findings": remaining_findings,
            "audit": payload,
            "runtime_state": runtime_state,
        }
    )


def handle_review(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        return emit(
            {
                "command": "review",
                "operation": args.operation,
                "result": "block",
                "summary": "review command could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
                **fact_chain_error_contract(errors, output_relative=args.output),
            }
        )

    requested_review_file = args.review_file
    if args.operation == "record" and args.kind == "spec_review" and not requested_review_file:
        requested_review_file = default_spec_review_path(context["item_id"])

    review_record, review_path, review_errors = load_review_record(
        target_root,
        context["item_id"],
        requested_review_file or context["review_entry"],
    )
    inferred_spec_review = review_path == default_spec_review_path(context["item_id"])
    if args.operation == "read":
        missing_inputs = list(review_errors)
        if review_record is None and not review_errors:
            missing_inputs.append(f"missing review artifact: {review_path}")
        result = "pass" if not missing_inputs else "block"
        return emit(
            {
                "command": "review",
                "operation": "read",
                "item": {"id": context["item_id"]},
                "result": result,
                "summary": (
                    "review artifact is readable and can be consumed by merge checkpoint."
                    if result == "pass"
                    else "review artifact is missing or invalid."
                ),
                "missing_inputs": missing_inputs,
                "fallback_to": "build" if missing_inputs else None,
                "review": {"path": review_path, "record": review_record},
            }
        )

    if args.operation == "run":
        flow_operation = "spec-review" if inferred_spec_review else "review"
        review_kind = "spec_review" if inferred_spec_review else implementation_review_kind(context)
        current_head = git_head_sha(target_root) or "unknown-head"
        adapter_selection = select_review_adapter(args, target_root, reviewed_head=current_head)
        requested_engine_adapter = str(adapter_selection["adapter"])
        engine_profile, engine_profile_errors = resolve_review_engine_profile(
            context,
            review_kind,
            adapter=requested_engine_adapter,
            requested_profile=args.engine_profile,
            requested_model=args.engine_model,
            requested_reasoning=args.engine_reasoning,
            override_reason=args.engine_override_reason,
        )
        if engine_profile_errors or engine_profile is None:
            manual_review = manual_review_payload(
                context=context,
                findings_file=None,
                kind=review_kind,
                review_record_path=review_path,
            )
            return emit(
                {
                    "command": "review",
                    "operation": "run",
                    "item": {"id": context["item_id"]},
                    "result": "block",
                    "summary": "default review engine profile could not be resolved safely.",
                    "missing_inputs": engine_profile_errors,
                    "fallback_to": None,
                    "engine": {
                        "engine": CODEX_APP_REVIEW_ENGINE if requested_engine_adapter == CODEX_APP_REVIEW_ADAPTER else DEFAULT_REVIEW_ENGINE,
                        "adapter": requested_engine_adapter,
                        "profile": None,
                        "result": "not_run",
                        "failure_reason": "runtime_conflict",
                        "reviewed_head": current_head,
                        "evidence": None,
                    },
                    "engine_metadata": review_adapter_selection_metadata(adapter_selection, reviewed_head=current_head),
                    "manual_review": manual_review,
                }
            )
        flow_payload = build_review_flow_payload(target_root, args.output, args.item, operation=flow_operation)
        review_surface = flow_payload.get("review") or (flow_payload.get("spec_review") if inferred_spec_review else None)
        if flow_payload["result"] != "pass":
            manual_review = manual_review_payload(
                context=context,
                findings_file=None,
                kind=review_kind,
                review_record_path=review_path,
            )
            return emit(
                {
                    "command": "review",
                    "operation": "run",
                    "item": flow_payload.get("item"),
                    "result": flow_payload["result"],
                    "summary": "default review engine was not started because the Loom review baseline is not ready.",
                    "missing_inputs": flow_payload["missing_inputs"],
                    "fallback_to": flow_payload["fallback_to"],
                    "steps": flow_payload.get("steps", []),
                    "runtime_state": flow_payload.get("runtime_state"),
                    "state_check": flow_payload.get("state_check"),
                    "runtime_evidence": flow_payload.get("runtime_evidence"),
                    "budget_risk": flow_payload.get("budget_risk"),
                    "build_checkpoint": flow_payload.get("build_checkpoint"),
                    "review": review_surface,
                    "spec_review": flow_payload.get("spec_review"),
                    "repo_specific_requirements": flow_payload.get("repo_specific_requirements"),
                    "current_checkpoint": flow_payload.get("current_checkpoint"),
                    "engine": {
                        "engine": CODEX_APP_REVIEW_ENGINE if requested_engine_adapter == CODEX_APP_REVIEW_ADAPTER else DEFAULT_REVIEW_ENGINE,
                        "adapter": requested_engine_adapter,
                        "profile": engine_profile,
                        "result": "not_run",
                        "failure_reason": None,
                        "reviewed_head": current_head,
                        "evidence": None,
                    },
                    "engine_metadata": review_adapter_selection_metadata(adapter_selection, reviewed_head=current_head),
                    "manual_review": manual_review,
                }
            )

        build_payload = flow_payload["build_checkpoint"]
        if requested_engine_adapter == CODEX_APP_REVIEW_ADAPTER:
            engine_payload = run_codex_app_review_authoritative_adapter(
                context,
                build_payload,
                review_path,
                engine_profile,
                review_kind=review_kind,
                app_server=adapter_selection.get("app_server") if isinstance(adapter_selection.get("app_server"), str) else None,
                thread_id=adapter_selection.get("thread_id") if isinstance(adapter_selection.get("thread_id"), str) else None,
                thread_cwd=adapter_selection.get("thread_cwd") if isinstance(adapter_selection.get("thread_cwd"), str) else None,
                raw_file=adapter_selection.get("raw_file") if isinstance(adapter_selection.get("raw_file"), str) else None,
                adapter_selection=adapter_selection,
            )
        else:
            engine_payload = run_default_review_engine(
                context,
                build_payload,
                review_path,
                engine_profile,
                review_kind=review_kind,
                adapter_selection=adapter_selection,
            )
        shadow_engine_payload = run_codex_app_review_shadow_adapter(
            context,
            adapter=args.shadow_engine_adapter,
            raw_file=args.shadow_review_raw_file,
            default_engine_payload=engine_payload,
        )
        review_record_input = engine_payload.get("review_record_input")
        findings_file = (
            review_record_input.get("findings_file")
            if isinstance(review_record_input, dict)
            else None
        )
        manual_review = manual_review_payload(
            context=context,
            findings_file=findings_file if isinstance(findings_file, str) else None,
            kind=review_kind,
            review_record_path=review_path,
        )
        result = engine_payload["result"]
        summary = (
            engine_payload["summary"]
            if result == "pass"
            else f"{requested_engine_adapter} review engine failed closed; record any formal review conclusion through the single review record."
        )
        return emit(
            {
                "command": "review",
                "operation": "run",
                "item": flow_payload.get("item"),
                "result": result,
                "summary": summary,
                "missing_inputs": engine_payload["missing_inputs"],
                "fallback_to": None if result == "block" else engine_payload["fallback_to"],
                "steps": flow_payload.get("steps", []),
                "runtime_state": flow_payload.get("runtime_state"),
                "state_check": flow_payload.get("state_check"),
                "runtime_evidence": flow_payload.get("runtime_evidence"),
                "budget_risk": flow_payload.get("budget_risk"),
                "build_checkpoint": flow_payload.get("build_checkpoint"),
                "review": review_surface,
                "spec_review": flow_payload.get("spec_review"),
                "repo_specific_requirements": flow_payload.get("repo_specific_requirements"),
                "current_checkpoint": flow_payload.get("current_checkpoint"),
                "engine": engine_payload["engine"],
                **({"engine_metadata": engine_payload["engine_metadata"]} if isinstance(engine_payload.get("engine_metadata"), dict) else {}),
                **({"shadow_engine": shadow_engine_payload} if isinstance(shadow_engine_payload, dict) else {}),
                "manual_review": manual_review,
                **({"review_record_input": review_record_input} if isinstance(review_record_input, dict) else {}),
            }
        )

    missing_inputs: list[str] = []
    for field in ("decision", "kind", "summary", "reviewer"):
        value = getattr(args, field.replace("-", "_"), None)
        if not isinstance(value, str) or not value.strip():
            missing_inputs.append(field)
    if args.decision == "fallback" and args.fallback_to is None:
        missing_inputs.append("fallback-to")
    if missing_inputs:
        return emit(
            {
        "command": "review",
            "operation": "record",
                "result": "block",
                "summary": "review record command is missing required authored fields.",
                "missing_inputs": missing_inputs,
                "fallback_to": "build",
            }
        )

    if args.findings_file and (args.blocking_issue or args.follow_up):
        return emit(
            {
                "command": "review",
                "operation": "record",
                "result": "block",
                "summary": "review record must not mix `--findings-file` with compatibility finding flags.",
                "missing_inputs": ["choose either `--findings-file` or compatibility finding flags"],
                "fallback_to": "build",
            }
        )

    build_payload = checkpoint_payload("build", context)
    if args.decision == "allow" and build_payload["result"] != "pass":
        missing = list(build_payload["missing_inputs"])
        return emit(
            {
                "command": "review",
                "operation": "record",
                "result": "block",
                "summary": "review cannot be recorded as `allow` before build checkpoint passes.",
                "missing_inputs": missing,
                "fallback_to": build_payload["fallback_to"] or "build",
                "build_checkpoint": build_payload,
            }
        )
    if args.decision == "allow" and args.kind == "spec_review":
        _, missing_suite_paths = formal_spec_suite_status(context)
        if missing_suite_paths:
            return emit(
                {
                    "command": "review",
                    "operation": "record",
                    "result": "block",
                    "summary": "spec review cannot be recorded as `allow` without the complete formal spec suite.",
                    "missing_inputs": [
                        f"missing formal spec suite file: {path}" for path in missing_suite_paths
                    ],
                    "fallback_to": "build",
                    "build_checkpoint": build_payload,
                }
            )
    if args.decision == "allow" and args.kind != "spec_review":
        spec_gate = spec_review_gate_payload(context)
        if spec_gate["result"] != "pass":
            return emit(
                {
                    "command": "review",
                    "operation": "record",
                    "result": "block",
                    "summary": "implementation review cannot be recorded as `allow` before spec review passes.",
                    "missing_inputs": list(spec_gate["missing_inputs"]),
                    "fallback_to": spec_gate["fallback_to"] or "build",
                    "build_checkpoint": build_payload,
                    "spec_review": spec_gate,
                }
            )

    findings: list[dict[str, Any]]
    findings_errors: list[str] = []
    if args.findings_file:
        findings, findings_errors = load_findings_file(target_root, args.findings_file)
        if findings is None:
            findings = []
    else:
        findings = compat_findings_from_lists(
            decision=args.decision,
            blocking_issues=[entry.strip() for entry in args.blocking_issue if entry.strip()],
            follow_ups=[entry.strip() for entry in args.follow_up if entry.strip()],
        )
    if findings_errors:
        return emit(
            {
                "command": "review",
                "operation": "record",
                "result": "block",
                "summary": "review record could not load a valid authoritative findings file.",
                "missing_inputs": findings_errors,
                "fallback_to": "build",
            }
        )

    blocking_issues, follow_ups = compat_lists_from_findings(findings)
    governance_surface = build_governance_surface(target_root)
    github_control_plane = (
        governance_surface.get("github_control_plane")
        if isinstance(governance_surface, dict)
        else None
    )
    execution_budget = (
        github_control_plane.get("api_snapshot", {}).get("budget")
        if isinstance(github_control_plane, dict)
        else None
    )
    budget_risk = derive_execution_budget_risk(execution_budget)
    review_payload = {
        "schema_version": "loom-review/v1",
        "item_id": context["item_id"],
        "decision": args.decision,
        "kind": args.kind,
        "summary": args.summary,
        "reviewer": args.reviewer,
        "reviewed_head": git_head_sha(target_root) or "unknown",
        "reviewed_validation_summary": context["latest_validation_summary"],
        "fallback_to": args.fallback_to,
        "findings": findings,
        "blocking_issues": blocking_issues,
        "follow_ups": follow_ups,
        "consumed_inputs": {
            "work_item": str(context["report"]["fact_chain"]["entry_points"]["work_item"]),
            "recovery_entry": str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"]),
            "status_surface": str(context["report"]["fact_chain"]["entry_points"]["status_surface"]),
            "build_checkpoint": build_payload["result"],
            "budget_risk": budget_risk,
            "engine_adapter": args.engine_adapter,
            "engine_evidence": args.engine_evidence,
            "normalized_findings": args.normalized_findings,
        },
    }
    review_abs, review_path_errors = resolve_repo_relative_path(target_root, review_path, label="review artifact path")
    if review_path_errors:
        return emit(
            {
                "command": "review",
                "operation": "record",
                "result": "block",
                "summary": "review record refused an unsafe review artifact locator.",
                "missing_inputs": review_path_errors,
                "fallback_to": "build",
            }
        )
    assert review_abs is not None
    review_abs.parent.mkdir(parents=True, exist_ok=True)
    write_json_file(review_abs, review_payload)

    verified_record, _, verified_errors = load_review_record(target_root, context["item_id"], review_path)
    if verified_errors or verified_record is None:
        return emit(
            {
                "command": "review",
                "operation": "record",
                "result": "block",
                "summary": "review artifact was written but could not be re-read cleanly.",
                "missing_inputs": verified_errors or [f"missing review artifact: {review_path}"],
                "fallback_to": "build",
            }
        )

    return emit(
        {
            "command": "review",
            "operation": "record",
            "item": {"id": context["item_id"]},
            "result": "pass",
            "summary": (
                "formal spec review conclusion was recorded and is ready for spec gate consumption."
                if args.kind == "spec_review"
                else "formal review conclusion was recorded and is ready for merge checkpoint consumption."
            ),
            "missing_inputs": [],
            "fallback_to": None,
            "review": {"path": review_path, "record": verified_record},
            "budget_risk": budget_risk,
            "build_checkpoint": {
                "result": build_payload["result"],
                "summary": build_payload["summary"],
            },
        }
    )


def handle_recovery(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    output_path, output_errors = resolve_repo_relative_path(target_root, args.output, label="init-result locator")
    if output_errors:
        return emit(
            {
                "command": "recovery",
                "operation": args.operation,
                "result": "block",
                "summary": "recovery command requires a safe init-result fact-chain locator.",
                "missing_inputs": output_errors,
                "fallback_to": "admission",
            }
        )
    assert output_path is not None
    if not output_path.exists():
        return emit(
            {
                "command": "recovery",
                "operation": args.operation,
                "result": "block",
                "summary": "recovery command requires an existing init-result fact-chain locator.",
                "missing_inputs": [f"missing init-result: {args.output}"],
                "fallback_to": "admission",
            }
        )
    attach_only_block = attach_only_carrier_guard(
        command="recovery",
        operation=args.operation,
        output_path=output_path,
        output_relative=args.output,
    )
    if attach_only_block is not None:
        return emit(attach_only_block)

    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        return emit(
            {
                "command": "recovery",
                "operation": args.operation,
                "result": "block",
                "summary": "recovery command could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
                **fact_chain_error_contract(errors, output_relative=args.output),
            }
        )

    updates = {
        "current_checkpoint": args.current_checkpoint,
        "current_stop": args.current_stop,
        "next_step": args.next_step,
        "blockers": args.blockers,
        "latest_validation_summary": args.latest_validation_summary,
        "recovery_boundary": args.recovery_boundary,
        "current_lane": args.current_lane,
    }
    provided = {field: value for field, value in updates.items() if isinstance(value, str) and value.strip()}
    if not provided:
        return emit(
            {
                "command": "recovery",
                "operation": "writeback",
                "result": "block",
                "summary": "recovery writeback requires at least one authored field.",
                "missing_inputs": ["current-stop | next-step | blockers | latest-validation-summary | current-checkpoint | recovery-boundary | current-lane"],
                "fallback_to": "admission",
            }
        )

    status_relative = str(context["report"]["fact_chain"]["entry_points"]["status_surface"])
    runtime_evidence, runtime_errors = read_runtime_evidence(target_root, status_relative)
    if runtime_errors:
        return emit(
            {
                "command": "recovery",
                "operation": "writeback",
                "result": "block",
                "summary": "recovery writeback could not read runtime evidence for status sync.",
                "missing_inputs": runtime_errors,
                "fallback_to": "admission",
            }
        )

    for field_name, value in provided.items():
        if field_name == "current_checkpoint":
            value = normalize_checkpoint(value) if value.strip().lower() == "retired" else value
        update_markdown_bullet(context["recovery_path"], RECOVERY_FIELD_LABELS[field_name], value)

    refreshed, refresh_errors = sync_status_surface(target_root, args.output, runtime_evidence)
    if refresh_errors:
        return emit(
            {
                "command": "recovery",
                "operation": "writeback",
                "result": "block",
                "summary": "recovery writeback updated the recovery entry, but fact-chain verification failed during status sync.",
                "missing_inputs": refresh_errors,
                "fallback_to": "admission",
            }
        )

    return emit(
        {
            "command": "recovery",
            "operation": "writeback",
            "item": {"id": context["item_id"]},
            "result": "pass",
            "summary": "recovery authored fields were updated and the derived status surface was resynchronized.",
            "missing_inputs": [],
            "fallback_to": None,
            "updated_fields": sorted(provided),
            "recovery_entry": str(refreshed["fact_chain"]["entry_points"]["recovery_entry"]),
            "status_surface": str(refreshed["fact_chain"]["entry_points"]["status_surface"]),
        }
    )


def update_active_entry_points(
    target_root: Path,
    output_relative: str,
    *,
    item_id: str,
    work_item: str,
    recovery_entry: str,
    status_surface: str,
) -> None:
    output_path, output_errors = resolve_repo_relative_path(target_root, output_relative, label="init-result locator")
    if output_errors:
        raise RuntimeError("; ".join(output_errors))
    assert output_path is not None
    payload = load_json_file(output_path)
    fact_chain = payload.get("fact_chain")
    if not isinstance(fact_chain, dict):
        raise RuntimeError("init-result is missing `fact_chain`")
    entry_points = fact_chain.get("entry_points")
    if not isinstance(entry_points, dict):
        raise RuntimeError("init-result.fact_chain is missing `entry_points`")
    entry_points["current_item_id"] = item_id
    entry_points["work_item"] = work_item
    entry_points["recovery_entry"] = recovery_entry
    entry_points["status_surface"] = status_surface
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_work_item_payload_locators(
    target_root: Path,
    work_item_payload: dict[str, Any],
) -> tuple[dict[str, Path], list[str]]:
    """Validate final authored locator truth before any Work Item carrier write."""
    locators: dict[str, str] = {
        "recovery_entry": str(work_item_payload.get("recovery_entry", "")),
        "review_entry": str(work_item_payload.get("review_entry", "")),
    }
    associated_artifacts = work_item_payload.get("associated_artifacts", [])
    if isinstance(associated_artifacts, list):
        for index, artifact in enumerate(associated_artifacts, start=1):
            locators[f"associated_artifacts[{index}]"] = str(artifact)
    else:
        return {}, ["associated_artifacts must be a list of repo-relative locators"]

    resolved: dict[str, Path] = {}
    errors: list[str] = []
    workspace_path, workspace_errors = resolve_workspace_path(
        target_root,
        str(work_item_payload.get("workspace_entry", "")),
    )
    errors.extend(f"work item workspace_entry: {message}" for message in workspace_errors)
    if workspace_path is not None:
        resolved["workspace_entry"] = workspace_path
    for label, locator in locators.items():
        path, locator_errors = resolve_repo_relative_path(target_root, locator, label=f"work item {label}")
        errors.extend(locator_errors)
        if path is not None:
            resolved[label] = path
    return resolved, errors


def handle_work_item(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    output_path, output_errors = resolve_repo_relative_path(target_root, args.output, label="init-result locator")
    if output_errors:
        return emit(
            {
                "command": "work-item",
                "operation": args.operation,
                "result": "block",
                "summary": "work-item command requires a safe init-result fact-chain locator.",
                "missing_inputs": output_errors,
                "fallback_to": "admission",
            }
        )
    assert output_path is not None
    if not output_path.exists():
        return emit(
            {
                "command": "work-item",
                "operation": args.operation,
                "result": "block",
                "summary": "work-item command requires an existing init-result fact-chain locator.",
                "missing_inputs": [f"missing init-result: {args.output}"],
                "fallback_to": "admission",
            }
        )

    work_item_relative = f".loom/work-items/{args.item}.md"
    work_item_path, work_item_path_errors = resolve_repo_relative_path(
        target_root,
        work_item_relative,
        label="work item locator",
    )
    recovery_relative = args.recovery_entry or f".loom/progress/{args.item}.md"
    recovery_path, recovery_path_errors = resolve_repo_relative_path(
        target_root,
        recovery_relative,
        label="recovery entry locator",
    )
    review_relative = default_review_path(args.item)
    review_path, review_path_errors = resolve_repo_relative_path(target_root, review_relative, label="review locator")
    status_relative = ".loom/status/current.md"
    status_path, status_path_errors = resolve_repo_relative_path(target_root, status_relative, label="status surface locator")
    locator_errors = [*work_item_path_errors, *recovery_path_errors, *review_path_errors, *status_path_errors]
    if locator_errors:
        return emit(
            {
                "command": "work-item",
                "operation": args.operation,
                "result": "block",
                "summary": "work-item command refused unsafe repo locator input.",
                "missing_inputs": locator_errors,
                "fallback_to": "admission",
            }
        )
    assert work_item_path is not None
    assert recovery_path is not None
    assert review_path is not None
    assert status_path is not None
    attach_only_block = attach_only_carrier_guard(
        command="work-item",
        operation=args.operation,
        output_path=output_path,
        output_relative=args.output,
    )
    if attach_only_block is not None:
        return emit(attach_only_block)
    runtime_evidence: dict[str, dict[str, Any]] | None = None

    if args.operation == "create":
        required_fields = {
            "goal": args.goal,
            "scope": args.scope,
            "execution_path": args.execution_path,
            "workspace_entry": args.workspace_entry,
            "validation_entry": args.validation_entry,
            "closing_condition": args.closing_condition,
        }
        missing = [field for field, value in required_fields.items() if not isinstance(value, str) or not value.strip()]
        if missing:
            return emit(
                {
                    "command": "work-item",
                    "operation": "create",
                    "result": "block",
                    "summary": "work-item create is missing required static fields.",
                    "missing_inputs": missing,
                    "fallback_to": "admission",
                }
            )
        if work_item_path.exists():
            return emit(
                {
                    "command": "work-item",
                    "operation": "create",
                    "result": "block",
                    "summary": "work-item create refused to overwrite an existing work item.",
                    "missing_inputs": [f"work item already exists: {work_item_relative}"],
                    "fallback_to": "admission",
                }
            )

        artifacts = [work_item_relative, recovery_relative, review_relative, status_relative, *args.artifact]
        deduped_artifacts: list[str] = []
        seen: set[str] = set()
        for artifact in artifacts:
            if artifact in seen:
                continue
            seen.add(artifact)
            deduped_artifacts.append(artifact)

        work_item_payload = {
            "item_id": args.item,
            "goal": args.goal,
            "scope": args.scope,
            "execution_path": args.execution_path,
            "workspace_entry": args.workspace_entry,
            "recovery_entry": recovery_relative,
            "review_entry": review_relative,
            "validation_entry": args.validation_entry,
            "closing_condition": args.closing_condition,
            "associated_artifacts": deduped_artifacts,
        }
        resolved_payload_locators, payload_locator_errors = validate_work_item_payload_locators(
            target_root,
            work_item_payload,
        )
        if payload_locator_errors:
            return emit(
                {
                    "command": "work-item",
                    "operation": "create",
                    "result": "block",
                    "summary": "work-item create refused unsafe authored locator input.",
                    "missing_inputs": payload_locator_errors,
                    "fallback_to": "admission",
                }
            )
        recovery_path = resolved_payload_locators["recovery_entry"]
        review_path = resolved_payload_locators["review_entry"]
        work_item_path.parent.mkdir(parents=True, exist_ok=True)
        work_item_path.write_text(render_work_item(work_item_payload), encoding="utf-8")
        review_path.parent.mkdir(parents=True, exist_ok=True)
        review_path.write_text(
            json.dumps(
                {
                    "schema_version": "loom-review/v1",
                    "item_id": args.item,
                    "decision": "fallback",
                    "kind": "general_review",
                    "summary": "Formal review has not been recorded yet.",
                    "reviewer": "not yet assigned",
                    "reviewed_head": git_head_sha(target_root) or "unknown",
                    "reviewed_validation_summary": "No validation recorded yet.",
                    "fallback_to": "admission",
                    "findings": [
                        {
                            "id": "scaffolded-block-1",
                            "summary": "Review artifact scaffolded but not yet concluded.",
                            "severity": "block",
                            "rebuttal": None,
                            "disposition": {
                                "status": "rejected",
                                "summary": "Scaffold placeholder must be replaced by a real formal review conclusion.",
                            },
                        },
                        {
                            "id": "scaffolded-warn-1",
                            "summary": "Record a real review before asking merge checkpoint to consume it.",
                            "severity": "warn",
                            "rebuttal": None,
                            "disposition": {
                                "status": "deferred",
                                "summary": "This follow-up stays open until a real review is recorded.",
                            },
                        },
                    ],
                    "blocking_issues": ["Review artifact scaffolded but not yet concluded."],
                    "follow_ups": ["Record a real review before asking merge checkpoint to consume it."],
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        if args.init_recovery:
            recovery_path.parent.mkdir(parents=True, exist_ok=True)
            recovery_path.write_text(
                render_recovery_entry(
                    args.item,
                    {
                        "current_checkpoint": "admission checkpoint",
                        "current_stop": "Work item scaffolded and waiting for the first execution pass.",
                        "next_step": "Write the first recovery update for this work item.",
                        "blockers": "None recorded.",
                        "latest_validation_summary": "No validation recorded yet.",
                        "recovery_boundary": f"Work item scaffolded at `{work_item_relative}`.",
                        "current_lane": "not yet assigned",
                    },
                ),
                encoding="utf-8",
            )

    else:
        if not work_item_path.exists():
            return emit(
                {
                    "command": "work-item",
                    "operation": "update",
                    "result": "block",
                    "summary": "work-item update requires an existing work item file.",
                    "missing_inputs": [f"missing work item: {work_item_relative}"],
                    "fallback_to": "admission",
                }
            )
        parsed_work_item, parse_errors = parse_work_item(work_item_path, target_root)
        if parse_errors:
            return emit(
                {
                    "command": "work-item",
                    "operation": "update",
                    "result": "block",
                    "summary": "work-item update could not parse the current work item.",
                    "missing_inputs": parse_errors,
                    "fallback_to": "admission",
                }
            )
        work_item_payload = {
            "item_id": args.item,
            "goal": args.goal or str(parsed_work_item["goal"]),
            "scope": args.scope or str(parsed_work_item["scope"]),
            "execution_path": args.execution_path or str(parsed_work_item["execution_path"]),
            "workspace_entry": args.workspace_entry or str(parsed_work_item["workspace_entry"]),
            "recovery_entry": args.recovery_entry or str(parsed_work_item["recovery_entry"]),
            "review_entry": str(parsed_work_item["review_entry"]),
            "validation_entry": args.validation_entry or str(parsed_work_item["validation_entry"]),
            "closing_condition": args.closing_condition or str(parsed_work_item["closing_condition"]),
            "associated_artifacts": list(parsed_work_item["associated_artifacts"]),
        }
        for artifact in args.add_artifact:
            if artifact not in work_item_payload["associated_artifacts"]:
                work_item_payload["associated_artifacts"].append(artifact)
        for artifact in args.remove_artifact:
            work_item_payload["associated_artifacts"] = [
                entry for entry in work_item_payload["associated_artifacts"] if entry != artifact
            ]
        recovery_relative = work_item_payload["recovery_entry"]
        resolved_payload_locators, payload_locator_errors = validate_work_item_payload_locators(
            target_root,
            work_item_payload,
        )
        if payload_locator_errors:
            return emit(
                {
                    "command": "work-item",
                    "operation": "update",
                    "result": "block",
                    "summary": "work-item update refused unsafe authored locator input.",
                    "missing_inputs": payload_locator_errors,
                    "fallback_to": "admission",
                }
            )
        recovery_path = resolved_payload_locators["recovery_entry"]
        work_item_path.write_text(render_work_item(work_item_payload), encoding="utf-8")

    if args.activate:
        if not recovery_path.exists():
            return emit(
                {
                    "command": "work-item",
                    "operation": args.operation,
                    "result": "block",
                    "summary": "work-item activation requires an existing recovery entry.",
                    "missing_inputs": [f"missing recovery entry: {recovery_relative}"],
                    "fallback_to": "admission",
                }
            )
        runtime_evidence, runtime_errors = read_runtime_evidence(target_root, status_relative)
        if runtime_errors:
            return emit(
                {
                    "command": "work-item",
                    "operation": args.operation,
                    "result": "block",
                    "summary": "work-item activation could not read runtime evidence from the current status surface.",
                    "missing_inputs": runtime_errors,
                    "fallback_to": "admission",
                }
            )
        update_active_entry_points(
            target_root,
            args.output,
            item_id=args.item,
            work_item=work_item_relative,
            recovery_entry=recovery_relative,
            status_surface=status_relative,
        )
        _, sync_errors = sync_status_surface(target_root, args.output, runtime_evidence)
        if sync_errors:
            return emit(
                {
                    "command": "work-item",
                    "operation": args.operation,
                    "result": "block",
                    "summary": "work-item activation updated the locator truth, but fact-chain sync failed.",
                    "missing_inputs": sync_errors,
                    "fallback_to": "admission",
                }
            )
    else:
        init_result = load_json_file(output_path)
        fact_chain = init_result.get("fact_chain")
        entry_points = fact_chain.get("entry_points") if isinstance(fact_chain, dict) else None
        if isinstance(entry_points, dict) and entry_points.get("current_item_id") == args.item:
            runtime_evidence, runtime_errors = read_runtime_evidence(target_root, status_relative)
            if runtime_errors:
                return emit(
                    {
                        "command": "work-item",
                        "operation": args.operation,
                        "result": "block",
                        "summary": "work-item authoring updated the active item, but runtime evidence could not be read for status sync.",
                        "missing_inputs": runtime_errors,
                        "fallback_to": "admission",
                    }
                )
            _, sync_errors = sync_status_surface(target_root, args.output, runtime_evidence)
            if sync_errors:
                return emit(
                    {
                        "command": "work-item",
                        "operation": args.operation,
                        "result": "block",
                        "summary": "work-item authoring updated the active item, but fact-chain sync failed.",
                        "missing_inputs": sync_errors,
                        "fallback_to": "admission",
                    }
                )

    context, context_errors = load_context(target_root, args.output, args.item if args.activate else None)
    payload: dict[str, Any] = {
        "command": "work-item",
        "operation": args.operation,
        "result": "pass",
        "summary": (
            "work item was authored successfully."
            if not args.activate
            else "work item was authored and activated as the current Loom fact chain entry."
        ),
        "missing_inputs": [],
        "fallback_to": None,
        "work_item": {
            "id": args.item,
            "path": work_item_relative,
            "recovery_entry": recovery_relative,
            "review_entry": review_relative if args.operation == "create" else work_item_payload["review_entry"],
            "activated": args.activate,
        },
    }
    if context_errors:
        payload["result"] = "block"
        payload["summary"] = "work-item authoring completed, but the fact chain no longer reads cleanly."
        payload["missing_inputs"] = context_errors
        payload["fallback_to"] = "admission"
    else:
        payload["current_fact_chain"] = {
            "current_item_id": context["item_id"],
            "work_item": str(context["report"]["fact_chain"]["entry_points"]["work_item"]),
            "recovery_entry": str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"]),
            "status_surface": str(context["report"]["fact_chain"]["entry_points"]["status_surface"]),
        }
    return emit(payload)


def build_required_inputs(context: dict[str, Any]) -> list[dict[str, Any]]:
    plan_path = context["target_root"] / ".loom/specs" / context["item_id"] / "plan.md"
    spec_path = context["target_root"] / ".loom/specs" / context["item_id"] / "spec.md"
    validation_summary = context["latest_validation_summary"].strip()
    return [
        {
            "id": "work_item",
            "status": "present" if context["work_item_path"].exists() else "missing",
            "locator": relative_to_root(context["work_item_path"], context["target_root"]),
        },
        {
            "id": "spec",
            "status": "present" if spec_path.exists() else "missing",
            "locator": relative_to_root(spec_path, context["target_root"]),
        },
        {
            "id": "plan",
            "status": "present" if plan_path.exists() else "missing",
            "locator": relative_to_root(plan_path, context["target_root"]),
        },
        {
            "id": "recovery_baseline",
            "status": "present" if context["recovery_path"].exists() else "missing",
            "locator": relative_to_root(context["recovery_path"], context["target_root"]),
        },
        {
            "id": "validation_baseline",
            "status": "present" if validation_summary and validation_summary.lower() != "not yet run for wi-706." else "missing",
            "locator": "Latest Validation Summary",
        },
        {
            "id": "workspace",
            "status": "present" if context["workspace_path"].exists() else "missing",
            "locator": context["workspace_entry"],
        },
        {
            "id": "ownership_constraints",
            "status": "present" if "ownership" in context["scope"].lower() or "ownership" in context["closing_condition"].lower() else "missing",
            "locator": "Work Item Scope / Closing Condition",
        },
    ]


def delegation_required_field_errors(delegation: dict[str, Any], index: int) -> list[str]:
    required = (
        "task_goal",
        "context_locators",
        "read_scope",
        "write_ownership",
        "non_goals",
        "validation_expectation",
        "output_format",
        "integration_target",
    )
    errors: list[str] = []
    for field in required:
        value = delegation.get(field)
        if value in (None, "", [], {}):
            errors.append(f"delegation[{index}] missing `{field}`")
    if not isinstance(delegation.get("context_locators"), list):
        errors.append(f"delegation[{index}] context_locators must be a list")
    if not isinstance(delegation.get("read_scope"), list):
        errors.append(f"delegation[{index}] read_scope must be a list")
    if not isinstance(delegation.get("write_ownership"), list):
        errors.append(f"delegation[{index}] write_ownership must be a list")
    return errors


def overlap_write_ownership(delegations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    owners: dict[str, list[str]] = {}
    for index, delegation in enumerate(delegations):
        name = str(delegation.get("id") or f"delegation[{index}]")
        write_ownership = delegation.get("write_ownership")
        if not isinstance(write_ownership, list):
            continue
        for path in write_ownership:
            if isinstance(path, str) and path:
                owners.setdefault(path, []).append(name)
    return [
        {
            "path": path,
            "owners": names,
            "result": "block",
            "summary": "overlapping write ownership must be integrated locally before review or merge-ready",
        }
        for path, names in sorted(owners.items())
        if len(names) > 1
    ]


def repeated_blocker_signal(delegations: list[dict[str, Any]]) -> dict[str, Any]:
    by_signature: dict[str, list[str]] = {}
    for index, delegation in enumerate(delegations):
        signature = delegation.get("blocker_signature") or delegation.get("blocker")
        if not isinstance(signature, str) or not signature:
            continue
        name = str(delegation.get("id") or f"delegation[{index}]")
        by_signature.setdefault(signature, []).append(name)
    repeated = [
        {
            "signature": signature,
            "sources": sources,
            "count": len(sources),
            "recommended_action": "pause delegation retries and resolve root cause in the main execution lane",
        }
        for signature, sources in sorted(by_signature.items())
        if len(sources) > 1
    ]
    return {
        "schema_version": REPEATED_BLOCKER_SIGNAL_SCHEMA,
        "result": "block" if repeated else "pass",
        "summary": (
            "repeated blocker candidates require root-cause escalation."
            if repeated
            else "no repeated blocker candidates were detected."
        ),
        "repeated": repeated,
    }


def read_build_evidence(target_root: Path, relative_path: str | None) -> tuple[dict[str, Any] | None, list[str], str | None]:
    if not relative_path:
        return None, ["build evidence is required before build readiness can be claimed"], None
    evidence_path, errors = resolve_repo_relative_path(target_root, relative_path, label="build evidence")
    if errors:
        return None, errors, relative_path
    assert evidence_path is not None
    if not evidence_path.exists():
        return None, [f"build evidence is missing: {relative_path}"], relative_path
    try:
        payload = load_json_file(evidence_path)
    except json.JSONDecodeError as exc:
        return None, [f"build evidence is invalid JSON: {exc.msg}"], relative_path
    if not isinstance(payload, dict):
        return None, ["build evidence must be a JSON object"], relative_path
    return payload, [], relative_path


def build_execution_payload(context: dict[str, Any], evidence_relative: str | None) -> dict[str, Any]:
    required_inputs = build_required_inputs(context)
    missing_inputs = [
        f"required build input `{entry['id']}` is missing"
        for entry in required_inputs
        if entry.get("status") != "present"
    ]
    evidence, evidence_errors, evidence_locator = read_build_evidence(context["target_root"], evidence_relative)
    missing_inputs.extend(evidence_errors)

    delegations: list[dict[str, Any]] = []
    integration_evidence: list[dict[str, Any]] = []
    ownership_conflicts: list[dict[str, Any]] = []
    repeated_signal = {
        "schema_version": REPEATED_BLOCKER_SIGNAL_SCHEMA,
        "result": "pass",
        "summary": "no delegation evidence was available.",
        "repeated": [],
    }
    delegation_errors: list[str] = []
    unintegrated: list[str] = []

    if evidence is not None:
        if evidence.get("schema_version") != BUILD_EVIDENCE_SCHEMA:
            missing_inputs.append(f"build evidence schema must be `{BUILD_EVIDENCE_SCHEMA}`")
        raw_delegations = evidence.get("delegations")
        if not isinstance(raw_delegations, list):
            missing_inputs.append("build evidence must declare `delegations`")
        else:
            delegations = [entry for entry in raw_delegations if isinstance(entry, dict)]
            if len(delegations) != len(raw_delegations):
                missing_inputs.append("every delegation entry must be an object")
            for index, delegation in enumerate(delegations):
                delegation_errors.extend(delegation_required_field_errors(delegation, index))
                status = delegation.get("status")
                if status != "integrated":
                    unintegrated.append(str(delegation.get("id") or f"delegation[{index}]"))
        raw_integration = evidence.get("integration_evidence")
        if isinstance(raw_integration, list):
            integration_evidence = [entry for entry in raw_integration if isinstance(entry, dict)]
        elif raw_integration is not None:
            missing_inputs.append("build evidence `integration_evidence` must be a list when present")
        ownership_conflicts = overlap_write_ownership(delegations)
        repeated_signal = repeated_blocker_signal(delegations)

    missing_inputs.extend(delegation_errors)
    missing_inputs.extend(f"delegation `{name}` output is not integrated into Loom carriers" for name in unintegrated)
    missing_inputs.extend(f"overlapping write ownership for `{conflict['path']}`" for conflict in ownership_conflicts)
    if repeated_signal.get("result") == "block":
        missing_inputs.append("repeated blocker candidates require root-cause escalation before build readiness")

    result = "pass" if not missing_inputs else "block"
    return {
        "schema_version": "loom-build-execution/v1",
        "result": result,
        "summary": (
            "build execution evidence is integrated and ready for review."
            if result == "pass"
            else "build execution evidence is missing, unintegrated, overlapping, or repeatedly blocked."
        ),
        "missing_inputs": missing_inputs,
        "fallback_to": None if result == "pass" else "build",
        "required_inputs": required_inputs,
        "ownership_contract": {
            "schema_version": SUBAGENT_OWNERSHIP_SCHEMA,
            "required_fields": [
                "task_goal",
                "context_locators",
                "read_scope",
                "write_ownership",
                "non_goals",
                "validation_expectation",
                "output_format",
                "integration_target",
            ],
            "main_executor_responsibilities": [
                "integrate delegated output into implementation",
                "record validation evidence",
                "update recovery and status carriers",
                "feed integrated evidence into later review inputs",
            ],
        },
        "delegation_evidence": {
            "locator": evidence_locator,
            "delegations": delegations,
            "unintegrated": unintegrated,
        },
        "integration_evidence": integration_evidence,
        "ownership_conflicts": ownership_conflicts,
        "repeated_blocker_signal": repeated_signal,
    }


def handle_flow(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    steps: list[dict[str, Any]] = [
        {
            "name": "runtime-state",
            "result": runtime_state["result"],
            "summary": runtime_state["summary"],
            "missing_inputs": runtime_state["missing_inputs"],
            "fallback_to": runtime_state["fallback_to"],
        }
    ]
    if runtime_state["result"] != "pass":
        return emit(
            {
                "command": "flow",
                "operation": args.operation,
                "result": "block",
                "summary": "flow command is blocked because the Loom runtime state is inconsistent.",
                "missing_inputs": runtime_state["missing_inputs"],
                "fallback_to": runtime_state["fallback_to"],
                "steps": steps,
                "runtime_state": runtime_state,
            }
        )

    if args.operation == "story":
        return emit(story_flow_payload(target_root=target_root, runtime_state=runtime_state, steps=steps))

    context, errors = load_context(target_root, args.output, args.item)
    if errors:
        return emit(
            {
                "command": "flow",
                "operation": args.operation,
                "result": "block",
                "summary": "flow command could not read a valid Loom fact chain.",
                "missing_inputs": [f"fact-chain: {message}" for message in errors],
                "fallback_to": "admission",
                "steps": steps,
                "runtime_state": runtime_state,
                **fact_chain_error_contract(errors, output_relative=args.output),
            }
        )

    if args.operation not in {"build", "pre-review", "review", "spec-review", "resume", "handoff", "merge-ready"}:
        return emit(
            {
                "command": "flow",
                "operation": args.operation,
                "result": "block",
                "summary": f"unsupported flow operation: {args.operation}",
                "missing_inputs": [f"unsupported operation: {args.operation}"],
                "fallback_to": None,
                "steps": steps,
                "runtime_state": runtime_state,
            }
        )
    if args.operation in {"review", "spec-review"}:
        payload = build_review_flow_payload(target_root, args.output, args.item, operation=args.operation)
        payload["execution_attempt"] = persist_execution_attempt(
            context,
            command="flow",
            operation=args.operation,
            payload=payload,
        )
        return emit(payload)

    steps.append(
        {
            "name": "fact-chain",
            "result": "block" if report_blocking_failures(context["report"]) else "pass",
            "summary": (
                "fact chain is readable from a single entry."
                if not report_blocking_failures(context["report"])
                else "fact chain is readable, but provenance or derived-surface drift is blocking."
            ),
            "missing_inputs": report_blocking_messages(context["report"]),
            "fallback_to": "admission" if report_blocking_failures(context["report"]) else None,
            "blocking_failures": report_blocking_failures(context["report"]),
        }
    )

    state_payload = state_check_payload(context)
    steps.append(
        {
            "name": "state-check",
            "result": state_payload["result"],
            "summary": state_payload["summary"],
            "missing_inputs": state_payload["missing_inputs"],
            "fallback_to": state_payload["fallback_to"],
        }
    )

    review_payload: dict[str, Any] | None = None
    build_execution: dict[str, Any] | None = None
    governance_surface = build_governance_surface(target_root)
    upgrade_path = maturity_upgrade_path(governance_surface, target_root)
    repo_interface = governance_surface.get("repo_interface")
    repo_specific_requirements: dict[str, Any] | None = None

    if args.operation in {"resume", "handoff"}:
        locate_payload = base_workspace_payload(context, "locate")
        locate_result = "pass" if not locate_payload["purity"]["hard_failures"] else "block"
        locate_step = {
            "name": "workspace-locate",
            "result": locate_result,
            "summary": (
                "workspace is location-resolved and execution-ready."
                if locate_result == "pass"
                else "workspace is location-resolved but not execution-ready."
            ),
            "missing_inputs": list(locate_payload["purity"]["hard_failures"]),
            "fallback_to": "admission" if locate_payload["purity"]["hard_failures"] else None,
        }
        steps.append(locate_step)
    else:
        runtime_fields, runtime_missing = runtime_evidence_from_report(context["report"])
        runtime_result = "pass" if not runtime_missing else "block"
        steps.append(
            {
                "name": "runtime-evidence",
                "result": runtime_result,
                "summary": (
                    "runtime evidence entries are readable."
                    if runtime_result == "pass"
                    else "runtime evidence entries are incomplete or inconsistent."
                ),
                "missing_inputs": runtime_missing,
                "fallback_to": "admission" if runtime_missing else None,
                "runtime_evidence": runtime_fields,
            }
        )
        if args.operation == "build":
            admission_payload = checkpoint_payload("admission", context)
            locate_payload = base_workspace_payload(context, "locate")
            locate_result = "pass" if not locate_payload["purity"]["hard_failures"] else "block"
            build_execution = build_execution_payload(context, args.build_evidence)
            steps.extend(
                [
                    {
                        "name": "checkpoint-admission",
                        "result": admission_payload["result"],
                        "summary": admission_payload["summary"],
                        "missing_inputs": admission_payload["missing_inputs"],
                        "fallback_to": admission_payload["fallback_to"],
                    },
                    {
                        "name": "workspace-locate",
                        "result": locate_result,
                        "summary": (
                            "workspace is location-resolved and execution-ready."
                            if locate_result == "pass"
                            else "workspace is location-resolved but not execution-ready."
                        ),
                        "missing_inputs": list(locate_payload["purity"]["hard_failures"]),
                        "fallback_to": "admission" if locate_payload["purity"]["hard_failures"] else None,
                    },
                    {
                        "name": "build-execution",
                        "result": build_execution["result"],
                        "summary": build_execution["summary"],
                        "missing_inputs": build_execution["missing_inputs"],
                        "fallback_to": build_execution["fallback_to"],
                    },
                ]
            )
        elif args.operation == "merge-ready":
            build_payload = checkpoint_payload("build", context)
            merge_payload = checkpoint_payload("merge", context)
            repo_specific_requirements = repo_specific_requirements_payload(
                repo_interface,
                target_root=target_root,
                surface="merge_ready",
            )
            steps.extend(
                [
                    {
                        "name": "checkpoint-build",
                        "result": build_payload["result"],
                        "summary": build_payload["summary"],
                        "missing_inputs": build_payload["missing_inputs"],
                        "fallback_to": build_payload["fallback_to"],
                    },
                    {
                        "name": "checkpoint-merge",
                        "result": merge_payload["result"],
                        "summary": merge_payload["summary"],
                        "missing_inputs": merge_payload["missing_inputs"],
                        "fallback_to": merge_payload["fallback_to"],
                    },
                ]
            )
        elif args.operation == "review":
            build_payload = checkpoint_payload("build", context)
            repo_specific_requirements = repo_specific_requirements_payload(
                repo_interface,
                target_root=target_root,
                surface="review",
            )
            review_record, review_path, review_errors = load_review_record(
                target_root,
                context["item_id"],
                context["review_entry"],
            )
            review_step = {
                "name": "review-entry",
                "result": "pass" if review_record and not review_errors else "block",
                "summary": (
                    "formal review artifact is readable."
                    if review_record and not review_errors
                    else "formal review artifact is missing or invalid."
                ),
                "missing_inputs": review_errors or ([] if review_record else [f"missing review artifact: {review_path}"]),
                "fallback_to": "build" if (review_errors or review_record is None) else None,
            }
            steps.extend(
                [
                    {
                        "name": "checkpoint-build",
                        "result": build_payload["result"],
                        "summary": build_payload["summary"],
                        "missing_inputs": build_payload["missing_inputs"],
                        "fallback_to": build_payload["fallback_to"],
                    },
                    review_step,
                ]
            )
            review_payload = {
                "path": review_path,
                "record": review_record,
            }
        else:
            admission_payload = checkpoint_payload("admission", context)
            locate_payload = base_workspace_payload(context, "locate")
            locate_result = "pass" if not locate_payload["purity"]["hard_failures"] else "block"
            locate_step = {
                "name": "workspace-locate",
                "result": locate_result,
                "summary": (
                    "workspace is location-resolved and execution-ready."
                    if locate_result == "pass"
                    else "workspace is location-resolved but not execution-ready."
                ),
                "missing_inputs": list(locate_payload["purity"]["hard_failures"]),
                "fallback_to": "admission" if locate_payload["purity"]["hard_failures"] else None,
            }
            steps.append(
                {
                    "name": "checkpoint-admission",
                    "result": admission_payload["result"],
                    "summary": admission_payload["summary"],
                    "missing_inputs": admission_payload["missing_inputs"],
                    "fallback_to": admission_payload["fallback_to"],
                }
            )
            steps.append(locate_step)

    result = "pass"
    fallback_to: str | None = None
    for step in steps:
        step_result = step["result"]
        if step_result == "fallback":
            result = "fallback"
            fallback_to = step.get("fallback_to") or "admission"
            break
        if step_result == "block" and result == "pass":
            result = "block"
            fallback_to = step.get("fallback_to")
    if result != "block" and isinstance(repo_specific_requirements, dict) and repo_specific_requirements["result"] == "block":
        result = "block"
        fallback_to = fallback_to or repo_specific_requirements["fallback_to"]

    if args.operation == "resume":
        summary = (
            "resume flow rebuilt the current execution context and next step."
            if result == "pass"
            else "resume flow rebuilt context but found blocking signals before execution can continue."
        )
    elif args.operation == "handoff":
        summary = (
            "handoff flow produced the minimum writeback checklist and locator set."
            if result == "pass"
            else "handoff flow produced the minimum writeback checklist, but blocking signals remain before transfer."
        )
    elif args.operation == "build":
        summary = (
            "build flow found integrated execution evidence and can proceed toward review."
            if result == "pass"
            else "build flow found missing, unintegrated, overlapping, or repeatedly blocked execution evidence."
        )
        if build_execution and build_execution["result"] == "block":
            fallback_to = fallback_to or "build"
    elif args.operation == "merge-ready":
        if isinstance(repo_specific_requirements, dict) and result == "block" and repo_specific_requirements["result"] == "block":
            summary = "merge-ready flow found companion-declared blocking requirements that Loom core does not satisfy on its own."
        else:
            summary = (
                "merge-ready flow found the required evidence and checkpoint state for host merge."
                if result == "pass"
                else "merge-ready flow found fallback or blocking signals before host merge."
            )
    elif args.operation == "review":
        if isinstance(repo_specific_requirements, dict) and result == "block" and repo_specific_requirements["result"] == "block":
            summary = "review flow exposed companion-declared blocking requirements instead of pretending Loom core already covers them."
        else:
            summary = (
                "review flow prepared the semantic review context and exposed the formal review artifact."
                if result == "pass"
                else "review flow found missing review material or earlier blocking signals."
            )
    else:
        summary = (
            "pre-review flow is ready to proceed."
            if result == "pass"
            else "pre-review flow found blocking signals before review."
        )
    missing_inputs: list[str] = []
    for step in steps:
        if step["result"] in {"block", "fallback"}:
            for message in step.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(message)
    if isinstance(repo_specific_requirements, dict) and repo_specific_requirements["result"] == "block":
        for message in repo_specific_requirements.get("missing_inputs", []):
            if message not in missing_inputs:
                missing_inputs.append(message)
    if args.operation == "resume":
        repo_interface = governance_surface.get("repo_interface")
        repo_interop = governance_surface.get("repo_interop")
        adoption_workflow_active = (
            isinstance(repo_interface, dict)
            and repo_interface.get("availability") in {"companion_docs_only", "incomplete"}
        ) or (
            isinstance(repo_interop, dict)
            and repo_interop.get("availability") == "incomplete"
        )
        if adoption_workflow_active:
            for message in governance_surface.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(message)
            for message in upgrade_path.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(message)
        if adoption_workflow_active and missing_inputs and result == "pass":
            result = "block"
            fallback_to = fallback_to or "adoption"
            summary = "resume flow rebuilt context but found adoption guidance gaps before execution can continue."
    adoption_guidance = None
    if args.operation == "resume":
        guided = upgrade_path.get("guided_adoption_plan") if isinstance(upgrade_path, dict) else None
        decisions = upgrade_path.get("adoption_decisions") if isinstance(upgrade_path, dict) else None
        next_step = None
        if isinstance(guided, dict):
            for step in guided.get("steps", []):
                if isinstance(step, dict) and step.get("status") in {"missing", "blocked"}:
                    next_step = step
                    break
        adoption_guidance = {
            "schema_version": "loom-adoption-resume-guidance/v1",
            "result": upgrade_path.get("result") if isinstance(upgrade_path, dict) else "block",
            "summary": "resume exposes the next adoption read/judge/write/verify step without writing adoption state.",
            "next_step": next_step,
            "adoption_decisions": decisions,
            "guided_adoption_plan": guided,
        }

    fact_chain_provenance = report_provenance(context["report"])
    recovery_readiness = report_recovery_readiness(context["report"])
    execution_ledger = report_execution_ledger(context["report"])
    blocking_failures = report_blocking_failures(context["report"])
    if recovery_readiness.get("result") == "block" and result == "pass":
        result = "block"
        fallback_to = fallback_to or recovery_readiness.get("fallback_to") or "admission"
        summary = "flow rebuilt context but recovery readiness is blocking."

    payload = {
            "command": "flow",
            "operation": args.operation,
            "item": {
                "id": context["item_id"],
                "goal": context["goal"],
                "scope": context["scope"],
                "execution_path": context["execution_path"],
            },
            "result": result,
            "summary": summary,
            "missing_inputs": missing_inputs,
            "fallback_to": fallback_to,
            "steps": steps,
            "runtime_state": runtime_state,
            "provenance": fact_chain_provenance,
            "recovery_readiness": recovery_readiness,
            "execution_ledger": execution_ledger,
            "blocking_failures": blocking_failures,
            **({"governance_surface": governance_surface} if args.operation == "resume" else {}),
            **({"maturity_upgrade_path": upgrade_path} if args.operation == "resume" else {}),
            **({"adoption_guidance": adoption_guidance} if args.operation == "resume" else {}),
            **(
                {
                    "workspace": {
                        "entry": locate_payload["workspace"]["entry"],
                        "path": locate_payload["workspace"]["path"],
                        "exists": locate_payload["workspace"]["exists"],
                    },
                    "checkpoint": {
                        "raw": context["current_checkpoint_raw"],
                        "normalized": context["current_checkpoint"],
                    },
                    "state_check": {
                        "result": state_payload["result"],
                        "summary": state_payload["summary"],
                        "missing_inputs": state_payload["missing_inputs"],
                        "fallback_to": state_payload["fallback_to"],
                        "checks": state_payload["checks"],
                    },
                    "lifecycle_expectations": locate_payload["lifecycle_expectations"],
                }
                if args.operation in {"resume", "handoff"}
                else {}
            ),
            **(
                {
                    "recovery": {
                        "path": locate_payload["recovery"]["path"],
                        "current_stop": locate_payload["recovery"]["current_stop"],
                        "next_step": context["next_step"],
                        "blockers": context["blockers"],
                        "latest_validation_summary": context["latest_validation_summary"],
                        "adoption_source": "maturity_upgrade_path",
                        "companion_locator": ".loom/companion/repo-interface.json",
                        "interop_locator": ".loom/companion/interop.json",
                        "post_adoption_next_step": adoption_guidance.get("next_step") if isinstance(adoption_guidance, dict) else None,
                        "adoption_verify_summary": (
                            f"python3 tools/loom_flow.py adopt verify --target {command_target(target_root)} --item {context['item_id']}"
                        ),
                    },
                }
                if args.operation == "resume"
                else {}
            ),
            **(
                {
                    "recovery_entry": str(context["report"]["fact_chain"]["entry_points"]["recovery_entry"]),
                    "status_surface": str(context["report"]["fact_chain"]["entry_points"]["status_surface"]),
                    "current_stop": context["current_stop"],
                    "next_step": context["next_step"],
                    "blockers": context["blockers"],
                    "latest_validation_summary": context["latest_validation_summary"],
                    "fallback_target": fallback_to,
                    "writeback_fields": [
                        "current_stop",
                        "next_step",
                        "blockers",
                        "latest_validation_summary",
                    ],
                }
                if args.operation == "handoff"
                else {}
            ),
            **(
                {
                    "state_check": {
                        "result": state_payload["result"],
                        "summary": state_payload["summary"],
                        "missing_inputs": state_payload["missing_inputs"],
                        "fallback_to": state_payload["fallback_to"],
                        "checks": state_payload["checks"],
                    },
                    "runtime_evidence": runtime_fields,
                    "build_execution": build_execution,
                    "current_checkpoint": {
                        "raw": context["current_checkpoint_raw"],
                        "normalized": context["current_checkpoint"],
                    },
                    "current_lane": context["current_lane"],
                }
                if args.operation == "build"
                else {}
            ),
            **(
                {
                    "state_check": {
                        "result": state_payload["result"],
                        "summary": state_payload["summary"],
                        "missing_inputs": state_payload["missing_inputs"],
                        "fallback_to": state_payload["fallback_to"],
                        "checks": state_payload["checks"],
                    },
                    "runtime_evidence": runtime_fields,
                    "build_checkpoint": {
                        "result": build_payload["result"],
                        "summary": build_payload["summary"],
                        "missing_inputs": build_payload["missing_inputs"],
                        "fallback_to": build_payload["fallback_to"],
                    },
                    "budget_risk": derive_execution_budget_risk(
                        governance_surface.get("github_control_plane", {}).get("api_snapshot", {}).get("budget")
                        if isinstance(governance_surface.get("github_control_plane"), dict)
                        else None
                    ),
                    "review": review_payload,
                    "repo_specific_requirements": repo_specific_requirements,
                    "current_checkpoint": {
                        "raw": context["current_checkpoint_raw"],
                        "normalized": context["current_checkpoint"],
                    },
                }
                if args.operation == "review"
                else {}
            ),
            **(
                {
                    "state_check": {
                        "result": state_payload["result"],
                        "summary": state_payload["summary"],
                        "missing_inputs": state_payload["missing_inputs"],
                        "fallback_to": state_payload["fallback_to"],
                        "checks": state_payload["checks"],
                    },
                    "runtime_evidence": runtime_fields,
                    "build_checkpoint": {
                        "result": build_payload["result"],
                        "summary": build_payload["summary"],
                        "missing_inputs": build_payload["missing_inputs"],
                        "fallback_to": build_payload["fallback_to"],
                    },
                    "merge_checkpoint": {
                        "result": merge_payload["result"],
                        "summary": merge_payload["summary"],
                        "missing_inputs": merge_payload["missing_inputs"],
                        "fallback_to": merge_payload["fallback_to"],
                        "pr_template": merge_payload.get("pr_template"),
                    },
                    "budget_risk": merge_payload.get("budget_risk"),
                    "spec_review": merge_payload.get("spec_review"),
                    "current_checkpoint": {
                        "raw": context["current_checkpoint_raw"],
                        "normalized": context["current_checkpoint"],
                    },
                    "current_lane": context["current_lane"],
                    "latest_validation_summary": context["latest_validation_summary"],
                    "repo_specific_requirements": repo_specific_requirements,
                }
                if args.operation == "merge-ready"
                else {}
            ),
        }
    payload["execution_attempt"] = persist_execution_attempt(
        context,
        command="flow",
        operation=args.operation,
        payload=payload,
    )
    return emit(payload)


def handle_shadow_parity(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        return emit(
            runtime_state_block_payload(
                command="shadow-parity",
                runtime_state=runtime_state,
                summary="shadow parity is blocked because the Loom runtime state is inconsistent.",
            )
        )

    governance_surface = build_governance_surface(target_root)
    repo_interop = governance_surface.get("repo_interop")
    requested_surfaces = SHADOW_PARITY_SURFACES if args.surface == "all" else (args.surface,)
    mode = "blocking" if args.blocking else args.mode
    reports = [
        shadow_parity_report(
            repo_interop,
            target_root=target_root,
            surface=surface,
        )
        for surface in requested_surfaces
    ]

    all_match = bool(reports) and all(report["result"] == "match" for report in reports)
    blocking_reports = [report for report in reports if report.get("result") != "match"]
    if mode == "blocking":
        result = "pass" if all_match else "block"
        for report in blocking_reports:
            report["blocking"] = True
    else:
        result = "pass" if all_match else "warn"
    if result == "pass":
        summary = "shadow parity matches across all requested surfaces."
    elif mode == "blocking":
        summary = "shadow parity blocking mode found mismatch or unreadable surfaces."
    else:
        summaries = {report["result"] for report in reports}
        if "mismatch" in summaries:
            summary = "shadow parity found mismatches between Loom and repo-native governance surfaces."
        else:
            summary = "shadow parity could not fully read the declared governance surfaces."

    missing_inputs: list[str] = []
    missing_details: list[Any] = []
    for report in reports:
        for message in report.get("missing_inputs", []):
            if message not in missing_inputs:
                missing_inputs.append(message)
        details = report.get("missing_details")
        if isinstance(details, list):
            for detail in details:
                if detail not in missing_details:
                    missing_details.append(detail)
    blocking_failures = [
        {
            "category": "drift" if report.get("classification") == "drift" else "gate_failure",
            "kind": "parallel_truth_drift" if report.get("result") == "mismatch" else "shadow_parity_unreadable",
            "surface": report.get("surface"),
            "message": report.get("summary"),
            "blocking": mode == "blocking",
            "fallback_to": "manual-reconciliation",
        }
        for report in blocking_reports
        if isinstance(report, dict)
    ]

    payload = {
        "command": "shadow-parity",
        "mode": mode,
        "blocking": mode == "blocking",
        "result": result,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "fallback_to": "manual-reconciliation" if result == "block" else None,
        "runtime_state": runtime_state,
        "governance_surface": governance_surface,
        "reports": reports,
        "blocking_failures": blocking_failures,
    }
    if missing_details:
        payload["missing_details"] = missing_details
    return emit(payload)


def handle_live_smoke(args: argparse.Namespace) -> int:
    if args.operation == "run":
        if not args.target:
            return emit(
                {
                    "command": "live-smoke",
                    "operation": "run",
                    "schema_version": LIVE_SMOKE_SCHEMA,
                    "result": "block",
                    "summary": "live smoke run requires --target.",
                    "missing_inputs": ["pass --target <adopted_repo_root>"],
                    "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                    "runtime_state": runtime_state_payload(Path.cwd()),
                    "command_plan": [],
                    "reports": [],
                    "live_smoke": {
                        "status": "failed",
                        "executed_at": current_iso_timestamp(),
                        "release_interpretation": live_smoke_release_interpretation("failed"),
                    },
                }
            )
        return emit(
            live_smoke_run_payload(
                Path(args.target).expanduser().resolve(),
                item=args.item,
                dry_run=args.dry_run,
                include_blocking_shadow=args.include_blocking_shadow,
            )
        )
    if args.operation == "host-adapter-drift":
        if not args.target:
            return emit(
                {
                    "command": "live-smoke",
                    "operation": "host-adapter-drift",
                    "schema_version": HOST_ADAPTER_LIVE_DRIFT_SCHEMA,
                    "result": "block",
                    "summary": "host adapter live drift requires --target.",
                    "missing_inputs": ["pass --target <adopted_repo_root>"],
                    "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                    "runtime_state": runtime_state_payload(Path.cwd()),
                    "command_plan": [],
                    "reports": [],
                    "profile_check": {"id": "host-adapter-live-drift", "result": "block"},
                    "host_adapter_drift": {
                        "contract_locator": ".loom/companion/interop.json",
                        "availability": "missing-target",
                        "expected_host_adapter_version": current_host_adapter_version(),
                        "checks": [],
                    },
                }
            )
        return emit(host_adapter_live_drift_payload(Path(args.target).expanduser().resolve()))
    if args.operation == "dynamic-tool-availability":
        if not args.target:
            return emit(
                {
                    "command": "live-smoke",
                    "operation": "dynamic-tool-availability",
                    "schema_version": DYNAMIC_TOOL_LIVE_AVAILABILITY_SCHEMA,
                    "result": "block",
                    "summary": "dynamic tool live availability requires --target.",
                    "missing_inputs": ["pass --target <adopted_repo_root>"],
                    "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                    "runtime_state": runtime_state_payload(Path.cwd()),
                    "command_plan": [],
                    "reports": [],
                    "profile_check": {"id": "dynamic-tool-live-availability", "result": "block"},
                    "dynamic_tool_availability": {
                        "contract_locator": ".loom/companion/repo-interface.json",
                        "availability": "missing-target",
                        "surface": args.surface,
                        "tool_availability": empty_tool_availability(),
                    },
                }
            )
        return emit(
            dynamic_tool_live_availability_payload(
                Path(args.target).expanduser().resolve(),
                surface=args.surface,
            )
        )
    if args.operation == "hook-envelope":
        if not args.target:
            return emit(
                {
                    "command": "live-smoke",
                    "operation": "hook-envelope",
                    "schema_version": HOOK_ENVELOPE_LIVE_CHECK_SCHEMA,
                    "result": "block",
                    "summary": "hook envelope check requires --target.",
                    "missing_inputs": ["pass --target <adopted_repo_root>"],
                    "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                    "runtime_state": runtime_state_payload(Path.cwd()),
                    "target": live_smoke_target_metadata(Path.cwd()),
                    "command_plan": [],
                    "reports": [],
                    "profile_check": {"id": "hook-envelope", "result": "block"},
                    "hook_envelope": {
                        "contract_locator": args.envelope,
                        "availability": "missing-target",
                        "requirement": args.requirement,
                        "checks": [],
                    },
                }
            )
        if not args.envelope:
            target_root = Path(args.target).expanduser().resolve()
            return emit(
                {
                    "command": "live-smoke",
                    "operation": "hook-envelope",
                    "schema_version": HOOK_ENVELOPE_LIVE_CHECK_SCHEMA,
                    "result": "block",
                    "summary": "hook envelope check requires --envelope.",
                    "missing_inputs": ["pass --envelope <repo_relative_envelope_path>"],
                    "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                    "runtime_state": runtime_state_payload(target_root),
                    "target": live_smoke_target_metadata(target_root),
                    "command_plan": hook_envelope_command_plan(target_root, envelope=args.envelope),
                    "reports": [],
                    "profile_check": {"id": "hook-envelope", "result": "block"},
                    "hook_envelope": {
                        "contract_locator": args.envelope,
                        "availability": "missing-envelope",
                        "requirement": args.requirement,
                        "checks": [],
                    },
                }
            )
        return emit(
            hook_envelope_payload(
                Path(args.target).expanduser().resolve(),
                envelope=args.envelope,
                requirement=args.requirement,
            )
        )
    if args.operation == "hooks-extension":
        if not args.target:
            return emit(
                {
                    "command": "live-smoke",
                    "operation": "hooks-extension",
                    "schema_version": HOOKS_EXTENSION_PROFILE_SCHEMA,
                    "result": "block",
                    "summary": "hooks extension profile requires --target.",
                    "missing_inputs": ["pass --target <adopted_repo_root>"],
                    "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                    "runtime_state": runtime_state_payload(Path.cwd()),
                    "target": live_smoke_target_metadata(Path.cwd()),
                    "command_plan": [],
                    "reports": [],
                    "profile_check": {"id": "hooks-extension", "result": "block"},
                    "core_profile": {"id": "orchestration-core", "hook_enforcement": "not_applicable", "result": "pass"},
                    "hooks_extension": {
                        **empty_hook_extension_profile(),
                        "status": "missing-target",
                        "result": "block",
                    },
                }
            )
        return emit(hooks_extension_payload(Path(args.target).expanduser().resolve()))
    if args.operation == "external-orchestrator-interop":
        if not args.target:
            return emit(
                {
                    "command": "live-smoke",
                    "operation": "external-orchestrator-interop",
                    "schema_version": EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA,
                    "result": "block",
                    "summary": "external orchestrator conformance requires --target.",
                    "missing_inputs": ["pass --target <adopted_repo_root>"],
                    "fallback_to": LIVE_SMOKE_CONFIG_FALLBACK,
                    "runtime_state": runtime_state_payload(Path.cwd()),
                    "target": live_smoke_target_metadata(Path.cwd()),
                    "command_plan": [],
                    "reports": [],
                    "profile_check": {"id": "external-orchestrator-interop", "result": "block"},
                    "core_profile": {"id": "orchestration-core", "external_orchestrator_enforcement": "not_applicable", "result": "pass"},
                    "external_orchestrator": {
                        **empty_external_orchestrator_conformance(),
                        "status": "missing-target",
                        "result": "block",
                    },
                }
            )
        return emit(external_orchestrator_conformance_payload(Path(args.target).expanduser().resolve()))

    repo_root = Path(os.environ.get("LOOM_SOURCE_REPO_ROOT", Path.cwd())).expanduser().resolve()
    runtime_state = runtime_state_payload(repo_root)
    if not args.prior_evidence:
        return emit(
            {
                "command": "live-smoke",
                "operation": "replay",
                "schema_version": LIVE_SMOKE_SCHEMA,
                "result": "block",
                "summary": "live smoke replay requires --prior-evidence.",
                "missing_inputs": ["pass --prior-evidence <versioned_evidence_path>"],
                "fallback_to": LIVE_SMOKE_REPLAY_FALLBACK,
                "runtime_state": runtime_state,
                "command_plan": [],
                "reports": [],
                "live_smoke": {
                    "status": "failed",
                    "executed_at": current_iso_timestamp(),
                    "release_interpretation": live_smoke_release_interpretation("failed"),
                },
            }
        )
    return emit(live_smoke_replay_payload(Path(args.prior_evidence).expanduser().resolve(), runtime_state=runtime_state))


def handle_runtime_parity(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    return emit(
        runtime_parity_payload(
            target_root=target_root,
            output_relative=args.output,
            expected_item=args.item,
        )
    )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    if args.command == "fact-chain":
        return handle_fact_chain(args)
    if args.command == "runtime-state":
        return handle_runtime_state(args)
    if args.command == "adopt":
        return handle_adopt(args)
    if args.command == "carrier":
        return handle_carrier(args)
    if args.command == "host-binding":
        return handle_host_binding(args)
    if args.command == "pr-gate":
        return handle_pr_gate(args)
    if args.command == "controlled-merge":
        return handle_controlled_merge(args)
    if args.command == "runtime-evidence":
        return handle_runtime_evidence(args)
    if args.command == "state-check":
        return handle_state_check(args)
    if args.command == "review":
        return handle_review(args)
    if args.command == "recovery":
        return handle_recovery(args)
    if args.command == "work-item":
        return handle_work_item(args)
    if args.command == "host-lifecycle":
        return handle_host_lifecycle(args)
    if args.command == "closeout":
        return handle_closeout(args)
    if args.command == "reconciliation":
        return handle_reconciliation(args)
    if args.command == "shadow-parity":
        return handle_shadow_parity(args)
    if args.command == "live-smoke":
        return handle_live_smoke(args)
    if args.command == "runtime-parity":
        return handle_runtime_parity(args)
    if args.command == "governance-profile":
        return handle_governance_profile(args)
    if args.command == "flow":
        return handle_flow(args)
    if args.command == "checkpoint":
        return handle_checkpoint(args)
    if args.command == "workspace":
        return handle_workspace(args)
    return handle_purity(args)


if __name__ == "__main__":
    raise SystemExit(main())
