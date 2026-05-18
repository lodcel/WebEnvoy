#!/usr/bin/env python3
"""Shared governance-surface detection for Loom bootstrap, route, and resume."""

from __future__ import annotations

import json
import re
import subprocess
from copy import deepcopy
from pathlib import Path
from typing import Any
from urllib.parse import quote


CARRIER_KEYS = (
    "work_item",
    "recovery",
    "review",
    "status_surface",
    "spec_path",
    "plan_path",
)

PLANNED_LOCATORS = {
    "work_item": ".loom/work-items/INIT-0001.md",
    "recovery": ".loom/progress/INIT-0001.md",
    "review": ".loom/reviews/INIT-0001.json",
    "status_surface": ".loom/status/current.md",
    "spec_path": ".loom/specs/INIT-0001/spec.md",
    "plan_path": ".loom/specs/INIT-0001/plan.md",
}

REPO_INTERFACE_SURFACES = ("review", "merge_ready", "closeout")
REPO_INTERFACE_AVAILABILITY = {"absent", "companion_docs_only", "incomplete", "present"}
REPO_INTERFACE_MANIFEST_SCHEMA = "loom-repo-companion-manifest/v1"
WORKSPACE_PROFILE_CONTRACTS = {
    "single-workspace": {
        "summary": "Use the repository root as the Loom execution workspace.",
        "host_worktree_required": False,
        "recommended_action": "keep workspace_entry as `.` unless isolation becomes necessary",
    },
    "per-item-worktree": {
        "summary": "Use one isolated workspace per Work Item, usually backed by host git worktree.",
        "host_worktree_required": True,
        "recommended_action": "ensure workspace, branch, Work Item, and PR bindings stay aligned",
    },
    "attach-existing": {
        "summary": "Attach Loom to an existing repo-defined workspace without taking over host lifecycle actions.",
        "host_worktree_required": False,
        "recommended_action": "declare the repo-specific workspace locator and keep host lifecycle ownership external",
    },
}
LOCAL_WORKER_BACKEND_CONTRACT = {
    "schema_version": "loom-worker-backend/v1",
    "backend": "local",
    "ownership": "host-adapter",
    "execution_boundary": {
        "run": "read/event surface only; Loom does not start a daemon",
        "stop": "read/event surface only; Loom does not own worker termination",
    },
    "daemon": False,
    "future_backend_rule": "future backends may change invocation mechanics but must preserve Work Item, workspace, recovery, and ledger truth boundaries",
}
GATE_STARTER_ALIASES = {
    "verify": {
        "surface": "verification",
        "entrypoint": ".loom/bin/loom_init.py",
        "command": "python3 .loom/bin/loom_init.py verify --target .",
        "authority": "local",
        "enforcement": "advisory",
        "host_enforcement": False,
        "summary": "Run the repo-local Loom bootstrap verification entry.",
    },
    "status": {
        "surface": "status",
        "entrypoint": ".loom/bin/loom_status.py",
        "command": "python3 .loom/bin/loom_status.py --target . --item <current-item>",
        "authority": "local",
        "enforcement": "advisory",
        "host_enforcement": False,
        "summary": "Read the repo-local Loom status surface.",
    },
    "merge-ready": {
        "surface": "merge_ready",
        "entrypoint": ".loom/bin/loom_flow.py",
        "command": "python3 .loom/bin/loom_flow.py flow merge-ready --target . --item <current-item>",
        "authority": "local",
        "enforcement": "advisory",
        "host_enforcement": False,
        "summary": "Run Loom's local merge-ready orchestration without taking over host merge controls.",
    },
    "closeout-check": {
        "surface": "closeout",
        "entrypoint": ".loom/bin/loom_flow.py",
        "command": "python3 .loom/bin/loom_flow.py closeout check --target .",
        "authority": "local",
        "enforcement": "advisory",
        "host_enforcement": False,
        "summary": "Check closeout readiness against local Loom carriers and readable host inputs.",
    },
    "reconciliation-audit": {
        "surface": "reconciliation",
        "entrypoint": ".loom/bin/loom_flow.py",
        "command": "python3 .loom/bin/loom_flow.py reconciliation audit --target .",
        "authority": "local",
        "enforcement": "advisory",
        "host_enforcement": False,
        "summary": "Audit closeout drift without mutating host state.",
    },
}
LOOM_EXECUTION_BUDGET_SCHEMA = "loom-execution-budget/v1"
LOOM_EXECUTION_BUDGET_ENFORCEMENT = "advisory"
LOOM_EXECUTION_BUDGET_STATUS = {"present", "not_applicable", "unavailable"}
LOOM_EXECUTION_BUDGET_DIMENSION_IDS = {"turns", "tokens", "requests", "retries", "time_window"}
LOOM_EXECUTION_BUDGET_DIMENSION_FIELDS = ("id", "unit", "used", "limit", "remaining", "risk", "source")
LOOM_EXECUTION_BUDGET_RISK_SCHEMA = "loom-execution-budget-risk/v1"
LOOM_EXECUTION_BUDGET_RISK_LEVELS = {"none", "low", "medium", "high", "unknown"}
LOOM_EXECUTION_BUDGET_RISK_RANK = {
    "unknown": -1,
    "none": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
}


def normalize_execution_budget_dimensions(raw_dimensions: object) -> list[dict[str, Any]]:
    if not isinstance(raw_dimensions, list):
        return []
    dimensions: list[dict[str, Any]] = []
    for candidate in raw_dimensions:
        if not isinstance(candidate, dict):
            continue
        budget_id = candidate.get("id")
        if not isinstance(budget_id, str) or budget_id not in LOOM_EXECUTION_BUDGET_DIMENSION_IDS:
            continue
        dimension: dict[str, Any] = {"id": budget_id}
        for field in LOOM_EXECUTION_BUDGET_DIMENSION_FIELDS:
            if field == "id":
                continue
            if field in candidate:
                dimension[field] = candidate[field]
        dimensions.append(dimension)
    return dimensions


def execution_budget_payload(
    *,
    status: str,
    summary: str,
    dimensions: list[dict[str, Any]] | None = None,
    provenance: dict[str, Any] | None = None,
    adapter_evidence_locator: str | None = None,
    enforcement: str = LOOM_EXECUTION_BUDGET_ENFORCEMENT,
) -> dict[str, Any]:
    normalized_status = status if status in LOOM_EXECUTION_BUDGET_STATUS else "not_applicable"
    normalized_dimensions = normalize_execution_budget_dimensions(dimensions or [])
    if normalized_status != "present":
        normalized_dimensions = []
    return {
        "schema_version": LOOM_EXECUTION_BUDGET_SCHEMA,
        "status": normalized_status,
        "enforcement": enforcement,
        "summary": str(summary).strip() or f"execution budget status is {normalized_status}",
        "dimensions": normalized_dimensions,
        "provenance": provenance or {"source": "github_host"},
        "adapter_evidence_locator": str(adapter_evidence_locator) if adapter_evidence_locator else "",
    }


