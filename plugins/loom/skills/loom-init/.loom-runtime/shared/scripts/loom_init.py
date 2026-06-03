#!/usr/bin/env python3
"""Minimal executable bootstrap entry for Loom adoption."""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

sys.dont_write_bytecode = True

from fact_chain_support import inspect_fact_chain
from governance_surface import build_governance_surface, workspace_lifecycle_expectations
from runtime_paths import registry_path, shared_asset
from runtime_state import detect_runtime_state

RUNTIME_SOURCE = "skills/shared/scripts/loom_init.py"
FLOW_RUNTIME_SOURCE = "skills/shared/scripts/loom_flow.py"
STATUS_RUNTIME_SOURCE = "skills/shared/scripts/loom_status.py"
CHECK_RUNTIME_SOURCE = "skills/shared/scripts/loom_check.py"
STORY_CARRIERS_RUNTIME_SOURCE = "skills/shared/scripts/loom_story_carriers.py"
FACT_CHAIN_RUNTIME_SOURCE = "skills/shared/scripts/fact_chain_support.py"
GOVERNANCE_RUNTIME_SOURCE = "skills/shared/scripts/governance_surface.py"
TOOL_VERSION = "1.3.0"
CONTRACT_VERSION = "1.3.0"
WORK_ITEM_ID = "INIT-0001"
RUNTIME_GITIGNORE_LINES = (
    ".loom/runtime/",
    ".loom/tmp/",
    ".loom/cache/",
    ".loom/attempts/**/raw-logs/",
    ".loom/attempts/**/scratch/",
    ".loom/local/",
    ".loom/bin/**/__pycache__/",
    ".loom/bin/**/*.py[cod]",
)
RUNTIME_SCRATCH_PREFIXES = (
    ".loom/runtime/",
    ".loom/tmp/",
    ".loom/cache/",
    ".loom/local/",
)
RUNTIME_SCRATCH_PATTERNS = (
    ".loom/attempts/**/raw-logs/**",
    ".loom/attempts/**/scratch/**",
)
BLANKET_LOOM_GITIGNORE_PATTERNS = {
    ".loom",
    ".loom/",
    ".loom/*",
    ".loom/**",
    "/.loom",
    "/.loom/",
    "/.loom/*",
    "/.loom/**",
}
SHADOW_PARITY_SURFACES = ("admission", "review", "merge_ready", "closeout")
ADOPTION_INTENTS = (
    "observe-only",
    "skill-install-only",
    "attach-only",
    "light-governance",
    "execution-control",
    "strong-governance",
)
UNSPECIFIED_ADOPTION_INTENT = "unspecified"
NON_WRITABLE_ADOPTION_PATHS = {"defer", "skill-install-only"}
SCAFFOLD_PROFILES = (
    "observe-only",
    "skill-install-only",
    "attach-only",
    "light-governance",
    "execution-control",
    "strong-governance",
)
ATTACH_ONLY_FORBIDDEN_AUTHORED_CARRIERS = (
    {
        "path": ".loom/work-items/**",
        "reason": "attach-only preserves host-owned work item truth",
        "remediation": "migrate the item to a host truth locator, delete the competing Loom carrier, or rerun with --intent execution-control",
    },
    {
        "path": ".loom/progress/**",
        "reason": "attach-only preserves host-owned recovery/progress truth",
        "remediation": "migrate recovery state to a host truth locator, delete the competing Loom carrier, or rerun with --intent execution-control",
    },
    {
        "path": ".loom/status/current.md",
        "reason": "attach-only preserves host-owned project status truth",
        "remediation": "migrate status to a host truth locator, delete the competing Loom carrier, or rerun with --intent execution-control",
    },
    {
        "path": ".loom/reviews/**",
        "reason": "attach-only preserves host-owned PR review or guardian truth",
        "remediation": "migrate review truth to a host truth locator, delete the competing Loom carrier, or rerun with --intent execution-control",
    },
    {
        "path": ".loom/specs/**",
        "reason": "attach-only does not author Loom spec truth unless the repo explicitly upgrades intent",
        "remediation": "migrate spec truth to a host locator, delete the competing Loom carrier, or rerun with --intent execution-control",
    },
)
ATTACH_ONLY_HOST_TRUTH_LOCATORS = {
    "work_item": {
        "host_surface": "github_issue",
        "locator": "repo-owned issue tracker",
        "mode": "host_truth_locator",
    },
    "project_status": {
        "host_surface": "github_project",
        "locator": "repo-owned project board or status system",
        "mode": "host_truth_locator",
    },
    "review": {
        "host_surface": "pull_request_review_or_guardian",
        "locator": "repo-owned PR review, guardian, or review gate",
        "mode": "host_truth_locator",
    },
    "closeout": {
        "host_surface": "pull_request_metadata_and_issue_state",
        "locator": "repo-owned PR metadata plus issue state",
        "mode": "host_truth_locator",
    },
}

RUNTIME_ARTIFACT_SOURCES = {
    ".loom/bin/loom_init.py": RUNTIME_SOURCE,
    ".loom/bin/fact_chain_support.py": FACT_CHAIN_RUNTIME_SOURCE,
    ".loom/bin/governance_surface.py": GOVERNANCE_RUNTIME_SOURCE,
    ".loom/bin/loom_flow.py": FLOW_RUNTIME_SOURCE,
    ".loom/bin/loom_status.py": STATUS_RUNTIME_SOURCE,
    ".loom/bin/runtime_paths.py": "skills/shared/scripts/runtime_paths.py",
    ".loom/bin/runtime_state.py": "skills/shared/scripts/runtime_state.py",
    ".loom/bin/loom_check.py": CHECK_RUNTIME_SOURCE,
    ".loom/bin/loom_story_carriers.py": STORY_CARRIERS_RUNTIME_SOURCE,
}

ROOT_BOUNDARY_FILES = (
    "AGENTS.md",
    "WORKFLOW.md",
    "docs/WORKFLOW.md",
)

CI_DIRS = (
    ".github/workflows",
    ".gitlab-ci.yml",
)

CODE_DIR_HINTS = (
    "src",
    "app",
    "lib",
    "cmd",
    "pkg",
)

DOC_FACT_SOURCE_HINTS = (
    "AGENTS.md",
    "README.md",
    "VISION.md",
    "docs",
)

DOMAIN_FACT_MODEL_FILES = {
    "contract_model.md",
    "domain_model.md",
}

GENERATED_ROOT_ENTRY = (
    "# Loom Root Entry\n\n"
    "This repository was initialized with Loom bootstrap artifacts.\n\n"
    "Read `.loom/README.md` first, then `.loom/bootstrap/init-result.json` "
    "for the current initialization truth.\n"
)

SKILL_SIGNAL_RULES: dict[str, tuple[str, ...]] = {
    "loom-adopt": (
        "初始化",
        "新项目",
        "retrofit",
        "adopt",
        "adoption",
        "bootstrap loom",
        "bootstrap the repo",
        "接入 loom",
        "引入 loom",
    ),
    "loom-resume": (
        "恢复上下文",
        "接手当前事项",
        "继续推进",
        "问下一步",
        "resume",
        "resume the current item",
        "continue the current item",
        "next step",
    ),
    "loom-build": (
        "实现当前事项",
        "执行 build",
        "implementation round",
        "build round",
        "loom build",
        "subagent-driven",
        "subagent driven",
        "集成 subagent",
        "repeated blocker",
    ),
    "loom-story": (
        "user story",
        "story readiness",
        "story shaping",
        "story business confirmation",
        "story-to-delivery",
        "product context",
        "acceptance scenarios",
        "actor specificity",
        "scenario coverage",
        "用户故事",
        "故事准入",
        "业务语义确认",
        "确认 story",
        "修订 story",
        "产品上下文",
    ),
    "loom-pre-review": (
        "review 前",
        "进入 review",
        "pre-review",
        "pre review",
        "可 review",
        "review readiness",
    ),
    "loom-review": (
        "正式 review",
        "formal review",
        "code review",
        "语义审查",
        "做审查",
        "review 结论",
    ),
    "loom-spec-review": (
        "spec review",
        "formal spec review",
        "spec gate",
        "确认 spec 是否通过",
        "审查 formal spec",
        "审查 spec",
    ),
    "loom-handoff": (
        "交接",
        "回写停点",
        "移交当前事项",
        "handoff",
        "hand off",
        "transfer the current item",
    ),
    "loom-retire": (
        "清理现场",
        "退休现场",
        "结束当前事项现场",
        "retire",
        "cleanup the workspace",
        "clean up the workspace",
    ),
    "loom-merge-ready": (
        "merge-ready",
        "merge ready",
        "最终放行前预检",
        "可合并",
        "merge 前",
        "pre-merge",
        "pre merge",
        "合并前检查",
        "可以合并",
    ),
}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap Loom into a target repository.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    bootstrap = subparsers.add_parser("bootstrap", help="Analyze and optionally scaffold a target repo")
    bootstrap.add_argument("--target", required=True, help="Target repository root")
    bootstrap.add_argument(
        "--scenario",
        default="auto",
        choices=("auto", "new", "pre-execution-existing", "small-existing", "complex-existing"),
        help="Override scenario detection",
    )
    bootstrap.add_argument("--intake", help="Optional intake JSON file")
    bootstrap.add_argument(
        "--intent",
        choices=ADOPTION_INTENTS,
        help=(
            "Explicit adoption intent: observe-only, skill-install-only, attach-only, "
            "light-governance, execution-control, or strong-governance"
        ),
    )
    bootstrap.add_argument(
        "--output",
        help="Output path for init-result.json relative to target root",
        default=".loom/bootstrap/init-result.json",
    )
    bootstrap.add_argument("--write", action="store_true", help="Write bootstrap artifacts into the target repo")
    bootstrap.add_argument("--verify", action="store_true", help="Verify written artifacts after scaffolding")
    bootstrap.add_argument("--force", action="store_true", help="Overwrite Loom-managed artifacts when needed")
    bootstrap.add_argument(
        "--repair-gitignore",
        action="store_true",
        help="Replace a blanket .loom gitignore with runtime/cache-only .loom ignore rules during write",
    )
    bootstrap.add_argument(
        "--portable-output",
        action="store_true",
        help="Normalize machine-local paths and branch names in written bootstrap metadata",
    )
    bootstrap.add_argument(
        "--install-pr-template",
        action="store_true",
        help="Install the Loom PR template when the target repo does not already provide one",
    )

    verify = subparsers.add_parser("verify", help="Verify Loom bootstrap artifacts in a target repo")
    verify.add_argument("--target", required=True, help="Target repository root")
    verify.add_argument(
        "--output",
        help="Expected init-result.json path relative to target root",
        default=".loom/bootstrap/init-result.json",
    )

    fact_chain = subparsers.add_parser("fact-chain", help="Read and validate the Loom fact chain in a target repo")
    fact_chain.add_argument("--target", required=True, help="Target repository root")
    fact_chain.add_argument(
        "--output",
        help="Expected init-result.json path relative to target root",
        default=".loom/bootstrap/init-result.json",
    )

    runtime_state = subparsers.add_parser("runtime-state", help="Read the Loom runtime scene/carrier state")
    runtime_state.add_argument("--target", required=True, help="Target repository root")

    route = subparsers.add_parser("route", help="Route a Loom task to the root or a scenario skill")
    route.add_argument("--target", required=True, help="Target repository root")
    mode = route.add_mutually_exclusive_group(required=True)
    mode.add_argument("--skill", help="Explicit skill id to use")
    mode.add_argument("--task", help="Task text used for implicit routing")

    return parser.parse_args(argv)


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_output_path(target_root: Path, raw_output: str) -> Path:
    output_path = Path(raw_output)
    if output_path.is_absolute():
        raise RuntimeError("--output must be relative to the target root")
    if ".." in output_path.parts:
        raise RuntimeError("--output must stay inside the target root")
    resolved = (target_root / output_path).resolve()
    try:
        resolved.relative_to(target_root.resolve())
    except ValueError as exc:
        raise RuntimeError("--output must stay inside the target root") from exc
    return resolved


def runtime_state_payload(target_root: Path) -> dict[str, object]:
    return detect_runtime_state(__file__, "loom-init", target_root=target_root)


def write_text(path: Path, content: str, force: bool) -> bool:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        current = path.read_text(encoding="utf-8")
        if current == content:
            return False
        if not force:
            raise RuntimeError(f"refusing to overwrite existing file without --force: {path}")
    path.write_text(content, encoding="utf-8")
    return True


