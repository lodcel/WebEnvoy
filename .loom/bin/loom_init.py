#!/usr/bin/env python3
"""Minimal executable bootstrap entry for Loom adoption."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from fact_chain_support import inspect_fact_chain
from governance_surface import build_governance_surface, detect_repo_interface, workspace_lifecycle_expectations
from runtime_paths import registry_path, shared_asset
from runtime_state import detect_runtime_state

RUNTIME_SOURCE = "skills/shared/scripts/loom_init.py"
FLOW_RUNTIME_SOURCE = "skills/shared/scripts/loom_flow.py"
STATUS_RUNTIME_SOURCE = "skills/shared/scripts/loom_status.py"
CHECK_RUNTIME_SOURCE = "skills/shared/scripts/loom_check.py"
FACT_CHAIN_RUNTIME_SOURCE = "skills/shared/scripts/fact_chain_support.py"
GOVERNANCE_RUNTIME_SOURCE = "skills/shared/scripts/governance_surface.py"
TOOL_VERSION = "1.3.0"
CONTRACT_VERSION = "1.3.0"
WORK_ITEM_ID = "INIT-0001"
SHADOW_PARITY_SURFACES = ("admission", "review", "merge_ready", "closeout")

RUNTIME_ARTIFACT_SOURCES = {
    ".loom/bin/loom_init.py": RUNTIME_SOURCE,
    ".loom/bin/fact_chain_support.py": FACT_CHAIN_RUNTIME_SOURCE,
    ".loom/bin/governance_surface.py": GOVERNANCE_RUNTIME_SOURCE,
    ".loom/bin/loom_flow.py": FLOW_RUNTIME_SOURCE,
    ".loom/bin/loom_status.py": STATUS_RUNTIME_SOURCE,
    ".loom/bin/runtime_paths.py": "skills/shared/scripts/runtime_paths.py",
    ".loom/bin/runtime_state.py": "skills/shared/scripts/runtime_state.py",
    ".loom/bin/loom_check.py": CHECK_RUNTIME_SOURCE,
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
        "story-to-delivery",
        "product context",
        "acceptance scenarios",
        "actor specificity",
        "scenario coverage",
        "用户故事",
        "故事准入",
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
        choices=("auto", "new", "small-existing", "complex-existing"),
        help="Override scenario detection",
    )
    bootstrap.add_argument("--intake", help="Optional intake JSON file")
    bootstrap.add_argument(
        "--output",
        help="Output path for init-result.json relative to target root",
        default=".loom/bootstrap/init-result.json",
    )
    bootstrap.add_argument("--write", action="store_true", help="Write bootstrap artifacts into the target repo")
    bootstrap.add_argument("--verify", action="store_true", help="Verify written artifacts after scaffolding")
    bootstrap.add_argument("--force", action="store_true", help="Overwrite Loom-managed artifacts when needed")
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


def ensure_gitignore_has_loom(target_root: Path) -> bool:
    gitignore = target_root / ".gitignore"
    desired_line = ".loom/"
    if gitignore.exists():
        current = gitignore.read_text(encoding="utf-8")
        lines = current.splitlines()
        if desired_line in lines:
            return False
        new_content = current if current.endswith("\n") or not current else current + "\n"
        new_content += desired_line + "\n"
    else:
        new_content = desired_line + "\n"
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
    has_code = any((root / hint).exists() and not is_generated_path(root, root / hint) for hint in CODE_DIR_HINTS)
    if meaningful_entries <= 2 and not has_readme and not has_code:
        return "new"
    return "existing"


def load_or_detect_intake(root: Path, intake_path: str | None) -> dict[str, object]:
    if intake_path:
        payload = read_json(Path(intake_path).expanduser().resolve())
        payload.setdefault("schema_version", "loom-init-intake/v1")
        return payload

    repository_type = detect_repository_type(root)
    root_boundary_docs = detect_root_boundary(root)
    validation_entry = detect_validation_entry(root)
    payload = {
        "schema_version": "loom-init-intake/v1",
        "repository_type": repository_type,
        "root_boundary_docs": root_boundary_docs,
        "ci_or_basic_tests": detect_ci_or_tests(root),
        "repository_level_validation_entry": validation_entry,
        "primary_gap_category": detect_primary_gap(root, root_boundary_docs, validation_entry),
        "long_running_recovery_pain": detect_recovery_pain(root),
        "shared_contract_or_high_risk_boundary": detect_shared_or_high_risk(root),
        "purity_or_scope_signals": detect_purity(root),
        "merge_review_semantic_overload": detect_merge_review_overload(root, validation_entry),
        "notes": "autodetected by loom_init.py",
    }
    return payload


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
        "small-existing": "小型既有仓库",
        "complex-existing": "复杂既有仓库",
    }[scenario]


def intensity_label(scenario: str, intake: dict[str, object]) -> str:
    if scenario in {"new", "small-existing"}:
        return "轻量"
    if bool(intake["shared_contract_or_high_risk_boundary"]) or bool(intake["long_running_recovery_pain"]):
        return "强化"
    return "标准"


def integration_mode(scenario: str) -> str:
    return "root" if scenario == "new" else "companion"


def recovery_mode(scenario: str) -> str:
    return "checkpoint-lite" if scenario in {"new", "small-existing"} else "standard"


def recommended_adoption_path(scenario: str, intake: dict[str, object]) -> str:
    if scenario == "new":
        return "minimal-bootstrap"
    if scenario == "small-existing":
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
    elif scenario == "small-existing":
        common.append(
            {
                "name": "lightweight-retrofit",
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


def deferred_capabilities(scenario: str, adoption_path: str) -> list[dict[str, str]]:
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
    if scenario == "small-existing":
        return [
            {
                "name": "standard-recovery",
                "reason": "the repo still fits checkpoint-lite for low-cost recovery",
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
        ]
    return [
        {
            "name": "host-specific-skill-regression-matrix",
            "reason": "Loom core should not absorb a full host test matrix",
            "upgrade_trigger": "a host adapter or marketplace package is added",
        }
    ]


def attach_only_artifact_paths(target_root: Path, install_pr_template: bool) -> list[str]:
    artifacts = [
        ".loom/README.md",
        ".loom/bootstrap/intake.snapshot.json",
        ".loom/bootstrap/init-result.json",
        ".loom/bootstrap/manifest.json",
        ".loom/bootstrap/capability-map.md",
        ".loom/companion/README.md",
        ".loom/companion/manifest.json",
        ".loom/companion/repo-interface.json",
        ".loom/companion/interop.json",
        ".loom/companion/checkpoints.md",
        ".loom/companion/review.md",
        ".loom/companion/merge-ready.md",
        ".loom/companion/closeout.md",
        ".loom/bin/loom_init.py",
        ".loom/bin/fact_chain_support.py",
        ".loom/bin/governance_surface.py",
        ".loom/bin/loom_flow.py",
        ".loom/bin/loom_status.py",
        ".loom/bin/runtime_paths.py",
        ".loom/bin/runtime_state.py",
        ".loom/bin/loom_check.py",
        ".loom/shadow/admission-loom.json",
        ".loom/shadow/admission-repo.json",
        ".loom/shadow/review-loom.json",
        ".loom/shadow/review-repo.json",
        ".loom/shadow/merge-ready-loom.json",
        ".loom/shadow/merge-ready-repo.json",
        ".loom/shadow/closeout-loom.json",
        ".loom/shadow/closeout-repo.json",
    ]
    if install_pr_template or not (target_root / ".github/PULL_REQUEST_TEMPLATE.md").exists():
        artifacts.append(".github/PULL_REQUEST_TEMPLATE.md")
    return artifacts


def initial_work_items(scenario: str, target_root: Path, adoption_path: str, install_pr_template: bool) -> list[dict[str, object]]:
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
    artifacts = [
        ".loom/bootstrap/init-result.json",
        ".loom/work-items/INIT-0001.md",
        ".loom/progress/INIT-0001.md",
        ".loom/reviews/INIT-0001.json",
        ".loom/reviews/INIT-0001.spec.json",
        ".loom/status/current.md",
        ".loom/bin/loom_init.py",
        ".loom/bin/fact_chain_support.py",
        ".loom/bin/governance_surface.py",
        ".loom/bin/loom_flow.py",
        ".loom/bin/loom_status.py",
        ".loom/bin/runtime_paths.py",
        ".loom/bin/loom_check.py",
        ".loom/specs/INIT-0001/spec.md",
        ".loom/specs/INIT-0001/plan.md",
        ".loom/specs/INIT-0001/implementation-contract.md",
    ]
    if not (target_root / ".github/PULL_REQUEST_TEMPLATE.md").exists():
        artifacts.append(".github/PULL_REQUEST_TEMPLATE.md")
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


def initial_artifacts(target_root: Path, install_pr_template: bool, adoption_path: str) -> list[dict[str, str]]:
    artifacts = [
        {
            "path": ".loom/README.md",
            "kind": "rule-entry",
            "source": "generated",
        },
        {
            "path": ".loom/bootstrap/intake.snapshot.json",
            "kind": "intake",
            "source": "generated",
        },
        {
            "path": ".loom/bootstrap/init-result.json",
            "kind": "init-result",
            "source": "generated",
        },
        {
            "path": ".loom/bootstrap/manifest.json",
            "kind": "manifest",
            "source": "generated",
        },
        {
            "path": ".loom/bootstrap/capability-map.md",
            "kind": "capability-map",
            "source": "generated",
        },
        runtime_artifact(".loom/bin/loom_init.py", "loom-tool", RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/fact_chain_support.py", "loom-tool-support", FACT_CHAIN_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/governance_surface.py", "loom-tool-support", GOVERNANCE_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/loom_flow.py", "loom-tool", FLOW_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/loom_status.py", "loom-tool", STATUS_RUNTIME_SOURCE),
        runtime_artifact(".loom/bin/runtime_paths.py", "loom-tool-support", "skills/shared/scripts/runtime_paths.py"),
        runtime_artifact(".loom/bin/runtime_state.py", "loom-tool-support", "skills/shared/scripts/runtime_state.py"),
        runtime_artifact(".loom/bin/loom_check.py", "loom-tool", CHECK_RUNTIME_SOURCE),
    ]
    if uses_attach_only_path(adoption_path):
        artifacts.extend(
            [
                {
                    "path": ".loom/companion/README.md",
                    "kind": "repo-companion-entry",
                    "source": "generated",
                },
                {
                    "path": ".loom/companion/manifest.json",
                    "kind": "repo-companion-manifest",
                    "source": "generated",
                },
                {
                    "path": ".loom/companion/repo-interface.json",
                    "kind": "repo-companion-interface",
                    "source": "generated",
                },
                {
                    "path": ".loom/companion/interop.json",
                    "kind": "repo-companion-interop",
                    "source": "generated",
                },
                {
                    "path": ".loom/companion/checkpoints.md",
                    "kind": "repo-companion-doc",
                    "source": "generated",
                },
                {
                    "path": ".loom/companion/review.md",
                    "kind": "repo-companion-doc",
                    "source": "generated",
                },
                {
                    "path": ".loom/companion/merge-ready.md",
                    "kind": "repo-companion-doc",
                    "source": "generated",
                },
                {
                    "path": ".loom/companion/closeout.md",
                    "kind": "repo-companion-doc",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/admission-loom.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/admission-repo.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/review-loom.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/review-repo.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/merge-ready-loom.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/merge-ready-repo.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/closeout-loom.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
                {
                    "path": ".loom/shadow/closeout-repo.json",
                    "kind": "shadow-parity",
                    "source": "generated",
                },
            ]
        )
    else:
        artifacts.extend(
            [
                {
                    "path": "AGENTS.md",
                    "kind": "root-entry",
                    "source": "generated",
                },
                {
                    "path": ".loom/work-items/INIT-0001.md",
                    "kind": "work-item",
                    "source": "generated",
                },
                {
                    "path": ".loom/progress/INIT-0001.md",
                    "kind": "progress",
                    "source": "generated",
                },
                {
                    "path": ".loom/reviews/INIT-0001.json",
                    "kind": "review-entry",
                    "source": "generated",
                },
                {
                    "path": ".loom/reviews/INIT-0001.spec.json",
                    "kind": "review-entry",
                    "source": "generated",
                },
                {
                    "path": ".loom/status/current.md",
                    "kind": "status-surface",
                    "source": "generated",
                },
                {
                    "path": ".loom/specs/INIT-0001/spec.md",
                    "kind": "spec",
                    "source": "skills/shared/assets/templates/scaffold/spec.md",
                },
                {
                    "path": ".loom/specs/INIT-0001/plan.md",
                    "kind": "plan",
                    "source": "skills/shared/assets/templates/scaffold/plan.md",
                },
                {
                    "path": ".loom/specs/INIT-0001/implementation-contract.md",
                    "kind": "implementation-contract",
                    "source": "skills/shared/assets/templates/scaffold/implementation-contract.md",
                },
            ]
        )
    if install_pr_template or not (target_root / ".github/PULL_REQUEST_TEMPLATE.md").exists():
        artifacts.append(
            {
                "path": ".github/PULL_REQUEST_TEMPLATE.md",
                "kind": "pr-template",
                "source": "skills/shared/assets/github/PULL_REQUEST_TEMPLATE.md",
            }
        )
    return artifacts


def build_result(target_root: Path, scenario: str, intake: dict[str, object], install_pr_template: bool) -> dict[str, object]:
    adoption_path = recommended_adoption_path(scenario, intake)
    attach_only = uses_attach_only_path(adoption_path)
    main_problem = {
        "new": "the repository has no controlled Loom entry yet",
        "small-existing": "the repo has a baseline but still lacks a stable Loom adoption entry and explicit first artifacts",
        "complex-existing": (
            "the repo already has a mature governance stack, so Loom must attach to the existing root rules and retained host actions"
            if attach_only
            else "the repo needs execution support, recovery, and status carriers instead of more ad hoc guidance"
        ),
    }[scenario]

    reason = {
        "new": "the repo is still establishing its first baseline, so the bootstrap should create the smallest stable entry and first artifacts",
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
        "deferred_capabilities": deferred_capabilities(scenario, adoption_path),
        "fact_chain": (
            {
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
        "initial_artifacts": initial_artifacts(target_root, install_pr_template, adoption_path),
        "initial_work_items": initial_work_items(scenario, target_root, adoption_path, install_pr_template),
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
                    "admission checkpoint confirms the bootstrap work item and first artifacts are readable",
                    "build checkpoint confirms generated carriers and templates are internally consistent",
                    "merge checkpoint should only pass after downstream repo truth, docs, and delivery state align",
                ]
            ),
            "clean_state": (
                "all generated attach-only Loom artifacts are readable, verified, and do not introduce Loom-owned recovery/status placeholders"
                if attach_only
                else "all generated Loom artifacts are readable, verified, and free of conflicting duplicates"
            ),
            "close_when": (
                [
                    "the target repo has a readable root rule entry and attached repo companion entry",
                    "the attach-only bootstrap metadata and repo-local validation path are verifiable",
                    "the bootstrap manifest does not declare Loom-owned recovery/status carriers for this path",
                ]
                if attach_only
                else [
                    "the target repo has a readable root or companion Loom entry",
                    "the first work item, progress carrier, and spec/plan artifacts exist",
                    "the bootstrap manifest and init-result are verifiable",
                ]
            ),
        },
        "runtime_state": runtime_state_payload(target_root),
        "governance_surface": governance_surface,
        "lifecycle_expectations": workspace_lifecycle_expectations(governance_surface.get("workspace_profile")),
        "maturity_upgrade_path": init_maturity_upgrade_path(governance_surface),
    }
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


def render_loom_readme(result: dict[str, object]) -> str:
    run = result["run"]
    attach_only = uses_attach_only_path(str(result["recommended_adoption"]["path"]))
    path_lines = (
        "- Repo companion entry: `.loom/companion/README.md`\n"
        "- Companion checkpoints: `.loom/companion/checkpoints.md`\n"
        "- Companion review surface: `.loom/companion/review.md`\n"
        if attach_only
        else "- First work item: `.loom/work-items/INIT-0001.md`\n"
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
        "- Verify entry: `python3 .loom/bin/loom_init.py verify --target .`\n"
        "- Runtime-state entry: `python3 .loom/bin/loom_init.py runtime-state --target .`\n"
        "- Gate entry: `python3 .loom/bin/loom_check.py .`\n"
        + (
            "- Fact-chain/status entry: deferred for attach-only adoption; WebEnvoy keeps repo-native carriers until a later Loom handoff/resume phase.\n"
            if attach_only
            else "- Unified status CLI: `python3 .loom/bin/loom_status.py --target .`\n"
        )
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


def repo_interface_payload() -> dict[str, object]:
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


def existing_json_or_default(path: Path, fallback: dict[str, object]) -> dict[str, object]:
    if not path.exists():
        return fallback
    try:
        payload = read_json(path)
    except json.JSONDecodeError:
        return fallback
    return payload if isinstance(payload, dict) else fallback


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
    payload = {
        "schema_version": "loom-review/v1",
        "item_id": item["id"],
        "decision": "fallback",
        "kind": "general_review",
        "summary": "Bootstrap has not entered formal review yet.",
        "reviewer": "not yet assigned",
        "reviewed_head": "bootstrap-placeholder",
        "reviewed_validation_summary": "Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist.",
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
    payload = {
        "schema_version": "loom-review/v1",
        "item_id": item["id"],
        "decision": "fallback",
        "kind": "spec_review",
        "summary": "Formal spec review has not been completed yet.",
        "reviewer": "not yet assigned",
        "reviewed_head": "bootstrap-placeholder",
        "reviewed_validation_summary": "Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist.",
        "fallback_to": "admission",
        "blocking_issues": [
            "Spec gate remains open until the formal spec path receives its own review record."
        ],
        "follow_ups": [
            "Record a spec_review decision before implementation review or merge-ready consumes the formal spec path."
        ],
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
) -> tuple[int, list[str]]:
    written = 0
    touched: list[str] = []
    attach_only = uses_attach_only_path(str(result["recommended_adoption"]["path"]))
    repo_interface_contract = (
        existing_json_or_default(target_root / ".loom/companion/repo-interface.json", repo_interface_payload())
        if attach_only
        else repo_interface_payload()
    )
    repo_interop_contract = (
        existing_json_or_default(target_root / ".loom/companion/interop.json", repo_interop_payload())
        if attach_only
        else repo_interop_payload()
    )

    writes: list[tuple[Path, str | dict[str, object], str]] = [
        (target_root / ".loom/README.md", render_loom_readme(result), "text"),
        (target_root / ".loom/bootstrap/intake.snapshot.json", result["intake"], "json"),
        (output_path, result, "json"),
        (target_root / ".loom/bootstrap/manifest.json", manifest_payload(result), "json"),
        (target_root / ".loom/bootstrap/capability-map.md", render_capability_map(result), "text"),
        (target_root / ".loom/companion/README.md", render_companion_readme(result), "text"),
        (target_root / ".loom/companion/manifest.json", companion_manifest_payload(), "json"),
        (target_root / ".loom/companion/repo-interface.json", repo_interface_contract, "json"),
        (target_root / ".loom/companion/interop.json", repo_interop_contract, "json"),
        (target_root / ".loom/companion/checkpoints.md", render_companion_checkpoints(), "text"),
        (target_root / ".loom/companion/review.md", render_companion_review(), "text"),
        (target_root / ".loom/companion/merge-ready.md", render_companion_merge_ready(), "text"),
        (target_root / ".loom/companion/closeout.md", render_companion_closeout(), "text"),
        (target_root / ".loom/companion/releases/changelog.md", "# Changelog\n\n- Bootstrap release intake example.\n", "text"),
        (target_root / ".loom/companion/releases/release-notes.md", "# Release Notes\n\n- Bootstrap release target is ready for Loom-derived status consumption.\n", "text"),
        (target_root / ".loom/companion/releases/migration-notes.md", "# Migration Notes\n\n- not_applicable\n", "text"),
        (target_root / ".loom/companion/releases/rollback.md", "# Rollback Basis\n\n- Revert the companion-owned release target declaration and rerun Loom checks.\n", "text"),
        (
            target_root / ".loom/companion/releases/catalog.json",
            {
                "schema_version": "loom-target-release-catalog/v1",
                "current_release_id": "bootstrap-v0.1.0",
                "releases": [{"release_id": "bootstrap-v0.1.0", "locator": ".loom/companion/releases/current.json"}],
            },
            "json",
        ),
        (
            target_root / ".loom/companion/releases/current.json",
            {
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
            "json",
        ),
        (
            target_root / ".loom/companion/releases/status.json",
            {
                "schema_version": "loom-target-release-status/v1",
                "result": "pass",
                "summary": "repo-owned release status example is readable.",
            },
            "json",
        ),
    ]
    if attach_only:
        pass
    else:
        writes.extend(
            [
                (target_root / ".loom/work-items/INIT-0001.md", render_work_item(result), "text"),
                (target_root / ".loom/progress/INIT-0001.md", render_progress(result), "text"),
                (target_root / ".loom/reviews/INIT-0001.json", render_review_entry(result), "text"),
                (target_root / ".loom/reviews/INIT-0001.spec.json", render_spec_review_entry(result), "text"),
                (target_root / ".loom/status/current.md", render_status(result), "text"),
            ]
        )

    for path, payload, kind in writes:
        changed = write_json(path, payload, force=force) if kind == "json" else write_text(path, payload, force=force)
        if changed:
            written += 1
            touched.append(str(path.relative_to(target_root)))

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
    ):
        if copy_file(source, destination, force=force):
            written += 1
            touched.append(str(destination.relative_to(target_root)))
    if not attach_only:
        for source, destination in (
            (shared_asset(__file__, "templates/scaffold/spec.md"), target_root / ".loom/specs/INIT-0001/spec.md"),
            (shared_asset(__file__, "templates/scaffold/plan.md"), target_root / ".loom/specs/INIT-0001/plan.md"),
            (
                shared_asset(__file__, "templates/scaffold/implementation-contract.md"),
                target_root / ".loom/specs/INIT-0001/implementation-contract.md",
            ),
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
    if not attach_only and not root_agents.exists():
        if write_text(root_agents, render_root_agents(), force=force):
            written += 1
            touched.append(str(root_agents.relative_to(target_root)))

    if ensure_gitignore_has_loom(target_root):
        written += 1
        touched.append(".gitignore")

    return written, touched


def verify_companion_contracts(target_root: Path) -> list[str]:
    errors: list[str] = []
    repo_interface_surface, repo_interface_missing = detect_repo_interface(target_root)
    if repo_interface_surface.get("availability") != "present":
        errors.append("repo-interface must be present according to governance_surface")
    errors.extend(f"governance_surface: {message}" for message in repo_interface_missing)

    def read_required_json(relative: str) -> dict[str, object] | None:
        path = target_root / relative
        try:
            payload = read_json(path)
        except FileNotFoundError:
            errors.append(f"missing companion contract: {relative}")
            return None
        except json.JSONDecodeError as exc:
            errors.append(f"invalid companion contract JSON `{relative}`: {exc.msg}")
            return None
        if not isinstance(payload, dict):
            errors.append(f"companion contract must be an object: {relative}")
            return None
        return payload

    manifest = read_required_json(".loom/companion/manifest.json")
    repo_interface = read_required_json(".loom/companion/repo-interface.json")
    interop = read_required_json(".loom/companion/interop.json")

    if manifest is not None:
        expected_manifest = {
            "schema_version": "loom-repo-companion-manifest/v1",
            "companion_entry": ".loom/companion/README.md",
            "repo_interface": ".loom/companion/repo-interface.json",
        }
        for field, expected in expected_manifest.items():
            if manifest.get(field) != expected:
                errors.append(f"companion manifest `{field}` must be `{expected}`")

    if repo_interface is not None:
        if repo_interface.get("schema_version") != "loom-repo-interface/v2":
            errors.append("repo-interface schema_version must be `loom-repo-interface/v2`")
        if repo_interface.get("companion_entry") != ".loom/companion/README.md":
            errors.append("repo-interface companion_entry must be `.loom/companion/README.md`")

        requirements = repo_interface.get("repo_specific_requirements")
        if not isinstance(requirements, dict):
            errors.append("repo-interface must declare `repo_specific_requirements`")
        else:
            for surface in ("review", "merge_ready", "closeout"):
                entries = requirements.get(surface)
                if not isinstance(entries, list) or not entries:
                    errors.append(f"repo-interface repo_specific_requirements.{surface} must be a non-empty list")
                    continue
                for entry in entries:
                    if not isinstance(entry, dict):
                        errors.append(f"repo-interface repo_specific_requirements.{surface} entries must be objects")
                        continue
                    for field in ("id", "summary", "locator", "enforcement"):
                        if not isinstance(entry.get(field), str) or not entry.get(field):
                            errors.append(f"repo-interface repo_specific_requirements.{surface} entry is missing `{field}`")
                    locator = entry.get("locator")
                    if isinstance(locator, str) and locator and not (target_root / locator).exists():
                        errors.append(f"repo-interface locator is missing on disk: {locator}")

        review_locators = repo_interface.get("review_instruction_locators")
        if not isinstance(review_locators, dict):
            errors.append("repo-interface must declare `review_instruction_locators`")
        else:
            expected_locators = {
                "spec_review": "spec_review.md",
                "implementation_review": "code_review.md",
            }
            for key, expected_locator in expected_locators.items():
                locator_entry = review_locators.get(key)
                if not isinstance(locator_entry, dict):
                    errors.append(f"repo-interface review_instruction_locators.{key} must be an object")
                    continue
                if locator_entry.get("mode") != "repo_declared":
                    errors.append(f"repo-interface review_instruction_locators.{key}.mode must be `repo_declared`")
                if locator_entry.get("locator") != expected_locator:
                    errors.append(f"repo-interface review_instruction_locators.{key}.locator must be `{expected_locator}`")
                if not (target_root / expected_locator).exists():
                    errors.append(f"review instruction locator is missing on disk: {expected_locator}")

        metadata_contract = repo_interface.get("metadata_contract")
        metadata_fields = metadata_contract.get("fields") if isinstance(metadata_contract, dict) else None
        field_ids = {field.get("id") for field in metadata_fields if isinstance(field, dict)} if isinstance(metadata_fields, list) else set()
        if not isinstance(metadata_fields, list) or not metadata_fields:
            errors.append("repo-interface metadata_contract.fields must be a non-empty list")
        elif isinstance(metadata_fields, list):
            for field in metadata_fields:
                if not isinstance(field, dict):
                    errors.append("repo-interface metadata_contract.fields entries must be objects")
                    continue
                for key in ("id", "summary", "applicability_locator", "authority_locator", "enforcement"):
                    if not isinstance(field.get(key), str) or not field.get(key):
                        errors.append(f"repo-interface metadata_contract.fields entry is missing `{key}`")
                if field.get("enforcement") not in ("blocking", "advisory"):
                    errors.append("repo-interface metadata_contract.fields enforcement must be `blocking` or `advisory`")
                for locator_key in ("applicability_locator", "authority_locator"):
                    locator = field.get(locator_key)
                    if isinstance(locator, str) and locator and not (target_root / locator).exists():
                        errors.append(f"repo-interface metadata {locator_key} is missing on disk: {locator}")
        for required_field in (
            "integration_check",
            "gate_applicability",
            "live_evidence_record",
            "closeout_control",
        ):
            if required_field not in field_ids:
                errors.append(f"repo-interface metadata_contract.fields must include `{required_field}`")

        specialized_gates = repo_interface.get("specialized_gates")
        if not isinstance(specialized_gates, list) or not specialized_gates:
            errors.append("repo-interface specialized_gates must be a non-empty list")
        else:
            gate_ids = {gate.get("id") for gate in specialized_gates if isinstance(gate, dict)}
            for required_gate in ("webenvoy-live-evidence-gate", "webenvoy-integration-check", "webenvoy-spec-review-gate"):
                if required_gate not in gate_ids:
                    errors.append(f"repo-interface specialized_gates must include `{required_gate}`")
            for gate in specialized_gates:
                if not isinstance(gate, dict):
                    errors.append("repo-interface specialized_gates entries must be objects")
                    continue
                for key in ("id", "summary", "locator", "gate_type"):
                    if not isinstance(gate.get(key), str) or not gate.get(key):
                        errors.append(f"repo-interface specialized_gates entry is missing `{key}`")
                locator = gate.get("locator")
                if isinstance(locator, str) and locator and not (target_root / locator).exists():
                    errors.append(f"repo-interface gate locator is missing on disk: {locator}")

        context_schema = repo_interface.get("context_schema")
        context_fields = context_schema.get("fields") if isinstance(context_schema, dict) else None
        if not isinstance(context_fields, list) or not context_fields:
            errors.append("repo-interface context_schema.fields must be a non-empty list")
        else:
            context_ids = {field.get("id") for field in context_fields if isinstance(field, dict)}
            for required_context in ("fr_suite", "github_progress_truth"):
                if required_context not in context_ids:
                    errors.append(f"repo-interface context_schema.fields must include `{required_context}`")
            for field in context_fields:
                if not isinstance(field, dict):
                    errors.append("repo-interface context_schema.fields entries must be objects")
                    continue
                for key in ("id", "summary", "type", "mapping_rule_locator"):
                    if not isinstance(field.get(key), str) or not field.get(key):
                        errors.append(f"repo-interface context_schema.fields entry is missing `{key}`")
                if field.get("type") not in ("string", "integer", "number", "boolean"):
                    errors.append("repo-interface context_schema.fields type must be one of `string`, `integer`, `number`, `boolean`")
                if not isinstance(field.get("required"), bool):
                    errors.append("repo-interface context_schema.fields required must be a boolean")
                locator = field.get("mapping_rule_locator")
                if isinstance(locator, str) and locator and not (target_root / locator).exists():
                    errors.append(f"repo-interface context mapping_rule_locator is missing on disk: {locator}")

        for optional_locator_list in ("dynamic_tool_locators", "policy_locators", "hook_locators"):
            if not isinstance(repo_interface.get(optional_locator_list), list):
                errors.append(f"repo-interface {optional_locator_list} must be a list")

    if interop is not None:
        if interop.get("schema_version") != "loom-repo-interop/v1":
            errors.append("interop schema_version must be `loom-repo-interop/v1`")
        carriers = interop.get("repo_native_carriers")
        if not isinstance(carriers, list) or not carriers:
            errors.append("interop must declare non-empty `repo_native_carriers`")
        else:
            for carrier in carriers:
                if not isinstance(carrier, dict):
                    errors.append("interop repo_native_carriers entries must be objects")
                    continue
                for key in ("id", "summary", "surfaces", "locator", "owner", "requirement", "fallback_to"):
                    if key == "surfaces":
                        surfaces = carrier.get(key)
                        if not isinstance(surfaces, list) or not all(isinstance(surface, str) and surface for surface in surfaces):
                            errors.append("interop repo_native_carriers.surfaces must be a non-empty string list")
                    elif not isinstance(carrier.get(key), str) or not carrier.get(key):
                        errors.append(f"interop repo_native_carriers entry is missing `{key}`")
                locator = carrier.get("locator")
                if isinstance(locator, str) and locator and not (target_root / locator).exists():
                    errors.append(f"interop repo-native carrier locator is missing on disk: {locator}")
        shadow_surfaces = interop.get("shadow_surfaces")
        if not isinstance(shadow_surfaces, dict):
            errors.append("interop must declare `shadow_surfaces`")
        else:
            for surface in ("admission", "review", "merge_ready", "closeout"):
                surface_payload = shadow_surfaces.get(surface)
                if not isinstance(surface_payload, dict):
                    errors.append(f"interop shadow_surfaces.{surface} must be an object")
                    continue
                for locator_field in ("loom_locator", "repo_locator"):
                    locator = surface_payload.get(locator_field)
                    if not isinstance(locator, str) or not locator:
                        errors.append(f"interop shadow_surfaces.{surface}.{locator_field} must be a non-empty string")
                    elif not (target_root / locator).exists():
                        errors.append(f"interop shadow surface locator is missing on disk: {locator}")
                    else:
                        errors.extend(verify_shadow_payload(target_root, locator))

    return errors


def read_required_bootstrap_manifest(target_root: Path, errors: list[str]) -> dict[str, object] | None:
    path = target_root / ".loom/bootstrap/manifest.json"
    try:
        payload = read_json(path)
    except FileNotFoundError:
        errors.append("missing bootstrap manifest: .loom/bootstrap/manifest.json")
        return None
    except json.JSONDecodeError as exc:
        errors.append(f"invalid bootstrap manifest JSON: {exc.msg}")
        return None
    if not isinstance(payload, dict):
        errors.append("bootstrap manifest must be an object")
        return None
    return payload


def verify_shadow_payload(target_root: Path, relative: str) -> list[str]:
    errors: list[str] = []
    path = target_root / relative
    try:
        payload = read_json(path)
    except FileNotFoundError:
        return [f"missing shadow payload: {relative}"]
    except json.JSONDecodeError as exc:
        return [f"invalid shadow payload JSON `{relative}`: {exc.msg}"]
    if not isinstance(payload, dict):
        return [f"shadow payload must be an object: {relative}"]

    source_files = payload.get("source_files")
    source_sha256 = payload.get("source_sha256")
    if not isinstance(source_files, list) or not source_files:
        errors.append(f"shadow payload `{relative}` must declare non-empty `source_files`")
        return errors
    if not all(isinstance(source, str) and source for source in source_files):
        errors.append(f"shadow payload `{relative}` source_files must be non-empty strings")
        return errors
    if not isinstance(source_sha256, dict):
        errors.append(f"shadow payload `{relative}` must declare `source_sha256`")
        return errors

    source_set = set(source_files)
    hash_set = {source for source in source_sha256 if isinstance(source, str)}
    if source_set != hash_set:
        errors.append(f"shadow payload `{relative}` source_sha256 keys must match source_files")
    for source in source_files:
        source_relative = Path(source)
        if source_relative.is_absolute() or ".." in source_relative.parts:
            errors.append(f"shadow payload `{relative}` source file must be repo-relative: {source}")
            continue
        source_path = (target_root / source_relative).resolve()
        try:
            source_path.relative_to(target_root.resolve())
        except ValueError:
            errors.append(f"shadow payload `{relative}` source file escapes repository: {source}")
            continue
        if not source_path.exists():
            errors.append(f"shadow payload `{relative}` source file is missing on disk: {source}")
            continue
        if not source_path.is_file():
            errors.append(f"shadow payload `{relative}` source file must be a regular file: {source}")
            continue
        expected = source_sha256.get(source)
        if not isinstance(expected, str) or not expected:
            errors.append(f"shadow payload `{relative}` source_sha256 missing hash for `{source}`")
            continue
        actual = sha256_file(source_path)
        if actual != expected:
            errors.append(f"shadow payload `{relative}` source_sha256 drifted for `{source}`")
    return errors


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
        required_paths = [
            ".loom/README.md",
            ".loom/bootstrap/intake.snapshot.json",
            str(output_path.relative_to(target_root)),
            ".loom/bootstrap/manifest.json",
            ".loom/bootstrap/capability-map.md",
            ".loom/bin/loom_init.py",
            ".loom/bin/fact_chain_support.py",
            ".loom/bin/governance_surface.py",
            ".loom/bin/loom_flow.py",
            ".loom/bin/runtime_paths.py",
            ".loom/bin/runtime_state.py",
            ".loom/bin/loom_check.py",
            ".loom/companion/README.md",
            ".loom/companion/manifest.json",
            ".loom/companion/repo-interface.json",
            ".loom/companion/interop.json",
            ".loom/companion/checkpoints.md",
            ".loom/companion/review.md",
            ".loom/companion/merge-ready.md",
            ".loom/companion/closeout.md",
            ".loom/shadow/admission-loom.json",
            ".loom/shadow/admission-repo.json",
            ".loom/shadow/review-loom.json",
            ".loom/shadow/review-repo.json",
            ".loom/shadow/merge-ready-loom.json",
            ".loom/shadow/merge-ready-repo.json",
            ".loom/shadow/closeout-loom.json",
            ".loom/shadow/closeout-repo.json",
        ]
        if attach_only:
            pass
        else:
            required_paths.extend(
                [
                    "AGENTS.md",
                    ".loom/work-items/INIT-0001.md",
                    ".loom/progress/INIT-0001.md",
                    ".loom/reviews/INIT-0001.json",
                    ".loom/status/current.md",
                    ".loom/specs/INIT-0001/spec.md",
                    ".loom/specs/INIT-0001/plan.md",
                    ".loom/specs/INIT-0001/implementation-contract.md",
                ]
            )
        for key in (
            "project_judgment",
            "recommended_adoption",
            "deferred_capabilities",
            "fact_chain",
            "initial_artifacts",
            "initial_work_items",
            "runtime_state",
            "maturity_upgrade_path",
            "validation_and_closing",
        ):
            if key not in result:
                errors.append(f"init-result is missing required section: {key}")
        initial_artifacts = result.get("initial_artifacts")
        initial_artifact_paths: set[str] = set()
        if isinstance(initial_artifacts, list):
            for artifact in initial_artifacts:
                if not isinstance(artifact, dict):
                    errors.append("every initial artifact must be an object")
                    continue
                artifact_path = artifact.get("path")
                if not isinstance(artifact_path, str) or not artifact_path:
                    errors.append("every initial artifact must declare a non-empty `path`")
                    continue
                initial_artifact_paths.add(artifact_path)
                if not (target_root / artifact_path).exists():
                    errors.append(f"declared initial artifact is missing on disk: {artifact_path}")
        bootstrap_manifest = read_required_bootstrap_manifest(target_root, errors)
        manifest_paths: set[str] = set()
        if bootstrap_manifest is not None:
            manifest_artifacts = bootstrap_manifest.get("artifacts")
            manifest_paths = (
                {artifact.get("path") for artifact in manifest_artifacts if isinstance(artifact, dict)}
                if isinstance(manifest_artifacts, list)
                else set()
            )
            for companion_contract in (
                ".loom/companion/manifest.json",
                ".loom/companion/repo-interface.json",
                ".loom/companion/interop.json",
            ):
                if companion_contract not in manifest_paths:
                    errors.append(f"bootstrap manifest artifacts must include `{companion_contract}`")
            if attach_only and manifest_paths != initial_artifact_paths:
                errors.append("attach-only bootstrap manifest artifacts must match init-result initial_artifacts")
        initial_work_items = result.get("initial_work_items")
        validated_work_items: list[dict[str, object]] = []
        if isinstance(initial_work_items, list):
            if not initial_work_items:
                errors.append("init-result initial_work_items must be a non-empty list")
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
                work_item_artifacts = work_item.get("artifacts")
                if not isinstance(work_item_artifacts, list) or not all(
                    isinstance(artifact, str) and artifact for artifact in work_item_artifacts
                ):
                    errors.append("initial work item must declare `artifacts` as a non-empty string list")
                elif attach_only and manifest_paths and set(work_item_artifacts) != manifest_paths:
                    errors.append("attach-only initial work item artifacts must match bootstrap manifest artifacts")
                validated_work_items.append(work_item)
        else:
            errors.append("init-result initial_work_items must be a non-empty list")
        if attach_only:
            errors.extend(verify_companion_contracts(target_root))
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

    for relative in required_paths:
        if not (target_root / relative).exists():
            errors.append(f"missing required artifact: {relative}")

    if not attach_only:
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
        required_sections = {
            "## Summary": ("## Summary", "## 摘要"),
            "## Validation": ("## Validation", "## 验证"),
            "## Risks And Follow-ups": ("## Risks And Follow-ups", "## 风险级别", "## 回滚"),
            "## Related Work": ("## Related Work", "## 关联事项"),
        }
        for canonical, accepted_headings in required_sections.items():
            if not any(heading in text for heading in accepted_headings):
                accepted = ", ".join(accepted_headings)
                errors.append(f"PR template is missing section equivalent for {canonical}: {accepted}")

    flow_tool = target_root / ".loom/bin/loom_flow.py"
    if flow_tool.exists():
        commands: list[tuple[str, list[str], set[str]]] = [
            (
                "loom-init runtime-state",
                ["python3", ".loom/bin/loom_init.py", "runtime-state", "--target", "."],
                {"pass"},
            ),
        ]
        if not attach_only:
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
        if current_item_id and not attach_only:
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

    intake = load_or_detect_intake(target_root, args.intake)
    scenario = classify_scenario(intake, args.scenario)
    result = build_result(target_root, scenario, intake, args.install_pr_template)
    try:
        output_path = resolve_output_path(target_root, args.output)
    except RuntimeError as exc:
        print(f"loom-init: {exc}", file=sys.stderr)
        return 2

    if args.write:
        try:
            scaffold_result = portable_bootstrap_result(result, target_root) if args.portable_output else result
            written, touched = scaffold_target(
                target_root=target_root,
                result=scaffold_result,
                output_path=output_path,
                force=args.force,
                install_pr_template=args.install_pr_template,
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
    if errors:
        print(json.dumps({"ok": False, "errors": errors, "runtime_state": runtime_state}, ensure_ascii=False, indent=2))
        return 1
    print(
        json.dumps(
            {"ok": True, "target": str(target_root), "runtime_state": runtime_state},
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