def normalize_execution_budget_payload(
    raw: object,
    *,
    fallback_status: str = "not_applicable",
    fallback_summary: str = "execution budget is not currently available",
    fallback_locator: str = "",
    fallback_provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return execution_budget_payload(
            status=fallback_status,
            summary=fallback_summary,
            dimensions=[],
            provenance=fallback_provenance or {"source": "github_host"},
            adapter_evidence_locator=fallback_locator,
        )

    status = raw.get("status")
    if not isinstance(status, str):
        status = fallback_status
    summary = raw.get("summary")
    dimensions = normalize_execution_budget_dimensions(raw.get("dimensions"))
    provenance = raw.get("provenance")
    adapter_evidence_locator = raw.get("adapter_evidence_locator")

    return execution_budget_payload(
        status=status,
        summary=summary if isinstance(summary, str) else fallback_summary,
        dimensions=dimensions,
        provenance=provenance if isinstance(provenance, dict) else fallback_provenance or {"source": "github_host"},
        adapter_evidence_locator=str(adapter_evidence_locator) if isinstance(adapter_evidence_locator, str) else fallback_locator,
        enforcement=(
            raw.get("enforcement")
            if isinstance(raw.get("enforcement"), str) and raw.get("enforcement") == LOOM_EXECUTION_BUDGET_ENFORCEMENT
            else LOOM_EXECUTION_BUDGET_ENFORCEMENT
        ),
    )


def normalize_execution_budget_risk_level(raw_risk: object) -> str:
    if isinstance(raw_risk, str):
        normalized = raw_risk.strip().lower()
        if normalized in LOOM_EXECUTION_BUDGET_RISK_LEVELS:
            return normalized
    return "unknown"


def derive_execution_budget_risk(raw_budget: object) -> dict[str, Any]:
    budget = normalize_execution_budget_payload(raw_budget)
    status = budget.get("status")
    enforcement = budget.get("enforcement")
    dimensions = budget.get("dimensions") if isinstance(budget.get("dimensions"), list) else []

    highest_risk = "none"
    risk_dimensions: list[str] = []
    for dimension in dimensions:
        if not isinstance(dimension, dict):
            continue
        risk_level = normalize_execution_budget_risk_level(dimension.get("risk"))
        if risk_level not in {"low", "medium", "high"}:
            continue
        dimension_id = dimension.get("id")
        if isinstance(dimension_id, str):
            risk_dimensions.append(dimension_id)
        if LOOM_EXECUTION_BUDGET_RISK_RANK[risk_level] > LOOM_EXECUTION_BUDGET_RISK_RANK[highest_risk]:
            highest_risk = risk_level

    risk_dimensions = list(dict.fromkeys(risk_dimensions))
    if status != "present":
        highest_risk = "none"
        risk_dimensions = []
        summary = f"execution budget is {status}; budget risk remains advisory and non-blocking"
    elif not risk_dimensions:
        summary = "execution budget is present with no declared elevated risk dimensions; budget risk remains advisory"
    else:
        dimension_summary = ", ".join(risk_dimensions)
        summary = (
            f"execution budget reports {highest_risk} advisory risk across {dimension_summary}; "
            "review and merge-ready may consume it as evidence only"
        )

    return {
        "schema_version": LOOM_EXECUTION_BUDGET_RISK_SCHEMA,
        "status": status,
        "enforcement": enforcement,
        "highest_risk": highest_risk,
        "risk_dimensions": risk_dimensions,
        "summary": summary,
        "budget_summary": budget.get("summary"),
        "adapter_evidence_locator": budget.get("adapter_evidence_locator"),
        "provenance": budget.get("provenance") if isinstance(budget.get("provenance"), dict) else {"source": "github_host"},
    }


def local_worker_backend_contract() -> dict[str, object]:
    return deepcopy(LOCAL_WORKER_BACKEND_CONTRACT)


def workspace_lifecycle_expectations(workspace_profile: dict[str, object] | None) -> dict[str, object]:
    profile = workspace_profile if isinstance(workspace_profile, dict) else {}
    workspace_entry = profile.get("workspace_entry")
    workspace_path = profile.get("workspace_path")
    missing_inputs: list[str] = []
    if not isinstance(workspace_entry, str) or not workspace_entry:
        missing_inputs.append("workspace_entry")
    if not isinstance(workspace_path, str) or not workspace_path:
        missing_inputs.append("workspace_path")

    return {
        "schema_version": "loom-workspace-lifecycle/v1",
        "result": "pass" if not missing_inputs else "block",
        "missing_inputs": missing_inputs,
        "workspace": {
            "entry": workspace_entry or None,
            "path": workspace_path or None,
            "profile": profile.get("selected") or "unknown",
            "exists": bool(profile.get("workspace_exists")),
        },
        "operations": {
            "create": {
                "semantics": "establish or confirm the workspace_entry execution workspace",
                "creates_host_worktree": False,
            },
            "locate": {
                "semantics": "resolve workspace_entry, recovery_entry, checkpoint, and purity without mutation",
                "writes_truth": False,
            },
            "attach": {
                "semantics": "locate and bind an existing repo-defined workspace",
                "creates_workspace": False,
                "deletes_workspace": False,
                "takes_host_lifecycle": False,
            },
            "handoff": {
                "semantics": "consume the same workspace/recovery contract and preserve recovery authored fields",
                "requires_recovery_entry": True,
            },
            "cleanup": {
                "semantics": "remove only explicit Loom-owned temporary residue",
                "deletes_non_loom_owned": False,
            },
            "retire": {
                "semantics": "write Current Checkpoint to retired while preserving the recovery entry",
                "deletes_workspace_directory": False,
            },
            "execution_boundary": {
                "run": "read/event surface only",
                "stop": "read/event surface only",
            },
            "remove": {
                "in_core": False,
                "fallback_to": "workspace cleanup/retire plus host-owned directory or git worktree lifecycle",
            },
        },
        "worker_backend": local_worker_backend_contract(),
    }
GITHUB_STABLE_CHECK_NAMES = ("py-compile", "demo-bootstrap", "repo-local-cli", "loom-check")
_GITHUB_API_CACHE: dict[tuple[str, ...], Any] = {}
REPO_INTERFACE_V1_SCHEMA = "loom-repo-interface/v1"
REPO_INTERFACE_V2_SCHEMA = "loom-repo-interface/v2"
REPO_INTERFACE_SCHEMAS = {REPO_INTERFACE_V1_SCHEMA, REPO_INTERFACE_V2_SCHEMA}
REPO_INTERFACE_ENFORCEMENT = {"blocking", "advisory"}
REPO_INTERFACE_REVIEW_INSTRUCTION_MODES = {"repo_declared", "loom_default"}
REPO_INTERFACE_REVIEW_INSTRUCTION_KEYS = {"spec_review", "implementation_review"}
REPO_INTERFACE_GATE_TYPES = {
    "admission",
    "pre_review",
    "review",
    "build",
    "merge_ready",
    "closeout",
}
REPO_INTERFACE_CONTEXT_TYPES = {"string", "integer", "number", "boolean"}
REPO_INTERFACE_MANIFEST_KEYS = {"schema_version", "companion_entry", "repo_interface"}
REPO_INTERFACE_V1_KEYS = {"schema_version", "companion_entry", "repo_specific_requirements", "specialized_gates"}
REPO_INTERFACE_V2_KEYS = REPO_INTERFACE_V1_KEYS | {
    "review_instruction_locators",
    "metadata_contract",
    "context_schema",
    "dynamic_tool_locators",
    "policy_locators",
    "hook_locators",
    "release_targets",
}
DECLARED_LOCATOR_REQUIREMENTS = {"required", "optional", "advisory"}
DECLARED_LOCATOR_OWNERS = {"repo", "repo-companion", "host", "host-adapter", "platform", "external-tool"}
DYNAMIC_TOOL_HANDSHAKE_SCHEMA = "loom-dynamic-tool-handshake/v1"
DYNAMIC_TOOL_HANDSHAKE_STATUSES = {"advertised", "unavailable", "unsupported", "failed"}
DYNAMIC_TOOL_HANDSHAKE_FAILURE_CATEGORIES = {
    "none",
    "unavailable",
    "unsupported",
    "failed",
    "invalid_declaration",
}
DYNAMIC_TOOL_SURFACES = REPO_INTERFACE_GATE_TYPES | {"attempt_time"}
HOOK_LOCATOR_LIFECYCLES = {"before-run", "after-run", "cleanup"}
HOOK_LOCATOR_FALLBACKS = {
    "admission",
    "pre_review",
    "review",
    "build",
    "merge_ready",
    "closeout",
    "manual_repair",
    "workspace cleanup|retire",
    "handoff",
    "merge",
}
HOOK_SAFETY_PATH_CONTAINMENT = {"repo_relative"}
HOOK_SAFETY_TRUTH_BOUNDARIES = {"runtime_evidence_only", "context_only", "blocking_decision_only"}
HOOK_SAFETY_CLEANUP_SCOPES = {"not_applicable", "loom_owned_only"}
HOOK_SAFETY_HOST_TRUST = {"trusted", "requires_review", "untrusted"}
HOOK_SAFETY_PERMISSION_RISKS = {"none", "approval_required", "sandbox_required", "unknown"}
HOOK_EXTENSION_PROFILE_SCHEMA = "loom-hooks-extension-profile/v1"
POLICY_READ_SCHEMA = "loom-policy-read/v1"
POLICY_READINESS_SCHEMA = "loom-policy-readiness/v1"
POLICY_TYPES = {"approval", "sandbox"}
POLICY_READ_STATUSES = {"declared", "missing", "conflict", "unsafe"}
POLICY_RISK_LEVELS = {"none", "unknown", "conflict", "unsafe"}
RELEASE_TARGET_SCHEMA = "loom-target-release/v1"
RELEASE_TARGET_STATUS_SCHEMA = "loom-target-release-status/v1"
RELEASE_TARGET_ENFORCEMENT = {"blocking", "advisory"}
RELEASE_TARGET_STATUSES = {
    "planning",
    "active",
    "merge_ready",
    "unreleased",
    "released",
    "reconciled",
    "closed_out",
}
RELEASE_TARGET_SCOPE_KEYS = ("phase", "fr", "work_item", "implementation_pr", "merge_commit")
RELEASE_TARGET_DELIVERY_STATUSES = {
    "planned",
    "active",
    "unmerged",
    "merged",
    "unreleased",
    "released",
    "unreconciled",
    "closed_out",
    "not_applicable",
}
REPO_INTEROP_AVAILABILITY = {"absent", "incomplete", "present"}
REPO_INTEROP_SCHEMA = "loom-repo-interop/v1"
REPO_INTEROP_KEYS = {"schema_version", "host_adapters", "repo_native_carriers", "shadow_surfaces", "external_orchestrators"}
REPO_INTEROP_COLLECTION_SURFACES = {
    "admission",
    "pre_review",
    "review",
    "build",
    "merge_ready",
    "closeout",
}
EXTERNAL_ORCHESTRATOR_OPERATIONS = {
    "work_item_read",
    "workspace_attach",
    "recovery_writeback",
    "status_read",
    "gate_read",
}
REPO_INTEROP_SHADOW_SURFACES = ("admission", "review", "merge_ready", "closeout")
GOVERNANCE_CONTROL_VERSION = "loom-governance-control/v1"
HOST_BINDING_OBJECTS = (
    "phase",
    "fr",
    "work_item",
    "branch",
    "worktree",
    "implementation_pr",
    "merge_commit",
    "closeout",
)
WORK_ITEM_ENFORCEMENT_FALLBACKS = {
    "roadmap": "phase",
    "phase": "fr",
    "fr": "work_item",
    "implementation_pr": "work_item",
    "merge_commit": "closeout",
}
GATE_FAILURE_TAXONOMY = {
    "spec_stale": "Approved spec no longer covers the implementation surface.",
    "review_stale": "Implementation review no longer covers the current head or scope.",
    "head_drift": "The head SHA changed after an approval gate was recorded.",
    "host_signal_drift": "GitHub issue, PR, project, branch, or check state no longer agrees with Loom's local carriers.",
    "gate_failure": "A required predecessor gate is missing, blocking, or unreadable.",
    "closeout_reconciliation_drift": "Merged work and issue/project closeout state are not yet aligned.",
}
GATE_CHAIN = (
    {
        "id": "work_item_admission",
        "requires": [],
        "fallback_to": "admission",
    },
    {
        "id": "spec_gate",
        "requires": ["work_item_admission", "formal_spec_or_not_applicable", "spec_review_approved"],
        "fallback_to": "admission",
    },
    {
        "id": "build_gate",
        "requires": ["work_item_admission", "spec_gate", "head_sha", "validation_summary", "approved_scope"],
        "fallback_to": "build",
    },
    {
        "id": "review_gate",
        "requires": ["build_gate", "head_sha", "validation_summary", "single_review_record"],
        "fallback_to": "review",
    },
    {
        "id": "merge_gate",
        "requires": ["review_gate", "head_binding", "validation_summary", "no_stale_or_drift"],
        "fallback_to": "merge",
    },
    {
        "id": "github_controlled_merge",
        "requires": ["merge_gate", "required_checks", "branch_protection", "merge_policy"],
        "fallback_to": "merge",
    },
    {
        "id": "closeout",
        "requires": ["github_controlled_merge", "merge_commit", "target_main", "reconciliation_audit"],
        "fallback_to": "reconciliation-sync",
    },
)
MATURITY_LEVELS = {
    "light": {
        "requires": ["work_item", "recovery", "status_surface", "review"],
        "summary": "Minimal Work Item -> review -> merge-ready governance is available.",
    },
    "standard": {
        "requires": [
            "light",
            "fr_work_item_layer",
            "spec_path",
            "plan_path",
            "spec_gate",
            "status_control_plane",
            "basic_host_binding",
            "closeout_reconciliation_read",
        ],
        "summary": "Formal spec, spec gate, status control plane, basic host binding, and closeout/reconciliation reads are available.",
    },
    "strong": {
        "requires": [
            "standard",
            "repo_interface",
            "repo_interop",
            "host_enforced_control_plane",
            "pr_merge_path",
            "controlled_merge_basis",
            "closeout_basis",
            "github_controlled_merge",
        ],
        "summary": "Host-backed binding, reconciliation, controlled merge, and closeout gates are available.",
    },
}
MATURITY_REQUIRED_FIELDS = {
    "light": [
        {
            "id": "work_item",
            "layer": "core",
            "required": True,
            "defaulting": "generated",
            "recommended_action": "run loom-init or restore the Work Item carrier",
        },
        {
            "id": "recovery",
            "layer": "core",
            "required": True,
            "defaulting": "generated",
            "recommended_action": "restore the recovery carrier",
        },
        {
            "id": "status_surface",
            "layer": "core",
            "required": True,
            "defaulting": "generated",
            "recommended_action": "restore the status surface carrier",
        },
        {
            "id": "review",
            "layer": "core",
            "required": True,
            "defaulting": "generated",
            "recommended_action": "restore the review carrier",
        },
    ],
    "standard": [
        {
            "id": "fr_work_item_layer",
            "layer": "github-profile",
            "required": True,
            "defaulting": "profile",
            "recommended_action": "declare the FR -> Work Item split through the GitHub profile upgrade path",
        },
        {
            "id": "spec_path",
            "layer": "core",
            "required": True,
            "defaulting": "generated",
            "recommended_action": "install formal spec scaffold",
        },
        {
            "id": "plan_path",
            "layer": "core",
            "required": True,
            "defaulting": "generated",
            "recommended_action": "install execution plan scaffold",
        },
        {
            "id": "spec_gate",
            "layer": "core",
            "required": True,
            "defaulting": "generated",
            "recommended_action": "record or restore the spec review gate",
        },
        {
            "id": "status_control_plane",
            "layer": "core",
            "required": True,
            "defaulting": "builtin",
            "recommended_action": "run loom_status or loom_check to rebuild the status control plane",
        },
        {
            "id": "basic_host_binding",
            "layer": "github-profile",
            "required": True,
            "defaulting": "profile",
            "recommended_action": "run governance-profile binding and repair missing host bindings",
        },
        {
            "id": "closeout_reconciliation_read",
            "layer": "github-profile",
            "required": True,
            "defaulting": "profile",
            "recommended_action": "install repo interop so closeout can consume reconciliation",
        },
    ],
    "strong": [
        {
            "id": "repo_interface",
            "layer": "repo-owned-residue",
            "required": True,
            "defaulting": "scaffold",
            "recommended_action": "install or repair the repo companion interface",
        },
        {
            "id": "repo_interop",
            "layer": "repo-owned-residue",
            "required": True,
            "defaulting": "scaffold",
            "recommended_action": "install or repair the repo interop contract",
        },
        {
            "id": "github_controlled_merge",
            "layer": "github-profile",
            "required": True,
            "defaulting": "host",
            "recommended_action": "enable controlled merge binding and required host gates",
        },
        {
            "id": "host_enforced_control_plane",
            "layer": "github-profile",
            "required": True,
            "defaulting": "host",
            "recommended_action": "verify branch protection or ruleset enforcement plus required checks before claiming strong governance",
        },
        {
            "id": "pr_merge_path",
            "layer": "github-profile",
            "required": True,
            "defaulting": "host",
            "recommended_action": "prove the PR merge path is host-owned and readable before strong governance",
        },
        {
            "id": "controlled_merge_basis",
            "layer": "github-profile",
            "required": True,
            "defaulting": "host",
            "recommended_action": "prove controlled merge depends on verified host checks instead of local aliases",
        },
        {
            "id": "closeout_basis",
            "layer": "github-profile",
            "required": True,
            "defaulting": "host",
            "recommended_action": "prove closeout consumes merge commit and reconciliation basis before strong governance",
        },
    ],
}
ADOPTION_GATE_ROLLOUT_MODES = {
    "advisory": {
        "summary": "Default mode for newly adopted repositories; Loom reports gate signals without becoming the blocking authority.",
        "blocking": False,
    },
    "blocking": {
        "summary": "Explicit opt-in mode for strong governance repositories after adversarial adoption checks pass.",
        "blocking": True,
    },
    "rollback": {
        "summary": "Emergency switch back to advisory consumption when runtime, evidence, or host bindings drift.",
        "blocking": False,
    },
}


def adoption_gate_rollout_status(*, maturity_current: str) -> dict[str, Any]:
    blocking_preconditions = [
        {
            "id": "strong_maturity",
            "status": "pass" if maturity_current == "strong" else "missing",
            "layer": "github-profile",
            "recommended_action": "upgrade the repository to strong maturity before enabling blocking gates",
        },
        {
            "id": "adversarial_adoption_checks",
            "status": "missing",
            "layer": "core",
            "recommended_action": "run the Loom-owned strong-governance adversarial adoption fixture and record the validation evidence",
        },
        {
            "id": "rollback_switch",
            "status": "pass",
            "layer": "core",
            "recommended_action": "keep rollback available by switching gate mode back to advisory and rerunning governance-profile status",
        },
    ]
    blocking_allowed = all(entry["status"] == "pass" for entry in blocking_preconditions)
    return {
        "schema_version": "loom-adoption-gate-rollout/v1",
        "default_mode": "advisory",
        "current_mode": "advisory",
        "recommended_mode": "blocking" if blocking_allowed else "advisory",
        "allowed_modes": ADOPTION_GATE_ROLLOUT_MODES,
        "blocking_allowed": blocking_allowed,
        "blocking_preconditions": blocking_preconditions,
        "rollback": {
            "mode": "rollback",
            "switch_to": "advisory",
            "recommended_action": "disable blocking consumption, preserve evidence, repair drift, then rerun adversarial adoption checks before re-enabling blocking",
        },
    }


def run_process(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(args, cwd=cwd, check=False, capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(args=args, returncode=124, stdout="", stderr="command timed out after 15s")


def file_exists(root: Path, relative: str) -> bool:
    return (root / relative).exists()


def relative_locator(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except (OSError, ValueError):
        return ""


def safe_read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def command_prefix(root: Path, tool_name: str) -> str:
    loom_tool = root / ".loom/bin" / tool_name
    if loom_tool.exists():
        return f"python3 .loom/bin/{tool_name}"
    return "unknown"


def git_remote_origin(root: Path) -> str | None:
    result = run_process(["git", "remote", "get-url", "origin"], root)
    if result.returncode != 0:
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


def gh_json_value(
    root: Path,
    args: list[str],
    *,
    read_mode: str = "cached_non_merge",
) -> tuple[Any | None, list[str]]:
    cache_key = tuple(args)
    if read_mode == "cached_non_merge" and cache_key in _GITHUB_API_CACHE:
        return deepcopy(_GITHUB_API_CACHE[cache_key]), []
    result = run_process(["gh", *args], root)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "gh command failed"
        return None, [detail]
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return None, [f"invalid JSON from gh {' '.join(args)}: {exc.msg}"]
    if read_mode == "cached_non_merge":
        _GITHUB_API_CACHE[cache_key] = deepcopy(payload)
    return payload, []


def gh_json(root: Path, args: list[str]) -> tuple[dict[str, Any] | None, list[str]]:
    payload, errors = gh_json_value(root, args)
    if errors:
        return None, errors
    if not isinstance(payload, dict):
        return None, [f"gh {' '.join(args)} did not return a JSON object"]
    return payload, []


def gh_json_list(root: Path, args: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
    payload, errors = gh_json_value(root, args)
    if errors:
        return [], errors
    if not isinstance(payload, list):
        return [], [f"gh {' '.join(args)} did not return a JSON list"]
    return [entry for entry in payload if isinstance(entry, dict)], []


def gh_rest_json(root: Path, path: str) -> tuple[dict[str, Any] | None, list[str]]:
    return gh_json(root, ["api", path])


def detect_loom_state(root: Path) -> str:
    active_requirements = (
        root / ".loom/bootstrap/init-result.json",
        root / ".loom/work-items",
        root / ".loom/progress",
        root / ".loom/status/current.md",
    )
    if all(path.exists() for path in active_requirements):
        return "active"

    partial_markers = (
        root / ".loom",
        root / "AGENTS.md",
        root / ".github/PULL_REQUEST_TEMPLATE.md",
    )
    if any(path.exists() for path in partial_markers):
        return "partial"
    return "absent"


def detect_repository_mode(root: Path, loom_state: str, scenario_override: str | None = None) -> str:
    if scenario_override in {"new", "small-existing", "complex-existing"}:
        return scenario_override

    init_result = safe_read_json(root / ".loom/bootstrap/init-result.json")
    if isinstance(init_result, dict):
        run = init_result.get("run")
        if isinstance(run, dict):
            scenario_key = run.get("scenario_key")
            if scenario_key in {"new", "small-existing", "complex-existing"}:
                return str(scenario_key)

    code_dirs = ("src", "app", "lib", "cmd", "pkg", "services", "packages")
    boundary_files = (
        "README.md",
        "AGENTS.md",
        "WORKFLOW.md",
        "docs/WORKFLOW.md",
        "package.json",
        "pyproject.toml",
        "Cargo.toml",
        "go.mod",
        "Makefile",
        ".github/workflows",
    )
    baseline_count = sum(1 for entry in boundary_files if file_exists(root, entry))
    code_count = sum(1 for entry in code_dirs if file_exists(root, entry))

    meaningful_entries = 0
    for path in root.iterdir():
        if path.name in {".git", ".DS_Store"}:
            continue
        if path.name == ".loom" and loom_state != "absent":
            continue
        meaningful_entries += 1

    if loom_state == "absent" and meaningful_entries <= 2 and baseline_count <= 1 and code_count == 0:
        return "new"
    if baseline_count + code_count >= 4 or meaningful_entries >= 8:
        return "complex-existing"
    return "small-existing"


def carrier_entry(status: str, locator: str, source: str) -> dict[str, str]:
    return {"status": status, "locator": locator, "source": source}


def has_legacy_companion_docs(root: Path) -> bool:
    companion_dir = root / ".loom" / "companion"
    if not companion_dir.exists() or not companion_dir.is_dir():
        return False
    for path in companion_dir.iterdir():
        if path.name in {"manifest.json", "repo-interface.json"}:
            continue
        if path.suffix.lower() == ".md":
            return True
    return False


def relative_locator_from_value(root: Path, raw_locator: object) -> str | None:
    if not isinstance(raw_locator, str):
        return None
    locator = raw_locator.strip()
    if not locator:
        return None
    locator_path = Path(locator)
    if locator_path.is_absolute():
        return None
    if ".." in locator_path.parts:
        return None
    return str(locator_path)


def locator_boundary_error(raw_locator: object, *, label: str) -> str:
    if not isinstance(raw_locator, str) or not raw_locator.strip():
        return f"{label} must be a non-empty string"
    locator = raw_locator.strip()
    locator_path = Path(locator)
    if locator_path.is_absolute() or ".." in locator_path.parts:
        return f"{label} must stay within the repository root and must stay inside the repository: {locator}"
    return f"{label} must stay within the repository root and must stay inside the repository: {locator}"


def resolve_locator(root: Path, raw_locator: object) -> tuple[str | None, Path | None]:
    locator = relative_locator_from_value(root, raw_locator)
    if locator is None:
        return None, None
    target = (root / locator).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        return None, None
    return locator, target


def locator_status_entry(
    *,
    root: Path,
    raw_locator: object,
    source: str,
) -> tuple[dict[str, str], str | None]:
    locator, target = resolve_locator(root, raw_locator)
    if locator is None or target is None:
        return carrier_entry("missing", "unknown", source), locator_boundary_error(raw_locator, label=source)
    if not target.exists():
        return carrier_entry("missing", locator, source), f"{source} points to missing path `{locator}`"
    return carrier_entry("present", locator, source), None


def validate_repo_specific_requirement(
    *,
    root: Path,
    surface: str,
    entry: object,
    index: int,
) -> list[str]:
    prefix = f"repo_interface.{surface}[{index}]"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"]
    missing_inputs: list[str] = []
    for field in ("id", "summary", "locator", "enforcement"):
        value = entry.get(field)
        if not isinstance(value, str) or not value.strip():
            missing_inputs.append(f"{prefix} missing `{field}`")
    enforcement = entry.get("enforcement")
    if enforcement not in REPO_INTERFACE_ENFORCEMENT:
        missing_inputs.append(f"{prefix} enforcement must be `blocking` or `advisory`")
    locator, target = resolve_locator(root, entry.get("locator"))
    if locator is None or target is None:
        missing_inputs.append(locator_boundary_error(entry.get("locator"), label=f"{prefix} locator"))
    elif not target.exists():
        missing_inputs.append(f"{prefix} locator points to missing path `{locator}`")
    return missing_inputs


def validate_specialized_gate(
    *,
    root: Path,
    entry: object,
    index: int,
) -> list[str]:
    prefix = f"specialized_gates[{index}]"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"]
    missing_inputs: list[str] = []
    for field in ("id", "summary", "locator"):
        value = entry.get(field)
        if not isinstance(value, str) or not value.strip():
            missing_inputs.append(f"{prefix} missing `{field}`")
    locator, target = resolve_locator(root, entry.get("locator"))
    if locator is None or target is None:
        missing_inputs.append(locator_boundary_error(entry.get("locator"), label=f"{prefix} locator"))
    elif not target.exists():
        missing_inputs.append(f"{prefix} locator points to missing path `{locator}`")
    gate_type = entry.get("gate_type")
    if gate_type is not None and gate_type not in REPO_INTERFACE_GATE_TYPES:
        missing_inputs.append(
            f"{prefix} gate_type must be one of `admission`, `pre_review`, `review`, `build`, `merge_ready`, `closeout`"
        )
    return missing_inputs


def validate_review_instruction_locators(
    *,
    root: Path,
    entry: object,
) -> list[str]:
    prefix = "review_instruction_locators"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"]
    missing_inputs: list[str] = []
    extra = set(entry) - REPO_INTERFACE_REVIEW_INSTRUCTION_KEYS
    if extra:
        missing_inputs.append(f"{prefix} contains unsupported keys: {', '.join(sorted(extra))}")
    for key in sorted(REPO_INTERFACE_REVIEW_INSTRUCTION_KEYS):
        locator_entry = entry.get(key)
        if not isinstance(locator_entry, dict):
            missing_inputs.append(f"{prefix}.{key} must be an object")
            continue
        mode = locator_entry.get("mode")
        if mode not in REPO_INTERFACE_REVIEW_INSTRUCTION_MODES:
            missing_inputs.append(f"{prefix}.{key}.mode must be `repo_declared` or `loom_default`")
        locator = locator_entry.get("locator")
        if mode == "loom_default":
            if locator not in (None, "", "loom_default"):
                missing_inputs.append(f"{prefix}.{key}.locator must be omitted or `loom_default` when mode is `loom_default`")
            continue
        locator_value, target = resolve_locator(root, locator)
        if locator_value is None or target is None:
            missing_inputs.append(locator_boundary_error(locator, label=f"{prefix}.{key}.locator"))
        elif not target.exists():
            missing_inputs.append(f"{prefix}.{key}.locator points to missing path `{locator_value}`")
    return missing_inputs


def validate_metadata_contract(
    *,
    root: Path,
    entry: object,
) -> list[str]:
    prefix = "metadata_contract"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"]
    fields = entry.get("fields")
    if not isinstance(fields, list):
        return [f"{prefix} must include `fields` as a list"]
    missing_inputs: list[str] = []
    for index, field in enumerate(fields):
        field_prefix = f"{prefix}.fields[{index}]"
        if not isinstance(field, dict):
            missing_inputs.append(f"{field_prefix} must be an object")
            continue
        for required in ("id", "summary", "applicability_locator", "authority_locator", "enforcement"):
            value = field.get(required)
            if required == "enforcement":
                continue
            if not isinstance(value, str) or not value.strip():
                missing_inputs.append(f"{field_prefix} missing `{required}`")
        enforcement = field.get("enforcement")
        if enforcement not in REPO_INTERFACE_ENFORCEMENT:
            missing_inputs.append(f"{field_prefix} enforcement must be `blocking` or `advisory`")
        for locator_field in ("applicability_locator", "authority_locator"):
            locator, target = resolve_locator(root, field.get(locator_field))
            if locator is None or target is None:
                missing_inputs.append(locator_boundary_error(field.get(locator_field), label=f"{field_prefix} `{locator_field}`"))
            elif not target.exists():
                missing_inputs.append(f"{field_prefix} `{locator_field}` points to missing path `{locator}`")
    return missing_inputs


def validate_context_schema(
    *,
    root: Path,
    entry: object,
) -> list[str]:
    prefix = "context_schema"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"]
    fields = entry.get("fields")
    if not isinstance(fields, list):
        return [f"{prefix} must include `fields` as a list"]
    missing_inputs: list[str] = []
    for index, field in enumerate(fields):
        field_prefix = f"{prefix}.fields[{index}]"
        if not isinstance(field, dict):
            missing_inputs.append(f"{field_prefix} must be an object")
            continue
        for required in ("id", "summary", "type", "mapping_rule_locator"):
            value = field.get(required)
            if not isinstance(value, str) or not value.strip():
                missing_inputs.append(f"{field_prefix} missing `{required}`")
        field_type = field.get("type")
        if field_type not in REPO_INTERFACE_CONTEXT_TYPES:
            missing_inputs.append(f"{field_prefix} type must be one of `string`, `integer`, `number`, `boolean`")
        if not isinstance(field.get("required"), bool):
            missing_inputs.append(f"{field_prefix} `required` must be a boolean")
        locator, target = resolve_locator(root, field.get("mapping_rule_locator"))
        if locator is None or target is None:
            missing_inputs.append(locator_boundary_error(field.get("mapping_rule_locator"), label=f"{field_prefix} `mapping_rule_locator`"))
        elif not target.exists():
            missing_inputs.append(f"{field_prefix} `mapping_rule_locator` points to missing path `{locator}`")
    return missing_inputs


def locator_field_missing(value: object) -> bool:
    return not isinstance(value, str) or not value.strip()


def validate_dynamic_tool_locator(
    *,
    root: Path,
    entry: object,
    index: int,
) -> tuple[list[str], list[str]]:
    prefix = f"dynamic_tool_locators[{index}]"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"], []
    entry_id = entry.get("id")
    locator_label = f"{prefix} `{entry_id}` locator" if isinstance(entry_id, str) and entry_id.strip() else f"{prefix} locator"
    blocking: list[str] = []
    optional: list[str] = []
    for field in ("id", "summary", "owner", "requirement", "surface", "fallback_to"):
        value = entry.get(field)
        if not isinstance(value, str) or not value.strip():
            blocking.append(f"{prefix} missing `{field}`")
    owner = entry.get("owner")
    if owner not in DECLARED_LOCATOR_OWNERS:
        blocking.append(f"{prefix} owner must stay repo/host/platform-owned, not Loom core")
    requirement = entry.get("requirement")
    if requirement not in DECLARED_LOCATOR_REQUIREMENTS:
        blocking.append(f"{prefix} requirement must be `required`, `optional`, or `advisory`")
    surface = entry.get("surface")
    if surface not in DYNAMIC_TOOL_SURFACES:
        blocking.append(
            f"{prefix} surface must be one of `admission`, `pre_review`, `review`, `build`, `merge_ready`, `closeout`, `attempt_time`"
        )
    locator_value = entry.get("locator")
    locator, target = resolve_locator(root, locator_value)
    locator_error: str | None = None
    locator_error_is_optional = False
    if locator_field_missing(locator_value):
        locator_error = f"{locator_label} missing `locator`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    elif locator is None or target is None:
        locator_error = locator_boundary_error(locator_value, label=locator_label)
    elif not target.exists():
        locator_error = f"{prefix} locator points to missing path `{locator}`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    if locator_error:
        if locator_error_is_optional:
            optional.append(locator_error)
        else:
            blocking.append(locator_error)
    return blocking, optional


def validate_hook_locator(
    *,
    root: Path,
    entry: object,
    index: int,
) -> tuple[list[str], list[str]]:
    prefix = f"hook_locators[{index}]"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"], []
    entry_id = entry.get("id")
    locator_label = f"{prefix} `{entry_id}` locator" if isinstance(entry_id, str) and entry_id.strip() else f"{prefix} locator"
    blocking: list[str] = []
    optional: list[str] = []
    for field in ("id", "summary", "lifecycle", "owner", "requirement", "fallback_to"):
        value = entry.get(field)
        if not isinstance(value, str) or not value.strip():
            blocking.append(f"{prefix} missing `{field}`")
    lifecycle = entry.get("lifecycle")
    if lifecycle not in HOOK_LOCATOR_LIFECYCLES:
        blocking.append(f"{prefix} lifecycle must be `before-run`, `after-run`, or `cleanup`")
    owner = entry.get("owner")
    if owner not in DECLARED_LOCATOR_OWNERS:
        blocking.append(
            f"{prefix} owner must be one of `repo`, `repo-companion`, `host`, `host-adapter`, `platform`, `external-tool`"
        )
    requirement = entry.get("requirement")
    if requirement not in DECLARED_LOCATOR_REQUIREMENTS:
        blocking.append(f"{prefix} requirement must be `required`, `optional`, or `advisory`")
    fallback_to = entry.get("fallback_to")
    if fallback_to not in HOOK_LOCATOR_FALLBACKS:
        blocking.append(f"{prefix} fallback_to must point to a Loom surface or manual repair path")

    forbidden_fields = sorted(
        set(entry)
        & {
            "runtime_state",
            "execution_result",
            "authored_progress",
            "current_stop",
            "next_step",
            "blockers",
            "latest_validation_summary",
            "current_checkpoint",
            "current_lane",
            "recovery_boundary",
            "closing_condition",
            "review_verdict",
            "review_summary",
            "validation_status",
            "host_action_result",
            "closeout_basis",
        }
    )
    if forbidden_fields:
        blocking.append(f"{prefix} must not carry runtime or authored truth fields: {', '.join(forbidden_fields)}")

    safety = entry.get("safety")
    safety_errors: list[str] = []
    if not isinstance(safety, dict):
        safety_errors.append(f"{prefix} missing `safety` declaration")
    else:
        path_containment = safety.get("path_containment")
        truth_boundary = safety.get("truth_boundary")
        cleanup_scope = safety.get("cleanup_scope")
        host_trust = safety.get("host_trust")
        permission_risk = safety.get("permission_risk")
        if path_containment not in HOOK_SAFETY_PATH_CONTAINMENT:
            safety_errors.append(f"{prefix} safety.path_containment must be `repo_relative`")
        if truth_boundary not in HOOK_SAFETY_TRUTH_BOUNDARIES:
            safety_errors.append(
                f"{prefix} safety.truth_boundary must be `runtime_evidence_only`, `context_only`, or `blocking_decision_only`"
            )
        if cleanup_scope not in HOOK_SAFETY_CLEANUP_SCOPES:
            safety_errors.append(f"{prefix} safety.cleanup_scope must be `not_applicable` or `loom_owned_only`")
        if lifecycle == "cleanup" and cleanup_scope != "loom_owned_only":
            safety_errors.append(f"{prefix} cleanup hooks must declare safety.cleanup_scope `loom_owned_only`")
        if lifecycle != "cleanup" and cleanup_scope == "loom_owned_only":
            safety_errors.append(f"{prefix} non-cleanup hooks must declare safety.cleanup_scope `not_applicable`")
        if host_trust not in HOOK_SAFETY_HOST_TRUST:
            safety_errors.append(f"{prefix} safety.host_trust must be `trusted`, `requires_review`, or `untrusted`")
        elif host_trust == "untrusted":
            safety_errors.append(f"{prefix} untrusted hook declarations are unsafe and must fail closed")
        if permission_risk not in HOOK_SAFETY_PERMISSION_RISKS:
            safety_errors.append(
                f"{prefix} safety.permission_risk must be `none`, `approval_required`, `sandbox_required`, or `unknown`"
            )
        elif permission_risk == "unknown":
            safety_errors.append(f"{prefix} unknown hook permission risk is unsafe and must fail closed")
    if safety_errors:
        if requirement in {"optional", "advisory"}:
            optional.extend(safety_errors)
        else:
            blocking.extend(safety_errors)

    locator_value = entry.get("locator")
    locator, target = resolve_locator(root, locator_value)
    locator_error: str | None = None
    locator_error_is_optional = False
    if locator_field_missing(locator_value):
        locator_error = f"{locator_label} missing `locator`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    elif locator is None or target is None:
        locator_error = locator_boundary_error(locator_value, label=locator_label)
    elif not target.exists():
        locator_error = f"{prefix} locator points to missing path `{locator}`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    if locator_error:
        if locator_error_is_optional:
            optional.append(locator_error)
        else:
            blocking.append(locator_error)
    return blocking, optional


def empty_hook_extension_profile() -> dict[str, Any]:
    return {
        "schema_version": HOOK_EXTENSION_PROFILE_SCHEMA,
        "profile_id": "orchestration-extension/hooks",
        "enabled": False,
        "result": "pass",
        "status": "not_applicable",
        "summary": "hooks extension profile is not enabled for this repository.",
        "missing_inputs": [],
        "missing_optional": [],
        "checks": [],
    }


def hook_extension_profile_payload(root: Path, hook_locators: object) -> dict[str, Any]:
    payload = empty_hook_extension_profile()
    if hook_locators is None:
        return payload
    payload.update(
        {
            "enabled": True,
            "status": "present",
            "summary": "hooks extension profile is enabled and hook declarations are readable.",
        }
    )
    if not isinstance(hook_locators, list):
        return {
            **payload,
            "result": "block",
            "status": "invalid_declaration",
            "summary": "hooks extension profile is enabled but hook_locators is not a list.",
            "missing_inputs": ["hook_locators must be a list"],
            "checks": [],
        }

    checks: list[dict[str, Any]] = []
    missing_inputs: list[str] = []
    missing_optional: list[str] = []
    for index, entry in enumerate(hook_locators):
        blocking, optional = validate_hook_locator(root=root, entry=entry, index=index)
        if isinstance(entry, dict):
            hook_id = entry.get("id") if isinstance(entry.get("id"), str) and entry.get("id") else f"hook-{index}"
            lifecycle = entry.get("lifecycle") if isinstance(entry.get("lifecycle"), str) else "unknown"
            requirement = entry.get("requirement") if isinstance(entry.get("requirement"), str) else "required"
            locator = entry.get("locator") if isinstance(entry.get("locator"), str) else ""
            fallback_to = entry.get("fallback_to") if isinstance(entry.get("fallback_to"), str) else "manual_repair"
        else:
            hook_id = f"invalid-{index}"
            lifecycle = "unknown"
            requirement = "required"
            locator = ""
            fallback_to = "manual_repair"
        result = "block" if blocking else "warn" if optional else "pass"
        checks.append(
            {
                "id": hook_id,
                "lifecycle": lifecycle,
                "requirement": requirement,
                "locator": locator,
                "result": result,
                "summary": "hook declaration is safe for extension consumption."
                if result == "pass"
                else "hook declaration has profile-local warnings."
                if result == "warn"
                else "hook declaration is unsafe for the configured hooks extension path.",
                "missing_inputs": blocking,
                "missing_optional": optional,
                "fallback_to": fallback_to if result == "block" else None,
            }
        )
        missing_inputs.extend(message for message in blocking if message not in missing_inputs)
        missing_optional.extend(message for message in optional if message not in missing_optional)

    result = "block" if missing_inputs else "warn" if missing_optional else "pass"
    summary = "hooks extension profile is enabled and hook declarations are safe."
    if result == "warn":
        summary = "hooks extension profile is enabled with profile-local advisory gaps."
    if result == "block":
        summary = "hooks extension profile is enabled and unsafe hook declarations block the configured path."
    return {
        **payload,
        "result": result,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "missing_optional": missing_optional,
        "checks": checks,
    }


def validate_policy_locator(
    *,
    root: Path,
    entry: object,
    index: int,
) -> tuple[list[str], list[str]]:
    blocking: list[str] = []
    optional: list[str] = []
    prefix = f"policy_locators[{index}]"
    locator_label = f"{prefix} locator"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"], optional
    policy_type = entry.get("policy")
    if policy_type not in POLICY_TYPES:
        blocking.append(f"{prefix} policy must be `approval` or `sandbox`")
    if not isinstance(entry.get("id"), str) or not entry.get("id"):
        blocking.append(f"{prefix} must include non-empty `id`")
    if not isinstance(entry.get("summary"), str) or not entry.get("summary"):
        blocking.append(f"{prefix} must include non-empty `summary`")
    owner = entry.get("owner")
    if owner not in DECLARED_LOCATOR_OWNERS:
        blocking.append(
            f"{prefix} owner must be one of `repo`, `repo-companion`, `host`, `host-adapter`, `platform`, `external-tool`"
        )
    requirement = entry.get("requirement", "required")
    if requirement not in DECLARED_LOCATOR_REQUIREMENTS:
        blocking.append(f"{prefix} requirement must be `required`, `optional`, or `advisory`")
    surface = entry.get("surface")
    if surface not in DYNAMIC_TOOL_SURFACES:
        blocking.append(
            f"{prefix} surface must be one of `admission`, `pre_review`, `review`, `build`, `merge_ready`, `closeout`, `attempt_time`"
        )
    locator_value = entry.get("locator")
    locator, target = resolve_locator(root, locator_value)
    locator_error: str | None = None
    locator_error_is_optional = False
    if locator_field_missing(locator_value):
        locator_error = f"{locator_label} missing `locator`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    elif locator is None or target is None:
        locator_error = locator_boundary_error(locator_value, label=locator_label)
    elif not target.exists():
        locator_error = f"{prefix} locator points to missing path `{locator}`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    if locator_error:
        if locator_error_is_optional:
            optional.append(locator_error)
        else:
            blocking.append(locator_error)
    return blocking, optional


def empty_tool_availability() -> dict[str, Any]:
    return {
        "schema_version": DYNAMIC_TOOL_HANDSHAKE_SCHEMA,
        "result": "pass",
        "summary": "no dynamic tools are declared for this repository.",
        "declared_tools": [],
        "failure_summary": {
            "required_blocking": [],
            "optional_advisory": [],
            "by_status": {status: 0 for status in sorted(DYNAMIC_TOOL_HANDSHAKE_STATUSES)},
        },
        "missing_inputs": [],
        "fallback_to": None,
    }


def empty_policy_readiness() -> dict[str, Any]:
    return {
        "schema_version": POLICY_READINESS_SCHEMA,
        "result": "pass",
        "summary": "no approval or sandbox policy read surfaces are declared for this repository.",
        "declared_policies": [],
        "approval_policy": None,
        "sandbox_policy": None,
        "risk_summary": {
            "blocking": [],
            "advisory": [],
            "by_status": {status: 0 for status in sorted(POLICY_READ_STATUSES)},
            "by_policy": {policy: "missing" for policy in sorted(POLICY_TYPES)},
        },
        "missing_inputs": [],
        "fallback_to": None,
    }


def empty_target_release_status(summary: str = "no target repository release/version surface is declared for this repository.") -> dict[str, Any]:
    return {
        "schema_version": RELEASE_TARGET_STATUS_SCHEMA,
        "result": "not_applicable",
        "summary": summary,
        "release_id": None,
        "display_name": None,
        "target_branch": None,
        "release_goal": None,
        "authored_status": None,
        "included_scope": {key: [] for key in RELEASE_TARGET_SCOPE_KEYS},
        "delivery_chain": {
            "merged": [],
            "unmerged": [],
            "unreleased": [],
            "unreconciled": [],
        },
        "release_evidence": {
            "changelog": {"status": "not_applicable", "locator": None},
            "release_notes": {"status": "not_applicable", "locator": None},
            "migration_notes": {"status": "not_applicable", "locator": None},
            "tag_or_artifact": {"status": "not_applicable", "locator": None},
            "rollback_basis": {"status": "not_applicable", "locator": None},
        },
        "closeout_gaps": [],
        "rollback_readiness": {"status": "not_applicable", "locator": None},
        "provenance": {
            "source_layer": "repo_companion",
            "source_locator": None,
            "status_locator": None,
            "enforcement": None,
        },
        "missing_inputs": [],
        "fallback_to": None,
    }


def validate_release_targets(
    *,
    root: Path,
    entry: object,
) -> list[str]:
    prefix = "release_targets"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"]
    missing_inputs: list[str] = []
    for field in ("catalog_locator", "current_target_locator"):
        locator, target = resolve_locator(root, entry.get(field))
        if locator is None or target is None:
            missing_inputs.append(locator_boundary_error(entry.get(field), label=f"{prefix}.{field}"))
        elif not target.exists():
            missing_inputs.append(f"{prefix}.{field} points to missing path `{locator}`")
    enforcement = entry.get("enforcement")
    if enforcement not in REPO_INTERFACE_ENFORCEMENT:
        missing_inputs.append(f"{prefix}.enforcement must be `blocking` or `advisory`")
    status_locator = entry.get("status_locator")
    if status_locator not in (None, "", "not_applicable"):
        locator, target = resolve_locator(root, status_locator)
        if locator is None or target is None:
            missing_inputs.append(locator_boundary_error(status_locator, label=f"{prefix}.status_locator"))
        elif not target.exists():
            missing_inputs.append(f"{prefix}.status_locator points to missing path `{locator}`")
    return missing_inputs


def normalize_release_scope_entries(entries: object) -> list[dict[str, Any]]:
    if not isinstance(entries, list):
        return []
    normalized: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        scope_id = entry.get("id")
        locator = entry.get("locator")
        delivery_status = entry.get("delivery_status")
        normalized.append(
            {
                "id": scope_id if isinstance(scope_id, str) and scope_id else None,
                "locator": locator if isinstance(locator, str) and locator else None,
                "delivery_status": (
                    delivery_status
                    if isinstance(delivery_status, str) and delivery_status in RELEASE_TARGET_DELIVERY_STATUSES
                    else "planned"
                ),
            }
        )
    return normalized


def release_evidence_entry(root: Path, locator_value: object) -> dict[str, Any]:
    if locator_value in (None, "", "not_applicable"):
        return {"status": "not_applicable", "locator": None if locator_value in (None, "") else "not_applicable"}
    locator, target = resolve_locator(root, locator_value)
    if locator is None or target is None:
        return {"status": "invalid", "locator": locator_value}
    if not target.exists():
        return {"status": "missing", "locator": locator}
    return {"status": "present", "locator": locator}


def target_release_status_from_entry(root: Path, release_targets: object) -> dict[str, Any]:
    payload = empty_target_release_status()
    if not isinstance(release_targets, dict):
        payload.update(
            {
                "result": "block",
                "summary": "target repository release/version declaration is unreadable.",
                "missing_inputs": ["release_targets must be an object"],
                "fallback_to": "closeout",
            }
        )
        return payload

    enforcement = release_targets.get("enforcement") if release_targets.get("enforcement") in RELEASE_TARGET_ENFORCEMENT else None
    payload["provenance"]["enforcement"] = enforcement

    current_locator, current_target = resolve_locator(root, release_targets.get("current_target_locator"))
    status_locator, status_target = resolve_locator(root, release_targets.get("status_locator"))
    payload["provenance"]["source_locator"] = current_locator
    payload["provenance"]["status_locator"] = status_locator

    missing_inputs: list[str] = []
    closeout_gaps: list[str] = []

    if current_locator is None or current_target is None or not current_target.exists():
        missing_inputs.append("release_targets.current_target_locator")
        payload.update(
            {
                "result": "block" if enforcement == "blocking" else "not_applicable",
                "summary": "current target release locator is missing or unreadable.",
                "missing_inputs": missing_inputs,
                "fallback_to": "closeout" if enforcement == "blocking" else None,
            }
        )
        return payload

    release_payload = safe_read_json(current_target)
    if release_payload is None:
        missing_inputs.append(f"{current_locator} is unreadable")
    elif release_payload.get("schema_version") != RELEASE_TARGET_SCHEMA:
        missing_inputs.append(f"{current_locator} schema_version must be `{RELEASE_TARGET_SCHEMA}`")
    else:
        payload["release_id"] = release_payload.get("release_id")
        payload["display_name"] = release_payload.get("display_name")
        payload["target_branch"] = release_payload.get("target_branch")
        payload["release_goal"] = release_payload.get("release_goal")
        payload["authored_status"] = release_payload.get("status")

        for field in ("release_id", "display_name", "target_branch", "release_goal"):
            if not isinstance(release_payload.get(field), str) or not str(release_payload.get(field)).strip():
                missing_inputs.append(f"{current_locator} missing `{field}`")
        status_value = release_payload.get("status")
        if not isinstance(status_value, str) or status_value not in RELEASE_TARGET_STATUSES:
            missing_inputs.append(f"{current_locator} status must stay within the stable contract")

        included_scope = release_payload.get("included_scope")
        if not isinstance(included_scope, dict):
            missing_inputs.append(f"{current_locator} missing `included_scope`")
        else:
            normalized_scope = {key: normalize_release_scope_entries(included_scope.get(key)) for key in RELEASE_TARGET_SCOPE_KEYS}
            payload["included_scope"] = normalized_scope
            merged: list[dict[str, Any]] = []
            unmerged: list[dict[str, Any]] = []
            unreleased: list[dict[str, Any]] = []
            unreconciled: list[dict[str, Any]] = []
            for scope_key, entries in normalized_scope.items():
                for entry in entries:
                    item = {"scope": scope_key, **entry}
                    delivery_status = entry.get("delivery_status")
                    if delivery_status in {"merged", "unreleased", "released", "unreconciled", "closed_out"}:
                        merged.append(item)
                    if delivery_status in {"planned", "active", "unmerged"}:
                        unmerged.append(item)
                    if delivery_status == "unreleased":
                        unreleased.append(item)
                    if delivery_status == "unreconciled":
                        unreconciled.append(item)
            payload["delivery_chain"] = {
                "merged": merged,
                "unmerged": unmerged,
                "unreleased": unreleased,
                "unreconciled": unreconciled,
            }

        evidence = release_payload.get("evidence")
        if not isinstance(evidence, dict):
            missing_inputs.append(f"{current_locator} missing `evidence`")
        else:
            release_evidence = {
                "changelog": release_evidence_entry(root, evidence.get("changelog_locator")),
                "release_notes": release_evidence_entry(root, evidence.get("release_notes_locator")),
                "migration_notes": release_evidence_entry(root, evidence.get("migration_notes_locator")),
                "tag_or_artifact": release_evidence_entry(root, evidence.get("tag_or_artifact_locator")),
                "rollback_basis": release_evidence_entry(root, evidence.get("rollback_basis_locator")),
            }
            payload["release_evidence"] = release_evidence
            for evidence_key, evidence_entry in release_evidence.items():
                if evidence_entry.get("status") in {"missing", "invalid"}:
                    closeout_gaps.append(f"{evidence_key} evidence is {evidence_entry.get('status')}")
            rollback_entry = release_evidence["rollback_basis"]
            payload["rollback_readiness"] = {
                "status": "ready" if rollback_entry.get("status") == "present" else rollback_entry.get("status"),
                "locator": rollback_entry.get("locator"),
            }

        authority = release_payload.get("authority")
        if not isinstance(authority, dict):
            missing_inputs.append(f"{current_locator} missing `authority`")
        else:
            for field in ("owner", "source_kind", "source_locator"):
                if not isinstance(authority.get(field), str) or not str(authority.get(field)).strip():
                    missing_inputs.append(f"{current_locator} authority missing `{field}`")

    if status_locator is not None and status_target is not None and status_target.exists():
        status_payload = safe_read_json(status_target)
        if status_payload is None:
            closeout_gaps.append("repo-owned release status locator is unreadable")
        elif status_payload.get("schema_version") != RELEASE_TARGET_STATUS_SCHEMA:
            closeout_gaps.append(f"{status_locator} schema_version must be `{RELEASE_TARGET_STATUS_SCHEMA}`")

    payload["closeout_gaps"] = closeout_gaps
    blocking = bool(missing_inputs) or (enforcement == "blocking" and bool(closeout_gaps))
    payload["missing_inputs"] = missing_inputs
    payload["result"] = "block" if blocking else "pass"
    payload["summary"] = (
        "target repository release/version surface is readable."
        if payload["result"] == "pass"
        else "target repository release/version surface is present but incomplete or missing required closeout evidence."
    )
    payload["fallback_to"] = "closeout" if payload["result"] == "block" else None
    return payload


def empty_release_targets_surface() -> dict[str, Any]:
    return {
        "availability": "absent",
        "catalog": carrier_entry("missing", "unknown", "repo companion interface.release_targets"),
        "current_target": carrier_entry("missing", "unknown", "repo companion interface.release_targets"),
        "status": carrier_entry("missing", "unknown", "repo companion interface.release_targets"),
        "enforcement": "unknown",
        "summary": "no target repository release/version surface is declared for this repository.",
        "missing_inputs": [],
        "target_release": empty_target_release_status(),
    }


def read_tool_handshake_declaration(path: Path) -> tuple[dict[str, Any] | None, list[str]]:
    if path.suffix.lower() != ".json":
        return None, []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return None, [f"tool handshake declaration is unreadable: {exc}"]
    if not isinstance(payload, dict):
        return None, ["tool handshake declaration must be a JSON object"]
    if payload.get("schema_version") != DYNAMIC_TOOL_HANDSHAKE_SCHEMA:
        return None, [f"tool handshake declaration schema must be `{DYNAMIC_TOOL_HANDSHAKE_SCHEMA}`"]
    status = payload.get("status")
    if status not in DYNAMIC_TOOL_HANDSHAKE_STATUSES:
        return None, [
            "tool handshake status must be one of `advertised`, `unavailable`, `unsupported`, `failed`"
        ]
    failure_category = payload.get("failure_category", "none")
    if failure_category not in DYNAMIC_TOOL_HANDSHAKE_FAILURE_CATEGORIES:
        return None, ["tool handshake failure_category is outside the stable vocabulary"]
    return payload, []


def read_policy_declaration(path: Path) -> tuple[dict[str, Any] | None, list[str]]:
    if path.suffix.lower() != ".json":
        return None, []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return None, [f"policy declaration is unreadable: {exc}"]
    if not isinstance(payload, dict):
        return None, ["policy declaration must be a JSON object"]
    if payload.get("schema_version") != POLICY_READ_SCHEMA:
        return None, [f"policy declaration schema must be `{POLICY_READ_SCHEMA}`"]
    policy_type = payload.get("policy")
    if policy_type not in POLICY_TYPES:
        return None, ["policy declaration policy must be `approval` or `sandbox`"]
    status = payload.get("status")
    if status not in POLICY_READ_STATUSES:
        return None, ["policy declaration status must be one of `declared`, `missing`, `conflict`, `unsafe`"]
    risk = payload.get("risk", "none")
    if risk not in POLICY_RISK_LEVELS:
        return None, ["policy declaration risk is outside the stable vocabulary"]
    return payload, []


def dynamic_tool_status_entry(
    *,
    root: Path,
    entry: object,
    index: int,
) -> dict[str, Any]:
    prefix = f"dynamic_tool_locators[{index}]"
    if not isinstance(entry, dict):
        return {
            "id": f"invalid-{index}",
            "surface": "unknown",
            "requirement": "required",
            "owner": "unknown",
            "status": "failed",
            "result": "block",
            "failure_category": "invalid_declaration",
            "summary": f"{prefix} must be an object",
            "evidence": {"status": "missing", "locator": None},
            "missing_inputs": [f"{prefix} must be an object"],
            "fallback_to": "admission",
        }

    tool_id = str(entry.get("id") or f"tool-{index}")
    requirement = str(entry.get("requirement") or "required")
    surface = str(entry.get("surface") or "attempt_time")
    fallback_to = entry.get("fallback_to") if isinstance(entry.get("fallback_to"), str) else "admission"
    locator_value = entry.get("locator")
    locator, target = resolve_locator(root, locator_value)
    missing_inputs: list[str] = []
    evidence: dict[str, Any] = {
        "status": "missing",
        "locator": locator if isinstance(locator, str) else locator_value,
    }
    status = "advertised"
    failure_category = "none"
    summary = "dynamic tool is declared and its availability locator is readable."

    if locator_field_missing(locator_value):
        status = "unavailable"
        failure_category = "unavailable"
        summary = "dynamic tool has no availability locator."
        missing_inputs.append(f"{prefix} `{tool_id}` locator missing `locator`")
    elif locator is None or target is None:
        status = "failed"
        failure_category = "invalid_declaration"
        summary = "dynamic tool availability locator is outside the repository boundary."
        missing_inputs.append(locator_boundary_error(locator_value, label=f"{prefix} `{tool_id}` locator"))
    elif not target.exists():
        status = "unavailable"
        failure_category = "unavailable"
        summary = "dynamic tool availability locator points to a missing path."
        missing_inputs.append(f"{prefix} locator points to missing path `{locator}`")
    else:
        evidence = {"status": "present", "locator": locator}
        declaration, declaration_errors = read_tool_handshake_declaration(target)
        if declaration_errors:
            status = "failed"
            failure_category = "invalid_declaration"
            summary = "dynamic tool availability declaration is unreadable or invalid."
            missing_inputs.extend(f"{prefix} `{tool_id}` {message}" for message in declaration_errors)
        elif declaration:
            status = str(declaration["status"])
            failure_category = str(declaration.get("failure_category", "none"))
            summary = str(declaration.get("summary") or f"dynamic tool handshake reported `{status}`.")
            fallback_value = declaration.get("fallback_to")
            if isinstance(fallback_value, str) and fallback_value:
                fallback_to = fallback_value
            evidence_payload = declaration.get("evidence")
            if isinstance(evidence_payload, dict):
                evidence = {**evidence, **evidence_payload, "locator": locator}
            if status != "advertised":
                missing_inputs.append(f"dynamic tool `{tool_id}` is {status}")

    blocking = requirement == "required" and status != "advertised"
    return {
        "id": tool_id,
        "summary": summary,
        "owner": entry.get("owner"),
        "requirement": requirement,
        "surface": surface,
        "locator": locator if isinstance(locator, str) else locator_value,
        "status": status,
        "result": "block" if blocking else "pass",
        "failure_category": failure_category,
        "evidence": evidence,
        "missing_inputs": missing_inputs if blocking else [],
        "advisory": missing_inputs if not blocking else [],
        "fallback_to": fallback_to if blocking else None,
    }


def policy_status_entry(
    *,
    root: Path,
    entry: object,
    index: int,
) -> dict[str, Any]:
    prefix = f"policy_locators[{index}]"
    if not isinstance(entry, dict):
        return {
            "id": f"invalid-{index}",
            "policy": "approval",
            "surface": "unknown",
            "requirement": "required",
            "owner": "unknown",
            "status": "unsafe",
            "result": "block",
            "risk": "unsafe",
            "summary": f"{prefix} must be an object",
            "evidence": {"status": "missing", "locator": None},
            "missing_inputs": [f"{prefix} must be an object"],
            "fallback_to": "admission",
        }

    policy_id = str(entry.get("id") or f"policy-{index}")
    policy_type = str(entry.get("policy") or "approval")
    requirement = str(entry.get("requirement") or "required")
    surface = str(entry.get("surface") or "attempt_time")
    fallback_to = entry.get("fallback_to") if isinstance(entry.get("fallback_to"), str) else "admission"
    locator_value = entry.get("locator")
    locator, target = resolve_locator(root, locator_value)
    missing_inputs: list[str] = []
    evidence: dict[str, Any] = {
        "status": "missing",
        "locator": locator if isinstance(locator, str) else locator_value,
    }
    status = "declared"
    risk = "none"
    summary = "policy read declaration is readable."

    if locator_field_missing(locator_value):
        status = "missing"
        risk = "unknown"
        summary = "policy read declaration has no locator."
        missing_inputs.append(f"{prefix} `{policy_id}` locator missing `locator`")
    elif locator is None or target is None:
        status = "unsafe"
        risk = "unsafe"
        summary = "policy read locator is outside the repository boundary."
        missing_inputs.append(locator_boundary_error(locator_value, label=f"{prefix} `{policy_id}` locator"))
    elif not target.exists():
        status = "missing"
        risk = "unknown"
        summary = "policy read locator points to a missing path."
        missing_inputs.append(f"{prefix} locator points to missing path `{locator}`")
    else:
        evidence = {"status": "present", "locator": locator}
        declaration, declaration_errors = read_policy_declaration(target)
        if declaration_errors:
            status = "unsafe"
            risk = "unsafe"
            summary = "policy declaration is unreadable or invalid."
            missing_inputs.extend(f"{prefix} `{policy_id}` {message}" for message in declaration_errors)
        elif declaration:
            status = str(declaration["status"])
            policy_type = str(declaration.get("policy") or policy_type)
            risk = str(declaration.get("risk", "none"))
            summary = str(declaration.get("summary") or f"{policy_type} policy read reported `{status}`.")
            fallback_value = declaration.get("fallback_to")
            if isinstance(fallback_value, str) and fallback_value:
                fallback_to = fallback_value
            evidence_payload = declaration.get("evidence")
            if isinstance(evidence_payload, dict):
                evidence = {**evidence, **evidence_payload, "locator": locator}
            if status != "declared":
                missing_inputs.append(f"{policy_type} policy `{policy_id}` is {status}")

    blocking = requirement == "required" and status in {"missing", "conflict", "unsafe"}
    return {
        "id": policy_id,
        "summary": summary,
        "owner": entry.get("owner"),
        "requirement": requirement,
        "surface": surface,
        "policy": policy_type,
        "locator": locator if isinstance(locator, str) else locator_value,
        "status": status,
        "result": "block" if blocking else "pass",
        "risk": risk,
        "evidence": evidence,
        "missing_inputs": missing_inputs if blocking else [],
        "advisory": missing_inputs if not blocking else [],
        "fallback_to": fallback_to if blocking else None,
    }


def dynamic_tool_availability_payload(root: Path, dynamic_tool_locators: object) -> dict[str, Any]:
    payload = empty_tool_availability()
    if dynamic_tool_locators is None:
        return payload
    if not isinstance(dynamic_tool_locators, list):
        return {
            **payload,
            "result": "block",
            "summary": "dynamic tool locators are declared but not readable as a list.",
            "missing_inputs": ["dynamic_tool_locators must be a list"],
            "fallback_to": "admission",
        }

    tools = [
        dynamic_tool_status_entry(root=root, entry=entry, index=index)
        for index, entry in enumerate(dynamic_tool_locators)
    ]
    by_status = {status: 0 for status in sorted(DYNAMIC_TOOL_HANDSHAKE_STATUSES)}
    required_blocking: list[dict[str, Any]] = []
    optional_advisory: list[dict[str, Any]] = []
    missing_inputs: list[str] = []
    fallback_to: str | None = None
    for tool in tools:
        status = tool.get("status")
        if isinstance(status, str) and status in by_status:
            by_status[status] += 1
        if tool.get("result") == "block":
            required_blocking.append(tool)
            fallback = tool.get("fallback_to")
            if fallback_to is None and isinstance(fallback, str) and fallback:
                fallback_to = fallback
            for message in tool.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(str(message))
        elif tool.get("status") != "advertised":
            optional_advisory.append(tool)

    result = "block" if required_blocking else "pass"
    if required_blocking:
        summary = "required dynamic tool handshake evidence is unavailable, unsupported, failed, or invalid."
    elif optional_advisory:
        summary = "only optional or advisory dynamic tool handshake failures are present."
    elif tools:
        summary = "dynamic tool declarations are readable and advertised."
    else:
        summary = payload["summary"]
    return {
        **payload,
        "result": result,
        "summary": summary,
        "declared_tools": tools,
        "failure_summary": {
            "required_blocking": required_blocking,
            "optional_advisory": optional_advisory,
            "by_status": by_status,
        },
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to if result == "block" else None,
    }


def policy_readiness_payload(root: Path, policy_locators: object) -> dict[str, Any]:
    payload = empty_policy_readiness()
    if policy_locators is None:
        return payload
    if not isinstance(policy_locators, list):
        return {
            **payload,
            "result": "block",
            "summary": "policy locators are declared but not readable as a list.",
            "missing_inputs": ["policy_locators must be a list"],
            "fallback_to": "admission",
        }

    policies = [
        policy_status_entry(root=root, entry=entry, index=index)
        for index, entry in enumerate(policy_locators)
    ]
    by_status = {status: 0 for status in sorted(POLICY_READ_STATUSES)}
    by_policy = {policy: "missing" for policy in sorted(POLICY_TYPES)}
    blocking: list[dict[str, Any]] = []
    advisory: list[dict[str, Any]] = []
    missing_inputs: list[str] = []
    fallback_to: str | None = None
    latest_by_policy: dict[str, dict[str, Any]] = {}
    for policy in policies:
        status = policy.get("status")
        if isinstance(status, str) and status in by_status:
            by_status[status] += 1
        policy_type = policy.get("policy")
        if isinstance(policy_type, str) and policy_type in by_policy:
            by_policy[policy_type] = str(status or "missing")
            latest_by_policy[policy_type] = policy
        if policy.get("result") == "block":
            blocking.append(policy)
            fallback = policy.get("fallback_to")
            if fallback_to is None and isinstance(fallback, str) and fallback:
                fallback_to = fallback
            for message in policy.get("missing_inputs", []):
                if message not in missing_inputs:
                    missing_inputs.append(str(message))
        elif policy.get("status") != "declared":
            advisory.append(policy)

    result = "block" if blocking else "pass"
    if blocking:
        summary = "required approval or sandbox policy evidence is missing, conflicting, or unsafe."
    elif advisory:
        summary = "only optional or advisory approval/sandbox policy risk is present."
    elif policies:
        summary = "approval and sandbox policy read declarations are readable."
    else:
        summary = payload["summary"]
    return {
        **payload,
        "result": result,
        "summary": summary,
        "declared_policies": policies,
        "approval_policy": latest_by_policy.get("approval"),
        "sandbox_policy": latest_by_policy.get("sandbox"),
        "risk_summary": {
            "blocking": blocking,
            "advisory": advisory,
            "by_status": by_status,
            "by_policy": by_policy,
        },
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to if result == "block" else None,
    }


def validate_repo_interop_collection_entry(
    *,
    root: Path,
    collection: str,
    entry: object,
    index: int,
) -> tuple[list[str], list[str]]:
    prefix = f"{collection}[{index}]"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"], []
    entry_id = entry.get("id")
    locator_label = f"{prefix} `{entry_id}` locator" if isinstance(entry_id, str) and entry_id.strip() else f"{prefix} locator"
    missing_inputs: list[str] = []
    missing_optional: list[str] = []
    for field in ("id", "summary", "owner", "requirement", "fallback_to"):
        value = entry.get(field)
        if not isinstance(value, str) or not value.strip():
            missing_inputs.append(f"{prefix} missing `{field}`")
    owner = entry.get("owner")
    if owner not in DECLARED_LOCATOR_OWNERS:
        missing_inputs.append(f"{prefix} owner must stay repo/host/platform-owned, not Loom core")
    requirement = entry.get("requirement")
    if requirement not in DECLARED_LOCATOR_REQUIREMENTS:
        missing_inputs.append(f"{prefix} requirement must be `required`, `optional`, or `advisory`")
    surfaces = entry.get("surfaces")
    if not isinstance(surfaces, list) or not surfaces:
        missing_inputs.append(f"{prefix} must include `surfaces` as a non-empty list")
    else:
        for surface_index, surface in enumerate(surfaces):
            if surface not in REPO_INTEROP_COLLECTION_SURFACES:
                missing_inputs.append(
                    f"{prefix}.surfaces[{surface_index}] must be one of `admission`, `pre_review`, `review`, `build`, `merge_ready`, `closeout`"
                )
    locator_value = entry.get("locator")
    locator, target = resolve_locator(root, locator_value)
    locator_error: str | None = None
    locator_error_is_optional = False
    if locator_field_missing(locator_value):
        locator_error = f"{locator_label} missing `locator`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    elif locator is None or target is None:
        locator_error = locator_boundary_error(locator_value, label=locator_label)
    elif not target.exists():
        locator_error = f"{prefix} locator points to missing path `{locator}`"
        locator_error_is_optional = requirement in {"optional", "advisory"}
    if locator_error:
        if locator_error_is_optional:
            missing_optional.append(locator_error)
        else:
            missing_inputs.append(locator_error)
    return missing_inputs, missing_optional


def validate_external_orchestrator_entry(
    *,
    root: Path,
    entry: object,
    index: int,
) -> tuple[list[str], list[str]]:
    missing_inputs, missing_optional = validate_repo_interop_collection_entry(
        root=root,
        collection="external_orchestrators",
        entry=entry,
        index=index,
    )
    if not isinstance(entry, dict):
        return missing_inputs, missing_optional
    prefix = f"external_orchestrators[{index}]"
    operations = entry.get("operations")
    if not isinstance(operations, list) or not operations:
        missing_inputs.append(f"{prefix} must include `operations` as a non-empty list")
    else:
        for operation_index, operation in enumerate(operations):
            if operation not in EXTERNAL_ORCHESTRATOR_OPERATIONS:
                missing_inputs.append(
                    f"{prefix}.operations[{operation_index}] must be one of `work_item_read`, `workspace_attach`, `recovery_writeback`, `status_read`, `gate_read`"
                )
    return missing_inputs, missing_optional


def validate_shadow_surface(
    *,
    root: Path,
    surface: str,
    entry: object,
) -> list[str]:
    prefix = f"shadow_surfaces.{surface}"
    if not isinstance(entry, dict):
        return [f"{prefix} must be an object"]
    missing_inputs: list[str] = []
    summary = entry.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        missing_inputs.append(f"{prefix} missing `summary`")
    for locator_field in ("loom_locator", "repo_locator"):
        locator, target = resolve_locator(root, entry.get(locator_field))
        if locator is None or target is None:
            missing_inputs.append(locator_boundary_error(entry.get(locator_field), label=f"{prefix} `{locator_field}`"))
        elif not target.exists():
            missing_inputs.append(f"{prefix} `{locator_field}` points to missing path `{locator}`")
    return missing_inputs


def detect_repo_interface(root: Path) -> tuple[dict[str, Any], list[str]]:
    companion_dir = root / ".loom" / "companion"
    manifest_path = companion_dir / "manifest.json"
    repo_interface_path = companion_dir / "repo-interface.json"

    repo_interface_surface: dict[str, Any] = {
        "availability": "absent",
        "manifest": carrier_entry("missing", ".loom/companion/manifest.json", "companion manifest"),
        "companion_entry": carrier_entry("missing", "unknown", "repo companion manifest"),
        "repo_specific_requirements": carrier_entry("missing", "unknown", "repo companion interface"),
        "specialized_gates": carrier_entry("missing", "unknown", "repo companion interface"),
        "dynamic_tool_locators": carrier_entry("missing", "unknown", "repo companion interface"),
        "policy_locators": carrier_entry("missing", "unknown", "repo companion interface"),
        "hook_locators": carrier_entry("missing", "unknown", "repo companion interface"),
        "release_targets": empty_release_targets_surface(),
        "tool_availability": empty_tool_availability(),
        "policy_readiness": empty_policy_readiness(),
        "hook_profile": empty_hook_extension_profile(),
        "summary": "no repo companion interface is declared for this repository.",
        "missing_inputs": [],
        "missing_optional": [],
    }
    missing_inputs: list[str] = []
    missing_optional: list[str] = []

    if not manifest_path.exists():
        if has_legacy_companion_docs(root):
            repo_interface_surface["availability"] = "companion_docs_only"
            repo_interface_surface["summary"] = (
                "legacy companion docs are present, but no machine-readable repo companion manifest is declared."
            )
        return repo_interface_surface, missing_inputs

    repo_interface_surface["manifest"] = carrier_entry(
        "present",
        ".loom/companion/manifest.json",
        "repository scan",
    )
    manifest = safe_read_json(manifest_path)
    if manifest is None:
        missing_inputs.append("repo companion manifest is unreadable")
        repo_interface_surface["availability"] = "incomplete"
        repo_interface_surface["summary"] = "repo companion manifest exists, but the machine-readable interface is incomplete."
        repo_interface_surface["missing_inputs"] = missing_inputs
        return repo_interface_surface, missing_inputs

    if manifest.get("schema_version") != REPO_INTERFACE_MANIFEST_SCHEMA:
        missing_inputs.append(
            f"repo companion manifest schema must be `{REPO_INTERFACE_MANIFEST_SCHEMA}`"
        )
    extra_manifest_keys = sorted(set(manifest.keys()) - REPO_INTERFACE_MANIFEST_KEYS)
    if extra_manifest_keys:
        missing_inputs.append(
            "repo companion manifest must stay locator-only: "
            + ", ".join(extra_manifest_keys)
        )

    companion_entry, companion_error = locator_status_entry(
        root=root,
        raw_locator=manifest.get("companion_entry"),
        source="repo companion manifest.companion_entry",
    )
    repo_interface_surface["companion_entry"] = companion_entry
    if companion_error:
        missing_inputs.append(companion_error)

    manifest_repo_interface, manifest_repo_interface_error = locator_status_entry(
        root=root,
        raw_locator=manifest.get("repo_interface"),
        source="repo companion manifest.repo_interface",
    )
    repo_interface_surface["repo_specific_requirements"] = manifest_repo_interface
    repo_interface_surface["specialized_gates"] = manifest_repo_interface.copy()
    repo_interface_surface["dynamic_tool_locators"] = manifest_repo_interface.copy()
    repo_interface_surface["policy_locators"] = manifest_repo_interface.copy()
    repo_interface_surface["release_targets"]["catalog"] = manifest_repo_interface.copy()
    repo_interface_surface["release_targets"]["current_target"] = manifest_repo_interface.copy()
    repo_interface_surface["release_targets"]["status"] = manifest_repo_interface.copy()
    if manifest_repo_interface_error:
        missing_inputs.append(manifest_repo_interface_error)

    repo_interface_locator, repo_interface_target = resolve_locator(root, manifest.get("repo_interface"))
    if repo_interface_surface["repo_specific_requirements"]["status"] != "present":
        if repo_interface_path.exists() and manifest_repo_interface_error:
            missing_inputs.append("repo companion manifest must point `repo_interface` to `.loom/companion/repo-interface.json`")
    else:
        interface_payload = safe_read_json(repo_interface_target or repo_interface_path)
        if interface_payload is None:
            missing_inputs.append("repo companion interface is unreadable")
        else:
            interface_schema = interface_payload.get("schema_version")
            if interface_schema not in REPO_INTERFACE_SCHEMAS:
                missing_inputs.append(
                    "repo companion interface schema must be `loom-repo-interface/v1` or `loom-repo-interface/v2`"
                )
            allowed_interface_keys = (
                REPO_INTERFACE_V2_KEYS if interface_schema == REPO_INTERFACE_V2_SCHEMA else REPO_INTERFACE_V1_KEYS
            )
            extra_interface_keys = sorted(set(interface_payload.keys()) - allowed_interface_keys)
            if extra_interface_keys:
                missing_inputs.append(
                    "repo companion interface contains unexpected top-level fields: "
                    + ", ".join(extra_interface_keys)
                )
            interface_companion_entry, interface_companion_error = locator_status_entry(
                root=root,
                raw_locator=interface_payload.get("companion_entry"),
                source="repo companion interface.companion_entry",
            )
            if interface_companion_entry["status"] == "present":
                repo_interface_surface["companion_entry"] = interface_companion_entry
            if interface_companion_error:
                missing_inputs.append(interface_companion_error)

            requirements = interface_payload.get("repo_specific_requirements")
            if not isinstance(requirements, dict):
                missing_inputs.append("repo companion interface must include `repo_specific_requirements`")
            else:
                for surface in REPO_INTERFACE_SURFACES:
                    entries = requirements.get(surface)
                    if not isinstance(entries, list):
                        missing_inputs.append(
                            f"repo companion interface surface `{surface}` must be a list"
                        )
                        continue
                    for index, entry in enumerate(entries):
                        missing_inputs.extend(
                            validate_repo_specific_requirement(
                                root=root,
                                surface=surface,
                                entry=entry,
                                index=index,
                            )
                        )

            specialized_gates = interface_payload.get("specialized_gates")
            if not isinstance(specialized_gates, list):
                missing_inputs.append("repo companion interface must include `specialized_gates` as a list")
            else:
                for index, entry in enumerate(specialized_gates):
                    missing_inputs.extend(
                        validate_specialized_gate(
                            root=root,
                            entry=entry,
                            index=index,
                        )
                    )

            if interface_schema == REPO_INTERFACE_V2_SCHEMA:
                review_instruction_locators = interface_payload.get("review_instruction_locators")
                if review_instruction_locators is not None:
                    missing_inputs.extend(
                        validate_review_instruction_locators(
                            root=root,
                            entry=review_instruction_locators,
                        )
                    )
                metadata_contract = interface_payload.get("metadata_contract")
                if metadata_contract is not None:
                    missing_inputs.extend(
                        validate_metadata_contract(
                            root=root,
                            entry=metadata_contract,
                        )
                    )
                context_schema = interface_payload.get("context_schema")
                if context_schema is not None:
                    missing_inputs.extend(
                        validate_context_schema(
                            root=root,
                            entry=context_schema,
                        )
                    )
                dynamic_tool_locators = interface_payload.get("dynamic_tool_locators")
                if dynamic_tool_locators is not None:
                    repo_interface_surface["tool_availability"] = dynamic_tool_availability_payload(
                        root,
                        dynamic_tool_locators,
                    )
                    if not isinstance(dynamic_tool_locators, list):
                        missing_inputs.append("dynamic_tool_locators must be a list")
                    else:
                        for index, entry in enumerate(dynamic_tool_locators):
                            blocking, optional = validate_dynamic_tool_locator(
                                root=root,
                                entry=entry,
                                index=index,
                            )
                            missing_inputs.extend(blocking)
                            missing_optional.extend(optional)
                policy_locators = interface_payload.get("policy_locators")
                if policy_locators is not None:
                    repo_interface_surface["policy_readiness"] = policy_readiness_payload(
                        root,
                        policy_locators,
                    )
                    if not isinstance(policy_locators, list):
                        missing_inputs.append("policy_locators must be a list")
                    else:
                        for index, entry in enumerate(policy_locators):
                            blocking, optional = validate_policy_locator(
                                root=root,
                                entry=entry,
                                index=index,
                            )
                            missing_inputs.extend(blocking)
                            missing_optional.extend(optional)
                hook_locators = interface_payload.get("hook_locators")
                if hook_locators is not None:
                    repo_interface_surface["hook_profile"] = hook_extension_profile_payload(
                        root,
                        hook_locators,
                    )
                    repo_interface_surface["hook_locators"] = carrier_entry(
                        "present",
                        ".loom/companion/repo-interface.json",
                        "repo companion interface",
                    )
                release_targets = interface_payload.get("release_targets")
                if release_targets is not None:
                    blocking_inputs = validate_release_targets(root=root, entry=release_targets)
                    missing_inputs.extend(blocking_inputs)
                    repo_interface_surface["release_targets"]["availability"] = "present"
                    if isinstance(release_targets, dict):
                        repo_interface_surface["release_targets"]["enforcement"] = (
                            release_targets.get("enforcement")
                            if release_targets.get("enforcement") in RELEASE_TARGET_ENFORCEMENT
                            else "unknown"
                        )
                        for source_key, target_key in (
                            ("catalog_locator", "catalog"),
                            ("current_target_locator", "current_target"),
                            ("status_locator", "status"),
                        ):
                            locator_value = release_targets.get(source_key)
                            if locator_value in (None, "", "not_applicable") and source_key == "status_locator":
                                repo_interface_surface["release_targets"]["status"] = carrier_entry(
                                    "missing",
                                    "not_applicable",
                                    f"repo companion interface.release_targets.{source_key}",
                                )
                                continue
                            repo_interface_surface["release_targets"][target_key], _ = locator_status_entry(
                                root=root,
                                raw_locator=locator_value,
                                source=f"repo companion interface.release_targets.{source_key}",
                            )
                    target_release_payload = target_release_status_from_entry(
                        root,
                        release_targets,
                    )
                    repo_interface_surface["release_targets"]["target_release"] = target_release_payload
                    if blocking_inputs or target_release_payload.get("result") == "block":
                        repo_interface_surface["release_targets"]["availability"] = "incomplete"
                    if target_release_payload.get("result") == "block":
                        missing_inputs.extend(
                            str(message)
                            for message in target_release_payload.get("missing_inputs", [])
                        )
                    repo_interface_surface["release_targets"]["summary"] = target_release_payload["summary"]
                    repo_interface_surface["release_targets"]["missing_inputs"] = list(
                        dict.fromkeys(
                            [
                                *blocking_inputs,
                                *target_release_payload.get("missing_inputs", []),
                            ]
                        )
                    )

    if missing_inputs:
        repo_interface_surface["availability"] = "incomplete"
        repo_interface_surface["summary"] = (
            "repo companion manifest exists, but the machine-readable interface is incomplete."
        )
    else:
        repo_interface_surface["availability"] = "present"
        repo_interface_surface["summary"] = (
            "repo companion interface is readable with optional tool locator advisories."
            if missing_optional
            else "repo companion manifest and machine-readable repo interface are readable."
        )
    repo_interface_surface["missing_inputs"] = list(dict.fromkeys(missing_inputs))
    repo_interface_surface["missing_optional"] = list(dict.fromkeys(missing_optional))
    return repo_interface_surface, list(dict.fromkeys(missing_inputs))


def detect_repo_interop(root: Path) -> tuple[dict[str, Any], list[str]]:
    interop_path = root / ".loom" / "companion" / "interop.json"
    repo_interop_surface: dict[str, Any] = {
        "availability": "absent",
        "contract": carrier_entry("missing", ".loom/companion/interop.json", "repository scan"),
        "host_adapters": carrier_entry("missing", "unknown", "repo interop contract"),
        "repo_native_carriers": carrier_entry("missing", "unknown", "repo interop contract"),
        "shadow_surfaces": carrier_entry("missing", "unknown", "repo interop contract"),
        "external_orchestrators": carrier_entry("missing", "unknown", "repo interop contract"),
        "summary": "no repo interop contract is declared for this repository.",
        "missing_inputs": [],
        "missing_optional": [],
    }
    missing_inputs: list[str] = []
    missing_optional: list[str] = []

    if not interop_path.exists():
        return repo_interop_surface, missing_inputs

    repo_interop_surface["contract"] = carrier_entry(
        "present",
        ".loom/companion/interop.json",
        "repository scan",
    )
    interop_payload = safe_read_json(interop_path)
    if interop_payload is None:
        missing_inputs.append("repo interop contract is unreadable")
    else:
        if interop_payload.get("schema_version") != REPO_INTEROP_SCHEMA:
            missing_inputs.append(f"repo interop contract schema must be `{REPO_INTEROP_SCHEMA}`")
        extra_keys = sorted(set(interop_payload.keys()) - REPO_INTEROP_KEYS)
        if extra_keys:
            missing_inputs.append(
                "repo interop contract contains unexpected top-level fields: "
                + ", ".join(extra_keys)
            )

        for key in ("host_adapters", "repo_native_carriers", "shadow_surfaces", "external_orchestrators"):
            repo_interop_surface[key] = carrier_entry(
                "present",
                ".loom/companion/interop.json",
                "repo interop contract",
            )

        host_adapters = interop_payload.get("host_adapters")
        if not isinstance(host_adapters, list):
            missing_inputs.append("repo interop contract must include `host_adapters` as a list")
        else:
            for index, entry in enumerate(host_adapters):
                blocking, optional = validate_repo_interop_collection_entry(
                    root=root,
                    collection="host_adapters",
                    entry=entry,
                    index=index,
                )
                missing_inputs.extend(blocking)
                missing_optional.extend(optional)

        repo_native_carriers = interop_payload.get("repo_native_carriers")
        if not isinstance(repo_native_carriers, list):
            missing_inputs.append("repo interop contract must include `repo_native_carriers` as a list")
        else:
            for index, entry in enumerate(repo_native_carriers):
                blocking, optional = validate_repo_interop_collection_entry(
                    root=root,
                    collection="repo_native_carriers",
                    entry=entry,
                    index=index,
                )
                missing_inputs.extend(blocking)
                missing_optional.extend(optional)

        external_orchestrators = interop_payload.get("external_orchestrators", [])
        if not isinstance(external_orchestrators, list):
            missing_inputs.append("repo interop contract must include `external_orchestrators` as a list")
        else:
            for index, entry in enumerate(external_orchestrators):
                blocking, optional = validate_external_orchestrator_entry(
                    root=root,
                    entry=entry,
                    index=index,
                )
                missing_inputs.extend(blocking)
                missing_optional.extend(optional)

        shadow_surfaces = interop_payload.get("shadow_surfaces")
        if not isinstance(shadow_surfaces, dict):
            missing_inputs.append("repo interop contract must include `shadow_surfaces` as an object")
        else:
            extra_shadow_surfaces = sorted(set(shadow_surfaces.keys()) - set(REPO_INTEROP_SHADOW_SURFACES))
            if extra_shadow_surfaces:
                missing_inputs.append(
                    "repo interop contract shadow_surfaces contains unexpected surfaces: "
                    + ", ".join(extra_shadow_surfaces)
                )
            for surface in REPO_INTEROP_SHADOW_SURFACES:
                if surface not in shadow_surfaces:
                    missing_inputs.append(f"repo interop contract shadow_surfaces missing `{surface}`")
                    continue
                missing_inputs.extend(
                    validate_shadow_surface(
                        root=root,
                        surface=surface,
                        entry=shadow_surfaces.get(surface),
                    )
                )

    if missing_inputs:
        repo_interop_surface["availability"] = "incomplete"
        repo_interop_surface["summary"] = "repo interop contract exists, but the machine-readable read surface is incomplete."
    else:
        repo_interop_surface["availability"] = "present"
        repo_interop_surface["summary"] = (
            "repo interop contract is readable with optional locator advisories."
            if missing_optional
            else "repo interop contract is readable for host adapters, repo-native carriers, shadow parity, and external orchestrator locators."
        )
    repo_interop_surface["missing_inputs"] = list(dict.fromkeys(missing_inputs))
    repo_interop_surface["missing_optional"] = list(dict.fromkeys(missing_optional))
    return repo_interop_surface, list(dict.fromkeys(missing_inputs))


def first_match(directory: Path, suffix: str, root: Path) -> str:
    for path in sorted(directory.glob(f"*{suffix}")):
        return relative_locator(path, root)
    return ""


def existing_locator(root: Path, relative: str | None) -> str:
    locator, target = resolve_locator(root, relative)
    if locator is None or target is None:
        return ""
    return locator if target.exists() else ""


def active_or_first(root: Path, relative: str | None, directory: Path, suffix: str) -> str:
    if relative is not None and str(relative).strip():
        return existing_locator(root, relative)
    return first_match(directory, suffix, root) if directory.exists() else ""


def current_review_locator(root: Path, review_dir: Path, item_id: str) -> str:
    review_path = review_dir / f"{item_id}.json"
    if review_path.exists():
        return relative_locator(review_path, root)
    if item_id:
        return ""
    return first_match(review_dir, ".json", root) if review_dir.exists() else ""


def active_entry_points(root: Path) -> dict[str, str]:
    init_result = root / ".loom/bootstrap/init-result.json"
    try:
        payload = json.loads(init_result.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, dict):
        return {}
    fact_chain = payload.get("fact_chain")
    if not isinstance(fact_chain, dict):
        return {}
    entry_points = fact_chain.get("entry_points")
    if not isinstance(entry_points, dict):
        return {}
    active: dict[str, str] = {}
    for key in ("current_item_id", "work_item", "recovery_entry", "status_surface"):
        value = entry_points.get(key)
        if isinstance(value, str) and value.strip():
            active[key] = value.strip()
    return active


def work_item_workspace_entry(root: Path) -> str:
    active = active_entry_points(root)
    locator = active.get("work_item")
    if not locator:
        return ""
    resolved_locator, work_item_path = resolve_locator(root, locator)
    if resolved_locator is None or work_item_path is None:
        return ""
    try:
        text = work_item_path.read_text(encoding="utf-8")
    except OSError:
        return ""
    match = re.search(r"^- Workspace Entry:\s*(.+?)\s*$", text, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def select_workspace_profile(workspace_entry: str, item_id: str) -> tuple[str, str]:
    if not workspace_entry:
        return "unknown", "workspace_entry is not readable"
    normalized = workspace_entry.strip().replace("\\", "/")
    if normalized == ".":
        return "single-workspace", "workspace_entry points at the repository root"
    if normalized.startswith(".worktrees/") or (item_id and item_id in normalized):
        return "per-item-worktree", "workspace_entry is item-scoped or under `.worktrees/`"
    return "attach-existing", "workspace_entry points at an existing repo-defined workspace"


def detect_workspace_profile(root: Path, *, host_binding: dict[str, Any]) -> dict[str, Any]:
    active = active_entry_points(root)
    item_id = active.get("current_item_id", "")
    workspace_entry = work_item_workspace_entry(root)
    selected, reason = select_workspace_profile(workspace_entry, item_id)
    locator, workspace_path = resolve_locator(root, workspace_entry)
    missing_inputs: list[str] = []
    if not workspace_entry:
        missing_inputs.append("missing_workspace_entry")
    elif locator is None or workspace_path is None:
        missing_inputs.append("workspace_escape")
    elif not workspace_path.exists():
        missing_inputs.append("workspace_missing")
    required_objects = host_binding.get("required_objects") if isinstance(host_binding, dict) else None
    worktree = required_objects.get("worktree") if isinstance(required_objects, dict) else None
    worktree_status = worktree.get("status") if isinstance(worktree, dict) else "unknown"
    return {
        "schema_version": "loom-workspace-profile/v1",
        "selected": selected,
        "selection_reason": reason,
        "profiles": WORKSPACE_PROFILE_CONTRACTS,
        "workspace_entry": workspace_entry or "unknown",
        "workspace_path": locator or "unknown",
        "workspace_exists": bool(workspace_path and workspace_path.exists()),
        "host_worktree": {
            "ownership": "host",
            "status": worktree_status,
            "locator": worktree.get("locator", "unknown") if isinstance(worktree, dict) else "unknown",
        },
        "result": "pass" if not missing_inputs else "block",
        "missing_inputs": missing_inputs,
        "recommended_action": (
            WORKSPACE_PROFILE_CONTRACTS[selected]["recommended_action"]
            if selected in WORKSPACE_PROFILE_CONTRACTS
            else "restore the Work Item workspace_entry before running workspace profile checks"
        ),
    }


def detect_gate_starter(root: Path) -> dict[str, Any]:
    active = active_entry_points(root)
    item_id = active.get("current_item_id", "INIT-0001")
    aliases: dict[str, dict[str, Any]] = {}
    missing_entrypoints: list[str] = []
    for alias, contract in GATE_STARTER_ALIASES.items():
        row = dict(contract)
        command = str(row["command"]).replace("<current-item>", item_id)
        row["command"] = command
        entrypoint = root / str(row["entrypoint"])
        row["runtime_present"] = entrypoint.exists()
        if not entrypoint.exists() and str(row["entrypoint"]) not in missing_entrypoints:
            missing_entrypoints.append(str(row["entrypoint"]))
        aliases[alias] = row
    runtime_status = "present" if not missing_entrypoints else "missing"
    return {
        "schema_version": "loom-gate-starter/v1",
        "aliases": aliases,
        "runtime_status": runtime_status,
        "authority": "local",
        "enforcement": "advisory",
        "host_enforcement": False,
        "host_enforcement_status": "not_host_enforced",
        "result": "pass",
        "missing_inputs": [],
        "missing_entrypoints": missing_entrypoints,
        "recommended_action": (
            "run the repo-local aliases as advisory Loom checks, then configure host-required checks separately"
            if not missing_entrypoints
            else "install or refresh repo-local Loom runtime entries before using gate starter aliases"
        ),
    }


def bootstrap_host_binding_branch(root: Path) -> str:
    init_result = root / ".loom/bootstrap/init-result.json"
    try:
        payload = json.loads(init_result.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ""
    if not isinstance(payload, dict):
        return ""
    governance_surface = payload.get("governance_surface")
    if not isinstance(governance_surface, dict):
        return ""
    control_plane = governance_surface.get("governance_control_plane")
    if not isinstance(control_plane, dict):
        return ""
    host_binding = control_plane.get("host_binding")
    if not isinstance(host_binding, dict):
        return ""
    required_objects = host_binding.get("required_objects")
    if not isinstance(required_objects, dict):
        return ""
    branch = required_objects.get("branch")
    if not isinstance(branch, dict):
        return ""
    locator = branch.get("locator")
    if isinstance(locator, str) and locator.strip() and locator != "unknown":
        return locator.strip()
    return ""


def detect_carrier_summary(root: Path, *, repository_mode: str, planning_mode: bool) -> dict[str, dict[str, str]]:
    active = active_entry_points(root)
    active_item_id = active.get("current_item_id") or "INIT-0001"
    item_dir = root / ".loom/work-items"
    recovery_dir = root / ".loom/progress"
    review_dir = root / ".loom/reviews"
    status_locator = active.get("status_surface") or ".loom/status/current.md"
    spec_path = root / f".loom/specs/{active_item_id}/spec.md"
    plan_path = root / f".loom/specs/{active_item_id}/plan.md"

    present_locators = {
        "work_item": active_or_first(root, active.get("work_item"), item_dir, ".md"),
        "recovery": active_or_first(root, active.get("recovery_entry"), recovery_dir, ".md"),
        "review": current_review_locator(root, review_dir, active_item_id),
        "status_surface": existing_locator(root, status_locator),
        "spec_path": relative_locator(spec_path, root) if spec_path.exists() else "",
        "plan_path": relative_locator(plan_path, root) if plan_path.exists() else "",
    }

    summary: dict[str, dict[str, str]] = {}
    for key in CARRIER_KEYS:
        locator = present_locators[key]
        if locator:
            summary[key] = carrier_entry("present", locator, "repository scan")
        elif planning_mode and repository_mode == "new":
            summary[key] = carrier_entry("planned", PLANNED_LOCATORS[key], "bootstrap plan")
        else:
            summary[key] = carrier_entry("missing", "unknown", "repository scan")
    return summary


def detect_execution_entry(root: Path, loom_state: str, *, bootstrap_mode: bool, active_item_id: str = "INIT-0001") -> str:
    if bootstrap_mode and loom_state == "partial":
        return "python3 .loom/bin/loom_init.py verify --target ."
    if bootstrap_mode:
        return f"python3 .loom/bin/loom_flow.py flow resume --target . --item {active_item_id}"
    if loom_state == "active":
        return f"{command_prefix(root, 'loom_flow.py')} flow resume --target . --item {active_item_id}"
    if loom_state == "partial":
        return "python3 .loom/bin/loom_init.py verify --target ." if (root / ".loom/bin/loom_init.py").exists() else "unknown"
    return "unknown"


def detect_validation_entry(root: Path, loom_state: str, *, bootstrap_mode: bool) -> str:
    if bootstrap_mode:
        return "python3 .loom/bin/loom_init.py verify --target ."
    if loom_state == "active":
        return "python3 .loom/bin/loom_init.py verify --target ."
    if loom_state == "partial":
        return "python3 .loom/bin/loom_init.py verify --target ." if (root / ".loom/bin/loom_init.py").exists() else "unknown"
    return "unknown"


def detect_review_merge_surface(root: Path, loom_state: str, *, bootstrap_mode: bool, active_item_id: str = "INIT-0001") -> dict[str, str]:
    pr_template = ".github/PULL_REQUEST_TEMPLATE.md" if file_exists(root, ".github/PULL_REQUEST_TEMPLATE.md") else "unknown"
    validation_surface = ".loom/status/current.md" if file_exists(root, ".loom/status/current.md") else "unknown"
    if bootstrap_mode and validation_surface == "unknown":
        validation_surface = ".loom/status/current.md"

    if bootstrap_mode:
        merge_surface = f"python3 .loom/bin/loom_flow.py checkpoint merge --target . --item {active_item_id}"
    elif loom_state == "active":
        merge_surface = f"{command_prefix(root, 'loom_flow.py')} checkpoint merge --target . --item {active_item_id}"
    else:
        merge_surface = "unknown"
    return {
        "pr_template": pr_template,
        "validation_surface": validation_surface,
        "merge_surface": merge_surface,
    }


def host_api_snapshot(
    *,
    requests: list[dict[str, Any]],
    errors: list[str],
    required_live: bool = False,
    budget: object | None = None,
) -> dict[str, Any]:
    verification_status = "verified" if not errors else "unverified"
    if errors:
        budget_payload = execution_budget_payload(
            status="unavailable",
            summary="; ".join(errors),
            provenance={"source": "github_control_plane", "error_count": len(errors)},
            adapter_evidence_locator="",
            enforcement=LOOM_EXECUTION_BUDGET_ENFORCEMENT,
        )
    else:
        budget_payload = normalize_execution_budget_payload(
            budget,
            fallback_status="not_applicable",
            fallback_summary="execution budget is not collected for this invocation.",
            fallback_locator="",
        )
    return {
        "schema_version": "loom-host-api-snapshot/v1",
        "read_mode": "uncached_live_gate" if required_live else "cached_non_merge",
        "verification_status": verification_status,
        "fallback_status": None if verification_status == "verified" else "host_unavailable",
        "cache_scope": "none" if required_live else "process",
        "requests": requests,
        "errors": errors,
        "budget": budget_payload,
    }


def local_workflow_presence(root: Path) -> dict[str, Any]:
    workflow_path = root / ".github/workflows/loom-check.yml"
    return {
        "schema_version": "loom-ci-check-presence/v1",
        "workflow_exists": workflow_path.exists(),
        "workflow_locator": ".github/workflows/loom-check.yml",
        "stable_check_names": list(GITHUB_STABLE_CHECK_NAMES),
        "check_ran": "unknown",
        "required_checks_configured": "unknown",
        "host_enforcement_status": "unverified",
        "recommended_action": "install the workflow and configure its stable check names as host-required checks",
    }


def detect_github_control_plane(root: Path) -> tuple[dict[str, Any], list[str]]:
    owner, repo = detect_github_repo(root)
    requests: list[dict[str, Any]] = []
    snapshot_errors: list[str] = []
    ci_presence = local_workflow_presence(root)
    surface: dict[str, Any] = {
        "repository": f"{owner}/{repo}" if owner and repo else "unknown",
        "default_branch": "unknown",
        "branch_protection": "unknown",
        "required_checks": "unknown",
        "pr_reviews": "unknown",
        "rulesets": {
            "status": "unknown",
            "enforced": "unknown",
            "count": "unknown",
        },
        "ci_check_presence": ci_presence,
        "host_enforcement": {
            "branch_protection_or_ruleset": "unknown",
            "required_checks": "unknown",
            "verification_status": "unverified",
        },
        "api_snapshot": host_api_snapshot(requests=requests, errors=["not read yet"]),
    }
    missing_inputs: list[str] = []

    if not owner or not repo:
        missing_inputs.append("cannot resolve GitHub repository from git origin")
        surface["api_snapshot"] = host_api_snapshot(requests=requests, errors=missing_inputs)
        return surface, missing_inputs

    requests.append({"method": "GET", "path": f"repos/{owner}/{repo}", "purpose": "repository default branch"})
    repo_payload, repo_errors = gh_rest_json(root, f"repos/{owner}/{repo}")
    if repo_errors or repo_payload is None:
        missing_inputs.extend(f"github control plane: {message}" for message in repo_errors)
        surface["api_snapshot"] = host_api_snapshot(requests=requests, errors=missing_inputs)
        return surface, missing_inputs

    full_name = repo_payload.get("full_name")
    if isinstance(full_name, str) and full_name:
        surface["repository"] = full_name
    branch_name = repo_payload.get("default_branch")
    if isinstance(branch_name, str) and branch_name:
        surface["default_branch"] = branch_name
    if surface["default_branch"] == "unknown":
        missing_inputs.append("github control plane: default branch is unavailable")
        surface["api_snapshot"] = host_api_snapshot(requests=requests, errors=missing_inputs)
        return surface, missing_inputs

    encoded_branch = quote(str(surface["default_branch"]), safe="")
    requests.append({"method": "GET", "path": f"repos/{owner}/{repo}/branches/{encoded_branch}", "purpose": "branch protection"})
    branch_payload, branch_errors = gh_json(root, ["api", f"repos/{owner}/{repo}/branches/{encoded_branch}"])
    if branch_errors or branch_payload is None:
        missing_inputs.extend(f"github control plane: {message}" for message in branch_errors)
        surface["api_snapshot"] = host_api_snapshot(requests=requests, errors=missing_inputs)
        return surface, missing_inputs

    protected = branch_payload.get("protected")
    if isinstance(protected, bool):
        surface["branch_protection"] = "enabled" if protected else "disabled"
    protection = branch_payload.get("protection")
    if isinstance(protection, dict):
        required_status = protection.get("required_status_checks")
        if isinstance(required_status, dict):
            contexts = required_status.get("contexts")
            if isinstance(contexts, list) and all(isinstance(item, str) for item in contexts):
                surface["required_checks"] = contexts
            else:
                surface["required_checks"] = []
        pull_request_reviews = protection.get("required_pull_request_reviews")
        if isinstance(pull_request_reviews, dict):
            surface["pr_reviews"] = "required"
        elif surface["branch_protection"] == "enabled":
            surface["pr_reviews"] = "not_required"
    required_checks = surface["required_checks"]
    if isinstance(required_checks, list):
        ci_presence["required_checks_configured"] = all(name in required_checks for name in GITHUB_STABLE_CHECK_NAMES)
    ci_presence["host_enforcement_status"] = (
        "verified"
        if surface["branch_protection"] == "enabled" and ci_presence["required_checks_configured"] is True
        else "unverified"
    )

    requests.append({"method": "GET", "path": f"repos/{owner}/{repo}/actions/workflows", "purpose": "workflow presence"})
    workflows_payload, workflow_errors = gh_json(root, ["api", f"repos/{owner}/{repo}/actions/workflows"])
    if workflows_payload is not None:
        workflows = workflows_payload.get("workflows")
        if isinstance(workflows, list):
            ci_presence["workflow_exists"] = any(
                isinstance(item, dict) and item.get("path") == ".github/workflows/loom-check.yml"
                for item in workflows
            ) or bool(ci_presence["workflow_exists"])
    else:
        snapshot_errors.extend(f"github workflow read: {message}" for message in workflow_errors)

    requests.append({"method": "GET", "path": f"repos/{owner}/{repo}/commits/{encoded_branch}/check-runs", "purpose": "recent check runs"})
    check_runs_payload, check_run_errors = gh_json(
        root,
        [
            "api",
            "-H",
            "Accept: application/vnd.github+json",
            f"repos/{owner}/{repo}/commits/{encoded_branch}/check-runs",
        ],
    )
    if check_runs_payload is not None:
        check_runs = check_runs_payload.get("check_runs")
        if isinstance(check_runs, list):
            seen_checks = {
                item.get("name")
                for item in check_runs
                if isinstance(item, dict) and isinstance(item.get("name"), str)
            }
            ci_presence["check_ran"] = all(name in seen_checks for name in GITHUB_STABLE_CHECK_NAMES)
    else:
        snapshot_errors.extend(f"github check-runs read: {message}" for message in check_run_errors)

    requests.append({"method": "GET", "path": f"repos/{owner}/{repo}/rulesets", "purpose": "branch ruleset enforcement"})
    rulesets, ruleset_errors = gh_json_list(root, ["api", f"repos/{owner}/{repo}/rulesets"])
    if ruleset_errors:
        surface["rulesets"] = {"status": "unverified", "enforced": "unknown", "count": "unknown"}
        snapshot_errors.extend(f"github rulesets read: {message}" for message in ruleset_errors)
    else:
        enforced_rulesets = [
            entry
            for entry in rulesets
            if entry.get("target") in {"branch", "push"} and entry.get("enforcement") == "active"
        ]
        surface["rulesets"] = {
            "status": "verified",
            "enforced": bool(enforced_rulesets),
            "count": len(rulesets),
        }

    branch_or_ruleset = surface["branch_protection"] == "enabled" or surface["rulesets"].get("enforced") is True
    required_checks_configured = ci_presence.get("required_checks_configured") is True
    surface["host_enforcement"] = {
        "branch_protection_or_ruleset": bool(branch_or_ruleset),
        "required_checks": bool(required_checks_configured),
        "workflow_exists": bool(ci_presence.get("workflow_exists")),
        "check_ran": ci_presence.get("check_ran"),
        "verification_status": "verified" if not snapshot_errors else "unverified",
    }
    surface["api_snapshot"] = host_api_snapshot(requests=requests, errors=snapshot_errors)
    return surface, missing_inputs


def detect_host_binding_surface(
    root: Path,
    *,
    carrier_summary: dict[str, dict[str, str]],
    github_control_plane: dict[str, Any],
    repo_interface: dict[str, Any],
    repo_interop: dict[str, Any],
) -> dict[str, Any]:
    branch_result = run_process(["git", "branch", "--show-current"], root)
    branch = branch_result.stdout.strip() if branch_result.returncode == 0 else ""
    branch_authority = "git"
    if not branch:
        branch = bootstrap_host_binding_branch(root)
        if branch:
            branch_authority = "bootstrap host binding"
    worktree_result = run_process(["git", "rev-parse", "--show-toplevel"], root)
    worktree = worktree_result.stdout.strip() if worktree_result.returncode == 0 else ""
    default_branch = github_control_plane.get("default_branch")
    required_objects: dict[str, dict[str, Any]] = {
        "work_item": {
            "status": carrier_summary.get("work_item", {}).get("status", "missing"),
            "locator": carrier_summary.get("work_item", {}).get("locator", "unknown"),
            "authority": "loom fact chain",
        },
        "branch": {
            "status": "present" if branch else "missing",
            "locator": branch or "unknown",
            "authority": branch_authority,
        },
        "worktree": {
            "status": "present" if worktree else "missing",
            "locator": worktree or "unknown",
            "authority": "git",
        },
        "implementation_pr": {
            "status": "host-managed",
            "locator": "GitHub PR linked from Work Item or branch",
            "authority": "host",
        },
        "merge_commit": {
            "status": "host-managed",
            "locator": "GitHub merged PR mergeCommit",
            "authority": "host",
        },
        "closeout": {
            "status": "present" if repo_interop.get("availability") == "present" else "host-managed",
            "locator": "reconciliation audit + closeout gate",
            "authority": "loom + host",
        },
    }
    profile_objects = {
        "phase": {
            "status": "profile-defined",
            "locator": "GitHub parent issue or equivalent planning object",
            "authority": "github-profile",
        },
        "fr": {
            "status": "profile-defined",
            "locator": "GitHub sub-issue or equivalent formal request",
            "authority": "github-profile",
        },
    }
    missing_inputs = [
        key
        for key in ("work_item", "branch", "worktree")
        if required_objects[key]["status"] in {"missing", "unknown"}
    ]
    if default_branch in {None, "unknown"}:
        missing_inputs.append("github default branch")
    if repo_interface.get("availability") == "incomplete":
        missing_inputs.append("repo interface")
    if repo_interop.get("availability") == "incomplete":
        missing_inputs.append("repo interop")
    return {
        "schema_version": "loom-host-binding/v1",
        "required_objects": {**profile_objects, **required_objects},
        "default_branch": default_branch,
        "missing_inputs": missing_inputs,
        "result": "pass" if not missing_inputs else "block",
        "summary": (
            "host binding surface can relate the active Work Item to branch, worktree, PR, merge commit, and closeout."
            if not missing_inputs
            else "host binding surface is readable, but required binding facts are missing or host-managed."
        ),
    }


def maturity_status(
    *,
    repository_mode: str,
    carrier_summary: dict[str, dict[str, str]],
    repo_interface: dict[str, Any],
    repo_interop: dict[str, Any],
    github_control_plane: dict[str, Any],
    host_binding: dict[str, Any],
) -> dict[str, Any]:
    carrier_present = {
        key: value.get("status") == "present"
        for key, value in carrier_summary.items()
    }
    spec_gate_present = (
        carrier_present.get("review", False)
        and carrier_present.get("spec_path", False)
        and carrier_present.get("plan_path", False)
    )
    repo_interface_present = repo_interface.get("availability") == "present"
    repo_interop_present = repo_interop.get("availability") == "present"
    basic_host_binding_present = host_binding.get("result") == "pass"
    github_control_plane_present = github_control_plane.get("default_branch") != "unknown"
    host_enforcement = github_control_plane.get("host_enforcement")
    host_enforced_control_plane = (
        isinstance(host_enforcement, dict)
        and host_enforcement.get("verification_status") == "verified"
        and host_enforcement.get("branch_protection_or_ruleset") is True
        and host_enforcement.get("required_checks") is True
    )
    required_objects = host_binding.get("required_objects")
    implementation_pr = required_objects.get("implementation_pr") if isinstance(required_objects, dict) else None
    merge_commit = required_objects.get("merge_commit") if isinstance(required_objects, dict) else None
    closeout = required_objects.get("closeout") if isinstance(required_objects, dict) else None
    pr_merge_path = (
        isinstance(implementation_pr, dict)
        and implementation_pr.get("authority") == "host"
        and implementation_pr.get("status") in {"host-managed", "present"}
    )
    controlled_merge_basis = host_enforced_control_plane and github_control_plane_present and pr_merge_path
    closeout_basis = (
        repo_interop_present
        and isinstance(merge_commit, dict)
        and merge_commit.get("authority") == "host"
        and isinstance(closeout, dict)
        and closeout.get("status") == "present"
    )
    facts = {
        **carrier_present,
        "light": False,
        "standard": False,
        "fr_work_item_layer": repo_interface_present and repository_mode != "new",
        "spec_gate": spec_gate_present,
        "status_control_plane": True,
        "basic_host_binding": basic_host_binding_present and repository_mode != "new",
        "closeout_reconciliation_read": repo_interop_present and repository_mode != "new",
        "repo_interface": repo_interface_present,
        "repo_interop": repo_interop_present,
        "host_enforced_control_plane": host_enforced_control_plane and repository_mode != "new",
        "pr_merge_path": pr_merge_path and repository_mode != "new",
        "controlled_merge_basis": controlled_merge_basis and repository_mode != "new",
        "closeout_basis": closeout_basis and repository_mode != "new",
        "github_controlled_merge": (
            repository_mode != "new"
            and github_control_plane_present
            and basic_host_binding_present
            and repo_interface_present
            and repo_interop_present
            and host_enforced_control_plane
            and controlled_merge_basis
            and closeout_basis
        ),
    }
    achieved: list[str] = []
    missing_by_level: dict[str, list[str]] = {}
    missing_details_by_level: dict[str, list[dict[str, Any]]] = {}
    for level in ("light", "standard", "strong"):
        missing = [field for field in MATURITY_LEVELS[level]["requires"] if not facts.get(field)]
        missing_by_level[level] = missing
        field_rows = MATURITY_REQUIRED_FIELDS.get(level, [])
        missing_details_by_level[level] = [
            row
            for row in field_rows
            if row["id"] in missing
        ]
        if not missing:
            achieved.append(level)
            facts[level] = True
    current = achieved[-1] if achieved else "unadopted"
    next_level = None
    for level in ("light", "standard", "strong"):
        if level not in achieved:
            next_level = level
            break
    return {
        "schema_version": "loom-governance-maturity/v1",
        "current": current,
        "achieved": achieved,
        "next": next_level,
        "levels": MATURITY_LEVELS,
        "required_fields": MATURITY_REQUIRED_FIELDS,
        "missing_by_level": missing_by_level,
        "missing_details_by_level": missing_details_by_level,
        "fresh_adoption": {
            "repository_mode": repository_mode,
            "max_default_maturity": "light",
            "applied": repository_mode == "new",
        },
        "gate_rollout": adoption_gate_rollout_status(maturity_current=current),
    }


def governance_control_plane(
    *,
    repository_mode: str,
    carrier_summary: dict[str, dict[str, str]],
    github_control_plane: dict[str, Any],
    repo_interface: dict[str, Any],
    repo_interop: dict[str, Any],
    host_binding: dict[str, Any],
    workspace_profile: dict[str, Any],
    gate_starter: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_version": GOVERNANCE_CONTROL_VERSION,
        "execution_entry": {
            "only_default_entry": "work_item",
            "illegal_entry_fallbacks": WORK_ITEM_ENFORCEMENT_FALLBACKS,
            "result": "pass" if carrier_summary.get("work_item", {}).get("status") == "present" else "block",
        },
        "workspace_profile": workspace_profile,
        "gate_starter": gate_starter,
        "host_binding": host_binding,
        "taxonomy": GATE_FAILURE_TAXONOMY,
        "gate_chain": GATE_CHAIN,
        "maturity": maturity_status(
            repository_mode=repository_mode,
            carrier_summary=carrier_summary,
            repo_interface=repo_interface,
            repo_interop=repo_interop,
            github_control_plane=github_control_plane,
            host_binding=host_binding,
        ),
    }


def build_governance_surface(
    root: Path,
    *,
    bootstrap_mode: bool = False,
    scenario_override: str | None = None,
) -> dict[str, Any]:
    loom_state = detect_loom_state(root)
    repository_mode = detect_repository_mode(root, loom_state, scenario_override=scenario_override)
    planning_mode = bootstrap_mode and repository_mode == "new" and loom_state != "active"
    active_item_id = active_entry_points(root).get("current_item_id", "INIT-0001")
    carrier_summary = detect_carrier_summary(root, repository_mode=repository_mode, planning_mode=planning_mode)
    github_control_plane, github_missing = detect_github_control_plane(root)
    execution_entry = detect_execution_entry(root, loom_state, bootstrap_mode=bootstrap_mode, active_item_id=active_item_id)
    validation_entry = detect_validation_entry(root, loom_state, bootstrap_mode=bootstrap_mode)
    review_merge_surface = detect_review_merge_surface(root, loom_state, bootstrap_mode=bootstrap_mode, active_item_id=active_item_id)
    repo_interface, repo_interface_missing = detect_repo_interface(root)
    repo_interop, repo_interop_missing = detect_repo_interop(root)
    host_binding = detect_host_binding_surface(
        root,
        carrier_summary=carrier_summary,
        github_control_plane=github_control_plane,
        repo_interface=repo_interface,
        repo_interop=repo_interop,
    )
    workspace_profile = detect_workspace_profile(root, host_binding=host_binding)
    gate_starter = detect_gate_starter(root)
    control_plane = governance_control_plane(
        repository_mode=repository_mode,
        carrier_summary=carrier_summary,
        github_control_plane=github_control_plane,
        repo_interface=repo_interface,
        repo_interop=repo_interop,
        host_binding=host_binding,
        workspace_profile=workspace_profile,
        gate_starter=gate_starter,
    )

    missing_inputs: list[str] = []
    if bootstrap_mode and repository_mode == "new":
        missing_inputs.extend(github_missing)
        summary = "repository is treated as new; Loom can plan the first governance carriers and bootstrap entrypoints without adding a second truth source."
    else:
        present_carriers = [key for key, value in carrier_summary.items() if value["status"] == "present"]
        if not present_carriers:
            missing_inputs.append("no stable Loom carriers are readable yet")
        missing_inputs.extend(github_missing)
        if repo_interface["availability"] == "incomplete":
            missing_inputs.extend(repo_interface_missing)
        if repo_interop["availability"] == "incomplete":
            missing_inputs.extend(repo_interop_missing)
        if host_binding["result"] == "block":
            missing_inputs.extend(f"host binding: {message}" for message in host_binding["missing_inputs"])
        control_plane_ready = github_control_plane["default_branch"] != "unknown"
        carrier_ready = bool(present_carriers)
        summary = (
            "resume chain is readable and the current governance carriers can support continued execution."
            if carrier_ready and control_plane_ready
            else "resume chain is only partially supported because governance carriers or GitHub control-plane signals are incomplete."
        )

    return {
        "repository_mode": repository_mode,
        "loom_state": loom_state,
        "carrier_summary": carrier_summary,
        "execution_entry": execution_entry,
        "validation_entry": validation_entry,
        "review_merge_surface": review_merge_surface,
        "github_control_plane": github_control_plane,
        "repo_interface": repo_interface,
        "repo_interop": repo_interop,
        "workspace_profile": workspace_profile,
        "gate_starter": gate_starter,
        "governance_control_plane": control_plane,
        "summary": summary,
        "missing_inputs": list(dict.fromkeys(missing_inputs)),
    }