def write_json(path: Path, payload: object, force: bool) -> bool:
    return write_text(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n", force=force)


def active_gitignore_pattern(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or stripped.startswith("!"):
        return None
    return stripped


def blanket_loom_gitignore_entries(content: str) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for index, line in enumerate(content.splitlines(), start=1):
        pattern = active_gitignore_pattern(line)
        if pattern in BLANKET_LOOM_GITIGNORE_PATTERNS:
            entries.append({"line": index, "pattern": pattern})
    return entries


def repaired_gitignore_content(content: str) -> str:
    kept_lines = [
        line
        for line in content.splitlines()
        if active_gitignore_pattern(line) not in BLANKET_LOOM_GITIGNORE_PATTERNS
    ]
    existing_patterns = {
        pattern
        for line in kept_lines
        if (pattern := active_gitignore_pattern(line)) is not None
    }
    missing_runtime_lines = [line for line in RUNTIME_GITIGNORE_LINES if line not in existing_patterns]
    if missing_runtime_lines and kept_lines and kept_lines[-1].strip():
        kept_lines.append("")
    kept_lines.extend(missing_runtime_lines)
    return "\n".join(kept_lines).rstrip() + "\n"


def gitignore_policy_payload(target_root: Path) -> dict[str, object]:
    gitignore = target_root / ".gitignore"
    current = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
    blanket_entries = blanket_loom_gitignore_entries(current)
    repaired = repaired_gitignore_content(current)
    existing_patterns = {
        pattern
        for line in current.splitlines()
        if (pattern := active_gitignore_pattern(line)) is not None
    }
    return {
        "path": ".gitignore",
        "status": "requires_repair" if blanket_entries else "ok",
        "blanket_loom_ignore": bool(blanket_entries),
        "blanket_entries": blanket_entries,
        "required_runtime_ignores": list(RUNTIME_GITIGNORE_LINES),
        "missing_runtime_ignores": [line for line in RUNTIME_GITIGNORE_LINES if line not in existing_patterns],
        "repair": {
            "available": bool(blanket_entries),
            "command": "python3 .loom/bin/loom_init.py bootstrap --target . --write --repair-gitignore",
            "summary": "remove blanket .loom ignore and keep only runtime/cache scratch paths ignored",
            "unified_diff": "".join(
                difflib.unified_diff(
                    current.splitlines(keepends=True),
                    repaired.splitlines(keepends=True),
                    fromfile=".gitignore",
                    tofile=".gitignore",
                )
            ),
        },
    }


def git_command(target_root: Path, args: list[str]) -> subprocess.CompletedProcess[str] | None:
    try:
        return subprocess.run(
            ["git", "-C", str(target_root), *args],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None


def is_git_work_tree(target_root: Path) -> bool:
    result = git_command(target_root, ["rev-parse", "--is-inside-work-tree"])
    return result is not None and result.returncode == 0 and result.stdout.strip() == "true"


def is_runtime_scratch_path(relative_path: str) -> bool:
    normalized = relative_path.rstrip("/")
    if any(normalized == prefix.rstrip("/") or normalized.startswith(prefix) for prefix in RUNTIME_SCRATCH_PREFIXES):
        return True
    if not normalized.startswith(".loom/attempts/"):
        return False
    parts = normalized.split("/")
    return "raw-logs" in parts[3:] or "scratch" in parts[3:]


def stable_carrier_capability(relative_path: str, owner: str | None = None) -> str:
    if is_runtime_scratch_path(relative_path):
        return "runtime-residue"
    if relative_path.startswith(".loom/bootstrap/") or relative_path == ".loom/README.md":
        return "bootstrap/root"
    if relative_path.startswith(".loom/bin/"):
        return "repo-local-runtime"
    if relative_path.startswith(".loom/companion/"):
        return "repo-companion"
    if relative_path.startswith(".loom/shadow/"):
        return "shadow-parity"
    if relative_path.startswith((".loom/work-items/", ".loom/progress/", ".loom/reviews/", ".loom/status/", ".loom/specs/", ".loom/stories/")):
        return "execution-support"
    if owner:
        return owner
    return "stable-carrier"


def stable_carrier_entries(target_root: Path, result: dict[str, object]) -> list[dict[str, str]]:
    entries: dict[str, dict[str, str]] = {}
    scaffold_profile = result.get("scaffold_profile")
    profile_name = str(scaffold_profile.get("name")) if isinstance(scaffold_profile, dict) else "unknown"

    def add(raw_path: object, *, kind: object = None, source: str, metadata: dict[str, object] | None = None) -> None:
        relative = normalize_relative_path(raw_path)
        if relative is None:
            return
        if not relative.startswith(".loom/"):
            return
        owner = metadata.get("owner") if isinstance(metadata, dict) else None
        owner_value = str(owner) if isinstance(owner, str) and owner else None
        if relative not in entries:
            entries[relative] = {
                "path": relative,
                "kind": str(kind) if isinstance(kind, str) and kind else "stable-carrier",
                "source": source,
                "profile": profile_name,
                "capability": stable_carrier_capability(relative, owner_value),
            }
            if owner_value:
                entries[relative]["owner"] = owner_value
            if is_runtime_scratch_path(relative):
                entries[relative]["invalid_reason"] = "unexpected_runtime_path"

    required_carriers = result.get("required_carriers")
    if isinstance(required_carriers, list) and required_carriers:
        source_keys = ("required_carriers",)
    else:
        source_keys = ("initial_artifacts", "planned_writes")
    for key in source_keys:
        values = result.get(key)
        if not isinstance(values, list):
            continue
        for value in values:
            if isinstance(value, dict):
                add(value.get("path"), kind=value.get("kind"), source=key, metadata=value)

    manifest = bootstrap_manifest(target_root)
    artifacts = manifest.get("artifacts")
    if isinstance(artifacts, list):
        for artifact in artifacts:
            if isinstance(artifact, dict):
                add(artifact.get("path"), kind=artifact.get("kind"), source="manifest.artifacts", metadata=artifact)

    add(".loom/bootstrap/init-result.json", kind="init-result", source="verify")
    return [entries[path] for path in sorted(entries)]


def stable_carrier_git_visibility(target_root: Path, result: dict[str, object]) -> dict[str, object]:
    entries = stable_carrier_entries(target_root, result)
    report: dict[str, object] = {
        "schema_version": "loom-stable-carrier-git-visibility/v1",
        "result": "pass",
        "summary": "stable Loom carriers are present and not hidden by Git ignore rules.",
        "work_tree": is_git_work_tree(target_root),
        "checked": [],
        "ignored": [],
        "missing": [],
        "untracked": [],
        "unexpected_runtime_paths": [],
        "runtime_exclusions": [*RUNTIME_SCRATCH_PREFIXES, *RUNTIME_SCRATCH_PATTERNS],
        "blocking_errors": [],
    }
    if not entries:
        report["summary"] = "no stable Loom carriers were declared for this adoption profile."
        return report
    if report["work_tree"] is not True:
        report["result"] = "not_applicable"
        report["summary"] = "target is not a Git work tree; stable carrier Git visibility cannot be checked."
        return report

    checked: list[dict[str, str]] = []
    ignored: list[dict[str, str]] = []
    missing: list[dict[str, str]] = []
    untracked: list[dict[str, str]] = []
    unexpected_runtime_paths: list[dict[str, str]] = []
    blocking_errors: list[str] = []

    for entry in entries:
        relative = entry["path"]
        status = "tracked"
        remediation = "no action required"
        path = target_root / relative
        if entry.get("invalid_reason") == "unexpected_runtime_path":
            status = "unexpected_runtime_path"
            remediation = "remove this runtime scratch path from stable carrier declarations"
            unexpected_runtime_paths.append({**entry, "reason": status, "remediation": remediation})
            blocking_errors.append(
                f"stable Loom carrier points at an unexpected runtime path: {relative}; stable carriers must not live in runtime scratch/cache/tmp/local paths"
            )
        elif not path.exists():
            status = "missing"
            remediation = "rerun bootstrap or restore the declared stable carrier"
            missing.append({**entry, "reason": status, "remediation": remediation})
            blocking_errors.append(f"stable Loom carrier is missing: {relative} ({entry['source']})")
        else:
            tracked = git_command(target_root, ["ls-files", "--cached", "--", relative])
            tracked_paths = tracked.stdout.splitlines() if tracked is not None and tracked.returncode == 0 else []
            if relative in tracked_paths:
                status = "tracked"
            else:
                ignore = git_command(target_root, ["check-ignore", "-q", "--", relative])
                if ignore is not None and ignore.returncode == 0:
                    status = "ignored"
                    remediation = "remove or narrow the ignore rule so this stable carrier remains Git-visible"
                    ignored.append({**entry, "reason": status, "remediation": remediation})
                    blocking_errors.append(
                        f"stable Loom carrier is ignored by Git: {relative}; remove blanket or carrier-specific ignore rules"
                    )
                else:
                    status = "untracked"
                    remediation = f"run `git add {relative}` before treating the adoption as committed"
                    untracked.append({**entry, "reason": status, "remediation": remediation})
        checked.append({**entry, "status": status, "remediation": remediation})

    report["checked"] = checked
    report["ignored"] = ignored
    report["missing"] = missing
    report["untracked"] = untracked
    report["unexpected_runtime_paths"] = unexpected_runtime_paths
    report["blocking_errors"] = blocking_errors
    if blocking_errors:
        report["result"] = "block"
        report["summary"] = "stable Loom carriers are missing, hidden by Git ignore rules, or declared under runtime scratch paths."
    elif untracked:
        report["result"] = "pass"
        report["summary"] = "stable Loom carriers are Git-visible; some still need `git add` before commit."
    return report


def ensure_gitignore_has_runtime_ignores(target_root: Path, *, repair_gitignore: bool) -> bool:
    gitignore = target_root / ".gitignore"
    current = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
    blanket_entries = blanket_loom_gitignore_entries(current)
    if blanket_entries and not repair_gitignore:
        locations = ", ".join(f"line {entry['line']}: {entry['pattern']}" for entry in blanket_entries)
        raise RuntimeError(
            "blanket .loom gitignore would hide stable Loom carriers; "
            f"found {locations}. Remove the blanket ignore or rerun with --repair-gitignore "
            "to replace it with runtime-only .loom ignores."
        )
    new_content = repaired_gitignore_content(current)
    if current == new_content:
        return False
    gitignore.write_text(new_content, encoding="utf-8")
    return True


def file_exists(root: Path, relative_path: str) -> bool:
    return (root / relative_path).exists()


def load_registry_skill_ids() -> tuple[tuple[str, ...] | None, str | None]:
    try:
        active_registry = registry_path(__file__)
    except RuntimeError as exc:
        return None, str(exc)
    if not active_registry.exists():
        return None, f"{active_registry} is missing"
    try:
        registry = read_json(active_registry)
    except json.JSONDecodeError as exc:
        return None, f"{active_registry} is invalid JSON: {exc.msg}"
    entries = registry.get("entries")
    if not isinstance(entries, list) or not entries:
        return None, "installed registry must declare a non-empty entries list"
    skill_ids = [
        entry.get("id")
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("id"), str) and entry.get("id")
    ]
    if not skill_ids:
        return None, "installed registry must declare at least one valid skill id"
    return tuple(skill_ids), None


def match_route_signals(task: str) -> dict[str, list[str]]:
    lowered = task.lower()
    matches: dict[str, list[str]] = {}
    for skill_id, keywords in SKILL_SIGNAL_RULES.items():
        matched = [keyword for keyword in keywords if keyword in lowered]
        if matched:
            matches[skill_id] = matched
    return matches


def route_payload(
    *,
    result: str,
    selected_skill: str,
    mode: str,
    matched_signals: list[str],
    summary: str,
    missing_inputs: list[str],
    fallback_to: str,
    governance_surface: dict[str, object] | None = None,
    runtime_state: dict[str, object] | None = None,
) -> dict[str, object]:
    payload = {
        "command": "route",
        "result": result,
        "selected_skill": selected_skill,
        "mode": mode,
        "matched_signals": matched_signals,
        "summary": summary,
        "missing_inputs": missing_inputs,
        "fallback_to": fallback_to,
    }
    if governance_surface is not None:
        payload["governance_surface"] = governance_surface
    if runtime_state is not None:
        payload["runtime_state"] = runtime_state
    return payload


@lru_cache(maxsize=None)
def bootstrap_manifest(root: Path) -> dict[str, object]:
    manifest_path = root / ".loom/bootstrap/manifest.json"
    if not manifest_path.exists():
        return {}
    try:
        payload = read_json(manifest_path)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


@lru_cache(maxsize=None)
def generated_paths(root: Path) -> tuple[str, ...]:
    manifest = bootstrap_manifest(root)
    paths: set[str] = {".loom"}
    artifacts = manifest.get("artifacts")
    if isinstance(artifacts, list):
        for artifact in artifacts:
            if isinstance(artifact, str) and artifact:
                paths.add(artifact)
                continue
            if isinstance(artifact, dict):
                artifact_path = artifact.get("path")
                if isinstance(artifact_path, str) and artifact_path:
                    paths.add(artifact_path)
    if file_exists(root, "AGENTS.md"):
        try:
            if (root / "AGENTS.md").read_text(encoding="utf-8") == GENERATED_ROOT_ENTRY:
                paths.add("AGENTS.md")
        except OSError:
            pass
    return tuple(sorted(paths))


def is_generated_path(root: Path, path: Path) -> bool:
    try:
        relative = str(path.relative_to(root))
    except ValueError:
        return False
    for generated in generated_paths(root):
        if relative == generated or relative.startswith(f"{generated}/"):
            return True
    return False


def count_meaningful_entries(root: Path) -> int:
    ignored = {".git", ".DS_Store"}
    count = 0
    for path in root.rglob("*"):
        if any(part in ignored for part in path.parts):
            continue
        if path.name == ".gitkeep":
            continue
        if is_generated_path(root, path):
            continue
        count += 1
    return count


def detect_root_boundary(root: Path) -> str:
    generated = generated_paths(root)
    if any(file_exists(root, candidate) and candidate not in generated for candidate in ROOT_BOUNDARY_FILES):
        return "clear"
    if file_exists(root, "README.md"):
        return "partial"
    return "missing"


def has_make_target(makefile_path: Path, targets: tuple[str, ...]) -> bool:
    if not makefile_path.exists():
        return False
    text = makefile_path.read_text(encoding="utf-8")
    return any(re.search(rf"^{re.escape(target)}\s*:", text, re.MULTILINE) for target in targets)


def detect_package_scripts(root: Path) -> dict[str, object]:
    package_json = root / "package.json"
    if not package_json.exists():
        return {}
    try:
        data = read_json(package_json)
    except json.JSONDecodeError:
        return {}
    scripts = data.get("scripts")
    return scripts if isinstance(scripts, dict) else {}


def detect_ci_or_tests(root: Path) -> bool:
    if any(file_exists(root, candidate) for candidate in CI_DIRS):
        return True
    if (root / "tests").exists() or (root / "test").exists():
        return True
    if has_make_target(root / "Makefile", ("test", "check", "lint", "loom-check")):
        return True
    scripts = detect_package_scripts(root)
    return any(name in scripts for name in ("test", "check", "lint"))


def detect_validation_entry(root: Path) -> bool:
    if has_make_target(root / "Makefile", ("check", "test", "lint", "loom-check")):
        return True
    if file_exists(root, "justfile") or file_exists(root, "Taskfile.yml"):
        return True
    scripts = detect_package_scripts(root)
    return any(name in scripts for name in ("check", "test", "lint"))


def detect_primary_gap(root: Path, root_boundary_docs: str, validation_entry: bool) -> str:
    if root_boundary_docs != "clear":
        return "governance"
    if not validation_entry:
        return "execution-support"
    if not file_exists(root, ".github/PULL_REQUEST_TEMPLATE.md"):
        return "review"
    if not (root / "specs").exists() and not (root / "docs/specs").exists():
        return "spec-path"
    return "execution-support"


def has_code_surface(root: Path) -> bool:
    return any((root / hint).exists() and not is_generated_path(root, root / hint) for hint in CODE_DIR_HINTS)


def detect_document_truth_maturity(root: Path, root_boundary_docs: str) -> str:
    present = [hint for hint in DOC_FACT_SOURCE_HINTS if file_exists(root, hint)]
    if root_boundary_docs == "clear" and len(present) >= 2:
        return "established"
    if root_boundary_docs in {"clear", "partial"} or present:
        return "partial"
    return "absent"


def detect_execution_surface_maturity(root: Path, ci_or_basic_tests: bool, validation_entry: bool) -> str:
    has_code = has_code_surface(root)
    if has_code and ci_or_basic_tests and validation_entry:
        return "formed"
    if has_code or ci_or_basic_tests or validation_entry:
        return "partial"
    return "not_formed"


def detect_governance_carrier_maturity(root: Path, root_boundary_docs: str) -> str:
    if any(file_exists(root, path) for path in (".loom/status/current.md", ".loom/work-items", ".loom/progress")):
        return "loom_carriers_present"
    if any(file_exists(root, path) for path in (".github/PULL_REQUEST_TEMPLATE.md", "WORKFLOW.md", "docs/WORKFLOW.md")):
        return "repo_governance_present"
    if root_boundary_docs in {"clear", "partial"}:
        return "root_docs_only"
    return "absent"


def maturity_payload(root: Path, root_boundary_docs: str, ci_or_basic_tests: bool, validation_entry: bool) -> dict[str, str]:
    return {
        "document_truth": detect_document_truth_maturity(root, root_boundary_docs),
        "execution_surface": detect_execution_surface_maturity(root, ci_or_basic_tests, validation_entry),
        "governance_carriers": detect_governance_carrier_maturity(root, root_boundary_docs),
    }


def is_pre_execution_existing_intake(intake: dict[str, object]) -> bool:
    maturity = intake.get("maturity")
    if not isinstance(maturity, dict):
        return False
    return (
        intake.get("repository_type") == "existing"
        and maturity.get("document_truth") in {"partial", "established"}
        and maturity.get("execution_surface") == "not_formed"
        and maturity.get("governance_carriers") in {"root_docs_only", "absent"}
    )


def detect_recovery_pain(root: Path) -> bool:
    markers = (
        ".loom/progress",
        ".loom/work-items",
        "progress",
        "checkpoint",
        "exec-plan",
    )
    present = 0
    for marker in markers:
        if any(
            path
            for path in root.rglob("*")
            if not is_generated_path(root, path) and marker in str(path.relative_to(root))
        ):
            present += 1
    return present >= 2


def detect_shared_or_high_risk(root: Path) -> bool:
    hints = ("contract", "schema", "proto", "api", "sdk", "skills", "governance")
    for path in root.rglob("*"):
        if ".git" in path.parts:
            continue
        if is_generated_path(root, path):
            continue
        lowered = path.name.lower()
        relative_parts = path.relative_to(root).parts
        if lowered in DOMAIN_FACT_MODEL_FILES and (len(relative_parts) == 1 or relative_parts[0] == "docs"):
            continue
        if any(hint in lowered for hint in hints):
            return True
    return False


def git_dirty_count(root: Path) -> int:
    if not (root / ".git").exists():
        return 0
    try:
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return 0
    if result.returncode != 0:
        return 0
    return len([line for line in result.stdout.splitlines() if line.strip()])


def detect_purity(root: Path) -> str:
    dirty = git_dirty_count(root)
    if dirty >= 8:
        return "severe"
    if dirty >= 2:
        return "mixed"
    return "clean"


def detect_merge_review_overload(root: Path, validation_entry: bool) -> bool:
    code_dirs = sum(1 for hint in CODE_DIR_HINTS if (root / hint).exists())
    if code_dirs == 0:
        return False
    has_pr_template = file_exists(root, ".github/PULL_REQUEST_TEMPLATE.md")
    has_workflow_doc = any(file_exists(root, candidate) for candidate in ("WORKFLOW.md", "docs/WORKFLOW.md"))
    has_repo_scripts = (root / "scripts").exists()
    has_repo_native_governance = (root / "docs" / "exec-plans").exists() or (root / "scripts" / "policy").exists()
    return bool(validation_entry and has_pr_template and has_repo_scripts and (has_workflow_doc or has_repo_native_governance))


def detect_repository_type(root: Path) -> str:
    meaningful_entries = count_meaningful_entries(root)
    has_readme = file_exists(root, "README.md")
    has_code = has_code_surface(root)
    if meaningful_entries <= 2 and not has_readme and not has_code:
        return "new"
    return "existing"


def normalize_adoption_intent(raw_intent: object, *, source: str) -> str:
    if raw_intent in (None, ""):
        return UNSPECIFIED_ADOPTION_INTENT
    if not isinstance(raw_intent, str):
        raise RuntimeError(f"{source} adoption_intent must be a string")
    if raw_intent == UNSPECIFIED_ADOPTION_INTENT:
        return raw_intent
    if raw_intent not in ADOPTION_INTENTS:
        allowed = ", ".join((*ADOPTION_INTENTS, UNSPECIFIED_ADOPTION_INTENT))
        raise RuntimeError(f"{source} adoption_intent must be one of: {allowed}")
    return raw_intent


def apply_adoption_intent(payload: dict[str, object], cli_intent: str | None) -> dict[str, object]:
    if cli_intent:
        payload["adoption_intent"] = normalize_adoption_intent(cli_intent, source="cli")
        payload["adoption_intent_source"] = "cli"
        return payload
    if "adoption_intent" in payload:
        payload["adoption_intent"] = normalize_adoption_intent(payload.get("adoption_intent"), source="intake")
        payload["adoption_intent_source"] = "intake"
        return payload
    payload["adoption_intent"] = UNSPECIFIED_ADOPTION_INTENT
    payload["adoption_intent_source"] = "unspecified"
    return payload


def load_or_detect_intake(root: Path, intake_path: str | None, cli_intent: str | None = None) -> dict[str, object]:
    if intake_path:
        payload = read_json(Path(intake_path).expanduser().resolve())
        payload.setdefault("schema_version", "loom-init-intake/v1")
        return apply_adoption_intent(payload, cli_intent)

    repository_type = detect_repository_type(root)
    root_boundary_docs = detect_root_boundary(root)
    ci_or_basic_tests = detect_ci_or_tests(root)
    validation_entry = detect_validation_entry(root)
    payload = {
        "schema_version": "loom-init-intake/v1",
        "repository_type": repository_type,
        "root_boundary_docs": root_boundary_docs,
        "ci_or_basic_tests": ci_or_basic_tests,
        "repository_level_validation_entry": validation_entry,
        "primary_gap_category": detect_primary_gap(root, root_boundary_docs, validation_entry),
        "long_running_recovery_pain": detect_recovery_pain(root),
        "shared_contract_or_high_risk_boundary": detect_shared_or_high_risk(root),
        "purity_or_scope_signals": detect_purity(root),
        "merge_review_semantic_overload": detect_merge_review_overload(root, validation_entry),
        "maturity": maturity_payload(root, root_boundary_docs, ci_or_basic_tests, validation_entry),
        "notes": "autodetected by loom_init.py",
    }
    return apply_adoption_intent(payload, cli_intent)


def classify_scenario(intake: dict[str, object], override: str) -> str:
    if override != "auto":
        return override

    repository_type = intake["repository_type"]
    root_boundary_docs = intake["root_boundary_docs"]
    ci_or_basic_tests = bool(intake["ci_or_basic_tests"])
    validation_entry = bool(intake["repository_level_validation_entry"])
    primary_gap_category = str(intake["primary_gap_category"])
    recovery_pain = bool(intake["long_running_recovery_pain"])
    shared_boundary = bool(intake["shared_contract_or_high_risk_boundary"])
    purity = str(intake["purity_or_scope_signals"])
    merge_overload = bool(intake["merge_review_semantic_overload"])

    if repository_type == "new":
        return "new"
    if is_pre_execution_existing_intake(intake):
        return "pre-execution-existing"
    if (
        root_boundary_docs == "clear"
        and ci_or_basic_tests
        and validation_entry
        and primary_gap_category in {"governance", "review", "spec-path"}
        and not recovery_pain
        and not shared_boundary
        and purity == "clean"
        and not merge_overload
    ):
        return "small-existing"
    return "complex-existing"


def scenario_label(scenario: str) -> str:
    return {
        "new": "新项目",
        "pre-execution-existing": "执行前既有仓库",
        "small-existing": "小型既有仓库",
        "complex-existing": "复杂既有仓库",
    }[scenario]


def intensity_label(scenario: str, intake: dict[str, object]) -> str:
    if scenario in {"new", "pre-execution-existing", "small-existing"}:
        return "轻量"
    if bool(intake["shared_contract_or_high_risk_boundary"]) or bool(intake["long_running_recovery_pain"]):
        return "强化"
    return "标准"


def integration_mode(scenario: str) -> str:
    return "root" if scenario == "new" else "companion"


def recovery_mode(scenario: str) -> str:
    return "checkpoint-lite" if scenario in {"new", "pre-execution-existing", "small-existing"} else "standard"


def recommended_adoption_path(scenario: str, intake: dict[str, object]) -> str:
    intent = str(intake.get("adoption_intent", UNSPECIFIED_ADOPTION_INTENT))
    if intent == "observe-only":
        return "defer"
    if intent == "skill-install-only":
        return "skill-install-only"
    if intent == "attach-only":
        return "deep-existing-repo"
    if intent == "light-governance":
        return "minimal-bootstrap" if scenario == "new" else "lightweight-retrofit"
    if intent in {"execution-control", "strong-governance"}:
        return "full-bootstrap"

    if scenario == "new":
        return "minimal-bootstrap"
    if scenario in {"pre-execution-existing", "small-existing"}:
        return "lightweight-retrofit"
    if (
        intake.get("repository_type") == "existing"
        and intake.get("root_boundary_docs") == "clear"
        and bool(intake.get("repository_level_validation_entry"))
        and bool(intake.get("merge_review_semantic_overload"))
    ):
        return "deep-existing-repo"
    return "full-bootstrap"


def uses_attach_only_path(adoption_path: str) -> bool:
    return adoption_path == "deep-existing-repo"


def effective_adoption_intent(adoption_path: str, intake: dict[str, object]) -> str:
    requested = str(intake.get("adoption_intent", UNSPECIFIED_ADOPTION_INTENT))
    if requested != UNSPECIFIED_ADOPTION_INTENT:
        return requested
    if adoption_path == "deep-existing-repo":
        return "attach-only"
    if adoption_path in {"minimal-bootstrap", "lightweight-retrofit"}:
        return "light-governance"
    if adoption_path == "full-bootstrap":
        return "execution-control"
    if adoption_path in NON_WRITABLE_ADOPTION_PATHS:
        return adoption_path
    return UNSPECIFIED_ADOPTION_INTENT


def is_heavy_execution_path(adoption_path: str) -> bool:
    return adoption_path == "full-bootstrap"


def scaffold_profile_key(adoption_path: str, intake: dict[str, object]) -> str:
    requested = str(intake.get("adoption_intent", UNSPECIFIED_ADOPTION_INTENT))
    if requested in SCAFFOLD_PROFILES:
        return requested
    if adoption_path == "defer":
        return "observe-only"
    if adoption_path == "skill-install-only":
        return "skill-install-only"
    if uses_attach_only_path(adoption_path):
        return "attach-only"
    if adoption_path == "full-bootstrap":
        return "execution-control"
    return "light-governance"


def profile_has_work_item_carriers(profile: str) -> bool:
    return profile in {"execution-control", "strong-governance"}


def profile_writes_artifacts(profile: str) -> bool:
    return profile not in {"observe-only", "skill-install-only"}


def forbidden_authored_carriers(profile: str) -> list[dict[str, str]]:
    if profile != "attach-only":
        return []
    return [dict(carrier) for carrier in ATTACH_ONLY_FORBIDDEN_AUTHORED_CARRIERS]


def required_carriers_for_profile(artifacts: list[dict[str, str]], profile: str) -> list[dict[str, str]]:
    if profile in {"observe-only", "skill-install-only"}:
        return []
    return [
        {
            "path": artifact["path"],
            "kind": artifact["kind"],
            "owner": write_owner_for_path(artifact["path"]),
        }
        for artifact in artifacts
        if isinstance(artifact.get("path"), str) and isinstance(artifact.get("kind"), str)
    ]


def normalize_relative_path(raw_path: object) -> str | None:
    if not isinstance(raw_path, str) or not raw_path:
        return None
    normalized = raw_path.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    if normalized.startswith("/") or normalized.startswith("../") or "/../" in normalized:
        return None
    return normalized


def matches_forbidden_authored_carrier(relative_path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        prefix = pattern[:-3]
        return relative_path == prefix or relative_path.startswith(prefix + "/")
    return relative_path == pattern


def forbidden_authored_carrier_for_path(relative_path: str) -> dict[str, str] | None:
    for carrier in ATTACH_ONLY_FORBIDDEN_AUTHORED_CARRIERS:
        pattern = carrier["path"]
        if matches_forbidden_authored_carrier(relative_path, pattern):
            return carrier
    return None


def collect_forbidden_authored_carrier_declarations(result: dict[str, object]) -> list[dict[str, str]]:
    declarations: list[dict[str, str]] = []

    def add(raw_path: object, source: str) -> None:
        relative = normalize_relative_path(raw_path)
        if relative is None:
            return
        carrier = forbidden_authored_carrier_for_path(relative)
        if carrier is not None:
            declarations.append({"path": relative, "pattern": carrier["path"], "source": source})

    for key in ("initial_artifacts", "planned_writes"):
        entries = result.get(key)
        if isinstance(entries, list):
            for entry in entries:
                if isinstance(entry, dict):
                    add(entry.get("path"), key)
    work_items = result.get("initial_work_items")
    if isinstance(work_items, list):
        for work_item in work_items:
            if not isinstance(work_item, dict):
                continue
            artifacts = work_item.get("artifacts")
            if isinstance(artifacts, list):
                for artifact in artifacts:
                    add(artifact, "initial_work_items.artifacts")
    write = result.get("write")
    if isinstance(write, dict):
        touched = write.get("touched")
        if isinstance(touched, list):
            for path in touched:
                add(path, "write.touched")
    return declarations


def collect_forbidden_authored_carrier_files(target_root: Path) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    for carrier in ATTACH_ONLY_FORBIDDEN_AUTHORED_CARRIERS:
        pattern = carrier["path"]
        if pattern.endswith("/**"):
            prefix = pattern[:-3]
            base = target_root / prefix
            if not base.exists():
                continue
            if base.is_file():
                found.append({"path": prefix, "pattern": pattern, "source": "filesystem"})
                continue
            for path in sorted(candidate for candidate in base.rglob("*") if candidate.is_file()):
                found.append(
                    {
                        "path": path.relative_to(target_root).as_posix(),
                        "pattern": pattern,
                        "source": "filesystem",
                    }
                )
            continue
        exact = target_root / pattern
        if exact.exists():
            found.append({"path": pattern, "pattern": pattern, "source": "filesystem"})
    return found


def collect_forbidden_manifest_declarations(target_root: Path) -> list[dict[str, str]]:
    manifest_path = target_root / ".loom/bootstrap/manifest.json"
    if not manifest_path.exists():
        return []
    try:
        manifest = read_json(manifest_path)
    except json.JSONDecodeError:
        return []
    artifacts = manifest.get("artifacts")
    declarations: list[dict[str, str]] = []
    if not isinstance(artifacts, list):
        return declarations
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        relative = normalize_relative_path(artifact.get("path"))
        if relative is None:
            continue
        carrier = forbidden_authored_carrier_for_path(relative)
        if carrier is not None:
            declarations.append({"path": relative, "pattern": carrier["path"], "source": "manifest.artifacts"})
    return declarations


def attach_only_forbidden_carrier_errors(target_root: Path, result: dict[str, object]) -> list[str]:
    findings = (
        collect_forbidden_authored_carrier_declarations(result)
        + collect_forbidden_manifest_declarations(target_root)
        + collect_forbidden_authored_carrier_files(target_root)
    )
    errors: list[str] = []
    seen: set[tuple[str, str, str]] = set()
    for finding in findings:
        key = (finding["source"], finding["path"], finding["pattern"])
        if key in seen:
            continue
        seen.add(key)
        errors.append(
            "attach-only forbidden authored carrier detected in "
            f"{finding['source']}: `{finding['path']}` matches `{finding['pattern']}`; "
            "this would create a second truth chain. Migrate it to the host truth locator, delete it, "
            "or explicitly rerun bootstrap with `--intent execution-control`."
        )
    return errors


def adoption_intent_payload(adoption_path: str, intake: dict[str, object]) -> dict[str, object]:
    requested = str(intake.get("adoption_intent", UNSPECIFIED_ADOPTION_INTENT))
    source = str(intake.get("adoption_intent_source", "unspecified"))
    return {
        "requested": requested,
        "effective": effective_adoption_intent(adoption_path, intake),
        "source": source,
        "requires_explicit_confirmation": requested == UNSPECIFIED_ADOPTION_INTENT and is_heavy_execution_path(adoption_path),
    }


def rule_refs_for_capabilities(scenario: str, adoption_path: str) -> list[dict[str, object]]:
    common = [
        {
            "name": "bootstrap/root",
            "rules": [
                "skills/loom-init/SKILL.md",
                "skills/loom-init/references/intake-signals.md",
                "skills/loom-init/references/output-contract.md",
            ],
        },
        {
            "name": "formal-templates",
            "rules": [
                "skills/shared/references/templates/spec-suite.md",
                "skills/shared/references/templates/pull-request.md",
            ],
        },
    ]
    if scenario == "new":
        common.append(
            {
                "name": "minimal-governance-entry",
                "rules": [
                    "skills/shared/references/governance/principles.md",
                    "skills/shared/references/governance/review-model.md",
                ],
            }
        )
    elif scenario in {"pre-execution-existing", "small-existing"}:
        common.append(
            {
                "name": "pre-execution-existing" if scenario == "pre-execution-existing" else "lightweight-retrofit",
                "rules": [
                    "skills/shared/references/adoption/lightweight-retrofit-default.md",
                    "skills/shared/references/adoption/routing-and-checkpoints.md",
                ],
            }
        )
    elif uses_attach_only_path(adoption_path):
        common.append(
            {
                "name": "deep-existing-repo",
                "rules": [
                    "skills/shared/references/adoption/deep-existing-repo-default.md",
                    "skills/shared/references/adoption/routing-and-checkpoints.md",
                    "skills/shared/references/harness/host-action-contract.md",
                ],
            }
        )
    else:
        common.append(
            {
                "name": "execution-support",
                "rules": [
                    "skills/shared/references/harness/work-item-contract.md",
                    "skills/shared/references/harness/recovery-model.md",
                    "skills/shared/references/harness/status-surface.md",
                    "skills/shared/references/harness/workspace-and-purity.md",
                ],
            }
        )
    return common


def deferred_capabilities(scenario: str, adoption_path: str, profile: str) -> list[dict[str, str]]:
    if profile == "light-governance":
        return [
            {
                "name": "loom-owned-work-item-progress-status-spec",
                "reason": "light-governance keeps first-round adoption to a companion, review guidance, and PR-template loop without Loom-owned execution carriers",
                "upgrade_trigger": "the repo explicitly opts into execution-control or needs Loom-owned work item, recovery, status, or spec carriers",
            },
            {
                "name": "host-gate-merge-closeout-control",
                "reason": "light-governance does not claim host merge, release, or closeout control",
                "upgrade_trigger": "required checks, merge-ready, or closeout must be consumed as Loom-owned gates",
            },
        ]
    if profile == "execution-control":
        return [
            {
                "name": "strong-governance-host-gates",
                "reason": "execution-control writes Loom-owned execution carriers but does not require host merge and closeout gates as a profile precondition",
                "upgrade_trigger": "host required checks, controlled merge, or closeout reconciliation become part of the adoption contract",
            }
        ]
    if scenario == "new":
        return [
            {
                "name": "full-status-surface",
                "reason": "no runnable system or multi-lane environment is visible yet",
                "upgrade_trigger": "a runtime lane, logs, metrics, or UI verification path becomes required",
            },
            {
                "name": "merge-checkpoint-hardening",
                "reason": "implementation has not entered regular merge flow yet",
                "upgrade_trigger": "multiple contributors or repeated merge reviews begin to consume the same facts",
            },
        ]
    if scenario in {"pre-execution-existing", "small-existing"}:
        return [
            {
                "name": "standard-recovery",
                "reason": "the repo still fits checkpoint-lite for low-cost recovery before execution-control intent is explicit",
                "upgrade_trigger": "recovery spans multiple rounds or more than one status carrier starts competing",
            },
            {
                "name": "full-workspace-purity",
                "reason": "lightweight retrofit is still the default path",
                "upgrade_trigger": "mixed work, shared boundaries, or review overload becomes structural",
            },
        ]
    if uses_attach_only_path(adoption_path):
        return [
            {
                "name": "loom-owned-recovery-carriers",
                "reason": "the first attach-only round must preserve repo-native carriers instead of generating Loom-owned recovery/status placeholders",
                "upgrade_trigger": "the repo needs Loom-owned recovery or status carriers to stabilize multi-round execution",
            },
            {
                "name": "typed-repo-companion-and-interop",
                "reason": "the first attach-only round only establishes the stable entry and read surface",
                "upgrade_trigger": "the repo needs typed gates, metadata contracts, host adapters, or shadow parity",
            },
        ]
    return [
        {
            "name": "host-specific-skill-regression-matrix",
            "reason": "Loom core should not absorb a full host test matrix",
            "upgrade_trigger": "a host adapter or marketplace package is added",
        }
    ]


def upgrade_triggers(deferred: list[dict[str, str]], profile: str) -> list[dict[str, str]]:
    return [
        {
            "from_profile": profile,
            "capability": item["name"],
            "trigger": item["upgrade_trigger"],
        }
        for item in deferred
        if item.get("upgrade_trigger")
    ]


def profile_common_artifacts() -> list[dict[str, str]]:
    artifacts: list[dict[str, str]] = [
        {"path": ".loom/README.md", "kind": "rule-entry", "source": "generated"},
        {"path": ".loom/bootstrap/intake.snapshot.json", "kind": "intake", "source": "generated"},
        {"path": ".loom/bootstrap/init-result.json", "kind": "init-result", "source": "generated"},
        {"path": ".loom/bootstrap/manifest.json", "kind": "manifest", "source": "generated"},
        {"path": ".loom/bootstrap/capability-map.md", "kind": "capability-map", "source": "generated"},
        {"path": ".loom/companion/README.md", "kind": "repo-companion-entry", "source": "generated"},
        {"path": ".loom/companion/manifest.json", "kind": "repo-companion-manifest", "source": "generated"},
        {"path": ".loom/companion/repo-interface.json", "kind": "repo-companion-interface", "source": "generated"},
        {"path": ".loom/companion/interop.json", "kind": "repo-interop-contract", "source": "generated"},
        {"path": ".loom/companion/checkpoints.md", "kind": "repo-companion-doc", "source": "generated"},
        {"path": ".loom/companion/review.md", "kind": "repo-companion-doc", "source": "generated"},
        {"path": ".loom/companion/merge-ready.md", "kind": "repo-companion-doc", "source": "generated"},
        {"path": ".loom/companion/closeout.md", "kind": "repo-companion-doc", "source": "generated"},
        {"path": ".loom/shadow/admission-loom.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".loom/shadow/admission-repo.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".loom/shadow/review-loom.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".loom/shadow/review-repo.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".loom/shadow/merge-ready-loom.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".loom/shadow/merge-ready-repo.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".loom/shadow/closeout-loom.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".loom/shadow/closeout-repo.json", "kind": "shadow-parity-surface", "source": "generated"},
        {"path": ".gitignore", "kind": "gitignore", "source": "generated"},
        runtime_artifact(".loom/bin/loom_init.py", "loom-tool", RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/fact_chain_support.py", "loom-tool-support", FACT_CHAIN_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/governance_surface.py", "loom-tool-support", GOVERNANCE_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/loom_flow.py", "loom-tool", FLOW_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/loom_status.py", "loom-tool", STATUS_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/runtime_paths.py", "loom-tool-support", "skills/shared/scripts/runtime_paths.py"),
        runtime_artifact(".loom/bin/runtime_state.py", "loom-tool-support", "skills/shared/scripts/runtime_state.py"),
        runtime_artifact(".loom/bin/loom_check.py", "loom-tool", CHECK_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/loom_story_carriers.py", "loom-tool", STORY_CARRIERS_RUNTIME_SOURCE),
    ]
    return artifacts


def profile_light_artifacts(target_root: Path) -> list[dict[str, str]]:
    artifacts: list[dict[str, str]] = []
    if not (target_root / "AGENTS.md").exists():
        artifacts.append({"path": "AGENTS.md", "kind": "root-entry", "source": "generated"})
    artifacts.extend(
        [
            {"path": ".loom/reviews/INIT-0001.json", "kind": "review-entry", "source": "generated"},
            {"path": ".loom/reviews/INIT-0001.spec.json", "kind": "review-entry", "source": "generated"},
        ]
    )
    return artifacts


def profile_execution_artifacts(target_root: Path) -> list[dict[str, str]]:
    artifacts = profile_light_artifacts(target_root)
    artifacts.extend(
        [
            {"path": ".loom/work-items/INIT-0001.md", "kind": "work-item", "source": "generated"},
            {"path": ".loom/progress/INIT-0001.md", "kind": "progress", "source": "generated"},
            {"path": ".loom/status/current.md", "kind": "status-surface", "source": "generated"},
            {"path": ".loom/stories/_template.md", "kind": "story-carrier-template", "source": "skills/shared/assets/templates/scaffold/user-story.md"},
            {"path": ".loom/specs/INIT-0001/spec.md", "kind": "spec", "source": "skills/shared/assets/templates/scaffold/spec.md"},
            {"path": ".loom/specs/INIT-0001/plan.md", "kind": "plan", "source": "skills/shared/assets/templates/scaffold/plan.md"},
            {
                "path": ".loom/specs/INIT-0001/implementation-contract.md",
                "kind": "implementation-contract",
                "source": "skills/shared/assets/templates/scaffold/implementation-contract.md",
            },
        ]
    )
    return artifacts


def artifact_paths(artifacts: list[dict[str, str]]) -> list[str]:
    return [artifact["path"] for artifact in artifacts]


def attach_only_artifact_paths(target_root: Path, install_pr_template: bool) -> list[str]:
    artifacts = [
        ".loom/README.md",
        ".loom/bootstrap/intake.snapshot.json",
        ".loom/bootstrap/init-result.json",
        ".loom/bootstrap/manifest.json",
        ".loom/bootstrap/capability-map.md",
        ".loom/companion/README.md",
        ".loom/companion/checkpoints.md",
        ".loom/companion/review.md",
        ".loom/companion/merge-ready.md",
        ".loom/companion/closeout.md",
        ".loom/bin/loom_init.py",
        ".loom/bin/fact_chain_support.py",
        ".loom/bin/governance_surface.py",
        ".loom/bin/loom_flow.py",
        ".loom/bin/runtime_paths.py",
        ".loom/bin/runtime_state.py",
        ".loom/bin/loom_check.py",
        ".loom/bin/loom_story_carriers.py",
    ]
    if install_pr_template or not (target_root / ".github/PULL_REQUEST_TEMPLATE.md").exists():
        artifacts.append(".github/PULL_REQUEST_TEMPLATE.md")
    return artifacts


def initial_work_items(
    scenario: str,
    target_root: Path,
    adoption_path: str,
    install_pr_template: bool,
    profile: str,
) -> list[dict[str, object]]:
    if adoption_path in NON_WRITABLE_ADOPTION_PATHS:
        return []
    if uses_attach_only_path(adoption_path):
        return [
            {
                "id": WORK_ITEM_ID,
                "goal": "Attach Loom to the existing governance stack without replacing root rules or host-owned actions",
                "scope": "Establish attach metadata, companion entry, and repo-local validation without generating Loom-owned recovery/status carriers",
                "execution_path": "recognize-and-attach",
                "workspace_entry": ".",
                "recovery_entry": "existing root rules and repo-native carriers",
                "review_entry": ".loom/companion/review.md",
                "validation_entry": "python3 .loom/bin/loom_init.py verify --target .",
                "artifacts": attach_only_artifact_paths(target_root, install_pr_template),
                "closing_condition": "The attach metadata, companion entry, and repo-local validation path are readable without generated Loom-owned recovery/status carriers",
                "post_build_continuation": "Extend the attached repo companion and interop surfaces without rewriting the retained host stack",
                "owner_for_checkpoint_lite": "repository owner or current attach operator",
            }
        ]
    artifacts = artifact_paths(initial_artifacts(target_root, install_pr_template, adoption_path, profile))
    if profile == "light-governance":
        return [
            {
                "id": WORK_ITEM_ID,
                "goal": "Establish the first lightweight Loom governance loop for this repository",
                "scope": "Create companion, review guidance, and PR template surfaces without Loom-owned execution carriers",
                "execution_path": "adoption/light-governance",
                "workspace_entry": ".",
                "recovery_entry": "checkpoint-lite issue or PR notes",
                "review_entry": ".loom/reviews/INIT-0001.json",
                "validation_entry": "python3 .loom/bin/loom_init.py verify --target .",
                "artifacts": artifacts,
                "closing_condition": "The companion entry, review guidance, PR template, and bootstrap metadata are readable without generated work/progress/status/spec carriers",
                "post_build_continuation": "Upgrade to execution-control only when the repo needs Loom-owned work item, recovery, status, or spec carriers",
                "owner_for_checkpoint_lite": "repository owner or current lightweight adoption operator",
            }
        ]
    return [
        {
            "id": WORK_ITEM_ID,
            "goal": "Bootstrap the first executable Loom path for this repository",
            "scope": "Establish rule entry, first work item, progress carrier, spec/plan, and verification entry",
            "execution_path": "bootstrap/root",
            "workspace_entry": ".",
            "recovery_entry": ".loom/progress/INIT-0001.md",
            "review_entry": ".loom/reviews/INIT-0001.json",
            "validation_entry": "python3 .loom/bin/loom_init.py verify --target .",
            "artifacts": artifacts,
            "closing_condition": "The generated entry, work item, recovery entry, and templates are readable and verified",
            "post_build_continuation": "Promote the first real downstream issue after the bootstrap artifacts are accepted",
            "owner_for_checkpoint_lite": "repository owner or current bootstrap operator",
        }
    ]


def initial_artifacts(target_root: Path, install_pr_template: bool, adoption_path: str, profile: str) -> list[dict[str, str]]:
    if not profile_writes_artifacts(profile):
        return []

    artifacts = profile_common_artifacts()
    if profile == "light-governance":
        artifacts.extend(profile_light_artifacts(target_root))
    elif profile in {"execution-control", "strong-governance"}:
        artifacts.extend(profile_execution_artifacts(target_root))
    if install_pr_template or not (target_root / ".github/PULL_REQUEST_TEMPLATE.md").exists():
        artifacts.append(
            {
                "path": ".github/PULL_REQUEST_TEMPLATE.md",
                "kind": "pr-template",
                "source": "skills/shared/assets/github/PULL_REQUEST_TEMPLATE.md",
            }
        )
    if not (target_root / "Makefile").exists():
        artifacts.append({"path": "Makefile", "kind": "repo-local-gate", "source": "generated"})
    return artifacts


def write_owner_for_path(path: str) -> str:
    if path.startswith(".loom/companion/") or path.startswith(".loom/shadow/"):
        return "repo-companion"
    if path.startswith(".loom/bin/"):
        return "loom-runtime"
    if path in {".github/PULL_REQUEST_TEMPLATE.md", ".gitignore"}:
        return "repo-owned"
    return "loom"


def append_planned_write(
    planned: list[dict[str, object]],
    seen: set[str],
    *,
    path: str,
    kind: str,
    adoption_path: str,
) -> None:
    if path in seen:
        return
    seen.add(path)
    planned.append(
        {
            "path": path,
            "kind": kind,
            "owner": write_owner_for_path(path),
            "requires_intent": (
                "execution-control"
                if is_heavy_execution_path(adoption_path)
                and path.startswith((".loom/work-items/", ".loom/progress/", ".loom/status/", ".loom/specs/", ".loom/stories/"))
                else None
            ),
        }
    )


def planned_write_targets(result: dict[str, object], adoption_path: str) -> list[dict[str, object]]:
    if adoption_path in NON_WRITABLE_ADOPTION_PATHS:
        return []
    artifacts = result.get("initial_artifacts")
    if not isinstance(artifacts, list):
        return []
    planned: list[dict[str, object]] = []
    seen: set[str] = set()
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        path = artifact.get("path")
        if not isinstance(path, str) or not path or path in seen:
            continue
        append_planned_write(
            planned,
            seen,
            path=path,
            kind=str(artifact.get("kind", "artifact")),
            adoption_path=adoption_path,
        )
    for path, kind in (
        (".loom/companion/README.md", "repo-companion-entry"),
        (".loom/companion/manifest.json", "repo-companion-manifest"),
        (".loom/companion/repo-interface.json", "repo-companion-interface"),
        (".loom/companion/interop.json", "repo-interop-contract"),
        (".loom/companion/checkpoints.md", "repo-companion-doc"),
        (".loom/companion/review.md", "repo-companion-doc"),
        (".loom/companion/merge-ready.md", "repo-companion-doc"),
        (".loom/companion/closeout.md", "repo-companion-doc"),
        (".loom/shadow/admission-loom.json", "shadow-parity-surface"),
        (".loom/shadow/admission-repo.json", "shadow-parity-surface"),
        (".loom/shadow/review-loom.json", "shadow-parity-surface"),
        (".loom/shadow/review-repo.json", "shadow-parity-surface"),
        (".loom/shadow/merge-ready-loom.json", "shadow-parity-surface"),
        (".loom/shadow/merge-ready-repo.json", "shadow-parity-surface"),
        (".loom/shadow/closeout-loom.json", "shadow-parity-surface"),
        (".loom/shadow/closeout-repo.json", "shadow-parity-surface"),
        (".gitignore", "gitignore"),
    ):
        append_planned_write(planned, seen, path=path, kind=kind, adoption_path=adoption_path)
    return planned


def intentionally_absent_targets(adoption_path: str, profile: str) -> list[dict[str, str]]:
    release_target_absent = {
        "path": ".loom/companion/releases/**",
        "reason": "release target truth stays absent until the repo declares release target intent",
    }
    if profile == "attach-only":
        return [
            {"path": ".loom/work-items/**", "reason": "attach-only preserves host-owned work item truth"},
            {"path": ".loom/progress/**", "reason": "attach-only preserves host-owned recovery truth"},
            {"path": ".loom/status/current.md", "reason": "attach-only does not author Loom status truth"},
            {"path": ".loom/reviews/**", "reason": "attach-only preserves host-owned review truth"},
            {"path": ".loom/specs/**", "reason": "attach-only does not author Loom execution specs"},
            {"path": ".loom/stories/**", "reason": "attach-only does not author Loom story carriers"},
            release_target_absent,
        ]
    if adoption_path == "defer":
        return [
            {"path": "*", "reason": "observe-only intent is read-only"},
            release_target_absent,
        ]
    if adoption_path == "skill-install-only":
        return [
            {"path": ".loom/work-items/**", "reason": "skill install does not adopt execution governance"},
            release_target_absent,
        ]
    if profile == "light-governance":
        return [
            {"path": ".loom/work-items/**", "reason": "light-governance does not author Loom work item truth"},
            {"path": ".loom/progress/**", "reason": "light-governance does not author Loom recovery truth"},
            {"path": ".loom/status/current.md", "reason": "light-governance does not author Loom status truth"},
            {"path": ".loom/specs/**", "reason": "light-governance keeps formal Loom specs deferred until execution-control"},
            {"path": ".loom/stories/**", "reason": "light-governance keeps story carriers deferred until execution-control"},
            release_target_absent,
        ]
    return [release_target_absent]


def risk_summary(adoption_path: str, intake: dict[str, object], planned: list[dict[str, object]]) -> dict[str, object]:
    heavy_writes = any(isinstance(item.get("requires_intent"), str) for item in planned)
    requested = str(intake.get("adoption_intent", UNSPECIFIED_ADOPTION_INTENT))
    requires_explicit_intent = requested == UNSPECIFIED_ADOPTION_INTENT and is_heavy_execution_path(adoption_path)
    repo_owned_truth_risk = "preserved" if uses_attach_only_path(adoption_path) else ("high" if heavy_writes else "low")
    missing_inputs: list[str] = []
    if adoption_path in NON_WRITABLE_ADOPTION_PATHS:
        missing_inputs.append(f"{adoption_path} does not write bootstrap artifacts")
    if requires_explicit_intent:
        missing_inputs.append("explicit --intent execution-control or --intent strong-governance is required before writing full-bootstrap carriers")
    return {
        "heavy_writes": heavy_writes,
        "repo_owned_truth_risk": repo_owned_truth_risk,
        "requires_explicit_intent": requires_explicit_intent,
        "missing_inputs": missing_inputs,
        "fallback_to": "adoption" if missing_inputs else None,
    }


def signal_default_adoption_intent(scenario: str, intake: dict[str, object]) -> str:
    signal_intake = dict(intake)
    signal_intake["adoption_intent"] = UNSPECIFIED_ADOPTION_INTENT
    signal_intake["adoption_intent_source"] = "unspecified"
    signal_path = recommended_adoption_path(scenario, signal_intake)
    return effective_adoption_intent(signal_path, signal_intake)


def reasonable_candidate_intents(scenario: str, intake: dict[str, object]) -> list[str]:
    repository_type = str(intake.get("repository_type", "unknown"))
    if repository_type != "existing":
        return ["light-governance", "execution-control"]
    if scenario == "complex-existing":
        return ["attach-only", "light-governance", "execution-control"]
    return ["light-governance", "execution-control"]


def existing_governance_signal_entries(target_root: Path, intake: dict[str, object]) -> list[dict[str, str]]:
    signals: list[dict[str, str]] = []
    for relative, summary in (
        ("AGENTS.md", "root agent rules are present"),
        ("README.md", "repository overview is present"),
        ("VISION.md", "vision or product direction is present"),
        ("WORKFLOW.md", "workflow guidance is present"),
        ("Makefile", "repository validation entry may be present"),
        (".github/workflows", "GitHub workflow surface is present"),
        ("docs", "documentation facts are present"),
    ):
        if (target_root / relative).exists():
            signals.append({"summary": summary, "locator": relative})
    if not signals:
        signals.append({"summary": "no stable governance signals were detected", "locator": "not_applicable"})
    maturity = intake.get("maturity")
    if isinstance(maturity, dict):
        signals.append(
            {
                "summary": (
                    "maturity: document_truth={document_truth}, execution_surface={execution_surface}, "
                    "governance_carriers={governance_carriers}"
                ).format(
                    document_truth=maturity.get("document_truth", "unknown"),
                    execution_surface=maturity.get("execution_surface", "unknown"),
                    governance_carriers=maturity.get("governance_carriers", "unknown"),
                ),
                "locator": ".loom/bootstrap/intake.snapshot.json",
            }
        )
    return signals


def candidate_intent_options(
    target_root: Path,
    scenario: str,
    intake: dict[str, object],
    install_pr_template: bool,
    signal_default: str,
) -> list[dict[str, object]]:
    options: list[dict[str, object]] = []
    for intent in reasonable_candidate_intents(scenario, intake):
        option_intake = dict(intake)
        option_intake["adoption_intent"] = intent
        option_intake["adoption_intent_source"] = "decision_prompt"
        path = recommended_adoption_path(scenario, option_intake)
        profile = scaffold_profile_key(path, option_intake)
        artifacts = initial_artifacts(target_root, install_pr_template, path, profile)
        planned = planned_write_targets({"initial_artifacts": artifacts}, path)
        heavy = any(isinstance(item.get("requires_intent"), str) for item in planned)
        options.append(
            {
                "intent": intent,
                "recommended_default": intent == signal_default,
                "adoption_path": path,
                "scaffold_profile": profile,
                "risk": {
                    "heavy_execution_control": heavy,
                    "repo_owned_truth": "preserved" if uses_attach_only_path(path) else ("loom-authored execution carriers" if heavy else "light governance carriers"),
                },
                "write_targets": [item.get("path") for item in planned if isinstance(item, dict) and isinstance(item.get("path"), str)],
                "verification_commands": ["python3 .loom/bin/loom_init.py verify --target ."],
            }
        )
    return options


def decision_prompt_payload(
    target_root: Path,
    scenario: str,
    intake: dict[str, object],
    result: dict[str, object],
    *,
    write_intent: str,
    planned: list[dict[str, object]],
) -> dict[str, object] | None:
    requested = str(intake.get("adoption_intent", UNSPECIFIED_ADOPTION_INTENT))
    source = str(intake.get("adoption_intent_source", "unspecified"))
    signal_default = signal_default_adoption_intent(scenario, intake)
    candidates = candidate_intent_options(target_root, scenario, intake, bool(result.get("install_pr_template", False)), signal_default)
    candidate_intents = {str(item.get("intent")) for item in candidates}
    heavy_planned = any(isinstance(item.get("requires_intent"), str) for item in planned)
    repository_type = str(intake.get("repository_type", "unknown"))
    divergent = requested != UNSPECIFIED_ADOPTION_INTENT and requested != signal_default
    ambiguous = repository_type == "existing" and len(candidate_intents) > 1
    needs_prompt = ambiguous or divergent or (requested == UNSPECIFIED_ADOPTION_INTENT and heavy_planned)
    if not needs_prompt:
        return None

    validation_entry = intake.get("repository_level_validation_entry")
    verification_commands = [
        "python3 .loom/bin/loom_init.py verify --target .",
        "python3 .loom/bin/loom_flow.py adopt verify --target .",
    ]
    planned_paths = [item.get("path") for item in planned if isinstance(item, dict) and isinstance(item.get("path"), str)]
    prompt = {
        "schema_version": "loom-adoption-decision-prompt/v1",
        "target_repository": str(target_root),
        "adoption_scope": {
            "scenario_key": scenario,
            "recommended_adoption_path": result.get("recommended_adoption", {}).get("path") if isinstance(result.get("recommended_adoption"), dict) else None,
            "scaffold_profile": result.get("scaffold_profile", {}).get("name") if isinstance(result.get("scaffold_profile"), dict) else None,
        },
        "write_intent": write_intent,
        "adoption_intent": {
            "requested": requested,
            "source": source,
            "signal_default": signal_default,
            "candidate_intents": sorted(candidate_intents),
            "options": candidates,
        },
        "repository_mode_guess": {
            "repository_type": repository_type,
            "scenario_key": scenario,
            "governance_surface_mode": result.get("governance_surface", {}).get("repository_mode") if isinstance(result.get("governance_surface"), dict) else "unknown",
        },
        "existing_governance_signals": existing_governance_signal_entries(target_root, intake),
        "existing_validation_entry": {
            "status": "present" if validation_entry else "missing",
            "locator": str(validation_entry) if validation_entry else "not_applicable",
        },
        "companion_boundary_intent": {
            "action": "generate_or_update" if any(str(path).startswith(".loom/companion/") for path in planned_paths) else "preserve",
            "locator": ".loom/companion/README.md",
        },
        "interop_boundary_intent": {
            "action": "generate_or_update" if ".loom/companion/interop.json" in planned_paths else "preserve",
            "locator": ".loom/companion/interop.json",
        },
        "repo_owned_residue": [
            {"summary": "root rules and repo-native validation remain repo-owned", "locator": "AGENTS.md"},
            {"summary": "host actions and review systems are read through companion or interop when present", "locator": ".loom/companion/repo-interface.json"},
        ],
        "decision_reason": (
            "explicit adoption intent diverges from the repository signal default"
            if divergent
            else "multiple adoption intents remain reasonable for the detected repository signals"
            if ambiguous
            else "heavy execution-control carriers require explicit intent before write"
        ),
        "write_targets": planned_paths,
        "verification_commands": verification_commands,
        "resume_after_adoption_intent": {
            "writeback_targets": [".loom/bootstrap/intake.snapshot.json", ".loom/bootstrap/init-result.json"],
            "command": "rerun loom-init bootstrap with --intent <selected-intent>",
        },
        "field_writeback_contract": [
            {
                "field": field,
                "source_locator": "docs/adoption/zero-friction-adoption-contract.md#decision-prompt-fields",
                "reasoning": "decision prompt fields are structured so adoption can record the operator decision without creating a second truth source",
                "writeback_target": ".loom/bootstrap/init-result.json",
                "verification_evidence": "python3 .loom/bin/loom_init.py verify --target .",
            }
            for field in (
                "target_repository",
                "adoption_scope",
                "write_intent",
                "adoption_intent",
                "repository_mode_guess",
                "existing_governance_signals",
                "existing_validation_entry",
                "companion_boundary_intent",
                "interop_boundary_intent",
                "repo_owned_residue",
                "verification_commands",
                "resume_after_adoption_intent",
            )
        ],
    }
    return prompt


def adoption_decisions_from_prompt(prompt: dict[str, object]) -> dict[str, object]:
    intent = prompt.get("adoption_intent")
    requested = intent.get("requested") if isinstance(intent, dict) else UNSPECIFIED_ADOPTION_INTENT
    return {
        "schema_version": "loom-adoption-decisions/v1",
        "target_maturity": "adoption-intent",
        "summary": "Bootstrap decision prompt binds adoption intent selection to source locators, write targets, and verification evidence.",
        "judgments": [
            {
                "id": "adoption_intent_selection",
                "question": "Which adoption intent should this repository use for this bootstrap?",
                "source_locator": "docs/adoption/zero-friction-adoption-contract.md#decision-prompt-fields",
                "reasoning": str(prompt.get("decision_reason", "select an adoption intent before writing conflicting carriers")),
                "write_targets": prompt.get("write_targets", []),
                "verification_commands": prompt.get("verification_commands", []),
                "status": "missing" if requested == UNSPECIFIED_ADOPTION_INTENT else "answered",
            }
        ],
    }


def build_result(
    target_root: Path,
    scenario: str,
    intake: dict[str, object],
    install_pr_template: bool,
    *,
    write_intent: str = "dry-run",
) -> dict[str, object]:
    adoption_path = recommended_adoption_path(scenario, intake)
    profile = scaffold_profile_key(adoption_path, intake)
    attach_only = uses_attach_only_path(adoption_path)
    read_only_adoption = adoption_path in NON_WRITABLE_ADOPTION_PATHS
    has_work_item_carriers = profile_has_work_item_carriers(profile)
    main_problem = {
        "new": "the repository has no controlled Loom entry yet",
        "pre-execution-existing": "the repo has established document truth but no formed execution surface yet",
        "small-existing": "the repo has a baseline but still lacks a stable Loom adoption entry and explicit first artifacts",
        "complex-existing": (
            "the repo already has a mature governance stack, so Loom must attach to the existing root rules and retained host actions"
            if attach_only
            else "the repo needs execution support, recovery, and status carriers instead of more ad hoc guidance"
        ),
    }[scenario]

    reason = {
        "new": "the repo is still establishing its first baseline, so the bootstrap should create the smallest stable entry and first artifacts",
        "pre-execution-existing": "the repo already has product or architecture facts, so Loom should preserve those facts and add only a lightweight governance loop until execution intent is explicit",
        "small-existing": "the repo already has a baseline, so Loom should enter through companion artifacts instead of rewriting the root",
        "complex-existing": (
            "the repo already has stable root rules and validation entry, so Loom should recognize and attach instead of materializing replacement recovery and status carriers"
            if attach_only
            else "the repo shows execution-support pressure, so the bootstrap must materialize recovery and status carriers immediately"
        ),
    }[scenario]

    governance_surface = build_governance_surface(
        target_root,
        bootstrap_mode=True,
        scenario_override=scenario,
    )
    initial_artifact_list = initial_artifacts(target_root, install_pr_template, adoption_path, profile)
    result = {
        "schema_version": "loom-init-output/v1",
        "generator": {
            "tool": RUNTIME_SOURCE,
            "tool_version": TOOL_VERSION,
            "root_entry": "loom-init",
            "contract_version": CONTRACT_VERSION,
        },
        "run": {
            "target": str(target_root),
            "scenario": scenario_label(scenario),
            "scenario_key": scenario,
            "integration_mode": integration_mode(scenario),
            "recovery_mode": recovery_mode(scenario),
        },
        "intake": intake,
        "project_judgment": {
            "scenario": scenario_label(scenario),
            "intensity": intensity_label(scenario, intake),
            "primary_structural_problem": main_problem,
            "why_this_path": reason,
        },
        "recommended_adoption": {
            "path": adoption_path,
            "integration_mode": integration_mode(scenario),
            "recovery_mode": recovery_mode(scenario),
            "capabilities": rule_refs_for_capabilities(scenario, adoption_path),
        },
        "scaffold_profile": {
            "name": profile,
            "writes_artifacts": profile_writes_artifacts(profile),
            "writes_work_item_carriers": has_work_item_carriers,
            "description": {
                "observe-only": "read-only repository observation; no Loom adoption carriers are written",
                "skill-install-only": "skill/runtime installation intent without repository governance adoption carriers",
                "attach-only": "companion/read-surface attachment that preserves repo-owned execution truth",
                "light-governance": "companion, review guidance, and PR-template loop without Loom-owned work item/progress/status/spec carriers",
                "execution-control": "Loom-owned work item, progress, review, status, and spec carriers",
                "strong-governance": "execution-control surface prepared for host gates, required checks, merge, and closeout consumption",
            }[profile],
        },
        "deferred_capabilities": deferred_capabilities(scenario, adoption_path, profile),
        "fact_chain": (
            {
                "mode": "intent-only dry-run",
                "read_entry": "not_applicable",
                "entry_points": {
                    "current_item_id": "not_applicable",
                    "work_item": "not_applicable",
                    "recovery_entry": "not_applicable",
                    "status_surface": "not_applicable",
                },
            }
            if read_only_adoption
            else {
                "mode": "repo-native attach-only",
                "read_entry": "not_applicable",
                "entry_points": {
                    "current_item_id": WORK_ITEM_ID,
                    "work_item": "not_applicable",
                    "recovery_entry": "not_applicable",
                    "status_surface": "not_applicable",
                },
            }
            if attach_only
            else {
                "mode": "profile-guided light-governance",
                "read_entry": "not_applicable",
                "entry_points": {
                    "current_item_id": WORK_ITEM_ID,
                    "work_item": "not_applicable",
                    "recovery_entry": "not_applicable",
                    "status_surface": "not_applicable",
                },
            }
            if not has_work_item_carriers
            else {
                "mode": "work-item + recovery-entry + derived status-surface",
                "read_entry": "python3 .loom/bin/loom_init.py fact-chain --target .",
                "entry_points": {
                    "current_item_id": WORK_ITEM_ID,
                    "work_item": ".loom/work-items/INIT-0001.md",
                    "recovery_entry": ".loom/progress/INIT-0001.md",
                    "status_surface": ".loom/status/current.md",
                },
            }
        ),
        "initial_artifacts": initial_artifact_list,
        "initial_work_items": initial_work_items(scenario, target_root, adoption_path, install_pr_template, profile),
        "validation_and_closing": {
            "validation_entry": "python3 .loom/bin/loom_init.py verify --target .",
            "checkpoint_relationship": (
                [
                    "admission checkpoint confirms the attached companion entry and bootstrap metadata are readable",
                    "build checkpoint confirms the attach-only surfaces and repo-local validation entry are internally consistent",
                    "merge checkpoint should only pass after downstream repo truth, companion extensions, and release judgment align",
                ]
                if attach_only
                else [
                    "admission checkpoint confirms the companion entry, review guidance, bootstrap metadata, and PR template are readable",
                    "build checkpoint confirms generated light-governance surfaces are internally consistent",
                    "merge checkpoint remains repo-owned until the intent upgrades to execution-control or strong-governance",
                ]
                if profile == "light-governance"
                else [
                    "admission checkpoint confirms the bootstrap work item and first artifacts are readable",
                    "build checkpoint confirms generated carriers and templates are internally consistent",
                    "merge checkpoint should only pass after downstream repo truth, docs, and delivery state align",
                ]
            ),
            "clean_state": (
                "all generated attach-only Loom artifacts are readable, verified, and do not introduce Loom-authored work/progress/status/review/spec truth carriers"
                if attach_only
                else "all generated light-governance artifacts are readable, verified, and do not introduce Loom-owned work/progress/status/spec carriers"
                if profile == "light-governance"
                else "all generated Loom artifacts are readable, verified, and free of conflicting duplicates"
            ),
            "close_when": (
                [
                    "the target repo has a readable root rule entry and attached repo companion entry",
                    "the attach-only bootstrap metadata and repo-local validation path are verifiable",
                    "the bootstrap manifest, init-result, planned writes, and filesystem do not expose forbidden Loom-authored truth carriers",
                ]
                if attach_only
                else [
                    "the target repo has a readable Loom companion entry",
                    "the companion review guidance, lightweight review placeholders, and PR template exist",
                    "the bootstrap manifest and init-result are verifiable",
                ]
                if profile == "light-governance"
                else [
                    "the target repo has a readable root or companion Loom entry",
                    "the first work item, progress carrier, and spec/plan artifacts exist",
                    "the bootstrap manifest and init-result are verifiable",
                ]
            ),
        },
        "runtime_state": runtime_state_payload(target_root),
        "gitignore_policy": gitignore_policy_payload(target_root),
        "governance_surface": governance_surface,
        "lifecycle_expectations": workspace_lifecycle_expectations(governance_surface.get("workspace_profile")),
        "maturity_upgrade_path": init_maturity_upgrade_path(governance_surface),
        "install_pr_template": install_pr_template,
    }
    planned = planned_write_targets(result, adoption_path)
    deferred = result["deferred_capabilities"]
    result["detected_repository_mode"] = {
        "repository_type": intake.get("repository_type"),
        "scenario_key": scenario,
        "governance_surface_mode": governance_surface.get("repository_mode"),
        "maturity": intake.get("maturity"),
    }
    result["adoption_intent"] = adoption_intent_payload(adoption_path, intake)
    result["planned_writes"] = planned
    result["required_carriers"] = required_carriers_for_profile(initial_artifact_list, profile)
    result["intentionally_absent"] = intentionally_absent_targets(adoption_path, profile)
    result["forbidden_authored_carriers"] = forbidden_authored_carriers(profile)
    scaffold_profile = result.get("scaffold_profile")
    if isinstance(scaffold_profile, dict):
        scaffold_profile["required_carriers"] = result["required_carriers"]
        scaffold_profile["forbidden_authored_carriers"] = result["forbidden_authored_carriers"]
    result["upgrade_triggers"] = upgrade_triggers(deferred if isinstance(deferred, list) else [], profile)
    result["risk_summary"] = risk_summary(adoption_path, intake, planned)
    prompt = decision_prompt_payload(
        target_root,
        scenario,
        intake,
        result,
        write_intent=write_intent,
        planned=planned,
    )
    if prompt is not None:
        result["decision_prompt"] = prompt
        result["adoption_decisions"] = adoption_decisions_from_prompt(prompt)
    result.pop("install_pr_template", None)
    return result


def git_branch_name(target_root: Path) -> str | None:
    try:
        completed = subprocess.run(
            ["git", "-C", str(target_root), "rev-parse", "--abbrev-ref", "HEAD"],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    branch = completed.stdout.strip()
    if completed.returncode != 0 or not branch or branch == "HEAD":
        return None
    return branch


def portable_bootstrap_value(
    value: object,
    replacements: list[tuple[str, str]],
    current_branch: str | None,
    path: tuple[str, ...] = (),
) -> object:
    if isinstance(value, dict):
        return {
            key: portable_bootstrap_value(child, replacements, current_branch, path + (key,))
            for key, child in value.items()
        }
    if isinstance(value, list):
        return [portable_bootstrap_value(child, replacements, current_branch, path) for child in value]
    if not isinstance(value, str):
        return value
    if current_branch and value == current_branch and path[-1:] != ("default_branch",):
        return "${CURRENT_BRANCH}"
    portable = value
    for source, replacement in replacements:
        portable = portable.replace(source, replacement)
    return portable


def portable_bootstrap_result(result: dict[str, object], target_root: Path) -> dict[str, object]:
    replacement_inputs = [
        (str(target_root.resolve()), "${TARGET_ROOT}"),
        (os.environ.get("LOOM_SOURCE_REPO_ROOT", ""), "${SOURCE_REPO_ROOT}"),
        (os.environ.get("LOOM_INSTALLED_SKILLS_ROOT", ""), "${INSTALLED_SKILLS_ROOT}"),
    ]
    replacements = sorted(
        [(source, replacement) for source, replacement in replacement_inputs if source],
        key=lambda pair: len(pair[0]),
        reverse=True,
    )
    portable = portable_bootstrap_value(result, replacements, git_branch_name(target_root))
    assert isinstance(portable, dict)
    portable["portable_output"] = {
        "enabled": True,
        "path_placeholders": {
            "target_root": "${TARGET_ROOT}",
            "source_repo_root": "${SOURCE_REPO_ROOT}",
            "installed_skills_root": "${INSTALLED_SKILLS_ROOT}",
            "current_branch": "${CURRENT_BRANCH}",
        },
    }
    return portable


def init_maturity_upgrade_path(governance_surface: dict[str, object]) -> dict[str, object]:
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
    next_level = maturity.get("next")
    gate_rollout = maturity.get("gate_rollout")
    missing_by_level = maturity.get("missing_by_level")
    missing_details_by_level = maturity.get("missing_details_by_level")
    missing_inputs: list[object] = []
    missing_details: list[object] = []
    if isinstance(next_level, str):
        if isinstance(missing_by_level, dict) and isinstance(missing_by_level.get(next_level), list):
            missing_inputs = list(missing_by_level[next_level])
        if isinstance(missing_details_by_level, dict) and isinstance(missing_details_by_level.get(next_level), list):
            missing_details = list(missing_details_by_level[next_level])
    return {
        "result": "pass" if next_level is None else "block",
        "current": maturity.get("current"),
        "next": next_level,
        "missing_inputs": missing_inputs,
        "missing_details": missing_details,
        "fallback_to": None if next_level is None else "adoption",
        "upgrade_entry": (
            f"python3 .loom/bin/loom_flow.py governance-profile upgrade --target . --to {next_level} --dry-run"
            if isinstance(next_level, str)
            else None
        ),
        "validation_entries": [
            "python3 .loom/bin/loom_flow.py governance-profile status --target .",
            "python3 .loom/bin/loom_flow.py governance-profile upgrade-plan --target .",
        ],
        "gate_rollout": gate_rollout,
    }


def bootstrap_write_blockers(result: dict[str, object]) -> list[str]:
    risk = result.get("risk_summary")
    if not isinstance(risk, dict):
        return []
    missing = risk.get("missing_inputs")
    if isinstance(missing, list):
        return [str(item) for item in missing if str(item)]
    return []


def render_loom_readme(result: dict[str, object]) -> str:
    run = result["run"]
    profile = result.get("scaffold_profile")
    profile_name = str(profile.get("name")) if isinstance(profile, dict) else "execution-control"
    if profile_name == "attach-only":
        path_lines = (
            "- Repo companion entry: `.loom/companion/README.md`\n"
            "- Companion checkpoints: `.loom/companion/checkpoints.md`\n"
            "- Companion review surface: `.loom/companion/review.md`\n"
        )
    elif profile_name == "light-governance":
        path_lines = (
            "- Repo companion entry: `.loom/companion/README.md`\n"
            "- Review record: `.loom/reviews/INIT-0001.json`\n"
            "- Spec-review guidance: `.loom/reviews/INIT-0001.spec.json`\n"
        )
    else:
        path_lines = (
            "- First work item: `.loom/work-items/INIT-0001.md`\n"
            "- Progress carrier: `.loom/progress/INIT-0001.md`\n"
            "- Status surface: `.loom/status/current.md`\n"
        )
    return (
        "# Loom Bootstrap\n\n"
        f"This directory was generated by `{RUNTIME_SOURCE}`.\n\n"
        "## Current Path\n\n"
        f"- Scenario: {run['scenario']}\n"
        f"- Recommended adoption path: {result['recommended_adoption']['path']}\n"
        f"- Integration mode: {run['integration_mode']}\n"
        f"- Recovery mode: {run['recovery_mode']}\n\n"
        "## Main Entry Points\n\n"
        "- Bootstrap manifest: `.loom/bootstrap/manifest.json`\n"
        "- Bootstrap result: `.loom/bootstrap/init-result.json`\n"
        f"{path_lines}"
        "- Runtime-state entry: `.loom/bin/loom_init.py runtime-state --target .`\n"
        "- Daily execution CLI: `.loom/bin/loom_flow.py`\n"
        "- Unified status CLI: `.loom/bin/loom_status.py --target .`\n"
        "- Carrier verification: `.loom/bin/loom_init.py verify --target .`\n"
        "- Consumer validation chain: `loom_init verify -> governance-profile status -> runtime-parity validate -> shadow-parity`\n"
        "- Profile-aware check: `.loom/bin/loom_check.py --profile consumer .` validates consumer runtime/adoption surfaces; it is not the Loom source/distribution self-check.\n"
    )


def render_root_agents() -> str:
    return GENERATED_ROOT_ENTRY


def render_capability_map(result: dict[str, object]) -> str:
    lines = [
        "# Capability Map",
        "",
        "The bootstrap entry maps each enabled capability to Loom source-of-truth documents.",
        "",
    ]
    for capability in result["recommended_adoption"]["capabilities"]:
        lines.append(f"## {capability['name']}")
        lines.append("")
        for rule in capability["rules"]:
            lines.append(f"- `{rule}`")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_companion_readme(result: dict[str, object]) -> str:
    return (
        "# Repo Companion\n\n"
        "This companion entry attaches Loom to the existing repository governance surface.\n\n"
        "## Preserved Ownership\n\n"
        "- Root rules remain in the repository's existing boundary docs.\n"
        "- Retained host actions stay host-owned.\n"
        "- Repo-native carriers remain the source of truth until a later Loom interop slice stabilizes.\n\n"
        "## Loom Entry Surfaces\n\n"
        "- Review surface: `.loom/companion/review.md`\n"
        "- Merge-ready surface: `.loom/companion/merge-ready.md`\n"
        "- Closeout surface: `.loom/companion/closeout.md`\n"
        "- Checkpoints surface: `.loom/companion/checkpoints.md`\n"
    )


def render_companion_checkpoints() -> str:
    return (
        "# Companion Checkpoints\n\n"
        "- Admission: read the existing root rules and repo-native admission surface before entering implementation.\n"
        "- Build: preserve retained host actions and repo-native carriers; do not assume Loom-owned recovery/status carriers exist.\n"
        "- Merge-ready: consume companion extensions and host-owned gates without re-implementing the host lifecycle.\n"
    )


def render_companion_review() -> str:
    return (
        "# Companion Review Surface\n\n"
        "Use this file to attach repo-specific review requirements while keeping the repository's existing root rules authoritative.\n"
    )


def render_companion_merge_ready() -> str:
    return (
        "# Companion Merge-Ready Surface\n\n"
        "Use this file to summarize repo-specific merge-ready expectations without taking over host-owned merge controls.\n"
    )


def render_companion_closeout() -> str:
    return (
        "# Companion Closeout Surface\n\n"
        "Use this file to attach repo-specific closeout expectations while preserving the host-owned closeout controls and repo-native truth.\n"
    )


def companion_manifest_payload() -> dict[str, object]:
    return {
        "schema_version": "loom-repo-companion-manifest/v1",
        "companion_entry": ".loom/companion/README.md",
        "repo_interface": ".loom/companion/repo-interface.json",
    }


def repo_interface_payload(profile_name: str = "execution-control") -> dict[str, object]:
    payload: dict[str, object] = {
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
    }
    if profile_name == "attach-only":
        payload["host_truth_locators"] = ATTACH_ONLY_HOST_TRUTH_LOCATORS
    return payload


def repo_interop_payload() -> dict[str, object]:
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def shadow_evidence_payload(target_root: Path, *, source: str, value: str) -> dict[str, object]:
    source_path = target_root / source
    return {
        "result": value,
        "source_files": [source],
        "source_sha256": {source: sha256_file(source_path)},
    }


def render_work_item(result: dict[str, object]) -> str:
    item = result["initial_work_items"][0]
    return (
        f"# {item['id']}\n\n"
        "## Static Facts\n\n"
        f"- Item ID: {item['id']}\n"
        f"- Goal: {item['goal']}\n"
        f"- Scope: {item['scope']}\n"
        f"- Execution Path: {item['execution_path']}\n"
        f"- Workspace Entry: {item['workspace_entry']}\n"
        f"- Recovery Entry: {item['recovery_entry']}\n"
        f"- Review Entry: {item['review_entry']}\n"
        f"- Validation Entry: {item['validation_entry']}\n"
        f"- Closing Condition: {item['closing_condition']}\n\n"
        "## Associated Artifacts\n\n"
        + "\n".join(f"- `{artifact}`" for artifact in item["artifacts"])
        + "\n"
    )


def render_makefile() -> str:
    return (
        ".PHONY: loom-check loom-story-carriers-check loom-verify\n\n"
        "loom-check: loom-verify loom-story-carriers-check\n\n"
        "loom-verify:\n"
        "\tpython3 .loom/bin/loom_init.py verify --target .\n\n"
        "loom-story-carriers-check:\n"
        "\tpython3 .loom/bin/loom_story_carriers.py .\n"
    )


def render_progress(result: dict[str, object]) -> str:
    checkpoint = "admission checkpoint" if result["run"]["scenario_key"] != "complex-existing" else "build checkpoint"
    return (
        f"# {WORK_ITEM_ID} Progress\n\n"
        "## Dynamic Facts\n\n"
        f"- Item ID: {WORK_ITEM_ID}\n"
        f"- Current Checkpoint: {checkpoint}\n"
        "- Current Stop: Bootstrap artifacts have been generated and are awaiting downstream review.\n"
        "- Next Step: Accept the generated Loom entry and promote the first real repository work item.\n"
        "- Blockers: None recorded.\n"
        "- Latest Validation Summary: Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist.\n"
        "- Recovery Boundary: Bootstrap result at `.loom/bootstrap/init-result.json`; bootstrap manifest at `.loom/bootstrap/manifest.json`.\n"
        "- Current Lane: bootstrap verification only\n\n"
        "## Execution Ledger\n\n"
        "- Ledger Binding: recovery_entry\n"
        "- Plan Locator: .loom/specs/INIT-0001/plan.md\n"
        "- Acceptance Locator: .loom/specs/INIT-0001/spec.md\n"
        "- Validation Evidence Locator: python3 .loom/bin/loom_init.py verify --target .\n"
        "- Handoff Notes Locator: not_applicable\n"
        "- Evidence Freshness: current\n"
    )


def render_review_entry(result: dict[str, object]) -> str:
    item = result["initial_work_items"][0]
    profile = result.get("scaffold_profile")
    profile_name = str(profile.get("name")) if isinstance(profile, dict) else "execution-control"
    validation_summary = (
        "Bootstrap manifest exists; init-result JSON can be read mechanically; companion review guidance and PR template artifacts exist."
        if profile_name == "light-governance"
        else "Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist."
    )
    payload = {
        "schema_version": "loom-review/v1",
        "item_id": item["id"],
        "decision": "fallback",
        "kind": "general_review",
        "summary": "Bootstrap has not entered formal review yet.",
        "reviewer": "not yet assigned",
        "reviewed_head": "bootstrap-placeholder",
        "reviewed_validation_summary": validation_summary,
        "fallback_to": "admission",
        "blocking_issues": [
            "Formal review starts only after downstream work replaces the bootstrap placeholder item."
        ],
        "follow_ups": [
            "Record the first real semantic review before asking merge checkpoint to consume reviewer judgment."
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def render_spec_review_entry(result: dict[str, object]) -> str:
    item = result["initial_work_items"][0]
    profile = result.get("scaffold_profile")
    profile_name = str(profile.get("name")) if isinstance(profile, dict) else "execution-control"
    validation_summary = (
        "Bootstrap manifest exists; init-result JSON can be read mechanically; lightweight spec review is represented as review guidance until execution-control creates formal spec carriers."
        if profile_name == "light-governance"
        else "Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist."
    )
    blocking_issue = (
        "Spec review remains guidance-only until the repo uses a repo-owned spec locator or upgrades to execution-control."
        if profile_name == "light-governance"
        else "Spec gate remains open until the formal spec path receives its own review record."
    )
    follow_up = (
        "Keep spec review guidance tied to repo-owned locators, or upgrade to execution-control before creating formal Loom spec carriers."
        if profile_name == "light-governance"
        else "Record a spec_review decision before implementation review or merge-ready consumes the formal spec path."
    )
    payload = {
        "schema_version": "loom-review/v1",
        "item_id": item["id"],
        "decision": "fallback",
        "kind": "spec_review",
        "summary": "Formal spec review has not been completed yet.",
        "reviewer": "not yet assigned",
        "reviewed_head": "bootstrap-placeholder",
        "reviewed_validation_summary": validation_summary,
        "fallback_to": "admission",
        "blocking_issues": [blocking_issue],
        "follow_ups": [follow_up],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def default_runtime_evidence(result: dict[str, object]) -> dict[str, str]:
    item = result["initial_work_items"][0]
    return {
        "run_entry": "not_applicable",
        "logs_entry": "not_applicable",
        "diagnostics_entry": "not_applicable",
        "verification_entry": str(item["validation_entry"]),
        "lane_entry": "not_applicable",
    }


def render_status(result: dict[str, object]) -> str:
    item = result["initial_work_items"][0]
    fact_chain = result["fact_chain"]
    checkpoint = "admission checkpoint" if result["run"]["scenario_key"] != "complex-existing" else "build checkpoint"
    runtime_evidence = default_runtime_evidence(result)
    return (
        "# Current Status\n\n"
        "## Derived Fact Chain View\n\n"
        f"- Item ID: {item['id']}\n"
        f"- Goal: {item['goal']}\n"
        f"- Scope: {item['scope']}\n"
        f"- Execution Path: {item['execution_path']}\n"
        f"- Workspace Entry: {item['workspace_entry']}\n"
        f"- Recovery Entry: {item['recovery_entry']}\n"
        f"- Review Entry: {item['review_entry']}\n"
        f"- Validation Entry: {item['validation_entry']}\n"
        f"- Closing Condition: {item['closing_condition']}\n"
        f"- Current Checkpoint: {checkpoint}\n"
        "- Current Stop: Bootstrap artifacts have been generated and are awaiting downstream review.\n"
        "- Next Step: Accept the generated Loom entry and promote the first real repository work item.\n"
        "- Blockers: None recorded.\n"
        "- Latest Validation Summary: Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist.\n"
        "- Recovery Boundary: Bootstrap result at `.loom/bootstrap/init-result.json`; bootstrap manifest at `.loom/bootstrap/manifest.json`.\n"
        "- Current Lane: bootstrap verification only\n\n"
        "## Governance Status\n\n"
        "- Item Key: INIT-0001\n"
        "- Item Type: work_item\n"
        "- Phase: not_declared\n"
        "- FR: not_declared\n"
        "- Release: not_declared\n"
        "- Sprint: not_declared\n"
        "- Head SHA: bootstrap-placeholder\n"
        "- Status: planning\n"
        "- Spec Entry: .loom/specs/INIT-0001/spec.md\n"
        "- Plan Entry: .loom/specs/INIT-0001/plan.md\n"
        "- Implementation Contract Entry: .loom/specs/INIT-0001/implementation-contract.md\n"
        "- Spec Review Entry: .loom/reviews/INIT-0001.spec.json\n"
        "- Spec Review Status: pending\n"
        "- Review Head Status: bootstrap-placeholder\n"
        "- Merge Gate Status: pending\n\n"
        "## Runtime Evidence\n\n"
        f"- Run Entry: {runtime_evidence['run_entry']}\n"
        f"- Logs Entry: {runtime_evidence['logs_entry']}\n"
        f"- Diagnostics Entry: {runtime_evidence['diagnostics_entry']}\n"
        f"- Verification Entry: {runtime_evidence['verification_entry']}\n"
        f"- Lane Entry: {runtime_evidence['lane_entry']}\n\n"
        "## Sources\n\n"
        f"- Static Truth: {fact_chain['entry_points']['work_item']}\n"
        f"- Dynamic Truth: {fact_chain['entry_points']['recovery_entry']}\n"
        "- Locator Truth: .loom/bootstrap/init-result.json\n"
        f"- Fact Chain CLI: {fact_chain['read_entry']}\n"
    )


def copy_file(source: Path, target: Path, force: bool) -> bool:
    target.parent.mkdir(parents=True, exist_ok=True)
    content = source.read_text(encoding="utf-8")
    return write_text(target, content, force=force)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def runtime_artifact(path: str, kind: str, source: str) -> dict[str, str]:
    runtime_sources = {
        ".loom/bin/loom_init.py": Path(__file__),
        ".loom/bin/fact_chain_support.py": Path(__file__).with_name("fact_chain_support.py"),
        ".loom/bin/governance_surface.py": Path(__file__).with_name("governance_surface.py"),
        ".loom/bin/loom_flow.py": Path(__file__).with_name("loom_flow.py"),
        ".loom/bin/loom_status.py": Path(__file__).with_name("loom_status.py"),
        ".loom/bin/runtime_paths.py": Path(__file__).with_name("runtime_paths.py"),
        ".loom/bin/runtime_state.py": Path(__file__).with_name("runtime_state.py"),
        ".loom/bin/loom_check.py": Path(__file__).with_name("loom_check.py"),
        ".loom/bin/loom_story_carriers.py": Path(__file__).with_name("loom_story_carriers.py"),
    }
    source_path = runtime_sources[path]
    return {
        "path": path,
        "kind": kind,
        "source": source,
        "sha256": sha256_file(source_path),
    }


def manifest_payload(result: dict[str, object]) -> dict[str, object]:
    return {
        "schema_version": "loom-bootstrap-manifest/v1",
        "tool": RUNTIME_SOURCE,
        "tool_version": TOOL_VERSION,
        "root_entry": "loom-init",
        "contract_version": CONTRACT_VERSION,
        "output": ".loom/bootstrap/init-result.json",
        "artifacts": result["initial_artifacts"],
    }


def scaffold_target(
    target_root: Path,
    result: dict[str, object],
    output_path: Path,
    force: bool,
    install_pr_template: bool,
    repair_gitignore: bool,
) -> tuple[int, list[str]]:
    written = 0
    touched: list[str] = []
    profile = result.get("scaffold_profile")
    profile_name = str(profile.get("name")) if isinstance(profile, dict) else "execution-control"
    writes_light_loop = profile_name in {"light-governance", "execution-control", "strong-governance"}
    writes_work_item_carriers = profile_has_work_item_carriers(profile_name)
    writes_formal_spec_suite = writes_work_item_carriers
    if profile_name == "attach-only":
        forbidden_errors = attach_only_forbidden_carrier_errors(target_root, result)
        if forbidden_errors:
            raise RuntimeError("; ".join(forbidden_errors))
    if ensure_gitignore_has_runtime_ignores(target_root, repair_gitignore=repair_gitignore):
        written += 1
        touched.append(".gitignore")
    result["gitignore_policy"] = gitignore_policy_payload(target_root)

    writes: list[tuple[Path, str | dict[str, object], str]] = [
        (target_root / ".loom/README.md", render_loom_readme(result), "text"),
        (target_root / ".loom/bootstrap/intake.snapshot.json", result["intake"], "json"),
        (output_path, result, "json"),
        (target_root / ".loom/bootstrap/manifest.json", manifest_payload(result), "json"),
        (target_root / ".loom/bootstrap/capability-map.md", render_capability_map(result), "text"),
        (target_root / ".loom/companion/README.md", render_companion_readme(result), "text"),
        (target_root / ".loom/companion/manifest.json", companion_manifest_payload(), "json"),
        (target_root / ".loom/companion/repo-interface.json", repo_interface_payload(profile_name), "json"),
        (target_root / ".loom/companion/interop.json", repo_interop_payload(), "json"),
        (target_root / ".loom/companion/checkpoints.md", render_companion_checkpoints(), "text"),
        (target_root / ".loom/companion/review.md", render_companion_review(), "text"),
        (target_root / ".loom/companion/merge-ready.md", render_companion_merge_ready(), "text"),
        (target_root / ".loom/companion/closeout.md", render_companion_closeout(), "text"),
    ]
    if writes_light_loop:
        writes.extend(
            [
                (target_root / ".loom/reviews/INIT-0001.json", render_review_entry(result), "text"),
                (target_root / ".loom/reviews/INIT-0001.spec.json", render_spec_review_entry(result), "text"),
            ]
        )
    if writes_work_item_carriers:
        writes.extend(
            [
                (target_root / ".loom/work-items/INIT-0001.md", render_work_item(result), "text"),
                (target_root / ".loom/progress/INIT-0001.md", render_progress(result), "text"),
                (target_root / ".loom/status/current.md", render_status(result), "text"),
            ]
        )

    for path, payload, kind in writes:
        changed = write_json(path, payload, force=force) if kind == "json" else write_text(path, payload, force=force)
        if changed:
            written += 1
            touched.append(str(path.relative_to(target_root)))

    makefile_target = target_root / "Makefile"
    if not makefile_target.exists():
        if write_text(makefile_target, render_makefile(), force=force):
            written += 1
            touched.append("Makefile")

    for surface in SHADOW_PARITY_SURFACES:
        value = "done" if surface == "closeout" else "pass"
        for side in ("loom", "repo"):
            evidence_source = default_shadow_source(target_root, surface=surface, side=side)
            if evidence_source is None:
                continue
            relative = f".loom/shadow/{surface.replace('_', '-')}-{side}.json"
            path = target_root / relative
            payload = shadow_evidence_payload(target_root, source=evidence_source, value=value)
            if write_json(path, payload, force=force):
                written += 1
                touched.append(relative)

    for source, destination in (
        (Path(__file__), target_root / ".loom/bin/loom_init.py"),
        (Path(__file__).with_name("fact_chain_support.py"), target_root / ".loom/bin/fact_chain_support.py"),
        (Path(__file__).with_name("governance_surface.py"), target_root / ".loom/bin/governance_surface.py"),
        (Path(__file__).with_name("loom_flow.py"), target_root / ".loom/bin/loom_flow.py"),
        (Path(__file__).with_name("loom_status.py"), target_root / ".loom/bin/loom_status.py"),
        (Path(__file__).with_name("runtime_paths.py"), target_root / ".loom/bin/runtime_paths.py"),
        (Path(__file__).with_name("runtime_state.py"), target_root / ".loom/bin/runtime_state.py"),
        (Path(__file__).with_name("loom_check.py"), target_root / ".loom/bin/loom_check.py"),
        (Path(__file__).with_name("loom_story_carriers.py"), target_root / ".loom/bin/loom_story_carriers.py"),
    ):
        if copy_file(source, destination, force=force):
            written += 1
            touched.append(str(destination.relative_to(target_root)))
    if writes_formal_spec_suite:
        for source, destination in (
            (shared_asset(__file__, "templates/scaffold/spec.md"), target_root / ".loom/specs/INIT-0001/spec.md"),
            (shared_asset(__file__, "templates/scaffold/plan.md"), target_root / ".loom/specs/INIT-0001/plan.md"),
            (
                shared_asset(__file__, "templates/scaffold/implementation-contract.md"),
                target_root / ".loom/specs/INIT-0001/implementation-contract.md",
            ),
            (shared_asset(__file__, "templates/scaffold/user-story.md"), target_root / ".loom/stories/_template.md"),
        ):
            if copy_file(source, destination, force=force):
                written += 1
                touched.append(str(destination.relative_to(target_root)))

    pr_template_target = target_root / ".github/PULL_REQUEST_TEMPLATE.md"
    if install_pr_template or not pr_template_target.exists():
        if copy_file(shared_asset(__file__, "github/PULL_REQUEST_TEMPLATE.md"), pr_template_target, force=force):
            written += 1
            touched.append(str(pr_template_target.relative_to(target_root)))

    root_agents = target_root / "AGENTS.md"
    if writes_light_loop and not root_agents.exists():
        if write_text(root_agents, render_root_agents(), force=force):
            written += 1
            touched.append(str(root_agents.relative_to(target_root)))

    return written, touched


def verify_target(target_root: Path, output_path: Path) -> list[str]:
    errors: list[str] = []
    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        errors.extend(f"runtime-state: {message}" for message in runtime_state["missing_inputs"])

    current_item_id: str | None = None
    attach_only = False
    required_paths: list[str] = []
    if output_path.exists():
        try:
            result = read_json(output_path)
        except json.JSONDecodeError as exc:
            errors.append(f"invalid init-result JSON: {exc.msg}")
            return errors
        adoption = result.get("recommended_adoption")
        if isinstance(adoption, dict):
            attach_only = uses_attach_only_path(str(adoption.get("path", "")))
        scaffold_profile = result.get("scaffold_profile")
        profile_name = str(scaffold_profile.get("name")) if isinstance(scaffold_profile, dict) else (
            "attach-only" if attach_only else "execution-control"
        )
        initial_artifact_list = result.get("initial_artifacts")
        planned_writes = result.get("planned_writes")
        if isinstance(initial_artifact_list, list):
            required_paths = [
                str(item.get("path"))
                for item in initial_artifact_list
                if isinstance(item, dict) and isinstance(item.get("path"), str)
            ]
        elif isinstance(planned_writes, list):
            required_paths = [
                str(item.get("path"))
                for item in planned_writes
                if isinstance(item, dict) and isinstance(item.get("path"), str)
            ]
        else:
            required_paths = []
        for key in (
            "project_judgment",
            "recommended_adoption",
            "scaffold_profile",
            "adoption_intent",
            "detected_repository_mode",
            "risk_summary",
            "required_carriers",
            "planned_writes",
            "forbidden_authored_carriers",
            "deferred_capabilities",
            "upgrade_triggers",
            "fact_chain",
            "initial_artifacts",
            "initial_work_items",
            "runtime_state",
            "gitignore_policy",
            "maturity_upgrade_path",
            "validation_and_closing",
        ):
            if key not in result:
                errors.append(f"init-result is missing required section: {key}")
        gitignore_policy = gitignore_policy_payload(target_root)
        if gitignore_policy.get("blanket_loom_ignore") is True:
            errors.append(
                "blanket .loom gitignore hides stable Loom carriers; remove it or run bootstrap with "
                "--repair-gitignore to keep only runtime scratch/cache/tmp/local paths ignored"
            )
        git_visibility = stable_carrier_git_visibility(target_root, result)
        blocking_errors = git_visibility.get("blocking_errors")
        if isinstance(blocking_errors, list):
            errors.extend(str(error) for error in blocking_errors)
        initial_artifacts = result.get("initial_artifacts")
        if isinstance(initial_artifacts, list):
            for artifact in initial_artifacts:
                if not isinstance(artifact, dict):
                    errors.append("every initial artifact must be an object")
                    continue
                artifact_path = artifact.get("path")
                if not isinstance(artifact_path, str) or not artifact_path:
                    errors.append("every initial artifact must declare a non-empty `path`")
                    continue
                if not (target_root / artifact_path).exists():
                    errors.append(f"declared initial artifact is missing on disk: {artifact_path}")
        initial_work_items = result.get("initial_work_items")
        validated_work_items: list[dict[str, object]] = []
        if isinstance(initial_work_items, list):
            for work_item in initial_work_items:
                if not isinstance(work_item, dict):
                    errors.append("every initial work item must be an object")
                    continue
                for field in (
                    "id",
                    "goal",
                    "scope",
                    "execution_path",
                    "workspace_entry",
                    "recovery_entry",
                    "review_entry",
                    "validation_entry",
                    "closing_condition",
                ):
                    value = work_item.get(field)
                    if not isinstance(value, str) or not value:
                        errors.append(f"initial work item is missing required field: {field}")
                validated_work_items.append(work_item)
        if attach_only:
            fact_chain = result.get("fact_chain")
            if not isinstance(fact_chain, dict):
                errors.append("init-result is missing required section: fact_chain")
            else:
                if fact_chain.get("mode") != "repo-native attach-only":
                    errors.append("deep-existing-repo init-result must keep `fact_chain.mode = repo-native attach-only`")
                if fact_chain.get("read_entry") != "not_applicable":
                    errors.append("deep-existing-repo init-result must keep `fact_chain.read_entry = not_applicable`")
                entry_points = fact_chain.get("entry_points")
                if not isinstance(entry_points, dict):
                    errors.append("deep-existing-repo init-result must include fact_chain.entry_points")
                else:
                    for field in ("work_item", "recovery_entry", "status_surface"):
                        if entry_points.get(field) != "not_applicable":
                            errors.append(f"deep-existing-repo init-result must keep `fact_chain.entry_points.{field} = not_applicable`")
            declared_generated = {
                artifact.get("path")
                for artifact in result.get("initial_artifacts", [])
                if isinstance(artifact, dict) and isinstance(artifact.get("path"), str)
            }
            for forbidden in (".loom/work-items/INIT-0001.md", ".loom/progress/INIT-0001.md", ".loom/status/current.md"):
                if forbidden in declared_generated:
                    errors.append(f"deep-existing-repo bootstrap must not declare generated carrier `{forbidden}`")
            forbidden_profile = result.get("forbidden_authored_carriers")
            if not isinstance(forbidden_profile, list) or {
                str(item.get("path")) for item in forbidden_profile if isinstance(item, dict)
            } != {carrier["path"] for carrier in ATTACH_ONLY_FORBIDDEN_AUTHORED_CARRIERS}:
                errors.append("attach-only init-result must declare the full `forbidden_authored_carriers` profile list")
            errors.extend(attach_only_forbidden_carrier_errors(target_root, result))
        if profile_name == "light-governance":
            declared_generated = {
                artifact.get("path")
                for artifact in result.get("initial_artifacts", [])
                if isinstance(artifact, dict) and isinstance(artifact.get("path"), str)
            }
            planned_generated = {
                item.get("path")
                for item in result.get("planned_writes", [])
                if isinstance(item, dict) and isinstance(item.get("path"), str)
            }
            forbidden_patterns = (
                ".loom/work-items/**",
                ".loom/progress/**",
                ".loom/status/current.md",
                ".loom/specs/**",
            )
            for collection_name, paths in (("initial_artifacts", declared_generated), ("planned_writes", planned_generated)):
                for path in paths:
                    if not isinstance(path, str):
                        continue
                    if any(matches_forbidden_authored_carrier(path, pattern) for pattern in forbidden_patterns):
                        errors.append(f"light-governance bootstrap must not declare execution-control carrier `{path}` in {collection_name}")
            for path in (
                ".loom/work-items/INIT-0001.md",
                ".loom/progress/INIT-0001.md",
                ".loom/status/current.md",
                ".loom/specs/INIT-0001/spec.md",
                ".loom/specs/INIT-0001/plan.md",
                ".loom/specs/INIT-0001/implementation-contract.md",
            ):
                if (target_root / path).exists():
                    errors.append(f"light-governance bootstrap must not leave execution-control carrier on disk: {path}")

    for relative in required_paths:
        if not (target_root / relative).exists():
            errors.append(f"missing required artifact: {relative}")

    profile_writes_work_items = False
    if output_path.exists():
        try:
            result_for_profile = read_json(output_path)
            scaffold_profile = result_for_profile.get("scaffold_profile")
            profile_name = str(scaffold_profile.get("name")) if isinstance(scaffold_profile, dict) else (
                "attach-only" if attach_only else "execution-control"
            )
            profile_writes_work_items = profile_has_work_item_carriers(profile_name)
        except json.JSONDecodeError:
            profile_writes_work_items = not attach_only

    if profile_writes_work_items:
        fact_chain_report, fact_chain_errors = inspect_fact_chain(
            target_root,
            str(output_path.relative_to(target_root)),
        )
        if fact_chain_errors:
            errors.extend(f"fact-chain: {message}" for message in fact_chain_errors)
        elif not fact_chain_report:
            errors.append("fact-chain: no report was produced")
        elif output_path.exists():
            current_item_id = fact_chain_report["fact_chain"]["entry_points"]["current_item_id"]
            runtime_evidence_report = fact_chain_report.get("runtime_evidence")
            if not isinstance(runtime_evidence_report, dict):
                errors.append("fact-chain: missing runtime_evidence report")
            else:
                for field in (
                    "run_entry",
                    "logs_entry",
                    "diagnostics_entry",
                    "verification_entry",
                    "lane_entry",
                ):
                    if field not in runtime_evidence_report:
                        errors.append(f"fact-chain: runtime_evidence is missing `{field}`")
            bootstrap_work_item = next(
                (work_item for work_item in validated_work_items if work_item.get("id") == WORK_ITEM_ID),
                None,
            )
            if bootstrap_work_item is None:
                errors.append(f"init-result is missing the bootstrap work item `{WORK_ITEM_ID}`")
            elif current_item_id == WORK_ITEM_ID:
                expected_init_fields = {
                    "recovery_entry": fact_chain_report["fact_chain"]["entry_points"]["recovery_entry"],
                    "validation_entry": fact_chain_report["facts"]["validation_entry"]["value"],
                    "workspace_entry": fact_chain_report["facts"]["workspace_entry"]["value"],
                }
                for field, expected_value in expected_init_fields.items():
                    actual_value = bootstrap_work_item.get(field)
                    if actual_value != expected_value:
                        errors.append(
                            f"init-result bootstrap work item `{WORK_ITEM_ID}` has inconsistent `{field}`: "
                            f"expected `{expected_value}`, got `{actual_value}`"
                        )

    pr_template = target_root / ".github/PULL_REQUEST_TEMPLATE.md"
    if pr_template.exists():
        text = pr_template.read_text(encoding="utf-8")
        for needle in ("## Summary", "## Validation", "## Risks And Follow-ups", "## Related Work"):
            if needle not in text:
                errors.append(f"PR template is missing section: {needle}")

    flow_tool = target_root / ".loom/bin/loom_flow.py"
    if flow_tool.exists():
        commands: list[tuple[str, list[str], set[str]]] = [
            (
                "loom-init runtime-state",
                ["python3", ".loom/bin/loom_init.py", "runtime-state", "--target", "."],
                {"pass"},
            ),
        ]
        if profile_writes_work_items:
            commands.extend(
                [
                    (
                        "loom-flow fact-chain",
                        ["python3", ".loom/bin/loom_flow.py", "fact-chain", "--target", "."],
                        {"pass"},
                    ),
                    (
                        "loom-flow runtime-evidence",
                        ["python3", ".loom/bin/loom_flow.py", "runtime-evidence", "--target", "."],
                        {"pass"},
                    ),
                ]
            )
        if current_item_id and profile_writes_work_items:
            commands.extend(
                [
                    (
                        "loom-flow checkpoint admission",
                        [
                            "python3",
                            ".loom/bin/loom_flow.py",
                            "checkpoint",
                            "admission",
                            "--target",
                            ".",
                            "--item",
                            current_item_id,
                        ],
                        {"pass", "block", "fallback"},
                    ),
                    (
                        "loom-flow runtime-state",
                        [
                            "python3",
                            ".loom/bin/loom_flow.py",
                            "runtime-state",
                            "--target",
                            ".",
                            "--item",
                            current_item_id,
                        ],
                        {"pass"},
                    ),
                    (
                        "loom-flow state-check",
                        [
                            "python3",
                            ".loom/bin/loom_flow.py",
                            "state-check",
                            "--target",
                            ".",
                            "--item",
                            current_item_id,
                        ],
                        {"pass", "block"},
                    ),
                    (
                        "loom-flow workspace locate",
                        [
                            "python3",
                            ".loom/bin/loom_flow.py",
                            "workspace",
                            "locate",
                            "--target",
                            ".",
                            "--item",
                            current_item_id,
                        ],
                        {"pass", "block"},
                    ),
                    (
                        "loom-flow flow pre-review",
                        [
                            "python3",
                            ".loom/bin/loom_flow.py",
                            "flow",
                            "pre-review",
                            "--target",
                            ".",
                            "--item",
                            current_item_id,
                        ],
                        {"pass", "block", "fallback"},
                    ),
                ]
            )

        for label, command, allowed in commands:
            command_env = os.environ.copy()
            for key in ("LOOM_SOURCE_REPO_ROOT", "LOOM_INSTALLED_SKILLS_ROOT", "LOOM_RUNTIME_SCENE"):
                command_env.pop(key, None)
            result = subprocess.run(
                command,
                cwd=target_root,
                check=False,
                capture_output=True,
                text=True,
                env=command_env,
            )
            output = result.stdout.strip()
            if not output:
                detail = result.stderr.strip() or "no JSON output"
                errors.append(f"{label} failed: {detail}")
                continue
            try:
                payload = json.loads(output)
            except json.JSONDecodeError as exc:
                errors.append(f"{label} returned invalid JSON: {exc.msg}")
                continue
            if not isinstance(payload, dict):
                errors.append(f"{label} must return a JSON object")
                continue
            command_result = payload.get("result")
            if command_result not in allowed:
                errors.append(
                    f"{label} returned unexpected result `{command_result}` (allowed: {', '.join(sorted(allowed))})"
                )

    return errors


def bootstrap(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    if not target_root.exists():
        print(f"loom-init: target does not exist: {target_root}", file=sys.stderr)
        return 2
    if not target_root.is_dir():
        print(f"loom-init: target is not a directory: {target_root}", file=sys.stderr)
        return 2

    try:
        intake = load_or_detect_intake(target_root, args.intake, args.intent)
    except RuntimeError as exc:
        print(f"loom-init: {exc}", file=sys.stderr)
        return 2
    scenario = classify_scenario(intake, args.scenario)
    result = build_result(
        target_root,
        scenario,
        intake,
        args.install_pr_template,
        write_intent="write" if args.write else "dry-run",
    )
    try:
        output_path = resolve_output_path(target_root, args.output)
    except RuntimeError as exc:
        print(f"loom-init: {exc}", file=sys.stderr)
        return 2

    if args.write:
        blockers = bootstrap_write_blockers(result)
        if blockers:
            result["result"] = "block"
            result["summary"] = "bootstrap write requires an explicit adoption intent before creating the requested surface."
            result["missing_inputs"] = blockers
            result["fallback_to"] = "adoption"
            result["write"] = {"enabled": False, "written_files": 0, "touched": []}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 2
        gitignore_policy = gitignore_policy_payload(target_root)
        if gitignore_policy.get("blanket_loom_ignore") is True and not args.repair_gitignore:
            result["gitignore_policy"] = gitignore_policy
            result["result"] = "block"
            result["summary"] = "bootstrap write would hide stable Loom carriers behind a blanket .loom gitignore."
            result["missing_inputs"] = [
                "remove blanket .loom gitignore or rerun bootstrap with --repair-gitignore",
            ]
            result["fallback_to"] = "gitignore_repair"
            result["write"] = {"enabled": False, "written_files": 0, "touched": []}
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 2
        try:
            scaffold_result = portable_bootstrap_result(result, target_root) if args.portable_output else result
            written, touched = scaffold_target(
                target_root=target_root,
                result=scaffold_result,
                output_path=output_path,
                force=args.force,
                install_pr_template=args.install_pr_template,
                repair_gitignore=args.repair_gitignore,
            )
        except RuntimeError as exc:
            print(f"loom-init: {exc}", file=sys.stderr)
            return 2
        result["write"] = {
            "enabled": True,
            "written_files": written,
            "touched": touched,
        }
        result["governance_surface"] = build_governance_surface(
            target_root,
            bootstrap_mode=True,
            scenario_override=scenario,
        )
        if args.verify:
            errors = verify_target(target_root, output_path)
            result["verification"] = {"ok": not errors, "errors": errors}
            result["verification"]["git_visibility"] = stable_carrier_git_visibility(target_root, result)
            if errors:
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return 1
    else:
        result["write"] = {"enabled": False, "written_files": 0, "touched": []}

    output_result = portable_bootstrap_result(result, target_root) if args.portable_output else result
    print(json.dumps(output_result, ensure_ascii=False, indent=2))
    return 0


def verify(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    try:
        output_path = resolve_output_path(target_root, args.output)
    except RuntimeError as exc:
        print(f"loom-init: {exc}", file=sys.stderr)
        return 2
    runtime_state = runtime_state_payload(target_root)
    errors = verify_target(target_root, output_path)
    git_visibility: dict[str, object] | None = None
    if output_path.exists():
        try:
            payload = read_json(output_path)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict):
            git_visibility = stable_carrier_git_visibility(target_root, payload)
    if errors:
        response = {"ok": False, "errors": errors, "runtime_state": runtime_state}
        if git_visibility is not None:
            response["git_visibility"] = git_visibility
        print(json.dumps(response, ensure_ascii=False, indent=2))
        return 1
    response = {"ok": True, "target": str(target_root), "runtime_state": runtime_state}
    if git_visibility is not None:
        response["git_visibility"] = git_visibility
    print(
        json.dumps(
            response,
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def fact_chain(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    try:
        output_path = resolve_output_path(target_root, args.output)
    except RuntimeError as exc:
        print(f"loom-init: {exc}", file=sys.stderr)
        return 2
    if output_path.exists():
        try:
            result = read_json(output_path)
        except json.JSONDecodeError:
            result = {}
        adoption = result.get("recommended_adoption") if isinstance(result, dict) else None
        if isinstance(adoption, dict) and uses_attach_only_path(str(adoption.get("path", ""))):
            print(
                json.dumps(
                    {
                        "ok": False,
                        "errors": ["fact-chain is not available for `deep-existing-repo` attach-only bootstrap output"],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 1

    report, errors = inspect_fact_chain(target_root, str(output_path.relative_to(target_root)))
    if errors:
        print(json.dumps({"ok": False, "errors": errors}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps({"ok": True, **report}, ensure_ascii=False, indent=2))
    return 0


def runtime_state(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    payload = runtime_state_payload(target_root)
    print(
        json.dumps(
            {
                "command": "runtime-state",
                "result": payload["result"],
                "summary": payload["summary"],
                "missing_inputs": payload["missing_inputs"],
                "fallback_to": payload["fallback_to"],
                "runtime_state": payload,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if payload["result"] == "pass" else 1


def route(args: argparse.Namespace) -> int:
    target_root = Path(args.target).expanduser().resolve()
    if not target_root.exists():
        print(f"loom-init: target does not exist: {target_root}", file=sys.stderr)
        return 2
    if not target_root.is_dir():
        print(f"loom-init: target is not a directory: {target_root}", file=sys.stderr)
        return 2

    runtime_state = runtime_state_payload(target_root)
    if runtime_state["result"] != "pass":
        print(
            json.dumps(
                route_payload(
                    result="block",
                    selected_skill="loom-init",
                    mode="fallback",
                    matched_signals=[],
                    summary="cannot route because the Loom runtime state is inconsistent.",
                    missing_inputs=list(runtime_state["missing_inputs"]),
                    fallback_to=runtime_state["fallback_to"] or "loom-init",
                    runtime_state=runtime_state,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1

    registry_skill_ids, registry_error = load_registry_skill_ids()
    if registry_error:
        if runtime_state.get("carrier") == "bootstrapped-target-runtime":
            registry_skill_ids = tuple(sorted({"loom-init", *SKILL_SIGNAL_RULES.keys()}))
        else:
            print(
                json.dumps(
                    route_payload(
                        result="block",
                        selected_skill="loom-init",
                        mode="fallback",
                        matched_signals=[],
                        summary=f"cannot route because {registry_error}",
                        missing_inputs=["a valid installed registry"],
                        fallback_to="loom-init",
                        runtime_state=runtime_state,
                    ),
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 1

    if registry_error and runtime_state.get("carrier") == "bootstrapped-target-runtime":
        registry_error = None

    known_skills = set(registry_skill_ids or ())
    governance_surface: dict[str, object] | None = None

    def resolved_governance_surface() -> dict[str, object] | None:
        nonlocal governance_surface
        if governance_surface is not None:
            return governance_surface
        if not target_root.exists() or not target_root.is_dir():
            return None
        try:
            governance_surface = build_governance_surface(target_root)
        except OSError:
            governance_surface = None
        return governance_surface

    if args.skill:
        if args.skill not in known_skills:
            print(
                json.dumps(
                    route_payload(
                        result="block",
                        selected_skill="loom-init",
                        mode="explicit",
                        matched_signals=[],
                        summary=f"unknown skill `{args.skill}`",
                        missing_inputs=["a known skill id from the installed registry"],
                        fallback_to="loom-init",
                        runtime_state=runtime_state,
                    ),
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 1
        print(
            json.dumps(
                route_payload(
                    result="pass",
                    selected_skill=args.skill,
                    mode="explicit",
                    matched_signals=[],
                    summary=f"explicit skill `{args.skill}` selected",
                    missing_inputs=[],
                    fallback_to="loom-init",
                    governance_surface=resolved_governance_surface() if args.skill in {"loom-adopt", "loom-resume"} else None,
                    runtime_state=runtime_state,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    matches = match_route_signals(args.task)
    if len(matches) == 1:
        selected_skill, matched = next(iter(matches.items()))
        if selected_skill not in known_skills:
            print(
                json.dumps(
                    route_payload(
                        result="block",
                        selected_skill="loom-init",
                        mode="implicit",
                        matched_signals=matched,
                        summary=f"route table resolved to unknown registry skill `{selected_skill}`",
                        missing_inputs=["a registry entry aligned with skills/route-matrix.md"],
                        fallback_to="loom-init",
                        runtime_state=runtime_state,
                    ),
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 1
        print(
            json.dumps(
                route_payload(
                    result="pass",
                    selected_skill=selected_skill,
                    mode="implicit",
                    matched_signals=matched,
                    summary=f"task signals route to `{selected_skill}`",
                    missing_inputs=[],
                    fallback_to="loom-init",
                    governance_surface=(
                        resolved_governance_surface() if selected_skill in {"loom-adopt", "loom-resume"} else None
                    ),
                    runtime_state=runtime_state,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    if not matches:
        payload = route_payload(
            result="fallback",
            selected_skill="loom-init",
            mode="fallback",
            matched_signals=[],
            summary="task signals are insufficient for stable routing",
            missing_inputs=["one stable scenario signal such as adopt, resume, story, pre-review, spec-review, review, handoff, retire, or merge-ready"],
            fallback_to="loom-init",
            governance_surface=None,
            runtime_state=runtime_state,
        )
    else:
        all_matches = sorted({signal for matched in matches.values() for signal in matched})
        payload = route_payload(
            result="fallback",
            selected_skill="loom-init",
            mode="fallback",
            matched_signals=all_matches,
            summary=f"task signals matched multiple scenario skills: {', '.join(sorted(matches))}",
            missing_inputs=["a single dominant scenario signal or an explicit --skill"],
            fallback_to="loom-init",
            governance_surface=None,
            runtime_state=runtime_state,
        )
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.command == "bootstrap":
        return bootstrap(args)
    if args.command == "verify":
        return verify(args)
    if args.command == "fact-chain":
        return fact_chain(args)
    if args.command == "runtime-state":
        return runtime_state(args)
    return route(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
