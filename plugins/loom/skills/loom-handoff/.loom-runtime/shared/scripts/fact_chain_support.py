#!/usr/bin/env python3
"""Shared fact-chain parsing and verification helpers for Loom bootstrap artifacts."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)(?:\s+#+\s*)?$")
KEY_VALUE_BULLET_RE = re.compile(r"^- ([^:]+):\s*(.+?)\s*$")
PLAIN_BULLET_RE = re.compile(r"^- (.+?)\s*$")

STATIC_FACT_FIELDS = {
    "Item ID": "item_id",
    "Goal": "goal",
    "Scope": "scope",
    "Execution Path": "execution_path",
    "Workspace Entry": "workspace_entry",
    "Recovery Entry": "recovery_entry",
    "Review Entry": "review_entry",
    "Validation Entry": "validation_entry",
    "Closing Condition": "closing_condition",
}

DYNAMIC_FACT_FIELDS = {
    "Item ID": "item_id",
    "Current Checkpoint": "current_checkpoint",
    "Current Stop": "current_stop",
    "Next Step": "next_step",
    "Blockers": "blockers",
    "Latest Validation Summary": "latest_validation_summary",
    "Recovery Boundary": "recovery_boundary",
    "Current Lane": "current_lane",
}

STATUS_FIELDS = {
    "Item ID": "item_id",
    "Goal": "goal",
    "Scope": "scope",
    "Execution Path": "execution_path",
    "Workspace Entry": "workspace_entry",
    "Recovery Entry": "recovery_entry",
    "Review Entry": "review_entry",
    "Validation Entry": "validation_entry",
    "Closing Condition": "closing_condition",
    "Current Checkpoint": "current_checkpoint",
    "Current Stop": "current_stop",
    "Next Step": "next_step",
    "Blockers": "blockers",
    "Latest Validation Summary": "latest_validation_summary",
    "Recovery Boundary": "recovery_boundary",
    "Current Lane": "current_lane",
}

STATUS_SOURCE_FIELDS = {
    "Static Truth": "work_item",
    "Dynamic Truth": "recovery_entry",
    "Locator Truth": "init_result",
    "Fact Chain CLI": "read_entry",
}

RUNTIME_EVIDENCE_FIELDS = {
    "Run Entry": "run_entry",
    "Logs Entry": "logs_entry",
    "Diagnostics Entry": "diagnostics_entry",
    "Verification Entry": "verification_entry",
    "Lane Entry": "lane_entry",
}

EXECUTION_LEDGER_FIELDS = {
    "Ledger Binding": "ledger_binding",
    "Plan Locator": "plan_locator",
    "Acceptance Locator": "acceptance_locator",
    "Validation Evidence Locator": "validation_evidence_locator",
    "Handoff Notes Locator": "handoff_notes_locator",
    "Evidence Freshness": "evidence_freshness",
}

PROVENANCE_KINDS = {
    "authored_truth",
    "host_control_mirror",
    "retained_result",
    "derived_surface",
    "runtime_state",
    "runtime_evidence",
}

FORBIDDEN_DYNAMIC_KEYS = {
    "current_checkpoint",
    "current_stop",
    "next_step",
    "blockers",
    "latest_validation_summary",
    "recovery_boundary",
    "current_lane",
}

FORBIDDEN_STATIC_KEYS = {
    "goal",
    "scope",
    "execution_path",
    "workspace_entry",
    "recovery_entry",
    "review_entry",
    "validation_entry",
    "closing_condition",
}

PARALLEL_TRUTH_CONTAINER_KEYS = {
    "host_mirror",
    "host_control_mirror",
    "host_control_plane_mirror",
    "retained_result",
    "retained_results",
}

FORBIDDEN_AUTHORED_KEYS = FORBIDDEN_DYNAMIC_KEYS | FORBIDDEN_STATIC_KEYS

FIELD_LABELS = {
    **{canonical: label for label, canonical in STATIC_FACT_FIELDS.items()},
    **{canonical: label for label, canonical in DYNAMIC_FACT_FIELDS.items()},
}

RUNTIME_EVIDENCE_FIELD_LABELS = {canonical: label for label, canonical in RUNTIME_EVIDENCE_FIELDS.items()}
EXECUTION_LEDGER_FIELD_LABELS = {canonical: label for label, canonical in EXECUTION_LEDGER_FIELDS.items()}


def load_json_file(path: Path) -> dict[str, object]:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def _clean_value(raw: str) -> str:
    value = raw.strip()
    if value.startswith("`") and value.endswith("`") and len(value) >= 2:
        value = value[1:-1].strip()
    return value


def markdown_sections(path: Path) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        match = HEADING_RE.match(raw_line)
        if match:
            current = match.group(2).strip()
            sections[current] = []
            continue
        if current is not None:
            sections[current].append(raw_line.rstrip())
    return sections


def parse_key_value_section(
    sections: dict[str, list[str]],
    section_name: str,
    field_map: dict[str, str],
    relative_path: str,
) -> tuple[dict[str, str], list[str]]:
    errors: list[str] = []
    lines = sections.get(section_name)
    if lines is None:
        return {}, [f"{relative_path}: missing section `{section_name}`"]

    values: dict[str, str] = {}
    seen: dict[str, str] = {}
    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped:
            continue
        match = KEY_VALUE_BULLET_RE.match(stripped)
        if not match:
            errors.append(f"{relative_path}: invalid bullet in `{section_name}`: {stripped}")
            continue
        label = match.group(1).strip()
        if label not in field_map:
            errors.append(f"{relative_path}: unexpected field `{label}` in `{section_name}`")
            continue
        canonical = field_map[label]
        if canonical in seen:
            errors.append(
                f"{relative_path}: duplicate field `{label}` in `{section_name}` "
                f"(canonical `{canonical}` already set by `{seen[canonical]}`)"
            )
            continue
        seen[canonical] = label
        values[canonical] = _clean_value(match.group(2))

    for label, canonical in field_map.items():
        if canonical not in values:
            errors.append(f"{relative_path}: missing `{label}` in `{section_name}`")
    return values, errors


def parse_list_section(sections: dict[str, list[str]], section_name: str, relative_path: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    lines = sections.get(section_name)
    if lines is None:
        return [], [f"{relative_path}: missing section `{section_name}`"]

    items: list[str] = []
    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped:
            continue
        match = PLAIN_BULLET_RE.match(stripped)
        if not match:
            errors.append(f"{relative_path}: invalid bullet in `{section_name}`: {stripped}")
            continue
        items.append(_clean_value(match.group(1)))

    if not items:
        errors.append(f"{relative_path}: `{section_name}` must list at least one item")
    return items, errors


def _relative(path: Path, root: Path) -> str:
    return str(path.resolve().relative_to(root.resolve()))


def resolve_repo_relative_path(target_root: Path, relative: str, *, label: str) -> tuple[Path | None, list[str]]:
    """Resolve a repository locator while rejecting absolute paths and path escapes."""
    if not isinstance(relative, str) or not relative.strip():
        return None, [f"{label} must be a non-empty repo-relative path"]
    locator = relative.strip()
    candidate_raw = Path(locator)
    if candidate_raw.is_absolute():
        return None, [f"{label} must be repo-relative, got absolute path: {locator}"]
    if ".." in candidate_raw.parts:
        return None, [f"{label} must stay within the target root and inside the target repository: {locator}"]
    candidate = (target_root / candidate_raw).resolve()
    try:
        candidate.relative_to(target_root.resolve())
    except ValueError:
        return None, [f"{label} must stay within the target root and inside the target repository: {locator}"]
    return candidate, []


def path_boundary_missing_details(*, label: str, locator: object, errors: list[str]) -> list[dict[str, object]]:
    """Return stable machine-readable details for repo locator boundary failures."""
    locator_text = "" if locator is None else str(locator)
    details: list[dict[str, object]] = []
    for message in errors:
        if "non-empty" in message:
            kind = "empty_locator"
        elif "absolute path" in message or "repo-relative" in message:
            kind = "absolute_locator"
        else:
            kind = "repo_locator_escape"

        scopes: list[str] = []
        if "target root" in message:
            scopes.append("target_root")
        if "repository" in message or "repo-relative" in message:
            scopes.append("repository_root")
        if not scopes:
            scopes.append("repository_root")

        for scope in scopes:
            details.append(
                {
                    "category": "path_boundary",
                    "kind": kind,
                    "scope": scope,
                    "label": label,
                    "locator": locator_text,
                    "message": message,
                }
            )
    return details


def parse_work_item(path: Path, root: Path) -> tuple[dict[str, object], list[str]]:
    relative_path = _relative(path, root)
    sections = markdown_sections(path)
    static_facts, errors = parse_key_value_section(sections, "Static Facts", STATIC_FACT_FIELDS, relative_path)
    artifacts, artifact_errors = parse_list_section(sections, "Associated Artifacts", relative_path)
    errors.extend(artifact_errors)
    data: dict[str, object] = dict(static_facts)
    data["associated_artifacts"] = artifacts

    for forbidden_key in FORBIDDEN_DYNAMIC_KEYS:
        if forbidden_key in static_facts:
            errors.append(f"{relative_path}: `{forbidden_key}` must not be authored in `Static Facts`")

    return data, errors


def parse_execution_ledger(
    sections: dict[str, list[str]],
    relative_path: str,
    recovery_ref: str,
) -> tuple[dict[str, str], list[str]]:
    ledger, errors = parse_key_value_section(
        sections,
        "Execution Ledger",
        EXECUTION_LEDGER_FIELDS,
        relative_path,
    )
    section_lines = sections.get("Execution Ledger", [])
    forbidden_labels = {
        label
        for label, canonical in DYNAMIC_FACT_FIELDS.items()
        if canonical in {"next_step", "blockers", "latest_validation_summary"}
    }
    for raw_line in section_lines:
        match = KEY_VALUE_BULLET_RE.match(raw_line.strip())
        if not match:
            continue
        label = match.group(1).strip()
        if label in forbidden_labels:
            errors.append(f"{relative_path}: `Execution Ledger` must not author `{label}`")

    if errors:
        return ledger, errors

    binding = ledger["ledger_binding"]
    if binding not in {"recovery_entry", recovery_ref}:
        errors.append(
            f"{relative_path}: `Execution Ledger` must bind to `recovery_entry` or `{recovery_ref}`, got `{binding}`"
        )
    freshness = ledger["evidence_freshness"].strip().lower()
    if freshness not in {"current", "not_applicable"}:
        errors.append(
            f"{relative_path}: `Execution Ledger` evidence must be `current` or `not_applicable`, got `{ledger['evidence_freshness']}`"
        )
    for field_name in ("plan_locator", "acceptance_locator", "validation_evidence_locator", "handoff_notes_locator"):
        value = ledger[field_name]
        if not value.strip():
            errors.append(
                f"{relative_path}: `Execution Ledger` `{EXECUTION_LEDGER_FIELD_LABELS[field_name]}` must be non-empty or `not_applicable`"
            )
    return ledger, errors


def parse_recovery_entry(path: Path, root: Path, recovery_ref: str | None = None) -> tuple[dict[str, str], list[str]]:
    relative_path = _relative(path, root)
    sections = markdown_sections(path)
    dynamic_facts, errors = parse_key_value_section(sections, "Dynamic Facts", DYNAMIC_FACT_FIELDS, relative_path)
    execution_ledger, ledger_errors = parse_execution_ledger(
        sections,
        relative_path,
        recovery_ref or relative_path,
    )
    errors.extend(ledger_errors)

    for forbidden_key in FORBIDDEN_STATIC_KEYS:
        if forbidden_key in dynamic_facts:
            errors.append(f"{relative_path}: `{forbidden_key}` must not be authored in `Dynamic Facts`")

    if execution_ledger:
        dynamic_facts["execution_ledger"] = execution_ledger
    return dynamic_facts, errors


def validate_runtime_evidence(runtime_evidence: dict[str, str], relative_path: str) -> list[str]:
    errors: list[str] = []
    for label, canonical in RUNTIME_EVIDENCE_FIELDS.items():
        if canonical not in runtime_evidence:
            continue
        value = runtime_evidence.get(canonical)
        if not isinstance(value, str) or not value:
            errors.append(f"{relative_path}: `{label}` in `Runtime Evidence` must be a non-empty string")
            continue
        if value == "not_applicable":
            continue
        if not value.strip():
            errors.append(f"{relative_path}: `{label}` in `Runtime Evidence` must not be blank")
    return errors


def parse_status_surface(path: Path, root: Path) -> tuple[dict[str, str], dict[str, str], dict[str, str], list[str]]:
    relative_path = _relative(path, root)
    sections = markdown_sections(path)
    status_facts, errors = parse_key_value_section(
        sections,
        "Derived Fact Chain View",
        STATUS_FIELDS,
        relative_path,
    )
    runtime_evidence, runtime_errors = parse_key_value_section(
        sections,
        "Runtime Evidence",
        RUNTIME_EVIDENCE_FIELDS,
        relative_path,
    )
    errors.extend(runtime_errors)
    errors.extend(validate_runtime_evidence(runtime_evidence, relative_path))
    sources, source_errors = parse_key_value_section(sections, "Sources", STATUS_SOURCE_FIELDS, relative_path)
    errors.extend(source_errors)
    return status_facts, runtime_evidence, sources, errors


def _normalize_json_key(key: str) -> str:
    return key.strip().lower().replace("-", "_").replace(" ", "_")


def find_forbidden_dynamic_keys(payload: object, prefix: str = "") -> list[str]:
    errors: list[str] = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            normalized = _normalize_json_key(str(key))
            current_prefix = f"{prefix}.{key}" if prefix else str(key)
            if normalized in FORBIDDEN_DYNAMIC_KEYS:
                errors.append(current_prefix)
            errors.extend(find_forbidden_dynamic_keys(value, current_prefix))
    elif isinstance(payload, list):
        for index, value in enumerate(payload):
            current_prefix = f"{prefix}[{index}]"
            errors.extend(find_forbidden_dynamic_keys(value, current_prefix))
    return errors


def find_forbidden_authored_keys(payload: object, prefix: str = "") -> list[str]:
    errors: list[str] = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            normalized = _normalize_json_key(str(key))
            current_prefix = f"{prefix}.{key}" if prefix else str(key)
            if normalized in FORBIDDEN_AUTHORED_KEYS:
                errors.append(current_prefix)
            errors.extend(find_forbidden_authored_keys(value, current_prefix))
    elif isinstance(payload, list):
        for index, value in enumerate(payload):
            current_prefix = f"{prefix}[{index}]"
            errors.extend(find_forbidden_authored_keys(value, current_prefix))
    return errors


def find_parallel_truth_authored_keys(payload: object, prefix: str = "") -> list[str]:
    errors: list[str] = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            normalized = _normalize_json_key(str(key))
            current_prefix = f"{prefix}.{key}" if prefix else str(key)
            if normalized in PARALLEL_TRUTH_CONTAINER_KEYS:
                errors.extend(find_forbidden_authored_keys(value, current_prefix))
            else:
                errors.extend(find_parallel_truth_authored_keys(value, current_prefix))
    elif isinstance(payload, list):
        for index, value in enumerate(payload):
            current_prefix = f"{prefix}[{index}]"
            errors.extend(find_parallel_truth_authored_keys(value, current_prefix))
    return errors


def expected_status_values(
    work_item: dict[str, object],
    recovery_entry: dict[str, str],
) -> dict[str, str]:
    return {
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


def _provenance_entry(
    *,
    kind: str,
    carrier: str,
    field: str,
    authority: str,
    freshness: str,
    trusted_because: str,
    path: str | None = None,
    locator: str | None = None,
) -> dict[str, str]:
    if kind not in PROVENANCE_KINDS:
        raise ValueError(f"unsupported provenance kind: {kind}")
    entry = {
        "kind": kind,
        "carrier": carrier,
        "field": field,
        "authority": authority,
        "freshness": freshness,
        "trusted_because": trusted_because,
    }
    if path is not None:
        entry["path"] = path
    if locator is not None:
        entry["locator"] = locator
    return entry


def _blocking_failure(
    *,
    kind: str,
    carrier: str,
    field: str,
    message: str,
    authority: str,
    path: str | None = None,
    expected: object | None = None,
    actual: object | None = None,
) -> dict[str, object]:
    failure: dict[str, object] = {
        "category": "drift" if kind != "missing_authored_truth" else "gate_failure",
        "kind": kind,
        "carrier": carrier,
        "field": field,
        "authority": authority,
        "message": message,
        "blocking": True,
        "fallback_to": "admission",
    }
    if path is not None:
        failure["path"] = path
    if expected is not None:
        failure["expected"] = expected
    if actual is not None:
        failure["actual"] = actual
    return failure


def build_fact_report(
    *,
    target_root: Path,
    output_relative: str,
    mode: str,
    read_entry: str,
    current_item_id: str,
    work_item_ref: str,
    recovery_ref: str,
    status_ref: str,
    work_item: dict[str, object],
    recovery_entry: dict[str, str],
    status_surface: dict[str, str],
    runtime_evidence: dict[str, str],
    execution_ledger: dict[str, str],
    status_sources: dict[str, str],
    expected_status: dict[str, str],
    expected_sources: dict[str, str],
    provenance: list[dict[str, str]],
    blocking_failures: list[dict[str, object]],
    stale_fields: list[dict[str, object]],
    drift_fields: list[dict[str, object]],
    parallel_truth_drift: list[dict[str, object]],
) -> dict[str, object]:
    facts: dict[str, dict[str, object]] = {}
    for field_name in STATIC_FACT_FIELDS.values():
        if field_name not in work_item:
            continue
        facts[field_name] = {
            "value": work_item[field_name] if field_name == "associated_artifacts" else str(work_item[field_name]),
            "source": {
                "carrier": "work_item",
                "path": work_item_ref,
                "field": FIELD_LABELS.get(field_name, field_name),
            },
        }
    if "associated_artifacts" in work_item:
        facts["associated_artifacts"] = {
            "value": list(work_item["associated_artifacts"]),
            "source": {"carrier": "work_item", "path": work_item_ref, "field": "Associated Artifacts"},
        }
    for field_name in DYNAMIC_FACT_FIELDS.values():
        if field_name == "item_id":
            continue
        if field_name not in recovery_entry:
            continue
        facts[field_name] = {
            "value": recovery_entry[field_name],
            "source": {
                "carrier": "recovery_entry",
                "path": recovery_ref,
                "field": FIELD_LABELS.get(field_name, field_name),
            },
        }

    runtime_evidence_report = {
        field_name: {
            "value": value,
            "status": "not_applicable" if value == "not_applicable" else "present",
            "source": {
                "carrier": "status_surface",
                "path": status_ref,
                "field": label,
            },
        }
        for label, field_name in RUNTIME_EVIDENCE_FIELDS.items()
        if field_name in runtime_evidence
        for value in (runtime_evidence[field_name],)
    }
    ledger_missing = [
        canonical
        for canonical in EXECUTION_LEDGER_FIELDS.values()
        if not str(execution_ledger.get(canonical, "")).strip()
    ]
    ledger_freshness = execution_ledger.get("evidence_freshness", "")
    ledger_status = "complete"
    if ledger_missing:
        ledger_status = "missing"
    elif ledger_freshness == "not_applicable":
        ledger_status = "not_applicable"

    surface_status = "fresh"
    if stale_fields:
        surface_status = "stale"
    elif drift_fields or parallel_truth_drift:
        surface_status = "drift"

    recovery_status = "ready"
    if blocking_failures:
        recovery_status = "blocked"
    elif parallel_truth_drift:
        recovery_status = "parallel_truth_drift"
    elif stale_fields or drift_fields:
        recovery_status = "needs_refresh"

    return {
        "target": str(target_root),
        "fact_chain": {
            "mode": mode,
            "read_entry": read_entry,
            "entry_points": {
                "current_item_id": current_item_id,
                "work_item": work_item_ref,
                "recovery_entry": recovery_ref,
                "status_surface": status_ref,
            },
        },
        "provenance": provenance,
        "facts": facts,
        "runtime_evidence": runtime_evidence_report,
        "execution_ledger": {
            "authoritative_carrier": "recovery_entry",
            "authoritative_path": recovery_ref,
            "status": ledger_status,
            "completeness": "complete" if not ledger_missing else "missing",
            "freshness": ledger_freshness,
            "fields": execution_ledger,
            "missing_fields": ledger_missing,
            "forbidden_authored_fields": [],
        },
        "derived_status_surface": {
            "path": status_ref,
            "status": surface_status,
            "values": expected_status,
            "actual_values": status_surface,
            "runtime_evidence": runtime_evidence,
            "sources": expected_sources,
            "actual_sources": status_sources,
            "stale": stale_fields,
            "drift": drift_fields,
            "blocking_failures": blocking_failures,
        },
        "recovery_readiness": {
            "result": "block" if blocking_failures else "pass",
            "status": recovery_status,
            "summary": (
                "authored work item and recovery entry are readable, and the derived status surface is fresh."
                if not blocking_failures
                else "recovery is blocked because authored truth and derived or mirror surfaces drift."
            ),
            "missing_inputs": [
                str(failure["message"])
                for failure in blocking_failures
                if isinstance(failure.get("message"), str)
            ],
            "fallback_to": "admission" if blocking_failures else None,
            "checks": {
                "authored_work_item": "pass",
                "authored_recovery_entry": "pass",
                "derived_status_surface": "block" if stale_fields or drift_fields else "pass",
                "parallel_truth": "block" if parallel_truth_drift else "pass",
            },
            "authoritative_carrier": "recovery_entry",
            "authoritative_path": recovery_ref,
            "parallel_truth_drift": parallel_truth_drift,
            "blocking_failures": blocking_failures,
        },
        "blocking_failures": blocking_failures,
    }


def inspect_fact_chain(
    target_root: Path,
    output_relative: str = ".loom/bootstrap/init-result.json",
) -> tuple[dict[str, object], list[str]]:
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

    blocking_failures: list[dict[str, object]] = []
    stale_fields: list[dict[str, object]] = []
    drift_fields: list[dict[str, object]] = []
    parallel_truth_drift: list[dict[str, object]] = []

    forbidden_init_keys = sorted(
        set(find_forbidden_dynamic_keys(fact_chain, "fact_chain"))
        | set(find_parallel_truth_authored_keys(init_result))
    )
    if forbidden_init_keys:
        for key_path in forbidden_init_keys:
            message = f"init-result mirror or retained result must not author Work Item or recovery state at `{key_path}`"
            failure = _blocking_failure(
                kind="parallel_truth_drift",
                carrier="init_result",
                field=key_path,
                authority="recovery_entry",
                path=output_relative,
                message=message,
            )
            blocking_failures.append(failure)
            parallel_truth_drift.append(failure)

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

    fatal_entry_errors = [error for error in errors if not error.startswith("init-result must not author dynamic")]
    if fatal_entry_errors:
        return {}, errors

    work_item_path, work_item_path_errors = resolve_repo_relative_path(
        target_root,
        str(work_item_ref),
        label="init-result.fact_chain.entry_points.work_item",
    )
    recovery_path, recovery_path_errors = resolve_repo_relative_path(
        target_root,
        str(recovery_ref),
        label="init-result.fact_chain.entry_points.recovery_entry",
    )
    status_path, status_path_errors = resolve_repo_relative_path(
        target_root,
        str(status_ref),
        label="init-result.fact_chain.entry_points.status_surface",
    )
    errors.extend(work_item_path_errors)
    errors.extend(recovery_path_errors)
    errors.extend(status_path_errors)
    if work_item_path_errors or recovery_path_errors or status_path_errors:
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
            errors.append(f"declared fact-chain carrier is missing on disk: {label} -> {_relative(path, target_root)}")
    if errors:
        return {}, errors

    work_item, work_item_errors = parse_work_item(work_item_path, target_root)
    ledger_locator_keys = (
        "execution_ledger",
        "execution_ledger_entry",
        "ledger",
        "ledger_entry",
    )
    declared_ledger_locators = {
        key: value
        for key, value in entry_points.items()
        if key in ledger_locator_keys and isinstance(value, str) and value
    }
    if declared_ledger_locators:
        unique_ledger_locators = set(declared_ledger_locators.values())
        if unique_ledger_locators != {str(recovery_ref)}:
            errors.append(
                "init-result.fact_chain.entry_points declares a second execution ledger locator; "
                f"ledger must bind to recovery_entry `{recovery_ref}`"
            )
    if errors:
        return {}, errors
    recovery_entry, recovery_errors = parse_recovery_entry(recovery_path, target_root, str(recovery_ref))
    status_surface, runtime_evidence, status_sources, status_errors = parse_status_surface(status_path, target_root)
    parse_errors = work_item_errors + recovery_errors + status_errors
    errors.extend(parse_errors)
    if parse_errors:
        return {}, errors

    if str(work_item["item_id"]) != str(recovery_entry["item_id"]):
        message = (
            "work item and recovery entry disagree on item id: "
            f"{work_item['item_id']} vs {recovery_entry['item_id']}"
        )
        blocking_failures.append(
            _blocking_failure(
                kind="authored_truth_drift",
                carrier="recovery_entry",
                field="item_id",
                authority="work_item",
                path=str(recovery_ref),
                expected=str(work_item["item_id"]),
                actual=str(recovery_entry["item_id"]),
                message=message,
            )
        )
    if str(work_item["recovery_entry"]) != str(recovery_ref):
        message = (
            "work item recovery entry does not match init-result locator: "
            f"{work_item['recovery_entry']} vs {recovery_ref}"
        )
        blocking_failures.append(
            _blocking_failure(
                kind="locator_drift",
                carrier="work_item",
                field="recovery_entry",
                authority="init_result",
                path=str(work_item_ref),
                expected=str(recovery_ref),
                actual=str(work_item["recovery_entry"]),
                message=message,
            )
        )
    if str(work_item["item_id"]) != str(current_item_id):
        message = (
            "init-result.fact_chain.entry_points.current_item_id does not match work item id: "
            f"{current_item_id} vs {work_item['item_id']}"
        )
        blocking_failures.append(
            _blocking_failure(
                kind="host_control_mirror_drift",
                carrier="init_result",
                field="current_item_id",
                authority="work_item",
                path=output_relative,
                expected=str(work_item["item_id"]),
                actual=str(current_item_id),
                message=message,
            )
        )

    expected_status = expected_status_values(work_item, recovery_entry)
    for field_name, expected_value in expected_status.items():
        actual_value = status_surface.get(field_name)
        if actual_value != expected_value:
            message = (
                "status surface mismatch for "
                f"`{field_name}`: expected `{expected_value}`, got `{actual_value}`"
            )
            failure_kind = "derived_surface_stale"
            failure = _blocking_failure(
                kind=failure_kind,
                carrier="status_surface",
                field=field_name,
                authority="recovery_entry" if field_name in FORBIDDEN_DYNAMIC_KEYS else "work_item",
                path=str(status_ref),
                expected=expected_value,
                actual=actual_value,
                message=message,
            )
            blocking_failures.append(failure)
            stale_fields.append(failure)

    expected_sources = {
        "work_item": str(work_item_ref),
        "recovery_entry": str(recovery_ref),
        "init_result": output_relative,
        "read_entry": str(read_entry),
    }
    for source_key, expected_value in expected_sources.items():
        actual_value = status_sources.get(source_key)
        if actual_value != expected_value:
            message = (
                "status surface source mismatch for "
                f"`{source_key}`: expected `{expected_value}`, got `{actual_value}`"
            )
            failure = _blocking_failure(
                kind="source_stale",
                carrier="status_surface",
                field=source_key,
                authority="init_result",
                path=str(status_ref),
                expected=expected_value,
                actual=actual_value,
                message=message,
            )
            blocking_failures.append(failure)
            stale_fields.append(failure)

    provenance = [
        _provenance_entry(
            kind="host_control_mirror",
            carrier="init_result",
            locator=output_relative,
            field="fact_chain",
            authority="host_control",
            freshness="current" if not forbidden_init_keys else "drift",
            trusted_because="init-result only selects carriers and must not author recovery execution state",
        ),
        _provenance_entry(
            kind="runtime_state",
            carrier="init_result",
            locator=output_relative,
            field="current_item_id",
            authority="work_item",
            freshness="current" if str(work_item["item_id"]) == str(current_item_id) else "drift",
            trusted_because="current item id is a host runtime selection mirror checked against authored work item truth",
        ),
        _provenance_entry(
            kind="derived_surface",
            carrier="status_surface",
            path=str(status_ref),
            field="Derived Fact Chain View",
            authority="work_item+recovery_entry",
            freshness="current" if not stale_fields and not drift_fields else "stale",
            trusted_because="status surface is retained output derived from authored carriers and verified before consumption",
        ),
        _provenance_entry(
            kind="retained_result",
            carrier="status_surface",
            path=str(status_ref),
            field="Sources",
            authority="init_result",
            freshness="current" if not stale_fields else "stale",
            trusted_because="retained source bindings are accepted only when they match init-result locators",
        ),
    ]
    provenance.extend(
        _provenance_entry(
            kind="authored_truth",
            carrier="work_item",
            path=str(work_item_ref),
            field=FIELD_LABELS.get(field_name, field_name),
            authority="work_item",
            freshness="current",
            trusted_because="work item owns static fact-chain truth",
        )
        for field_name in STATIC_FACT_FIELDS.values()
        if field_name in work_item
    )
    provenance.extend(
        _provenance_entry(
            kind="authored_truth",
            carrier="recovery_entry",
            path=str(recovery_ref),
            field=FIELD_LABELS.get(field_name, field_name),
            authority="recovery_entry",
            freshness="current",
            trusted_because="recovery entry owns dynamic execution truth",
        )
        for field_name in DYNAMIC_FACT_FIELDS.values()
        if field_name in recovery_entry
    )
    provenance.extend(
        _provenance_entry(
            kind="runtime_evidence",
            carrier="status_surface",
            path=str(status_ref),
            field=RUNTIME_EVIDENCE_FIELD_LABELS.get(field_name, field_name),
            authority="runtime_evidence",
            freshness="not_applicable" if value == "not_applicable" else "current",
            trusted_because="runtime evidence is consumed as status-surface evidence, not authored recovery truth",
        )
        for field_name, value in runtime_evidence.items()
    )
    execution_ledger = dict(recovery_entry.get("execution_ledger", {}))
    provenance.append(
        _provenance_entry(
            kind="authored_truth",
            carrier="recovery_entry",
            path=str(recovery_ref),
            field="Execution Ledger",
            authority="recovery_entry",
            freshness=execution_ledger.get("evidence_freshness", "missing"),
            trusted_because="execution ledger is a locator/evidence view bound to the recovery entry, not a second recovery state source",
        )
    )

    report = build_fact_report(
        target_root=target_root,
        output_relative=output_relative,
        mode=str(mode),
        read_entry=str(read_entry),
        current_item_id=str(current_item_id),
        work_item_ref=str(work_item_ref),
        recovery_ref=str(recovery_ref),
        status_ref=str(status_ref),
        work_item=work_item,
        recovery_entry=recovery_entry,
        status_surface=status_surface,
        runtime_evidence=runtime_evidence,
        execution_ledger=dict(recovery_entry.get("execution_ledger", {})),
        status_sources=status_sources,
        expected_status=expected_status,
        expected_sources=expected_sources,
        provenance=provenance,
        blocking_failures=blocking_failures,
        stale_fields=stale_fields,
        drift_fields=drift_fields,
        parallel_truth_drift=parallel_truth_drift,
    )
    return report, []
