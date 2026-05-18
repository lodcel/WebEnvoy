#!/usr/bin/env python3
"""Minimal Loom repository mechanical self-check."""

from __future__ import annotations

import re
import hashlib
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import json
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from fact_chain_support import inspect_fact_chain
import governance_surface as governance_surface_module
import loom_flow as loom_flow_module
import loom_status as loom_status_module
import runtime_state as runtime_state_module
from governance_surface import build_governance_surface
from loom_flow import allowed_post_review_carrier_paths, repo_specific_requirements_payload, review_head_binding
from runtime_paths import repo_local_root

DEFAULT_COMMAND_TIMEOUT_SECONDS = 30.0
ADOPT_VERIFY_TIMEOUT_SECONDS = 120.0

TOP_LEVEL_DIRS = (
    "docs",
    "examples",
    "packages",
    "plugins",
    "skills",
    "tools",
)

TOP_LEVEL_FILES = (
    "AGENTS.md",
    "LICENSE",
    "Makefile",
    "README.md",
    "VISION.md",
)

AREA_READMES = (
    "docs/adoption/README.md",
    "docs/methodology/governance/README.md",
    "docs/methodology/harness/README.md",
    "skills/README.md",
    "docs/methodology/templates/README.md",
)

CORE_DOCS = (
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/workflows/loom-check.yml",
    ".github/workflows/node-installer-pr.yml",
    ".github/workflows/node-installer-release.yml",
    "plugins/loom/.codex-plugin/plugin.json",
    "docs/adoption/codex-install.md",
    "docs/architecture/governance-design.md",
    "docs/architecture/harness-design.md",
    "docs/architecture/system-design.md",
    "docs/methodology/governance/principles.md",
    "docs/methodology/governance/review-model.md",
    "docs/methodology/governance/github-delivery-funnel.md",
    "docs/methodology/governance/story-intake.md",
    "docs/methodology/governance/spec-implementation-separation.md",
    "docs/methodology/governance/maturity-and-closing.md",
    "docs/methodology/governance/governance-maturity-model.md",
    "docs/methodology/governance/state-machine.md",
    "docs/methodology/governance/truth-and-sync-boundary.md",
    "docs/methodology/governance/host-object-taxonomy.md",
    "docs/methodology/harness/work-item-contract.md",
    "docs/methodology/harness/item-context-contract.md",
    "docs/methodology/harness/fact-chain-contract.md",
    "docs/methodology/harness/execution-attempt.md",
    "docs/methodology/harness/dynamic-tool-handshake.md",
    "docs/methodology/harness/external-orchestrator-interop.md",
    "docs/methodology/harness/structured-event-evidence.md",
    "docs/methodology/harness/execution-context.md",
    "docs/methodology/harness/execution-chain.md",
    "docs/methodology/harness/checkpoint-model.md",
    "docs/methodology/harness/workspace-model.md",
    "docs/methodology/harness/workspace-profile.md",
    "docs/methodology/harness/repo-local-gate-starter.md",
    "docs/methodology/harness/workspace-lifecycle.md",
    "docs/methodology/harness/worker-backend-contract.md",
    "docs/methodology/harness/host-action-contract.md",
    "docs/methodology/harness/host-api-budget.md",
    "docs/methodology/harness/host-lifecycle-boundary.md",
    "docs/methodology/harness/reconciliation-audit.md",
    "docs/methodology/harness/recovery-model.md",
    "docs/methodology/harness/review-execution.md",
    "docs/methodology/harness/status-surface.md",
    "docs/methodology/harness/automation-frontload.md",
    "docs/methodology/harness/merge-checkpoint.md",
    "docs/methodology/harness/closeout-gate.md",
    "docs/methodology/harness/gate-chain.md",
    "docs/methodology/harness/controlled-merge.md",
    "docs/methodology/harness/pr-merge-gate.md",
    "docs/methodology/harness/governance-failure-taxonomy.md",
    "docs/methodology/harness/workspace-and-purity.md",
    "docs/methodology/templates/spec-suite.md",
    "docs/methodology/templates/spec-template.md",
    "docs/methodology/templates/implementation-contract-template.md",
    "docs/methodology/templates/pull-request.md",
    "docs/evidence/extraction-ledger.md",
    "docs/evidence/landing-map.md",
    "docs/evidence/validations/validation-closeout-reconciliation-blocking-gate.md",
    "docs/evidence/validations/validation-adoption-maturity-upgrade-automation.md",
    "docs/evidence/validations/validation-adoption-maturity-required-fields.md",
    "docs/evidence/validations/validation-skills-consume-maturity-upgrade-path.md",
    "docs/evidence/validations/validation-adoption-gate-rollout.md",
    "docs/evidence/validations/validation-external-runtime-devendor-migration.md",
    "docs/evidence/validations/validation-syvert-adversarial-adoption-fixture.md",
    "docs/evidence/validations/validation-zero-friction-adoption-hardening.md",
    "docs/evidence/validations/validation-github-profile-binding-orchestration.md",
    "docs/evidence/validations/validation-github-profile-drift-reconciliation.md",
    "docs/evidence/validations/validation-github-profile-graphql-budget-guard.md",
    "docs/evidence/validations/validation-loom-core-runtime-parity.md",
    "docs/evidence/validations/validation-shadow-parity-blocking-gate.md",
    "docs/evidence/validations/validation-syvert-strong-governance-parity.md",
    "docs/evidence/validations/validation-syvert-reverse-consumption-smoke.md",
    "docs/evidence/syvert-residue-closeout.md",
    "docs/evidence/validations/validation-syvert-runtime-parity-release-judgment.md",
    "docs/adoption/rationale.md",
    "docs/adoption/routing-and-checkpoints.md",
    "docs/adoption/github-profile.md",
    "docs/adoption/github-profile-upgrade.md",
    "docs/adoption/ci-required-checks-bootstrap.md",
    "docs/adoption/external-runtime-companion-contract.md",
    "docs/adoption/lightweight-retrofit-default.md",
    "docs/adoption/repo-companion-contract.md",
    "docs/adoption/repo-interop-contract.md",
    "skills/distribution-and-adapter-contract.md",
    "skills/registry.json",
    "skills/install-layout.json",
    "skills/upgrade-contract.json",
    "skills/route-matrix.md",
    "skills/loom-init/SKILL.md",
    "skills/loom-init/contract.json",
    "skills/loom-init/references/input-signals.md",
    "skills/loom-init/references/intake-signals.md",
    "skills/loom-init/references/output-contract.md",
    "skills/loom-review/SKILL.md",
    "skills/loom-review/contract.json",
    "skills/loom-review/references/input-signals.md",
    "skills/loom-review/references/output-contract.md",
    "skills/loom-story/SKILL.md",
    "skills/loom-story/contract.json",
    "skills/loom-story/references/input-signals.md",
    "skills/loom-story/references/output-contract.md",
    "skills/loom-spec-review/SKILL.md",
    "skills/loom-spec-review/contract.json",
    "skills/loom-spec-review/references/input-signals.md",
    "skills/loom-spec-review/references/output-contract.md",
    "docs/methodology/templates/review-record.md",
    "docs/methodology/templates/scaffold/spec.md",
    "docs/methodology/templates/scaffold/plan.md",
    "docs/methodology/templates/scaffold/user-story.md",
    "tools/loom_status.py",
    "packages/loom-installer/README.md",
    "packages/loom-installer/package.json",
    "packages/loom-installer/package-lock.json",
    "packages/loom-installer/tsconfig.json",
    "packages/loom-installer/scripts/build-payload.mjs",
    "packages/loom-installer/scripts/check-doc-sync.mjs",
    "packages/loom-installer/scripts/check-payload-drift.mjs",
    "packages/loom-installer/scripts/check-version-bump.mjs",
    "packages/loom-installer/src/cli.ts",
    "packages/loom-installer/src/index.ts",
    "packages/loom-installer/test/installer.test.ts",
    "tools/loom_init.py",
    "tools/loom_flow.py",
)

AUTOMATION_FRONTLOAD_TEMPLATES = (
    "docs/methodology/templates/spec-suite.md",
    "docs/methodology/templates/scaffold/user-story.md",
    "docs/methodology/templates/spec-template.md",
    "docs/methodology/templates/implementation-contract-template.md",
    "docs/methodology/templates/pull-request.md",
)

AUTOMATION_FRONTLOAD_SKILLS = (
    "skills/README.md",
    "skills/distribution-and-adapter-contract.md",
    "skills/install-layout.json",
    "skills/route-matrix.md",
    "skills/loom-init/SKILL.md",
    "skills/loom-init/references/input-signals.md",
    "skills/loom-init/references/intake-signals.md",
    "skills/loom-init/references/output-contract.md",
    "skills/loom-story/SKILL.md",
    "skills/loom-story/references/input-signals.md",
    "skills/loom-story/references/output-contract.md",
    "skills/loom-spec-review/SKILL.md",
    "skills/loom-spec-review/references/input-signals.md",
    "skills/loom-spec-review/references/output-contract.md",
)

AUTOMATION_FRONTLOAD_EXECUTION_SUPPORT = (
    "docs/methodology/harness/work-item-contract.md",
    "docs/methodology/harness/execution-attempt.md",
    "docs/methodology/harness/dynamic-tool-handshake.md",
    "docs/methodology/harness/structured-event-evidence.md",
    "docs/methodology/harness/execution-context.md",
    "docs/methodology/harness/execution-chain.md",
    "docs/methodology/harness/checkpoint-model.md",
    "docs/methodology/harness/workspace-model.md",
    "docs/methodology/harness/workspace-profile.md",
    "docs/methodology/harness/repo-local-gate-starter.md",
    "docs/methodology/harness/workspace-lifecycle.md",
    "docs/methodology/harness/worker-backend-contract.md",
    "docs/methodology/harness/recovery-model.md",
    "docs/methodology/harness/status-surface.md",
    "docs/methodology/harness/automation-frontload.md",
    "docs/methodology/harness/merge-checkpoint.md",
    "docs/methodology/harness/workspace-and-purity.md",
)

GENERATED_TRACKED_PATHS = (
    "plugins/loom/skills",
    "packages/skills",
    "packages/loom-installer/payload",
)

DEMO_ASSETS = (
    "examples/new-project/.gitkeep",
    "examples/new-project/AGENTS.md",
    "examples/new-project/.github/PULL_REQUEST_TEMPLATE.md",
    "examples/new-project/.loom/bootstrap/init-result.json",
    "examples/new-project/.loom/bootstrap/manifest.json",
    "examples/new-project/.loom/work-items/INIT-0001.md",
    "examples/new-project/.loom/progress/INIT-0001.md",
    "examples/new-project/.loom/reviews/INIT-0001.json",
    "examples/new-project/.loom/reviews/INIT-0001.spec.json",
    "examples/new-project/.loom/status/current.md",
    "examples/new-project/.loom/bin/loom_init.py",
    "examples/new-project/.loom/bin/fact_chain_support.py",
    "examples/new-project/.loom/bin/runtime_paths.py",
    "examples/new-project/.loom/bin/runtime_state.py",
    "examples/new-project/.loom/bin/loom_flow.py",
    "examples/new-project/.loom/bin/loom_status.py",
    "examples/new-project/.loom/bin/loom_check.py",
    "examples/new-project/.loom/specs/INIT-0001/spec.md",
    "examples/new-project/.loom/specs/INIT-0001/plan.md",
    "examples/new-project/.loom/specs/INIT-0001/implementation-contract.md",
)

LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)(?:\s+#+\s*)?$")
CODE_FENCE_RE = re.compile(r"^(```|~~~)")
EXTERNAL_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


@dataclass(frozen=True)
class Failure:
    category: str
    detail: str


GOVERNANCE_SURFACE_ROUTE_SKILLS = {
    "loom-adopt",
    "loom-resume",
}

GOVERNANCE_SURFACE_CONTRACT_SKILLS = {
    "loom-adopt",
    "loom-resume",
}

REVIEW_FINDING_SEVERITIES = {"warn", "block"}
REVIEW_FINDING_DISPOSITION_STATUSES = {"accepted", "rejected", "deferred"}
REPO_INTERFACE_AVAILABILITY = {"absent", "companion_docs_only", "incomplete", "present"}
REPO_INTERFACE_ENFORCEMENT = {"blocking", "advisory"}
REPO_INTEROP_AVAILABILITY = {"absent", "incomplete", "present"}
DYNAMIC_TOOL_HANDSHAKE_STATUSES = {"advertised", "unavailable", "unsupported", "failed"}
POLICY_READ_STATUSES = {"declared", "missing", "conflict", "unsafe"}
POLICY_TYPES = {"approval", "sandbox"}
EVENT_EVIDENCE_SCHEMA = "loom-event-evidence/v1"
EVENT_EVIDENCE_TYPES = {"agent.step", "agent.tool", "tracker.state", "validation.result", "failure.observed"}
EVENT_EVIDENCE_RESULTS = {"pass", "fail", "block", "warn", "unavailable"}
EVENT_EVIDENCE_FORBIDDEN_AUTHORED_FIELDS = {
    "next_step",
    "blockers",
    "latest_validation_summary",
    "current_checkpoint",
    "recovery",
    "authored_truth",
}
EXECUTION_BUDGET_FIXTURE_SCHEMA = "loom-execution-budget-fixtures/v1"
EXECUTION_BUDGET_STABLE_FIELDS = {"schema_version", "status", "enforcement", "summary", "dimensions", "provenance", "adapter_evidence_locator"}
EXECUTION_BUDGET_DIMENSION_FIELDS = {"id", "unit", "used", "limit", "remaining", "risk", "source"}
EXECUTION_BUDGET_DIMENSION_IDS = set(governance_surface_module.LOOM_EXECUTION_BUDGET_DIMENSION_IDS)
EXECUTION_BUDGET_RISK_STABLE_FIELDS = {
    "schema_version",
    "status",
    "enforcement",
    "highest_risk",
    "risk_dimensions",
    "summary",
    "budget_summary",
    "adapter_evidence_locator",
    "provenance",
}
EXECUTION_BUDGET_STATUS = {"present", "not_applicable", "unavailable"}
EXECUTION_FAILURE_FIXTURE_SCHEMA = "loom-execution-failure-fixtures/v1"
RETRY_EVIDENCE_FIXTURE_SCHEMA = "loom-retry-evidence-fixtures/v1"
EXTERNAL_ORCHESTRATOR_FIXTURE_SCHEMA = "loom-external-orchestrator-interop-fixtures/v1"
EXTERNAL_ORCHESTRATOR_CONFORMANCE_FIXTURE_SCHEMA = "loom-external-orchestrator-conformance-fixtures/v1"
EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA = "loom-external-orchestrator-conformance/v1"
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
}


def repo_root_from_argv(argv: list[str]) -> Path:
    if len(argv) > 2:
        raise SystemExit("usage: loom_check.py [repo-root]")
    if len(argv) == 2:
        return Path(argv[1]).expanduser().resolve()
    hinted_root = repo_local_root(__file__)
    if hinted_root is not None:
        return hinted_root
    current = Path.cwd().resolve()
    if (current / "skills").exists() and (current / "README.md").exists():
        return current
    return Path(__file__).resolve().parent.parent


def check_required_paths(root: Path, category: str, paths: tuple[str, ...]) -> list[Failure]:
    failures: list[Failure] = []
    for relative_path in paths:
        if not (root / relative_path).exists():
            failures.append(Failure(category, f"missing `{relative_path}`"))
    return failures


def iter_markdown_files(root: Path) -> list[Path]:
    skipped_parts = {
        ".git",
        ".worktrees",
        "node_modules",
        "dist",
        "payload",
        "packages/skills",
        "plugins/loom",
    }
    results: list[Path] = []
    for path in root.rglob("*.md"):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if any(relative == part or relative.startswith(f"{part}/") for part in skipped_parts):
            continue
        if any(part.startswith(".payload-build-") for part in path.relative_to(root).parts):
            continue
        if relative.startswith("packages/loom-installer/payload/"):
            continue
        results.append(path)
    return sorted(results)


def split_link_target(raw_target: str) -> tuple[str, str]:
    target = raw_target.strip()
    if not target:
        return "", ""
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1].strip()
    if " " in target:
        target = target.split(" ", 1)[0]
    if "#" in target:
        path_part, fragment = target.split("#", 1)
        return path_part, fragment
    return target, ""


def markdown_links(path: Path) -> list[tuple[int, str]]:
    results: list[tuple[int, str]] = []
    in_code_fence = False
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if CODE_FENCE_RE.match(line.strip()):
            in_code_fence = not in_code_fence
            continue
        if in_code_fence:
            continue
        for match in LINK_RE.finditer(line):
            results.append((line_no, match.group(1)))
    return results


def strip_inline_markdown(text: str) -> str:
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_~]", "", text)
    return text


def github_anchor_map(path: Path, cache: dict[Path, set[str]]) -> set[str]:
    cached = cache.get(path)
    if cached is not None:
        return cached

    anchors: set[str] = set()
    duplicates: Counter[str] = Counter()
    in_code_fence = False
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if CODE_FENCE_RE.match(stripped):
            in_code_fence = not in_code_fence
            continue
        if in_code_fence:
            continue
        match = HEADING_RE.match(line)
        if not match:
            continue
        base = github_slug(strip_inline_markdown(match.group(2)))
        if not base:
            continue
        duplicates[base] += 1
        anchor = base if duplicates[base] == 1 else f"{base}-{duplicates[base] - 1}"
        anchors.add(anchor)

    cache[path] = anchors
    return anchors


def github_slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).lower().strip()
    slug_chars: list[str] = []
    last_was_dash = False
    for char in text:
        if char.isspace() or char == "-":
            if slug_chars and not last_was_dash:
                slug_chars.append("-")
                last_was_dash = True
            continue

        category = unicodedata.category(char)
        if category[0] in {"L", "N"} or category == "Mn":
            slug_chars.append(char)
            last_was_dash = False

    return "".join(slug_chars).strip("-")


def resolve_link_target(root: Path, source_path: Path, raw_target: str) -> tuple[Path | None, str]:
    target, fragment = split_link_target(raw_target)
    if not target:
        return source_path, fragment
    if EXTERNAL_SCHEME_RE.match(target) or target.startswith("//"):
        return None, ""
    if target.startswith("/"):
        return None, ""

    resolved = (source_path.parent / target).resolve()
    if resolved.exists():
        return resolved, fragment
    if resolved.is_dir():
        readme = resolved / "README.md"
        if readme.exists():
            return readme, fragment
    try:
        resolved.relative_to(root)
    except ValueError:
        return resolved, fragment
    return resolved, fragment


def check_markdown_links(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    anchor_cache: dict[Path, set[str]] = {}
    for markdown_path in iter_markdown_files(root):
        for line_no, raw_target in markdown_links(markdown_path):
            resolved, fragment = resolve_link_target(root, markdown_path, raw_target)
            if resolved is None:
                continue
            if not resolved.exists():
                detail = (
                    f"`{markdown_path.relative_to(root)}:{line_no}` -> `{raw_target}` "
                    f"(missing `{resolved.relative_to(root) if resolved.is_absolute() and is_within(resolved, root) else resolved}`)"
                )
                failures.append(Failure("markdown-links", detail))
                continue
            if fragment and resolved.suffix.lower() == ".md":
                anchors = github_anchor_map(resolved, anchor_cache)
                if fragment not in anchors:
                    detail = (
                        f"`{markdown_path.relative_to(root)}:{line_no}` -> `{raw_target}` "
                        f"(missing anchor `#{fragment}` in `{resolved.relative_to(root)}`)"
                    )
                    failures.append(Failure("markdown-links", detail))
    return failures


def load_json_file(path: Path) -> object:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def prune_fixture_work_items(target: Path, keep_item: str = "INIT-0001") -> None:
    """Keep copied self-check fixtures independent from this repo's active Work Items."""
    for directory in (
        target / ".loom/work-items",
        target / ".loom/progress",
        target / ".loom/reviews",
    ):
        if not directory.exists():
            continue
        for path in directory.glob("*"):
            if path.stem == keep_item or path.stem.startswith(f"{keep_item}."):
                continue
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()

    specs_dir = target / ".loom/specs"
    if specs_dir.exists():
        for path in specs_dir.iterdir():
            if path.name == keep_item:
                continue
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()


def run_command(
    root: Path,
    args: list[str],
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    timeout_seconds: float | None = None,
) -> subprocess.CompletedProcess[str]:
    command_env = os.environ.copy()
    for key in ("LOOM_SOURCE_REPO_ROOT", "LOOM_INSTALLED_SKILLS_ROOT", "LOOM_RUNTIME_SCENE"):
        command_env.pop(key, None)
    if env:
        command_env.update(env)
    return subprocess.run(
        args,
        cwd=cwd or root,
        check=False,
        capture_output=True,
        text=True,
        env=command_env,
        timeout=timeout_seconds,
    )


def command_timeout_seconds(args: list[str], requested_timeout_seconds: float | None) -> float:
    if requested_timeout_seconds is not None:
        return requested_timeout_seconds
    normalized = [str(part) for part in args]
    if "adopt" in normalized and "verify" in normalized:
        return ADOPT_VERIFY_TIMEOUT_SECONDS
    return DEFAULT_COMMAND_TIMEOUT_SECONDS


def host_executable(name: str) -> str:
    """Resolve a host executable while avoiding shims that depend on HOME."""
    found = shutil.which(name)
    if found and "/mise/shims/" not in found:
        return found
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        if not directory or "/mise/shims" in directory:
            continue
        candidate = Path(directory) / name
        if candidate.exists() and os.access(candidate, os.X_OK):
            return str(candidate)
    return found or name


def load_command_json(
    root: Path,
    args: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    timeout_seconds: float | None = None,
) -> tuple[dict[str, object] | None, str | None]:
    timeout_seconds = command_timeout_seconds(args, timeout_seconds)
    try:
        result = run_command(root, args, cwd=cwd, env=env, timeout_seconds=timeout_seconds)
    except subprocess.TimeoutExpired:
        return None, f"command timed out after {int(timeout_seconds)}s"
    if not result.stdout.strip():
        detail = "command produced no JSON output"
        if result.stderr.strip():
            detail += f": {result.stderr.strip()}"
        return None, detail
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return None, f"invalid JSON output: {exc.msg}"
    if not isinstance(payload, dict):
        return None, "command output must be a JSON object"
    return payload, None


def host_read_unavailable(payload: dict[str, object]) -> bool:
    haystack = json.dumps(payload, ensure_ascii=False).lower()
    return any(
        needle in haystack
        for needle in (
            "api rate limit exceeded",
            "http 403",
            "host_unavailable",
            "host unavailable",
            "rate limit exceeded",
        )
    )


def host_verification_unconfirmed(payload: dict[str, object]) -> bool:
    return payload.get("host_verification_status") in {"unverified", "stale", "host_unavailable"} or host_read_unavailable(payload)


def load_command_json_with_retry(
    root: Path,
    args: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    timeout_seconds: float | None = None,
    retries: int = 2,
) -> tuple[dict[str, object] | None, str | None]:
    transient_needles = (
        "EOF",
        "unknown owner type",
        "command timed out",
        "connection reset",
        "TLS handshake timeout",
    )
    last_payload: dict[str, object] | None = None
    last_error: str | None = None
    for _ in range(retries):
        payload, error = load_command_json(
            root,
            args,
            cwd=cwd,
            env=env,
            timeout_seconds=timeout_seconds,
        )
        if error is None:
            return payload, None
        last_payload = payload
        last_error = error
        if not any(needle in error for needle in transient_needles):
            return payload, error
    return last_payload, last_error


def payload_has_github_rate_limit(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    missing_inputs = payload.get("missing_inputs")
    if not isinstance(missing_inputs, list):
        return False
    return any(isinstance(item, str) and "API rate limit exceeded" in item for item in missing_inputs)


def prepend_path_env(bin_dir: Path, extra: dict[str, str] | None = None) -> dict[str, str]:
    env = dict(extra or {})
    current_path = os.environ.get("PATH", "")
    env["PATH"] = str(bin_dir) if not current_path else f"{bin_dir}:{current_path}"
    return env


def write_fake_codex(
    path: Path,
    *,
    mode: str,
    tracked_edit_target: str | None = None,
) -> None:
    if mode == "success":
        body = """#!/usr/bin/env python3
import json
import pathlib
import sys

args = sys.argv[1:]
output_path = pathlib.Path(args[args.index("-o") + 1])
payload = {
    "decision": "allow",
    "summary": "Default Codex reviewer found the item ready for merge checkpoint consumption.",
    "findings": [
        {
            "id": "warn-1",
            "summary": "Keep the follow-up validation note visible in the review record.",
            "severity": "warn",
            "rebuttal": None,
            "disposition": {
                "status": "accepted",
                "summary": "The reviewer accepts the current validation coverage."
            },
            "details": "This finding is advisory and should not block merge-ready."
        }
    ]
}
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
sys.exit(0)
"""
    elif mode == "schema_drift":
        body = """#!/usr/bin/env python3
import json
import pathlib
import sys

args = sys.argv[1:]
output_path = pathlib.Path(args[args.index("-o") + 1])
payload = {
    "decision": "allow",
    "findings": []
}
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
sys.exit(0)
"""
    elif mode == "tracked_edit":
        target = tracked_edit_target or ""
        body = f"""#!/usr/bin/env python3
import json
import pathlib
import sys

args = sys.argv[1:]
cwd = pathlib.Path(args[args.index("-C") + 1])
output_path = pathlib.Path(args[args.index("-o") + 1])
target = cwd / {target!r}
target.write_text(target.read_text(encoding="utf-8") + "\\ntracked edit from fake codex\\n", encoding="utf-8")
payload = {{
    "decision": "block",
    "summary": "Tracked repository content was modified during review.",
    "findings": [
        {{
            "id": "block-1",
            "summary": "Tracked repo content changed during review execution.",
            "severity": "block",
            "rebuttal": None,
            "disposition": {{
                "status": "rejected",
                "summary": "The run must fail closed."
            }}
        }}
    ]
}}
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
sys.exit(0)
"""
    elif mode == "fail_if_called":
        body = """#!/usr/bin/env python3
import sys

sys.stderr.write("codex exec must not be called for explicit Codex App review adapter\\n")
sys.exit(41)
"""
    else:
        raise ValueError(f"unknown fake codex mode: {mode}")
    path.write_text(body, encoding="utf-8")
    path.chmod(0o755)


def require_governance_surface(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: dict[str, object],
) -> None:
    governance_surface = payload.get("governance_surface")
    if not isinstance(governance_surface, dict):
        failures.append(Failure(category, f"{context} must include `governance_surface` as an object"))
        return

    required_keys = (
        "repository_mode",
        "loom_state",
        "carrier_summary",
        "execution_entry",
        "validation_entry",
        "review_merge_surface",
        "github_control_plane",
        "repo_interface",
        "repo_interop",
        "summary",
        "missing_inputs",
    )
    for key in required_keys:
        if key not in governance_surface:
            failures.append(Failure(category, f"{context} governance_surface must include `{key}`"))

    for key in ("repository_mode", "loom_state", "execution_entry", "validation_entry", "summary"):
        if key in governance_surface and (not isinstance(governance_surface.get(key), str) or not governance_surface.get(key)):
            failures.append(Failure(category, f"{context} governance_surface `{key}` must be a non-empty string"))
    if governance_surface.get("repository_mode") not in {"new", "small-existing", "complex-existing"}:
        failures.append(Failure(category, f"{context} governance_surface `repository_mode` must stay within the stable contract"))
    if governance_surface.get("loom_state") not in {"active", "partial", "absent"}:
        failures.append(Failure(category, f"{context} governance_surface `loom_state` must stay within the stable contract"))

    missing_inputs = governance_surface.get("missing_inputs")
    if missing_inputs is not None and not isinstance(missing_inputs, list):
        failures.append(Failure(category, f"{context} governance_surface `missing_inputs` must be a list"))

    carrier_summary = governance_surface.get("carrier_summary")
    if not isinstance(carrier_summary, dict):
        failures.append(Failure(category, f"{context} governance_surface must include `carrier_summary`"))
    else:
        required_carriers = ("work_item", "recovery", "review", "status_surface", "spec_path", "plan_path")
        if set(carrier_summary.keys()) != set(required_carriers):
            failures.append(Failure(category, f"{context} governance_surface carrier keys must stay within the stable contract"))
        for carrier in required_carriers:
            entry = carrier_summary.get(carrier)
            if not isinstance(entry, dict):
                failures.append(Failure(category, f"{context} governance_surface carrier `{carrier}` must be an object"))
                continue
            if entry.get("status") not in {"present", "missing", "planned"}:
                failures.append(
                    Failure(category, f"{context} governance_surface carrier `{carrier}` status must stay within the stable contract")
                )
            for field in ("locator", "source"):
                value = entry.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(
                        Failure(category, f"{context} governance_surface carrier `{carrier}` must include non-empty `{field}`")
                    )

    review_merge_surface = governance_surface.get("review_merge_surface")
    if review_merge_surface is not None and not isinstance(review_merge_surface, dict):
        failures.append(Failure(category, f"{context} governance_surface `review_merge_surface` must be an object"))
    elif isinstance(review_merge_surface, dict):
        for key in ("pr_template", "validation_surface", "merge_surface"):
            value = review_merge_surface.get(key)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context} governance_surface `review_merge_surface.{key}` must be a non-empty string"))

    github_control_plane = governance_surface.get("github_control_plane")
    if github_control_plane is not None and not isinstance(github_control_plane, dict):
        failures.append(Failure(category, f"{context} governance_surface `github_control_plane` must be an object"))
    elif isinstance(github_control_plane, dict):
        for key in ("repository", "default_branch", "branch_protection", "required_checks", "pr_reviews"):
            if key not in github_control_plane:
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.{key}` must exist"))
        for key in ("repository", "default_branch"):
            value = github_control_plane.get(key)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.{key}` must be a non-empty string"))
        if github_control_plane.get("branch_protection") not in {"enabled", "disabled", "unknown"}:
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.branch_protection` must stay within the stable contract"))
        if github_control_plane.get("pr_reviews") not in {"required", "not_required", "unknown"}:
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.pr_reviews` must stay within the stable contract"))
        required_checks = github_control_plane.get("required_checks")
        if not (
            required_checks == "unknown"
            or (isinstance(required_checks, list) and all(isinstance(item, str) and item for item in required_checks))
        ):
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.required_checks` must be `unknown` or a string list"))
        ci_presence = github_control_plane.get("ci_check_presence")
        if not isinstance(ci_presence, dict):
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.ci_check_presence` must be an object"))
        else:
            stable_names = ci_presence.get("stable_check_names")
            required_names = {"py-compile", "demo-bootstrap", "repo-local-cli", "loom-check"}
            if not isinstance(stable_names, list) or not required_names.issubset(set(stable_names)):
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.ci_check_presence.stable_check_names` must include Loom's stable checks"))
            if ci_presence.get("host_enforcement_status") not in {"verified", "unverified", "stale", "host_unavailable"}:
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.ci_check_presence.host_enforcement_status` must be stable"))
        host_enforcement = github_control_plane.get("host_enforcement")
        if not isinstance(host_enforcement, dict):
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.host_enforcement` must be an object"))
        elif host_enforcement.get("verification_status") not in {"verified", "unverified", "stale", "host_unavailable"}:
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.host_enforcement.verification_status` must be stable"))
        rulesets = github_control_plane.get("rulesets")
        if not isinstance(rulesets, dict):
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.rulesets` must be an object"))
        elif rulesets.get("status") not in {"verified", "unverified", "unknown"}:
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.rulesets.status` must be stable"))
        api_snapshot = github_control_plane.get("api_snapshot")
        if not isinstance(api_snapshot, dict):
            failures.append(Failure(category, f"{context} governance_surface `github_control_plane.api_snapshot` must be an object"))
        else:
            if api_snapshot.get("schema_version") != "loom-host-api-snapshot/v1":
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.api_snapshot.schema_version` must be `loom-host-api-snapshot/v1`"))
            if api_snapshot.get("read_mode") not in {"cached_non_merge", "uncached_live_gate"}:
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.api_snapshot.read_mode` must be stable"))
            if api_snapshot.get("verification_status") not in {"verified", "unverified", "stale", "host_unavailable"}:
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.api_snapshot.verification_status` must be stable"))
            if not isinstance(api_snapshot.get("requests"), list):
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.api_snapshot.requests` must be a list"))
            if not isinstance(api_snapshot.get("errors"), list):
                failures.append(Failure(category, f"{context} governance_surface `github_control_plane.api_snapshot.errors` must be a list"))

    require_repo_interface_payload(
        failures,
        category=category,
        context=f"{context} governance_surface.repo_interface",
        payload=governance_surface.get("repo_interface"),
    )
    require_repo_interop_payload(
        failures,
        category=category,
        context=f"{context} governance_surface.repo_interop",
        payload=governance_surface.get("repo_interop"),
    )
    require_workspace_profile_payload(
        failures,
        category=category,
        context=f"{context} governance_surface.workspace_profile",
        payload=governance_surface.get("workspace_profile"),
    )
    require_gate_starter_payload(
        failures,
        category=category,
        context=f"{context} governance_surface.gate_starter",
        payload=governance_surface.get("gate_starter"),
    )
    require_governance_control_plane(
        failures,
        category=category,
        context=f"{context} governance_surface.governance_control_plane",
        payload=governance_surface.get("governance_control_plane"),
    )


def require_workspace_profile_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-workspace-profile/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-workspace-profile/v1`"))
    if payload.get("selected") not in {"single-workspace", "per-item-worktree", "attach-existing", "unknown"}:
        failures.append(Failure(category, f"{context} selected profile must stay within the stable set"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be pass/block"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} missing_inputs must be a list"))
    for field in ("workspace_entry", "workspace_path", "recommended_action"):
        value = payload.get(field)
        if not isinstance(value, str) or not value:
            failures.append(Failure(category, f"{context}.{field} must be a non-empty string"))
    host_worktree = payload.get("host_worktree")
    if not isinstance(host_worktree, dict):
        failures.append(Failure(category, f"{context}.host_worktree must be an object"))
    elif host_worktree.get("ownership") != "host":
        failures.append(Failure(category, f"{context}.host_worktree ownership must stay `host`"))


def require_gate_starter_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-gate-starter/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-gate-starter/v1`"))
    if payload.get("authority") != "local":
        failures.append(Failure(category, f"{context} authority must stay `local`"))
    if payload.get("enforcement") != "advisory":
        failures.append(Failure(category, f"{context} enforcement must stay `advisory`"))
    if payload.get("host_enforcement") is not False:
        failures.append(Failure(category, f"{context} host_enforcement must stay false"))
    if payload.get("host_enforcement_status") != "not_host_enforced":
        failures.append(Failure(category, f"{context} host_enforcement_status must stay `not_host_enforced`"))
    if payload.get("result") != "pass":
        failures.append(Failure(category, f"{context} result must stay pass because aliases are local starter definitions"))
    aliases = payload.get("aliases")
    required_aliases = {"verify", "status", "merge-ready", "closeout-check", "reconciliation-audit"}
    if not isinstance(aliases, dict):
        failures.append(Failure(category, f"{context}.aliases must be an object"))
        return
    missing_aliases = sorted(required_aliases - set(aliases.keys()))
    if missing_aliases:
        failures.append(Failure(category, f"{context}.aliases is missing {', '.join(missing_aliases)}"))
    for alias, row in aliases.items():
        if not isinstance(row, dict):
            failures.append(Failure(category, f"{context}.aliases.{alias} must be an object"))
            continue
        if row.get("authority") != "local":
            failures.append(Failure(category, f"{context}.aliases.{alias}.authority must stay `local`"))
        if row.get("enforcement") != "advisory":
            failures.append(Failure(category, f"{context}.aliases.{alias}.enforcement must stay `advisory`"))
        if row.get("host_enforcement") is not False:
            failures.append(Failure(category, f"{context}.aliases.{alias}.host_enforcement must stay false"))
        for field in ("surface", "entrypoint", "command", "summary"):
            value = row.get(field)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context}.aliases.{alias}.{field} must be a non-empty string"))


def require_governance_control_plane(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-governance-control/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-governance-control/v1`"))
    execution_entry = payload.get("execution_entry")
    if not isinstance(execution_entry, dict):
        failures.append(Failure(category, f"{context}.execution_entry must be an object"))
    else:
        if execution_entry.get("only_default_entry") != "work_item":
            failures.append(Failure(category, f"{context}.execution_entry must keep `work_item` as the only default entry"))
        if execution_entry.get("result") not in {"pass", "block"}:
            failures.append(Failure(category, f"{context}.execution_entry.result must be `pass` or `block`"))
        fallbacks = execution_entry.get("illegal_entry_fallbacks")
        if not isinstance(fallbacks, dict) or fallbacks.get("fr") != "work_item" or fallbacks.get("implementation_pr") != "work_item":
            failures.append(Failure(category, f"{context}.execution_entry must fail closed from FR/PR back to Work Item"))

    host_binding = payload.get("host_binding")
    if not isinstance(host_binding, dict):
        failures.append(Failure(category, f"{context}.host_binding must be an object"))
    else:
        if host_binding.get("schema_version") != "loom-host-binding/v1":
            failures.append(Failure(category, f"{context}.host_binding schema_version must be `loom-host-binding/v1`"))
        if host_binding.get("result") not in {"pass", "block"}:
            failures.append(Failure(category, f"{context}.host_binding.result must be `pass` or `block`"))
        required_objects = host_binding.get("required_objects")
        expected_objects = {"phase", "fr", "work_item", "branch", "worktree", "implementation_pr", "merge_commit", "closeout"}
        if not isinstance(required_objects, dict) or set(required_objects) != expected_objects:
            failures.append(Failure(category, f"{context}.host_binding.required_objects must expose the stable host binding object set"))
        elif required_objects.get("work_item", {}).get("authority") != "loom fact chain":
            failures.append(Failure(category, f"{context}.host_binding work_item authority must remain Loom fact chain"))

    require_workspace_profile_payload(
        failures,
        category=category,
        context=f"{context}.workspace_profile",
        payload=payload.get("workspace_profile"),
    )
    require_gate_starter_payload(
        failures,
        category=category,
        context=f"{context}.gate_starter",
        payload=payload.get("gate_starter"),
    )

    taxonomy = payload.get("taxonomy")
    expected_taxonomy = {
        "spec_stale",
        "review_stale",
        "head_drift",
        "host_signal_drift",
        "gate_failure",
        "closeout_reconciliation_drift",
    }
    if not isinstance(taxonomy, dict) or not expected_taxonomy.issubset(set(taxonomy)):
        failures.append(Failure(category, f"{context}.taxonomy must expose the stable stale/drift/gate-failure keys"))

    gate_chain = payload.get("gate_chain")
    expected_gate_order = [
        "work_item_admission",
        "spec_gate",
        "build_gate",
        "review_gate",
        "merge_gate",
        "github_controlled_merge",
        "closeout",
    ]
    if not isinstance(gate_chain, list):
        failures.append(Failure(category, f"{context}.gate_chain must be a list"))
    else:
        gate_order = [entry.get("id") for entry in gate_chain if isinstance(entry, dict)]
        if gate_order != expected_gate_order:
            failures.append(Failure(category, f"{context}.gate_chain must preserve the strong governance gate order"))
        for entry in gate_chain:
            if not isinstance(entry, dict):
                failures.append(Failure(category, f"{context}.gate_chain entries must be objects"))
                continue
            if not isinstance(entry.get("requires"), list):
                failures.append(Failure(category, f"{context}.gate_chain `{entry.get('id')}` must declare `requires`"))
            if entry.get("fallback_to") not in {"admission", "build", "review", "merge", "reconciliation-sync"}:
                failures.append(Failure(category, f"{context}.gate_chain `{entry.get('id')}` fallback_to is outside the stable set"))

    maturity = payload.get("maturity")
    if not isinstance(maturity, dict):
        failures.append(Failure(category, f"{context}.maturity must be an object"))
    else:
        if maturity.get("schema_version") != "loom-governance-maturity/v1":
            failures.append(Failure(category, f"{context}.maturity schema_version must be `loom-governance-maturity/v1`"))
        if maturity.get("current") not in {"unadopted", "light", "standard", "strong"}:
            failures.append(Failure(category, f"{context}.maturity current must stay within the stable levels"))
        levels = maturity.get("levels")
        if not isinstance(levels, dict) or set(levels) != {"light", "standard", "strong"}:
            failures.append(Failure(category, f"{context}.maturity levels must define light, standard, and strong"))
        standard_requires = levels.get("standard", {}).get("requires") if isinstance(levels, dict) and isinstance(levels.get("standard"), dict) else None
        expected_standard_requires = {
            "light",
            "fr_work_item_layer",
            "spec_path",
            "plan_path",
            "spec_gate",
            "status_control_plane",
            "basic_host_binding",
            "closeout_reconciliation_read",
        }
        if not isinstance(standard_requires, list) or set(standard_requires) != expected_standard_requires:
            failures.append(Failure(category, f"{context}.maturity standard level must require the full governance control plane"))
        strong_requires = levels.get("strong", {}).get("requires") if isinstance(levels, dict) and isinstance(levels.get("strong"), dict) else None
        if not isinstance(strong_requires, list) or "github_controlled_merge" not in strong_requires:
            failures.append(Failure(category, f"{context}.maturity strong level must require GitHub controlled merge"))
        elif not {
            "host_enforced_control_plane",
            "pr_merge_path",
            "controlled_merge_basis",
            "closeout_basis",
        }.issubset(set(strong_requires)):
            failures.append(Failure(category, f"{context}.maturity strong level must require verified host enforcement and closeout basis"))
        required_fields = maturity.get("required_fields")
        if not isinstance(required_fields, dict) or set(required_fields) != {"light", "standard", "strong"}:
            failures.append(Failure(category, f"{context}.maturity required_fields must define light, standard, and strong"))
        else:
            for level, rows in required_fields.items():
                if not isinstance(rows, list) or not rows:
                    failures.append(Failure(category, f"{context}.maturity required_fields.{level} must be a non-empty list"))
                    continue
                for row in rows:
                    if not isinstance(row, dict):
                        failures.append(Failure(category, f"{context}.maturity required_fields.{level} entries must be objects"))
                        continue
                    if row.get("layer") not in {"core", "github-profile", "repo-owned-residue"}:
                        failures.append(Failure(category, f"{context}.maturity required_fields.{level} layer must be stable"))
                    if not isinstance(row.get("recommended_action"), str) or not row.get("recommended_action"):
                        failures.append(Failure(category, f"{context}.maturity required_fields.{level} entries must include recommended_action"))
        missing_details = maturity.get("missing_details_by_level")
        if not isinstance(missing_details, dict) or set(missing_details) != {"light", "standard", "strong"}:
            failures.append(Failure(category, f"{context}.maturity missing_details_by_level must define light, standard, and strong"))
        fresh_adoption = maturity.get("fresh_adoption")
        if not isinstance(fresh_adoption, dict):
            failures.append(Failure(category, f"{context}.maturity fresh_adoption must be an object"))
        elif fresh_adoption.get("max_default_maturity") != "light":
            failures.append(Failure(category, f"{context}.maturity fresh_adoption max_default_maturity must stay light"))
        require_adoption_gate_rollout_payload(
            failures,
            category=category,
            context=f"{context}.maturity.gate_rollout",
            payload=maturity.get("gate_rollout"),
        )


def require_adoption_gate_rollout_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-adoption-gate-rollout/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-adoption-gate-rollout/v1`"))
    if payload.get("default_mode") != "advisory":
        failures.append(Failure(category, f"{context} default_mode must remain advisory"))
    if payload.get("current_mode") not in {"advisory", "blocking", "rollback"}:
        failures.append(Failure(category, f"{context} current_mode must stay within advisory/blocking/rollback"))
    if payload.get("recommended_mode") not in {"advisory", "blocking", "rollback"}:
        failures.append(Failure(category, f"{context} recommended_mode must stay within advisory/blocking/rollback"))
    if not isinstance(payload.get("blocking_allowed"), bool):
        failures.append(Failure(category, f"{context} blocking_allowed must be boolean"))
    modes = payload.get("allowed_modes")
    if not isinstance(modes, dict) or set(modes) != {"advisory", "blocking", "rollback"}:
        failures.append(Failure(category, f"{context} allowed_modes must define advisory, blocking, and rollback"))
    else:
        for mode, entry in modes.items():
            if not isinstance(entry, dict):
                failures.append(Failure(category, f"{context}.allowed_modes.{mode} must be an object"))
                continue
            if not isinstance(entry.get("summary"), str) or not entry.get("summary"):
                failures.append(Failure(category, f"{context}.allowed_modes.{mode} must include summary"))
            if not isinstance(entry.get("blocking"), bool):
                failures.append(Failure(category, f"{context}.allowed_modes.{mode} must include boolean blocking"))
    preconditions = payload.get("blocking_preconditions")
    if not isinstance(preconditions, list) or not preconditions:
        failures.append(Failure(category, f"{context} blocking_preconditions must be non-empty"))
    else:
        ids = {entry.get("id") for entry in preconditions if isinstance(entry, dict)}
        if not {"strong_maturity", "adversarial_adoption_checks", "rollback_switch"}.issubset(ids):
            failures.append(Failure(category, f"{context} blocking_preconditions must include strong maturity, adversarial checks, and rollback switch"))
        for entry in preconditions:
            if not isinstance(entry, dict):
                failures.append(Failure(category, f"{context} blocking_preconditions entries must be objects"))
                continue
            if entry.get("status") not in {"pass", "missing", "block"}:
                failures.append(Failure(category, f"{context} blocking precondition status must be stable"))
            if entry.get("layer") not in {"core", "github-profile", "repo-owned-residue"}:
                failures.append(Failure(category, f"{context} blocking precondition layer must be stable"))
            if not isinstance(entry.get("recommended_action"), str) or not entry.get("recommended_action"):
                failures.append(Failure(category, f"{context} blocking preconditions must include recommended_action"))
    rollback = payload.get("rollback")
    if not isinstance(rollback, dict):
        failures.append(Failure(category, f"{context} rollback must be an object"))
    else:
        if rollback.get("mode") != "rollback" or rollback.get("switch_to") != "advisory":
            failures.append(Failure(category, f"{context} rollback must switch back to advisory"))
        if not isinstance(rollback.get("recommended_action"), str) or not rollback.get("recommended_action"):
            failures.append(Failure(category, f"{context} rollback must include recommended_action"))


def require_locator_entry(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    allowed_statuses: set[str],
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("status") not in allowed_statuses:
        failures.append(Failure(category, f"{context} status must stay within the stable contract"))
    for field in ("locator", "source"):
        value = payload.get(field)
        if not isinstance(value, str) or not value:
            failures.append(Failure(category, f"{context} must include non-empty `{field}`"))


def require_repo_interface_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("availability") not in REPO_INTERFACE_AVAILABILITY:
        failures.append(Failure(category, f"{context} availability must stay within the stable contract"))
    require_locator_entry(
        failures,
        category=category,
        context=f"{context}.manifest",
        payload=payload.get("manifest"),
        allowed_statuses={"present", "missing"},
    )
    for key in (
        "companion_entry",
        "repo_specific_requirements",
        "specialized_gates",
        "dynamic_tool_locators",
        "policy_locators",
        "hook_locators",
    ):
        require_locator_entry(
            failures,
            category=category,
            context=f"{context}.{key}",
            payload=payload.get(key),
            allowed_statuses={"present", "missing"},
        )
    require_release_targets_surface_payload(
        failures,
        category=category,
        context=f"{context}.release_targets",
        payload=payload.get("release_targets"),
    )
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs` as a list"))
    if not isinstance(payload.get("missing_optional"), list):
        failures.append(Failure(category, f"{context} must include `missing_optional` as a list"))
    require_tool_availability_payload(
        failures,
        category=category,
        context=f"{context}.tool_availability",
        payload=payload.get("tool_availability"),
    )
    require_policy_readiness_payload(
        failures,
        category=category,
        context=f"{context}.policy_readiness",
        payload=payload.get("policy_readiness"),
    )
    require_hook_profile_payload(
        failures,
        category=category,
        context=f"{context}.hook_profile",
        payload=payload.get("hook_profile"),
    )


def require_release_targets_surface_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("availability") not in {"absent", "present", "incomplete"}:
        failures.append(Failure(category, f"{context} availability must stay within the stable contract"))
    for key in ("catalog", "current_target", "status"):
        require_locator_entry(
            failures,
            category=category,
            context=f"{context}.{key}",
            payload=payload.get(key),
            allowed_statuses={"present", "missing"},
        )
    enforcement = payload.get("enforcement")
    if enforcement not in {"blocking", "advisory", "unknown"}:
        failures.append(Failure(category, f"{context}.enforcement must stay within the stable contract"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include summary"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} missing_inputs must be a list"))
    require_target_release_status_payload(
        failures,
        category=category,
        context=f"{context}.target_release",
        payload=payload.get("target_release"),
    )


def require_target_release_status_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != governance_surface_module.RELEASE_TARGET_STATUS_SCHEMA:
        failures.append(Failure(category, f"{context} schema_version must be `{governance_surface_module.RELEASE_TARGET_STATUS_SCHEMA}`"))
    if payload.get("result") not in {"pass", "block", "not_applicable"}:
        failures.append(Failure(category, f"{context} result must be pass, block, or not_applicable"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include summary"))
    for key in ("included_scope", "delivery_chain", "release_evidence", "rollback_readiness", "provenance"):
        if not isinstance(payload.get(key), dict):
            failures.append(Failure(category, f"{context}.{key} must be an object"))
    if not isinstance(payload.get("closeout_gaps"), list):
        failures.append(Failure(category, f"{context}.closeout_gaps must be a list"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context}.missing_inputs must be a list"))


def require_tool_availability_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-dynamic-tool-handshake/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-dynamic-tool-handshake/v1`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be pass or block"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include summary"))
    declared_tools = payload.get("declared_tools")
    if not isinstance(declared_tools, list):
        failures.append(Failure(category, f"{context} declared_tools must be a list"))
    else:
        for index, tool in enumerate(declared_tools):
            if not isinstance(tool, dict):
                failures.append(Failure(category, f"{context}.declared_tools[{index}] must be an object"))
                continue
            if tool.get("status") not in DYNAMIC_TOOL_HANDSHAKE_STATUSES:
                failures.append(Failure(category, f"{context}.declared_tools[{index}] status must stay in the handshake vocabulary"))
            if tool.get("result") not in {"pass", "block"}:
                failures.append(Failure(category, f"{context}.declared_tools[{index}] result must be pass or block"))
            if tool.get("failure_category") not in {"none", "unavailable", "unsupported", "failed", "invalid_declaration"}:
                failures.append(Failure(category, f"{context}.declared_tools[{index}] failure_category must stay stable"))
            if not isinstance(tool.get("evidence"), dict):
                failures.append(Failure(category, f"{context}.declared_tools[{index}] must include evidence"))
    failure_summary = payload.get("failure_summary")
    if not isinstance(failure_summary, dict):
        failures.append(Failure(category, f"{context} failure_summary must be an object"))
    else:
        by_status = failure_summary.get("by_status")
        if not isinstance(by_status, dict) or set(by_status) != DYNAMIC_TOOL_HANDSHAKE_STATUSES:
            failures.append(Failure(category, f"{context} failure_summary.by_status must include the stable status vocabulary"))
        for key in ("required_blocking", "optional_advisory"):
            if not isinstance(failure_summary.get(key), list):
                failures.append(Failure(category, f"{context} failure_summary.{key} must be a list"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} missing_inputs must be a list"))


def require_policy_readiness_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-policy-readiness/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-policy-readiness/v1`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be pass or block"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include summary"))
    declared_policies = payload.get("declared_policies")
    if not isinstance(declared_policies, list):
        failures.append(Failure(category, f"{context} declared_policies must be a list"))
    else:
        for index, policy in enumerate(declared_policies):
            if not isinstance(policy, dict):
                failures.append(Failure(category, f"{context}.declared_policies[{index}] must be an object"))
                continue
            if policy.get("policy") not in POLICY_TYPES:
                failures.append(Failure(category, f"{context}.declared_policies[{index}] policy must be approval or sandbox"))
            if policy.get("status") not in POLICY_READ_STATUSES:
                failures.append(Failure(category, f"{context}.declared_policies[{index}] status must stay in the policy vocabulary"))
            if policy.get("result") not in {"pass", "block"}:
                failures.append(Failure(category, f"{context}.declared_policies[{index}] result must be pass or block"))
            if policy.get("risk") not in {"none", "unknown", "conflict", "unsafe"}:
                failures.append(Failure(category, f"{context}.declared_policies[{index}] risk must stay stable"))
            if not isinstance(policy.get("evidence"), dict):
                failures.append(Failure(category, f"{context}.declared_policies[{index}] must include evidence"))
    risk_summary = payload.get("risk_summary")
    if not isinstance(risk_summary, dict):
        failures.append(Failure(category, f"{context} risk_summary must be an object"))
    else:
        by_status = risk_summary.get("by_status")
        if not isinstance(by_status, dict) or set(by_status) != POLICY_READ_STATUSES:
            failures.append(Failure(category, f"{context} risk_summary.by_status must include the stable status vocabulary"))
        by_policy = risk_summary.get("by_policy")
        if not isinstance(by_policy, dict) or set(by_policy) != POLICY_TYPES:
            failures.append(Failure(category, f"{context} risk_summary.by_policy must include approval and sandbox"))
        for key in ("blocking", "advisory"):
            if not isinstance(risk_summary.get(key), list):
                failures.append(Failure(category, f"{context} risk_summary.{key} must be a list"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} missing_inputs must be a list"))


def require_hook_profile_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != governance_surface_module.HOOK_EXTENSION_PROFILE_SCHEMA:
        failures.append(Failure(category, f"{context} schema_version must be `{governance_surface_module.HOOK_EXTENSION_PROFILE_SCHEMA}`"))
    if payload.get("profile_id") != "orchestration-extension/hooks":
        failures.append(Failure(category, f"{context} profile_id must be `orchestration-extension/hooks`"))
    if not isinstance(payload.get("enabled"), bool):
        failures.append(Failure(category, f"{context} enabled must be a boolean"))
    if payload.get("result") not in {"pass", "warn", "block"}:
        failures.append(Failure(category, f"{context} result must stay within `pass | warn | block`"))
    if payload.get("status") not in {
        "not_applicable",
        "present",
        "invalid_declaration",
        "runtime-blocked",
        "target-unavailable",
        "missing-target",
    }:
        failures.append(Failure(category, f"{context} status is outside the stable hooks extension vocabulary"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    for field in ("missing_inputs", "missing_optional", "checks"):
        if not isinstance(payload.get(field), list):
            failures.append(Failure(category, f"{context}.{field} must be a list"))
    checks = payload.get("checks")
    if not isinstance(checks, list):
        return
    for index, check in enumerate(checks):
        if not isinstance(check, dict):
            failures.append(Failure(category, f"{context}.checks[{index}] must be an object"))
            continue
        for field in ("id", "lifecycle", "requirement", "result", "summary"):
            value = check.get(field)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context}.checks[{index}] missing `{field}`"))
        if not isinstance(check.get("locator"), str):
            failures.append(Failure(category, f"{context}.checks[{index}] locator must be a string"))
        if check.get("lifecycle") not in {"before-run", "after-run", "cleanup", "unknown"}:
            failures.append(Failure(category, f"{context}.checks[{index}] lifecycle is outside the stable vocabulary"))
        if check.get("requirement") not in {"required", "optional", "advisory"}:
            failures.append(Failure(category, f"{context}.checks[{index}] requirement must be `required`, `optional`, or `advisory`"))
        if check.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context}.checks[{index}] result must stay within `pass | warn | block`"))
        if not isinstance(check.get("missing_inputs"), list):
            failures.append(Failure(category, f"{context}.checks[{index}] missing_inputs must be a list"))
        if not isinstance(check.get("missing_optional"), list):
            failures.append(Failure(category, f"{context}.checks[{index}] missing_optional must be a list"))
        if check.get("fallback_to") is not None and not isinstance(check.get("fallback_to"), str):
            failures.append(Failure(category, f"{context}.checks[{index}] fallback_to must be a string or null"))


def require_external_orchestrator_conformance_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "live-smoke":
        failures.append(Failure(category, f"{context} must report `command: live-smoke`"))
    if payload.get("operation") != "external-orchestrator-interop":
        failures.append(Failure(category, f"{context} must report `operation: external-orchestrator-interop`"))
    if payload.get("schema_version") != EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA:
        failures.append(Failure(category, f"{context} schema_version must be `{EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA}`"))
    if payload.get("result") not in {"pass", "warn", "block"}:
        failures.append(Failure(category, f"{context} result must stay within pass/warn/block"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include summary"))
    if payload.get("fallback_to") not in {None, "live-smoke-config-repair", "live-smoke-retry-or-record-unavailable"}:
        failures.append(Failure(category, f"{context} fallback_to must stay profile-local"))
    for field in ("runtime_state", "target", "profile_check", "core_profile", "external_orchestrator"):
        if not isinstance(payload.get(field), dict):
            failures.append(Failure(category, f"{context} must include `{field}` object"))
    if not isinstance(payload.get("command_plan"), list) or not payload.get("command_plan"):
        failures.append(Failure(category, f"{context} must include command_plan"))
    if not isinstance(payload.get("reports"), list):
        failures.append(Failure(category, f"{context} must include reports"))
    conformance = payload.get("external_orchestrator")
    if isinstance(conformance, dict):
        if conformance.get("schema_version") != EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA:
            failures.append(Failure(category, f"{context}.external_orchestrator must use conformance schema"))
        if conformance.get("profile_id") != "orchestration-extension/external-orchestrator":
            failures.append(Failure(category, f"{context}.external_orchestrator profile_id must be external-orchestrator"))
        if conformance.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context}.external_orchestrator result must stay stable"))
        if conformance.get("status") not in {
            "not_applicable",
            "present",
            "runtime-blocked",
            "target-unavailable",
            "missing-target",
            "invalid_declaration",
        }:
            failures.append(Failure(category, f"{context}.external_orchestrator status is outside the stable vocabulary"))
        for field in ("missing_inputs", "missing_optional", "checks"):
            if not isinstance(conformance.get(field), list):
                failures.append(Failure(category, f"{context}.external_orchestrator.{field} must be a list"))
        non_goals = conformance.get("non_goals")
        if not isinstance(non_goals, dict):
            failures.append(Failure(category, f"{context}.external_orchestrator must include non_goals"))
        else:
            for key in ("daemon", "scheduler_state_machine", "tracker_polling_product", "second_status_surface", "host_lifecycle_ownership"):
                if non_goals.get(key) is not False:
                    failures.append(Failure(category, f"{context}.external_orchestrator non_goal `{key}` must remain false"))
    core_profile = payload.get("core_profile")
    if isinstance(core_profile, dict) and core_profile.get("result") != "pass":
        failures.append(Failure(category, f"{context}.core_profile.result must remain pass"))


def require_repo_interop_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("availability") not in REPO_INTEROP_AVAILABILITY:
        failures.append(Failure(category, f"{context} availability must stay within the stable contract"))
    require_locator_entry(
        failures,
        category=category,
        context=f"{context}.contract",
        payload=payload.get("contract"),
        allowed_statuses={"present", "missing"},
    )
    for key in ("host_adapters", "repo_native_carriers", "shadow_surfaces", "external_orchestrators"):
        require_locator_entry(
            failures,
            category=category,
            context=f"{context}.{key}",
            payload=payload.get(key),
            allowed_statuses={"present", "missing"},
        )
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs` as a list"))
    if not isinstance(payload.get("missing_optional"), list):
        failures.append(Failure(category, f"{context} must include `missing_optional` as a list"))


def require_repo_specific_requirements_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expected_surface: str,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("surface") != expected_surface:
        failures.append(Failure(category, f"{context} must report `surface: {expected_surface}`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be `pass` or `block`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {None, "build", "merge"}:
        failures.append(Failure(category, f"{context} fallback must stay within the stable contract"))
    for key in ("declared_requirements", "blocking_requirements", "advisory_requirements"):
        entries = payload.get(key)
        if not isinstance(entries, list):
            failures.append(Failure(category, f"{context} must include `{key}` as a list"))
            continue
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                failures.append(Failure(category, f"{context} {key}[{index}] must be an object"))
                continue
            for field in ("id", "summary", "locator", "enforcement"):
                value = entry.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} {key}[{index}] missing `{field}`"))
            if entry.get("enforcement") not in REPO_INTERFACE_ENFORCEMENT:
                failures.append(Failure(category, f"{context} {key}[{index}] enforcement must stay within the stable contract"))
    declared = payload.get("declared_requirements")
    blocking = payload.get("blocking_requirements")
    advisory = payload.get("advisory_requirements")
    if isinstance(declared, list) and isinstance(blocking, list) and isinstance(advisory, list):
        if len(declared) != len(blocking) + len(advisory):
            failures.append(Failure(category, f"{context} declared requirements must split cleanly into blocking and advisory"))
    require_tool_availability_payload(
        failures,
        category=category,
        context=f"{context}.tool_availability",
        payload=payload.get("tool_availability"),
    )


def require_missing_details(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    details: object,
) -> None:
    if not isinstance(details, list):
        failures.append(Failure(category, f"{context} must be a list"))
        return
    for index, detail in enumerate(details):
        if not isinstance(detail, dict):
            failures.append(Failure(category, f"{context}[{index}] must be an object"))
            continue
        for field in ("category", "kind", "scope", "label", "locator", "message"):
            value = detail.get(field)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context}[{index}] missing `{field}`"))


def require_shadow_parity_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expected_reports: int,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "shadow-parity":
        failures.append(Failure(category, f"{context} must report `command: shadow-parity`"))
    mode = payload.get("mode", "validation-only")
    if mode not in {"validation-only", "blocking"}:
        failures.append(Failure(category, f"{context} mode must be `validation-only` or `blocking`"))
    if payload.get("blocking") != (mode == "blocking"):
        failures.append(Failure(category, f"{context} blocking flag must match mode"))
    allowed_results = {"pass", "block"} if mode == "blocking" else {"pass", "warn"}
    if payload.get("result") not in allowed_results:
        failures.append(Failure(category, f"{context} result must stay within the stable mode-specific contract"))
    expected_fallbacks = {"manual-reconciliation"} if payload.get("result") == "block" else {None}
    if payload.get("fallback_to") not in expected_fallbacks:
        failures.append(Failure(category, f"{context} fallback_to must match the shadow parity enforcement mode"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    blocking_failures = payload.get("blocking_failures")
    if not isinstance(blocking_failures, list):
        failures.append(Failure(category, f"{context} must include `blocking_failures`"))
    elif payload.get("result") == "block" and not blocking_failures:
        failures.append(Failure(category, f"{context} blocking mode must expose blocking_failures when it blocks"))
    top_level_details = payload.get("missing_details")
    if top_level_details is not None:
        require_missing_details(
            failures,
            category=category,
            context=f"{context}.missing_details",
            details=top_level_details,
        )
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=payload.get("runtime_state"),
        expected_scene="repo-local-demo",
        expected_carrier="repo-local-wrapper",
        allowed_results={"pass"},
    )
    governance_surface = {"governance_surface": payload.get("governance_surface")}
    if isinstance(payload.get("governance_surface"), dict):
        require_governance_surface(
            failures,
            category=category,
            context=context,
            payload=governance_surface,
        )
    reports = payload.get("reports")
    if not isinstance(reports, list):
        failures.append(Failure(category, f"{context} must include `reports` as a list"))
        return
    if len(reports) != expected_reports:
        failures.append(Failure(category, f"{context} must include {expected_reports} parity reports"))
    for index, report in enumerate(reports):
        if not isinstance(report, dict):
            failures.append(Failure(category, f"{context} reports[{index}] must be an object"))
            continue
        if report.get("surface") not in {"admission", "review", "merge_ready", "closeout"}:
            failures.append(Failure(category, f"{context} reports[{index}] must declare a known surface"))
        if report.get("result") not in {"match", "mismatch", "unreadable"}:
            failures.append(Failure(category, f"{context} reports[{index}] result must stay within the stable contract"))
        if report.get("classification") not in {None, "drift", "gate_failure"}:
            failures.append(Failure(category, f"{context} reports[{index}] classification must stay within the stable contract"))
        if not isinstance(report.get("blocking"), bool):
            failures.append(Failure(category, f"{context} reports[{index}] must include boolean `blocking`"))
        if not isinstance(report.get("recommended_action"), str) or not report.get("recommended_action"):
            failures.append(Failure(category, f"{context} reports[{index}] must include non-empty `recommended_action`"))
        if mode == "blocking" and report.get("result") != "match" and report.get("blocking") is not True:
            failures.append(Failure(category, f"{context} reports[{index}] must block non-matching reports in blocking mode"))
        if not isinstance(report.get("summary"), str) or not report.get("summary"):
            failures.append(Failure(category, f"{context} reports[{index}] must include non-empty `summary`"))
        if not isinstance(report.get("missing_inputs"), list):
            failures.append(Failure(category, f"{context} reports[{index}] must include `missing_inputs`"))
        report_details = report.get("missing_details")
        if report_details is not None:
            require_missing_details(
                failures,
                category=category,
                context=f"{context} reports[{index}].missing_details",
                details=report_details,
            )
        for key in ("host_adapters", "repo_native_carriers"):
            if not isinstance(report.get(key), list):
                failures.append(Failure(category, f"{context} reports[{index}] must include `{key}` as a list"))
        for surface_key in ("loom_surface", "repo_surface"):
            surface_payload = report.get(surface_key)
            if not isinstance(surface_payload, dict):
                failures.append(Failure(category, f"{context} reports[{index}] must include `{surface_key}`"))
                continue
            if surface_payload.get("status") not in {"readable", "missing"}:
                failures.append(Failure(category, f"{context} reports[{index}] `{surface_key}.status` must stay within the stable contract"))
            locator = surface_payload.get("locator")
            if not isinstance(locator, str) or not locator:
                failures.append(Failure(category, f"{context} reports[{index}] `{surface_key}.locator` must be non-empty"))
            if surface_payload.get("status") == "readable":
                source_files = surface_payload.get("source_files")
                source_sha256 = surface_payload.get("source_sha256")
                if not isinstance(source_files, list) or not source_files:
                    failures.append(Failure(category, f"{context} reports[{index}] `{surface_key}.source_files` must be non-empty for readable evidence"))
                    source_files = []
                if not isinstance(source_sha256, dict) or set(source_sha256) != set(source_files):
                    failures.append(Failure(category, f"{context} reports[{index}] `{surface_key}.source_sha256` must match source_files exactly"))


def require_host_lifecycle_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: dict[str, object],
) -> None:
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} must return `pass` or `block`"))
    if payload.get("fallback_to") not in {None, "admission"}:
        failures.append(Failure(category, f"{context} fallback must be `null` or `admission`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include a non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))

    objects = payload.get("objects")
    if not isinstance(objects, dict):
        failures.append(Failure(category, f"{context} must include `objects`"))
        return

    workspace = objects.get("workspace")
    branch = objects.get("branch")
    pr = objects.get("pr")
    worktree = objects.get("worktree")
    for key, value in (("workspace", workspace), ("branch", branch), ("pr", pr), ("worktree", worktree)):
        if not isinstance(value, dict):
            failures.append(Failure(category, f"{context} must include `{key}`"))
    if not isinstance(workspace, dict) or not isinstance(branch, dict) or not isinstance(pr, dict) or not isinstance(worktree, dict):
        return

    if workspace.get("ownership") != "loom":
        failures.append(Failure(category, f"{context} workspace ownership must stay `loom`"))
    for field in ("entry", "path", "lifecycle_entry"):
        value = workspace.get(field)
        if not isinstance(value, str) or not value:
            failures.append(Failure(category, f"{context} workspace must include non-empty `{field}`"))

    if branch.get("ownership") != "host":
        failures.append(Failure(category, f"{context} branch ownership must stay `host`"))
    if branch.get("purity_status") not in {"report_only", "host_managed_without_local_branch"}:
        failures.append(Failure(category, f"{context} branch purity_status must stay within the stable contract"))
    if not isinstance(branch.get("next_action"), str) or not branch.get("next_action"):
        failures.append(Failure(category, f"{context} branch must include non-empty `next_action`"))

    if pr.get("ownership") != "host":
        failures.append(Failure(category, f"{context} PR ownership must stay `host`"))
    if pr.get("purity_status") != "report_only":
        failures.append(Failure(category, f"{context} PR purity_status must stay `report_only`"))
    if not isinstance(pr.get("next_action"), str) or not pr.get("next_action"):
        failures.append(Failure(category, f"{context} PR must include non-empty `next_action`"))

    if worktree.get("ownership") != "host":
        failures.append(Failure(category, f"{context} worktree ownership must stay `host`"))
    if worktree.get("status") != "host_managed":
        failures.append(Failure(category, f"{context} worktree status must stay `host_managed`"))
    for field in ("cwd_within_repo", "next_action"):
        value = worktree.get(field)
        if not isinstance(value, str) or not value:
            failures.append(Failure(category, f"{context} worktree must include non-empty `{field}`"))


def require_lifecycle_expectations_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must include `lifecycle_expectations`"))
        return
    if payload.get("schema_version") != "loom-workspace-lifecycle/v1":
        failures.append(Failure(category, f"{context} lifecycle_expectations must use schema `loom-workspace-lifecycle/v1`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} lifecycle_expectations.result must be `pass` or `block`"))
    operations = payload.get("operations")
    if not isinstance(operations, dict):
        failures.append(Failure(category, f"{context} lifecycle_expectations must include operations"))
        return
    for key in ("create", "locate", "attach", "handoff", "cleanup", "retire", "execution_boundary", "remove"):
        if not isinstance(operations.get(key), dict):
            failures.append(Failure(category, f"{context} lifecycle_expectations.operations must include `{key}`"))
    attach = operations.get("attach")
    if isinstance(attach, dict):
        if attach.get("creates_workspace") is not False or attach.get("deletes_workspace") is not False:
            failures.append(Failure(category, f"{context} attach must stay locate/binding-only"))
        if attach.get("takes_host_lifecycle") is not False:
            failures.append(Failure(category, f"{context} attach must not take over host lifecycle"))
    remove = operations.get("remove")
    if isinstance(remove, dict) and remove.get("in_core") is not False:
        failures.append(Failure(category, f"{context} remove must stay outside Loom core"))
    execution_boundary = operations.get("execution_boundary")
    if isinstance(execution_boundary, dict):
        for verb in ("run", "stop"):
            value = execution_boundary.get(verb)
            if not isinstance(value, str) or "read/event surface only" not in value:
                failures.append(Failure(category, f"{context} execution_boundary.{verb} must stay read/event-only"))
    worker_backend = payload.get("worker_backend")
    if not isinstance(worker_backend, dict):
        failures.append(Failure(category, f"{context} lifecycle_expectations must include worker_backend"))
    else:
        if worker_backend.get("backend") != "local":
            failures.append(Failure(category, f"{context} worker backend must default to local"))
        if worker_backend.get("daemon") is not False:
            failures.append(Failure(category, f"{context} worker backend must not introduce a daemon"))
        future_rule = worker_backend.get("future_backend_rule")
        if not isinstance(future_rule, str) or not all(
            token in future_rule
            for token in ("Work Item", "workspace", "recovery", "ledger")
        ):
            failures.append(Failure(category, f"{context} worker backend future rule must preserve Work Item/workspace/recovery/ledger truth"))


def require_reconciliation_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must include `reconciliation` as an object"))
        return
    if payload.get("command") != "reconciliation":
        failures.append(Failure(category, f"{context} must report `command: reconciliation`"))
    if payload.get("operation") != "audit":
        failures.append(Failure(category, f"{context} must report `operation: audit`"))
    if payload.get("result") not in {"pass", "warn", "fix-needed", "block"}:
        failures.append(Failure(category, f"{context} returned an unknown reconciliation result"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include a non-empty reconciliation `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include reconciliation `missing_inputs`"))
    if payload.get("fallback_to") not in {None, "manual-reconciliation"}:
        failures.append(Failure(category, f"{context} reconciliation fallback must be `null` or `manual-reconciliation`"))
    findings = payload.get("findings")
    if not isinstance(findings, list):
        failures.append(Failure(category, f"{context} must include reconciliation `findings` as a list"))
        return
    for finding in findings:
        if not isinstance(finding, dict):
            failures.append(Failure(category, f"{context} reconciliation findings must be JSON objects"))
            continue
        if finding.get("category") not in {"drift", "gate_failure"}:
            failures.append(Failure(category, f"{context} reconciliation finding category must stay within the stable taxonomy"))
        if finding.get("kind") not in {"merged_but_open", "absorbed_but_open", "parent_drift", "project_drift", "host_signal_drift", "binding_failure", "merge_signal_drift"}:
            failures.append(Failure(category, f"{context} reconciliation finding kind must stay within the stable contract"))
        if finding.get("severity") not in {"warn", "fix-needed", "block"}:
            failures.append(Failure(category, f"{context} reconciliation finding severity must stay within the stable contract"))
        if finding.get("fallback_to") not in {"reconciliation-sync", "manual-reconciliation", None}:
            failures.append(Failure(category, f"{context} reconciliation finding fallback_to must stay within the stable contract"))
        if not isinstance(finding.get("subject"), str) or not finding.get("subject"):
            failures.append(Failure(category, f"{context} reconciliation findings must include non-empty `subject`"))
        if not isinstance(finding.get("evidence"), dict):
            failures.append(Failure(category, f"{context} reconciliation findings must include `evidence`"))
        if not isinstance(finding.get("recommended_action"), str) or not finding.get("recommended_action"):
            failures.append(Failure(category, f"{context} reconciliation findings must include non-empty `recommended_action`"))
    binding = payload.get("binding")
    if binding is not None:
        if not isinstance(binding, dict):
            failures.append(Failure(category, f"{context} binding must be an object when present"))
        elif binding.get("schema_version") != "loom-github-binding/v1":
            failures.append(Failure(category, f"{context} binding must use `loom-github-binding/v1`"))


def require_closeout_reconciliation_contract(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: dict[str, object],
) -> None:
    reconciliation = payload.get("reconciliation")
    if reconciliation is None:
        return
    require_reconciliation_payload(
        failures,
        category=category,
        context=f"{context} reconciliation",
        payload=reconciliation,
    )
    if not isinstance(reconciliation, dict):
        return
    reconciliation_result = reconciliation.get("result")
    closeout_result = payload.get("result")
    fallback_to = payload.get("fallback_to")
    if reconciliation_result == "fix-needed":
        if closeout_result != "block":
            failures.append(Failure(category, f"{context} must block when reconciliation returns `fix-needed`"))
        if fallback_to != "reconciliation-sync":
            failures.append(Failure(category, f"{context} must point `fix-needed` reconciliation drift to `reconciliation-sync`"))
    if reconciliation_result == "block":
        if closeout_result != "block":
            failures.append(Failure(category, f"{context} must block when reconciliation returns `block`"))
        if fallback_to != "manual-reconciliation":
            failures.append(Failure(category, f"{context} must point blocked reconciliation drift to `manual-reconciliation`"))


def require_runtime_parity_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "runtime-parity":
        failures.append(Failure(category, f"{context} must report `command: runtime-parity`"))
    if payload.get("operation") != "validate":
        failures.append(Failure(category, f"{context} must report `operation: validate`"))
    if payload.get("schema_version") != "loom-runtime-parity/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-runtime-parity/v1`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be `pass` or `block`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include a non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {None, "admission", "merge", "reconciliation-sync", "manual-runtime-reconciliation", "rebootstrap-runtime", "refresh-install", "loom-init"}:
        failures.append(Failure(category, f"{context} fallback_to must stay within the stable runtime parity contract"))
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=payload.get("runtime_state"),
        expected_scene="repo-local-demo",
        expected_carrier="repo-local-wrapper",
        allowed_results={"pass"},
    )
    checks = payload.get("checks")
    if not isinstance(checks, list):
        failures.append(Failure(category, f"{context} must include `checks` as a list"))
        return
    required_checks = {
        "work_item",
        "status_control_plane",
        "gate_chain",
        "controlled_merge_contract",
        "closeout_reconciliation",
        "shadow_parity_boundary",
    }
    check_names = {check.get("name") for check in checks if isinstance(check, dict)}
    if not required_checks.issubset(check_names):
        failures.append(Failure(category, f"{context} must cover the stable runtime parity check set"))
    for check in checks:
        if not isinstance(check, dict):
            failures.append(Failure(category, f"{context} checks must be JSON objects"))
            continue
        if check.get("result") not in {"pass", "block"}:
            failures.append(Failure(category, f"{context} check `{check.get('name')}` result must be `pass` or `block`"))
        if not isinstance(check.get("summary"), str) or not check.get("summary"):
            failures.append(Failure(category, f"{context} check `{check.get('name')}` must include non-empty `summary`"))
        if not isinstance(check.get("missing_inputs"), list):
            failures.append(Failure(category, f"{context} check `{check.get('name')}` must include `missing_inputs`"))
        if not isinstance(check.get("evidence"), dict):
            failures.append(Failure(category, f"{context} check `{check.get('name')}` must include `evidence`"))


def require_live_smoke_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expected_operation: str,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "live-smoke":
        failures.append(Failure(category, f"{context} must report `command: live-smoke`"))
    if payload.get("operation") != expected_operation:
        failures.append(Failure(category, f"{context} must report `operation: {expected_operation}`"))
    if payload.get("schema_version") != "loom-live-smoke/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-live-smoke/v1`"))
    if payload.get("result") not in {"pass", "warn", "block"}:
        failures.append(Failure(category, f"{context} result must stay within `pass | warn | block`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {
        None,
        "live-smoke-retry-or-record-unavailable",
        "record-prior-evidence",
        "live-smoke-config-repair",
        "admission",
        "rebootstrap-runtime",
        "refresh-install",
        "loom-init",
    }:
        failures.append(Failure(category, f"{context} fallback_to must stay within the stable live smoke contract"))
    runtime_state = payload.get("runtime_state")
    allowed_runtime_results = {"pass", "block"} if payload.get("result") == "block" else {"pass"}
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=runtime_state,
        expected_scene="repo-local-demo",
        expected_carrier="repo-local-wrapper",
        allowed_results=allowed_runtime_results,
    )
    command_plan = payload.get("command_plan")
    if not isinstance(command_plan, list) or not command_plan:
        failures.append(Failure(category, f"{context} must include non-empty `command_plan`"))
    else:
        for index, step in enumerate(command_plan):
            if not isinstance(step, dict):
                failures.append(Failure(category, f"{context} command_plan[{index}] must be an object"))
                continue
            for field in ("id", "command", "description"):
                value = step.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} command_plan[{index}] missing `{field}`"))
    reports = payload.get("reports")
    if not isinstance(reports, list) or not reports:
        failures.append(Failure(category, f"{context} must include non-empty `reports`"))
    else:
        for index, report in enumerate(reports):
            if not isinstance(report, dict):
                failures.append(Failure(category, f"{context} reports[{index}] must be an object"))
                continue
            if report.get("result") not in {"pass", "warn", "block"}:
                failures.append(Failure(category, f"{context} reports[{index}] result must stay within the stable contract"))
            if not isinstance(report.get("attempted"), bool):
                failures.append(Failure(category, f"{context} reports[{index}] must include boolean `attempted`"))
            for field in ("id", "command", "summary", "reported_result"):
                value = report.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} reports[{index}] missing `{field}`"))
            if not isinstance(report.get("missing_inputs"), list):
                failures.append(Failure(category, f"{context} reports[{index}] must include `missing_inputs`"))
    live_smoke = payload.get("live_smoke")
    if not isinstance(live_smoke, dict):
        failures.append(Failure(category, f"{context} must include `live_smoke`"))
    else:
        if live_smoke.get("status") not in {"passed", "failed", "unavailable", "replayed", "dry_run"}:
            failures.append(Failure(category, f"{context} live_smoke.status must stay within the stable contract"))
        for field in ("executed_at", "release_interpretation"):
            value = live_smoke.get(field)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context} live_smoke must include non-empty `{field}`"))
    if expected_operation == "run":
        target = payload.get("target")
        if not isinstance(target, dict):
            failures.append(Failure(category, f"{context} run payload must include `target`"))
        else:
            if not isinstance(target.get("path"), str) or not target.get("path"):
                failures.append(Failure(category, f"{context} target.path must be non-empty"))
            if not isinstance(target.get("exists"), bool):
                failures.append(Failure(category, f"{context} target.exists must be boolean"))
        if payload.get("prior_evidence") is not None:
            failures.append(Failure(category, f"{context} run payload must not include `prior_evidence`"))
    else:
        prior_evidence = payload.get("prior_evidence")
        if not isinstance(prior_evidence, dict):
            failures.append(Failure(category, f"{context} replay payload must include `prior_evidence`"))
        else:
            for field in ("path", "status"):
                value = prior_evidence.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} prior_evidence missing `{field}`"))


def require_host_adapter_live_drift_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "live-smoke":
        failures.append(Failure(category, f"{context} must report `command: live-smoke`"))
    if payload.get("operation") != "host-adapter-drift":
        failures.append(Failure(category, f"{context} must report `operation: host-adapter-drift`"))
    if payload.get("schema_version") != "loom-host-adapter-live-drift/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-host-adapter-live-drift/v1`"))
    if payload.get("result") not in {"pass", "warn", "block"}:
        failures.append(Failure(category, f"{context} result must stay within `pass | warn | block`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {
        None,
        "live-smoke-retry-or-record-unavailable",
        "live-smoke-config-repair",
        "admission",
        "rebootstrap-runtime",
        "refresh-install",
        "loom-init",
    }:
        failures.append(Failure(category, f"{context} fallback_to must stay within the stable host adapter live drift contract"))
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=payload.get("runtime_state"),
        expected_scene="repo-local-demo",
        expected_carrier="repo-local-wrapper",
        allowed_results={"pass", "block"} if payload.get("result") == "block" else {"pass"},
    )
    target = payload.get("target")
    if not isinstance(target, dict):
        failures.append(Failure(category, f"{context} must include `target`"))
    else:
        if not isinstance(target.get("path"), str) or not target.get("path"):
            failures.append(Failure(category, f"{context} target.path must be non-empty"))
        if not isinstance(target.get("exists"), bool):
            failures.append(Failure(category, f"{context} target.exists must be boolean"))
    if not isinstance(payload.get("command_plan"), list):
        failures.append(Failure(category, f"{context} must include `command_plan`"))
    reports = payload.get("reports")
    if not isinstance(reports, list):
        failures.append(Failure(category, f"{context} must include `reports`"))
    else:
        for index, report in enumerate(reports):
            if not isinstance(report, dict):
                failures.append(Failure(category, f"{context} reports[{index}] must be an object"))
                continue
            if report.get("result") not in {"pass", "warn", "block"}:
                failures.append(Failure(category, f"{context} reports[{index}] result must stay within the stable contract"))
            if not isinstance(report.get("attempted"), bool):
                failures.append(Failure(category, f"{context} reports[{index}] must include boolean `attempted`"))
            for field in ("id", "command", "summary", "reported_result"):
                value = report.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} reports[{index}] missing `{field}`"))
            if not isinstance(report.get("missing_inputs"), list):
                failures.append(Failure(category, f"{context} reports[{index}] must include `missing_inputs`"))
    profile_check = payload.get("profile_check")
    if not isinstance(profile_check, dict):
        failures.append(Failure(category, f"{context} must include `profile_check`"))
    else:
        if profile_check.get("id") != "host-adapter-live-drift":
            failures.append(Failure(category, f"{context} profile_check.id must be `host-adapter-live-drift`"))
        if profile_check.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context} profile_check.result must stay within `pass | warn | block`"))
    host_adapter_drift = payload.get("host_adapter_drift")
    if not isinstance(host_adapter_drift, dict):
        failures.append(Failure(category, f"{context} must include `host_adapter_drift`"))
        return
    if host_adapter_drift.get("availability") not in {
        "absent",
        "present",
        "incomplete",
        "runtime-blocked",
        "target-unavailable",
        "missing-target",
    }:
        failures.append(Failure(category, f"{context} host_adapter_drift.availability is outside the stable vocabulary"))
    if not isinstance(host_adapter_drift.get("contract_locator"), str) or not host_adapter_drift.get("contract_locator"):
        failures.append(Failure(category, f"{context} host_adapter_drift.contract_locator must be non-empty"))
    checks = host_adapter_drift.get("checks")
    if not isinstance(checks, list):
        failures.append(Failure(category, f"{context} host_adapter_drift.checks must be a list"))
        return
    for index, check in enumerate(checks):
        if not isinstance(check, dict):
            failures.append(Failure(category, f"{context} host_adapter_drift.checks[{index}] must be an object"))
            continue
        for field in ("id", "owner", "requirement", "summary", "result", "classification"):
            value = check.get(field)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context} host_adapter_drift.checks[{index}] missing `{field}`"))
        if check.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context} host_adapter_drift.checks[{index}] result must stay within `pass | warn | block`"))
        if check.get("classification") not in {
            "none",
            "version_drift",
            "locator_missing",
            "locator_unreadable",
            "permission_unavailable",
            "unsafe_locator",
            "invalid_declaration",
        }:
            failures.append(Failure(category, f"{context} host_adapter_drift.checks[{index}] classification is outside the stable vocabulary"))
        if not isinstance(check.get("missing_inputs"), list):
            failures.append(Failure(category, f"{context} host_adapter_drift.checks[{index}] must include `missing_inputs`"))
        if not isinstance(check.get("evidence"), dict):
            failures.append(Failure(category, f"{context} host_adapter_drift.checks[{index}] must include `evidence`"))


def require_dynamic_tool_live_availability_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "live-smoke":
        failures.append(Failure(category, f"{context} must report `command: live-smoke`"))
    if payload.get("operation") != "dynamic-tool-availability":
        failures.append(Failure(category, f"{context} must report `operation: dynamic-tool-availability`"))
    if payload.get("schema_version") != "loom-dynamic-tool-live-availability/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-dynamic-tool-live-availability/v1`"))
    if payload.get("result") not in {"pass", "warn", "block"}:
        failures.append(Failure(category, f"{context} result must stay within `pass | warn | block`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {
        None,
        "live-smoke-retry-or-record-unavailable",
        "live-smoke-config-repair",
        "admission",
        "rebootstrap-runtime",
        "refresh-install",
        "loom-init",
    }:
        failures.append(Failure(category, f"{context} fallback_to must stay within the stable dynamic tool live contract"))
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=payload.get("runtime_state"),
        expected_scene="repo-local-demo",
        expected_carrier="repo-local-wrapper",
        allowed_results={"pass", "block"} if payload.get("result") == "block" else {"pass"},
    )
    target = payload.get("target")
    if not isinstance(target, dict):
        failures.append(Failure(category, f"{context} must include `target`"))
    else:
        if not isinstance(target.get("path"), str) or not target.get("path"):
            failures.append(Failure(category, f"{context} target.path must be non-empty"))
        if not isinstance(target.get("exists"), bool):
            failures.append(Failure(category, f"{context} target.exists must be boolean"))
    if not isinstance(payload.get("command_plan"), list):
        failures.append(Failure(category, f"{context} must include `command_plan`"))
    reports = payload.get("reports")
    if not isinstance(reports, list):
        failures.append(Failure(category, f"{context} must include `reports`"))
    else:
        for index, report in enumerate(reports):
            if not isinstance(report, dict):
                failures.append(Failure(category, f"{context} reports[{index}] must be an object"))
                continue
            if report.get("result") not in {"pass", "warn", "block"}:
                failures.append(Failure(category, f"{context} reports[{index}] result must stay within the stable contract"))
            if not isinstance(report.get("attempted"), bool):
                failures.append(Failure(category, f"{context} reports[{index}] must include boolean `attempted`"))
            for field in ("id", "command", "summary", "reported_result"):
                value = report.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} reports[{index}] missing `{field}`"))
            if not isinstance(report.get("missing_inputs"), list):
                failures.append(Failure(category, f"{context} reports[{index}] must include `missing_inputs`"))
    profile_check = payload.get("profile_check")
    if not isinstance(profile_check, dict):
        failures.append(Failure(category, f"{context} must include `profile_check`"))
    else:
        if profile_check.get("id") != "dynamic-tool-live-availability":
            failures.append(Failure(category, f"{context} profile_check.id must be `dynamic-tool-live-availability`"))
        if profile_check.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context} profile_check.result must stay within `pass | warn | block`"))
    dynamic_tool_availability = payload.get("dynamic_tool_availability")
    if not isinstance(dynamic_tool_availability, dict):
        failures.append(Failure(category, f"{context} must include `dynamic_tool_availability`"))
        return
    if dynamic_tool_availability.get("availability") not in {
        "absent",
        "present",
        "incomplete",
        "runtime-blocked",
        "target-unavailable",
        "missing-target",
    }:
        failures.append(Failure(category, f"{context} dynamic_tool_availability.availability is outside the stable vocabulary"))
    if dynamic_tool_availability.get("surface") not in {
        "attempt_time",
        "review",
        "merge_ready",
        "closeout",
        "build",
        "admission",
        "pre_review",
        "all",
    }:
        failures.append(Failure(category, f"{context} dynamic_tool_availability.surface is outside the stable vocabulary"))
    if not isinstance(dynamic_tool_availability.get("contract_locator"), str) or not dynamic_tool_availability.get("contract_locator"):
        failures.append(Failure(category, f"{context} dynamic_tool_availability.contract_locator must be non-empty"))
    require_tool_availability_payload(
        failures,
        category=category,
        context=f"{context}.dynamic_tool_availability.tool_availability",
        payload=dynamic_tool_availability.get("tool_availability"),
    )


def require_hook_envelope_live_check_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "live-smoke":
        failures.append(Failure(category, f"{context} must report `command: live-smoke`"))
    if payload.get("operation") != "hook-envelope":
        failures.append(Failure(category, f"{context} must report `operation: hook-envelope`"))
    if payload.get("schema_version") != "loom-hook-envelope-check/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-hook-envelope-check/v1`"))
    if payload.get("result") not in {"pass", "warn", "block"}:
        failures.append(Failure(category, f"{context} result must stay within `pass | warn | block`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {None, "live-smoke-retry-or-record-unavailable", "live-smoke-config-repair"}:
        failures.append(Failure(category, f"{context} fallback_to must stay within the stable hook envelope check contract"))
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=payload.get("runtime_state"),
        expected_scene="repo-local-demo",
        expected_carrier="repo-local-wrapper",
        allowed_results={"pass", "block"} if payload.get("result") == "block" else {"pass"},
    )
    target = payload.get("target")
    if not isinstance(target, dict):
        failures.append(Failure(category, f"{context} must include `target`"))
    else:
        if not isinstance(target.get("path"), str) or not target.get("path"):
            failures.append(Failure(category, f"{context} target.path must be non-empty"))
        if not isinstance(target.get("exists"), bool):
            failures.append(Failure(category, f"{context} target.exists must be boolean"))
    if not isinstance(payload.get("command_plan"), list):
        failures.append(Failure(category, f"{context} must include `command_plan`"))
    reports = payload.get("reports")
    if not isinstance(reports, list):
        failures.append(Failure(category, f"{context} must include `reports`"))
    else:
        for index, report in enumerate(reports):
            if not isinstance(report, dict):
                failures.append(Failure(category, f"{context} reports[{index}] must be an object"))
                continue
            if report.get("result") not in {"pass", "warn", "block"}:
                failures.append(Failure(category, f"{context} reports[{index}] result must stay within the stable contract"))
            if not isinstance(report.get("attempted"), bool):
                failures.append(Failure(category, f"{context} reports[{index}] must include boolean `attempted`"))
            for field in ("id", "command", "summary", "reported_result"):
                value = report.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} reports[{index}] missing `{field}`"))
            if not isinstance(report.get("missing_inputs"), list):
                failures.append(Failure(category, f"{context} reports[{index}] must include `missing_inputs`"))
    profile_check = payload.get("profile_check")
    if not isinstance(profile_check, dict):
        failures.append(Failure(category, f"{context} must include `profile_check`"))
    else:
        if profile_check.get("id") != "hook-envelope":
            failures.append(Failure(category, f"{context} profile_check.id must be `hook-envelope`"))
        if profile_check.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context} profile_check.result must stay within `pass | warn | block`"))
    hook_envelope = payload.get("hook_envelope")
    if not isinstance(hook_envelope, dict):
        failures.append(Failure(category, f"{context} must include `hook_envelope`"))
        return
    if hook_envelope.get("availability") not in {
        "present",
        "incomplete",
        "runtime-blocked",
        "target-unavailable",
        "missing-target",
        "missing-envelope",
        "invalid-declaration",
    }:
        failures.append(Failure(category, f"{context} hook_envelope.availability is outside the stable vocabulary"))
    if hook_envelope.get("requirement") not in {"required", "optional", "advisory"}:
        failures.append(Failure(category, f"{context} hook_envelope.requirement must be `required`, `optional`, or `advisory`"))
    checks = hook_envelope.get("checks")
    if not isinstance(checks, list):
        failures.append(Failure(category, f"{context} hook_envelope.checks must be a list"))
        return
    for index, check in enumerate(checks):
        if not isinstance(check, dict):
            failures.append(Failure(category, f"{context} hook_envelope.checks[{index}] must be an object"))
            continue
        for field in ("id", "requirement", "locator", "result", "classification", "summary"):
            value = check.get(field)
            if not isinstance(value, str) or not value:
                failures.append(Failure(category, f"{context} hook_envelope.checks[{index}] missing `{field}`"))
        if check.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context} hook_envelope.checks[{index}] result must stay within `pass | warn | block`"))
        if check.get("classification") not in {
            "none",
            "invalid_envelope",
            "missing_required_input",
            "unsupported",
            "not_applicable",
            "permission_unavailable",
            "unsafe",
            "host_mapping_failed",
        }:
            failures.append(Failure(category, f"{context} hook_envelope.checks[{index}] classification is outside the stable vocabulary"))
        if not isinstance(check.get("missing_inputs"), list):
            failures.append(Failure(category, f"{context} hook_envelope.checks[{index}] must include `missing_inputs`"))
        if not isinstance(check.get("evidence"), dict):
            failures.append(Failure(category, f"{context} hook_envelope.checks[{index}] must include `evidence`"))


def require_hooks_extension_live_check_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "live-smoke":
        failures.append(Failure(category, f"{context} must report `command: live-smoke`"))
    if payload.get("operation") != "hooks-extension":
        failures.append(Failure(category, f"{context} must report `operation: hooks-extension`"))
    if payload.get("schema_version") != governance_surface_module.HOOK_EXTENSION_PROFILE_SCHEMA:
        failures.append(Failure(category, f"{context} schema_version must be `{governance_surface_module.HOOK_EXTENSION_PROFILE_SCHEMA}`"))
    if payload.get("result") not in {"pass", "warn", "block"}:
        failures.append(Failure(category, f"{context} result must stay within `pass | warn | block`"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} must include non-empty `summary`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {None, "live-smoke-retry-or-record-unavailable", "live-smoke-config-repair"}:
        failures.append(Failure(category, f"{context} fallback_to must stay within the stable hooks extension contract"))
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=payload.get("runtime_state"),
        expected_scene="repo-local-demo",
        expected_carrier="repo-local-wrapper",
        allowed_results={"pass", "block"} if payload.get("result") == "block" else {"pass"},
    )
    target = payload.get("target")
    if not isinstance(target, dict):
        failures.append(Failure(category, f"{context} must include `target`"))
    else:
        if not isinstance(target.get("path"), str) or not target.get("path"):
            failures.append(Failure(category, f"{context} target.path must be non-empty"))
        if not isinstance(target.get("exists"), bool):
            failures.append(Failure(category, f"{context} target.exists must be boolean"))
    if not isinstance(payload.get("command_plan"), list):
        failures.append(Failure(category, f"{context} must include `command_plan`"))
    reports = payload.get("reports")
    if not isinstance(reports, list):
        failures.append(Failure(category, f"{context} must include `reports`"))
    else:
        for index, report in enumerate(reports):
            if not isinstance(report, dict):
                failures.append(Failure(category, f"{context} reports[{index}] must be an object"))
                continue
            if report.get("result") not in {"pass", "warn", "block"}:
                failures.append(Failure(category, f"{context} reports[{index}] result must stay within the stable contract"))
            if not isinstance(report.get("attempted"), bool):
                failures.append(Failure(category, f"{context} reports[{index}] must include boolean `attempted`"))
            for field in ("id", "command", "summary", "reported_result"):
                value = report.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} reports[{index}] missing `{field}`"))
            if not isinstance(report.get("missing_inputs"), list):
                failures.append(Failure(category, f"{context} reports[{index}] must include `missing_inputs`"))
    profile_check = payload.get("profile_check")
    if not isinstance(profile_check, dict):
        failures.append(Failure(category, f"{context} must include `profile_check`"))
    else:
        if profile_check.get("id") != "hooks-extension":
            failures.append(Failure(category, f"{context} profile_check.id must be `hooks-extension`"))
        if profile_check.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{context} profile_check.result must stay within `pass | warn | block`"))
    core_profile = payload.get("core_profile")
    if not isinstance(core_profile, dict):
        failures.append(Failure(category, f"{context} must include `core_profile`"))
    else:
        if core_profile.get("id") != "orchestration-core":
            failures.append(Failure(category, f"{context} core_profile.id must be `orchestration-core`"))
        if core_profile.get("hook_enforcement") != "not_applicable":
            failures.append(Failure(category, f"{context} core_profile.hook_enforcement must be `not_applicable`"))
        if core_profile.get("result") != "pass":
            failures.append(Failure(category, f"{context} core_profile.result must remain `pass`"))
    require_hook_profile_payload(
        failures,
        category=category,
        context=f"{context}.hooks_extension",
        payload=payload.get("hooks_extension"),
    )


def require_github_binding_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "governance-profile":
        failures.append(Failure(category, f"{context} must report `command: governance-profile`"))
    if payload.get("operation") != "binding":
        failures.append(Failure(category, f"{context} must report `operation: binding`"))
    if payload.get("schema_version") != "loom-github-binding/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-github-binding/v1`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be pass/block"))
    if payload.get("fallback_to") not in {None, "github-profile-binding"}:
        failures.append(Failure(category, f"{context} fallback_to must be null or `github-profile-binding`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} missing_inputs must be a list"))
    binding = payload.get("binding")
    if not isinstance(binding, dict):
        failures.append(Failure(category, f"{context} must include `binding` as an object"))
        return
    if binding.get("schema_version") != "loom-github-binding/v1":
        failures.append(Failure(category, f"{context}.binding schema_version must be `loom-github-binding/v1`"))
    objects = binding.get("objects")
    expected_objects = {"phase", "fr", "work_item", "branch", "implementation_pr", "merge_commit", "target_branch"}
    if not isinstance(objects, dict) or set(objects) != expected_objects:
        failures.append(Failure(category, f"{context}.binding.objects must expose the stable GitHub binding object set"))
    chain = binding.get("chain")
    expected_chain = [
        ("phase", "fr"),
        ("fr", "work_item"),
        ("work_item", "implementation_pr"),
        ("implementation_pr", "merge_commit"),
        ("merge_commit", "target_branch"),
    ]
    if not isinstance(chain, list):
        failures.append(Failure(category, f"{context}.binding.chain must be a list"))
    else:
        actual_chain = [
            (entry.get("from"), entry.get("to"))
            for entry in chain
            if isinstance(entry, dict)
        ]
        if actual_chain != expected_chain:
            failures.append(Failure(category, f"{context}.binding.chain must preserve Phase -> FR -> Work Item -> PR -> merge commit -> target branch order"))
        for entry in chain:
            if not isinstance(entry, dict):
                failures.append(Failure(category, f"{context}.binding.chain entries must be objects"))
                continue
            if entry.get("status") not in {"present", "missing"}:
                failures.append(Failure(category, f"{context}.binding.chain statuses must be present/missing"))
    findings = binding.get("findings")
    if not isinstance(findings, list):
        failures.append(Failure(category, f"{context}.binding.findings must be a list"))
        return
    for finding in findings:
        if not isinstance(finding, dict):
            failures.append(Failure(category, f"{context}.binding.findings entries must be objects"))
            continue
        if finding.get("category") not in {"stale", "drift", "gate_failure"}:
            failures.append(Failure(category, f"{context}.binding findings must use stable taxonomy categories"))
        if finding.get("kind") != "binding_failure":
            failures.append(Failure(category, f"{context}.binding findings must use `binding_failure` for orchestration gaps"))
        if finding.get("fallback_to") != "github-profile-binding":
            failures.append(Failure(category, f"{context}.binding findings must fallback to `github-profile-binding`"))


def require_governance_upgrade_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "governance-profile":
        failures.append(Failure(category, f"{context} must report `command: governance-profile`"))
    if payload.get("operation") != "upgrade":
        failures.append(Failure(category, f"{context} must report `operation: upgrade`"))
    if payload.get("schema_version") != "loom-governance-upgrade/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-governance-upgrade/v1`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be pass/block"))
    if payload.get("target_maturity") not in {"standard", "strong"}:
        failures.append(Failure(category, f"{context} target_maturity must be standard/strong"))
    if not isinstance(payload.get("dry_run"), bool):
        failures.append(Failure(category, f"{context} dry_run must be boolean"))
    require_adoption_gate_rollout_payload(
        failures,
        category=category,
        context=f"{context}.gate_rollout",
        payload=payload.get("gate_rollout"),
    )
    actions = payload.get("actions")
    if not isinstance(actions, list) or not actions:
        failures.append(Failure(category, f"{context} must include non-empty actions"))
        return
    for action in actions:
        if not isinstance(action, dict):
            failures.append(Failure(category, f"{context} actions must be objects"))
            continue
        if action.get("owner") not in {"loom-owned", "repo-owned", "profile"}:
            failures.append(Failure(category, f"{context} action owner must stay within the stable set"))
        if action.get("status") not in {"planned", "present"}:
            failures.append(Failure(category, f"{context} action status must be planned/present"))
        if action.get("action") == "satisfy_missing_input" and not isinstance(action.get("recommended_action"), str):
            failures.append(Failure(category, f"{context} missing-input actions must include recommended_action"))
    require_adoption_decisions_payload(
        failures,
        category=category,
        context=f"{context}.adoption_decisions",
        payload=payload.get("adoption_decisions"),
    )
    require_guided_adoption_plan_payload(
        failures,
        category=category,
        context=f"{context}.guided_adoption_plan",
        payload=payload.get("guided_adoption_plan"),
    )
    require_companion_generation_payload(
        failures,
        category=category,
        context=f"{context}.companion_generation",
        payload=payload.get("companion_generation"),
    )


def require_maturity_upgrade_path(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must include maturity_upgrade_path"))
        return
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be pass/block"))
    if payload.get("current") not in {"unadopted", "light", "standard", "strong", "unknown"}:
        failures.append(Failure(category, f"{context} current maturity must stay within the stable set"))
    if payload.get("next") not in {None, "light", "standard", "strong"}:
        failures.append(Failure(category, f"{context} next maturity must stay within the stable set"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} missing_inputs must be a list"))
    if not isinstance(payload.get("missing_details"), list):
        failures.append(Failure(category, f"{context} missing_details must be a list"))
    if payload.get("fallback_to") not in {None, "adoption", "admission"}:
        failures.append(Failure(category, f"{context} fallback_to must be stable"))
    if payload.get("next") is not None and not isinstance(payload.get("upgrade_entry"), str):
        failures.append(Failure(category, f"{context} upgrade_entry must be present when next maturity exists"))
    validation_entries = payload.get("validation_entries")
    if not isinstance(validation_entries, list) or not validation_entries:
        failures.append(Failure(category, f"{context} validation_entries must be non-empty"))
    require_adoption_gate_rollout_payload(
        failures,
        category=category,
        context=f"{context}.gate_rollout",
        payload=payload.get("gate_rollout"),
    )
    if payload.get("result") == "block":
        require_adoption_decisions_payload(
            failures,
            category=category,
            context=f"{context}.adoption_decisions",
            payload=payload.get("adoption_decisions"),
        )
        require_guided_adoption_plan_payload(
            failures,
            category=category,
            context=f"{context}.guided_adoption_plan",
            payload=payload.get("guided_adoption_plan"),
        )


def require_adoption_decisions_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-adoption-decisions/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-adoption-decisions/v1`"))
    judgments = payload.get("judgments")
    if not isinstance(judgments, list) or not judgments:
        failures.append(Failure(category, f"{context} must include non-empty judgments"))
        return
    required_fields = {"id", "question", "source_locator", "reasoning", "write_targets", "verification_commands", "status"}
    for judgment in judgments:
        if not isinstance(judgment, dict):
            failures.append(Failure(category, f"{context} judgments must be objects"))
            continue
        missing = sorted(required_fields - set(judgment))
        if missing:
            failures.append(Failure(category, f"{context} judgment `{judgment.get('id')}` missing fields: {', '.join(missing)}"))
        if judgment.get("status") not in {"answered", "missing", "blocked"}:
            failures.append(Failure(category, f"{context} judgment status must be answered/missing/blocked"))
        for field in ("id", "question", "source_locator", "reasoning"):
            if not isinstance(judgment.get(field), str) or not judgment.get(field):
                failures.append(Failure(category, f"{context} judgment `{judgment.get('id')}` must include non-empty `{field}`"))
        if not isinstance(judgment.get("write_targets"), list):
            failures.append(Failure(category, f"{context} judgment `{judgment.get('id')}` write_targets must be a list"))
        if not isinstance(judgment.get("verification_commands"), list) or not judgment.get("verification_commands"):
            failures.append(Failure(category, f"{context} judgment `{judgment.get('id')}` verification_commands must be non-empty"))


def require_guided_adoption_plan_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-guided-adoption-plan/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-guided-adoption-plan/v1`"))
    if payload.get("phase_order") != ["read", "judge", "write", "verify"]:
        failures.append(Failure(category, f"{context} phase_order must be read/judge/write/verify"))
    steps = payload.get("steps")
    if not isinstance(steps, list) or not steps:
        failures.append(Failure(category, f"{context} must include non-empty steps"))
        return
    for step in steps:
        if not isinstance(step, dict):
            failures.append(Failure(category, f"{context} steps must be objects"))
            continue
        if step.get("phase") not in {"read", "judge", "write", "verify"}:
            failures.append(Failure(category, f"{context} step phase must be read/judge/write/verify"))
        if not isinstance(step.get("judgment_id"), str) or not step.get("judgment_id"):
            failures.append(Failure(category, f"{context} step must include judgment_id"))
        if not isinstance(step.get("action"), str) or not step.get("action"):
            failures.append(Failure(category, f"{context} step must include action"))
        if not isinstance(step.get("source_locator"), str) or not step.get("source_locator"):
            failures.append(Failure(category, f"{context} step must include source_locator"))
        if not isinstance(step.get("write_targets"), list):
            failures.append(Failure(category, f"{context} step write_targets must be a list"))
        if not isinstance(step.get("verification_commands"), list) or not step.get("verification_commands"):
            failures.append(Failure(category, f"{context} step verification_commands must be non-empty"))


def require_companion_generation_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-companion-generation/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-companion-generation/v1`"))
    if payload.get("result") not in {"pass", "block"}:
        failures.append(Failure(category, f"{context} result must be pass/block"))
    artifacts = payload.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        failures.append(Failure(category, f"{context} must include non-empty artifacts"))
        return
    required_paths = {
        ".loom/companion/manifest.json",
        ".loom/companion/repo-interface.json",
        ".loom/companion/interop.json",
    }
    actual_paths = {artifact.get("path") for artifact in artifacts if isinstance(artifact, dict)}
    if not required_paths.issubset(actual_paths):
        failures.append(Failure(category, f"{context} artifacts must include manifest, repo-interface, and interop"))
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            failures.append(Failure(category, f"{context} artifacts must be objects"))
            continue
        if artifact.get("status") not in {"planned", "present", "written"}:
            failures.append(Failure(category, f"{context} artifact status must be planned/present/written"))
        if artifact.get("owner") not in {"loom-owned", "repo-owned"}:
            failures.append(Failure(category, f"{context} artifact owner must be loom-owned/repo-owned"))


def require_review_record_contract(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must include a review record object"))
        return
    findings = payload.get("findings")
    if not isinstance(findings, list):
        failures.append(Failure(category, f"{context} must include review `findings` as a list"))
        return
    for list_field in ("blocking_issues", "follow_ups"):
        if not isinstance(payload.get(list_field), list):
            failures.append(Failure(category, f"{context} must include review `{list_field}` as a list"))
    consumed_inputs = payload.get("consumed_inputs")
    if consumed_inputs is not None:
        if not isinstance(consumed_inputs, dict):
            failures.append(Failure(category, f"{context} review `consumed_inputs` must be an object when present"))
        else:
            for key in ("engine_adapter", "engine_evidence", "normalized_findings"):
                value = consumed_inputs.get(key)
                if value is not None and (not isinstance(value, str) or not value):
                    failures.append(Failure(category, f"{context} review consumed input `{key}` must be null or a non-empty string"))
    for finding in findings:
        if not isinstance(finding, dict):
            failures.append(Failure(category, f"{context} review findings must be JSON objects"))
            continue
        if not isinstance(finding.get("id"), str) or not finding.get("id"):
            failures.append(Failure(category, f"{context} review findings must include non-empty `id`"))
        if not isinstance(finding.get("summary"), str) or not finding.get("summary"):
            failures.append(Failure(category, f"{context} review findings must include non-empty `summary`"))
        if finding.get("severity") not in REVIEW_FINDING_SEVERITIES:
            failures.append(Failure(category, f"{context} review finding severity must stay within the stable contract"))
        rebuttal = finding.get("rebuttal")
        if rebuttal is not None and (not isinstance(rebuttal, str) or not rebuttal):
            failures.append(
                Failure(category, f"{context} review finding `rebuttal` must be `null` or a non-empty string")
            )
        disposition = finding.get("disposition")
        if disposition is not None:
            if not isinstance(disposition, dict):
                failures.append(Failure(category, f"{context} review finding disposition must be `null` or an object"))
                continue
            if disposition.get("status") not in REVIEW_FINDING_DISPOSITION_STATUSES:
                failures.append(Failure(category, f"{context} review finding disposition status must stay within the stable contract"))
            if not isinstance(disposition.get("summary"), str) or not disposition.get("summary"):
                failures.append(Failure(category, f"{context} review finding disposition must include non-empty `summary`"))


def require_execution_budget_risk_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must include `budget_risk` as an object"))
        return
    if payload.get("schema_version") != governance_surface_module.LOOM_EXECUTION_BUDGET_RISK_SCHEMA:
        failures.append(
            Failure(
                category,
                f"{context} budget_risk schema_version must be `{governance_surface_module.LOOM_EXECUTION_BUDGET_RISK_SCHEMA}`",
            )
        )
    extra_fields = set(payload.keys()) - EXECUTION_BUDGET_RISK_STABLE_FIELDS
    if extra_fields:
        failures.append(Failure(category, f"{context} budget_risk must stay in stable field vocabulary"))
    if payload.get("status") not in governance_surface_module.LOOM_EXECUTION_BUDGET_STATUS:
        failures.append(Failure(category, f"{context} budget_risk status must stay within the stable contract"))
    if payload.get("enforcement") != "advisory":
        failures.append(Failure(category, f"{context} budget_risk enforcement must stay `advisory`"))
    if payload.get("highest_risk") not in governance_surface_module.LOOM_EXECUTION_BUDGET_RISK_LEVELS:
        failures.append(Failure(category, f"{context} budget_risk highest_risk must stay within the stable contract"))
    risk_dimensions = payload.get("risk_dimensions")
    if not isinstance(risk_dimensions, list):
        failures.append(Failure(category, f"{context} budget_risk risk_dimensions must be a list"))
    elif any(not isinstance(item, str) or item not in EXECUTION_BUDGET_DIMENSION_IDS for item in risk_dimensions):
        failures.append(Failure(category, f"{context} budget_risk risk_dimensions must use stable dimension ids"))
    if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
        failures.append(Failure(category, f"{context} budget_risk must include non-empty `summary`"))


def require_review_run_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expected_result: set[str],
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must return a JSON object"))
        return
    if payload.get("command") != "review":
        failures.append(Failure(category, f"{context} must report `command: review`"))
    if payload.get("operation") != "run":
        failures.append(Failure(category, f"{context} must report `operation: run`"))
    if payload.get("result") not in expected_result:
        failures.append(Failure(category, f"{context} returned an unexpected result"))
    for key in ("item", "state_check", "runtime_evidence", "build_checkpoint", "review", "current_checkpoint", "engine", "manual_review"):
        if not isinstance(payload.get(key), dict):
            failures.append(Failure(category, f"{context} must include `{key}`"))
    require_runtime_state_payload(
        failures,
        category=category,
        context=context,
        payload=payload.get("runtime_state"),
        allowed_results={"pass", "block"},
    )
    engine = payload.get("engine")
    if not isinstance(engine, dict):
        return
    engine_adapter = engine.get("adapter")
    if engine_adapter not in {"loom/default-codex-exec", "loom/codex-app-review"}:
        failures.append(Failure(category, f"{context} adapter must be a supported authoritative review adapter"))
    expected_engine = "codex-app-review" if engine_adapter == "loom/codex-app-review" else "codex"
    if engine.get("engine") != expected_engine:
        failures.append(Failure(category, f"{context} engine must match the selected authoritative adapter"))
    profile = engine.get("profile")
    if engine.get("result") == "not_run" and profile is None and engine.get("failure_reason") == "runtime_conflict":
        pass
    elif not isinstance(profile, dict):
        failures.append(Failure(category, f"{context} engine profile must include the resolved review engine profile"))
    else:
        if profile.get("schema_version") != "loom-review-engine-profile/v1":
            failures.append(Failure(category, f"{context} engine profile schema must stay `loom-review-engine-profile/v1`"))
        if profile.get("adapter") != engine_adapter or profile.get("engine") != expected_engine:
            failures.append(Failure(category, f"{context} engine profile must bind the selected adapter explicitly"))
        if profile.get("profile_id") not in {"default", "high-risk", "spec-review", "repeated-blocker"}:
            failures.append(Failure(category, f"{context} engine profile id must stay within the stable vocabulary"))
        for key in ("model", "reasoning_effort", "context_policy", "selection_reason"):
            if not isinstance(profile.get(key), str) or not profile.get(key):
                failures.append(Failure(category, f"{context} engine profile must include non-empty `{key}`"))
        if profile.get("reasoning_effort") not in {"low", "medium", "high", "xhigh"}:
            failures.append(Failure(category, f"{context} engine profile reasoning effort must stay within the stable vocabulary"))
        timeout_seconds = profile.get("timeout_seconds")
        if timeout_seconds is not None and (not isinstance(timeout_seconds, int) or timeout_seconds <= 0):
            failures.append(Failure(category, f"{context} engine profile timeout must be null or a positive integer"))
        if "override" in profile:
            override = profile.get("override")
            if not isinstance(override, dict):
                failures.append(Failure(category, f"{context} engine profile override must be an object"))
            else:
                for key in ("previous_profile", "selected_profile"):
                    if not isinstance(override.get(key), dict):
                        failures.append(Failure(category, f"{context} engine profile override must include `{key}`"))
                if not isinstance(override.get("reason"), str) or not override.get("reason"):
                    failures.append(Failure(category, f"{context} engine profile override must include a non-empty reason"))
    if engine.get("result") not in {"pass", "block", "not_run"}:
        failures.append(Failure(category, f"{context} engine result must stay within the stable contract"))
    if engine.get("failure_reason") not in {None, "engine_unavailable", "schema_drift", "runtime_conflict", "repo_diff_detected"}:
        failures.append(Failure(category, f"{context} engine failure reason must stay within the stable contract"))
    evidence = engine.get("evidence")
    if engine.get("result") == "not_run":
        if evidence is not None:
            failures.append(Failure(category, f"{context} engine evidence must be null when the engine is not run"))
    else:
        if not isinstance(evidence, dict):
            failures.append(Failure(category, f"{context} engine must include `evidence` when it runs"))
        else:
            for key in ("runtime_root", "prompt", "raw_result", "normalized_findings", "metadata", "context_pack"):
                value = evidence.get(key)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} engine evidence must include non-empty `{key}`"))
    manual_review = payload.get("manual_review")
    if isinstance(manual_review, dict):
        if not isinstance(manual_review.get("summary"), str) or not manual_review.get("summary"):
            failures.append(Failure(category, f"{context} manual_review must include non-empty `summary`"))
        if not isinstance(manual_review.get("review_record_path"), str) or not manual_review.get("review_record_path"):
            failures.append(Failure(category, f"{context} manual_review must include `review_record_path`"))
        if manual_review.get("recommended_kind") not in {"general_review", "code_review", "spec_review"}:
            failures.append(Failure(category, f"{context} manual_review recommended kind must stay within the stable contract"))
        if not isinstance(manual_review.get("command"), list):
            failures.append(Failure(category, f"{context} manual_review must include `command` as a list"))
    review_record_input = payload.get("review_record_input")
    if payload.get("result") == "pass":
        if not isinstance(review_record_input, dict):
            failures.append(Failure(category, f"{context} must include `review_record_input` when engine review passes"))
        else:
            for key in ("decision", "summary", "reviewer", "kind", "findings_file", "engine_adapter", "engine_evidence", "normalized_findings", "context_pack"):
                value = review_record_input.get(key)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} review_record_input must include non-empty `{key}`"))
            if not isinstance(review_record_input.get("engine_profile"), dict):
                failures.append(Failure(category, f"{context} review_record_input must include resolved `engine_profile`"))
            if review_record_input.get("decision") not in {"allow", "block", "fallback"}:
                failures.append(Failure(category, f"{context} review_record_input decision must stay within the stable contract"))
            if review_record_input.get("reviewer") != engine_adapter:
                failures.append(Failure(category, f"{context} review_record_input reviewer must match the selected adapter"))
            if review_record_input.get("engine_adapter") != engine_adapter:
                failures.append(Failure(category, f"{context} review_record_input engine_adapter must match the selected adapter"))
    shadow_engine = payload.get("shadow_engine")
    if shadow_engine is not None:
        if not isinstance(shadow_engine, dict):
            failures.append(Failure(category, f"{context} shadow_engine must be an object when present"))
        else:
            if shadow_engine.get("adapter") != "loom/codex-app-review":
                failures.append(Failure(category, f"{context} shadow_engine adapter must stay shadow-only `loom/codex-app-review`"))
            if shadow_engine.get("result") not in {"pass", "block", "unavailable"}:
                failures.append(Failure(category, f"{context} shadow_engine result must stay within the stable shadow contract"))
            if shadow_engine.get("authoritative") is not False:
                failures.append(Failure(category, f"{context} shadow_engine must declare authoritative=false"))
            if shadow_engine.get("blocking") is not False:
                failures.append(Failure(category, f"{context} shadow_engine must not block review or merge-ready"))
            evidence = shadow_engine.get("evidence")
            if not isinstance(evidence, dict):
                failures.append(Failure(category, f"{context} shadow_engine must include runtime evidence locators"))
            else:
                for key in ("runtime_root", "raw_review", "normalized_findings", "metadata", "parity_diff"):
                    if not isinstance(evidence.get(key), str) or not evidence.get(key):
                        failures.append(Failure(category, f"{context} shadow_engine evidence must include non-empty `{key}`"))
    engine_metadata = payload.get("engine_metadata")
    if engine_adapter == "loom/codex-app-review" and engine.get("result") == "pass":
        if not isinstance(engine_metadata, dict):
            failures.append(Failure(category, f"{context} app review pass must expose `engine_metadata`"))
        else:
            for key in ("selected_adapter", "selection_source", "app_server", "thread_id", "thread_cwd", "raw_result", "normalized_findings", "context_pack", "reviewed_head"):
                value = engine_metadata.get(key)
                if not isinstance(value, str) or not value:
                    failures.append(Failure(category, f"{context} app review metadata must include non-empty `{key}`"))
            if engine_metadata.get("selected_adapter") != "loom/codex-app-review":
                failures.append(Failure(category, f"{context} app review metadata must bind the selected adapter"))
            if "normalized review_record_input only" not in str(engine_metadata.get("authority_boundary", "")):
                failures.append(Failure(category, f"{context} app review metadata must keep raw App output outside merge-ready truth"))


def require_runtime_state_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expected_scene: str | None = None,
    expected_carrier: str | None = None,
    allowed_results: set[str] | None = None,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must include `runtime_state` as an object"))
        return
    if payload.get("result") not in (allowed_results or {"pass", "block"}):
        failures.append(Failure(category, f"{context} runtime_state.result must stay within the stable contract"))
    if expected_scene is not None and payload.get("scene") != expected_scene:
        failures.append(Failure(category, f"{context} runtime_state.scene must be `{expected_scene}`"))
    if expected_carrier is not None and payload.get("carrier") != expected_carrier:
        failures.append(Failure(category, f"{context} runtime_state.carrier must be `{expected_carrier}`"))
    if payload.get("entry_family") not in {"loom-init", "loom-flow"}:
        failures.append(Failure(category, f"{context} runtime_state.entry_family must stay within the stable contract"))
    if not isinstance(payload.get("runtime_root"), str) or not payload.get("runtime_root"):
        failures.append(Failure(category, f"{context} runtime_state must include non-empty `runtime_root`"))
    checks = payload.get("checks")
    if not isinstance(checks, dict):
        failures.append(Failure(category, f"{context} runtime_state must include `checks`"))
        return
    for key in ("scene_marker", "carrier_layout", "registry_contract", "shared_runtime", "referenced_resources"):
        check = checks.get(key)
        if not isinstance(check, dict):
            failures.append(Failure(category, f"{context} runtime_state must include check `{key}`"))
            continue
        if check.get("status") not in {"pass", "block", "not_applicable"}:
            failures.append(Failure(category, f"{context} runtime_state check `{key}` returned an unknown status"))
        if not isinstance(check.get("summary"), str) or not check.get("summary"):
            failures.append(Failure(category, f"{context} runtime_state check `{key}` must include non-empty `summary`"))


def require_execution_attempt_summary(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expected_operation: str,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must include `execution_attempt`"))
        return
    if payload.get("schema_version") != loom_flow_module.EXECUTION_ATTEMPT_SCHEMA:
        failures.append(Failure(category, f"{context} execution_attempt schema must stay stable"))
    if payload.get("operation") != expected_operation:
        failures.append(Failure(category, f"{context} execution_attempt operation must be `{expected_operation}`"))
    if payload.get("result") not in {"pass", "block", "fallback"}:
        failures.append(Failure(category, f"{context} execution_attempt result must stay within the stable contract"))
    if payload.get("failure_category") not in loom_flow_module.EXECUTION_ATTEMPT_FAILURE_CATEGORIES:
        failures.append(Failure(category, f"{context} execution_attempt failure_category is outside the stable vocabulary"))
    if payload.get("execution_classification") not in loom_flow_module.EXECUTION_FAILURE_CLASSIFICATIONS:
        failures.append(Failure(category, f"{context} execution_attempt execution_classification is outside the stable vocabulary"))
    if not isinstance(payload.get("execution_summary"), str) or not str(payload.get("execution_summary")).strip():
        failures.append(Failure(category, f"{context} execution_attempt must include a non-empty execution_summary"))
    evidence = payload.get("evidence")
    if not isinstance(evidence, dict):
        failures.append(Failure(category, f"{context} execution_attempt must include evidence"))
        return
    if evidence.get("status") not in {"present", "missing", "invalid"}:
        failures.append(Failure(category, f"{context} execution_attempt evidence.status must be stable"))
    if evidence.get("status") == "present":
        for field in ("locator", "latest_locator"):
            if not isinstance(evidence.get(field), str) or not evidence.get(field):
                failures.append(Failure(category, f"{context} execution_attempt evidence must include `{field}`"))


def structured_event_evidence_errors(payload: object, *, context: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        return [f"{context} event evidence must be an object"]
    if payload.get("schema_version") != EVENT_EVIDENCE_SCHEMA:
        errors.append(f"{context} schema_version must be `{EVENT_EVIDENCE_SCHEMA}`")
    for field in ("item_id", "session_id", "attempt_id", "event_id", "summary", "observed_at"):
        if not isinstance(payload.get(field), str) or not payload.get(field):
            errors.append(f"{context} must include non-empty `{field}`")
    if payload.get("event_type") not in EVENT_EVIDENCE_TYPES:
        errors.append(f"{context} event_type is outside the stable vocabulary")
    if payload.get("result") not in EVENT_EVIDENCE_RESULTS:
        errors.append(f"{context} result is outside the stable vocabulary")
    for field in ("source", "subject", "provenance"):
        if not isinstance(payload.get(field), dict):
            errors.append(f"{context} must include `{field}` as an object")
    source = payload.get("source")
    if isinstance(source, dict):
        if not isinstance(source.get("kind"), str) or not source.get("kind"):
            errors.append(f"{context} source.kind must be non-empty")
        if not isinstance(source.get("locator"), str) or not source.get("locator"):
            errors.append(f"{context} source.locator must be non-empty")
    subject = payload.get("subject")
    if isinstance(subject, dict):
        if subject.get("kind") not in {"item", "session", "attempt", "tool", "validation", "failure", "tracker"}:
            errors.append(f"{context} subject.kind is outside the stable vocabulary")
        if not isinstance(subject.get("locator"), str) or not subject.get("locator"):
            errors.append(f"{context} subject.locator must be non-empty")
    provenance = payload.get("provenance")
    if isinstance(provenance, dict):
        if provenance.get("authority") != "event_evidence":
            errors.append(f"{context} provenance.authority must be `event_evidence`")
        if provenance.get("truth_boundary") != "evidence_only":
            errors.append(f"{context} provenance.truth_boundary must be `evidence_only`")
    forbidden = sorted(EVENT_EVIDENCE_FORBIDDEN_AUTHORED_FIELDS.intersection(payload))
    if forbidden:
        errors.append(f"{context} event evidence must not carry authored truth fields: {', '.join(forbidden)}")
    return errors


def require_structured_event_evidence(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    for error in structured_event_evidence_errors(payload, context=context):
        failures.append(Failure(category, error))


def require_fact_chain_provenance(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must return a JSON object"))
        return
    provenance = payload.get("provenance")
    if not isinstance(provenance, list) or not provenance:
        failures.append(Failure(category, f"{context} must include non-empty `provenance`"))
    else:
        allowed_kinds = {
            "authored_truth",
            "host_control_mirror",
            "retained_result",
            "derived_surface",
            "runtime_state",
            "runtime_evidence",
        }
        for entry in provenance:
            if not isinstance(entry, dict):
                failures.append(Failure(category, f"{context} provenance entries must be objects"))
                continue
            for field in ("kind", "carrier", "field", "authority", "freshness", "trusted_because"):
                if not isinstance(entry.get(field), str) or not entry.get(field):
                    failures.append(Failure(category, f"{context} provenance entries must include `{field}`"))
            if entry.get("kind") not in allowed_kinds:
                failures.append(Failure(category, f"{context} provenance kind must stay within the stable vocabulary"))
            if not isinstance(entry.get("path"), str) and not isinstance(entry.get("locator"), str):
                failures.append(Failure(category, f"{context} provenance entries must include `path` or `locator`"))
    readiness = payload.get("recovery_readiness")
    if not isinstance(readiness, dict):
        failures.append(Failure(category, f"{context} must include `recovery_readiness`"))
    else:
        if readiness.get("result") not in {"pass", "block"}:
            failures.append(Failure(category, f"{context} recovery_readiness.result must be pass or block"))
        if not isinstance(readiness.get("summary"), str) or not readiness.get("summary"):
            failures.append(Failure(category, f"{context} recovery_readiness must include a summary"))
        if not isinstance(readiness.get("missing_inputs"), list):
            failures.append(Failure(category, f"{context} recovery_readiness must include `missing_inputs`"))
    blocking_failures = payload.get("blocking_failures")
    if not isinstance(blocking_failures, list):
        failures.append(Failure(category, f"{context} must include `blocking_failures`"))


def require_route_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expected_skill: str,
    expected_mode: str,
    expected_runtime_scene: str | None = None,
    expected_runtime_carrier: str | None = None,
    allowed_results: set[str] | None = None,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must return a JSON object"))
        return
    if payload.get("command") != "route":
        failures.append(Failure(category, f"{context} must report `command: route`"))
    if payload.get("result") not in (allowed_results or {"pass"}):
        failures.append(Failure(category, f"{context} result must stay within the stable contract"))
    if payload.get("selected_skill") != expected_skill:
        failures.append(Failure(category, f"{context} must select `{expected_skill}`"))
    if payload.get("mode") != expected_mode:
        failures.append(Failure(category, f"{context} must report `mode: {expected_mode}`"))
    if not isinstance(payload.get("matched_signals"), list):
        failures.append(Failure(category, f"{context} must include `matched_signals`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs`"))
    if payload.get("fallback_to") not in {"loom-init", "refresh-install", "rebootstrap-runtime", "manual-runtime-reconciliation", None}:
        failures.append(Failure(category, f"{context} fallback must stay within the stable contract"))
    if expected_runtime_scene is not None or expected_runtime_carrier is not None:
        require_runtime_state_payload(
            failures,
            category=category,
            context=context,
            payload=payload.get("runtime_state"),
            expected_scene=expected_runtime_scene,
            expected_carrier=expected_runtime_carrier,
            allowed_results={"pass", "block"},
        )


def check_root_route_contracts(root: Path) -> list[Failure]:
    category = "skill-routing-contract"
    failures: list[Failure] = []
    readme_path = root / "README.md"
    readme_zh_path = root / "README.zh-CN.md"
    skills_readme_path = root / "skills/README.md"
    skills_readme_zh_path = root / "skills/README.zh-CN.md"
    route_matrix_path = root / "skills/route-matrix.md"
    contract_path = root / "skills/loom-init/contract.json"

    try:
        readme = load_text_file(readme_path)
        readme_zh = load_text_file(readme_zh_path)
        skills_readme = load_text_file(skills_readme_path)
        skills_readme_zh = load_text_file(skills_readme_zh_path)
        route_matrix = load_text_file(route_matrix_path)
        contract = load_json_file(contract_path)
    except FileNotFoundError:
        return failures
    except json.JSONDecodeError as exc:
        return [Failure(category, f"`skills/loom-init/contract.json` is invalid JSON: {exc.msg}")]

    if not isinstance(contract, dict):
        return [Failure(category, "`skills/loom-init/contract.json` must be a JSON object")]

    if "agent-first project operating layer" not in readme:
        failures.append(Failure(category, "`README.md` must present Loom as an agent-first project operating layer"))
    if "Advanced / Compatibility" not in readme:
        failures.append(Failure(category, "`README.md` must keep single-skill installation as an advanced compatibility path"))
    if "[中文版本](./README.zh-CN.md)" not in readme or "[English version](./README.md)" not in readme_zh:
        failures.append(Failure(category, "root README language switch links must stay in sync"))
    if "agent-first project operating layer" not in readme_zh:
        failures.append(Failure(category, "`README.zh-CN.md` must preserve the Chinese operating-layer positioning"))
    if "unique root entry" not in skills_readme:
        failures.append(Failure(category, "`skills/README.md` must keep `loom-init` as the unique root entry"))
    if "[中文版本](./README.zh-CN.md)" not in skills_readme or "[English version](./README.md)" not in skills_readme_zh:
        failures.append(Failure(category, "skills README language switch links must stay in sync"))
    if "唯一的 root entry" not in skills_readme_zh:
        failures.append(Failure(category, "`skills/README.zh-CN.md` must preserve the Chinese root-entry explanation"))
    if "显式 skill 名称调用优先" not in route_matrix:
        failures.append(Failure(category, "`skills/route-matrix.md` must keep explicit routing as the first priority"))
    if "若无法稳定判断，回退到 `loom-init`" not in route_matrix:
        failures.append(Failure(category, "`skills/route-matrix.md` must keep fallback-to-loom-init semantics"))
    if "`plugin` 与 `single-skill` 两类安装结果边界" not in route_matrix and "fallback_to: \"loom-init\"" not in route_matrix:
        failures.append(Failure(category, "`skills/route-matrix.md` must keep the stable fallback payload contract"))

    if contract.get("id") != "loom-init":
        failures.append(Failure(category, "`skills/loom-init/contract.json` id must remain `loom-init`"))
    if contract.get("root_entry") is not True:
        failures.append(Failure(category, "`skills/loom-init/contract.json` must keep `root_entry: true`"))

    routing = contract.get("routing")
    if not isinstance(routing, dict):
        failures.append(Failure(category, "`skills/loom-init/contract.json` must declare `routing`"))
    else:
        if routing.get("reference") not in {"../route-matrix.md", ".loom-runtime/route-matrix.md"}:
            failures.append(Failure(category, "`skills/loom-init/contract.json` must reference the generated route matrix"))
        if routing.get("fallback_entry") != "loom-init":
            failures.append(Failure(category, "`skills/loom-init/contract.json` fallback entry must remain `loom-init`"))
        if routing.get("priority_order") != [
            "explicit skill name",
            "task signal routing",
            "fallback to loom-init with missing inputs",
        ]:
            failures.append(Failure(category, "`skills/loom-init/contract.json` routing priority order drifted from the stable contract"))

    installation_commands = (
        "npx @mc-and-his-agents/loom-installer add plugin",
        "npx @mc-and-his-agents/loom-installer add skill <skill-id>",
    )
    for command in installation_commands:
        if command not in skills_readme:
            failures.append(Failure(category, f"`skills/README.md` must document `{command}`"))
        if command not in skills_readme_zh:
            failures.append(Failure(category, f"`skills/README.zh-CN.md` must document `{command}`"))
    if "git clone https://github.com/MC-and-his-Agents/Loom.git ~/.codex/loom" not in readme:
        failures.append(Failure(category, "`README.md` must document native skills-library installation"))
    if "git clone https://github.com/MC-and-his-Agents/Loom.git ~/.codex/loom" not in readme_zh:
        failures.append(Failure(category, "`README.zh-CN.md` must document native skills-library installation"))

    return failures


def check_skill_manifests(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    expected_entries = {
        "loom-init": "bootstrap/root",
        "loom-adopt": "scenario/adopt",
        "loom-resume": "scenario/resume",
        "loom-build": "scenario/build",
        "loom-story": "scenario/story",
        "loom-pre-review": "scenario/pre-review",
        "loom-review": "scenario/review",
        "loom-spec-review": "scenario/spec-review",
        "loom-handoff": "scenario/handoff",
        "loom-retire": "scenario/retire",
        "loom-merge-ready": "scenario/merge-ready",
    }
    registry_path = root / "skills/registry.json"
    upgrade_contract_path = root / "skills/upgrade-contract.json"

    for candidate in (registry_path, upgrade_contract_path):
        if not candidate.exists():
            return failures

    try:
        registry = load_json_file(registry_path)
    except json.JSONDecodeError as exc:
        return [Failure("skill-manifests", f"`skills/registry.json` is invalid JSON: {exc.msg}")]

    try:
        upgrade_contract = load_json_file(upgrade_contract_path)
    except json.JSONDecodeError as exc:
        return [Failure("skill-manifests", f"`skills/upgrade-contract.json` is invalid JSON: {exc.msg}")]

    if not isinstance(registry, dict):
        failures.append(Failure("skill-manifests", "`skills/registry.json` must be a JSON object"))
        return failures
    if not isinstance(upgrade_contract, dict):
        failures.append(Failure("skill-manifests", "`skills/upgrade-contract.json` must be a JSON object"))
        return failures

    registry_version = registry.get("registry_version")
    root_entry = registry.get("root_entry")
    entries = registry.get("entries")
    upgrade_reference = registry.get("upgrade_contract")
    install_layout_reference = registry.get("install_layout")
    layout_manifest: dict[str, object] | None = None
    if registry_version != upgrade_contract.get("registry_version"):
        failures.append(Failure("skill-manifests", "`skills/upgrade-contract.json` registry version must match `skills/registry.json`"))
    if install_layout_reference != "install-layout.json":
        failures.append(Failure("skill-manifests", "`skills/registry.json` must point `install_layout` to `install-layout.json`"))
    else:
        install_layout_path = registry_path.parent / install_layout_reference
        if not install_layout_path.exists():
            failures.append(Failure("skill-manifests", "`skills/install-layout.json` must exist"))
        else:
            try:
                candidate_layout = load_json_file(install_layout_path)
            except json.JSONDecodeError as exc:
                failures.append(Failure("skill-manifests", f"`skills/install-layout.json` is invalid JSON: {exc.msg}"))
            else:
                layout_manifest = candidate_layout
                required_paths = candidate_layout.get("required_paths")
                if not isinstance(required_paths, list) or not required_paths:
                    failures.append(Failure("skill-manifests", "`skills/install-layout.json` must declare a non-empty `required_paths`"))
                else:
                    for relative in required_paths:
                        if not isinstance(relative, str) or not relative:
                            failures.append(Failure("skill-manifests", "`skills/install-layout.json` required paths must be non-empty strings"))
                            continue
                        if not (registry_path.parent / relative).exists():
                            failures.append(Failure("skill-manifests", f"`skills/install-layout.json` points to missing path `{relative}`"))
                runtime_state = candidate_layout.get("runtime_state")
                if not isinstance(runtime_state, dict):
                    failures.append(Failure("skill-manifests", "`skills/install-layout.json` must declare `runtime_state`"))
                else:
                    recognized_states = runtime_state.get("recognized_states")
                    if recognized_states != ["installed-runtime", "repo-local-demo", "upgrade-rehearsal"]:
                        failures.append(
                            Failure(
                                "skill-manifests",
                                "`skills/install-layout.json` runtime_state recognized_states must stay in the stable order",
                            )
                        )
    if not isinstance(root_entry, str) or not root_entry:
        failures.append(Failure("skill-manifests", "`skills/registry.json` must declare a non-empty `root_entry`"))
        return failures
    if not isinstance(entries, list) or not entries:
        failures.append(Failure("skill-manifests", "`skills/registry.json` must declare at least one entry"))
        return failures
    if root_entry != "loom-init":
        failures.append(Failure("skill-manifests", "`skills/registry.json` root entry must remain `loom-init`"))

    root_registry_entry: dict[str, object] | None = None
    seen_ids: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            failures.append(Failure("skill-manifests", "every registry entry must be an object"))
            continue
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not entry_id:
            failures.append(Failure("skill-manifests", "every registry entry must declare a non-empty `id`"))
            continue
        if entry_id in seen_ids:
            failures.append(Failure("skill-manifests", f"registry declares duplicate entry `{entry_id}`"))
            continue
        seen_ids.add(entry_id)
        if entry_id == root_entry:
            root_registry_entry = entry
        expected_role = expected_entries.get(entry_id)
        if expected_role is None:
            failures.append(Failure("skill-manifests", f"registry declares unexpected entry `{entry_id}`"))
        elif entry.get("role") != expected_role:
            failures.append(Failure("skill-manifests", f"registry entry `{entry_id}` must declare role `{expected_role}`"))

        for field in ("role", "contract_version", "manifest", "executable"):
            value = entry.get(field)
            if not isinstance(value, str) or not value:
                failures.append(Failure("skill-manifests", f"registry entry `{entry_id}` must declare `{field}`"))

        manifest_path = entry.get("manifest")
        if not isinstance(manifest_path, str) or not manifest_path:
            continue
        manifest_file = registry_path.parent / manifest_path
        if not manifest_file.exists():
            failures.append(Failure("skill-manifests", f"registry entry `{entry_id}` points to missing manifest `{manifest_path}`"))
            continue
        executable_path = entry.get("executable")
        if isinstance(executable_path, str) and executable_path:
            if not (registry_path.parent / executable_path).resolve().exists():
                failures.append(
                    Failure("skill-manifests", f"registry entry `{entry_id}` points to missing executable `{executable_path}`")
                )

        try:
            contract = load_json_file(manifest_file)
        except json.JSONDecodeError as exc:
            failures.append(Failure("skill-manifests", f"`{manifest_path}` is invalid JSON: {exc.msg}"))
            continue
        if not isinstance(contract, dict):
            failures.append(Failure("skill-manifests", f"`{manifest_path}` must be a JSON object"))
            continue

        if contract.get("id") != entry_id:
            failures.append(Failure("skill-manifests", f"`{manifest_path}` id must match registry entry `{entry_id}`"))
        if contract.get("role") != entry.get("role"):
            failures.append(Failure("skill-manifests", f"`{manifest_path}` role must match registry entry `{entry_id}`"))
        if contract.get("contract_version") != entry.get("contract_version"):
            failures.append(Failure("skill-manifests", f"`{manifest_path}` contract version must match registry entry `{entry_id}`"))

        contract_root = contract.get("root_entry")
        if entry_id == root_entry:
            if contract_root is not True:
                failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `root_entry: true`"))
        elif contract_root is not False:
            failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `root_entry: false`"))

        entrypoint = contract.get("entrypoint")
        if not isinstance(entrypoint, dict):
            failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `entrypoint`"))
        else:
            required_entrypoint_keys = {"skill_markdown", "adapter_metadata"}
            if entry_id == "loom-init":
                required_entrypoint_keys.add("bootstrap_cli")
                required_entrypoint_keys.add("route_cli")
            else:
                required_entrypoint_keys.add("orchestration_cli")
            for key in required_entrypoint_keys:
                value = entrypoint.get(key)
                if not isinstance(value, str) or not value:
                    failures.append(Failure("skill-manifests", f"`{manifest_path}` missing `entrypoint.{key}`"))
                    continue
                if not (manifest_file.parent / value).exists():
                    failures.append(Failure("skill-manifests", f"`{manifest_path}` points `entrypoint.{key}` to missing `{value}`"))

        for section in ("input_contract", "output_contract", "routing"):
            value = contract.get(section)
            if not isinstance(value, dict):
                failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `{section}`"))
                continue
            reference = value.get("reference")
            if not isinstance(reference, str) or not reference:
                failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `{section}.reference`"))
                continue
            if not (manifest_file.parent / reference).exists():
                failures.append(Failure("skill-manifests", f"`{manifest_path}` points `{section}.reference` to missing `{reference}`"))

        output_contract = contract.get("output_contract")
        if isinstance(output_contract, dict) and entry_id in GOVERNANCE_SURFACE_CONTRACT_SKILLS:
            required_sections = output_contract.get("required_sections")
            if not isinstance(required_sections, list):
                failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `output_contract.required_sections`"))
            elif "governance_surface" not in required_sections:
                failures.append(
                    Failure(
                        "skill-manifests",
                        f"`{manifest_path}` must require `governance_surface` in `output_contract.required_sections`",
                    )
                )

        installation = contract.get("installation")
        if not isinstance(installation, dict):
            failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `installation`"))
        else:
            for field in ("registry", "upgrade_contract", "layout_manifest"):
                value = installation.get(field)
                if not isinstance(value, str) or not value:
                    failures.append(Failure("skill-manifests", f"`{manifest_path}` must declare `installation.{field}`"))
                    continue
                if not (manifest_file.parent / value).exists():
                    failures.append(Failure("skill-manifests", f"`{manifest_path}` points `installation.{field}` to missing `{value}`"))

    if root_registry_entry is None:
        failures.append(Failure("skill-manifests", f"`skills/registry.json` root entry `{root_entry}` does not match any declared entry"))
        return failures
    if seen_ids != set(expected_entries):
        missing = sorted(set(expected_entries) - seen_ids)
        extra = sorted(seen_ids - set(expected_entries))
        if missing:
            failures.append(Failure("skill-manifests", f"registry is missing first-wave entries: {', '.join(missing)}"))
        if extra:
            failures.append(Failure("skill-manifests", f"registry contains unexpected first-wave entries: {', '.join(extra)}"))
    if upgrade_reference != "upgrade-contract.json":
        failures.append(Failure("skill-manifests", "`skills/registry.json` must point to `upgrade-contract.json`"))

    upgrade_root = upgrade_contract.get("root_entry")
    current_contract_version = upgrade_contract.get("current_contract_version")
    upgrade_policy = upgrade_contract.get("upgrade_policy")
    if upgrade_root != root_entry:
        failures.append(
            Failure(
                "skill-manifests",
                f"`skills/upgrade-contract.json` root entry `{upgrade_root}` does not match registry root `{root_entry}`",
            )
        )
    if current_contract_version != root_registry_entry.get("contract_version"):
        failures.append(
            Failure(
                "skill-manifests",
                "`skills/upgrade-contract.json` current contract version must match the registry entry version",
            )
        )
        if not isinstance(upgrade_policy, dict):
            failures.append(Failure("skill-manifests", "`skills/upgrade-contract.json` must declare `upgrade_policy`"))
    else:
        if upgrade_policy.get("mode") != "explicit":
            failures.append(Failure("skill-manifests", "`upgrade_policy.mode` must be `explicit`"))
        refresh_required = upgrade_policy.get("refresh_required")
        if not isinstance(refresh_required, list) or not refresh_required:
            failures.append(Failure("skill-manifests", "`upgrade_policy.refresh_required` must be a non-empty list"))
        else:
            required = {"registry", "manifest", "executable", "referenced_resources", "layout_manifest"}
            if not required.issubset(set(refresh_required)):
                failures.append(
                    Failure(
                        "skill-manifests",
                        "`upgrade_policy.refresh_required` must cover registry, manifest, executable, referenced_resources, and layout_manifest",
                    )
                )

    return failures


def check_skill_routing(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    target = root / "examples/new-project"
    tool_path = root / "tools/loom_init.py"
    if not tool_path.exists() or not target.exists():
        return failures

    registry = load_json_file(root / "skills/registry.json")
    if not isinstance(registry, dict):
        return failures
    entries = registry.get("entries")
    if not isinstance(entries, list):
        return failures
    explicit_skills = [
        entry.get("id")
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("id"), str) and entry.get("id")
    ]
    for skill_id in explicit_skills:
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_init.py", "route", "--target", "examples/new-project", "--skill", skill_id],
        )
        if error:
            failures.append(Failure("skill-routing", f"explicit route for `{skill_id}` failed: {error}"))
            continue
        require_route_payload(
            failures,
            category="skill-routing",
            context=f"explicit route for `{skill_id}`",
            payload=payload,
            expected_skill=skill_id,
            expected_mode="explicit",
            expected_runtime_scene="repo-local-demo",
            expected_runtime_carrier="repo-local-wrapper",
        )
        if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
            failures.append(Failure("skill-routing", f"explicit route for `{skill_id}` must include `summary`"))
        if skill_id in GOVERNANCE_SURFACE_ROUTE_SKILLS and payload.get("result") == "pass":
            require_governance_surface(
                failures,
                category="skill-routing",
                context=f"explicit route for `{skill_id}`",
                payload=payload,
            )

    implicit_cases = (
        ("请初始化这个新项目并接入 Loom", "loom-adopt"),
        ("请接手当前事项并恢复上下文后继续推进", "loom-resume"),
        ("请执行 build round 并集成 subagent 输出", "loom-build"),
        ("请把产品上下文整理成 user story 并检查 story readiness", "loom-story"),
        ("请在进入 review 前做统一检查", "loom-pre-review"),
        ("请先对 formal spec 做 spec review", "loom-spec-review"),
        ("请对当前事项做正式 review 并给出审查结论", "loom-review"),
        ("请准备交接并回写停点", "loom-handoff"),
        ("请清理并 retire 当前事项现场", "loom-retire"),
        ("请确认这个事项是否 merge-ready", "loom-merge-ready"),
    )
    for task, skill_id in implicit_cases:
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_init.py", "route", "--target", "examples/new-project", "--task", task],
        )
        if error:
            failures.append(Failure("skill-routing", f"implicit route for `{skill_id}` failed: {error}"))
            continue
        require_route_payload(
            failures,
            category="skill-routing",
            context=f"implicit route for `{skill_id}`",
            payload=payload,
            expected_skill=skill_id,
            expected_mode="implicit",
            expected_runtime_scene="repo-local-demo",
            expected_runtime_carrier="repo-local-wrapper",
        )
        if not isinstance(payload.get("matched_signals"), list) or not payload.get("matched_signals"):
            failures.append(Failure("skill-routing", f"implicit route for `{skill_id}` must include matched signals"))
        if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
            failures.append(Failure("skill-routing", f"implicit route for `{skill_id}` must include `summary`"))
        if skill_id in GOVERNANCE_SURFACE_ROUTE_SKILLS and payload.get("result") == "pass":
            require_governance_surface(
                failures,
                category="skill-routing",
                context=f"implicit route for `{skill_id}`",
                payload=payload,
            )

    fallback_payload, error = load_command_json(
        root,
        ["python3", "tools/loom_init.py", "route", "--target", "examples/new-project", "--task", "请帮我看看这个仓库"],
    )
    if error:
        failures.append(Failure("skill-routing", f"fallback route failed: {error}"))
    else:
        require_route_payload(
            failures,
            category="skill-routing",
            context="fallback route",
            payload=fallback_payload,
            expected_skill="loom-init",
            expected_mode="fallback",
            expected_runtime_scene="repo-local-demo",
            expected_runtime_carrier="repo-local-wrapper",
            allowed_results={"fallback"},
        )
        if not isinstance(fallback_payload.get("missing_inputs"), list) or not fallback_payload.get("missing_inputs"):
            failures.append(Failure("skill-routing", "fallback route must include `missing_inputs`"))

    ambiguous_payload, error = load_command_json(
        root,
        [
            "python3",
            "tools/loom_init.py",
            "route",
            "--target",
            "examples/new-project",
            "--task",
            "请接手当前事项并在 review 前检查",
        ],
    )
    if error:
        failures.append(Failure("skill-routing", f"ambiguous route failed: {error}"))
    else:
        require_route_payload(
            failures,
            category="skill-routing",
            context="multi-match route",
            payload=ambiguous_payload,
            expected_skill="loom-init",
            expected_mode="fallback",
            expected_runtime_scene="repo-local-demo",
            expected_runtime_carrier="repo-local-wrapper",
            allowed_results={"fallback"},
        )
        if not isinstance(ambiguous_payload.get("matched_signals"), list) or len(ambiguous_payload.get("matched_signals", [])) < 2:
            failures.append(Failure("skill-routing", "multi-match route must expose matched signals"))

    unknown_payload, error = load_command_json(
        root,
        ["python3", "tools/loom_init.py", "route", "--target", "examples/new-project", "--skill", "not-a-skill"],
    )
    if error:
        failures.append(Failure("skill-routing", f"unknown explicit route failed: {error}"))
    else:
        require_route_payload(
            failures,
            category="skill-routing",
            context="unknown explicit route",
            payload=unknown_payload,
            expected_skill="loom-init",
            expected_mode="explicit",
            expected_runtime_scene="repo-local-demo",
            expected_runtime_carrier="repo-local-wrapper",
            allowed_results={"block"},
        )
        if "unknown skill" not in str(unknown_payload.get("summary", "")):
            failures.append(Failure("skill-routing", "unknown explicit skill must expose an `unknown skill` summary"))

    with tempfile.TemporaryDirectory(prefix="loom-check-route-registry-") as tmp:
        broken_skills = Path(tmp) / "skills"
        shutil.copytree(root / "skills", broken_skills)
        registry_path = broken_skills / "loom-init" / ".loom-runtime" / "registry.json"
        registry = load_json_file(registry_path)
        if isinstance(registry, dict):
            entries = registry.get("entries")
            if isinstance(entries, list):
                registry["entries"] = [
                    entry
                    for entry in entries
                    if not (isinstance(entry, dict) and entry.get("id") == "loom-review")
                ]
                registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        drift_payload, error = load_command_json(
            root,
            [
                "python3",
                str(broken_skills / "loom-init" / "scripts" / "loom-init.py"),
                "route",
                "--target",
                str(target),
                "--task",
                "请对当前事项做正式 review 并给出审查结论",
            ],
        )
        if error:
            failures.append(Failure("skill-routing", f"registry drift route failed: {error}"))
        else:
            require_route_payload(
                failures,
                category="skill-routing",
                context="registry drift route",
                payload=drift_payload,
                expected_skill="loom-init",
                expected_mode="implicit",
                expected_runtime_scene="installed-runtime",
                expected_runtime_carrier="installed-skills-root",
                allowed_results={"block"},
            )
            if "route table resolved to unknown registry skill" not in str(drift_payload.get("summary", "")):
                failures.append(Failure("skill-routing", "registry drift route must expose an unknown registry skill summary"))

    return failures


def check_demo_assets(root: Path) -> list[Failure]:
    failures = check_required_paths(root, "demo-assets", DEMO_ASSETS)

    init_result_path = root / "examples/new-project/.loom/bootstrap/init-result.json"
    if init_result_path.exists():
        try:
            init_result = load_json_file(init_result_path)
        except json.JSONDecodeError as exc:
            failures.append(Failure("demo-assets", f"demo init-result is invalid JSON: {exc.msg}"))
            return failures
        if not isinstance(init_result, dict):
            failures.append(Failure("demo-assets", "demo init-result must be a JSON object"))
            return failures
        run = init_result.get("run")
        if not isinstance(run, dict) or run.get("scenario_key") != "new":
            failures.append(Failure("demo-assets", "demo init-result must keep `scenario_key` as `new`"))
        governance_surface = init_result.get("governance_surface")
        if not isinstance(governance_surface, dict):
            failures.append(Failure("demo-assets", "demo init-result must include governance_surface"))
        else:
            require_gate_starter_payload(
                failures,
                category="demo-assets",
                context="demo init-result governance_surface.gate_starter",
                payload=governance_surface.get("gate_starter"),
            )
            gate_starter = governance_surface.get("gate_starter")
            if isinstance(gate_starter, dict) and gate_starter.get("host_enforcement") is not False:
                failures.append(Failure("demo-assets", "demo gate starter must not claim host enforcement"))
        require_lifecycle_expectations_payload(
            failures,
            category="demo-assets",
            context="demo init-result",
            payload=init_result.get("lifecycle_expectations"),
        )
    return failures


def check_demo_fact_chain(root: Path) -> list[Failure]:
    target = root / "examples/new-project"
    if not target.exists():
        return []

    report, errors = inspect_fact_chain(target)
    failures: list[Failure] = []
    for detail in errors:
        failures.append(Failure("demo-fact-chain", detail))
    if report and report.get("fact_chain", {}).get("entry_points", {}).get("status_surface") != ".loom/status/current.md":
        failures.append(Failure("demo-fact-chain", "demo fact chain must point status_surface to `.loom/status/current.md`"))
    head_result = run_command(root, ["git", "rev-parse", "HEAD"], timeout_seconds=30)
    if head_result.returncode == 0:
        head_binding, head_errors = review_head_binding(
            root,
            reviewed_head=head_result.stdout.strip(),
            allowed_paths=set(),
        )
        if head_errors or head_binding.get("status") != "fresh":
            failures.append(Failure("demo-fact-chain", "review head binding must report `fresh` for the current HEAD"))
    with tempfile.TemporaryDirectory(prefix="loom-check-metadata-spoof-") as tmp:
        spoof_target = Path(tmp) / "new-project"
        shutil.copytree(target, spoof_target)
        work_item_path = spoof_target / ".loom/work-items/INIT-0001.md"
        work_item_text = work_item_path.read_text(encoding="utf-8")
        work_item_path.write_text(
            work_item_text.replace(
                "- Goal: Bootstrap the first executable Loom path for this repository\n",
                "- Goal: wrong spoofed goal\n- Goal: Bootstrap the first executable Loom path for this repository\n",
                1,
            ),
            encoding="utf-8",
        )
        _, spoof_errors = inspect_fact_chain(spoof_target)
        if not any("duplicate field `Goal`" in error for error in spoof_errors):
            failures.append(Failure("demo-fact-chain", "fact-chain parser must reject duplicate canonical metadata fields"))

        runtime_spoof_target = Path(tmp) / "runtime-spoof"
        shutil.copytree(target, runtime_spoof_target)
        status_path = runtime_spoof_target / ".loom/status/current.md"
        status_text = status_path.read_text(encoding="utf-8")
        status_path.write_text(
            status_text.replace(
                "- Run Entry: not_applicable\n",
                "- Run Entry: wrong-spoofed-run\n- Run Entry: not_applicable\n",
                1,
            ),
            encoding="utf-8",
        )
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "fact-chain", "--target", str(runtime_spoof_target)],
        )
        if error:
            failures.append(Failure("demo-fact-chain", f"`flow fact-chain` metadata spoof sample failed unexpectedly: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("demo-fact-chain", "`flow fact-chain` must not legacy-fallback past duplicate Runtime Evidence fields"))
    return failures


def check_demo_repo_local_cli(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    target = root / "examples/new-project"
    if not target.exists():
        return failures

    repo_local_commands = [
        (
            "repo-local-verify",
            ["python3", ".loom/bin/loom_init.py", "verify", "--target", "."],
            "ok",
        ),
        (
            "repo-local-fact-chain",
            ["python3", ".loom/bin/loom_init.py", "fact-chain", "--target", "."],
            "ok",
        ),
    ]
    for label, args, expected_key in repo_local_commands:
        payload, error = load_command_json(root, args, cwd=target)
        if error:
            failures.append(Failure("demo-repo-local-cli", f"`{label}` failed: {error}"))
            continue
        if payload.get(expected_key) is not True:
            failures.append(Failure("demo-repo-local-cli", f"`{label}` must report `{expected_key}: true`"))
    return failures


def check_root_self_adoption_carrier(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    carrier_root = root / ".loom"
    if not carrier_root.exists():
        return failures
    active_item = "INIT-0001"
    init_result = load_json_file(root / ".loom/bootstrap/init-result.json")
    if isinstance(init_result, dict):
        entry_points = init_result.get("fact_chain", {}).get("entry_points")
        if isinstance(entry_points, dict) and isinstance(entry_points.get("current_item_id"), str):
            active_item = entry_points["current_item_id"]

    required_paths = (
        ".loom/bootstrap/manifest.json",
        ".loom/bootstrap/init-result.json",
        ".loom/bin/loom_init.py",
        ".loom/bin/loom_flow.py",
        ".loom/companion/README.md",
        ".loom/companion/manifest.json",
        ".loom/companion/repo-interface.json",
        ".loom/companion/interop.json",
        ".loom/work-items/INIT-0001.md",
        ".loom/progress/INIT-0001.md",
        ".loom/reviews/INIT-0001.json",
        ".loom/status/current.md",
        "docs/evidence/validations/validation-loom-self-governance-adoption.md",
    )
    failures.extend(check_required_paths(root, "root-self-adoption", required_paths))

    commands = (
        (
            "root verify",
            ["python3", ".loom/bin/loom_init.py", "verify", "--target", "."],
            "loom-init-verify",
            {"ok": True},
        ),
        (
            "root governance status",
            ["python3", ".loom/bin/loom_flow.py", "governance-profile", "status", "--target", "."],
            "governance-status",
            {"result": "pass"},
        ),
        (
            "root runtime parity",
            ["python3", ".loom/bin/loom_flow.py", "runtime-parity", "validate", "--target", "."],
            "runtime-parity",
            {"result": "pass", "schema_version": "loom-runtime-parity/v1"},
        ),
        (
            "root adopt verify",
            ["python3", ".loom/bin/loom_flow.py", "adopt", "verify", "--target", ".", "--item", active_item],
            "adopt-verify",
            {"result": "pass", "schema_version": "loom-adoption-verify/v1"},
        ),
        (
            "root carrier refresh",
            ["python3", ".loom/bin/loom_flow.py", "carrier", "refresh", "--target", ".", "--dry-run"],
            "carrier-refresh",
            {"schema_version": "loom-carrier-refresh/v1"},
        ),
        (
            "root shadow parity",
            ["python3", ".loom/bin/loom_flow.py", "shadow-parity", "--target", "."],
            "shadow-parity",
            {"result": "pass"},
        ),
    )
    for label, args, kind, expected in commands:
        payload, error = load_command_json(root, args)
        if error:
            failures.append(Failure("root-self-adoption", f"`{label}` failed: {error}"))
            continue
        for key, value in expected.items():
            if payload.get(key) != value:
                failures.append(Failure("root-self-adoption", f"`{label}` must report `{key}: {value}`"))
        runtime_payload = payload.get("runtime_state")
        if kind == "loom-init-verify":
            runtime_payload = payload.get("runtime_state")
        if runtime_payload is not None:
            require_runtime_state_payload(
                failures,
                category="root-self-adoption",
                context=f"`{label}`",
                payload=runtime_payload,
                expected_scene="installed-runtime",
                expected_carrier="bootstrapped-target-runtime",
                allowed_results={"pass"},
            )
        if kind == "governance-status":
            maturity = payload.get("maturity")
            if isinstance(maturity, dict) and maturity.get("current") == "strong":
                pass
            elif host_verification_unconfirmed(payload):
                missing_by_level = maturity.get("missing_by_level") if isinstance(maturity, dict) else {}
                strong_missing = missing_by_level.get("strong") if isinstance(missing_by_level, dict) else []
                if not isinstance(strong_missing, list) or "host_enforced_control_plane" not in strong_missing:
                    failures.append(Failure("root-self-adoption", "`root governance status` host-unavailable fallback must keep strong blocked on host enforcement"))
            else:
                failures.append(Failure("root-self-adoption", "`root governance status` must report strong maturity after self-management binding"))
        if kind == "runtime-parity":
            checks = payload.get("checks")
            names = {check.get("name") for check in checks if isinstance(check, dict)} if isinstance(checks, list) else set()
            if "shadow_parity_boundary" not in names or "controlled_merge_contract" not in names:
                failures.append(Failure("root-self-adoption", "`root runtime parity` must cover shadow and controlled merge boundaries"))
        if kind == "adopt-verify":
            roundtrip = payload.get("producer_consumer_roundtrip")
            if not isinstance(roundtrip, dict):
                failures.append(Failure("root-self-adoption", "`root adopt verify` must include producer_consumer_roundtrip"))
            elif roundtrip.get("bypass_check", {}).get("result") != "pass":
                failures.append(Failure("root-self-adoption", "`root adopt verify` must prove required section deletion blocks"))
        if kind == "carrier-refresh":
            review = payload.get("review")
            head_binding = review.get("head_binding") if isinstance(review, dict) else None
            review_is_stale = isinstance(head_binding, dict) and head_binding.get("status") == "stale"
            if payload.get("result") != "pass" and not review_is_stale:
                failures.append(Failure("root-self-adoption", "`root carrier refresh` must report `result: pass` unless review head binding is stale"))
            refresh_needed = payload.get("refresh_needed")
            runtime_refresh_needed = [
                action
                for action in refresh_needed
                if isinstance(action, dict)
                and isinstance(action.get("path"), str)
                and action.get("path", "").startswith(".loom/bin/")
            ] if isinstance(refresh_needed, list) else []
            if runtime_refresh_needed:
                failures.append(Failure("root-self-adoption", "`root carrier refresh --dry-run` must not report runtime provenance drift"))
            if isinstance(review, dict):
                if review_is_stale and review.get("status") not in {"block", "refresh-needed"}:
                    failures.append(Failure("root-self-adoption", "`root carrier refresh --dry-run` must expose stale review head binding as refresh-needed review metadata"))
        if kind == "shadow-parity":
            reports = payload.get("reports")
            report_surfaces = {
                report.get("surface")
                for report in reports
                if isinstance(report, dict)
            } if isinstance(reports, list) else set()
            if report_surfaces != {"admission", "review", "merge_ready", "closeout"}:
                failures.append(Failure("root-self-adoption", "`root shadow parity` must cover admission, review, merge_ready, and closeout"))
            surface = payload.get("governance_surface")
            if isinstance(surface, dict):
                repo_interface = surface.get("repo_interface")
                repo_interop = surface.get("repo_interop")
                if not isinstance(repo_interface, dict) or repo_interface.get("availability") != "present":
                    failures.append(Failure("root-self-adoption", "`root shadow parity` must consume the root repo companion interface"))
                if not isinstance(repo_interop, dict) or repo_interop.get("availability") != "present":
                    failures.append(Failure("root-self-adoption", "`root shadow parity` must consume the root repo interop contract"))
    failures.extend(check_root_self_plugin_install(root))
    return failures


def check_root_self_plugin_install(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    marketplace_path = root / ".agents/plugins/marketplace.json"
    if marketplace_path.exists():
        failures.append(Failure("root-self-plugin", "root `.agents/plugins/marketplace.json` is repo-local installed state and must not be committed upstream"))

    root_plugin_paths = (
        "plugins/loom/.codex-plugin/plugin.json",
        "skills/registry.json",
        "skills/install-layout.json",
        "skills/shared/scripts/loom_init.py",
        "skills/loom-init/SKILL.md",
    )
    failures.extend(check_required_paths(root, "root-self-plugin", root_plugin_paths))

    package_root = root / "packages/loom-installer"
    cli_entry = package_root / "dist/src/cli.js"
    package_json = package_root / "package.json"
    if not package_json.exists():
        failures.append(Failure("root-self-plugin", "installer package must exist for downstream plugin verification"))
        return failures
    npm_bin = host_executable("npm")
    node_bin = host_executable("node")
    python_bin = (
        os.environ.get("LOOM_INSTALLER_PYTHON_BIN")
        or os.environ.get("LOOM_INSTALLER_TEST_PYTHON_BIN")
        or host_executable("python3")
    )
    with tempfile.TemporaryDirectory(prefix="loom-root-self-plugin-") as tmp:
        tmp_root = Path(tmp)
        target = tmp_root / "target"
        home = tmp_root / "home"
        target.mkdir(parents=True, exist_ok=True)
        home.mkdir(parents=True, exist_ok=True)
        env = {
            "HOME": str(home),
            "CODEX_HOME": str(home / ".codex"),
            "LOOM_INSTALLER_BUILD_TIMESTAMP": "2026-01-01T00:00:00.000Z",
            "LOOM_INSTALLER_PYTHON_BIN": python_bin,
        }
        clean_path_entries = [
            entry
            for entry in os.environ.get("PATH", "").split(os.pathsep)
            if entry and "/mise/shims" not in entry
        ]
        env["PATH"] = os.pathsep.join(
            [str(Path(python_bin).parent), str(Path(node_bin).parent), str(Path(npm_bin).parent), *clean_path_entries]
        )
        commands: list[tuple[str, list[str], Path]] = []
        if not (package_root / "node_modules/.bin/tsc").exists():
            commands.append(
                (
                    "install self-plugin build dependencies",
                    [npm_bin, "ci", "--prefix", str(package_root)],
                    root,
                )
            )
        commands.extend(
            (
                (
                    "build downstream plugin installer",
                    [npm_bin, "--prefix", str(package_root), "run", "build"],
                    root,
                ),
                (
                    "install downstream plugin payload",
                    [
                        node_bin,
                        str(cli_entry),
                        "add",
                        "plugin",
                        "--host",
                        "codex",
                        "--target",
                        str(target),
                        "--force",
                        "--json",
                    ],
                    root,
                ),
            )
        )
        for label, args, cwd in commands:
            try:
                result = run_command(root, args, cwd=cwd, env=env, timeout_seconds=300)
            except subprocess.TimeoutExpired:
                failures.append(Failure("root-self-plugin", f"`{label}` timed out"))
                return failures
            if result.returncode != 0:
                detail = result.stderr.strip() or result.stdout.strip() or "command failed without output"
                failures.append(Failure("root-self-plugin", f"`{label}` failed: {detail}"))
                return failures

        installed_marketplace = target / ".agents/plugins/marketplace.json"
        plugin_root = target / "plugins/loom"
        expected_paths = (
            plugin_root / ".codex-plugin/plugin.json",
            plugin_root / "skills/registry.json",
            plugin_root / "skills/install-layout.json",
            plugin_root / "skills/shared/scripts/loom_init.py",
            plugin_root / "skills/loom-init/SKILL.md",
        )
        for path in expected_paths:
            if not path.exists():
                failures.append(Failure("root-self-plugin", f"downstream plugin install is missing `{path.relative_to(target).as_posix()}`"))
        try:
            installed = load_json_file(installed_marketplace)
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            failures.append(Failure("root-self-plugin", f"installed marketplace is unreadable: {exc}"))
        else:
            installed_plugins = installed.get("plugins") if isinstance(installed, dict) else None
            installed_entry = None
            if isinstance(installed_plugins, list):
                installed_entry = next(
                    (
                        entry
                        for entry in installed_plugins
                        if isinstance(entry, dict) and entry.get("name") == "loom"
                    ),
                    None,
                )
            installed_source = installed_entry.get("source") if isinstance(installed_entry, dict) else None
            if not isinstance(installed_source, dict) or installed_source.get("path") != "./plugins/loom":
                failures.append(Failure("root-self-plugin", "installed marketplace must point `loom` to `./plugins/loom`"))
        if plugin_root.exists():
            generated_cache = [
                path.relative_to(target).as_posix()
                for path in plugin_root.rglob("*")
                if "__pycache__" in path.parts or path.suffix == ".pyc"
            ]
            if generated_cache:
                preview = ", ".join(generated_cache[:5])
                failures.append(Failure("root-self-plugin", f"downstream plugin payload must exclude Python cache artifacts: {preview}"))
    return failures


def check_deep_existing_repo_bootstrap(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    with tempfile.TemporaryDirectory(prefix="loom-check-deep-existing-") as tmp:
        tmp_root = Path(tmp)

        def write_repo(target: Path, *, validation_entry: bool, pr_template: bool, workflow_doc: bool) -> None:
            (target / ".github" / "workflows").mkdir(parents=True, exist_ok=True)
            (target / "scripts").mkdir(parents=True, exist_ok=True)
            (target / "src").mkdir(parents=True, exist_ok=True)
            (target / "README.md").write_text("# Sample Repo\n", encoding="utf-8")
            (target / "AGENTS.md").write_text("# Root Rules\n", encoding="utf-8")
            (target / "src" / "main.py").write_text("print('ok')\n", encoding="utf-8")
            (target / "scripts" / "governance_status.py").write_text("print('ok')\n", encoding="utf-8")
            (target / ".github" / "workflows" / "ci.yml").write_text("name: ci\n", encoding="utf-8")
            if workflow_doc:
                (target / "WORKFLOW.md").write_text("# Workflow\n", encoding="utf-8")
            if validation_entry:
                (target / "Makefile").write_text("check:\n\t@echo ok\n", encoding="utf-8")
            if pr_template:
                (target / ".github" / "PULL_REQUEST_TEMPLATE.md").write_text("## Summary\n", encoding="utf-8")

        deep_target = tmp_root / "deep-existing"
        write_repo(deep_target, validation_entry=True, pr_template=True, workflow_doc=True)
        deep_payload, deep_error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_init.py",
                "bootstrap",
                "--target",
                str(deep_target),
                "--write",
                "--force",
                "--verify",
                "--install-pr-template",
            ],
        )
        if deep_error:
            failures.append(Failure("deep-existing-bootstrap", f"`deep-existing bootstrap` failed: {deep_error}"))
        else:
            recommended = deep_payload.get("recommended_adoption")
            verification = deep_payload.get("verification")
            governance_surface = deep_payload.get("governance_surface")
            if not isinstance(recommended, dict) or recommended.get("path") != "deep-existing-repo":
                failures.append(Failure("deep-existing-bootstrap", "`deep-existing bootstrap` must select `recommended_adoption.path = deep-existing-repo`"))
            run = deep_payload.get("run")
            if not isinstance(run, dict) or run.get("scenario_key") != "complex-existing":
                failures.append(Failure("deep-existing-bootstrap", "`deep-existing bootstrap` must keep `scenario_key = complex-existing`"))
            if not isinstance(verification, dict) or verification.get("ok") is not True:
                failures.append(Failure("deep-existing-bootstrap", "`deep-existing bootstrap` must verify successfully"))
            if not isinstance(governance_surface, dict) or governance_surface.get("repository_mode") != "complex-existing":
                failures.append(Failure("deep-existing-bootstrap", "`deep-existing bootstrap` must keep `governance_surface.repository_mode = complex-existing`"))
            for required in (
                ".loom/companion/README.md",
                ".loom/companion/checkpoints.md",
                ".loom/companion/review.md",
                ".loom/companion/merge-ready.md",
                ".loom/companion/closeout.md",
            ):
                if not (deep_target / required).exists():
                    failures.append(Failure("deep-existing-bootstrap", f"`deep-existing bootstrap` is missing `{required}`"))
            for forbidden in (
                ".loom/work-items/INIT-0001.md",
                ".loom/progress/INIT-0001.md",
                ".loom/status/current.md",
            ):
                if (deep_target / forbidden).exists():
                    failures.append(Failure("deep-existing-bootstrap", f"`deep-existing bootstrap` must not generate `{forbidden}`"))
            fact_chain = deep_payload.get("fact_chain")
            if not isinstance(fact_chain, dict) or fact_chain.get("mode") != "repo-native attach-only":
                failures.append(Failure("deep-existing-bootstrap", "`deep-existing bootstrap` must keep `fact_chain.mode = repo-native attach-only`"))

        full_target = tmp_root / "full-bootstrap"
        write_repo(full_target, validation_entry=False, pr_template=False, workflow_doc=False)
        full_payload, full_error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_init.py",
                "bootstrap",
                "--target",
                str(full_target),
                "--write",
                "--force",
                "--verify",
                "--install-pr-template",
            ],
        )
        if full_error:
            failures.append(Failure("deep-existing-bootstrap", f"`full-bootstrap fallback sample` failed: {full_error}"))
        else:
            recommended = full_payload.get("recommended_adoption")
            if not isinstance(recommended, dict) or recommended.get("path") != "full-bootstrap":
                failures.append(Failure("deep-existing-bootstrap", "complex existing sample without overload must keep `recommended_adoption.path = full-bootstrap`"))
            for required in (
                ".loom/work-items/INIT-0001.md",
                ".loom/progress/INIT-0001.md",
                ".loom/status/current.md",
            ):
                if not (full_target / required).exists():
                    failures.append(Failure("deep-existing-bootstrap", f"`full-bootstrap fallback sample` must generate `{required}`"))
    return failures


def check_daily_execution_cli(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    example_target = root / "examples/new-project"
    tool_path = root / "tools/loom_flow.py"
    if not tool_path.exists() or not example_target.exists():
        return failures

    demo_commands = [
        (
            "runtime-state-init",
            ["python3", "tools/loom_init.py", "runtime-state", "--target", "."],
            {"pass"},
        ),
        (
            "runtime-state-flow",
            ["python3", "tools/loom_flow.py", "runtime-state", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "fact-chain",
            ["python3", "tools/loom_flow.py", "fact-chain", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "runtime-evidence",
            [
                "python3",
                "tools/loom_flow.py",
                "runtime-evidence",
                "--target",
                "examples/new-project",
                "--item",
                "INIT-0001",
            ],
            {"pass"},
        ),
        (
            "state-check",
            ["python3", "tools/loom_flow.py", "state-check", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "status-control",
            ["python3", "tools/loom_status.py", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass", "block"},
        ),
        (
            "runtime-parity",
            [
                "python3",
                "tools/loom_flow.py",
                "runtime-parity",
                "validate",
                "--target",
                "examples/new-project",
                "--item",
                "INIT-0001",
            ],
            {"pass"},
        ),
        (
            "adopt-verify",
            ["python3", "tools/loom_flow.py", "adopt", "verify", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "carrier-refresh",
            ["python3", "tools/loom_flow.py", "carrier", "refresh", "--target", "examples/new-project", "--item", "INIT-0001", "--dry-run"],
            {"pass"},
        ),
        (
            "host-binding-validate",
            ["python3", "tools/loom_flow.py", "host-binding", "validate", "--target", ".", "--owner", "MC-and-his-Agents", "--repo", "Loom", "--branch", "main"],
            {"pass", "block"},
        ),
        (
            "governance-profile-status",
            ["python3", "tools/loom_flow.py", "governance-profile", "status", "--target", "examples/new-project"],
            {"pass"},
        ),
        (
            "governance-profile-upgrade-plan",
            ["python3", "tools/loom_flow.py", "governance-profile", "upgrade-plan", "--target", "examples/new-project"],
            {"pass", "block"},
        ),
        (
            "governance-profile-upgrade",
            [
                "python3",
                "tools/loom_flow.py",
                "governance-profile",
                "upgrade",
                "--target",
                "examples/new-project",
                "--to",
                "standard",
                "--dry-run",
            ],
            {"pass"},
        ),
        (
            "governance-profile-binding",
            ["python3", "tools/loom_flow.py", "governance-profile", "binding", "--target", "."],
            {"block"},
        ),
        (
            "flow-pre-review",
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "pre-review",
                "--target",
                "examples/new-project",
                "--item",
                "INIT-0001",
            ],
            {"pass", "block", "fallback"},
        ),
        (
            "flow-review",
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "review",
                "--target",
                "examples/new-project",
                "--item",
                "INIT-0001",
            ],
            {"pass", "block", "fallback"},
        ),
        (
            "flow-resume",
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "resume",
                "--target",
                "examples/new-project",
                "--item",
                "INIT-0001",
            ],
            {"pass"},
        ),
        (
            "flow-handoff",
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "handoff",
                "--target",
                "examples/new-project",
                "--item",
                "INIT-0001",
            ],
            {"pass", "block"},
        ),
        (
            "flow-merge-ready",
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "merge-ready",
                "--target",
                "examples/new-project",
                "--item",
                "INIT-0001",
            ],
            {"pass", "block", "fallback"},
        ),
        (
            "admission",
            ["python3", "tools/loom_flow.py", "checkpoint", "admission", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "build",
            ["python3", "tools/loom_flow.py", "checkpoint", "build", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass", "block", "fallback"},
        ),
        (
            "merge",
            ["python3", "tools/loom_flow.py", "checkpoint", "merge", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass", "block", "fallback"},
        ),
        (
            "locate",
            ["python3", "tools/loom_flow.py", "workspace", "locate", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "attach",
            ["python3", "tools/loom_flow.py", "workspace", "attach", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "review-read",
            ["python3", "tools/loom_flow.py", "review", "read", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "host-lifecycle",
            ["python3", "tools/loom_flow.py", "host-lifecycle", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
        (
            "closeout-check",
            ["python3", "tools/loom_flow.py", "closeout", "check", "--target", ".", "--skip-gate"],
            {"pass"},
        ),
        (
            "closeout-sync",
            ["python3", "tools/loom_flow.py", "closeout", "sync", "--target", ".", "--skip-gate"],
            {"pass"},
        ),
        (
            "reconciliation-audit",
            ["python3", "tools/loom_flow.py", "reconciliation", "audit", "--target", "."],
            {"block"},
        ),
        (
            "purity",
            ["python3", "tools/loom_flow.py", "purity-check", "--target", "examples/new-project", "--item", "INIT-0001"],
            {"pass"},
        ),
    ]
    for label, args, allowed_results in demo_commands:
        payload, error = load_command_json(root, args)
        if error:
            failures.append(Failure("daily-execution-cli", f"`{label}` command failed: {error}"))
            continue
        result = payload.get("result")
        if result not in allowed_results:
            failures.append(
                Failure(
                    "daily-execution-cli",
                    f"`{label}` returned unexpected result `{result}`",
                )
            )
        if label == "runtime-state-init":
            if payload.get("command") != "runtime-state":
                failures.append(Failure("daily-execution-cli", "`loom-init runtime-state` must report `command: runtime-state`"))
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`loom-init runtime-state`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
        if label == "runtime-state-flow":
            if payload.get("command") != "runtime-state":
                failures.append(Failure("daily-execution-cli", "`loom-flow runtime-state` must report `command: runtime-state`"))
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`loom-flow runtime-state`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
        if label == "runtime-evidence":
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`runtime-evidence`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
        if label == "fact-chain":
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context="`fact-chain`.report",
                payload=payload.get("report"),
            )
        if label == "state-check":
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`state-check`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
        if label == "status-control":
            if payload.get("command") != "status":
                failures.append(Failure("daily-execution-cli", "`loom_status` must report `command: status`"))
            governance_status = payload.get("governance_status")
            execution_budget = payload.get("execution_budget")
            execution_budget_risk = payload.get("execution_budget_risk")
            execution_failure = payload.get("execution_failure")
            retry_evidence = payload.get("retry_evidence")
            if not isinstance(execution_budget, dict):
                failures.append(Failure("daily-execution-cli", "`loom_status` must include `execution_budget`"))
            else:
                missing_inputs = payload.get("missing_inputs")
                if "execution_budget" in missing_inputs if isinstance(missing_inputs, list) else False:
                    failures.append(
                        Failure(
                            "daily-execution-cli",
                            "`loom_status` must not surface `execution_budget` as missing input",
                        )
                    )
                budget_missing = execution_budget.get("status") in {"not_applicable", "unavailable"}
                if budget_missing and execution_budget.get("enforcement") != "advisory":
                    failures.append(
                        Failure(
                            "daily-execution-cli",
                            "`loom_status` missing budget must remain advisory",
                        )
                    )
                governance_missing = governance_status.get("missing_inputs") if isinstance(governance_status, dict) else []
                if (
                    budget_missing
                    and isinstance(governance_missing, list)
                    and any(str(item).startswith("execution_budget") for item in governance_missing)
                ):
                    failures.append(
                        Failure(
                            "daily-execution-cli",
                            "`loom_status` should not block merge-ready gate on advisory execution budget status",
                        )
                    )
            require_execution_budget_risk_payload(
                failures,
                category="daily-execution-cli",
                context="`loom_status`",
                payload=execution_budget_risk,
            )
            if not isinstance(execution_failure, dict):
                failures.append(Failure("daily-execution-cli", "`loom_status` must include `execution_failure`"))
            else:
                if execution_failure.get("schema_version") != loom_flow_module.EXECUTION_FAILURE_SCHEMA:
                    failures.append(Failure("daily-execution-cli", "`loom_status` execution_failure must report schema v1"))
                if execution_failure.get("status") not in loom_flow_module.EXECUTION_FAILURE_STATUSES:
                    failures.append(Failure("daily-execution-cli", "`loom_status` execution_failure status must stay within the stable set"))
                if execution_failure.get("classification") not in loom_flow_module.EXECUTION_FAILURE_CLASSIFICATIONS:
                    failures.append(Failure("daily-execution-cli", "`loom_status` execution_failure classification must stay within the stable vocabulary"))
            if not isinstance(retry_evidence, dict):
                failures.append(Failure("daily-execution-cli", "`loom_status` must include `retry_evidence`"))
            else:
                if retry_evidence.get("schema_version") != loom_flow_module.RETRY_EVIDENCE_SCHEMA:
                    failures.append(Failure("daily-execution-cli", "`loom_status` retry_evidence must report schema v1"))
                if retry_evidence.get("status") not in loom_flow_module.RETRY_EVIDENCE_STATUSES:
                    failures.append(Failure("daily-execution-cli", "`loom_status` retry_evidence status must stay within the stable set"))
                if retry_evidence.get("scheduler_ownership") != "external":
                    failures.append(Failure("daily-execution-cli", "`loom_status` retry_evidence must keep scheduler_ownership external"))
            if not isinstance(governance_status, dict):
                failures.append(Failure("daily-execution-cli", "`loom_status` must include `governance_status`"))
            else:
                if governance_status.get("schema_version") != "loom-governance-status/v2":
                    failures.append(Failure("daily-execution-cli", "`loom_status` governance_status must report schema v2"))
                if governance_status.get("result") not in {"pass", "block"}:
                    failures.append(Failure("daily-execution-cli", "`loom_status` governance_status result must be `pass` or `block`"))
                if not isinstance(governance_status.get("gate_chain"), list):
                    failures.append(Failure("daily-execution-cli", "`loom_status` governance_status must include gate_chain"))
                else:
                    gate_names = [
                        gate.get("name")
                        for gate in governance_status["gate_chain"]
                        if isinstance(gate, dict)
                    ]
                    expected_names = [
                        "work_item_admission",
                        "spec_gate",
                        "build_gate",
                        "review_gate",
                        "merge_gate",
                        "github_controlled_merge",
                    ]
                    if gate_names != expected_names:
                        failures.append(Failure("daily-execution-cli", "`loom_status` governance_status gate_chain must use the stable gate vocabulary"))
                classifications = governance_status.get("classifications")
                if not isinstance(classifications, list):
                    failures.append(Failure("daily-execution-cli", "`loom_status` governance_status must include classifications"))
            external_orchestrator = payload.get("external_orchestrator")
            if not isinstance(external_orchestrator, dict):
                failures.append(Failure("daily-execution-cli", "`loom_status` must include `external_orchestrator` consumer view"))
            else:
                if external_orchestrator.get("schema_version") != "loom-governance-status/v2":
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator must reuse governance status schema v2"))
                if external_orchestrator.get("view") != "external_orchestrator_consumer":
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator view must be consumer-only"))
                if external_orchestrator.get("result") not in {"pass", "block"}:
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator result must be `pass` or `block`"))
                if external_orchestrator.get("allowed_operations") != ["status_read", "gate_read"]:
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator must expose only read operations"))
                if not isinstance(external_orchestrator.get("gate_chain"), list):
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator must reuse gate_chain"))
                source_policy = external_orchestrator.get("source_policy")
                if not isinstance(source_policy, dict):
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator must include source_policy"))
                elif source_policy.get("fallback_to") != "current_checkpoint":
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator fallback must point to Loom checkpoint"))
                elif source_policy.get("status_source") != "derived_from_status_control_plane_v2":
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator must read status from status control plane v2"))
                elif source_policy.get("gate_source") != "derived_from_governance_gate_chain":
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator must read gates from the governance gate chain"))
                external_provenance = external_orchestrator.get("provenance")
                if not (
                    isinstance(external_provenance, dict)
                    or (isinstance(external_provenance, list) and external_provenance)
                ):
                    failures.append(Failure("daily-execution-cli", "`loom_status` external_orchestrator must carry provenance"))
            closeout = payload.get("closeout")
            if not isinstance(closeout, dict):
                failures.append(Failure("daily-execution-cli", "`loom_status` must include `closeout`"))
            else:
                if closeout.get("result") not in {"pass", "block", "not_applicable"}:
                    failures.append(Failure("daily-execution-cli", "`loom_status` closeout result must stay within the stable set"))
                reconciliation = closeout.get("reconciliation")
                if not isinstance(reconciliation, dict):
                    failures.append(Failure("daily-execution-cli", "`loom_status` closeout must include reconciliation"))
                elif reconciliation.get("result") not in {"pass", "warn", "fix-needed", "block", "not_applicable"}:
                    failures.append(Failure("daily-execution-cli", "`loom_status` closeout reconciliation result must stay within the stable set"))
            require_target_release_status_payload(
                failures,
                category="daily-execution-cli",
                context="`loom_status`.target_release",
                payload=payload.get("target_release"),
            )
            require_governance_surface(
                failures,
                category="daily-execution-cli",
                context="`loom_status`",
                payload=payload,
            )
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context="`loom_status`",
                payload=payload,
            )
        if label == "runtime-parity":
            require_runtime_parity_payload(
                failures,
                category="daily-execution-cli",
                context="`runtime-parity validate`",
                payload=payload,
            )
        if label == "adopt-verify":
            if payload.get("command") != "adopt" or payload.get("operation") != "verify":
                failures.append(Failure("daily-execution-cli", "`adopt verify` must report command/operation"))
            if payload.get("schema_version") != "loom-adoption-verify/v1":
                failures.append(Failure("daily-execution-cli", "`adopt verify` must report schema v1"))
            roundtrip = payload.get("producer_consumer_roundtrip")
            if not isinstance(roundtrip, dict):
                failures.append(Failure("daily-execution-cli", "`adopt verify` must include producer_consumer_roundtrip"))
            else:
                consumer = roundtrip.get("consumer")
                bypass = roundtrip.get("bypass_check")
                if not isinstance(consumer, dict) or consumer.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`adopt verify` generated body must pass consumer validation"))
                if not isinstance(bypass, dict) or bypass.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`adopt verify` must prove required section deletion blocks"))
            require_adoption_decisions_payload(
                failures,
                category="daily-execution-cli",
                context="`adopt verify`.adoption_decisions",
                payload=payload.get("adoption_decisions"),
            )
            require_guided_adoption_plan_payload(
                failures,
                category="daily-execution-cli",
                context="`adopt verify`.guided_adoption_plan",
                payload=payload.get("guided_adoption_plan"),
            )
            closure = payload.get("judgment_closure")
            if not isinstance(closure, dict):
                failures.append(Failure("daily-execution-cli", "`adopt verify` must include judgment_closure"))
            elif closure.get("result") not in {"pass", "block"}:
                failures.append(Failure("daily-execution-cli", "`adopt verify` judgment_closure result must be pass/block"))
            consumption = payload.get("generated_companion_consumption")
            if not isinstance(consumption, dict):
                failures.append(Failure("daily-execution-cli", "`adopt verify` must include generated_companion_consumption"))
            else:
                if consumption.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`adopt verify` generated_companion_consumption must pass"))
                if consumption.get("missing_inputs") not in ([], None):
                    failures.append(Failure("daily-execution-cli", "`adopt verify` generated_companion_consumption must not hide missing inputs"))
                for consumer in ("governance_surface", "review", "merge_ready", "shadow_parity"):
                    entry = consumption.get(consumer)
                    if not isinstance(entry, dict) or entry.get("status") not in {"pass", "consumed"}:
                        failures.append(Failure("daily-execution-cli", f"`adopt verify` must consume generated companion through {consumer}"))
                for consumer in ("review", "merge_ready"):
                    entry = consumption.get(consumer)
                    requirements = entry.get("repo_specific_requirements") if isinstance(entry, dict) else None
                    if not isinstance(requirements, dict) or requirements.get("source_locator") != ".loom/companion/repo-interface.json":
                        failures.append(Failure("daily-execution-cli", f"`adopt verify` {consumer} must consume generated repo-interface locator"))
                shadow = consumption.get("shadow_parity")
                if not isinstance(shadow, dict) or shadow.get("result") != "pass" or shadow.get("missing_inputs") not in ([], None):
                    failures.append(Failure("daily-execution-cli", "`adopt verify` shadow parity consumption must be a clean pass"))
        if label == "carrier-refresh":
            if payload.get("command") != "carrier" or payload.get("operation") != "refresh":
                failures.append(Failure("daily-execution-cli", "`carrier refresh` must report command/operation"))
            if payload.get("schema_version") != "loom-carrier-refresh/v1":
                failures.append(Failure("daily-execution-cli", "`carrier refresh` must report schema v1"))
            if not isinstance(payload.get("actions"), list):
                failures.append(Failure("daily-execution-cli", "`carrier refresh` must include actions"))
        if label == "host-binding-validate":
            if payload.get("command") != "host-binding" or payload.get("operation") != "validate":
                failures.append(Failure("daily-execution-cli", "`host-binding validate` must report command/operation"))
            if payload.get("schema_version") != "loom-host-binding/v1":
                failures.append(Failure("daily-execution-cli", "`host-binding validate` must report schema v1"))
            branch = payload.get("branch")
            host_unavailable = host_read_unavailable(payload)
            if payload.get("result") == "block" and not host_unavailable:
                failures.append(Failure("daily-execution-cli", "`host-binding validate --branch main` must pass unless the host read is unavailable"))
            if (not isinstance(branch, dict) or branch.get("status") != "present") and not host_unavailable:
                failures.append(Failure("daily-execution-cli", "`host-binding validate --branch main` must read the branch via REST"))
        if label in {"governance-profile-status", "governance-profile-upgrade-plan"}:
            if payload.get("command") != "governance-profile":
                failures.append(Failure("daily-execution-cli", f"`{label}` must report `command: governance-profile`"))
            expected_operation = "status" if label == "governance-profile-status" else "upgrade-plan"
            if payload.get("operation") != expected_operation:
                failures.append(Failure("daily-execution-cli", f"`{label}` must report `operation: {expected_operation}`"))
            control_plane = payload.get("governance_control_plane")
            require_governance_control_plane(
                failures,
                category="daily-execution-cli",
                context=f"`{label}` governance_control_plane",
                payload=control_plane,
            )
            maturity = payload.get("maturity")
            if isinstance(maturity, dict):
                current = maturity.get("current")
                if current == "strong":
                    failures.append(Failure("daily-execution-cli", "`examples/new-project` fresh adoption must not default to strong maturity"))
                missing_by_level = maturity.get("missing_by_level")
                strong_missing = missing_by_level.get("strong") if isinstance(missing_by_level, dict) else []
                if not isinstance(strong_missing, list) or "host_enforced_control_plane" not in strong_missing:
                    failures.append(Failure("daily-execution-cli", "`examples/new-project` strong upgrade-plan must expose missing host enforcement"))
            if label == "governance-profile-upgrade-plan":
                require_adoption_decisions_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`governance-profile upgrade-plan`.adoption_decisions",
                    payload=payload.get("adoption_decisions"),
                )
                require_guided_adoption_plan_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`governance-profile upgrade-plan`.guided_adoption_plan",
                    payload=payload.get("guided_adoption_plan"),
                )
                require_companion_generation_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`governance-profile upgrade-plan`.companion_generation",
                    payload=payload.get("companion_generation"),
                )
        if label == "governance-profile-binding":
            require_github_binding_payload(
                failures,
                category="daily-execution-cli",
                context="`governance-profile binding`",
                payload=payload,
            )
        if label == "governance-profile-upgrade":
            require_governance_upgrade_payload(
                failures,
                category="daily-execution-cli",
                context="`governance-profile upgrade`",
                payload=payload,
            )
        if label == "flow-pre-review":
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`flow pre-review`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            steps = payload.get("steps")
            if isinstance(steps, list):
                step_names = [step.get("name") for step in steps if isinstance(step, dict)]
                if step_names != [
                    "runtime-state",
                    "fact-chain",
                    "state-check",
                    "runtime-evidence",
                    "checkpoint-admission",
                    "workspace-locate",
                ]:
                    failures.append(
                        Failure(
                            "daily-execution-cli",
                            "`flow pre-review` must run runtime-state, fact-chain, state-check, runtime-evidence, checkpoint-admission, and workspace-locate in order",
                        )
                    )
        if label == "purity":
            purity = payload.get("purity")
            if not isinstance(purity, dict):
                failures.append(Failure("daily-execution-cli", "`purity` output must include a `purity` object"))
                continue
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`purity`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            scope_assessment = purity.get("scope_assessment")
            if not isinstance(scope_assessment, dict):
                failures.append(Failure("daily-execution-cli", "`purity` output must include `scope_assessment`"))
                continue
            mode = scope_assessment.get("mode")
            if mode not in {"constrained", "unconstrained"}:
                failures.append(
                    Failure("daily-execution-cli", "`scope_assessment.mode` must be `constrained` or `unconstrained`")
                )
        if label == "flow-resume":
            if payload.get("command") != "flow":
                failures.append(Failure("daily-execution-cli", "`flow resume` must report `command: flow`"))
            if payload.get("operation") != "resume":
                failures.append(Failure("daily-execution-cli", "`flow resume` must report `operation: resume`"))
            if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
                failures.append(Failure("daily-execution-cli", "`flow resume` must include a non-empty `summary`"))
            if not isinstance(payload.get("missing_inputs"), list):
                failures.append(Failure("daily-execution-cli", "`flow resume` must include `missing_inputs`"))
            if payload.get("fallback_to") not in {None, "admission"}:
                failures.append(Failure("daily-execution-cli", "`flow resume` fallback must be `null` or `admission`"))
            for key in ("item", "workspace", "recovery", "checkpoint", "state_check"):
                if not isinstance(payload.get(key), dict):
                    failures.append(Failure("daily-execution-cli", f"`flow resume` must include `{key}`"))
            if not isinstance(payload.get("execution_ledger"), dict):
                failures.append(Failure("daily-execution-cli", "`flow resume` must include `execution_ledger`"))
            require_lifecycle_expectations_payload(
                failures,
                category="daily-execution-cli",
                context="`flow resume`",
                payload=payload.get("lifecycle_expectations"),
            )
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`flow resume`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            require_governance_surface(
                failures,
                category="daily-execution-cli",
                context="`flow resume`",
                payload=payload,
            )
            require_maturity_upgrade_path(
                failures,
                category="daily-execution-cli",
                context="`flow resume`",
                payload=payload.get("maturity_upgrade_path"),
            )
            adoption_guidance = payload.get("adoption_guidance")
            if not isinstance(adoption_guidance, dict):
                failures.append(Failure("daily-execution-cli", "`flow resume` must include adoption_guidance"))
            else:
                require_guided_adoption_plan_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`flow resume`.adoption_guidance.guided_adoption_plan",
                    payload=adoption_guidance.get("guided_adoption_plan"),
                )
            steps = payload.get("steps")
            if not isinstance(steps, list):
                failures.append(Failure("daily-execution-cli", "`flow resume` must include `steps`"))
                continue
            step_names = [step.get("name") for step in steps if isinstance(step, dict)]
            if step_names != ["runtime-state", "fact-chain", "state-check", "workspace-locate"]:
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        "`flow resume` must run runtime-state, fact-chain, state-check, and workspace-locate in order",
                    )
                )
            recovery = payload.get("recovery")
            if isinstance(recovery, dict):
                for field in ("current_stop", "next_step", "blockers", "latest_validation_summary"):
                    value = recovery.get(field)
                    if not isinstance(value, str) or not value:
                        failures.append(
                            Failure("daily-execution-cli", f"`flow resume` recovery must include non-empty `{field}`")
                        )
            checkpoint = payload.get("checkpoint")
            if isinstance(checkpoint, dict):
                if checkpoint.get("normalized") not in {"admission", "build", "merge", "retired"}:
                    failures.append(
                        Failure("daily-execution-cli", "`flow resume` checkpoint must include a known normalized value")
                    )
            state_check = payload.get("state_check")
            if isinstance(state_check, dict):
                if state_check.get("result") not in {"pass", "block"}:
                    failures.append(
                        Failure("daily-execution-cli", "`flow resume` state_check.result must be `pass` or `block`")
                    )
                if not isinstance(state_check.get("checks"), dict):
                    failures.append(Failure("daily-execution-cli", "`flow resume` must include `state_check.checks`"))
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context="`flow resume`",
                payload=payload,
            )
        if label == "flow-handoff":
            if payload.get("command") != "flow":
                failures.append(Failure("daily-execution-cli", "`flow handoff` must report `command: flow`"))
            if payload.get("operation") != "handoff":
                failures.append(Failure("daily-execution-cli", "`flow handoff` must report `operation: handoff`"))
            if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
                failures.append(Failure("daily-execution-cli", "`flow handoff` must include a non-empty `summary`"))
            if not isinstance(payload.get("missing_inputs"), list):
                failures.append(Failure("daily-execution-cli", "`flow handoff` must include `missing_inputs`"))
            if payload.get("fallback_to") not in {None, "admission"}:
                failures.append(Failure("daily-execution-cli", "`flow handoff` fallback must be `null` or `admission`"))
            for key in ("item", "workspace", "checkpoint", "state_check"):
                if not isinstance(payload.get(key), dict):
                    failures.append(Failure("daily-execution-cli", f"`flow handoff` must include `{key}`"))
            if not isinstance(payload.get("execution_ledger"), dict):
                failures.append(Failure("daily-execution-cli", "`flow handoff` must include `execution_ledger`"))
            require_lifecycle_expectations_payload(
                failures,
                category="daily-execution-cli",
                context="`flow handoff`",
                payload=payload.get("lifecycle_expectations"),
            )
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`flow handoff`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            for key in (
                "recovery_entry",
                "status_surface",
                "current_stop",
                "next_step",
                "blockers",
                "latest_validation_summary",
            ):
                value = payload.get(key)
                if not isinstance(value, str) or not value:
                    failures.append(Failure("daily-execution-cli", f"`flow handoff` must include non-empty `{key}`"))
            if payload.get("fallback_target") not in {None, "admission"}:
                failures.append(Failure("daily-execution-cli", "`flow handoff` fallback_target must be `null` or `admission`"))
            writeback_fields = payload.get("writeback_fields")
            if writeback_fields != [
                "current_stop",
                "next_step",
                "blockers",
                "latest_validation_summary",
            ]:
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        "`flow handoff` must report the stable writeback field list in order",
                    )
                )
            steps = payload.get("steps")
            if not isinstance(steps, list):
                failures.append(Failure("daily-execution-cli", "`flow handoff` must include `steps`"))
                continue
            step_names = [step.get("name") for step in steps if isinstance(step, dict)]
            if step_names != ["runtime-state", "fact-chain", "state-check", "workspace-locate"]:
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        "`flow handoff` must run runtime-state, fact-chain, state-check, and workspace-locate in order",
                    )
                )
            state_check = payload.get("state_check")
            if isinstance(state_check, dict):
                if state_check.get("result") not in {"pass", "block"}:
                    failures.append(
                        Failure("daily-execution-cli", "`flow handoff` state_check.result must be `pass` or `block`")
                    )
                if not isinstance(state_check.get("checks"), dict):
                    failures.append(Failure("daily-execution-cli", "`flow handoff` must include `state_check.checks`"))
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context="`flow handoff`",
                payload=payload,
            )
        if label == "flow-review":
            if payload.get("command") != "flow":
                failures.append(Failure("daily-execution-cli", "`flow review` must report `command: flow`"))
            if payload.get("operation") != "review":
                failures.append(Failure("daily-execution-cli", "`flow review` must report `operation: review`"))
            for key in ("item", "state_check", "runtime_evidence", "build_checkpoint", "review", "current_checkpoint", "repo_specific_requirements", "budget_risk"):
                if not isinstance(payload.get(key), dict):
                    failures.append(Failure("daily-execution-cli", f"`flow review` must include `{key}`"))
            require_execution_budget_risk_payload(
                failures,
                category="daily-execution-cli",
                context="`flow review`",
                payload=payload.get("budget_risk"),
            )
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`flow review`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            steps = payload.get("steps")
            if not isinstance(steps, list):
                failures.append(Failure("daily-execution-cli", "`flow review` must include `steps`"))
                continue
            step_names = [step.get("name") for step in steps if isinstance(step, dict)]
            if step_names != [
                "runtime-state",
                "fact-chain",
                "state-check",
                "runtime-evidence",
                "checkpoint-build",
                "spec-review-gate",
                "review-entry",
            ]:
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        "`flow review` must run runtime-state, fact-chain, state-check, runtime-evidence, checkpoint-build, spec-review-gate, and review-entry in order",
                    )
                )
            review = payload.get("review")
            if isinstance(review, dict):
                require_review_record_contract(
                    failures,
                    category="daily-execution-cli",
                    context="`flow review` review.record",
                    payload=review.get("record"),
                )
            require_repo_specific_requirements_payload(
                failures,
                category="daily-execution-cli",
                context="`flow review` repo_specific_requirements",
                payload=payload.get("repo_specific_requirements"),
                expected_surface="review",
            )
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context="`flow review`",
                payload=payload,
            )
        if label == "review-read":
            if payload.get("command") != "review":
                failures.append(Failure("daily-execution-cli", "`review read` must report `command: review`"))
            if payload.get("operation") != "read":
                failures.append(Failure("daily-execution-cli", "`review read` must report `operation: read`"))
            review = payload.get("review")
            if not isinstance(review, dict):
                failures.append(Failure("daily-execution-cli", "`review read` must include a `review` object"))
            elif not isinstance(review.get("record"), dict):
                failures.append(Failure("daily-execution-cli", "`review read` must include `review.record`"))
            else:
                require_review_record_contract(
                    failures,
                    category="daily-execution-cli",
                    context="`review read` review.record",
                    payload=review.get("record"),
                )
        if label == "host-lifecycle":
            if payload.get("command") != "host-lifecycle":
                failures.append(Failure("daily-execution-cli", "`host-lifecycle` must report `command: host-lifecycle`"))
            require_host_lifecycle_payload(
                failures,
                category="daily-execution-cli",
                context="`host-lifecycle`",
                payload=payload,
            )
            require_lifecycle_expectations_payload(
                failures,
                category="daily-execution-cli",
                context="`host-lifecycle`",
                payload=payload.get("lifecycle_expectations"),
            )
        if label == "attach":
            require_lifecycle_expectations_payload(
                failures,
                category="daily-execution-cli",
                context="`workspace attach`",
                payload=payload.get("lifecycle_expectations"),
            )
        if label in {"closeout-check", "closeout-sync"}:
            if payload.get("command") != "closeout":
                failures.append(Failure("daily-execution-cli", f"`{label}` must report `command: closeout`"))
            expected_operation = "check" if label == "closeout-check" else "sync"
            if payload.get("operation") != expected_operation:
                failures.append(
                    Failure("daily-execution-cli", f"`{label}` must report `operation: {expected_operation}`")
                )
            repo = payload.get("repo")
            if not isinstance(repo, dict):
                failures.append(Failure("daily-execution-cli", f"`{label}` must include `repo`"))
            else:
                if not isinstance(repo.get("owner"), str) or not repo.get("owner"):
                    failures.append(Failure("daily-execution-cli", f"`{label}` must include `repo.owner`"))
                if not isinstance(repo.get("name"), str) or not repo.get("name"):
                    failures.append(Failure("daily-execution-cli", f"`{label}` must include `repo.name`"))
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context=f"`{label}`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            require_closeout_reconciliation_contract(
                failures,
                category="daily-execution-cli",
                context=f"`{label}`",
                payload=payload,
            )
            require_repo_specific_requirements_payload(
                failures,
                category="daily-execution-cli",
                context=f"`{label}` repo_specific_requirements",
                payload=payload.get("repo_specific_requirements"),
                expected_surface="closeout",
            )
        if label == "reconciliation-audit":
            if payload.get("command") != "reconciliation":
                failures.append(Failure("daily-execution-cli", "`reconciliation audit` must report `command: reconciliation`"))
            if payload.get("operation") != "audit":
                failures.append(Failure("daily-execution-cli", "`reconciliation audit` must report `operation: audit`"))
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`reconciliation audit`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            require_reconciliation_payload(
                failures,
                category="daily-execution-cli",
                context="`reconciliation audit`",
                payload=payload,
            )
        if label == "flow-merge-ready":
            if payload.get("command") != "flow":
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must report `command: flow`"))
            if payload.get("operation") != "merge-ready":
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must report `operation: merge-ready`"))
            if not isinstance(payload.get("summary"), str) or not payload.get("summary"):
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must include a non-empty `summary`"))
            if not isinstance(payload.get("missing_inputs"), list):
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must include `missing_inputs`"))
            if payload.get("fallback_to") not in {None, "admission", "build", "merge", "retired"}:
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        "`flow merge-ready` fallback must be `null` or a known checkpoint",
                    )
                )
            for key in ("item", "runtime_state", "execution_ledger", "state_check", "runtime_evidence", "build_checkpoint", "merge_checkpoint", "current_checkpoint", "repo_specific_requirements", "budget_risk"):
                if not isinstance(payload.get(key), dict):
                    failures.append(Failure("daily-execution-cli", f"`flow merge-ready` must include `{key}`"))
            require_execution_budget_risk_payload(
                failures,
                category="daily-execution-cli",
                context="`flow merge-ready`",
                payload=payload.get("budget_risk"),
            )
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`flow merge-ready`",
                payload=payload.get("runtime_state"),
                expected_scene="repo-local-demo",
                expected_carrier="repo-local-wrapper",
                allowed_results={"pass"},
            )
            if not isinstance(payload.get("current_lane"), str) or not payload.get("current_lane"):
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must include `current_lane`"))
            if not isinstance(payload.get("latest_validation_summary"), str) or not payload.get("latest_validation_summary"):
                failures.append(
                    Failure("daily-execution-cli", "`flow merge-ready` must include `latest_validation_summary`")
                )
            steps = payload.get("steps")
            if not isinstance(steps, list):
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must include `steps`"))
                continue
            step_names = [step.get("name") for step in steps if isinstance(step, dict)]
            if step_names != [
                "runtime-state",
                "fact-chain",
                "state-check",
                "runtime-evidence",
                "checkpoint-build",
                "checkpoint-merge",
            ]:
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        "`flow merge-ready` must run runtime-state, fact-chain, state-check, runtime-evidence, checkpoint-build, and checkpoint-merge in order",
                    )
                )
            state_check = payload.get("state_check")
            if isinstance(state_check, dict):
                if state_check.get("result") not in {"pass", "block"}:
                    failures.append(
                        Failure("daily-execution-cli", "`flow merge-ready` state_check.result must be `pass` or `block`")
                    )
                if not isinstance(state_check.get("checks"), dict):
                    failures.append(Failure("daily-execution-cli", "`flow merge-ready` must include `state_check.checks`"))
            runtime_evidence = payload.get("runtime_evidence")
            if isinstance(runtime_evidence, dict):
                for field in ("run_entry", "logs_entry", "diagnostics_entry", "verification_entry", "lane_entry"):
                    if not isinstance(runtime_evidence.get(field), dict):
                        failures.append(
                            Failure("daily-execution-cli", f"`flow merge-ready` must include runtime evidence field `{field}`")
                        )
            for key in ("build_checkpoint", "merge_checkpoint"):
                checkpoint = payload.get(key)
                if isinstance(checkpoint, dict):
                    if checkpoint.get("result") not in {"pass", "block", "fallback"}:
                        failures.append(
                            Failure(
                                "daily-execution-cli",
                                f"`flow merge-ready` {key}.result must be `pass`, `block`, or `fallback`",
                            )
                        )
                    if not isinstance(checkpoint.get("missing_inputs"), list):
                        failures.append(
                            Failure("daily-execution-cli", f"`flow merge-ready` {key} must include `missing_inputs`")
                        )
            merge_checkpoint = payload.get("merge_checkpoint")
            if isinstance(merge_checkpoint, dict) and not isinstance(merge_checkpoint.get("pr_template"), dict):
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must include `merge_checkpoint.pr_template`"))
            require_repo_specific_requirements_payload(
                failures,
                category="daily-execution-cli",
                context="`flow merge-ready` repo_specific_requirements",
                payload=payload.get("repo_specific_requirements"),
                expected_surface="merge_ready",
            )
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context="`flow merge-ready`",
                payload=payload,
            )
            if payload.get("result") != "fallback":
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must return `fallback` for the bootstrap demo"))
            if payload.get("fallback_to") != "admission":
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` must fall back to `admission` for the bootstrap demo"))
            if isinstance(payload.get("build_checkpoint"), dict) and payload["build_checkpoint"].get("fallback_to") != "admission":
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` build checkpoint must fall back to `admission` for the bootstrap demo"))
            if isinstance(payload.get("merge_checkpoint"), dict) and payload["merge_checkpoint"].get("fallback_to") != "admission":
                failures.append(Failure("daily-execution-cli", "`flow merge-ready` merge checkpoint must fall back to `admission` for the bootstrap demo"))

    with tempfile.TemporaryDirectory(prefix="loom-check-fact-chain-provenance-") as tmp:
        missing_ledger_target = Path(tmp) / "missing-ledger"
        shutil.copytree(example_target, missing_ledger_target)
        progress_path = missing_ledger_target / ".loom/progress/INIT-0001.md"
        progress_text = progress_path.read_text(encoding="utf-8")
        progress_path.write_text(
            re.sub(r"\n## Execution Ledger\n\n.*\Z", "\n", progress_text, flags=re.S),
            encoding="utf-8",
        )
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "flow", "resume", "--target", str(missing_ledger_target), "--item", "INIT-0001"],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`missing execution ledger` failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`missing execution ledger` must block flow resume"))
        elif "Execution Ledger" not in json.dumps(payload.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("daily-execution-cli", "`missing execution ledger` must name the missing ledger section"))

        stale_ledger_target = Path(tmp) / "stale-ledger"
        shutil.copytree(example_target, stale_ledger_target)
        progress_path = stale_ledger_target / ".loom/progress/INIT-0001.md"
        progress_path.write_text(
            progress_path.read_text(encoding="utf-8").replace("- Evidence Freshness: current", "- Evidence Freshness: stale"),
            encoding="utf-8",
        )
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "flow", "merge-ready", "--target", str(stale_ledger_target), "--item", "INIT-0001"],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`stale execution ledger` failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`stale execution ledger` must block merge-ready"))
        elif "evidence must" not in json.dumps(payload.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("daily-execution-cli", "`stale execution ledger` must report stale evidence freshness"))

        forbidden_ledger_target = Path(tmp) / "forbidden-ledger-fields"
        shutil.copytree(example_target, forbidden_ledger_target)
        progress_path = forbidden_ledger_target / ".loom/progress/INIT-0001.md"
        progress_path.write_text(
            progress_path.read_text(encoding="utf-8").replace(
                "- Evidence Freshness: current",
                "- Evidence Freshness: current\n- Next Step: Ledger attempted to author a second next step.",
            ),
            encoding="utf-8",
        )
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "flow", "handoff", "--target", str(forbidden_ledger_target), "--item", "INIT-0001"],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`forbidden execution ledger field` failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`forbidden execution ledger field` must block handoff"))
        elif "Next Step" not in json.dumps(payload.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("daily-execution-cli", "`forbidden execution ledger field` must name the forbidden authored field"))

        dual_ledger_target = Path(tmp) / "dual-ledger"
        shutil.copytree(example_target, dual_ledger_target)
        init_path = dual_ledger_target / ".loom/bootstrap/init-result.json"
        init_payload = json.loads(init_path.read_text(encoding="utf-8"))
        init_payload.setdefault("fact_chain", {}).setdefault("entry_points", {})["execution_ledger"] = ".loom/status/current.md"
        init_path.write_text(json.dumps(init_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "fact-chain", "--target", str(dual_ledger_target), "--item", "INIT-0001"],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`dual execution ledger` failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`dual execution ledger` must block fact-chain consumption"))
        elif "second execution ledger locator" not in json.dumps(payload.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("daily-execution-cli", "`dual execution ledger` must report the second ledger locator"))

        stale_target = Path(tmp) / "stale-status"
        shutil.copytree(example_target, stale_target)
        status_path = stale_target / ".loom/status/current.md"
        status_text = status_path.read_text(encoding="utf-8")
        status_path.write_text(
            status_text.replace(
                "- Next Step: Accept the generated Loom entry and promote the first real repository work item.",
                "- Next Step: Stale derived status should not override recovery.",
            ).replace(
                "- Latest Validation Summary: Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist.",
                "- Latest Validation Summary: Stale status summary must be rejected.",
            ),
            encoding="utf-8",
        )
        for label, args in (
            (
                "stale status fact-chain",
                ["python3", "tools/loom_flow.py", "fact-chain", "--target", str(stale_target), "--item", "INIT-0001"],
            ),
            (
                "stale status flow resume",
                ["python3", "tools/loom_flow.py", "flow", "resume", "--target", str(stale_target), "--item", "INIT-0001"],
            ),
            (
                "stale status control",
                ["python3", "tools/loom_status.py", "--target", str(stale_target), "--item", "INIT-0001"],
            ),
        ):
            payload, error = load_command_json(root, args)
            if error:
                failures.append(Failure("daily-execution-cli", f"`{label}` failed: {error}"))
                continue
            if payload.get("result") != "block":
                failures.append(Failure("daily-execution-cli", f"`{label}` must block stale derived status surfaces"))
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context=f"`{label}`",
                payload=payload.get("report") if label.endswith("fact-chain") else payload,
            )
            failure_blob = json.dumps(payload.get("blocking_failures") or payload.get("report", {}).get("blocking_failures"), ensure_ascii=False)
            if "stale" not in failure_blob and "parallel_truth_drift" not in failure_blob:
                failures.append(Failure("daily-execution-cli", f"`{label}` must expose stale/drift blocking failures"))

        mirror_target = Path(tmp) / "host-mirror-overwrite"
        shutil.copytree(example_target, mirror_target)
        init_path = mirror_target / ".loom/bootstrap/init-result.json"
        init_payload = json.loads(init_path.read_text(encoding="utf-8"))
        init_payload.setdefault("fact_chain", {})["host_mirror"] = {
            "next_step": "Host mirror attempted to override recovery.",
            "latest_validation_summary": "Retained result attempted to override recovery.",
        }
        init_path.write_text(json.dumps(init_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "fact-chain", "--target", str(mirror_target), "--item", "INIT-0001"],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`host mirror overwrite` failed: {error}"))
        else:
            if payload.get("result") != "block":
                failures.append(Failure("daily-execution-cli", "`host mirror overwrite` must block parallel authored recovery fields"))
            report = payload.get("report")
            require_fact_chain_provenance(
                failures,
                category="daily-execution-cli",
                context="`host mirror overwrite`.report",
                payload=report,
            )
            failure_blob = json.dumps(report.get("blocking_failures") if isinstance(report, dict) else [], ensure_ascii=False)
            if "parallel_truth_drift" not in failure_blob:
                failures.append(Failure("daily-execution-cli", "`host mirror overwrite` must expose parallel_truth_drift"))

    with tempfile.TemporaryDirectory(prefix="loom-check-review-run-") as tmp:
        source_snapshot = Path(tmp) / "source-snapshot"
        review_target = Path(tmp) / "new-project"
        fake_bin = Path(tmp) / "bin"
        fake_bin.mkdir(parents=True, exist_ok=True)
        shutil.copytree(root, source_snapshot, ignore=shutil.ignore_patterns(".git", ".DS_Store", "__pycache__", ".agents"))

        def prepare_review_target(target: Path, label: str) -> bool:
            shutil.copytree(source_snapshot, target)
            for args in (
                ["git", "init"],
                ["git", "config", "user.email", "loom-check@example.com"],
                ["git", "config", "user.name", "loom-check"],
            ):
                result = run_command(root, args, cwd=target)
                if result.returncode != 0:
                    detail = result.stderr.strip() or result.stdout.strip() or "git setup failed"
                    failures.append(Failure("daily-execution-cli", f"`{label}` setup failed: {detail}"))
                    return False
            payload, error = load_command_json(
                root,
                [
                    "python3",
                    "tools/loom_init.py",
                    "bootstrap",
                    "--target",
                    ".",
                    "--write",
                    "--force",
                    "--verify",
                    "--install-pr-template",
                ],
                cwd=target,
            )
            if error:
                failures.append(Failure("daily-execution-cli", f"`{label}` bootstrap failed: {error}"))
                return False
            verification = payload.get("verification")
            if not isinstance(verification, dict) or verification.get("ok") is not True:
                failures.append(Failure("daily-execution-cli", f"`{label}` bootstrap must verify successfully"))
                return False
            prune_fixture_work_items(target)
            for args in (
                ["git", "add", "."],
                ["git", "add", "-f", ".loom"],
                ["git", "commit", "-m", "review-run baseline"],
            ):
                result = run_command(root, args, cwd=target)
                if result.returncode != 0:
                    detail = result.stderr.strip() or result.stdout.strip() or "git baseline commit failed"
                    failures.append(Failure("daily-execution-cli", f"`{label}` setup failed: {detail}"))
                    return False
            head = run_command(root, ["git", "rev-parse", "HEAD"], cwd=target)
            if head.returncode != 0:
                detail = head.stderr.strip() or head.stdout.strip() or "git rev-parse failed"
                failures.append(Failure("daily-execution-cli", f"`{label}` setup failed: {detail}"))
                return False
            reviewed_head = head.stdout.strip() or "unknown-head"
            spec_review_path = target / ".loom/reviews/INIT-0001.spec.json"
            spec_review_path.write_text(
                json.dumps(
                    {
                        "schema_version": "loom-review/v1",
                        "item_id": "INIT-0001",
                        "decision": "allow",
                        "kind": "spec_review",
                        "summary": "Formal spec is approved for downstream review-run tests.",
                        "reviewer": "loom-check",
                        "reviewed_head": reviewed_head,
                        "reviewed_validation_summary": "Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist.",
                        "fallback_to": None,
                        "findings": [],
                        "blocking_issues": [],
                        "follow_ups": [],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            for args in (
                ["git", "add", "-f", ".loom/reviews/INIT-0001.spec.json"],
                ["git", "commit", "-m", "record spec review baseline"],
            ):
                result = run_command(root, args, cwd=target)
                if result.returncode != 0:
                    detail = result.stderr.strip() or result.stdout.strip() or "git spec review baseline failed"
                    failures.append(Failure("daily-execution-cli", f"`{label}` setup failed: {detail}"))
                    return False
            return True

        prepare_review_target(review_target, "review run positive chain")
        write_fake_codex(fake_bin / "codex", mode="success")
        success_env = prepend_path_env(fake_bin, {"CI": "", "CODEX_CI": ""})

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(review_target),
                "--item",
                "INIT-0001",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` positive chain failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` positive chain",
                payload=payload,
                expected_result={"pass"},
            )
            if isinstance(payload, dict):
                engine = payload.get("engine") if isinstance(payload.get("engine"), dict) else {}
                if engine.get("engine") != "codex" or engine.get("adapter") != "loom/default-codex-exec":
                    failures.append(Failure("daily-execution-cli", "`review run` positive chain must keep the default codex exec adapter"))
                review_record_input = payload.get("review_record_input") if isinstance(payload.get("review_record_input"), dict) else {}
                if review_record_input.get("engine_adapter") != "loom/default-codex-exec" or review_record_input.get("reviewer") != "loom/default-codex-exec":
                    failures.append(Failure("daily-execution-cli", "`review run` positive chain must keep default review_record_input adapter"))
                evidence = payload.get("engine", {}).get("evidence") if isinstance(payload.get("engine"), dict) else None
                context_pack_path = evidence.get("context_pack") if isinstance(evidence, dict) else None
                prompt_path = evidence.get("prompt") if isinstance(evidence, dict) else None
                if not isinstance(context_pack_path, str) or not (review_target / context_pack_path).exists():
                    failures.append(Failure("daily-execution-cli", "`review run` positive chain must write context pack evidence"))
                else:
                    context_pack = json.loads((review_target / context_pack_path).read_text(encoding="utf-8"))
                    if context_pack.get("schema_version") != "loom-review-context-pack/v1":
                        failures.append(Failure("daily-execution-cli", "`review run` context pack must use the stable schema"))
                    if not isinstance(context_pack.get("repeated_blocker_signal"), dict):
                        failures.append(Failure("daily-execution-cli", "`review run` context pack must include repeated blocker signal"))
                prompt_file = (review_target / prompt_path) if isinstance(prompt_path, str) else None
                if prompt_file is None or not prompt_file.exists() or "Recent Review Context Pack" not in prompt_file.read_text(encoding="utf-8"):
                    failures.append(Failure("daily-execution-cli", "`review run` prompt must include recent review context pack guidance"))
                profile_probe = json.loads(json.dumps(payload))
                if isinstance(profile_probe.get("engine"), dict):
                    profile_probe["engine"].pop("profile", None)
                profile_probe_failures: list[Failure] = []
                require_review_run_payload(
                    profile_probe_failures,
                    category="daily-execution-cli",
                    context="`review run` missing profile probe",
                    payload=profile_probe,
                    expected_result={"pass"},
                )
                if not any("engine profile" in failure.detail for failure in profile_probe_failures):
                    failures.append(Failure("daily-execution-cli", "`review run` contract check must fail when resolved profile metadata is missing"))

        shadow_target = Path(tmp) / "review-run-shadow"
        prepare_review_target(shadow_target, "review run shadow adapter")
        shadow_raw = shadow_target / ".loom/runtime/tmp/codex-app-review-raw.json"
        shadow_raw.parent.mkdir(parents=True, exist_ok=True)
        shadow_raw.write_text(
            json.dumps(
                {
                    "decision": "fallback",
                    "summary": "Codex App reviewer produced shadow-only findings.",
                    "findings": [
                        {
                            "id": "shadow-warn-1",
                            "summary": "Codex App shadow review noted a comparison-only issue.",
                            "severity": "warn",
                            "rebuttal": None,
                            "disposition": {
                                "status": "deferred",
                                "summary": "Shadow evidence must not author the formal review record.",
                            },
                        }
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        write_fake_codex(fake_bin / "codex", mode="success")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(shadow_target),
                "--item",
                "INIT-0001",
                "--shadow-engine-adapter",
                "loom/codex-app-review",
                "--shadow-review-raw-file",
                ".loom/runtime/tmp/codex-app-review-raw.json",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` shadow adapter failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` shadow adapter",
                payload=payload,
                expected_result={"pass"},
            )
            if isinstance(payload, dict):
                review_record_input = payload.get("review_record_input") if isinstance(payload.get("review_record_input"), dict) else {}
                if review_record_input.get("engine_adapter") != "loom/default-codex-exec":
                    failures.append(Failure("daily-execution-cli", "`review run` shadow adapter must not replace default review_record_input engine adapter"))
                shadow_engine = payload.get("shadow_engine") if isinstance(payload.get("shadow_engine"), dict) else {}
                if shadow_engine.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`review run` shadow adapter must pass when raw review evidence is provided"))
                evidence = shadow_engine.get("evidence") if isinstance(shadow_engine.get("evidence"), dict) else {}
                for key in ("raw_review", "normalized_findings", "metadata", "parity_diff"):
                    value = evidence.get(key)
                    if not isinstance(value, str) or not (shadow_target / value).exists():
                        failures.append(Failure("daily-execution-cli", f"`review run` shadow adapter must write {key} evidence"))
                if shadow_engine.get("authoritative") is not False or shadow_engine.get("blocking") is not False:
                    failures.append(Failure("daily-execution-cli", "`review run` shadow adapter must stay non-authoritative and non-blocking"))

        shadow_unavailable_target = Path(tmp) / "review-run-shadow-unavailable"
        prepare_review_target(shadow_unavailable_target, "review run shadow unavailable")
        write_fake_codex(fake_bin / "codex", mode="success")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(shadow_unavailable_target),
                "--item",
                "INIT-0001",
                "--shadow-engine-adapter",
                "loom/codex-app-review",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` shadow unavailable failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` shadow unavailable",
                payload=payload,
                expected_result={"pass"},
            )
            shadow_engine = payload.get("shadow_engine") if isinstance(payload, dict) and isinstance(payload.get("shadow_engine"), dict) else {}
            if shadow_engine.get("result") != "unavailable":
                failures.append(Failure("daily-execution-cli", "`review run` shadow unavailable must not block the default review path"))
            review_record_input = payload.get("review_record_input") if isinstance(payload, dict) and isinstance(payload.get("review_record_input"), dict) else {}
            if review_record_input.get("engine_adapter") != "loom/default-codex-exec":
                failures.append(Failure("daily-execution-cli", "`review run` shadow unavailable must preserve the default review record input"))

        app_default_target = Path(tmp) / "review-run-codex-app-default"
        prepare_review_target(app_default_target, "review run Codex App host default")
        app_default_raw = app_default_target / ".loom/runtime/tmp/codex-app-review-normalized.json"
        app_default_raw.parent.mkdir(parents=True, exist_ok=True)
        app_default_raw.write_text(
            json.dumps(
                {
                    "decision": "allow",
                    "summary": "Codex App default reviewer found the item ready.",
                    "findings": [
                        {
                            "id": "codex-app-default-warn-1",
                            "summary": "Codex App default review noted a tracked follow-up.",
                            "severity": "warn",
                            "rebuttal": None,
                            "disposition": {
                                "status": "accepted",
                                "summary": "The finding is recorded through the single review record boundary.",
                            },
                        }
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        write_fake_codex(fake_bin / "codex", mode="fail_if_called")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(app_default_target),
                "--item",
                "INIT-0001",
                "--codex-app-review-app-server",
                "stdio://stage3-default-proof",
                "--codex-app-review-thread-id",
                "thread-stage3-default-proof",
                "--codex-app-review-cwd",
                str(app_default_target),
                "--codex-app-review-raw-file",
                ".loom/runtime/tmp/codex-app-review-normalized.json",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` Codex App host default failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` Codex App host default",
                payload=payload,
                expected_result={"pass"},
            )
            if isinstance(payload, dict):
                engine = payload.get("engine") if isinstance(payload.get("engine"), dict) else {}
                if engine.get("adapter") != "loom/codex-app-review" or engine.get("engine") != "codex-app-review":
                    failures.append(Failure("daily-execution-cli", "`review run` Codex App host default must select the app adapter"))
                review_record_input = payload.get("review_record_input") if isinstance(payload.get("review_record_input"), dict) else {}
                if review_record_input.get("engine_adapter") != "loom/codex-app-review" or review_record_input.get("reviewer") != "loom/codex-app-review":
                    failures.append(Failure("daily-execution-cli", "`review run` Codex App host default must author app adapter review_record_input"))
                metadata = payload.get("engine_metadata") if isinstance(payload.get("engine_metadata"), dict) else {}
                if metadata.get("selection_source") != "codex-app-host-default" or metadata.get("thread_id") != "thread-stage3-default-proof":
                    failures.append(Failure("daily-execution-cli", "`review run` Codex App host default must expose selected adapter and thread proof metadata"))
                merge_payload, merge_error = load_command_json(
                    root,
                    [
                        "python3",
                        "tools/loom_flow.py",
                        "flow",
                        "merge-ready",
                        "--target",
                        str(app_default_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if merge_error:
                    failures.append(Failure("daily-execution-cli", f"`merge-ready before authored default app review record` failed: {merge_error}"))
                elif merge_payload.get("result") == "pass":
                    failures.append(Failure("daily-execution-cli", "`merge-ready` must not consume default Codex App raw evidence before review record is authored"))

        app_ci_fallback_target = Path(tmp) / "review-run-codex-app-ci-fallback"
        prepare_review_target(app_ci_fallback_target, "review run Codex App CI fallback")
        app_ci_raw = app_ci_fallback_target / ".loom/runtime/tmp/codex-app-review-normalized.json"
        app_ci_raw.parent.mkdir(parents=True, exist_ok=True)
        app_ci_raw.write_text(app_default_raw.read_text(encoding="utf-8"), encoding="utf-8")
        write_fake_codex(fake_bin / "codex", mode="success")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(app_ci_fallback_target),
                "--item",
                "INIT-0001",
                "--codex-app-review-app-server",
                "stdio://stage3-ci-proof",
                "--codex-app-review-thread-id",
                "thread-stage3-ci-proof",
                "--codex-app-review-cwd",
                str(app_ci_fallback_target),
                "--codex-app-review-raw-file",
                ".loom/runtime/tmp/codex-app-review-normalized.json",
            ],
            env=prepend_path_env(fake_bin, {"CODEX_CI": "1"}),
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` Codex App CI fallback failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` Codex App CI fallback",
                payload=payload,
                expected_result={"pass"},
            )
            engine = payload.get("engine") if isinstance(payload, dict) and isinstance(payload.get("engine"), dict) else {}
            metadata = payload.get("engine_metadata") if isinstance(payload, dict) and isinstance(payload.get("engine_metadata"), dict) else {}
            if engine.get("adapter") != "loom/default-codex-exec" or metadata.get("fallback_reason") != "ci-or-codex-ci":
                failures.append(Failure("daily-execution-cli", "`review run` Codex App CI fallback must keep the default codex exec adapter"))

        app_unavailable_fallback_target = Path(tmp) / "review-run-codex-app-unavailable-fallback"
        prepare_review_target(app_unavailable_fallback_target, "review run Codex App unavailable fallback")
        write_fake_codex(fake_bin / "codex", mode="success")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(app_unavailable_fallback_target),
                "--item",
                "INIT-0001",
                "--codex-app-review-app-server",
                f"unix://{tmp}/missing-codex-app.sock",
                "--codex-app-review-thread-id",
                "thread-stage3-missing-endpoint",
                "--codex-app-review-cwd",
                str(app_unavailable_fallback_target),
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` Codex App unavailable fallback failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` Codex App unavailable fallback",
                payload=payload,
                expected_result={"pass"},
            )
            engine = payload.get("engine") if isinstance(payload, dict) and isinstance(payload.get("engine"), dict) else {}
            metadata = payload.get("engine_metadata") if isinstance(payload, dict) and isinstance(payload.get("engine_metadata"), dict) else {}
            if engine.get("adapter") != "loom/default-codex-exec" or metadata.get("fallback_reason") != "app-server-unavailable":
                failures.append(Failure("daily-execution-cli", "`review run` Codex App unavailable fallback must record default adapter fallback"))

        app_conflict_target = Path(tmp) / "review-run-codex-app-proof-conflict"
        prepare_review_target(app_conflict_target, "review run Codex App proof conflict")
        app_conflict_raw = app_conflict_target / ".loom/runtime/tmp/codex-app-review-normalized.json"
        app_conflict_raw.parent.mkdir(parents=True, exist_ok=True)
        app_conflict_raw.write_text(app_default_raw.read_text(encoding="utf-8"), encoding="utf-8")
        write_fake_codex(fake_bin / "codex", mode="fail_if_called")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(app_conflict_target),
                "--item",
                "INIT-0001",
                "--codex-app-review-app-server",
                "stdio://stage3-conflict-proof",
                "--codex-app-review-thread-id",
                "thread-stage3-conflict-proof",
                "--codex-app-review-cwd",
                str(Path(tmp) / "different-cwd"),
                "--codex-app-review-raw-file",
                ".loom/runtime/tmp/codex-app-review-normalized.json",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` Codex App proof conflict failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`review run` Codex App proof conflict must fail closed"))
        else:
            engine = payload.get("engine") if isinstance(payload, dict) and isinstance(payload.get("engine"), dict) else {}
            if engine.get("adapter") != "loom/codex-app-review" or engine.get("failure_reason") != "runtime_conflict":
                failures.append(Failure("daily-execution-cli", "`review run` Codex App proof conflict must not fallback to default codex"))
            if "does not match target root" not in json.dumps(payload.get("missing_inputs"), ensure_ascii=False):
                failures.append(Failure("daily-execution-cli", "`review run` Codex App proof conflict must expose cwd mismatch"))
            if isinstance(payload, dict) and isinstance(payload.get("review_record_input"), dict):
                failures.append(Failure("daily-execution-cli", "`review run` Codex App proof conflict must not emit review_record_input"))

        app_authoritative_target = Path(tmp) / "review-run-codex-app-authoritative"
        prepare_review_target(app_authoritative_target, "review run Codex App authoritative")
        app_raw = app_authoritative_target / ".loom/runtime/tmp/codex-app-review-normalized.json"
        app_raw.parent.mkdir(parents=True, exist_ok=True)
        app_raw.write_text(
            json.dumps(
                {
                    "decision": "allow",
                    "summary": "Codex App authoritative reviewer found the item ready.",
                    "findings": [
                        {
                            "id": "codex-app-warn-1",
                            "summary": "Codex App authoritative review noted a tracked follow-up.",
                            "severity": "warn",
                            "rebuttal": None,
                            "disposition": {
                                "status": "accepted",
                                "summary": "The finding is recorded through the single review record boundary.",
                            },
                        }
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        write_fake_codex(fake_bin / "codex", mode="fail_if_called")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(app_authoritative_target),
                "--item",
                "INIT-0001",
                "--engine-adapter",
                "loom/codex-app-review",
                "--codex-app-review-app-server",
                "stdio://stage2-live-proof",
                "--codex-app-review-thread-id",
                "thread-stage2-live-proof",
                "--codex-app-review-cwd",
                str(app_authoritative_target),
                "--codex-app-review-raw-file",
                ".loom/runtime/tmp/codex-app-review-normalized.json",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` Codex App authoritative failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` Codex App authoritative",
                payload=payload,
                expected_result={"pass"},
            )
            if isinstance(payload, dict):
                review_record_input = payload.get("review_record_input") if isinstance(payload.get("review_record_input"), dict) else {}
                if review_record_input.get("engine_adapter") != "loom/codex-app-review":
                    failures.append(Failure("daily-execution-cli", "`review run` Codex App authoritative must author app adapter review_record_input"))
                engine = payload.get("engine") if isinstance(payload.get("engine"), dict) else {}
                if engine.get("engine") != "codex-app-review":
                    failures.append(Failure("daily-execution-cli", "`review run` Codex App authoritative must not call codex exec"))
                metadata = payload.get("engine_metadata") if isinstance(payload.get("engine_metadata"), dict) else {}
                if metadata.get("thread_id") != "thread-stage2-live-proof":
                    failures.append(Failure("daily-execution-cli", "`review run` Codex App authoritative must expose live thread proof metadata"))
                merge_payload, merge_error = load_command_json(
                    root,
                    [
                        "python3",
                        "tools/loom_flow.py",
                        "flow",
                        "merge-ready",
                        "--target",
                        str(app_authoritative_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if merge_error:
                    failures.append(Failure("daily-execution-cli", f"`merge-ready before authored app review record` failed: {merge_error}"))
                elif merge_payload.get("result") == "pass":
                    failures.append(Failure("daily-execution-cli", "`merge-ready` must not consume raw Codex App authoritative evidence before review record is authored"))

        app_missing_target = Path(tmp) / "review-run-codex-app-missing-proof"
        prepare_review_target(app_missing_target, "review run Codex App missing proof")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(app_missing_target),
                "--item",
                "INIT-0001",
                "--engine-adapter",
                "loom/codex-app-review",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` Codex App missing proof failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`review run` Codex App missing proof must fail closed"))

        app_invalid_target = Path(tmp) / "review-run-codex-app-invalid-raw"
        prepare_review_target(app_invalid_target, "review run Codex App invalid raw")
        invalid_raw = app_invalid_target / ".loom/runtime/tmp/codex-app-review-invalid.txt"
        invalid_raw.parent.mkdir(parents=True, exist_ok=True)
        invalid_raw.write_text("plain review text is not authoritative schema\n", encoding="utf-8")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(app_invalid_target),
                "--item",
                "INIT-0001",
                "--engine-adapter",
                "loom/codex-app-review",
                "--codex-app-review-app-server",
                "stdio://stage2-live-proof",
                "--codex-app-review-thread-id",
                "thread-stage2-live-proof",
                "--codex-app-review-cwd",
                str(app_invalid_target),
                "--codex-app-review-raw-file",
                ".loom/runtime/tmp/codex-app-review-invalid.txt",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` Codex App invalid raw failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`review run` Codex App invalid raw must fail closed on schema drift"))

        repeated_target = Path(tmp) / "repeated-blocker-context"
        prepare_review_target(repeated_target, "review run repeated blocker context")
        history_root = repeated_target / ".loom/runtime/review/INIT-0001"
        for attempt in ("attempt-a", "attempt-b"):
            attempt_root = history_root / attempt
            attempt_root.mkdir(parents=True, exist_ok=True)
            (attempt_root / "normalized-findings.json").write_text(
                json.dumps(
                    {
                        "findings": [
                            {
                                "id": "block-context-drift",
                                "summary": "Context drift keeps reappearing after local patch attempts.",
                                "severity": "block",
                                "rebuttal": None,
                                "disposition": {
                                    "status": "accepted",
                                    "summary": "Fixture marks this as a real repeated blocker candidate.",
                                },
                            }
                        ]
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            (attempt_root / "engine-metadata.json").write_text(
                json.dumps({"reviewed_head": attempt, "validation_summary": f"{attempt} validation"}, indent=2) + "\n",
                encoding="utf-8",
            )
        write_fake_codex(fake_bin / "codex", mode="success")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(repeated_target),
                "--item",
                "INIT-0001",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` repeated blocker context failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` repeated blocker context",
                payload=payload,
                expected_result={"pass"},
            )
            evidence = payload.get("engine", {}).get("evidence") if isinstance(payload, dict) and isinstance(payload.get("engine"), dict) else None
            context_pack_path = evidence.get("context_pack") if isinstance(evidence, dict) else None
            if not isinstance(context_pack_path, str):
                failures.append(Failure("daily-execution-cli", "`review run` repeated blocker context must expose context pack evidence"))
            else:
                context_pack = json.loads((repeated_target / context_pack_path).read_text(encoding="utf-8"))
                signal = context_pack.get("repeated_blocker_signal")
                if not isinstance(signal, dict) or signal.get("result") != "present":
                    failures.append(Failure("daily-execution-cli", "`review run` repeated blocker context must identify repeated blocker candidates"))
                candidates = signal.get("candidates") if isinstance(signal, dict) else None
                if not isinstance(candidates, list) or not candidates:
                    failures.append(Failure("daily-execution-cli", "`review run` repeated blocker context must include candidate details"))

        override_target = Path(tmp) / "profile-override"
        prepare_review_target(override_target, "review run profile override")
        write_fake_codex(fake_bin / "codex", mode="success")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(override_target),
                "--item",
                "INIT-0001",
                "--engine-model",
                "gpt-5.2",
                "--engine-reasoning",
                "high",
                "--engine-override-reason",
                "fixture requires explicit high-reasoning review profile evidence",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` profile override failed: {error}"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` profile override",
                payload=payload,
                expected_result={"pass"},
            )
            engine = payload.get("engine") if isinstance(payload, dict) else None
            profile = engine.get("profile") if isinstance(engine, dict) else None
            if not isinstance(profile, dict) or not isinstance(profile.get("override"), dict):
                failures.append(Failure("daily-execution-cli", "`review run` profile override must record previous and selected profile evidence"))
            else:
                override = profile["override"]
                if not isinstance(override.get("previous_profile"), dict) or not isinstance(override.get("selected_profile"), dict):
                    failures.append(Failure("daily-execution-cli", "`review run` profile override must record previous and selected profile"))
                if override.get("reason") != "fixture requires explicit high-reasoning review profile evidence":
                    failures.append(Failure("daily-execution-cli", "`review run` profile override must preserve the override reason"))

        missing_reason_target = Path(tmp) / "profile-override-missing-reason"
        prepare_review_target(missing_reason_target, "review run profile override missing reason")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(missing_reason_target),
                "--item",
                "INIT-0001",
                "--engine-reasoning",
                "high",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` profile override missing reason failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`review run` profile override must block without an override reason"))
        elif "override requires" not in json.dumps(payload.get("missing_inputs"), ensure_ascii=False):
            failures.append(Failure("daily-execution-cli", "`review run` profile override missing reason must expose the missing reason"))

        engine_missing_target = Path(tmp) / "engine-missing"
        prepare_review_target(engine_missing_target, "review run engine unavailable")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(engine_missing_target),
                "--item",
                "INIT-0001",
            ],
            env={"PATH": "/usr/bin:/bin"},
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` engine unavailable failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`review run` must block when the default engine is unavailable"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` engine unavailable",
                payload=payload,
                expected_result={"block"},
            )
            engine = payload.get("engine")
            if isinstance(engine, dict) and engine.get("failure_reason") != "engine_unavailable":
                failures.append(Failure("daily-execution-cli", "`review run` must report `engine_unavailable` when Codex is missing"))
            if payload.get("fallback_to") is not None:
                failures.append(Failure("daily-execution-cli", "`review run` must not convert engine failure into checkpoint fallback"))

        schema_target = Path(tmp) / "schema-drift"
        prepare_review_target(schema_target, "review run schema drift")
        write_fake_codex(fake_bin / "codex", mode="schema_drift")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(schema_target),
                "--item",
                "INIT-0001",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` schema drift failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`review run` must block on schema drift"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` schema drift",
                payload=payload,
                expected_result={"block"},
            )
            engine = payload.get("engine")
            if isinstance(engine, dict) and engine.get("failure_reason") != "schema_drift":
                failures.append(Failure("daily-execution-cli", "`review run` must report `schema_drift` for invalid engine output"))

        dirty_target = Path(tmp) / "tracked-edit"
        prepare_review_target(dirty_target, "review run tracked edit")
        write_fake_codex(fake_bin / "codex", mode="tracked_edit", tracked_edit_target=".loom/status/current.md")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "run",
                "--target",
                str(dirty_target),
                "--item",
                "INIT-0001",
            ],
            env=success_env,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review run` tracked edit failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`review run` must block when engine modifies tracked repo content"))
        else:
            require_review_run_payload(
                failures,
                category="daily-execution-cli",
                context="`review run` tracked edit",
                payload=payload,
                expected_result={"block"},
            )
            engine = payload.get("engine")
            if isinstance(engine, dict) and engine.get("failure_reason") != "repo_diff_detected":
                failures.append(Failure("daily-execution-cli", "`review run` must report `repo_diff_detected` when tracked files change"))

    with tempfile.TemporaryDirectory(prefix="loom-check-flow-") as tmp:
        lifecycle_target = Path(tmp) / "new-project"
        shutil.copytree(example_target, lifecycle_target)
        temp_root = lifecycle_target / ".loom/flow/tmp"
        residue = temp_root / "loom-owned-residue"
        residue.mkdir(parents=True, exist_ok=True)
        (residue / ".loom-owned").write_text("owned\n", encoding="utf-8")
        (residue / "sentinel.txt").write_text("temp\n", encoding="utf-8")

        progress_path = lifecycle_target / ".loom/progress/INIT-0001.md"
        progress_before_handoff = progress_path.read_text(encoding="utf-8")
        handoff_payload, handoff_error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "handoff",
                "--target",
                str(lifecycle_target),
                "--item",
                "INIT-0001",
            ],
        )
        if handoff_error:
            failures.append(Failure("daily-execution-cli", f"`flow handoff` lifecycle fixture failed: {handoff_error}"))
        elif handoff_payload.get("result") not in {"pass", "block"}:
            failures.append(Failure("daily-execution-cli", "`flow handoff` lifecycle fixture must return pass or block"))
        require_lifecycle_expectations_payload(
            failures,
            category="daily-execution-cli",
            context="`flow handoff` lifecycle fixture",
            payload=handoff_payload.get("lifecycle_expectations") if isinstance(handoff_payload, dict) else None,
        )
        if progress_path.read_text(encoding="utf-8") != progress_before_handoff:
            failures.append(Failure("daily-execution-cli", "`flow handoff` must not rewrite the recovery entry"))

        for operation in ("create", "attach", "cleanup", "retire"):
            payload, error = load_command_json(
                root,
                [
                    "python3",
                    "tools/loom_flow.py",
                    "workspace",
                    operation,
                    "--target",
                    str(lifecycle_target),
                    "--item",
                    "INIT-0001",
                ],
            )
            if error:
                failures.append(Failure("daily-execution-cli", f"`workspace {operation}` failed: {error}"))
                continue
            if payload.get("result") != "pass":
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        f"`workspace {operation}` must pass on a clean temp copy, got `{payload.get('result')}`",
                    )
                )
            require_lifecycle_expectations_payload(
                failures,
                category="daily-execution-cli",
                context=f"`workspace {operation}`",
                payload=payload.get("lifecycle_expectations") if isinstance(payload, dict) else None,
            )
            if operation == "cleanup" and residue.exists():
                failures.append(Failure("daily-execution-cli", "`workspace cleanup` must remove marked Loom-owned residue"))

        locate_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "workspace",
                "locate",
                "--target",
                str(lifecycle_target),
                "--item",
                "INIT-0001",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`workspace locate` after retire failed: {error}"))
        elif (
            not isinstance(locate_payload.get("checkpoint"), dict)
            or locate_payload["checkpoint"].get("normalized") != "retired"
        ):
            failures.append(Failure("daily-execution-cli", "`workspace retire` must leave the copied sample in `retired` state"))
        progress_after_retire = progress_path.read_text(encoding="utf-8")
        for stable_line in (
            "- Current Stop:",
            "- Next Step:",
            "- Blockers:",
            "- Latest Validation Summary:",
            "## Execution Ledger",
        ):
            if stable_line not in progress_after_retire:
                failures.append(Failure("daily-execution-cli", f"`workspace retire` must preserve recovery field `{stable_line}`"))

    with tempfile.TemporaryDirectory(prefix="loom-check-missing-workspace-") as tmp:
        missing_workspace_target = Path(tmp) / "new-project"
        shutil.copytree(example_target, missing_workspace_target)
        work_item = missing_workspace_target / ".loom/work-items/INIT-0001.md"
        work_item.write_text(
            work_item.read_text(encoding="utf-8").replace("- Workspace Entry: .", "- Workspace Entry: "),
            encoding="utf-8",
        )
        for label, command in (
            (
                "workspace locate",
                ["python3", "tools/loom_flow.py", "workspace", "locate", "--target", str(missing_workspace_target), "--item", "INIT-0001"],
            ),
            (
                "workspace attach",
                ["python3", "tools/loom_flow.py", "workspace", "attach", "--target", str(missing_workspace_target), "--item", "INIT-0001"],
            ),
            (
                "workspace retire",
                ["python3", "tools/loom_flow.py", "workspace", "retire", "--target", str(missing_workspace_target), "--item", "INIT-0001"],
            ),
            (
                "purity-check",
                ["python3", "tools/loom_flow.py", "purity-check", "--target", str(missing_workspace_target), "--item", "INIT-0001"],
            ),
            (
                "flow resume",
                ["python3", "tools/loom_flow.py", "flow", "resume", "--target", str(missing_workspace_target), "--item", "INIT-0001"],
            ),
            (
                "host-lifecycle",
                ["python3", "tools/loom_flow.py", "host-lifecycle", "--target", str(missing_workspace_target), "--item", "INIT-0001"],
            ),
            (
                "flow handoff",
                ["python3", "tools/loom_flow.py", "flow", "handoff", "--target", str(missing_workspace_target), "--item", "INIT-0001"],
            ),
        ):
            payload, error = load_command_json(root, command)
            if error:
                failures.append(Failure("daily-execution-cli", f"`{label}` missing workspace fixture failed to emit JSON: {error}"))
                continue
            if payload.get("result") not in {"block", "fallback"}:
                failures.append(Failure("daily-execution-cli", f"`{label}` must fail closed when Workspace Entry is missing"))
            missing_text = json.dumps(payload.get("missing_inputs", []), ensure_ascii=False)
            if "Workspace Entry" not in missing_text and "workspace entry" not in missing_text:
                failures.append(Failure("daily-execution-cli", f"`{label}` must report the missing workspace locator"))

    with tempfile.TemporaryDirectory(prefix="loom-check-unowned-temp-") as tmp:
        unowned_target = Path(tmp) / "new-project"
        shutil.copytree(example_target, unowned_target)
        unowned_note = unowned_target / ".loom/flow/tmp/user-note.txt"
        unowned_note.parent.mkdir(parents=True, exist_ok=True)
        unowned_note.write_text("user residue\n", encoding="utf-8")
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "workspace",
                "cleanup",
                "--target",
                str(unowned_target),
                "--item",
                "INIT-0001",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`workspace cleanup` unowned temp fixture failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`workspace cleanup` must block on unmarked temp content"))
        if not unowned_note.exists():
            failures.append(Failure("daily-execution-cli", "`workspace cleanup` must not delete non-Loom-owned temp content"))

    with tempfile.TemporaryDirectory(prefix="loom-check-authoring-") as tmp:
        authoring_target = Path(tmp) / "new-project"
        shutil.copytree(example_target, authoring_target)

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "recovery",
                "writeback",
                "--target",
                str(authoring_target),
                "--item",
                "INIT-0001",
                "--current-stop",
                "Bootstrap review has started.",
                "--next-step",
                "Record the first formal review conclusion.",
                "--latest-validation-summary",
                "Bootstrap artifacts verified and ready for semantic review.",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`recovery writeback` failed: {error}"))
        elif payload.get("result") != "pass":
            failures.append(Failure("daily-execution-cli", "`recovery writeback` must pass on a clean temp copy"))

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "work-item",
                "create",
                "--target",
                str(authoring_target),
                "--item",
                "NEXT-0001",
                "--goal",
                "Validate work item authoring",
                "--scope",
                "Limit changes to `.loom/` artifacts for this temp check",
                "--execution-path",
                "execution/support",
                "--workspace-entry",
                ".",
                "--validation-entry",
                "python3 .loom/bin/loom_init.py verify --target .",
                "--closing-condition",
                "The authored work item can be activated and read mechanically.",
                "--init-recovery",
                "--activate",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`work-item create` failed: {error}"))
        elif payload.get("result") != "pass":
            failures.append(Failure("daily-execution-cli", "`work-item create --activate` must pass on a clean temp copy"))

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "work-item",
                "update",
                "--target",
                str(authoring_target),
                "--item",
                "NEXT-0001",
                "--scope",
                "Keep the temp authoring check constrained to `.loom/` files",
                "--add-artifact",
                ".loom/reviews/NEXT-0001.json",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`work-item update` failed: {error}"))
        elif payload.get("result") != "pass":
            failures.append(Failure("daily-execution-cli", "`work-item update` must pass on a clean temp copy"))

        poisoned_authoring_target = temp_root / "authoring-poisoned-workspace"
        shutil.copytree(authoring_target, poisoned_authoring_target)
        poisoned_work_item = poisoned_authoring_target / ".loom/work-items/NEXT-0001.md"
        poisoned_before = poisoned_work_item.read_text(encoding="utf-8").replace(
            "- Workspace Entry: .",
            "- Workspace Entry: ../outside.md",
        )
        poisoned_work_item.write_text(poisoned_before, encoding="utf-8")
        poisoned_init = poisoned_authoring_target / ".loom/bootstrap/init-result.json"
        poisoned_init_before = load_json_file(poisoned_init)
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "work-item",
                "update",
                "--target",
                str(poisoned_authoring_target),
                "--item",
                "NEXT-0001",
                "--scope",
                "This update must not persist because the workspace locator is unsafe",
                "--activate",
            ],
        )
        poisoned_init_after = load_json_file(poisoned_init)
        if error:
            failures.append(Failure("daily-execution-cli", f"`work-item update --activate` poisoned workspace sample failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`work-item update --activate` must block poisoned workspace locators"))
        elif poisoned_work_item.read_text(encoding="utf-8") != poisoned_before:
            failures.append(Failure("daily-execution-cli", "`work-item update --activate` must not rewrite a poisoned Work Item before locator validation passes"))
        elif poisoned_init_after.get("fact_chain", {}).get("entry_points") != poisoned_init_before.get("fact_chain", {}).get("entry_points"):
            failures.append(Failure("daily-execution-cli", "`work-item update --activate` must not mutate active fact-chain locators when locator validation blocks"))

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_init.py",
                "verify",
                "--target",
                str(authoring_target),
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`loom-init verify` active item rollover failed: {error}"))
        elif payload.get("ok") is not True:
            failures.append(Failure("daily-execution-cli", "`loom-init verify` must pass after active item rollover"))

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_status.py",
                "--target",
                str(authoring_target),
                "--item",
                "NEXT-0001",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`loom-status` active item rollover failed: {error}"))
        else:
            current_item = payload.get("item", {}).get("id") if isinstance(payload.get("item"), dict) else None
            if current_item != "NEXT-0001":
                failures.append(Failure("daily-execution-cli", "`loom-status` must report the rolled-over active item"))
            governance_surface = payload.get("governance_surface")
            if isinstance(governance_surface, dict):
                carrier_summary = governance_surface.get("carrier_summary")
                if isinstance(carrier_summary, dict):
                    work_item = carrier_summary.get("work_item")
                    recovery = carrier_summary.get("recovery")
                    if isinstance(work_item, dict) and work_item.get("locator") != ".loom/work-items/NEXT-0001.md":
                        failures.append(Failure("daily-execution-cli", "`loom-status` carrier summary must point to the active Work Item"))
                    if isinstance(recovery, dict) and recovery.get("locator") != ".loom/progress/NEXT-0001.md":
                        failures.append(Failure("daily-execution-cli", "`loom-status` carrier summary must point to the active recovery entry"))
                execution_entry = str(governance_surface.get("execution_entry", ""))
                if "--item NEXT-0001" not in execution_entry:
                    failures.append(Failure("daily-execution-cli", "`loom-status` execution entry must resume the active Work Item"))

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "spec-review",
                "--target",
                str(authoring_target),
                "--item",
                "NEXT-0001",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`flow spec-review` active item rollover failed: {error}"))
        elif payload.get("result") not in {"block", "fallback"}:
            failures.append(Failure("daily-execution-cli", "`flow spec-review` must not pass when the active item has no spec suite"))
        elif ".loom/specs/INIT-0001/spec.md" in json.dumps(payload, ensure_ascii=False):
            failures.append(Failure("daily-execution-cli", "`flow spec-review` must not fall back to the bootstrap spec suite for a rolled-over active item"))

        findings_path = authoring_target / ".loom" / "review-findings.json"
        findings_path.parent.mkdir(parents=True, exist_ok=True)
        findings_path.write_text(
            json.dumps(
                [
                    {
                        "id": "compat-block-1",
                        "summary": "Formal review has not approved the item yet.",
                        "severity": "block",
                        "rebuttal": None,
                        "disposition": {
                            "status": "rejected",
                            "summary": "The finding remains open until the missing approval signal is resolved."
                        },
                    },
                    {
                        "id": "compat-warn-1",
                        "summary": "Re-run formal review after the missing approval signal is resolved.",
                        "severity": "warn",
                        "rebuttal": "A follow-up review will be recorded after the blocking issue is resolved.",
                        "disposition": {
                            "status": "deferred",
                            "summary": "This follow-up stays open until the next formal review."
                        },
                    },
                ],
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "review",
                "record",
                "--target",
                str(authoring_target),
                "--item",
                "NEXT-0001",
                "--decision",
                "fallback",
                "--kind",
                "code_review",
                "--summary",
                "Formal review has not approved the item yet.",
                "--reviewer",
                "loom-check",
                "--fallback-to",
                "admission",
                "--findings-file",
                ".loom/review-findings.json",
            ],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`review record` failed: {error}"))
        elif payload.get("result") != "pass":
            failures.append(Failure("daily-execution-cli", "`review record` must pass for an authored fallback decision"))
        else:
            review = payload.get("review")
            if isinstance(review, dict):
                require_review_record_contract(
                    failures,
                    category="daily-execution-cli",
                    context="`review record` review.record",
                    payload=review.get("record"),
                )

    if shutil.which("git") is not None:
        with tempfile.TemporaryDirectory(prefix="loom-check-purity-") as tmp:
            dirty_target = Path(tmp) / "new-project"
            shutil.copytree(example_target, dirty_target)
            run_command(root, ["git", "init"], cwd=dirty_target)
            run_command(root, ["git", "config", "user.email", "loom-check@example.com"], cwd=dirty_target)
            run_command(root, ["git", "config", "user.name", "loom-check"], cwd=dirty_target)
            run_command(root, ["git", "add", "."], cwd=dirty_target)
            run_command(root, ["git", "commit", "-m", "baseline"], cwd=dirty_target)
            (dirty_target / "untriaged.txt").write_text("pending\n", encoding="utf-8")
            payload, error = load_command_json(
                root,
                [
                    "python3",
                    "tools/loom_flow.py",
                    "purity-check",
                    "--target",
                    str(dirty_target),
                    "--item",
                    "INIT-0001",
                ],
            )
            if error:
                failures.append(Failure("daily-execution-cli", f"`purity-check` negative sample failed: {error}"))
            elif payload.get("result") != "block":
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        f"`purity-check` negative sample must block, got `{payload.get('result')}`",
                    )
                )
            state_payload, error = load_command_json(
                root,
                [
                    "python3",
                    "tools/loom_flow.py",
                    "state-check",
                    "--target",
                    str(dirty_target),
                    "--item",
                    "INIT-0001",
                ],
            )
            if error:
                failures.append(Failure("daily-execution-cli", f"`state-check` negative sample failed: {error}"))
            elif state_payload.get("result") != "block":
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        f"`state-check` negative sample must block, got `{state_payload.get('result')}`",
                    )
                )

    with tempfile.TemporaryDirectory(prefix="loom-check-runtime-state-") as tmp:
        tmp_root = Path(tmp)
        install_root = tmp_root / "installed" / "skills"
        target_root = tmp_root / "target"
        bootstrap_target = tmp_root / "bootstrapped-target"
        shutil.copytree(root / "skills", install_root)
        target_root.mkdir(parents=True, exist_ok=True)
        shutil.copytree(example_target, bootstrap_target)

        payload, error = load_command_json(
            root,
            ["python3", str(install_root / "loom-init" / "scripts" / "loom-init.py"), "runtime-state", "--target", str(target_root)],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`installed loom-init runtime-state` failed: {error}"))
        else:
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`installed loom-init runtime-state`",
                payload=payload.get("runtime_state"),
                expected_scene="installed-runtime",
                expected_carrier="installed-skills-root",
                allowed_results={"pass"},
            )

        payload, error = load_command_json(
            root,
            ["python3", str(install_root / "shared" / "scripts" / "loom_flow.py"), "runtime-state", "--target", str(target_root)],
            env={"LOOM_RUNTIME_SCENE": "upgrade-rehearsal"},
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`installed loom-flow runtime-state -- rehearsal` failed: {error}"))
        else:
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`installed loom-flow runtime-state -- rehearsal`",
                payload=payload.get("runtime_state"),
                expected_scene="upgrade-rehearsal",
                expected_carrier="installed-skills-root",
                allowed_results={"pass"},
            )

        broken_install = tmp_root / "broken-install" / "skills"
        shutil.copytree(root / "skills", broken_install)
        (broken_install / "loom-init" / ".loom-runtime" / "shared" / "scripts" / "loom_flow.py").unlink()
        payload, error = load_command_json(
            root,
            ["python3", str(broken_install / "loom-init" / "scripts" / "loom-init.py"), "runtime-state", "--target", str(target_root)],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`installed runtime-state` missing shared runtime failed unexpectedly: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`installed runtime-state` must block when shared runtime is missing"))

        drift_install = tmp_root / "drift-install" / "skills"
        shutil.copytree(root / "skills", drift_install)
        (drift_install / "loom-init" / ".loom-runtime" / "install-layout.json").unlink()
        payload, error = load_command_json(
            root,
            ["python3", str(drift_install / "loom-init" / "scripts" / "loom-init.py"), "runtime-state", "--target", str(target_root)],
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`installed runtime-state` missing install-layout failed unexpectedly: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`installed runtime-state` must block when install-layout is missing"))

        payload, error = load_command_json(
            root,
            ["python3", str(install_root / "shared" / "scripts" / "loom_flow.py"), "runtime-state", "--target", str(target_root)],
            env={"LOOM_RUNTIME_SCENE": "repo-local-demo"},
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`installed runtime-state` scene conflict failed unexpectedly: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`installed runtime-state` must block on scene/carrier conflict"))

        source_repo = tmp_root / "source"
        sibling_prefix_install = tmp_root / "source-evil" / "skills"
        source_repo.mkdir(parents=True, exist_ok=True)
        shutil.copytree(root / "skills", sibling_prefix_install)
        payload, error = load_command_json(
            root,
            [
                "python3",
                str(sibling_prefix_install / "shared" / "scripts" / "loom_flow.py"),
                "runtime-state",
                "--target",
                str(target_root),
            ],
            env={"LOOM_SOURCE_REPO_ROOT": str(source_repo)},
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`repo-local runtime-state` sibling-prefix escape failed unexpectedly: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`repo-local runtime-state` must block sibling-prefix install roots outside the source repo"))
        else:
            runtime_state = payload.get("runtime_state")
            missing_inputs = runtime_state.get("missing_inputs") if isinstance(runtime_state, dict) else []
            if not any("install root must stay inside the source repository" in str(item) for item in missing_inputs):
                failures.append(Failure("daily-execution-cli", "`repo-local runtime-state` sibling-prefix escape must expose the source-repo containment error"))

        payload, error = load_command_json(
            root,
            ["python3", ".loom/bin/loom_init.py", "runtime-state", "--target", "."],
            cwd=bootstrap_target,
            env={"LOOM_SOURCE_REPO_ROOT": "/tmp/not-loom"},
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`bootstrapped loom-init runtime-state with unrelated source env` failed: {error}"))
        else:
            require_runtime_state_payload(
                failures,
                category="daily-execution-cli",
                context="`bootstrapped loom-init runtime-state with unrelated source env`",
                payload=payload.get("runtime_state"),
                expected_scene="installed-runtime",
                expected_carrier="bootstrapped-target-runtime",
                allowed_results={"pass"},
            )

        payload, error = load_command_json(
            root,
            ["python3", ".loom/bin/loom_init.py", "route", "--target", ".", "--task", "inspect adoption carrier"],
            cwd=bootstrap_target,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`bootstrapped loom-init route` failed: {error}"))
        else:
            require_route_payload(
                failures,
                category="daily-execution-cli",
                context="`bootstrapped loom-init route`",
                payload=payload,
                expected_skill="loom-adopt",
                expected_mode="implicit",
                allowed_results={"pass"},
            )
            runtime_state = payload.get("runtime_state")
            if not isinstance(runtime_state, dict) or runtime_state.get("carrier") != "bootstrapped-target-runtime":
                failures.append(Failure("daily-execution-cli", "`bootstrapped loom-init route` must use the bootstrapped target runtime carrier"))
            registry_check = (
                runtime_state.get("checks", {}).get("registry_contract")
                if isinstance(runtime_state, dict) and isinstance(runtime_state.get("checks"), dict)
                else None
            )
            if not isinstance(registry_check, dict) or registry_check.get("status") != "not_applicable":
                failures.append(Failure("daily-execution-cli", "`bootstrapped loom-init route` must not require skills/registry.json"))

        broken_bootstrap = tmp_root / "broken-bootstrapped-target"
        shutil.copytree(example_target, broken_bootstrap)
        manifest_path = broken_bootstrap / ".loom" / "bootstrap" / "manifest.json"
        manifest = load_json_file(manifest_path)
        if isinstance(manifest, dict):
            artifacts = manifest.get("artifacts")
            if isinstance(artifacts, list):
                for artifact in artifacts:
                    if isinstance(artifact, dict) and artifact.get("path") == ".loom/bin/runtime_state.py":
                        artifact["source"] = "broken/source.py"
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        payload, error = load_command_json(
            root,
            ["python3", ".loom/bin/loom_init.py", "runtime-state", "--target", "."],
            cwd=broken_bootstrap,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`bootstrapped runtime-state` manifest drift failed unexpectedly: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`bootstrapped runtime-state` must block when the bootstrap manifest drifts"))

        hash_drift_bootstrap = tmp_root / "hash-drift-bootstrapped-target"
        shutil.copytree(example_target, hash_drift_bootstrap)
        manifest_path = hash_drift_bootstrap / ".loom" / "bootstrap" / "manifest.json"
        manifest = load_json_file(manifest_path)
        if isinstance(manifest, dict):
            artifacts = manifest.get("artifacts")
            if isinstance(artifacts, list):
                for artifact in artifacts:
                    if isinstance(artifact, dict) and artifact.get("path") == ".loom/bin/runtime_state.py":
                        artifact["sha256"] = "0" * 64
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        payload, error = load_command_json(
            root,
            ["python3", ".loom/bin/loom_init.py", "runtime-state", "--target", "."],
            cwd=hash_drift_bootstrap,
        )
        if error:
            failures.append(Failure("daily-execution-cli", f"`bootstrapped runtime-state` provenance hash drift failed unexpectedly: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("daily-execution-cli", "`bootstrapped runtime-state` must block when runtime provenance hashes drift"))

    with tempfile.TemporaryDirectory(prefix="loom-check-governance-surface-boundary-") as tmp:
        tmp_root = Path(tmp)
        outside = tmp_root / "outside.md"
        outside.write_text("# outside\n", encoding="utf-8")
        for label, unsafe_locator in (
            ("parent escape", "../outside.md"),
            ("absolute locator", str(outside)),
        ):
            poisoned_target = tmp_root / f"governance-{label.replace(' ', '-')}"
            shutil.copytree(example_target, poisoned_target)
            init_result_path = poisoned_target / ".loom/bootstrap/init-result.json"
            init_result = load_json_file(init_result_path)
            if isinstance(init_result, dict):
                entry_points = init_result.get("fact_chain", {}).get("entry_points")
                if isinstance(entry_points, dict):
                    entry_points["work_item"] = unsafe_locator
                    entry_points["recovery_entry"] = unsafe_locator
                    entry_points["status_surface"] = unsafe_locator
                init_result_path.write_text(json.dumps(init_result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            governance_surface = build_governance_surface(poisoned_target)
            carrier_summary = governance_surface.get("carrier_summary") if isinstance(governance_surface, dict) else None
            if not isinstance(carrier_summary, dict):
                failures.append(Failure("daily-execution-cli", f"`governance surface` {label} fixture must expose carrier summary"))
                continue
            for carrier in ("work_item", "recovery", "status_surface"):
                entry = carrier_summary.get(carrier)
                if isinstance(entry, dict) and entry.get("status") == "present":
                    failures.append(Failure("daily-execution-cli", f"`governance surface` must not report unsafe {label} `{carrier}` fact-chain locators as present"))

    if shutil.which("git") is not None:
        with tempfile.TemporaryDirectory(prefix="loom-check-installed-pre-merge-") as tmp:
            tmp_root = Path(tmp)
            install_root = tmp_root / "installed" / "skills"
            source_snapshot = tmp_root / "source-snapshot"
            positive_target = tmp_root / "positive-target"
            review_fallback_target = tmp_root / "review-fallback-target"
            fake_bin = tmp_root / "bin"
            fake_bin.mkdir(parents=True, exist_ok=True)
            write_fake_codex(fake_bin / "codex", mode="success")
            installed_review_env = prepend_path_env(fake_bin)
            shutil.copytree(root / "skills", install_root)
            shutil.copytree(root, source_snapshot, ignore=shutil.ignore_patterns(".git", ".DS_Store", "__pycache__", ".agents"))

            def prepare_target(target: Path) -> tuple[str | None, list[str]]:
                errors: list[str] = []
                shutil.copytree(source_snapshot, target)
                for args in (
                    ["git", "init"],
                    ["git", "config", "user.email", "loom-check@example.com"],
                    ["git", "config", "user.name", "loom-check"],
                ):
                    result = run_command(root, args, cwd=target)
                    if result.returncode != 0:
                        detail = result.stderr.strip() or result.stdout.strip() or "git setup failed"
                        errors.append(detail)
                        return None, errors

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-init" / "scripts" / "loom-init.py"),
                        "bootstrap",
                        "--target",
                        str(target),
                        "--write",
                        "--force",
                        "--verify",
                        "--install-pr-template",
                    ],
                )
                if error:
                    errors.append(error)
                    return None, errors
                verification = payload.get("verification")
                if not isinstance(verification, dict) or verification.get("ok") is not True:
                    errors.append("installed bootstrap must verify successfully before the pre-merge chain starts")
                    return None, errors
                prune_fixture_work_items(target)

                git_add = run_command(root, ["git", "add", "."], cwd=target)
                if git_add.returncode != 0:
                    detail = git_add.stderr.strip() or git_add.stdout.strip() or "git add failed"
                    errors.append(detail)
                    return None, errors
                git_commit = run_command(root, ["git", "commit", "-m", "bootstrap baseline for #209"], cwd=target)
                if git_commit.returncode != 0:
                    detail = git_commit.stderr.strip() or git_commit.stdout.strip() or "git commit failed"
                    errors.append(detail)
                    return None, errors

                resume_payload, resume_error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-resume" / "scripts" / "loom-resume.py"),
                        "flow",
                        "resume",
                        "--target",
                        str(target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if resume_error:
                    errors.append(resume_error)
                    return None, errors
                recovery = resume_payload.get("recovery")
                if not isinstance(recovery, dict):
                    errors.append("resume payload must include `recovery`")
                    return None, errors
                summary = recovery.get("latest_validation_summary")
                if not isinstance(summary, str) or not summary:
                    errors.append("resume payload must expose a non-empty `latest_validation_summary`")
                    return None, errors
                return summary, errors

            positive_summary, positive_setup_errors = prepare_target(positive_target)
            if positive_setup_errors:
                failures.append(
                    Failure(
                        "daily-execution-cli",
                        f"`installed pre-merge chain` setup failed: {'; '.join(positive_setup_errors)}",
                    )
                )
            else:
                task_signals = {
                    "resume": "请接手当前事项并恢复上下文后继续推进",
                    "pre-review": "请在进入 review 前做统一检查",
                    "spec-review": "请先对 formal spec 做 spec review",
                    "review": "请对当前事项做正式 review 并给出审查结论",
                    "merge-ready": "请做 merge-ready 最终放行前预检并确认是否可以合并",
                }

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-init" / "scripts" / "loom-init.py"),
                        "route",
                        "--target",
                        str(positive_target),
                        "--task",
                        task_signals["resume"],
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed route resume` failed: {error}"))
                else:
                    require_route_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed route resume`",
                        payload=payload,
                        expected_skill="loom-resume",
                        expected_mode="implicit",
                        expected_runtime_scene="installed-runtime",
                        expected_runtime_carrier="installed-skills-root",
                    )

                resume_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-resume" / "scripts" / "loom-resume.py"),
                        "flow",
                        "resume",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed flow resume` failed: {error}"))
                elif resume_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed flow resume` must pass for the positive chain"))
                else:
                    require_runtime_state_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed flow resume`",
                        payload=resume_payload.get("runtime_state"),
                        expected_scene="installed-runtime",
                        expected_carrier="installed-skills-root",
                        allowed_results={"pass"},
                    )
                    require_execution_attempt_summary(
                        failures,
                        category="daily-execution-cli",
                        context="`installed flow resume`",
                        payload=resume_payload.get("execution_attempt"),
                        expected_operation="resume",
                    )
                    latest_attempt_status, latest_attempt_errors = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "shared" / "scripts" / "loom_status.py"),
                            "--target",
                            str(positive_target),
                            "--item",
                            "INIT-0001",
                        ],
                    )
                    if latest_attempt_errors:
                        failures.append(Failure("daily-execution-cli", f"`installed status latest attempt` failed: {latest_attempt_errors}"))
                    else:
                        latest_attempt = latest_attempt_status.get("latest_execution_attempt")
                        if not isinstance(latest_attempt, dict):
                            failures.append(Failure("daily-execution-cli", "`loom_status` must include latest_execution_attempt"))
                        elif latest_attempt.get("freshness") != "fresh":
                            failures.append(Failure("daily-execution-cli", "`loom_status` must expose the latest fresh execution_attempt after flow resume"))

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-init" / "scripts" / "loom-init.py"),
                        "route",
                        "--target",
                        str(positive_target),
                        "--task",
                        task_signals["pre-review"],
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed route pre-review` failed: {error}"))
                else:
                    require_route_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed route pre-review`",
                        payload=payload,
                        expected_skill="loom-pre-review",
                        expected_mode="implicit",
                        expected_runtime_scene="installed-runtime",
                        expected_runtime_carrier="installed-skills-root",
                    )

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-pre-review" / "scripts" / "loom-pre-review.py"),
                        "flow",
                        "pre-review",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed flow pre-review` failed: {error}"))
                elif payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed flow pre-review` must pass for the positive chain"))
                else:
                    require_execution_attempt_summary(
                        failures,
                        category="daily-execution-cli",
                        context="`installed flow pre-review`",
                        payload=payload.get("execution_attempt"),
                        expected_operation="pre-review",
                    )

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-init" / "scripts" / "loom-init.py"),
                        "route",
                        "--target",
                        str(positive_target),
                        "--task",
                        task_signals["spec-review"],
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed route spec-review` failed: {error}"))
                else:
                    require_route_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed route spec-review`",
                        payload=payload,
                        expected_skill="loom-spec-review",
                        expected_mode="implicit",
                        expected_runtime_scene="installed-runtime",
                        expected_runtime_carrier="installed-skills-root",
                    )

                spec_review_flow_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-spec-review" / "scripts" / "loom-spec-review.py"),
                        "flow",
                        "spec-review",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed flow spec-review` failed: {error}"))
                elif spec_review_flow_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed flow spec-review` must pass for the positive chain"))
                else:
                    require_execution_attempt_summary(
                        failures,
                        category="daily-execution-cli",
                        context="`installed flow spec-review`",
                        payload=spec_review_flow_payload.get("execution_attempt"),
                        expected_operation="spec-review",
                    )

                spec_review_run_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "review",
                        "run",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--review-file",
                        ".loom/reviews/INIT-0001.spec.json",
                    ],
                    env=installed_review_env,
                    timeout_seconds=150,
                )
                spec_review_record_input: dict[str, object] | None = None
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed spec review run` failed: {error}"))
                elif spec_review_run_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed spec review run` must pass for the positive chain"))
                else:
                    require_review_run_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed spec review run`",
                        payload=spec_review_run_payload,
                        expected_result={"pass"},
                    )
                    spec_review_record_input = (
                        spec_review_run_payload.get("review_record_input")
                        if isinstance(spec_review_run_payload, dict)
                        else None
                    )

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-spec-review" / "scripts" / "loom-spec-review.py"),
                        "review",
                        "record",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--review-file",
                        ".loom/reviews/INIT-0001.spec.json",
                        "--decision",
                        str(spec_review_record_input.get("decision", "allow")) if isinstance(spec_review_record_input, dict) else "allow",
                        "--kind",
                        "spec_review",
                        "--summary",
                        str(spec_review_record_input.get("summary", "Installed formal spec is approved for downstream review."))
                        if isinstance(spec_review_record_input, dict)
                        else "Installed formal spec is approved for downstream review.",
                        "--reviewer",
                        str(spec_review_record_input.get("reviewer", "loom-check")) if isinstance(spec_review_record_input, dict) else "loom-check",
                        "--findings-file",
                        str(spec_review_record_input.get("findings_file", ".loom/review-findings.json"))
                        if isinstance(spec_review_record_input, dict)
                        else ".loom/review-findings.json",
                        "--engine-adapter",
                        str(spec_review_record_input.get("engine_adapter", "loom/default-codex-exec"))
                        if isinstance(spec_review_record_input, dict)
                        else "loom/default-codex-exec",
                        "--engine-evidence",
                        str(spec_review_record_input.get("engine_evidence", ".loom/runtime/review/INIT-0001/unknown-head/engine-result.json"))
                        if isinstance(spec_review_record_input, dict)
                        else ".loom/runtime/review/INIT-0001/unknown-head/engine-result.json",
                        "--normalized-findings",
                        str(spec_review_record_input.get("normalized_findings", ".loom/review-findings.json"))
                        if isinstance(spec_review_record_input, dict)
                        else ".loom/review-findings.json",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed spec review record allow` failed: {error}"))
                elif payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed spec review record allow` must pass"))

                spec_plan_path = positive_target / ".loom/specs/INIT-0001/plan.md"
                spec_plan_text = spec_plan_path.read_text(encoding="utf-8")
                spec_plan_path.unlink()
                try:
                    payload, error = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "loom-spec-review" / "scripts" / "loom-spec-review.py"),
                            "review",
                            "record",
                            "--target",
                            str(positive_target),
                            "--item",
                            "INIT-0001",
                            "--review-file",
                            ".loom/reviews/INIT-0001.spec.json",
                            "--decision",
                            "allow",
                            "--kind",
                            "spec_review",
                            "--summary",
                            "Incomplete formal spec suite should not be approved.",
                            "--reviewer",
                            "loom-check",
                        ],
                    )
                    if error:
                        failures.append(Failure("daily-execution-cli", f"`installed incomplete spec review record` failed: {error}"))
                    elif payload.get("result") != "block":
                        failures.append(Failure("daily-execution-cli", "`installed incomplete spec review record` must block"))
                    elif not any("plan.md" in str(item) for item in payload.get("missing_inputs", [])):
                        failures.append(Failure("daily-execution-cli", "`installed incomplete spec review record` must name the missing plan.md"))
                finally:
                    spec_plan_path.write_text(spec_plan_text, encoding="utf-8")

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-init" / "scripts" / "loom-init.py"),
                        "route",
                        "--target",
                        str(positive_target),
                        "--task",
                        task_signals["review"],
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed route review` failed: {error}"))
                else:
                    require_route_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed route review`",
                        payload=payload,
                        expected_skill="loom-review",
                        expected_mode="implicit",
                        expected_runtime_scene="installed-runtime",
                        expected_runtime_carrier="installed-skills-root",
                    )

                review_flow_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-review" / "scripts" / "loom-review.py"),
                        "flow",
                        "review",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed flow review` failed: {error}"))
                elif review_flow_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed flow review` must pass for the positive chain"))
                else:
                    review = review_flow_payload.get("review")
                    if isinstance(review, dict):
                        require_review_record_contract(
                            failures,
                            category="daily-execution-cli",
                            context="`installed flow review` review.record",
                            payload=review.get("record"),
                        )

                review_run_payload: dict[str, object] | None = None
                review_record_input: dict[str, object] | None = None
                review_run_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "review",
                        "run",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                    env=installed_review_env,
                    timeout_seconds=150,
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed review run` failed: {error}"))
                elif review_run_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed review run` must pass for the positive chain"))
                else:
                    require_review_run_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed review run`",
                        payload=review_run_payload,
                        expected_result={"pass"},
                    )
                    review_record_input = review_run_payload.get("review_record_input") if isinstance(review_run_payload, dict) else None
                review_record_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-review" / "scripts" / "loom-review.py"),
                        "review",
                        "record",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--decision",
                        str(review_record_input.get("decision", "allow")) if isinstance(review_record_input, dict) else "allow",
                        "--kind",
                        str(review_record_input.get("kind", "code_review")) if isinstance(review_record_input, dict) else "code_review",
                        "--summary",
                        str(review_record_input.get("summary", "Installed pre-merge chain is ready for merge checkpoint consumption."))
                        if isinstance(review_record_input, dict)
                        else "Installed pre-merge chain is ready for merge checkpoint consumption.",
                        "--reviewer",
                        str(review_record_input.get("reviewer", "loom-check")) if isinstance(review_record_input, dict) else "loom-check",
                        "--findings-file",
                        str(review_record_input.get("findings_file", ".loom/review-findings.json")) if isinstance(review_record_input, dict) else ".loom/review-findings.json",
                        "--engine-adapter",
                        str(review_record_input.get("engine_adapter", "loom/default-codex-exec")) if isinstance(review_record_input, dict) else "loom/default-codex-exec",
                        "--engine-evidence",
                        str(review_record_input.get("engine_evidence", ".loom/runtime/review/INIT-0001/unknown-head/engine-result.json"))
                        if isinstance(review_record_input, dict)
                        else ".loom/runtime/review/INIT-0001/unknown-head/engine-result.json",
                        "--normalized-findings",
                        str(review_record_input.get("normalized_findings", ".loom/review-findings.json"))
                        if isinstance(review_record_input, dict)
                        else ".loom/review-findings.json",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed review record allow` failed: {error}"))
                elif review_record_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed review record allow` must pass"))
                else:
                    review = review_record_payload.get("review")
                    if isinstance(review, dict):
                        require_review_record_contract(
                            failures,
                            category="daily-execution-cli",
                            context="`installed review record allow` review.record",
                            payload=review.get("record"),
                        )

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "recovery",
                        "writeback",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--current-checkpoint",
                        "merge checkpoint",
                        "--current-stop",
                        "Installed review completed and merge-ready validation is next.",
                        "--next-step",
                        "Run merge-ready and checkpoint merge from installed skills.",
                        "--latest-validation-summary",
                        positive_summary,
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed recovery writeback for merge` failed: {error}"))
                elif payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed recovery writeback for merge` must pass"))

                git_add = run_command(
                    root,
                    [
                        "git",
                        "add",
                        "-f",
                        ".loom/progress/INIT-0001.md",
                        ".loom/status/current.md",
                        ".loom/reviews/INIT-0001.json",
                    ],
                    cwd=positive_target,
                )
                if git_add.returncode != 0:
                    detail = git_add.stderr.strip() or git_add.stdout.strip() or "git add failed"
                    failures.append(Failure("daily-execution-cli", f"`installed pre-merge carrier commit` add failed: {detail}"))
                else:
                    git_commit = run_command(
                        root,
                        ["git", "commit", "-m", "author installed pre-merge carriers for #209"],
                        cwd=positive_target,
                    )
                    if git_commit.returncode != 0:
                        detail = git_commit.stderr.strip() or git_commit.stdout.strip() or "git commit failed"
                        failures.append(Failure("daily-execution-cli", f"`installed pre-merge carrier commit` failed: {detail}"))

                def current_head(target: Path) -> str:
                    result = run_command(root, ["git", "rev-parse", "HEAD"], cwd=target)
                    return result.stdout.strip()

                def write_json_fixture(target: Path, relative: str, payload: object) -> str:
                    path = target / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                    return relative

                def pr_gate_fixture(target: Path, *, number: int = 1) -> str:
                    return write_json_fixture(
                        target,
                        ".loom/tmp/pr-gate/pr.json",
                        {
                            "number": number,
                            "state": "OPEN",
                            "isDraft": False,
                            "headRefName": "feature/pr-gate",
                            "baseRefName": "main",
                            "headRefOid": current_head(target),
                            "body": "## Related Work\n\n- Loom Work Item: INIT-0001\n",
                            "url": f"https://github.example/owner/repo/pull/{number}",
                        },
                    )

                pr_fixture = pr_gate_fixture(positive_target)
                pr_gate_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "pr-gate",
                        "check",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--pr",
                        "1",
                        "--pr-payload-file",
                        pr_fixture,
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed pr-gate` positive failed: {error}"))
                elif pr_gate_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed pr-gate` must pass for fresh authored review approval"))
                else:
                    if pr_gate_payload.get("schema_version") != "loom-pr-merge-gate/v1":
                        failures.append(Failure("daily-execution-cli", "`installed pr-gate` must expose the stable schema"))
                    approval_boundary = pr_gate_payload.get("approval_boundary")
                    if not isinstance(approval_boundary, dict) or approval_boundary.get("raw_review_evidence_satisfies_approval") is not False:
                        failures.append(Failure("daily-execution-cli", "`installed pr-gate` must reject raw review evidence as approval truth"))
                    review_approval = pr_gate_payload.get("review_approval")
                    if not isinstance(review_approval, dict) or review_approval.get("decision") != "allow":
                        failures.append(Failure("daily-execution-cli", "`installed pr-gate` must read the authored allow review record"))

                protection_fixture = write_json_fixture(
                    positive_target,
                    ".loom/tmp/pr-gate/branch-protection.json",
                    {
                        "required_status_checks": {
                            "contexts": ["py-compile", "loom-check", "loom-pr-merge-gate"],
                        },
                    },
                )
                status_fixture = write_json_fixture(
                    positive_target,
                    ".loom/tmp/pr-gate/status-checks.json",
                    {
                        "statusCheckRollup": [
                            {"name": "py-compile", "status": "COMPLETED", "conclusion": "SUCCESS"},
                            {"name": "loom-check", "status": "COMPLETED", "conclusion": "SUCCESS"},
                            {"name": "loom-pr-merge-gate", "status": "COMPLETED", "conclusion": "SUCCESS"},
                        ],
                    },
                )
                controlled_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "controlled-merge",
                        "check",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--pr",
                        "1",
                        "--pr-payload-file",
                        pr_fixture,
                        "--branch-protection-file",
                        protection_fixture,
                        "--status-checks-file",
                        status_fixture,
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed controlled-merge` positive failed: {error}"))
                elif controlled_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed controlled-merge` check must pass when pr-gate and required checks pass"))
                else:
                    host_enforcement = controlled_payload.get("host_enforcement")
                    merge = controlled_payload.get("merge")
                    if not isinstance(host_enforcement, dict) or host_enforcement.get("required") is not True:
                        failures.append(Failure("daily-execution-cli", "`installed controlled-merge` must prove loom-pr-merge-gate is required"))
                    if not isinstance(merge, dict) or merge.get("attempted") is not False or merge.get("dry_run") is not True:
                        failures.append(Failure("daily-execution-cli", "`installed controlled-merge check` must not call gh pr merge"))

                missing_gate_protection = write_json_fixture(
                    positive_target,
                    ".loom/tmp/pr-gate/branch-protection-missing-pr-gate.json",
                    {
                        "required_status_checks": {
                            "contexts": ["py-compile", "loom-check"],
                        },
                    },
                )
                controlled_missing_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "controlled-merge",
                        "check",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--pr",
                        "1",
                        "--pr-payload-file",
                        pr_fixture,
                        "--branch-protection-file",
                        missing_gate_protection,
                        "--status-checks-file",
                        status_fixture,
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed controlled-merge` missing required gate failed: {error}"))
                elif controlled_missing_payload.get("result") != "block":
                    failures.append(Failure("daily-execution-cli", "`installed controlled-merge` must block when loom-pr-merge-gate is not required"))

                ruleset_fixture = write_json_fixture(
                    positive_target,
                    ".loom/tmp/pr-gate/branch-ruleset.json",
                    [
                        {
                            "type": "required_status_checks",
                            "parameters": {
                                "required_status_checks": [
                                    {"context": "loom-pr-merge-gate"},
                                ],
                            },
                        },
                    ],
                )
                controlled_ruleset_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "controlled-merge",
                        "check",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--pr",
                        "1",
                        "--pr-payload-file",
                        pr_fixture,
                        "--branch-protection-file",
                        missing_gate_protection,
                        "--ruleset-file",
                        ruleset_fixture,
                        "--status-checks-file",
                        status_fixture,
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed controlled-merge` ruleset required gate failed: {error}"))
                elif controlled_ruleset_payload.get("result") != "pass":
                    failures.append(
                        Failure(
                            "daily-execution-cli",
                            "`installed controlled-merge` must pass when an active ruleset requires "
                            f"loom-pr-merge-gate; got result={controlled_ruleset_payload.get('result')} "
                            f"missing={controlled_ruleset_payload.get('missing_inputs')} "
                            f"host_enforcement={controlled_ruleset_payload.get('host_enforcement')}",
                        )
                    )
                else:
                    host_enforcement = controlled_ruleset_payload.get("host_enforcement")
                    if not isinstance(host_enforcement, dict) or "loom-pr-merge-gate" not in host_enforcement.get("ruleset_required_contexts", []):
                        failures.append(Failure("daily-execution-cli", "`installed controlled-merge` must expose ruleset required contexts"))

                missing_review_target = tmp_root / "pr-gate-missing-review"
                shutil.copytree(positive_target, missing_review_target)
                review_path = missing_review_target / ".loom/reviews/INIT-0001.json"
                if review_path.exists():
                    review_path.unlink()
                git_add = run_command(root, ["git", "add", "-u", ".loom/reviews/INIT-0001.json"], cwd=missing_review_target)
                git_commit = run_command(root, ["git", "commit", "-m", "remove authored review for pr gate fixture"], cwd=missing_review_target)
                if git_add.returncode != 0 or git_commit.returncode != 0:
                    failures.append(Failure("daily-execution-cli", "`installed pr-gate` missing review fixture setup failed"))
                else:
                    missing_pr_fixture = pr_gate_fixture(missing_review_target, number=2)
                    missing_review_payload, error = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "shared" / "scripts" / "loom_flow.py"),
                            "pr-gate",
                            "check",
                            "--target",
                            str(missing_review_target),
                            "--item",
                            "INIT-0001",
                            "--pr",
                            "2",
                            "--pr-payload-file",
                            missing_pr_fixture,
                        ],
                    )
                    taxonomy = missing_review_payload.get("failure_taxonomy") if isinstance(missing_review_payload, dict) else []
                    if error:
                        failures.append(Failure("daily-execution-cli", f"`installed pr-gate` missing review failed: {error}"))
                    elif missing_review_payload.get("result") != "block" or "review_missing" not in taxonomy:
                        failures.append(Failure("daily-execution-cli", "`installed pr-gate` must block when authored review is missing"))

                raw_only_target = tmp_root / "pr-gate-raw-only"
                shutil.copytree(positive_target, raw_only_target)
                raw_review_path = raw_only_target / ".loom/reviews/INIT-0001.json"
                if raw_review_path.exists():
                    raw_review_path.unlink()
                write_json_fixture(
                    raw_only_target,
                    ".loom/runtime/review/INIT-0001/raw-only-head/engine-result.json",
                    {"decision": "allow", "summary": "Raw evidence must not satisfy the PR gate.", "findings": []},
                )
                git_add = run_command(root, ["git", "add", "-f", "-A", ".loom/reviews/INIT-0001.json", ".loom/runtime/review"], cwd=raw_only_target)
                git_commit = run_command(root, ["git", "commit", "-m", "leave only raw review evidence for pr gate fixture"], cwd=raw_only_target)
                if git_add.returncode != 0 or git_commit.returncode != 0:
                    detail = git_add.stderr.strip() or git_add.stdout.strip() or git_commit.stderr.strip() or git_commit.stdout.strip() or "git fixture setup failed"
                    failures.append(Failure("daily-execution-cli", f"`installed pr-gate` raw evidence fixture setup failed: {detail}"))
                else:
                    raw_pr_fixture = pr_gate_fixture(raw_only_target, number=3)
                    raw_only_payload, error = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "shared" / "scripts" / "loom_flow.py"),
                            "pr-gate",
                            "check",
                            "--target",
                            str(raw_only_target),
                            "--item",
                            "INIT-0001",
                            "--pr",
                            "3",
                            "--pr-payload-file",
                            raw_pr_fixture,
                        ],
                    )
                    taxonomy = raw_only_payload.get("failure_taxonomy") if isinstance(raw_only_payload, dict) else []
                    if error:
                        failures.append(Failure("daily-execution-cli", f"`installed pr-gate` raw evidence bypass failed: {error}"))
                    elif raw_only_payload.get("result") != "block" or "raw_evidence_bypass" not in taxonomy:
                        failures.append(Failure("daily-execution-cli", "`installed pr-gate` must block raw-evidence-only approval bypass"))

                block_decision_target = tmp_root / "pr-gate-block-decision"
                shutil.copytree(positive_target, block_decision_target)
                block_review_path = block_decision_target / ".loom/reviews/INIT-0001.json"
                try:
                    block_review = json.loads(block_review_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError):
                    block_review = {}
                if isinstance(block_review, dict):
                    block_review["decision"] = "block"
                    block_review["summary"] = "Fixture review blocks merge."
                    block_review_path.write_text(json.dumps(block_review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                git_add = run_command(root, ["git", "add", "-f", ".loom/reviews/INIT-0001.json"], cwd=block_decision_target)
                git_commit = run_command(root, ["git", "commit", "-m", "author blocking review fixture"], cwd=block_decision_target)
                if git_add.returncode != 0 or git_commit.returncode != 0:
                    detail = git_add.stderr.strip() or git_add.stdout.strip() or git_commit.stderr.strip() or git_commit.stdout.strip() or "git fixture setup failed"
                    failures.append(Failure("daily-execution-cli", f"`installed pr-gate` block decision fixture setup failed: {detail}"))
                else:
                    block_pr_fixture = pr_gate_fixture(block_decision_target, number=4)
                    block_decision_payload, error = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "shared" / "scripts" / "loom_flow.py"),
                            "pr-gate",
                            "check",
                            "--target",
                            str(block_decision_target),
                            "--item",
                            "INIT-0001",
                            "--pr",
                            "4",
                            "--pr-payload-file",
                            block_pr_fixture,
                        ],
                    )
                    taxonomy = block_decision_payload.get("failure_taxonomy") if isinstance(block_decision_payload, dict) else []
                    if error:
                        failures.append(Failure("daily-execution-cli", f"`installed pr-gate` block decision failed: {error}"))
                    elif block_decision_payload.get("result") != "block" or "review_not_approved" not in taxonomy:
                        failures.append(Failure("daily-execution-cli", "`installed pr-gate` must block non-allow authored review decisions"))

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-init" / "scripts" / "loom-init.py"),
                        "route",
                        "--target",
                        str(positive_target),
                        "--task",
                        task_signals["merge-ready"],
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed route merge-ready` failed: {error}"))
                else:
                    require_route_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed route merge-ready`",
                        payload=payload,
                        expected_skill="loom-merge-ready",
                        expected_mode="implicit",
                        expected_runtime_scene="installed-runtime",
                        expected_runtime_carrier="installed-skills-root",
                    )

                merge_ready_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "loom-merge-ready" / "scripts" / "loom-merge-ready.py"),
                        "flow",
                        "merge-ready",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed flow merge-ready` failed: {error}"))
                elif merge_ready_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed flow merge-ready` must pass for the positive chain"))
                else:
                    merge_checkpoint = merge_ready_payload.get("merge_checkpoint")
                    if not isinstance(merge_checkpoint, dict) or merge_checkpoint.get("result") != "pass":
                        failures.append(Failure("daily-execution-cli", "`installed flow merge-ready` must expose `merge_checkpoint.result = pass`"))

                checkpoint_merge_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "checkpoint",
                        "merge",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed checkpoint merge` failed: {error}"))
                elif checkpoint_merge_payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed checkpoint merge` must pass for the positive chain"))

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "recovery",
                        "writeback",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--current-checkpoint",
                        "merge checkpoint",
                        "--current-stop",
                        "Only Loom carrier status changed after review.",
                        "--next-step",
                        "Confirm carrier-only review head binding remains consumable.",
                        "--latest-validation-summary",
                        positive_summary,
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed recovery writeback carrier-only` failed: {error}"))
                elif payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed recovery writeback carrier-only` must pass"))
                git_add = run_command(root, ["git", "add", "-f", ".loom/progress/INIT-0001.md", ".loom/status/current.md"], cwd=positive_target)
                if git_add.returncode != 0:
                    detail = git_add.stderr.strip() or git_add.stdout.strip() or "git add failed"
                    failures.append(Failure("daily-execution-cli", f"`installed carrier-only commit` add failed: {detail}"))
                else:
                    git_commit = run_command(
                        root,
                        ["git", "commit", "-m", "refresh carriers after review for #354"],
                        cwd=positive_target,
                    )
                    if git_commit.returncode != 0:
                        detail = git_commit.stderr.strip() or git_commit.stdout.strip() or "git commit failed"
                        failures.append(Failure("daily-execution-cli", f"`installed carrier-only commit` failed: {detail}"))

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "checkpoint",
                        "merge",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed checkpoint merge` carrier-only failed: {error}"))
                elif payload.get("result") != "pass":
                    failures.append(Failure("daily-execution-cli", "`installed checkpoint merge` must pass for carrier-only review head drift"))
                elif "carrier-only" not in json.dumps(payload, ensure_ascii=False):
                    failures.append(Failure("daily-execution-cli", "`installed checkpoint merge` must expose carrier-only review head binding"))

                broken_install = tmp_root / "broken-install" / "skills"
                shutil.copytree(root / "skills", broken_install)
                (broken_install / "loom-init" / ".loom-runtime" / "install-layout.json").unlink()
                (broken_install / "loom-pre-review" / ".loom-runtime" / "install-layout.json").unlink()
                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(broken_install / "loom-init" / "scripts" / "loom-init.py"),
                        "route",
                        "--target",
                        str(positive_target),
                        "--task",
                        task_signals["resume"],
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed route` missing install-layout failed unexpectedly: {error}"))
                else:
                    require_route_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed route` missing install-layout",
                        payload=payload,
                        expected_skill="loom-init",
                        expected_mode="fallback",
                        expected_runtime_scene="installed-runtime",
                        expected_runtime_carrier="installed-skills-root",
                        allowed_results={"block"},
                    )

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(broken_install / "loom-pre-review" / "scripts" / "loom-pre-review.py"),
                        "flow",
                        "pre-review",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed flow pre-review` missing install-layout failed unexpectedly: {error}"))
                elif payload.get("result") != "block":
                    failures.append(Failure("daily-execution-cli", "`installed flow pre-review` must block when install-layout is missing"))
                else:
                    require_runtime_state_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed flow pre-review` missing install-layout",
                        payload=payload.get("runtime_state"),
                        expected_scene="installed-runtime",
                        expected_carrier="installed-skills-root",
                        allowed_results={"block"},
                    )

                review_fallback_summary, review_fallback_errors = prepare_target(review_fallback_target)
                if review_fallback_errors:
                    failures.append(
                        Failure(
                            "daily-execution-cli",
                            f"`installed review baseline fallback` setup failed: {'; '.join(review_fallback_errors)}",
                        )
                    )
                else:
                    payload, error = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "shared" / "scripts" / "loom_flow.py"),
                            "recovery",
                            "writeback",
                            "--target",
                            str(review_fallback_target),
                            "--item",
                            "INIT-0001",
                            "--current-checkpoint",
                            "admission checkpoint",
                            "--current-stop",
                            "Installed review baseline is still at admission.",
                            "--next-step",
                            "Promote the target repo to build checkpoint before review.",
                            "--latest-validation-summary",
                            review_fallback_summary,
                        ],
                    )
                    if error:
                        failures.append(Failure("daily-execution-cli", f"`installed recovery writeback for admission fallback` failed: {error}"))
                    elif payload.get("result") != "pass":
                        failures.append(Failure("daily-execution-cli", "`installed recovery writeback for admission fallback` must pass"))

                    git_add = run_command(
                        root,
                        ["git", "add", "-f", ".loom/progress/INIT-0001.md", ".loom/status/current.md"],
                        cwd=review_fallback_target,
                    )
                    if git_add.returncode != 0:
                        detail = git_add.stderr.strip() or git_add.stdout.strip() or "git add failed"
                        failures.append(Failure("daily-execution-cli", f"`installed review baseline fallback` add failed: {detail}"))
                    else:
                        git_commit = run_command(
                            root,
                            ["git", "commit", "-m", "lower checkpoint to admission for #209 fallback"],
                            cwd=review_fallback_target,
                        )
                        if git_commit.returncode != 0:
                            detail = git_commit.stderr.strip() or git_commit.stdout.strip() or "git commit failed"
                            failures.append(Failure("daily-execution-cli", f"`installed review baseline fallback` commit failed: {detail}"))

                    payload, error = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "loom-review" / "scripts" / "loom-review.py"),
                            "flow",
                            "review",
                            "--target",
                            str(review_fallback_target),
                            "--item",
                            "INIT-0001",
                        ],
                    )
                    if error:
                        failures.append(Failure("daily-execution-cli", f"`installed flow review` admission fallback failed: {error}"))
                    elif payload.get("result") != "fallback" or payload.get("fallback_to") != "admission":
                        failures.append(Failure("daily-execution-cli", "`installed flow review` must fall back to `admission` when build checkpoint is missing"))

                    payload, error = load_command_json(
                        root,
                        [
                            "python3",
                            str(install_root / "loom-merge-ready" / "scripts" / "loom-merge-ready.py"),
                            "flow",
                            "merge-ready",
                            "--target",
                            str(review_fallback_target),
                            "--item",
                            "INIT-0001",
                        ],
                    )
                    if error:
                        failures.append(Failure("daily-execution-cli", f"`installed flow merge-ready` review-baseline fallback failed: {error}"))
                    elif payload.get("result") not in {"fallback", "block"}:
                        failures.append(Failure("daily-execution-cli", "`installed flow merge-ready` must fail closed when review baseline is missing"))

                readme_path = positive_target / "README.md"
                readme_path.write_text(readme_path.read_text(encoding="utf-8") + "\n# review-head-drift\n", encoding="utf-8")
                git_add = run_command(root, ["git", "add", "README.md"], cwd=positive_target)
                if git_add.returncode != 0:
                    detail = git_add.stderr.strip() or git_add.stdout.strip() or "git add failed"
                    failures.append(Failure("daily-execution-cli", f"`installed merge-ready drift` add failed: {detail}"))
                else:
                    git_commit = run_command(
                        root,
                        ["git", "commit", "-m", "introduce non-carrier drift after review for #209"],
                        cwd=positive_target,
                    )
                    if git_commit.returncode != 0:
                        detail = git_commit.stderr.strip() or git_commit.stdout.strip() or "git commit failed"
                        failures.append(Failure("daily-execution-cli", f"`installed merge-ready drift` commit failed: {detail}"))

                stale_pr_fixture = pr_gate_fixture(positive_target, number=5)
                stale_pr_payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "pr-gate",
                        "check",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                        "--pr",
                        "5",
                        "--pr-payload-file",
                        stale_pr_fixture,
                    ],
                )
                taxonomy = stale_pr_payload.get("failure_taxonomy") if isinstance(stale_pr_payload, dict) else []
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed pr-gate` stale review failed: {error}"))
                elif stale_pr_payload.get("result") != "block" or "review_stale" not in taxonomy:
                    failures.append(Failure("daily-execution-cli", "`installed pr-gate` must block stale authored review approval"))

                payload, error = load_command_json(
                    root,
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "checkpoint",
                        "merge",
                        "--target",
                        str(positive_target),
                        "--item",
                        "INIT-0001",
                    ],
                )
                if error:
                    failures.append(Failure("daily-execution-cli", f"`installed checkpoint merge` drift negative failed: {error}"))
                elif payload.get("result") != "block":
                    failures.append(Failure("daily-execution-cli", "`installed checkpoint merge` must block when HEAD drifts beyond Loom carriers"))
                elif "implementation-drift-only" not in json.dumps(payload, ensure_ascii=False):
                    failures.append(Failure("daily-execution-cli", "`installed checkpoint merge` drift negative must expose implementation-drift-only review head binding"))

    live_github_opt_in = os.environ.get("LOOM_CHECK_LIVE_GITHUB") == "1"
    gh_auth_probe = None
    if live_github_opt_in and shutil.which("gh") is not None:
        try:
            gh_auth_probe = run_command(root, ["gh", "auth", "status"], timeout_seconds=5)
        except subprocess.TimeoutExpired:
            gh_auth_probe = None
    gh_auth_ready = gh_auth_probe is not None and gh_auth_probe.returncode == 0
    # GitHub Actions' ephemeral token is enough for self-governance host binding
    # reads, but it is not a stable authority for historical live issue/PR/project
    # samples. Keep those samples as local authenticated coverage instead of
    # making CI depend on mutable host permissions.
    if gh_auth_ready and os.environ.get("GITHUB_ACTIONS") != "true":
        with tempfile.TemporaryDirectory(prefix="loom-check-installed-post-merge-") as tmp:
            tmp_root = Path(tmp)
            install_root = tmp_root / "installed" / "skills"
            retire_target = tmp_root / "retire-target"
            dirty_target = tmp_root / "dirty-target"
            broken_install = tmp_root / "broken-install" / "skills"
            shutil.copytree(root / "skills", install_root)

            for label, args in (
                (
                    "installed reconciliation audit",
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "reconciliation",
                        "audit",
                        "--target",
                        str(root),
                        "--issue",
                        "131",
                        "--pr",
                        "138",
                        "--project",
                        "5",
                    ],
                ),
                (
                    "installed reconciliation sync dry-run",
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "reconciliation",
                        "sync",
                        "--target",
                        str(root),
                        "--issue",
                        "131",
                        "--pr",
                        "138",
                        "--project",
                        "5",
                        "--dry-run",
                    ],
                ),
                (
                    "installed closeout check",
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "closeout",
                        "check",
                        "--target",
                        str(root),
                        "--issue",
                        "131",
                        "--pr",
                        "138",
                        "--project",
                        "5",
                        "--skip-gate",
                    ],
                ),
                (
                    "installed closeout sync",
                    [
                        "python3",
                        str(install_root / "shared" / "scripts" / "loom_flow.py"),
                        "closeout",
                        "sync",
                        "--target",
                        str(root),
                        "--issue",
                        "131",
                        "--pr",
                        "138",
                        "--project",
                        "5",
                        "--skip-gate",
                    ],
                ),
            ):
                payload, error = load_command_json_with_retry(
                    root,
                    args,
                    timeout_seconds=60,
                    retries=3,
                )
                if error:
                    if label in {"installed closeout check", "installed closeout sync"} and "command timed out" in error:
                        continue
                    failures.append(Failure("daily-execution-cli", f"`{label}` failed: {error}"))
                    continue
                rate_limited = payload_has_github_rate_limit(payload)
                if label == "installed reconciliation audit":
                    if payload.get("result") != "pass" and not rate_limited:
                        failures.append(Failure("daily-execution-cli", "`installed reconciliation audit` must pass on the historical closeout sample"))
                    require_runtime_state_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed reconciliation audit`",
                        payload=payload.get("runtime_state"),
                        expected_scene="installed-runtime",
                        expected_carrier="installed-skills-root",
                        allowed_results={"pass"},
                    )
                    require_reconciliation_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed reconciliation audit`",
                        payload=payload,
                    )
                elif label == "installed reconciliation sync dry-run":
                    if payload.get("result") != "pass" and not rate_limited:
                        failures.append(Failure("daily-execution-cli", "`installed reconciliation sync --dry-run` must pass on an already aligned sample"))
                    require_runtime_state_payload(
                        failures,
                        category="daily-execution-cli",
                        context="`installed reconciliation sync --dry-run`",
                        payload=payload.get("runtime_state"),
                        expected_scene="installed-runtime",
                        expected_carrier="installed-skills-root",
                        allowed_results={"pass"},
                    )
                else:
                    if payload.get("result") != "pass" and not rate_limited:
                        failures.append(Failure("daily-execution-cli", f"`{label}` must pass on the historical closeout sample"))
                    require_runtime_state_payload(
                        failures,
                        category="daily-execution-cli",
                        context=f"`{label}`",
                        payload=payload.get("runtime_state"),
                        expected_scene="installed-runtime",
                        expected_carrier="installed-skills-root",
                        allowed_results={"pass"},
                    )
                    require_closeout_reconciliation_contract(
                        failures,
                        category="daily-execution-cli",
                        context=f"`{label}`",
                        payload=payload,
                    )

            for target in (retire_target, dirty_target):
                shutil.copytree(example_target, target)
                for args in (
                    ["git", "init"],
                    ["git", "config", "user.email", "loom-check@example.com"],
                    ["git", "config", "user.name", "loom-check"],
                    ["git", "add", "."],
                    ["git", "commit", "-m", "baseline"],
                ):
                    result = run_command(root, args, cwd=target)
                    if result.returncode != 0:
                        detail = result.stderr.strip() or result.stdout.strip() or "git setup failed"
                        failures.append(Failure("daily-execution-cli", f"`installed retire` setup failed: {detail}"))
                        break

            purity_payload, error = load_command_json(
                root,
                [
                    "python3",
                    str(install_root / "loom-retire" / "scripts" / "loom-retire.py"),
                    "purity-check",
                    "--target",
                    str(retire_target),
                    "--item",
                    "INIT-0001",
                ],
            )
            if error:
                failures.append(Failure("daily-execution-cli", f"`installed purity-check` failed: {error}"))
            elif purity_payload.get("result") != "pass":
                failures.append(Failure("daily-execution-cli", "`installed purity-check` must pass on a clean retire target"))
            else:
                require_runtime_state_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`installed purity-check`",
                    payload=purity_payload.get("runtime_state"),
                    expected_scene="installed-runtime",
                    expected_carrier="installed-skills-root",
                    allowed_results={"pass"},
                )

            temp_root = retire_target / ".loom" / ".tmp"
            installed_residue = temp_root / "loom-owned-residue"
            installed_residue.mkdir(parents=True, exist_ok=True)
            (installed_residue / ".loom-owned").write_text("owned\n", encoding="utf-8")
            (installed_residue / "sentinel.txt").write_text("temp\n", encoding="utf-8")

            cleanup_payload, error = load_command_json(
                root,
                [
                    "python3",
                    str(install_root / "loom-retire" / "scripts" / "loom-retire.py"),
                    "workspace",
                    "cleanup",
                    "--target",
                    str(retire_target),
                    "--item",
                    "INIT-0001",
                ],
            )
            if error:
                failures.append(Failure("daily-execution-cli", f"`installed workspace cleanup` failed: {error}"))
            elif cleanup_payload.get("result") != "pass":
                failures.append(Failure("daily-execution-cli", "`installed workspace cleanup` must pass for Loom-owned residue"))
            else:
                require_runtime_state_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`installed workspace cleanup`",
                    payload=cleanup_payload.get("runtime_state"),
                    expected_scene="installed-runtime",
                    expected_carrier="installed-skills-root",
                    allowed_results={"pass"},
                )
                require_lifecycle_expectations_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`installed workspace cleanup`",
                    payload=cleanup_payload.get("lifecycle_expectations"),
                )

            retire_payload, error = load_command_json(
                root,
                [
                    "python3",
                    str(install_root / "loom-retire" / "scripts" / "loom-retire.py"),
                    "workspace",
                    "retire",
                    "--target",
                    str(retire_target),
                    "--item",
                    "INIT-0001",
                ],
            )
            if error:
                failures.append(Failure("daily-execution-cli", f"`installed workspace retire` failed: {error}"))
            elif retire_payload.get("result") != "pass":
                failures.append(Failure("daily-execution-cli", "`installed workspace retire` must pass after cleanup"))
            else:
                require_runtime_state_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`installed workspace retire`",
                    payload=retire_payload.get("runtime_state"),
                    expected_scene="installed-runtime",
                    expected_carrier="installed-skills-root",
                    allowed_results={"pass"},
                )
                require_lifecycle_expectations_payload(
                    failures,
                    category="daily-execution-cli",
                    context="`installed workspace retire`",
                    payload=retire_payload.get("lifecycle_expectations"),
                )
                checkpoint = retire_payload.get("checkpoint")
                if not isinstance(checkpoint, dict) or checkpoint.get("normalized") != "retired":
                    failures.append(Failure("daily-execution-cli", "`installed workspace retire` must leave the target in `retired` state"))

            (dirty_target / "foreign-residue.txt").write_text("pending\n", encoding="utf-8")
            dirty_add = run_command(root, ["git", "add", "foreign-residue.txt"], cwd=dirty_target)
            if dirty_add.returncode != 0:
                detail = dirty_add.stderr.strip() or dirty_add.stdout.strip() or "git add failed"
                failures.append(Failure("daily-execution-cli", f"`installed retire` dirty sample setup failed: {detail}"))

            for label, args in (
                (
                    "installed purity-check dirty sample",
                    [
                        "python3",
                        str(install_root / "loom-retire" / "scripts" / "loom-retire.py"),
                        "purity-check",
                        "--target",
                        str(dirty_target),
                        "--item",
                        "INIT-0001",
                    ],
                ),
                (
                    "installed workspace cleanup dirty sample",
                    [
                        "python3",
                        str(install_root / "loom-retire" / "scripts" / "loom-retire.py"),
                        "workspace",
                        "cleanup",
                        "--target",
                        str(dirty_target),
                        "--item",
                        "INIT-0001",
                    ],
                ),
                (
                    "installed workspace retire dirty sample",
                    [
                        "python3",
                        str(install_root / "loom-retire" / "scripts" / "loom-retire.py"),
                        "workspace",
                        "retire",
                        "--target",
                        str(dirty_target),
                        "--item",
                        "INIT-0001",
                    ],
                ),
            ):
                payload, error = load_command_json(root, args)
                if error:
                    failures.append(Failure("daily-execution-cli", f"`{label}` failed: {error}"))
                    continue
                if payload.get("result") != "block":
                    failures.append(Failure("daily-execution-cli", f"`{label}` must block when non-Loom residue is present"))
                require_runtime_state_payload(
                    failures,
                    category="daily-execution-cli",
                    context=f"`{label}`",
                    payload=payload.get("runtime_state"),
                    expected_scene="installed-runtime",
                    expected_carrier="installed-skills-root",
                    allowed_results={"pass"},
                )

            shutil.copytree(root / "skills", broken_install)
            (broken_install / "install-layout.json").unlink()
            (broken_install / "loom-retire" / ".loom-runtime" / "install-layout.json").unlink()
            for label, args in (
                (
                    "installed closeout check missing install-layout",
                    [
                        "python3",
                        str(broken_install / "shared" / "scripts" / "loom_flow.py"),
                        "closeout",
                        "check",
                        "--target",
                        str(root),
                        "--issue",
                        "131",
                        "--pr",
                        "138",
                        "--skip-gate",
                    ],
                ),
                (
                    "installed purity-check missing install-layout",
                    [
                        "python3",
                        str(broken_install / "loom-retire" / "scripts" / "loom-retire.py"),
                        "purity-check",
                        "--target",
                        str(retire_target),
                        "--item",
                        "INIT-0001",
                    ],
                ),
            ):
                payload, error = load_command_json(root, args)
                if error:
                    failures.append(Failure("daily-execution-cli", f"`{label}` failed unexpectedly: {error}"))
                    continue
                if payload.get("result") != "block":
                    failures.append(Failure("daily-execution-cli", f"`{label}` must block when install-layout is missing"))
                require_runtime_state_payload(
                    failures,
                    category="daily-execution-cli",
                    context=f"`{label}`",
                    payload=payload.get("runtime_state"),
                    expected_scene="installed-runtime",
                    expected_carrier="installed-skills-root",
                    allowed_results={"block"},
                )

    fail_closed_payloads = [
        (
            "closeout-fix-needed-fail-open",
            {
                "result": "pass",
                "fallback_to": None,
                "reconciliation": {
                    "command": "reconciliation",
                    "operation": "audit",
                    "result": "fix-needed",
                    "summary": "fix-needed",
                    "missing_inputs": [],
                    "fallback_to": "manual-reconciliation",
                    "findings": [
                        {
                            "kind": "absorbed_but_open",
                            "severity": "fix-needed",
                            "subject": "issue #177",
                            "evidence": {},
                            "recommended_action": "run reconciliation sync",
                        }
                    ],
                },
            },
        ),
        (
            "closeout-block-fallback-drift",
            {
                "result": "block",
                "fallback_to": "merge",
                "reconciliation": {
                    "command": "reconciliation",
                    "operation": "audit",
                    "result": "block",
                    "summary": "block",
                    "missing_inputs": ["issue/pr/project"],
                    "fallback_to": "manual-reconciliation",
                    "findings": [
                        {
                            "kind": "parent_drift",
                            "severity": "block",
                            "subject": "parent issue #148",
                            "evidence": {},
                            "recommended_action": "manual reconciliation",
                        }
                    ],
                },
            },
        ),
        (
            "closeout-malformed-reconciliation",
            {
                "result": "pass",
                "fallback_to": None,
                "reconciliation": {
                    "command": "reconciliation",
                    "operation": "audit",
                    "summary": "broken",
                    "missing_inputs": "bad",
                    "findings": "bad",
                },
            },
        ),
    ]
    for label, payload in fail_closed_payloads:
        sample_failures: list[Failure] = []
        require_closeout_reconciliation_contract(
            sample_failures,
            category="daily-execution-cli",
            context=f"`{label}`",
            payload=payload,
        )
        if not sample_failures:
            failures.append(
                Failure(
                    "daily-execution-cli",
                    f"`{label}` synthetic payload must fail closeout reconciliation validation",
                )
            )

    warn_payload_failures: list[Failure] = []
    require_closeout_reconciliation_contract(
        warn_payload_failures,
        category="daily-execution-cli",
        context="`closeout-warn-does-not-block`",
        payload={
            "result": "pass",
            "fallback_to": None,
            "reconciliation": {
                "command": "reconciliation",
                "operation": "audit",
                "result": "warn",
                "summary": "warn",
                "missing_inputs": [],
                "fallback_to": "manual-reconciliation",
                    "findings": [
                        {
                            "category": "drift",
                            "kind": "project_drift",
                            "severity": "warn",
                            "subject": "project 5",
                            "evidence": {},
                            "recommended_action": "review warning",
                            "fallback_to": "reconciliation-sync",
                        }
                    ],
                },
            },
        )
    if warn_payload_failures:
        failures.append(
            Failure(
                "daily-execution-cli",
                "`closeout-warn-does-not-block` synthetic payload must allow non-blocking reconciliation warnings",
            )
        )

    valid_reconciliation_samples = [
        ("merged_but_open", "fix-needed", "reconciliation-sync"),
        ("absorbed_but_open", "fix-needed", "reconciliation-sync"),
        ("parent_drift", "block", "manual-reconciliation"),
        ("binding_failure", "block", "manual-reconciliation"),
        ("merge_signal_drift", "block", "manual-reconciliation"),
        ("host_signal_drift", "block", "manual-reconciliation"),
    ]
    for kind, reconciliation_result_value, fallback_to in valid_reconciliation_samples:
        sample_failures = []
        require_closeout_reconciliation_contract(
            sample_failures,
            category="daily-execution-cli",
            context=f"`closeout-{kind}`",
            payload={
                "result": "block",
                "fallback_to": fallback_to,
                "reconciliation": {
                    "command": "reconciliation",
                    "operation": "audit",
                    "result": reconciliation_result_value,
                    "summary": kind,
                    "missing_inputs": [] if kind != "host_signal_drift" else ["github control plane"],
                    "fallback_to": "manual-reconciliation",
                    "findings": [
                        {
                            "category": "drift",
                            "kind": kind,
                            "severity": reconciliation_result_value,
                            "subject": "closeout sample",
                            "evidence": {},
                            "recommended_action": "reconcile closeout sample",
                            "fallback_to": fallback_to,
                        }
                    ],
                },
            },
        )
        if sample_failures:
            failures.append(
                Failure(
                    "daily-execution-cli",
                    f"`closeout-{kind}` synthetic payload must satisfy closeout reconciliation validation",
                )
            )

    return failures


def check_repo_companion_interface_contracts(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    example_target = root / "examples/new-project"
    if not example_target.exists():
        return failures

    def write_json(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def install_companion(
        target: Path,
        *,
        manifest: dict[str, object] | None = None,
        repo_interface: dict[str, object] | None = None,
        legacy_docs_only: bool = False,
    ) -> None:
        companion_dir = target / ".loom" / "companion"
        if companion_dir.exists():
            shutil.rmtree(companion_dir)
        companion_dir.mkdir(parents=True, exist_ok=True)
        if legacy_docs_only:
            (companion_dir / "README.md").write_text("# Legacy Companion Docs\n", encoding="utf-8")
            return
        (companion_dir / "README.md").write_text("# Repo Companion\n", encoding="utf-8")
        for doc in (
            "review.md",
            "merge-ready.md",
            "closeout.md",
            "specialized-gates.md",
            "checkpoints.md",
            "metadata-contract.md",
            "context-schema.md",
            "hooks/before-run.md",
            "hooks/after-run.md",
            "hooks/cleanup.md",
            "review-instructions/spec.md",
            "review-instructions/implementation.md",
        ):
            (companion_dir / doc).parent.mkdir(parents=True, exist_ok=True)
            (companion_dir / doc).write_text(f"# {doc}\n", encoding="utf-8")
        for relative, payload in {
            "policy/approval.json": {
                "schema_version": "loom-policy-read/v1",
                "policy": "approval",
                "status": "declared",
                "summary": "Approval policy is host-declared and readable.",
                "risk": "none",
                "evidence": {"status": "present"},
            },
            "policy/sandbox.json": {
                "schema_version": "loom-policy-read/v1",
                "policy": "sandbox",
                "status": "declared",
                "summary": "Sandbox policy is host-declared and readable.",
                "risk": "none",
                "evidence": {"status": "present"},
            },
            "releases/catalog.json": {
                "schema_version": "loom-target-release-catalog/v1",
                "current_release_id": "release-v1",
                "releases": [{"release_id": "release-v1", "locator": ".loom/companion/releases/current.json"}],
            },
            "releases/current.json": {
                "schema_version": "loom-target-release/v1",
                "release_id": "release-v1",
                "display_name": "Release v1",
                "target_branch": "main",
                "release_goal": "Validate target repository release/version management.",
                "status": "unreleased",
                "included_scope": {
                    "phase": [{"id": "phase-1", "locator": ".loom/companion/checkpoints.md", "delivery_status": "planned"}],
                    "fr": [{"id": "fr-1", "locator": ".loom/companion/review.md", "delivery_status": "active"}],
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
            "releases/status.json": {
                "schema_version": "loom-target-release-status/v1",
                "result": "pass",
                "summary": "repo-owned target release status is readable.",
            },
        }.items():
            write_json(companion_dir / relative, payload)
        for relative, text in {
            "releases/changelog.md": "# Changelog\n",
            "releases/release-notes.md": "# Release Notes\n",
            "releases/migration-notes.md": "# Migration Notes\n",
            "releases/rollback.md": "# Rollback Basis\n",
        }.items():
            path = companion_dir / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        if manifest is not None:
            write_json(companion_dir / "manifest.json", manifest)
        if repo_interface is not None:
            write_json(companion_dir / "repo-interface.json", repo_interface)

    valid_manifest = {
        "schema_version": "loom-repo-companion-manifest/v1",
        "companion_entry": ".loom/companion/README.md",
        "repo_interface": ".loom/companion/repo-interface.json",
    }
    valid_interface_v1 = {
        "schema_version": "loom-repo-interface/v1",
        "companion_entry": ".loom/companion/README.md",
        "repo_specific_requirements": {
            "review": [
                {
                    "id": "review-specialized-gate",
                    "summary": "Run the repo-specific semantic review checklist.",
                    "locator": ".loom/companion/review.md",
                    "enforcement": "blocking",
                }
            ],
            "merge_ready": [
                {
                    "id": "merge-ready-advisory-note",
                    "summary": "Review the repo-specific merge advisory note.",
                    "locator": ".loom/companion/merge-ready.md",
                    "enforcement": "advisory",
                }
            ],
            "closeout": [
                {
                    "id": "closeout-specialized-gate",
                    "summary": "Confirm the repo-specific closeout checklist.",
                    "locator": ".loom/companion/closeout.md",
                    "enforcement": "blocking",
                }
            ],
        },
        "specialized_gates": [
            {
                "id": "specialized-release-gate",
                "summary": "Companion-owned release judgment.",
                "locator": ".loom/companion/specialized-gates.md",
            }
        ],
    }
    valid_interface_v2 = {
        "schema_version": "loom-repo-interface/v2",
        "companion_entry": ".loom/companion/README.md",
        "repo_specific_requirements": valid_interface_v1["repo_specific_requirements"],
        "specialized_gates": [
            {
                "id": "specialized-review-gate",
                "summary": "Companion-owned review specialization.",
                "locator": ".loom/companion/specialized-gates.md",
                "gate_type": "review",
            }
        ],
        "review_instruction_locators": {
            "spec_review": {
                "locator": ".loom/companion/review-instructions/spec.md",
                "mode": "repo_declared",
            },
            "implementation_review": {
                "locator": ".loom/companion/review-instructions/implementation.md",
                "mode": "repo_declared",
            },
        },
        "metadata_contract": {
            "fields": [
                {
                    "id": "integration_check",
                    "summary": "Declare repo-specific integration metadata.",
                    "applicability_locator": ".loom/companion/metadata-contract.md",
                    "authority_locator": ".loom/companion/review.md",
                    "enforcement": "blocking",
                }
            ]
        },
        "context_schema": {
            "fields": [
                {
                    "id": "item_key",
                    "summary": "Repo-native item key.",
                    "type": "string",
                    "required": True,
                    "mapping_rule_locator": ".loom/companion/context-schema.md",
                }
            ]
        },
        "dynamic_tool_locators": [
            {
                "id": "repo-review-tool",
                "summary": "Declare a repo-owned review helper locator without executing it.",
                "locator": ".loom/companion/review.md",
                "owner": "repo-companion",
                "requirement": "required",
                "surface": "review",
                "fallback_to": "build",
            },
            {
                "id": "optional-merge-tool",
                "summary": "Declare an optional merge helper locator.",
                "locator": ".loom/companion/missing-optional-tool.md",
                "owner": "repo-companion",
                "requirement": "optional",
                "surface": "merge_ready",
                "fallback_to": "merge",
            },
            {
                "id": "advisory-build-tool",
                "summary": "Declare an advisory helper with no installed locator.",
                "owner": "repo-companion",
                "requirement": "advisory",
                "surface": "build",
                "fallback_to": "build",
            },
        ],
        "policy_locators": [
            {
                "id": "approval-policy",
                "summary": "Declare the host approval policy read surface.",
                "policy": "approval",
                "locator": ".loom/companion/policy/approval.json",
                "owner": "host-adapter",
                "requirement": "required",
                "surface": "review",
                "fallback_to": "build",
            },
            {
                "id": "sandbox-policy",
                "summary": "Declare the host sandbox policy read surface.",
                "policy": "sandbox",
                "locator": ".loom/companion/policy/sandbox.json",
                "owner": "host-adapter",
                "requirement": "required",
                "surface": "merge_ready",
                "fallback_to": "merge",
            },
        ],
        "hook_locators": [
            {
                "id": "before-run-hook",
                "summary": "Declare a lifecycle hook locator without executing it.",
                "lifecycle": "before-run",
                "locator": ".loom/companion/hooks/before-run.md",
                "owner": "repo-companion",
                "requirement": "required",
                "fallback_to": "admission",
                "safety": {
                    "path_containment": "repo_relative",
                    "truth_boundary": "runtime_evidence_only",
                    "cleanup_scope": "not_applicable",
                    "host_trust": "trusted",
                    "permission_risk": "approval_required",
                },
            },
            {
                "id": "optional-after-run-hook",
                "summary": "Declare an optional after-run hook locator.",
                "lifecycle": "after-run",
                "locator": ".loom/companion/hooks/missing-after-run.md",
                "owner": "repo-companion",
                "requirement": "optional",
                "fallback_to": "handoff",
                "safety": {
                    "path_containment": "repo_relative",
                    "truth_boundary": "runtime_evidence_only",
                    "cleanup_scope": "not_applicable",
                    "host_trust": "requires_review",
                    "permission_risk": "sandbox_required",
                },
            },
            {
                "id": "advisory-cleanup-hook",
                "summary": "Declare an advisory cleanup hook without requiring host-native support.",
                "lifecycle": "cleanup",
                "owner": "host-adapter",
                "requirement": "advisory",
                "fallback_to": "workspace cleanup|retire",
                "safety": {
                    "path_containment": "repo_relative",
                    "truth_boundary": "runtime_evidence_only",
                    "cleanup_scope": "loom_owned_only",
                    "host_trust": "requires_review",
                    "permission_risk": "approval_required",
                },
            },
        ],
        "release_targets": {
            "catalog_locator": ".loom/companion/releases/catalog.json",
            "current_target_locator": ".loom/companion/releases/current.json",
            "enforcement": "blocking",
            "status_locator": ".loom/companion/releases/status.json",
        },
    }

    with tempfile.TemporaryDirectory(prefix="loom-check-repo-companion-") as tmp:
        base = Path(tmp)

        absent_target = base / "absent"
        shutil.copytree(example_target, absent_target)
        shutil.rmtree(absent_target / ".loom" / "companion", ignore_errors=True)
        absent_surface = build_governance_surface(absent_target)
        repo_interface = absent_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="absent repo companion",
            payload=repo_interface,
        )
        if not isinstance(repo_interface, dict) or repo_interface.get("availability") != "absent":
            failures.append(Failure("repo-companion", "absent repo companion sample must report `availability: absent`"))

        docs_only_target = base / "docs-only"
        shutil.copytree(example_target, docs_only_target)
        install_companion(docs_only_target, legacy_docs_only=True)
        docs_only_surface = build_governance_surface(docs_only_target)
        docs_only_interface = docs_only_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="docs-only repo companion",
            payload=docs_only_interface,
        )
        if not isinstance(docs_only_interface, dict) or docs_only_interface.get("availability") != "companion_docs_only":
            failures.append(Failure("repo-companion", "docs-only repo companion sample must report `availability: companion_docs_only`"))

        incomplete_target = base / "incomplete"
        shutil.copytree(example_target, incomplete_target)
        install_companion(
            incomplete_target,
            manifest={
                **valid_manifest,
                "current_stop": "forbidden authored state",
                "repo_interface": ".loom/companion/missing-interface.json",
            },
        )
        incomplete_surface = build_governance_surface(incomplete_target)
        incomplete_interface = incomplete_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="incomplete repo companion",
            payload=incomplete_interface,
        )
        if not isinstance(incomplete_interface, dict) or incomplete_interface.get("availability") != "incomplete":
            failures.append(Failure("repo-companion", "incomplete repo companion sample must report `availability: incomplete`"))

        invalid_interface_target = base / "invalid-interface"
        shutil.copytree(example_target, invalid_interface_target)
        install_companion(
            invalid_interface_target,
            manifest=valid_manifest,
            repo_interface={
                "schema_version": "loom-repo-interface/v1",
                "companion_entry": ".loom/companion/README.md",
                "repo_specific_requirements": {
                    "review": [
                        {
                            "id": "bad-enforcement",
                            "summary": "Broken requirement",
                            "locator": ".loom/companion/review.md",
                            "enforcement": "required",
                        }
                    ],
                    "merge_ready": [],
                },
                "specialized_gates": [],
            },
        )
        invalid_interface_surface = build_governance_surface(invalid_interface_target)
        invalid_interface = invalid_interface_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="invalid repo companion interface",
            payload=invalid_interface,
        )
        if not isinstance(invalid_interface, dict) or invalid_interface.get("availability") != "incomplete":
            failures.append(Failure("repo-companion", "invalid repo companion interface sample must report `availability: incomplete`"))

        invalid_v2_target = base / "invalid-v2-interface"
        shutil.copytree(example_target, invalid_v2_target)
        install_companion(
            invalid_v2_target,
            manifest=valid_manifest,
            repo_interface={
                "schema_version": "loom-repo-interface/v2",
                "companion_entry": ".loom/companion/README.md",
                "repo_specific_requirements": valid_interface_v1["repo_specific_requirements"],
                "specialized_gates": [
                    {
                        "id": "bad-gate-type",
                        "summary": "Broken gate type",
                        "locator": ".loom/companion/specialized-gates.md",
                        "gate_type": "guardian",
                    }
                ],
                "metadata_contract": {
                    "fields": [
                        {
                            "id": "bad-metadata",
                            "summary": "Broken metadata field",
                            "applicability_locator": ".loom/companion/metadata-contract.md",
                            "authority_locator": ".loom/companion/review.md",
                            "enforcement": "required",
                        }
                    ]
                },
                "context_schema": {
                    "fields": [
                        {
                            "id": "bad-context",
                            "summary": "Broken context field",
                            "type": "object",
                            "required": "yes",
                            "mapping_rule_locator": ".loom/companion/context-schema.md",
                        }
                    ]
                },
                "dynamic_tool_locators": [
                    {
                        "id": "bad-tool",
                        "summary": "Broken tool locator",
                        "locator": "../outside-tool.json",
                        "owner": "loom-core",
                        "requirement": "required",
                        "surface": "attempt_time",
                        "fallback_to": "host-action",
                    }
                ],
                "release_targets": {
                    "catalog_locator": ".loom/companion/releases/catalog.json",
                    "current_target_locator": "../outside-release.json",
                    "enforcement": "required",
                },
            },
        )
        invalid_v2_surface = build_governance_surface(invalid_v2_target)
        invalid_v2_interface = invalid_v2_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="invalid v2 repo companion interface",
            payload=invalid_v2_interface,
        )
        if not isinstance(invalid_v2_interface, dict) or invalid_v2_interface.get("availability") != "incomplete":
            failures.append(Failure("repo-companion", "invalid v2 repo companion interface sample must report `availability: incomplete`"))

        invalid_optional_escape_target = base / "invalid-optional-dynamic-tool-escape"
        shutil.copytree(example_target, invalid_optional_escape_target)
        install_companion(
            invalid_optional_escape_target,
            manifest=valid_manifest,
            repo_interface=valid_interface_v2,
        )
        interface_path = invalid_optional_escape_target / ".loom" / "companion" / "repo-interface.json"
        interface_payload = json.loads(interface_path.read_text(encoding="utf-8"))
        interface_payload["dynamic_tool_locators"] = [
            {
                "id": "optional-escaped-tool",
                "summary": "Optional tool locator must still respect repository path boundaries.",
                "locator": "../outside-tool.json",
                "owner": "repo-companion",
                "requirement": "optional",
                "surface": "review",
                "fallback_to": "build",
            }
        ]
        write_json(interface_path, interface_payload)
        invalid_optional_escape_surface = build_governance_surface(invalid_optional_escape_target)
        invalid_optional_interface = invalid_optional_escape_surface.get("repo_interface")
        if not isinstance(invalid_optional_interface, dict) or invalid_optional_interface.get("availability") != "incomplete":
            failures.append(Failure("repo-companion", "optional dynamic tool path escape must fail closed"))
        elif "outside-tool.json" not in json.dumps(invalid_optional_interface.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-companion", "optional dynamic tool path escape must stay in blocking missing_inputs"))

        invalid_hook_escape_target = base / "invalid-hook-escape"
        shutil.copytree(example_target, invalid_hook_escape_target)
        install_companion(
            invalid_hook_escape_target,
            manifest=valid_manifest,
            repo_interface=valid_interface_v2,
        )
        hook_escape_interface_path = invalid_hook_escape_target / ".loom" / "companion" / "repo-interface.json"
        hook_escape_payload = json.loads(hook_escape_interface_path.read_text(encoding="utf-8"))
        hook_escape_payload["hook_locators"] = [
            {
                "id": "escaped-hook",
                "summary": "Optional hook locator must still respect repository path boundaries.",
                "lifecycle": "before-run",
                "locator": "../outside-hook.md",
                "owner": "repo-companion",
                "requirement": "optional",
                "fallback_to": "admission",
                "safety": {
                    "path_containment": "repo_relative",
                    "truth_boundary": "runtime_evidence_only",
                    "cleanup_scope": "not_applicable",
                    "host_trust": "requires_review",
                    "permission_risk": "approval_required",
                },
            }
        ]
        write_json(hook_escape_interface_path, hook_escape_payload)
        invalid_hook_escape_surface = build_governance_surface(invalid_hook_escape_target)
        invalid_hook_escape_interface = invalid_hook_escape_surface.get("repo_interface")
        invalid_hook_escape_profile = (
            invalid_hook_escape_interface.get("hook_profile") if isinstance(invalid_hook_escape_interface, dict) else None
        )
        invalid_hook_escape_missing = json.dumps(
            invalid_hook_escape_profile.get("missing_inputs", []) if isinstance(invalid_hook_escape_profile, dict) else [],
            ensure_ascii=False,
        )
        if not isinstance(invalid_hook_escape_profile, dict) or invalid_hook_escape_profile.get("result") != "block":
            failures.append(Failure("repo-companion", "optional hook path escape must fail closed"))
        elif "outside-hook.md" not in invalid_hook_escape_missing:
            failures.append(Failure("repo-companion", "optional hook path escape must stay in hook_profile missing_inputs"))

        invalid_hook_truth_target = base / "invalid-hook-truth"
        shutil.copytree(example_target, invalid_hook_truth_target)
        install_companion(
            invalid_hook_truth_target,
            manifest=valid_manifest,
            repo_interface={
                **valid_interface_v2,
                "hook_locators": [
                    {
                        "id": "truth-polluting-hook",
                        "summary": "Hook declarations must not carry authored or runtime truth.",
                        "lifecycle": "after-run",
                        "locator": ".loom/companion/hooks/after-run.md",
                        "owner": "repo-companion",
                        "requirement": "required",
                        "fallback_to": "handoff",
                        "safety": {
                            "path_containment": "repo_relative",
                            "truth_boundary": "runtime_evidence_only",
                            "cleanup_scope": "not_applicable",
                            "host_trust": "trusted",
                            "permission_risk": "none",
                        },
                        "validation_status": "pass",
                    }
                ],
            },
        )
        invalid_hook_truth_surface = build_governance_surface(invalid_hook_truth_target)
        invalid_hook_truth_interface = invalid_hook_truth_surface.get("repo_interface")
        invalid_hook_truth_profile = (
            invalid_hook_truth_interface.get("hook_profile") if isinstance(invalid_hook_truth_interface, dict) else None
        )
        invalid_hook_truth_missing = json.dumps(
            invalid_hook_truth_profile.get("missing_inputs", []) if isinstance(invalid_hook_truth_profile, dict) else [],
            ensure_ascii=False,
        )
        if not isinstance(invalid_hook_truth_profile, dict) or invalid_hook_truth_profile.get("result") != "block":
            failures.append(Failure("repo-companion", "hook locator truth pollution must fail closed"))
        elif "validation_status" not in invalid_hook_truth_missing:
            failures.append(Failure("repo-companion", "hook locator truth pollution must identify forbidden fields"))

        required_hook_missing_target = base / "required-hook-missing"
        shutil.copytree(example_target, required_hook_missing_target)
        install_companion(
            required_hook_missing_target,
            manifest=valid_manifest,
            repo_interface={
                **valid_interface_v2,
                "hook_locators": [
                    {
                        "id": "required-missing-hook",
                        "summary": "Required hook locator must block when missing.",
                        "lifecycle": "before-run",
                        "locator": ".loom/companion/hooks/missing-required.md",
                        "owner": "repo-companion",
                        "requirement": "required",
                        "fallback_to": "admission",
                        "safety": {
                            "path_containment": "repo_relative",
                            "truth_boundary": "runtime_evidence_only",
                            "cleanup_scope": "not_applicable",
                            "host_trust": "trusted",
                            "permission_risk": "approval_required",
                        },
                    }
                ],
            },
        )
        required_hook_missing_surface = build_governance_surface(required_hook_missing_target)
        required_hook_missing_interface = required_hook_missing_surface.get("repo_interface")
        required_hook_missing_profile = (
            required_hook_missing_interface.get("hook_profile") if isinstance(required_hook_missing_interface, dict) else None
        )
        required_hook_missing_inputs = json.dumps(
            required_hook_missing_profile.get("missing_inputs", []) if isinstance(required_hook_missing_profile, dict) else [],
            ensure_ascii=False,
        )
        if not isinstance(required_hook_missing_profile, dict) or required_hook_missing_profile.get("result") != "block":
            failures.append(Failure("repo-companion", "required missing hook locator must fail closed"))
        elif "missing-required.md" not in required_hook_missing_inputs:
            failures.append(Failure("repo-companion", "required missing hook locator must stay in hook_profile missing_inputs"))

        required_hook_missing_safety_target = base / "required-hook-missing-safety"
        shutil.copytree(example_target, required_hook_missing_safety_target)
        install_companion(
            required_hook_missing_safety_target,
            manifest=valid_manifest,
            repo_interface={
                **valid_interface_v2,
                "hook_locators": [
                    {
                        "id": "required-no-safety-hook",
                        "summary": "Required hook safety declaration must fail closed when absent.",
                        "lifecycle": "before-run",
                        "locator": ".loom/companion/hooks/before-run.md",
                        "owner": "repo-companion",
                        "requirement": "required",
                        "fallback_to": "admission",
                    }
                ],
            },
        )
        required_hook_missing_safety_surface = build_governance_surface(required_hook_missing_safety_target)
        required_hook_missing_safety_interface = required_hook_missing_safety_surface.get("repo_interface")
        required_hook_missing_safety_profile = (
            required_hook_missing_safety_interface.get("hook_profile")
            if isinstance(required_hook_missing_safety_interface, dict)
            else None
        )
        if (
            not isinstance(required_hook_missing_safety_profile, dict)
            or required_hook_missing_safety_profile.get("result") != "block"
        ):
            failures.append(Failure("repo-companion", "required missing hook safety declaration must fail closed"))
        elif "missing `safety` declaration" not in json.dumps(
            required_hook_missing_safety_profile.get("missing_inputs", []),
            ensure_ascii=False,
        ):
            failures.append(Failure("repo-companion", "missing hook safety declaration must identify safety"))

        unsafe_hook_target = base / "unsafe-hook-safety"
        shutil.copytree(example_target, unsafe_hook_target)
        install_companion(
            unsafe_hook_target,
            manifest=valid_manifest,
            repo_interface={
                **valid_interface_v2,
                "hook_locators": [
                    {
                        "id": "untrusted-hook",
                        "summary": "Untrusted hook declarations must fail closed.",
                        "lifecycle": "before-run",
                        "locator": ".loom/companion/hooks/before-run.md",
                        "owner": "repo-companion",
                        "requirement": "required",
                        "fallback_to": "admission",
                        "safety": {
                            "path_containment": "repo_relative",
                            "truth_boundary": "runtime_evidence_only",
                            "cleanup_scope": "not_applicable",
                            "host_trust": "untrusted",
                            "permission_risk": "unknown",
                        },
                    }
                ],
            },
        )
        unsafe_hook_surface = build_governance_surface(unsafe_hook_target)
        unsafe_hook_interface = unsafe_hook_surface.get("repo_interface")
        unsafe_hook_profile = unsafe_hook_interface.get("hook_profile") if isinstance(unsafe_hook_interface, dict) else None
        unsafe_hook_missing = json.dumps(
            unsafe_hook_profile.get("missing_inputs", []) if isinstance(unsafe_hook_profile, dict) else [],
            ensure_ascii=False,
        )
        if not isinstance(unsafe_hook_profile, dict) or unsafe_hook_profile.get("result") != "block":
            failures.append(Failure("repo-companion", "untrusted or unknown-permission hook declaration must fail closed"))
        elif "untrusted" not in unsafe_hook_missing or "unknown hook permission risk" not in unsafe_hook_missing:
            failures.append(Failure("repo-companion", "unsafe hook declaration must identify trust and permission risk"))

        unsafe_cleanup_target = base / "unsafe-cleanup-scope"
        shutil.copytree(example_target, unsafe_cleanup_target)
        install_companion(
            unsafe_cleanup_target,
            manifest=valid_manifest,
            repo_interface={
                **valid_interface_v2,
                "hook_locators": [
                    {
                        "id": "unsafe-cleanup-hook",
                        "summary": "Cleanup hooks must be constrained to Loom-owned residue.",
                        "lifecycle": "cleanup",
                        "locator": ".loom/companion/hooks/cleanup.md",
                        "owner": "repo-companion",
                        "requirement": "required",
                        "fallback_to": "workspace cleanup|retire",
                        "safety": {
                            "path_containment": "repo_relative",
                            "truth_boundary": "runtime_evidence_only",
                            "cleanup_scope": "not_applicable",
                            "host_trust": "requires_review",
                            "permission_risk": "approval_required",
                        },
                    }
                ],
            },
        )
        unsafe_cleanup_surface = build_governance_surface(unsafe_cleanup_target)
        unsafe_cleanup_interface = unsafe_cleanup_surface.get("repo_interface")
        unsafe_cleanup_profile = unsafe_cleanup_interface.get("hook_profile") if isinstance(unsafe_cleanup_interface, dict) else None
        if not isinstance(unsafe_cleanup_profile, dict) or unsafe_cleanup_profile.get("result") != "block":
            failures.append(Failure("repo-companion", "unsafe cleanup hook declaration must fail closed"))
        elif "cleanup hooks must declare safety.cleanup_scope" not in json.dumps(
            unsafe_cleanup_profile.get("missing_inputs", []),
            ensure_ascii=False,
        ):
            failures.append(Failure("repo-companion", "unsafe cleanup hook declaration must identify cleanup scope"))

        present_v1_target = base / "present-v1"
        shutil.copytree(example_target, present_v1_target)
        install_companion(
            present_v1_target,
            manifest=valid_manifest,
            repo_interface=valid_interface_v1,
        )
        present_v1_surface = build_governance_surface(present_v1_target)
        present_v1_interface = present_v1_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="present v1 repo companion",
            payload=present_v1_interface,
        )
        if not isinstance(present_v1_interface, dict) or present_v1_interface.get("availability") != "present":
            failures.append(Failure("repo-companion", "present v1 repo companion sample must report `availability: present`"))

        present_target = base / "present-v2"
        shutil.copytree(example_target, present_target)
        install_companion(
            present_target,
            manifest=valid_manifest,
            repo_interface=valid_interface_v2,
        )
        present_surface = build_governance_surface(present_target)
        present_interface = present_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="present v2 repo companion",
            payload=present_interface,
        )
        if not isinstance(present_interface, dict) or present_interface.get("availability") != "present":
            failures.append(Failure("repo-companion", "present v2 repo companion sample must report `availability: present`"))
        elif "missing-optional-tool.md" not in json.dumps(present_interface.get("missing_optional", []), ensure_ascii=False):
            failures.append(Failure("repo-companion", "optional dynamic tool locator gaps must stay in missing_optional"))
        elif "advisory-build-tool" not in json.dumps(present_interface.get("missing_optional", []), ensure_ascii=False):
            failures.append(Failure("repo-companion", "advisory dynamic tool missing locator field must stay in missing_optional"))
        if isinstance(present_interface, dict) and "missing-optional-tool.md" in json.dumps(present_interface.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-companion", "optional dynamic tool locator gaps must not pollute core missing_inputs"))
        if isinstance(present_interface, dict) and "advisory-build-tool" in json.dumps(present_interface.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-companion", "advisory dynamic tool missing locator field must not pollute core missing_inputs"))
        present_hook_profile = present_interface.get("hook_profile") if isinstance(present_interface, dict) else None
        present_hook_optional = json.dumps(
            present_hook_profile.get("missing_optional", []) if isinstance(present_hook_profile, dict) else [],
            ensure_ascii=False,
        )
        if "missing-after-run.md" not in present_hook_optional:
            failures.append(Failure("repo-companion", "optional hook locator gaps must stay in hook_profile missing_optional"))
        if "advisory-cleanup-hook" not in present_hook_optional:
            failures.append(Failure("repo-companion", "advisory hook missing locator field must stay in hook_profile missing_optional"))
        if isinstance(present_interface, dict) and "missing-after-run.md" in json.dumps(present_interface.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-companion", "optional hook locator gaps must not pollute core missing_inputs"))
        if isinstance(present_interface, dict) and "advisory-cleanup-hook" in json.dumps(present_interface.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-companion", "advisory hook missing locator field must not pollute core missing_inputs"))
        if isinstance(present_interface, dict):
            availability = present_interface.get("tool_availability")
            require_tool_availability_payload(
                failures,
                category="repo-companion",
                context="present v2 tool availability",
                payload=availability,
            )
            if isinstance(availability, dict):
                by_status = (availability.get("failure_summary") or {}).get("by_status")
                if isinstance(by_status, dict) and by_status.get("advertised", 0) < 1:
                    failures.append(Failure("repo-companion", "present dynamic tool locator must surface as advertised"))
                if isinstance(by_status, dict) and by_status.get("unavailable", 0) < 2:
                    failures.append(Failure("repo-companion", "optional/advisory missing dynamic tools must surface as unavailable"))
            policy_readiness = present_interface.get("policy_readiness")
            require_policy_readiness_payload(
                failures,
                category="repo-companion",
                context="present v2 policy readiness",
                payload=policy_readiness,
            )
            if isinstance(policy_readiness, dict):
                by_policy = (policy_readiness.get("risk_summary") or {}).get("by_policy")
                if not isinstance(by_policy, dict) or by_policy.get("approval") != "declared":
                    failures.append(Failure("repo-companion", "present approval policy must surface as declared"))
                if not isinstance(by_policy, dict) or by_policy.get("sandbox") != "declared":
                    failures.append(Failure("repo-companion", "present sandbox policy must surface as declared"))
            release_targets = present_interface.get("release_targets")
            require_release_targets_surface_payload(
                failures,
                category="repo-companion",
                context="present v2 release targets",
                payload=release_targets,
            )
            if not isinstance(release_targets, dict) or release_targets.get("availability") != "present":
                failures.append(Failure("repo-companion", "present release target declaration must report `availability: present`"))
            else:
                target_release = release_targets.get("target_release")
                if not isinstance(target_release, dict) or target_release.get("schema_version") != governance_surface_module.RELEASE_TARGET_STATUS_SCHEMA:
                    failures.append(Failure("repo-companion", "present release target declaration must expose `loom-target-release-status/v1`"))

        review_requirements = repo_specific_requirements_payload(
            present_interface,
            target_root=present_target,
            surface="review",
        )
        require_repo_specific_requirements_payload(
            failures,
            category="repo-companion",
            context="present repo companion review requirements",
            payload=review_requirements,
            expected_surface="review",
        )
        if review_requirements.get("result") != "block":
            failures.append(Failure("repo-companion", "blocking review requirements must fail closed"))

        merge_requirements = repo_specific_requirements_payload(
            present_interface,
            target_root=present_target,
            surface="merge_ready",
        )
        require_repo_specific_requirements_payload(
            failures,
            category="repo-companion",
            context="present repo companion merge-ready requirements",
            payload=merge_requirements,
            expected_surface="merge_ready",
        )
        if merge_requirements.get("result") != "pass":
            failures.append(Failure("repo-companion", "advisory merge-ready requirements must remain non-blocking"))

        closeout_requirements = repo_specific_requirements_payload(
            present_interface,
            target_root=present_target,
            surface="closeout",
        )
        require_repo_specific_requirements_payload(
            failures,
            category="repo-companion",
            context="present repo companion closeout requirements",
            payload=closeout_requirements,
            expected_surface="closeout",
        )
        if closeout_requirements.get("result") != "block":
            failures.append(Failure("repo-companion", "blocking closeout requirements must fail closed"))

        release_gap_target = base / "release-gap"
        shutil.copytree(example_target, release_gap_target)
        install_companion(
            release_gap_target,
            manifest=valid_manifest,
            repo_interface=valid_interface_v2,
        )
        (release_gap_target / ".loom/companion/releases/changelog.md").unlink(missing_ok=True)
        release_gap_surface = build_governance_surface(release_gap_target)
        release_gap_interface = release_gap_surface.get("repo_interface")
        if not isinstance(release_gap_interface, dict):
            failures.append(Failure("repo-companion", "release gap sample must expose repo_interface"))
        else:
            release_targets = release_gap_interface.get("release_targets")
            require_release_targets_surface_payload(
                failures,
                category="repo-companion",
                context="release gap targets",
                payload=release_targets,
            )
            target_release = release_targets.get("target_release") if isinstance(release_targets, dict) else None
            if not isinstance(target_release, dict) or target_release.get("result") != "block":
                failures.append(Failure("repo-companion", "missing release evidence must fail closed through target_release"))
            elif "changelog evidence is missing" not in json.dumps(target_release.get("closeout_gaps", []), ensure_ascii=False):
                failures.append(Failure("repo-companion", "missing changelog evidence must surface as a release closeout gap"))

        tool_failures_target = base / "tool-failures"
        shutil.copytree(example_target, tool_failures_target)
        tool_failure_interface = {
            **valid_interface_v2,
            "repo_specific_requirements": {
                "review": [],
                "merge_ready": [],
                "closeout": [],
            },
            "dynamic_tool_locators": [
                {
                    "id": "required-unsupported-tool",
                    "summary": "Required tool reports unsupported.",
                    "locator": ".loom/companion/tool-unsupported.json",
                    "owner": "host-adapter",
                    "requirement": "required",
                    "surface": "merge_ready",
                    "fallback_to": "merge",
                },
                {
                    "id": "optional-unavailable-tool",
                    "summary": "Optional tool is not installed.",
                    "locator": ".loom/companion/missing-tool.json",
                    "owner": "host-adapter",
                    "requirement": "optional",
                    "surface": "review",
                    "fallback_to": "build",
                },
                {
                    "id": "advisory-failed-tool",
                    "summary": "Advisory tool reports a failed handshake.",
                    "locator": ".loom/companion/tool-failed.json",
                    "owner": "external-tool",
                    "requirement": "advisory",
                    "surface": "attempt_time",
                    "fallback_to": "build",
                },
            ],
        }
        install_companion(
            tool_failures_target,
            manifest=valid_manifest,
            repo_interface=tool_failure_interface,
        )
        write_json(
            tool_failures_target / ".loom/companion/tool-unsupported.json",
            {
                "schema_version": "loom-dynamic-tool-handshake/v1",
                "status": "unsupported",
                "summary": "Host adapter does not support this tool call.",
                "failure_category": "unsupported",
                "fallback_to": "merge",
                "evidence": {"status": "present"},
            },
        )
        write_json(
            tool_failures_target / ".loom/companion/tool-failed.json",
            {
                "schema_version": "loom-dynamic-tool-handshake/v1",
                "status": "failed",
                "summary": "External tool handshake failed.",
                "failure_category": "failed",
                "fallback_to": "build",
                "evidence": {"status": "present"},
            },
        )
        tool_failure_surface = build_governance_surface(tool_failures_target)
        tool_failure_repo_interface = tool_failure_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="tool failure repo companion",
            payload=tool_failure_repo_interface,
        )
        if not isinstance(tool_failure_repo_interface, dict) or tool_failure_repo_interface.get("availability") != "present":
            failures.append(Failure("repo-companion", "tool handshake failures must not make the companion declaration unreadable"))
        else:
            availability = tool_failure_repo_interface.get("tool_availability")
            if not isinstance(availability, dict):
                failures.append(Failure("repo-companion", "tool failure sample must expose tool_availability"))
            else:
                by_status = (availability.get("failure_summary") or {}).get("by_status")
                if not isinstance(by_status, dict) or by_status.get("unsupported") != 1:
                    failures.append(Failure("repo-companion", "unsupported tool fixture must surface as unsupported"))
                if not isinstance(by_status, dict) or by_status.get("unavailable") != 1:
                    failures.append(Failure("repo-companion", "unavailable tool fixture must surface as unavailable"))
                if not isinstance(by_status, dict) or by_status.get("failed") != 1:
                    failures.append(Failure("repo-companion", "failed tool fixture must surface as failed"))
            tool_merge_requirements = repo_specific_requirements_payload(
                tool_failure_repo_interface,
                target_root=tool_failures_target,
                surface="merge_ready",
            )
            require_repo_specific_requirements_payload(
                failures,
                category="repo-companion",
                context="tool failure merge-ready requirements",
                payload=tool_merge_requirements,
                expected_surface="merge_ready",
            )
            if tool_merge_requirements.get("result") != "block":
                failures.append(Failure("repo-companion", "required unsupported dynamic tool must block merge-ready"))
            tool_review_requirements = repo_specific_requirements_payload(
                tool_failure_repo_interface,
                target_root=tool_failures_target,
                surface="review",
            )
            if tool_review_requirements.get("result") != "pass":
                failures.append(Failure("repo-companion", "optional unavailable dynamic tool must not block review"))

        policy_failures_target = base / "policy-failures"
        shutil.copytree(example_target, policy_failures_target)
        policy_failure_interface = {
            **valid_interface_v2,
            "repo_specific_requirements": {
                "review": [],
                "merge_ready": [],
                "closeout": [],
            },
            "dynamic_tool_locators": [],
            "policy_locators": [
                {
                    "id": "required-approval-conflict",
                    "summary": "Required approval policy conflicts with the current flow.",
                    "policy": "approval",
                    "locator": ".loom/companion/policy-conflict.json",
                    "owner": "host-adapter",
                    "requirement": "required",
                    "surface": "review",
                    "fallback_to": "build",
                },
                {
                    "id": "required-sandbox-unsafe",
                    "summary": "Required sandbox policy reports unsafe execution.",
                    "policy": "sandbox",
                    "locator": ".loom/companion/policy-unsafe.json",
                    "owner": "host-adapter",
                    "requirement": "required",
                    "surface": "merge_ready",
                    "fallback_to": "merge",
                },
                {
                    "id": "optional-approval-missing",
                    "summary": "Optional approval policy is unavailable.",
                    "policy": "approval",
                    "locator": ".loom/companion/policy-missing.json",
                    "owner": "host-adapter",
                    "requirement": "optional",
                    "surface": "closeout",
                    "fallback_to": "merge",
                },
            ],
        }
        install_companion(
            policy_failures_target,
            manifest=valid_manifest,
            repo_interface=policy_failure_interface,
        )
        write_json(
            policy_failures_target / ".loom/companion/policy-conflict.json",
            {
                "schema_version": "loom-policy-read/v1",
                "policy": "approval",
                "status": "conflict",
                "summary": "Approval policy conflicts with the requested flow.",
                "risk": "conflict",
                "fallback_to": "build",
                "evidence": {"status": "present"},
            },
        )
        write_json(
            policy_failures_target / ".loom/companion/policy-unsafe.json",
            {
                "schema_version": "loom-policy-read/v1",
                "policy": "sandbox",
                "status": "unsafe",
                "summary": "Sandbox policy is unsafe for this flow.",
                "risk": "unsafe",
                "fallback_to": "merge",
                "evidence": {"status": "present"},
            },
        )
        write_json(
            policy_failures_target / ".loom/companion/policy-missing.json",
            {
                "schema_version": "loom-policy-read/v1",
                "policy": "approval",
                "status": "missing",
                "summary": "Optional approval policy is not available.",
                "risk": "unknown",
                "fallback_to": "merge",
                "evidence": {"status": "missing"},
            },
        )
        policy_failure_surface = build_governance_surface(policy_failures_target)
        policy_failure_repo_interface = policy_failure_surface.get("repo_interface")
        require_repo_interface_payload(
            failures,
            category="repo-companion",
            context="policy failure repo companion",
            payload=policy_failure_repo_interface,
        )
        if not isinstance(policy_failure_repo_interface, dict) or policy_failure_repo_interface.get("availability") != "present":
            failures.append(Failure("repo-companion", "policy failures must not make the companion declaration unreadable"))
        else:
            readiness = policy_failure_repo_interface.get("policy_readiness")
            if not isinstance(readiness, dict):
                failures.append(Failure("repo-companion", "policy failure sample must expose policy_readiness"))
            else:
                by_status = (readiness.get("risk_summary") or {}).get("by_status")
                if not isinstance(by_status, dict) or by_status.get("missing") != 1:
                    failures.append(Failure("repo-companion", "missing policy fixture must surface as missing"))
                if not isinstance(by_status, dict) or by_status.get("conflict") != 1:
                    failures.append(Failure("repo-companion", "conflict policy fixture must surface as conflict"))
                if not isinstance(by_status, dict) or by_status.get("unsafe") != 1:
                    failures.append(Failure("repo-companion", "unsafe policy fixture must surface as unsafe"))
            policy_review_requirements = repo_specific_requirements_payload(
                policy_failure_repo_interface,
                target_root=policy_failures_target,
                surface="review",
            )
            require_repo_specific_requirements_payload(
                failures,
                category="repo-companion",
                context="policy failure review requirements",
                payload=policy_review_requirements,
                expected_surface="review",
            )
            if policy_review_requirements.get("result") != "block":
                failures.append(Failure("repo-companion", "required conflicting approval policy must block review"))
            policy_merge_requirements = repo_specific_requirements_payload(
                policy_failure_repo_interface,
                target_root=policy_failures_target,
                surface="merge_ready",
            )
            if policy_merge_requirements.get("result") != "block":
                failures.append(Failure("repo-companion", "required unsafe sandbox policy must block merge-ready"))
            policy_closeout_requirements = repo_specific_requirements_payload(
                policy_failure_repo_interface,
                target_root=policy_failures_target,
                surface="closeout",
            )
            if policy_closeout_requirements.get("result") != "pass":
                failures.append(Failure("repo-companion", "optional missing policy must not block closeout"))

        flow_review_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "review",
                "--target",
                str(present_target),
                "--item",
                "INIT-0001",
            ],
        )
        if error:
            failures.append(Failure("repo-companion", f"`flow review` companion sample failed: {error}"))
        elif flow_review_payload.get("result") != "block":
            failures.append(Failure("repo-companion", "`flow review` must block when repo companion declares blocking review requirements"))

        flow_merge_ready_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "flow",
                "merge-ready",
                "--target",
                str(present_target),
                "--item",
                "INIT-0001",
            ],
        )
        if error:
            failures.append(Failure("repo-companion", f"`flow merge-ready` companion sample failed: {error}"))
        elif not isinstance(flow_merge_ready_payload.get("repo_specific_requirements"), dict):
            failures.append(Failure("repo-companion", "`flow merge-ready` companion sample must include `repo_specific_requirements`"))
        elif flow_merge_ready_payload["repo_specific_requirements"].get("result") != "pass":
            failures.append(Failure("repo-companion", "`flow merge-ready` advisory companion requirements must stay non-blocking"))

    return failures


def check_repo_interop_contracts(root: Path) -> list[Failure]:
    example_target = root / "examples/new-project"
    if not example_target.exists():
        return []

    failures: list[Failure] = []

    def write_json(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def sha256_file(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def write_shadow_evidence(target: Path, evidence: str, value_key: str, value: str, source: str) -> None:
        source_path = target / source
        source_path.parent.mkdir(parents=True, exist_ok=True)
        if not source_path.exists():
            write_json(source_path, {"value": value})
        write_json(
            target / evidence,
            {
                value_key: value,
                "source_files": [source],
                "source_sha256": {
                    source: sha256_file(source_path),
                },
            },
        )

    def install_interop(
        target: Path,
        *,
        interop: dict[str, object] | None = None,
    ) -> None:
        companion_dir = target / ".loom" / "companion"
        companion_dir.mkdir(parents=True, exist_ok=True)
        (target / "host").mkdir(parents=True, exist_ok=True)
        (target / "native").mkdir(parents=True, exist_ok=True)
        (target / ".loom" / "shadow").mkdir(parents=True, exist_ok=True)
        (target / "native" / "status").mkdir(parents=True, exist_ok=True)
        for relative, payload in {
            "host/guardian-review.json": {"verdict": "allow"},
            "host/external-orchestrator-read.json": {
                "schema_version": "loom-external-orchestrator-read/v1",
                "operation": "work_item_read",
                "entry_kind": "work_item",
                "source_layer": "authored_truth",
                "source_locator": ".loom/work-items/INIT-0001.md",
                "source_binding": {"item_id": "INIT-0001"},
                "consumed_as": "locator",
            },
            "host/external-orchestrator-attach.json": {
                "schema_version": "loom-external-orchestrator-read/v1",
                "operation": "workspace_attach",
                "entry_kind": "work_item",
                "source_layer": "derived_surface",
                "source_locator": ".loom/status/current.md",
                "source_binding": {"item_id": "INIT-0001"},
                "consumed_as": "summary",
            },
            "host/external-orchestrator-writeback.json": {
                "schema_version": "loom-external-orchestrator-read/v1",
                "operation": "recovery_writeback",
                "entry_kind": "work_item",
                "source_layer": "authored_truth",
                "source_locator": ".loom/progress/INIT-0001.md",
                "source_binding": {"item_id": "INIT-0001"},
                "consumed_as": "locator",
            },
            "host/external-orchestrator-status.json": {
                "schema_version": "loom-external-orchestrator-read/v1",
                "operation": "status_read",
                "entry_kind": "work_item",
                "source_layer": "derived_surface",
                "source_locator": ".loom/status/current.md",
                "source_binding": {"item_id": "INIT-0001", "status_schema_version": "loom-governance-status/v2"},
                "consumed_as": "summary",
            },
            "host/external-orchestrator-gate.json": {
                "schema_version": "loom-external-orchestrator-read/v1",
                "operation": "gate_read",
                "entry_kind": "work_item",
                "source_layer": "derived_surface",
                "source_locator": ".loom/status/current.md",
                "source_binding": {"item_id": "INIT-0001", "gate_chain": "status_control_plane_v2"},
                "consumed_as": "summary",
            },
            "native/status/admission.json": {"result": "pass"},
            "native/status/review.json": {"decision": "allow"},
            "native/status/merge-ready.json": {"status": "pass"},
            "native/status/closeout.json": {"status": "done"},
        }.items():
            write_json(target / relative, payload)
        write_shadow_evidence(target, ".loom/shadow/admission-loom.json", "result", "pass", ".loom/status/current.md")
        write_shadow_evidence(target, ".loom/shadow/admission-repo.json", "result", "pass", "native/status/admission.json")
        write_shadow_evidence(target, ".loom/shadow/review-loom.json", "decision", "allow", "host/guardian-review.json")
        write_shadow_evidence(target, ".loom/shadow/review-repo.json", "decision", "allow", "native/status/review.json")
        write_shadow_evidence(target, ".loom/shadow/merge-ready-loom.json", "status", "pass", "host/guardian-review.json")
        write_shadow_evidence(target, ".loom/shadow/merge-ready-repo.json", "status", "pass", "native/status/merge-ready.json")
        write_shadow_evidence(target, ".loom/shadow/closeout-loom.json", "status", "done", ".loom/status/current.md")
        write_shadow_evidence(target, ".loom/shadow/closeout-repo.json", "status", "done", "native/status/closeout.json")
        if interop is not None:
            write_json(companion_dir / "interop.json", interop)

    valid_interop = {
        "schema_version": "loom-repo-interop/v1",
        "host_adapters": [
            {
                "id": "guardian-review",
                "summary": "Read guardian review verdicts without reimplementing the host action.",
                "surfaces": ["review", "merge_ready"],
                "locator": "host/guardian-review.json",
                "owner": "host-adapter",
                "requirement": "required",
                "fallback_to": "build",
            },
            {
                "id": "optional-host-summary",
                "summary": "Read an optional host summary when the repo declares one.",
                "surfaces": ["closeout"],
                "locator": "host/missing-optional-summary.json",
                "owner": "host-adapter",
                "requirement": "optional",
                "fallback_to": "manual-reconciliation",
            },
            {
                "id": "advisory-host-note",
                "summary": "Read an advisory host note when available.",
                "surfaces": ["review"],
                "owner": "host-adapter",
                "requirement": "advisory",
                "fallback_to": "review",
            }
        ],
        "repo_native_carriers": [
            {
                "id": "governance-status",
                "summary": "Read repo-native governance status output without migrating carriers.",
                "surfaces": ["admission", "review", "merge_ready", "closeout"],
                "locator": "native/status",
                "owner": "repo",
                "requirement": "required",
                "fallback_to": "manual-reconciliation",
            }
        ],
        "external_orchestrators": [
            {
                "id": "fake-external-orchestrator",
                "summary": "Read external orchestrator retained read evidence without making it a scheduler state.",
                "surfaces": ["admission"],
                "operations": ["work_item_read"],
                "locator": "host/external-orchestrator-read.json",
                "owner": "external-tool",
                "requirement": "required",
                "fallback_to": "admission",
            },
            {
                "id": "optional-external-orchestrator",
                "summary": "Optional external orchestrator evidence may be unavailable.",
                "surfaces": ["admission"],
                "operations": ["work_item_read"],
                "locator": "host/missing-external-orchestrator.json",
                "owner": "external-tool",
                "requirement": "optional",
                "fallback_to": "admission",
            },
            {
                "id": "fake-external-orchestrator-attach",
                "summary": "Read workspace attach evidence without owning host lifecycle.",
                "surfaces": ["admission"],
                "operations": ["workspace_attach"],
                "locator": "host/external-orchestrator-attach.json",
                "owner": "external-tool",
                "requirement": "required",
                "fallback_to": "admission",
            },
            {
                "id": "fake-external-orchestrator-writeback",
                "summary": "Read recovery writeback evidence without authoring status truth.",
                "surfaces": ["build"],
                "operations": ["recovery_writeback"],
                "locator": "host/external-orchestrator-writeback.json",
                "owner": "external-tool",
                "requirement": "required",
                "fallback_to": "build",
            },
            {
                "id": "fake-external-orchestrator-status",
                "summary": "Read status control plane v2 without defining a second status surface.",
                "surfaces": ["merge_ready"],
                "operations": ["status_read"],
                "locator": "host/external-orchestrator-status.json",
                "owner": "external-tool",
                "requirement": "required",
                "fallback_to": "current_checkpoint",
            },
            {
                "id": "fake-external-orchestrator-gate",
                "summary": "Read the Loom gate chain without authoring a gate verdict.",
                "surfaces": ["merge_ready"],
                "operations": ["gate_read"],
                "locator": "host/external-orchestrator-gate.json",
                "owner": "external-tool",
                "requirement": "required",
                "fallback_to": "review_gate",
            },
        ],
        "shadow_surfaces": {
            "admission": {
                "summary": "Compare admission parity.",
                "loom_locator": ".loom/shadow/admission-loom.json",
                "repo_locator": ".loom/shadow/admission-repo.json",
            },
            "review": {
                "summary": "Compare review parity.",
                "loom_locator": ".loom/shadow/review-loom.json",
                "repo_locator": ".loom/shadow/review-repo.json",
            },
            "merge_ready": {
                "summary": "Compare merge-ready parity.",
                "loom_locator": ".loom/shadow/merge-ready-loom.json",
                "repo_locator": ".loom/shadow/merge-ready-repo.json",
            },
            "closeout": {
                "summary": "Compare closeout parity.",
                "loom_locator": ".loom/shadow/closeout-loom.json",
                "repo_locator": ".loom/shadow/closeout-repo.json",
            },
        },
    }

    with tempfile.TemporaryDirectory(prefix="loom-check-repo-interop-") as tmp:
        base = Path(tmp)

        absent_target = base / "absent"
        shutil.copytree(example_target, absent_target)
        (absent_target / ".loom" / "companion" / "interop.json").unlink(missing_ok=True)
        absent_surface = build_governance_surface(absent_target)
        repo_interop = absent_surface.get("repo_interop")
        require_repo_interop_payload(
            failures,
            category="repo-interop",
            context="absent repo interop",
            payload=repo_interop,
        )
        if not isinstance(repo_interop, dict) or repo_interop.get("availability") != "absent":
            failures.append(Failure("repo-interop", "absent repo interop sample must report `availability: absent`"))

        invalid_target = base / "invalid"
        shutil.copytree(example_target, invalid_target)
        install_interop(
            invalid_target,
            interop={
                "schema_version": "loom-repo-interop/v1",
                "host_adapters": [
                    {
                        "id": "bad-adapter",
                        "summary": "Broken adapter",
                        "surfaces": ["guardian"],
                        "locator": "host/missing.json",
                        "owner": "host-adapter",
                        "requirement": "required",
                        "fallback_to": "build",
                    }
                ],
                "repo_native_carriers": [],
                "external_orchestrators": [],
                "shadow_surfaces": {
                    "admission": {
                        "summary": "Compare admission parity.",
                        "loom_locator": ".loom/shadow/admission-loom.json",
                        "repo_locator": ".loom/shadow/admission-repo.json",
                    }
                },
            },
        )
        invalid_surface = build_governance_surface(invalid_target)
        invalid_interop = invalid_surface.get("repo_interop")
        require_repo_interop_payload(
            failures,
            category="repo-interop",
            context="invalid repo interop",
            payload=invalid_interop,
        )
        if not isinstance(invalid_interop, dict) or invalid_interop.get("availability") != "incomplete":
            failures.append(Failure("repo-interop", "invalid repo interop sample must report `availability: incomplete`"))

        invalid_optional_escape_target = base / "invalid-optional-host-escape"
        shutil.copytree(example_target, invalid_optional_escape_target)
        install_interop(invalid_optional_escape_target, interop=valid_interop)
        interop_path = invalid_optional_escape_target / ".loom" / "companion" / "interop.json"
        interop_payload = json.loads(interop_path.read_text(encoding="utf-8"))
        interop_payload["host_adapters"] = [
            {
                "id": "optional-escaped-host",
                "summary": "Optional host adapter locator must still respect repository path boundaries.",
                "surfaces": ["review"],
                "locator": "../outside-host.json",
                "owner": "host-adapter",
                "requirement": "optional",
                "fallback_to": "build",
            }
        ]
        write_json(interop_path, interop_payload)
        invalid_optional_escape_surface = build_governance_surface(invalid_optional_escape_target)
        invalid_optional_interop = invalid_optional_escape_surface.get("repo_interop")
        if not isinstance(invalid_optional_interop, dict) or invalid_optional_interop.get("availability") != "incomplete":
            failures.append(Failure("repo-interop", "optional host action path escape must fail closed"))
        elif "outside-host.json" not in json.dumps(invalid_optional_interop.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-interop", "optional host action path escape must stay in blocking missing_inputs"))

        present_target = base / "present"
        shutil.copytree(example_target, present_target)
        install_interop(present_target, interop=valid_interop)
        present_surface = build_governance_surface(present_target)
        present_interop = present_surface.get("repo_interop")
        require_repo_interop_payload(
            failures,
            category="repo-interop",
            context="present repo interop",
            payload=present_interop,
        )
        if not isinstance(present_interop, dict) or present_interop.get("availability") != "present":
            failures.append(Failure("repo-interop", "present repo interop sample must report `availability: present`"))
        elif "missing-optional-summary.json" not in json.dumps(present_interop.get("missing_optional", []), ensure_ascii=False):
            failures.append(Failure("repo-interop", "optional host action locator gaps must stay in missing_optional"))
        elif "advisory-host-note" not in json.dumps(present_interop.get("missing_optional", []), ensure_ascii=False):
            failures.append(Failure("repo-interop", "advisory host action missing locator field must stay in missing_optional"))
        elif "missing-external-orchestrator.json" not in json.dumps(present_interop.get("missing_optional", []), ensure_ascii=False):
            failures.append(Failure("repo-interop", "optional external orchestrator locator gaps must stay in missing_optional"))
        if isinstance(present_interop, dict) and "missing-optional-summary.json" in json.dumps(present_interop.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-interop", "optional host action locator gaps must not pollute core missing_inputs"))
        if isinstance(present_interop, dict) and "advisory-host-note" in json.dumps(present_interop.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-interop", "advisory host action missing locator field must not pollute core missing_inputs"))
        if isinstance(present_interop, dict) and "missing-external-orchestrator.json" in json.dumps(present_interop.get("missing_inputs", []), ensure_ascii=False):
            failures.append(Failure("repo-interop", "optional external orchestrator locator gaps must not pollute core missing_inputs"))

        parity_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(present_target)],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity` sample failed: {error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="repo-interop",
                context="`shadow-parity` present sample",
                payload=parity_payload,
                expected_reports=4,
            )
            if parity_payload.get("result") != "pass":
                failures.append(Failure("repo-interop", "`shadow-parity` must pass when all declared surfaces match"))

        blocking_match_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(present_target), "--blocking"],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity --blocking` match sample failed: {error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="repo-interop",
                context="`shadow-parity --blocking` match sample",
                payload=blocking_match_payload,
                expected_reports=4,
            )
            if blocking_match_payload.get("result") != "pass":
                failures.append(Failure("repo-interop", "`shadow-parity --blocking` must pass when all declared surfaces match"))

        mismatch_target = base / "mismatch"
        shutil.copytree(present_target, mismatch_target)
        write_json(mismatch_target / "native/status/review.json", {"decision": "block"})
        write_shadow_evidence(mismatch_target, ".loom/shadow/review-repo.json", "decision", "block", "native/status/review.json")
        mismatch_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(mismatch_target), "--surface", "review"],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity` mismatch sample failed: {error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="repo-interop",
                context="`shadow-parity` mismatch sample",
                payload=mismatch_payload,
                expected_reports=1,
            )
            reports = mismatch_payload.get("reports")
            if not isinstance(reports, list) or not reports or reports[0].get("result") != "mismatch":
                failures.append(Failure("repo-interop", "`shadow-parity` mismatch sample must report `mismatch`"))

        blocking_mismatch_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "shadow-parity",
                "--target",
                str(mismatch_target),
                "--surface",
                "review",
                "--mode",
                "blocking",
            ],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity --mode blocking` mismatch sample failed: {error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="repo-interop",
                context="`shadow-parity --mode blocking` mismatch sample",
                payload=blocking_mismatch_payload,
                expected_reports=1,
            )
            if blocking_mismatch_payload.get("result") != "block":
                failures.append(Failure("repo-interop", "`shadow-parity --mode blocking` must block mismatches"))

        unreadable_target = base / "unreadable"
        shutil.copytree(present_target, unreadable_target)
        (unreadable_target / ".loom/shadow/closeout-repo.json").unlink()
        blocking_unreadable_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "shadow-parity",
                "--target",
                str(unreadable_target),
                "--surface",
                "closeout",
                "--blocking",
            ],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity --blocking` unreadable sample failed: {error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="repo-interop",
                context="`shadow-parity --blocking` unreadable sample",
                payload=blocking_unreadable_payload,
                expected_reports=1,
            )
            if blocking_unreadable_payload.get("result") != "block":
                failures.append(Failure("repo-interop", "`shadow-parity --blocking` must block unreadable surfaces"))

        missing_hash_target = base / "missing-hash"
        shutil.copytree(present_target, missing_hash_target)
        write_json(
            missing_hash_target / ".loom/shadow/review-repo.json",
            {
                "decision": "allow",
                "source_files": ["native/status/review.json"],
            },
        )
        missing_hash_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(missing_hash_target), "--surface", "review"],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity` missing hash sample failed: {error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="repo-interop",
                context="`shadow-parity` missing hash sample",
                payload=missing_hash_payload,
                expected_reports=1,
            )
            reports = missing_hash_payload.get("reports")
            if not isinstance(reports, list) or not reports or reports[0].get("result") != "unreadable":
                failures.append(Failure("repo-interop", "`shadow-parity` missing hash sample must report `unreadable`"))

        partial_hash_target = base / "partial-hash"
        shutil.copytree(present_target, partial_hash_target)
        write_json(
            partial_hash_target / ".loom/shadow/review-repo.json",
            {
                "decision": "allow",
                "source_files": ["native/status/review.json", "host/guardian-review.json"],
                "source_sha256": {
                    "native/status/review.json": sha256_file(partial_hash_target / "native/status/review.json"),
                },
            },
        )
        partial_hash_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(partial_hash_target), "--surface", "review"],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity` partial hash sample failed: {error}"))
        else:
            reports = partial_hash_payload.get("reports")
            if not isinstance(reports, list) or not reports or reports[0].get("result") != "unreadable":
                failures.append(Failure("repo-interop", "`shadow-parity` partial hash sample must report `unreadable`"))

        hash_drift_target = base / "hash-drift"
        shutil.copytree(present_target, hash_drift_target)
        write_json(hash_drift_target / "native/status/review.json", {"decision": "changed-after-evidence"})
        hash_drift_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(hash_drift_target), "--surface", "review"],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity` hash drift sample failed: {error}"))
        else:
            reports = hash_drift_payload.get("reports")
            if not isinstance(reports, list) or not reports or reports[0].get("result") != "unreadable":
                failures.append(Failure("repo-interop", "`shadow-parity` hash drift sample must report `unreadable`"))

        rogue_target = base / "rogue"
        shutil.copytree(present_target, rogue_target)
        write_json(
            rogue_target / ".loom/shadow/rogue.json",
            {
                "result": "pass",
                "source_files": ["native/status/review.json"],
                "source_sha256": {
                    "native/status/review.json": sha256_file(rogue_target / "native/status/review.json"),
                },
            },
        )
        rogue_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(rogue_target), "--surface", "review"],
        )
        if error:
            failures.append(Failure("repo-interop", f"`shadow-parity` rogue evidence sample failed: {error}"))
        else:
            reports = rogue_payload.get("reports")
            if not isinstance(reports, list) or not reports or reports[0].get("result") != "unreadable":
                failures.append(Failure("repo-interop", "`shadow-parity` rogue evidence sample must report `unreadable`"))

    return failures


def check_external_orchestrator_interop_fixture_contract(root: Path) -> list[Failure]:
    fixture_path = root / "docs/evidence/fixtures/external-orchestrator-interop-fixtures.json"
    category = "external-orchestrator-interop"
    failures: list[Failure] = []
    if not fixture_path.exists():
        return [Failure(category, "`docs/evidence/fixtures/external-orchestrator-interop-fixtures.json` is missing")]
    try:
        fixture_payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [Failure(category, f"external orchestrator fixture JSON is invalid: {exc}")]

    if fixture_payload.get("schema_version") != EXTERNAL_ORCHESTRATOR_FIXTURE_SCHEMA:
        failures.append(
            Failure(
                category,
                f"`docs/evidence/fixtures/external-orchestrator-interop-fixtures.json` schema_version must be `{EXTERNAL_ORCHESTRATOR_FIXTURE_SCHEMA}`",
            )
        )
    fixtures = fixture_payload.get("fixtures")
    if not isinstance(fixtures, list) or not fixtures:
        failures.append(Failure(category, "external orchestrator fixtures must include a non-empty `fixtures` list"))
        return failures

    seen_names: set[str] = set()
    required_names = {
        "work-item-read-present",
        "pr-only-entry-block",
        "truth-poisoning-block",
        "optional-missing-warn",
        "workspace-attach-present",
        "recovery-writeback-present",
        "direct-status-write-block",
        "status-read-present",
        "gate-read-present",
        "scheduler-private-fallback-block",
    }
    allowed_operations = {"work_item_read", "workspace_attach", "recovery_writeback", "status_read", "gate_read"}
    loom_fallbacks = {
        "work_item",
        "admission",
        "binding_repair",
        "current_checkpoint",
        "spec_gate",
        "build_gate",
        "review_gate",
        "merge_gate",
        "merge_ready",
        "build",
        "review",
        "closeout",
    }
    for index, fixture in enumerate(fixtures):
        if not isinstance(fixture, dict):
            failures.append(Failure(category, f"fixtures[{index}] must be an object"))
            continue
        name = fixture.get("name")
        if not isinstance(name, str) or not name:
            failures.append(Failure(category, f"fixtures[{index}] must include non-empty `name`"))
        else:
            seen_names.add(name)
        expect = fixture.get("expect")
        entry = fixture.get("entry")
        if not isinstance(entry, dict):
            failures.append(Failure(category, f"{name or index} entry must be an object"))
        else:
            for field in ("id", "summary", "locator", "owner", "requirement", "fallback_to"):
                if not isinstance(entry.get(field), str) or not entry.get(field):
                    failures.append(Failure(category, f"{name or index} entry missing `{field}`"))
            if entry.get("owner") not in governance_surface_module.DECLARED_LOCATOR_OWNERS:
                failures.append(Failure(category, f"{name or index} owner must stay within declared locator owners"))
            if entry.get("requirement") not in governance_surface_module.DECLARED_LOCATOR_REQUIREMENTS:
                failures.append(Failure(category, f"{name or index} requirement must be required/optional/advisory"))
            surfaces = entry.get("surfaces")
            if not isinstance(surfaces, list) or not surfaces:
                failures.append(Failure(category, f"{name or index} entry must include non-empty `surfaces`"))
            operations = entry.get("operations")
            if not isinstance(operations, list) or not operations:
                failures.append(Failure(category, f"{name or index} entry must declare at least one external orchestrator operation"))
            elif any(operation not in allowed_operations for operation in operations):
                failures.append(Failure(category, f"{name or index} entry declares an unsupported external orchestrator operation"))
            fallback_to = entry.get("fallback_to")
            if (
                isinstance(fallback_to, str)
                and fallback_to not in loom_fallbacks
                and (not isinstance(expect, dict) or expect.get("result") != "block")
            ):
                failures.append(Failure(category, f"{name or index} fallback_to must point to a Loom checkpoint or gate repair surface"))
        payload = fixture.get("payload")
        if not isinstance(expect, dict) or expect.get("result") not in {"pass", "warn", "block"}:
            failures.append(Failure(category, f"{name or index} expect.result must be pass/warn/block"))
        if payload is not None:
            if not isinstance(payload, dict):
                failures.append(Failure(category, f"{name or index} payload must be an object or null"))
            else:
                if payload.get("operation") not in allowed_operations:
                    failures.append(Failure(category, f"{name or index} payload operation must be a supported external orchestrator operation"))
                if payload.get("source_layer") not in {"authored_truth", "host_control_mirror", "retained_result", "derived_surface"}:
                    failures.append(Failure(category, f"{name or index} payload source_layer must use fact-chain vocabulary"))
                payload_fallback = payload.get("fallback_to")
                if (
                    isinstance(payload_fallback, str)
                    and payload_fallback not in loom_fallbacks
                    and (not isinstance(expect, dict) or expect.get("result") != "block")
                ):
                    failures.append(Failure(category, f"{name or index} payload fallback_to must point to a Loom checkpoint or gate repair surface"))
                forbidden = sorted(EXTERNAL_ORCHESTRATOR_FORBIDDEN_FIELDS.intersection(payload.keys()))
                if forbidden and expect.get("result") != "block":
                    failures.append(Failure(category, f"{name or index} forbidden fields must only appear in blocking fixtures"))
                if payload.get("entry_kind") != "work_item" and expect.get("result") != "block":
                    failures.append(Failure(category, f"{name or index} non-Work Item entry must block"))
                if payload.get("entry_kind") == "implementation_pr" and expect.get("fallback_to") != "work_item":
                    failures.append(Failure(category, f"{name or index} PR-only fixture must fallback to `work_item`"))
                if payload.get("operation") in {"status_read", "gate_read"}:
                    if payload.get("source_layer") != "derived_surface":
                        failures.append(Failure(category, f"{name or index} status/gate reads must consume the derived status surface"))
                    if payload.get("consumed_as") != "summary":
                        failures.append(Failure(category, f"{name or index} status/gate reads must be consumed as summary, not authored truth"))
                    if payload.get("operation") == "status_read":
                        status_fields = payload.get("status_fields")
                        required_status_fields = {"result", "current_gate", "classifications", "missing_inputs", "head_binding", "gate_chain", "provenance"}
                        if not isinstance(status_fields, list) or not required_status_fields.issubset(set(status_fields)):
                            failures.append(Failure(category, f"{name or index} status_read fixture must reuse status control plane v2 fields"))
                    if payload.get("operation") == "gate_read":
                        gate_fields = payload.get("gate_fields")
                        required_gate_fields = {"name", "result", "classification", "missing_inputs", "fallback_to"}
                        if expect.get("result") != "block" and (not isinstance(gate_fields, list) or not required_gate_fields.issubset(set(gate_fields))):
                            failures.append(Failure(category, f"{name or index} gate_read fixture must reuse the existing gate chain fields"))
                if name == "scheduler-private-fallback-block" and expect.get("fallback_to") != "current_checkpoint":
                    failures.append(Failure(category, "scheduler-private fallback fixture must fallback to `current_checkpoint`"))
                if name == "scheduler-private-fallback-block":
                    entry_fallback = entry.get("fallback_to") if isinstance(entry, dict) else None
                    if entry_fallback in loom_fallbacks or payload.get("fallback_to") in loom_fallbacks:
                        failures.append(Failure(category, "scheduler-private fallback fixture must prove a private fallback is blocked"))

    missing = sorted(required_names - seen_names)
    if missing:
        failures.append(Failure(category, "external orchestrator fixtures missing required cases: " + ", ".join(missing)))

    return failures


def check_external_orchestrator_conformance_contract(root: Path) -> list[Failure]:
    category = "external-orchestrator-conformance"
    failures: list[Failure] = []
    required_docs = {
        "docs/evidence/orchestration-conformance-profiles.md": [
            "orchestration-extension/external-orchestrator",
            "loom-external-orchestrator-conformance/v1",
            "fake external orchestrator happy/drift fixtures",
        ],
        "docs/evidence/live-smoke-profile.md": [
            "external-orchestrator-interop",
            "loom-external-orchestrator-conformance/v1",
            "does not execute",
        ],
        "docs/evidence/external-orchestrator-release-threshold.md": [
            "v0.12.0",
            "loom-external-orchestrator-conformance/v1",
            "no daemon",
            "fake external orchestrator fixtures are sufficient",
        ],
    }
    for relative, anchors in required_docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure(category, f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure(category, f"`{relative}` must mention `{anchor}`"))

    fixture_path = root / "docs/evidence/fixtures/external-orchestrator-conformance-fixtures.json"
    try:
        fixture_payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        failures.append(Failure(category, f"external orchestrator conformance fixtures are unreadable: {exc}"))
        return failures
    if fixture_payload.get("schema_version") != EXTERNAL_ORCHESTRATOR_CONFORMANCE_FIXTURE_SCHEMA:
        failures.append(Failure(category, f"conformance fixture schema_version must be `{EXTERNAL_ORCHESTRATOR_CONFORMANCE_FIXTURE_SCHEMA}`"))
    fixtures = fixture_payload.get("fixtures")
    required_names = {
        "fake-external-orchestrator-happy",
        "fake-external-orchestrator-truth-drift",
        "fake-external-orchestrator-private-fallback",
        "fake-external-orchestrator-lifecycle-drift",
    }
    if not isinstance(fixtures, list) or not fixtures:
        failures.append(Failure(category, "external orchestrator conformance fixtures must include fixtures"))
        return failures
    seen_names: set[str] = set()
    for index, fixture in enumerate(fixtures):
        if not isinstance(fixture, dict):
            failures.append(Failure(category, f"fixtures[{index}] must be an object"))
            continue
        name = fixture.get("name")
        if isinstance(name, str):
            seen_names.add(name)
        entry = fixture.get("entry")
        payload = fixture.get("payload")
        expect = fixture.get("expect")
        if not isinstance(entry, dict):
            failures.append(Failure(category, f"{name or index} entry must be an object"))
            continue
        if not isinstance(payload, dict):
            failures.append(Failure(category, f"{name or index} payload must be an object"))
        if not isinstance(expect, dict) or expect.get("result") not in {"pass", "block"}:
            failures.append(Failure(category, f"{name or index} expect.result must be pass/block"))
        operations = entry.get("operations")
        if not isinstance(operations, list) or not operations:
            failures.append(Failure(category, f"{name or index} entry.operations must be non-empty"))
        elif any(operation not in {"work_item_read", "workspace_attach", "recovery_writeback", "status_read", "gate_read"} for operation in operations):
            failures.append(Failure(category, f"{name or index} declares unsupported operation"))
        if name == "fake-external-orchestrator-happy" and expect.get("schema_version") != EXTERNAL_ORCHESTRATOR_CONFORMANCE_SCHEMA:
            failures.append(Failure(category, "happy fixture must expect conformance schema v1"))
        if name == "fake-external-orchestrator-truth-drift" and payload is not None:
            forbidden = sorted(EXTERNAL_ORCHESTRATOR_FORBIDDEN_FIELDS.intersection(payload.keys()))
            if not forbidden or expect.get("failure") != "truth_pollution":
                failures.append(Failure(category, "truth drift fixture must prove forbidden authored/scheduler fields block"))
        if name == "fake-external-orchestrator-private-fallback":
            if entry.get("fallback_to") != "scheduler_retry_queue" or expect.get("fallback_to") != "current_checkpoint":
                failures.append(Failure(category, "private fallback fixture must block back to current_checkpoint"))
        if name == "fake-external-orchestrator-lifecycle-drift" and payload is not None:
            if payload.get("host_lifecycle_ownership") != "loom" or payload.get("daemon") is not True:
                failures.append(Failure(category, "lifecycle drift fixture must prove no-daemon/no-host-lifecycle boundary"))
    missing = sorted(required_names - seen_names)
    if missing:
        failures.append(Failure(category, "external orchestrator conformance fixtures missing required cases: " + ", ".join(missing)))

    example_target = root / "examples/new-project"
    absent_payload, error = load_command_json(
        root,
        ["python3", "tools/loom_flow.py", "live-smoke", "external-orchestrator-interop", "--target", str(example_target)],
    )
    if error:
        failures.append(Failure(category, f"`external-orchestrator-interop` not_applicable sample failed: {error}"))
    else:
        require_external_orchestrator_conformance_payload(
            failures,
            category=category,
            context="not-applicable external orchestrator conformance",
            payload=absent_payload,
        )
        external_profile = absent_payload.get("external_orchestrator") if isinstance(absent_payload, dict) else None
        if not isinstance(absent_payload, dict) or absent_payload.get("result") != "pass":
            failures.append(Failure(category, "not-applicable external orchestrator conformance must pass"))
        elif not isinstance(external_profile, dict) or external_profile.get("status") != "not_applicable":
            failures.append(Failure(category, "not-applicable external orchestrator conformance must expose not_applicable status"))

    def write_json_local(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def sha256_file_local(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def write_shadow_evidence_local(target: Path, evidence: str, value_key: str, value: str, source: str) -> None:
        source_path = target / source
        if not source_path.exists():
            write_json_local(source_path, {value_key: value})
        write_json_local(
            target / evidence,
            {
                value_key: value,
                "source_files": [source],
                "source_sha256": {source: sha256_file_local(source_path)},
            },
        )

    def load_or_new_interop_local(target: Path) -> dict:
        interop_path = target / ".loom/companion/interop.json"
        if interop_path.exists():
            interop = load_json_file(interop_path)
            if isinstance(interop, dict):
                return interop
        return {
            "schema_version": "loom-repo-interop/v1",
            "host_adapters": [],
            "repo_native_carriers": [],
            "external_orchestrators": [],
        }

    with tempfile.TemporaryDirectory(prefix="loom-external-orchestrator-conformance-") as tmp:
        base = Path(tmp)
        present_target = base / "present"
        shutil.copytree(example_target, present_target)
        happy_fixture = next((fixture for fixture in fixtures if isinstance(fixture, dict) and fixture.get("name") == "fake-external-orchestrator-happy"), None)
        if isinstance(happy_fixture, dict):
            interop = load_or_new_interop_local(present_target)
            interop["external_orchestrators"] = [happy_fixture["entry"]]
            write_json_local(present_target / ".loom/companion/interop.json", interop)
            write_json_local(present_target / happy_fixture["entry"]["locator"], happy_fixture["payload"])
            present_payload, present_error = load_command_json(
                root,
                ["python3", "tools/loom_flow.py", "live-smoke", "external-orchestrator-interop", "--target", str(present_target)],
            )
            if present_error:
                failures.append(Failure(category, f"`external-orchestrator-interop` happy sample failed: {present_error}"))
            else:
                require_external_orchestrator_conformance_payload(
                    failures,
                    category=category,
                    context="happy external orchestrator conformance",
                    payload=present_payload,
                )
                if not isinstance(present_payload, dict) or present_payload.get("result") != "pass":
                    failures.append(Failure(category, "happy external orchestrator conformance must pass"))

        drift_target = base / "drift"
        shutil.copytree(example_target, drift_target)
        drift_fixture = next((fixture for fixture in fixtures if isinstance(fixture, dict) and fixture.get("name") == "fake-external-orchestrator-truth-drift"), None)
        if isinstance(drift_fixture, dict):
            interop = load_or_new_interop_local(drift_target)
            interop["external_orchestrators"] = [drift_fixture["entry"]]
            write_json_local(drift_target / ".loom/companion/interop.json", interop)
            write_json_local(drift_target / drift_fixture["entry"]["locator"], drift_fixture["payload"])
            drift_payload, drift_error = load_command_json(
                root,
                ["python3", "tools/loom_flow.py", "live-smoke", "external-orchestrator-interop", "--target", str(drift_target)],
            )
            if drift_error:
                failures.append(Failure(category, f"`external-orchestrator-interop` drift sample failed: {drift_error}"))
            else:
                require_external_orchestrator_conformance_payload(
                    failures,
                    category=category,
                    context="drift external orchestrator conformance",
                    payload=drift_payload,
                )
                core_profile = drift_payload.get("core_profile") if isinstance(drift_payload, dict) else None
                if not isinstance(drift_payload, dict) or drift_payload.get("result") != "block":
                    failures.append(Failure(category, "truth drift external orchestrator conformance must block"))
                elif not isinstance(core_profile, dict) or core_profile.get("result") != "pass":
                    failures.append(Failure(category, "external orchestrator conformance drift must not rewrite core profile"))

    return failures


def check_external_runtime_devendor_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    required_anchors = {
        "docs/adoption/external-runtime-companion-contract.md": [
            "vendored `.loom/bin`",
            "runtime_locator",
            "versioned external Loom runtime",
            "rollback",
            ".loom/companion/interop.json",
        ],
        "docs/adoption/repo-interop-contract.md": [
            "external-runtime",
            "de-vendor",
            "runtime locator",
            "interop",
        ],
        "docs/adoption/repo-companion-contract.md": [
            "external-runtime",
            "runtime locator",
            "repo-interface.json",
        ],
        "skills/shared/references/harness/runtime-state.md": [
            "Carrier transition invariants",
            "LOOM_SOURCE_REPO_ROOT",
            "external runtime",
            "vendored `.loom/bin`",
        ],
        "docs/evidence/validations/validation-external-runtime-devendor-migration.md": [
            "external-runtime",
            "de-vendor",
            "rollback",
            "advisory",
        ],
    }
    for relative, anchors in required_anchors.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("external-runtime-devendor", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("external-runtime-devendor", f"`{relative}` must mention `{anchor}`"))
    return failures


def check_status_closeout_binding_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    seen: dict[str, object] = {}
    original_closeout_payload = loom_status_module.closeout_payload

    def fake_closeout_payload(**kwargs: object) -> tuple[dict[str, object], list[str]]:
        seen.update(kwargs)
        return (
            {
                "result": "pass",
                "summary": "synthetic closeout payload",
                "missing_inputs": [],
                "fallback_to": None,
                "reconciliation": {
                    "result": "pass",
                    "findings": [],
                },
            },
            [],
        )

    try:
        loom_status_module.closeout_payload = fake_closeout_payload
        payload = loom_status_module.full_closeout_status_payload(
            root,
            phase_number=439,
            fr_number=474,
            issue_number=1,
            pr_number=2,
            project_number=3,
            branch_name="feat/review-locators",
            owner="owner",
            repo_name="repo",
            github_status={"repository": "owner/repo"},
            github_errors=[],
        )
    finally:
        loom_status_module.closeout_payload = original_closeout_payload

    if payload.get("result") != "pass":
        failures.append(Failure("daily-execution-cli", "`loom_status` synthetic closeout payload must pass"))
    expected = {
        "phase_number": 439,
        "fr_number": 474,
        "issue_number": 1,
        "pr_number": 2,
        "project_number": 3,
        "branch_name": "feat/review-locators",
        "owner": "owner",
        "repo_name": "repo",
        "skip_gate": False,
    }
    for field, value in expected.items():
        if seen.get(field) != value:
            failures.append(Failure("daily-execution-cli", f"`loom_status` closeout must forward `{field}` to closeout_payload"))
    return failures


def check_behavior_first_locator_contracts(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    required_anchors = {
        "docs/adoption/repo-companion-contract.md": [
            "review_instruction_locators",
            "spec_review",
            "implementation_review",
            "repo_declared | loom_default",
            "behavior evidence",
            "test evidence",
            "fresh verification evidence",
            "不得把 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 路径硬编码成 Loom 默认查找路径",
            "不得承接 review disposition",
        ],
        "docs/adoption/repo-interop-contract.md": [
            "spec review / implementation review instruction locator",
            "repo-interface.json",
            "review_instruction_locators",
        ],
        "docs/adoption/deep-existing-repo-default.md": [
            "review_instruction_locators",
            "repo-owned instruction locator",
            "不得让 Loom 猜测 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 文件名",
        ],
        "docs/adoption/lightweight-retrofit-default.md": [
            "review_instruction_locators",
            "loom_default",
            "不是自动猜测 `spec_review.md`、`code_review.md` 或任何单仓历史路径",
        ],
        "docs/adoption/github-profile-upgrade.md": [
            "review instruction locators for spec review and implementation review",
            "repo-owned review instruction locator",
            "不能猜测 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 路径",
        ],
        "docs/methodology/harness/status-surface.md": [
            "fresh verification evidence",
            "behavior evidence / test evidence",
            "stale",
        ],
        "docs/methodology/harness/review-execution.md": [
            "findings[].disposition",
            "behavior/test evidence",
            "subagent 输出只能作为 review 输入证据",
        ],
        "docs/methodology/harness/merge-checkpoint.md": [
            "fresh verification evidence",
            "review disposition",
            "ownership 分配修正点",
        ],
        "skills/shared/references/adoption/deep-existing-repo-default.md": [
            "review_instruction_locators",
            "repo-owned instruction locator",
            "不得让 Loom 猜测 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 文件名",
        ],
        "skills/shared/references/adoption/lightweight-retrofit-default.md": [
            "review_instruction_locators",
            "loom_default",
            "不是自动猜测 `spec_review.md`、`code_review.md` 或任何单仓历史路径",
        ],
        "skills/shared/references/adoption/github-profile-upgrade.md": [
            "review instruction locators for spec review and implementation review",
            "repo-owned review instruction locator",
            "不能猜测 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 路径",
        ],
    }
    for relative, anchors in required_anchors.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("behavior-first-locators", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("behavior-first-locators", f"`{relative}` must mention `{anchor}`"))
    return failures


def check_adversarial_adoption_fixture(root: Path) -> list[Failure]:
    example_target = root / "examples/new-project"
    if not example_target.exists():
        return []

    failures: list[Failure] = []

    def write_json(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def sha256_file(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def write_shadow_evidence(target: Path, evidence: str, value_key: str, value: str, source: str) -> None:
        source_path = target / source
        source_path.parent.mkdir(parents=True, exist_ok=True)
        if not source_path.exists():
            write_json(source_path, {"value": value})
        write_json(
            target / evidence,
            {
                value_key: value,
                "source_files": [source],
                "source_sha256": {
                    source: sha256_file(source_path),
                },
            },
        )

    valid_interop = {
        "schema_version": "loom-repo-interop/v1",
        "host_adapters": [
            {
                "id": "guardian-review",
                "summary": "Read repo-native review verdicts without reimplementing the host action.",
                "surfaces": ["review", "merge_ready"],
                "locator": "host/guardian-review.json",
                "owner": "host-adapter",
                "requirement": "required",
                "fallback_to": "review",
            }
        ],
        "repo_native_carriers": [
            {
                "id": "governance-status",
                "summary": "Read repo-native governance status output without migrating carriers.",
                "surfaces": ["admission", "review", "merge_ready", "closeout"],
                "locator": "native/status",
                "owner": "repo",
                "requirement": "required",
                "fallback_to": "manual-reconciliation",
            }
        ],
        "shadow_surfaces": {
            "admission": {
                "summary": "Compare admission parity.",
                "loom_locator": ".loom/shadow/admission-loom.json",
                "repo_locator": ".loom/shadow/admission-repo.json",
            },
            "review": {
                "summary": "Compare review parity.",
                "loom_locator": ".loom/shadow/review-loom.json",
                "repo_locator": ".loom/shadow/review-repo.json",
            },
            "merge_ready": {
                "summary": "Compare merge-ready parity.",
                "loom_locator": ".loom/shadow/merge-ready-loom.json",
                "repo_locator": ".loom/shadow/merge-ready-repo.json",
            },
            "closeout": {
                "summary": "Compare closeout parity.",
                "loom_locator": ".loom/shadow/closeout-loom.json",
                "repo_locator": ".loom/shadow/closeout-repo.json",
            },
        },
    }

    def install_strong_companion(target: Path) -> None:
        companion = target / ".loom" / "companion"
        companion.mkdir(parents=True, exist_ok=True)
        for relative in (
            ".loom/companion/README.md",
            ".loom/companion/review.md",
            ".loom/companion/merge-ready.md",
            ".loom/companion/closeout.md",
            ".loom/companion/specialized-gates.md",
            ".loom/companion/metadata-contract.md",
            ".loom/companion/context-schema.md",
        ):
            (target / relative).parent.mkdir(parents=True, exist_ok=True)
            (target / relative).write_text("# Companion Fixture\n\nStable fixture authority.\n", encoding="utf-8")
        write_json(
            companion / "manifest.json",
            {
                "schema_version": "loom-repo-companion-manifest/v1",
                "companion_entry": ".loom/companion/README.md",
                "repo_interface": ".loom/companion/repo-interface.json",
            },
        )
        write_json(
            companion / "repo-interface.json",
            {
                "schema_version": "loom-repo-interface/v2",
                "companion_entry": ".loom/companion/README.md",
                "repo_specific_requirements": {
                    "review": [],
                    "merge_ready": [],
                    "closeout": [],
                },
                "specialized_gates": [
                    {
                        "id": "repo-native-review",
                        "summary": "Repo-native review stays repo-owned.",
                        "locator": ".loom/companion/specialized-gates.md",
                        "gate_type": "review",
                    }
                ],
                "metadata_contract": {
                    "fields": [
                        {
                            "id": "integration_check",
                            "summary": "Repo-local integration metadata remains repo-owned.",
                            "applicability_locator": ".loom/companion/metadata-contract.md",
                            "authority_locator": ".loom/companion/review.md",
                            "enforcement": "advisory",
                        }
                    ]
                },
                "context_schema": {
                    "fields": [
                        {
                            "id": "item_key",
                            "summary": "Repo-local item key mapping.",
                            "type": "string",
                            "required": True,
                            "mapping_rule_locator": ".loom/companion/context-schema.md",
                        }
                    ]
                },
                "dynamic_tool_locators": [],
            },
        )

    def install_interop(target: Path) -> None:
        (target / "host").mkdir(parents=True, exist_ok=True)
        (target / "native" / "status").mkdir(parents=True, exist_ok=True)
        for relative, payload in {
            "host/guardian-review.json": {"decision": "allow"},
            "native/status/admission.json": {"result": "pass"},
            "native/status/review.json": {"decision": "allow"},
            "native/status/merge-ready.json": {"status": "pass"},
            "native/status/closeout.json": {"status": "done"},
        }.items():
            write_json(target / relative, payload)
        write_shadow_evidence(target, ".loom/shadow/admission-loom.json", "result", "pass", ".loom/status/current.md")
        write_shadow_evidence(target, ".loom/shadow/admission-repo.json", "result", "pass", "native/status/admission.json")
        write_shadow_evidence(target, ".loom/shadow/review-loom.json", "decision", "allow", "host/guardian-review.json")
        write_shadow_evidence(target, ".loom/shadow/review-repo.json", "decision", "allow", "native/status/review.json")
        write_shadow_evidence(target, ".loom/shadow/merge-ready-loom.json", "status", "pass", "host/guardian-review.json")
        write_shadow_evidence(target, ".loom/shadow/merge-ready-repo.json", "status", "pass", "native/status/merge-ready.json")
        write_shadow_evidence(target, ".loom/shadow/closeout-loom.json", "status", "done", ".loom/status/current.md")
        write_shadow_evidence(target, ".loom/shadow/closeout-repo.json", "status", "done", "native/status/closeout.json")
        write_json(target / ".loom" / "companion" / "interop.json", valid_interop)

    def git_init(target: Path) -> str | None:
        for args in (
            ["git", "init"],
            ["git", "config", "user.email", "loom-check@example.com"],
            ["git", "config", "user.name", "loom-check"],
            ["git", "remote", "add", "origin", "https://github.com/MC-and-his-Agents/Loom.git"],
            ["git", "add", "-f", "."],
            ["git", "commit", "-m", "strong adoption fixture baseline"],
        ):
            result = run_command(root, args, cwd=target, timeout_seconds=30)
            if result.returncode != 0:
                failures.append(Failure("adversarial-adoption", f"`{' '.join(args)}` setup failed: {result.stderr.strip() or result.stdout.strip()}"))
                return None
        head = run_command(root, ["git", "rev-parse", "HEAD"], cwd=target, timeout_seconds=30)
        if head.returncode != 0:
            failures.append(Failure("adversarial-adoption", "`git rev-parse HEAD` setup failed"))
            return None
        return head.stdout.strip()

    def install_fresh_reviews(target: Path, reviewed_head: str) -> None:
        validation_summary = "Bootstrap manifest exists; init-result JSON can be read mechanically; the first work item, status surface, and spec/plan artifacts exist."
        for suffix, kind in (("", "code_review"), (".spec", "spec_review")):
            write_json(
                target / ".loom" / "reviews" / f"INIT-0001{suffix}.json",
                {
                    "schema_version": "loom-review/v1",
                    "item_id": "INIT-0001",
                    "decision": "allow",
                    "kind": kind,
                    "summary": "Strong-governance adoption fixture review is fresh.",
                    "reviewer": "loom-check",
                    "reviewed_head": reviewed_head,
                    "reviewed_validation_summary": validation_summary,
                    "fallback_to": None,
                    "findings": [],
                    "blocking_issues": [],
                    "follow_ups": [],
                },
            )

    def prepare_strong_target(target: Path) -> str | None:
        shutil.copytree(example_target, target)
        install_strong_companion(target)
        install_interop(target)
        reviewed_head = git_init(target)
        if reviewed_head is None:
            return None
        install_fresh_reviews(target, reviewed_head)
        result = run_command(root, ["git", "add", "-f", ".loom/reviews"], cwd=target, timeout_seconds=30)
        if result.returncode == 0:
            result = run_command(root, ["git", "commit", "-m", "record fresh reviews"], cwd=target, timeout_seconds=30)
        if result.returncode != 0:
            failures.append(Failure("adversarial-adoption", f"fresh review setup failed: {result.stderr.strip() or result.stdout.strip()}"))
            return None
        head = run_command(root, ["git", "rev-parse", "HEAD"], cwd=target, timeout_seconds=30)
        return head.stdout.strip() if head.returncode == 0 else reviewed_head

    with tempfile.TemporaryDirectory(prefix="loom-check-syvert-adoption-") as tmp:
        base = Path(tmp)

        original_governance_remote = governance_surface_module.git_remote_origin
        original_flow_remote = loom_flow_module.git_remote_origin
        try:
            governance_surface_module.git_remote_origin = lambda _root: "git@github.com:owner/foo.bar.git"
            loom_flow_module.git_remote_origin = lambda _root: "git@github.com:owner/foo.bar.git"
            if governance_surface_module.detect_github_repo(base) != ("owner", "foo.bar"):
                failures.append(Failure("adversarial-adoption", "governance surface must accept dotted GitHub repository names"))
            if loom_flow_module.detect_github_repo(base) != ("owner", "foo.bar"):
                failures.append(Failure("adversarial-adoption", "loom flow must accept dotted GitHub repository names"))
        finally:
            governance_surface_module.git_remote_origin = original_governance_remote
            loom_flow_module.git_remote_origin = original_flow_remote

        branch_calls: list[list[str]] = []
        original_detect_repo = governance_surface_module.detect_github_repo
        original_rest_json = governance_surface_module.gh_rest_json
        original_gh_json = governance_surface_module.gh_json
        try:
            governance_surface_module.detect_github_repo = lambda _root: ("owner", "foo.bar")
            governance_surface_module.gh_rest_json = lambda _root, _path: ({"full_name": "owner/foo.bar", "default_branch": "release/main"}, [])

            def fake_gh_json(_root: Path, args: list[str]) -> tuple[dict[str, object], list[str]]:
                branch_calls.append(args)
                return {"protected": False}, []

            governance_surface_module.gh_json = fake_gh_json
            _, errors = governance_surface_module.detect_github_control_plane(base)
            if errors:
                failures.append(Failure("adversarial-adoption", f"governance surface slash-branch fixture failed: {'; '.join(errors)}"))
            elif not branch_calls or "repos/owner/foo.bar/branches/release%2Fmain" not in branch_calls[0]:
                failures.append(Failure("adversarial-adoption", "GitHub branch REST endpoint must encode slash-containing branch names"))
        finally:
            governance_surface_module.detect_github_repo = original_detect_repo
            governance_surface_module.gh_rest_json = original_rest_json
            governance_surface_module.gh_json = original_gh_json

        original_detect_repo = governance_surface_module.detect_github_repo
        original_rest_json = governance_surface_module.gh_rest_json
        original_gh_json = governance_surface_module.gh_json
        original_gh_json_list = governance_surface_module.gh_json_list
        try:
            governance_surface_module.detect_github_repo = lambda _root: ("owner", "repo")
            governance_surface_module.gh_rest_json = lambda _root, _path: ({"full_name": "owner/repo", "default_branch": "main"}, [])

            def fake_control_plane_json(_root: Path, args: list[str]) -> tuple[dict[str, object], list[str]]:
                endpoint = args[-1]
                if endpoint == "repos/owner/repo/branches/main":
                    return {
                        "protected": True,
                        "protection": {
                            "required_status_checks": {
                                "contexts": ["py-compile", "demo-bootstrap", "repo-local-cli", "loom-check"]
                            },
                            "required_pull_request_reviews": {},
                        },
                    }, []
                if endpoint == "repos/owner/repo/actions/workflows":
                    return {"workflows": [{"path": ".github/workflows/loom-check.yml"}]}, []
                if endpoint == "repos/owner/repo/commits/main/check-runs":
                    return {
                        "check_runs": [
                            {"name": "py-compile"},
                            {"name": "demo-bootstrap"},
                            {"name": "repo-local-cli"},
                            {"name": "loom-check"},
                        ]
                    }, []
                return {}, []

            governance_surface_module.gh_json = fake_control_plane_json
            governance_surface_module.gh_json_list = lambda _root, _args: ([{"target": "branch", "enforcement": "active"}], [])
            surface, errors = governance_surface_module.detect_github_control_plane(base)
            if errors:
                failures.append(Failure("adversarial-adoption", f"host control-plane verified fixture failed: {'; '.join(errors)}"))
            elif surface.get("api_snapshot", {}).get("verification_status") != "verified":
                failures.append(Failure("adversarial-adoption", "host control-plane fixture must produce a verified API snapshot"))
            elif surface.get("host_enforcement", {}).get("required_checks") is not True:
                failures.append(Failure("adversarial-adoption", "required checks fixture must be host-enforced only when stable check names are configured"))
            elif surface.get("rulesets", {}).get("enforced") is not True:
                failures.append(Failure("adversarial-adoption", "ruleset fixture must report active branch ruleset enforcement"))
        finally:
            governance_surface_module.detect_github_repo = original_detect_repo
            governance_surface_module.gh_rest_json = original_rest_json
            governance_surface_module.gh_json = original_gh_json
            governance_surface_module.gh_json_list = original_gh_json_list

        original_detect_repo = governance_surface_module.detect_github_repo
        original_rest_json = governance_surface_module.gh_rest_json
        original_gh_json = governance_surface_module.gh_json
        original_gh_json_list = governance_surface_module.gh_json_list
        try:
            governance_surface_module.detect_github_repo = lambda _root: ("owner", "repo")
            governance_surface_module.gh_rest_json = lambda _root, _path: ({"full_name": "owner/repo", "default_branch": "main"}, [])

            def fake_unverified_json(_root: Path, args: list[str]) -> tuple[dict[str, object] | None, list[str]]:
                endpoint = args[-1]
                if endpoint == "repos/owner/repo/branches/main":
                    return {
                        "protected": True,
                        "protection": {
                            "required_status_checks": {"contexts": ["py-compile"]},
                        },
                    }, []
                return None, ["host unavailable"]

            governance_surface_module.gh_json = fake_unverified_json
            governance_surface_module.gh_json_list = lambda _root, _args: ([], ["host unavailable"])
            surface, errors = governance_surface_module.detect_github_control_plane(base)
            if errors:
                failures.append(Failure("adversarial-adoption", f"optional host control-plane reads must not become missing inputs: {'; '.join(errors)}"))
            elif surface.get("api_snapshot", {}).get("verification_status") != "unverified":
                failures.append(Failure("adversarial-adoption", "failed optional host reads must surface as unverified"))
            elif surface.get("rulesets", {}).get("status") != "unverified":
                failures.append(Failure("adversarial-adoption", "ruleset read failure must not be projected as an empty ruleset list"))
            elif surface.get("host_enforcement", {}).get("required_checks") is not False:
                failures.append(Failure("adversarial-adoption", "partial required checks must not pass host enforcement"))
        finally:
            governance_surface_module.detect_github_repo = original_detect_repo
            governance_surface_module.gh_rest_json = original_rest_json
            governance_surface_module.gh_json = original_gh_json
            governance_surface_module.gh_json_list = original_gh_json_list

        merge_calls: list[list[str]] = []
        original_run_git = loom_flow_module.run_git
        try:
            def fake_run_git(_root: Path, args: list[str]):
                merge_calls.append(args)

                class Result:
                    returncode = 0

                return Result()

            loom_flow_module.run_git = fake_run_git
            if not loom_flow_module.contains_merged_commit(base, "abc123", "release/main"):
                failures.append(Failure("adversarial-adoption", "target-branch merge containment fixture unexpectedly failed"))
            expected_fetch = ["fetch", "origin", "refs/heads/release/main:refs/remotes/origin/release/main"]
            if not merge_calls or merge_calls[0] != expected_fetch:
                failures.append(Failure("adversarial-adoption", "merge commit containment must fetch the explicit target branch"))
        finally:
            loom_flow_module.run_git = original_run_git

        path_contract_target = base / "path-contract"
        path_contract_target.mkdir()
        (path_contract_target / "install-layout.json").write_text('{"required_paths":["../outside"]}', encoding="utf-8")
        payload, errors, _ = runtime_state_module._validate_install_layout(path_contract_target)
        if payload.get("status") != "block" or not any("must stay inside" in error for error in errors):
            failures.append(Failure("adversarial-adoption", "install-layout runtime paths must not escape the runtime root"))

        (path_contract_target / "upgrade-contract.json").write_text('{"upgrade_policy":{"refresh_required":["layout_manifest"]}}', encoding="utf-8")
        (path_contract_target / "registry.json").write_text(
            '{"install_layout":"install-layout.json","upgrade_contract":"upgrade-contract.json","entries":[{"id":"x","executable":"../outside-exec","manifest":"../outside-manifest.json"}]}',
            encoding="utf-8",
        )
        payload, errors, _ = runtime_state_module._validate_registry_contract(path_contract_target)
        if payload.get("status") != "block" or not any("must stay inside" in error for error in errors):
            failures.append(Failure("adversarial-adoption", "registry executable and manifest paths must not escape the runtime root"))

        fact_chain_escape = base / "fact-chain-error-anchor"
        (fact_chain_escape / ".loom/bootstrap").mkdir(parents=True)
        write_json(
            fact_chain_escape / ".loom/bootstrap/init-result.json",
            {
                "schema_version": "loom-init-output/v1",
                "fact_chain": {
                    "read_entry": "python3 .loom/bin/loom_init.py fact-chain --target .",
                    "mode": "work-item + recovery-entry + derived status-surface",
                    "entry_points": {
                        "current_item_id": "INIT-0001",
                        "work_item": "../outside.md",
                        "recovery_entry": ".loom/progress/INIT-0001.md",
                        "status_surface": ".loom/status/current.md",
                    }
                },
            },
        )
        _, errors = inspect_fact_chain(fact_chain_escape)
        if not any("must stay within the target root" in error for error in errors):
            failures.append(Failure("adversarial-adoption", "fact-chain path-boundary errors must expose a stable target-root anchor"))

        shadow_anchor_errors = governance_surface_module.validate_shadow_surface(
            root=base,
            surface="review",
            entry={
                "summary": "review parity",
                "loom_locator": ".loom/shadow/review-loom.json",
                "repo_locator": "../outside.json",
            },
        )
        if not any(
            "must stay inside the repository" in error
            and "must stay within the repository root" in error
            for error in shadow_anchor_errors
        ):
            failures.append(Failure("adversarial-adoption", "shadow surface path-boundary errors must expose a stable repository anchor"))

        shadow_boundary_target = base / "shadow-structured-boundary"
        (shadow_boundary_target / ".loom/companion").mkdir(parents=True)
        write_json(
            shadow_boundary_target / ".loom/companion/interop.json",
            {
                "schema_version": "loom-repo-interop/v1",
                "host_adapters": [],
                "repo_native_carriers": [],
                "shadow_surfaces": {
                    "review": {
                        "summary": "review parity",
                        "loom_locator": "../outside-loom.json",
                        "repo_locator": "../outside-repo.json",
                    }
                },
            },
        )
        shadow_boundary_report = loom_flow_module.shadow_parity_report(
            {
                "availability": "present",
                "contract": {"locator": ".loom/companion/interop.json"},
            },
            target_root=shadow_boundary_target,
            surface="review",
        )
        shadow_boundary_details = shadow_boundary_report.get("missing_details")
        if not isinstance(shadow_boundary_details, list) or not any(
            isinstance(detail, dict)
            and detail.get("category") == "path_boundary"
            and detail.get("kind") == "repo_locator_escape"
            and detail.get("scope") == "repository_root"
            and detail.get("label") == "shadow surface `review` repo_locator"
            and detail.get("locator") == "../outside-repo.json"
            for detail in shadow_boundary_details
        ):
            failures.append(Failure("adversarial-adoption", "shadow parity path-boundary failures must expose structured missing_details"))

        spec_contract_target = base / "spec-contract"
        (spec_contract_target / ".loom/specs/INIT-0001").mkdir(parents=True)
        (spec_contract_target / ".loom/specs/INIT-0001/spec.md").write_text("bootstrap spec\n", encoding="utf-8")
        context = {
            "item_id": "WORK-0002",
            "target_root": spec_contract_target,
            "associated_artifacts": [".loom/specs/INIT-0001/spec.md"],
        }
        if loom_flow_module.formal_spec_path(context) is not None:
            failures.append(Failure("adversarial-adoption", "active Work Items must not fall back to bootstrap INIT specs"))

        semantics_target = base / "shadow-semantics"
        (semantics_target / ".loom/shadow").mkdir(parents=True)
        (semantics_target / "loom.md").write_text("loom\n", encoding="utf-8")
        write_json(
            semantics_target / ".loom/shadow/review-loom.json",
            {
                "parity_value": "review-v1",
                "source_semantics": "requires spec review",
                "source_files": ["loom.md"],
                "source_sha256": {"loom.md": sha256_file(semantics_target / "loom.md")},
            },
        )
        normalized, _ = loom_flow_module.normalized_shadow_value(
            semantics_target / ".loom/shadow/review-loom.json",
            target_root=semantics_target,
        )
        if "requires spec review" not in str(normalized.get("normalized_value")):
            failures.append(Failure("adversarial-adoption", "shadow parity normalization must retain declared source semantics"))

        baseline = base / "baseline"
        current_head = prepare_strong_target(baseline)
        if current_head is None:
            return failures
        install_fresh_reviews(baseline, current_head)
        run_command(root, ["git", "add", "-f", ".loom/reviews"], cwd=baseline, timeout_seconds=30)
        run_command(root, ["git", "commit", "-m", "refresh reviews to current head"], cwd=baseline, timeout_seconds=30)

        status_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "governance-profile", "status", "--target", str(baseline)],
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"`governance-profile status` baseline failed: {error}"))
        else:
            maturity = status_payload.get("maturity")
            if isinstance(maturity, dict) and maturity.get("current") == "strong":
                pass
            elif isinstance(maturity, dict):
                missing_by_level = maturity.get("missing_by_level")
                strong_missing = missing_by_level.get("strong") if isinstance(missing_by_level, dict) else []
                if not isinstance(strong_missing, list) or "repo_interface" in strong_missing or "repo_interop" in strong_missing:
                    failures.append(Failure("adversarial-adoption", "hostless baseline must still prove repo companion and interop carriers are present"))
            else:
                failures.append(Failure("adversarial-adoption", "baseline fixture must reach strong maturity when GitHub host signals are readable"))

        for label, args, expected in (
            ("runtime-parity", ["python3", str(baseline / ".loom/bin/loom_flow.py"), "runtime-parity", "validate", "--target", str(baseline)], "pass"),
            ("shadow-parity", ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(baseline)], "pass"),
            ("shadow-parity --blocking", ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(baseline), "--blocking"], "pass"),
            ("flow resume", ["python3", "tools/loom_flow.py", "flow", "resume", "--target", str(baseline), "--item", "INIT-0001"], "pass"),
            ("adopt verify", ["python3", "tools/loom_flow.py", "adopt", "verify", "--target", str(baseline), "--item", "INIT-0001"], "pass"),
        ):
            payload, error = load_command_json(root, args)
            if error:
                failures.append(Failure("adversarial-adoption", f"`{label}` baseline failed: {error}"))
            elif payload.get("result") != expected:
                failures.append(Failure("adversarial-adoption", f"`{label}` baseline must return `{expected}`"))
            elif label == "shadow-parity":
                for report in payload.get("reports", []) if isinstance(payload.get("reports"), list) else []:
                    if not isinstance(report, dict):
                        continue
                    loom_surface = report.get("loom_surface")
                    repo_surface = report.get("repo_surface")
                    loom_sources = set(loom_surface.get("source_files", [])) if isinstance(loom_surface, dict) and isinstance(loom_surface.get("source_files"), list) else set()
                    repo_sources = set(repo_surface.get("source_files", [])) if isinstance(repo_surface, dict) and isinstance(repo_surface.get("source_files"), list) else set()
                    if loom_sources and repo_sources and loom_sources == repo_sources:
                        failures.append(Failure("adversarial-adoption", "`shadow-parity` generated Loom and repo-native surfaces must not be backed by identical source files"))
            elif label == "adopt verify":
                roundtrip = payload.get("producer_consumer_roundtrip")
                deleted_section = (
                    roundtrip.get("bypass_check")
                    if isinstance(roundtrip, dict)
                    else None
                )
                if not isinstance(deleted_section, dict) or deleted_section.get("consumer_result") != "block":
                    failures.append(Failure("adversarial-adoption", "`adopt verify` must prove required Review Artifacts deletion cannot bypass the consumer"))
                consumption = payload.get("generated_companion_consumption")
                if not isinstance(consumption, dict):
                    failures.append(Failure("adversarial-adoption", "`adopt verify` must report generated companion reverse-consumption"))
                else:
                    shadow = consumption.get("shadow_parity")
                    if not isinstance(shadow, dict) or shadow.get("status") not in {"pass", "consumed"}:
                        failures.append(Failure("adversarial-adoption", "`adopt verify` must consume generated interop through shadow parity"))

        sha_only_payload, sha_only_error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "host-binding",
                "validate",
                "--target",
                str(baseline),
                "--owner",
                "MC-and-his-Agents",
                "--repo",
                "Loom",
                "--head-sha",
                current_head,
            ],
            timeout_seconds=60,
        )
        if sha_only_error:
            failures.append(Failure("adversarial-adoption", f"SHA-only host-binding negative sample failed: {sha_only_error}"))
        else:
            missing_inputs = sha_only_payload.get("missing_inputs")
            if sha_only_payload.get("result") != "block" or not isinstance(missing_inputs, list) or not missing_inputs:
                failures.append(Failure("adversarial-adoption", "SHA-only host-binding must fail closed when REST cannot prove issue or PR binding"))

        path_escape_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "fact-chain", "--target", str(baseline), "--output", "../outside-init-result.json"],
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"path escape fact-chain sample failed: {error}"))
        elif path_escape_payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "fact-chain must block init-result locators that escape the target root"))

        escape_work_item_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "work-item",
                "create",
                "--target",
                str(baseline),
                "--item",
                "ESCAPE-0001",
                "--goal",
                "Reject path escape",
                "--scope",
                "Exercise repo-relative locator hardening",
                "--execution-path",
                "execution/support",
                "--workspace-entry",
                ".",
                "--validation-entry",
                "python3 .loom/bin/loom_init.py verify --target .",
                "--closing-condition",
                "Unsafe locators are blocked.",
                "--recovery-entry",
                "../escape.md",
                "--init-recovery",
            ],
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"path escape work-item sample failed: {error}"))
        elif escape_work_item_payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "work-item create must block recovery locators that escape the target root"))

        poisoned_work_item_target = base / "work-item-update-poisoned-locator"
        shutil.copytree(baseline, poisoned_work_item_target)
        poisoned_work_item_path = poisoned_work_item_target / ".loom/work-items/INIT-0001.md"
        poisoned_work_item_text = poisoned_work_item_path.read_text(encoding="utf-8").replace(
            "- Recovery Entry: .loom/progress/INIT-0001.md",
            "- Recovery Entry: ../outside.md",
        )
        poisoned_work_item_path.write_text(poisoned_work_item_text, encoding="utf-8")
        poisoned_init_path = poisoned_work_item_target / ".loom/bootstrap/init-result.json"
        poisoned_init_before = poisoned_init_path.read_text(encoding="utf-8")
        poisoned_update_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "work-item",
                "update",
                "--target",
                str(poisoned_work_item_target),
                "--item",
                "INIT-0001",
                "--activate",
            ],
        )
        poisoned_init_after = poisoned_init_path.read_text(encoding="utf-8")
        if error:
            failures.append(Failure("adversarial-adoption", f"poisoned work-item update sample failed: {error}"))
        elif poisoned_update_payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "work-item update --activate must block poisoned recovery locators"))
        elif poisoned_init_before != poisoned_init_after:
            failures.append(Failure("adversarial-adoption", "work-item update --activate must not mutate init-result before locator validation passes"))

        shadow_escape_target = base / "shadow-locator-escape"
        shutil.copytree(baseline, shadow_escape_target)
        interop_path = shadow_escape_target / ".loom/companion/interop.json"
        interop_payload = load_json_file(interop_path)
        shadow_surfaces = interop_payload.get("shadow_surfaces") if isinstance(interop_payload, dict) else None
        review_surface = shadow_surfaces.get("review") if isinstance(shadow_surfaces, dict) else None
        if isinstance(review_surface, dict):
            review_surface["loom_locator"] = "/tmp/outside-shadow-evidence.json"
            write_json(interop_path, interop_payload)
        shadow_escape_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(shadow_escape_target), "--surface", "review", "--blocking"],
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"path escape shadow-parity sample failed: {error}"))
        elif shadow_escape_payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "shadow-parity blocking mode must reject absolute shadow locators"))
        else:
            shadow_escape_details = shadow_escape_payload.get("missing_details")
            if not isinstance(shadow_escape_details, list) or not any(
                isinstance(detail, dict)
                and detail.get("category") == "path_boundary"
                and "loom_locator" in str(detail.get("label", ""))
                for detail in shadow_escape_details
            ):
                failures.append(Failure("adversarial-adoption", "shadow-parity CLI payload must aggregate structured path-boundary missing_details"))

        poisoned_payload, error = load_command_json(
            root,
            ["python3", str(baseline / ".loom/bin/loom_init.py"), "runtime-state", "--target", str(baseline)],
            env={"LOOM_SOURCE_REPO_ROOT": "/tmp/not-loom"},
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"env poisoning runtime-state failed: {error}"))
        else:
            runtime_state = poisoned_payload.get("runtime_state")
            carrier = runtime_state.get("carrier") if isinstance(runtime_state, dict) else None
            if carrier != "bootstrapped-target-runtime" or poisoned_payload.get("result") != "pass":
                failures.append(Failure("adversarial-adoption", "env poisoning must not override bootstrapped target runtime detection"))

        drift_target = base / "runtime-drift"
        shutil.copytree(baseline, drift_target)
        manifest_path = drift_target / ".loom/bootstrap/manifest.json"
        manifest = load_json_file(manifest_path)
        artifacts = manifest.get("artifacts") if isinstance(manifest, dict) else []
        if isinstance(artifacts, list):
            for artifact in artifacts:
                if isinstance(artifact, dict) and artifact.get("path") == ".loom/bin/loom_init.py":
                    artifact["sha256"] = "0" * 64
                    break
        write_json(manifest_path, manifest)
        payload, error = load_command_json(
            root,
            ["python3", str(drift_target / ".loom/bin/loom_flow.py"), "runtime-parity", "validate", "--target", str(drift_target)],
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"runtime provenance drift sample failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "runtime provenance drift must block runtime-parity"))

        carrier_refresh_target = base / "carrier-refresh"
        shutil.copytree(baseline, carrier_refresh_target)
        write_json(
            carrier_refresh_target / ".loom/shadow/shadow-parity.json",
            {
                "schema_version": "loom-shadow-parity/v1",
                "result": "pass",
                "summary": "Aggregate shadow parity output is not per-surface hash evidence.",
            },
        )
        carrier_manifest_path = carrier_refresh_target / ".loom/bootstrap/manifest.json"
        carrier_manifest = load_json_file(carrier_manifest_path)
        carrier_artifacts = carrier_manifest.get("artifacts") if isinstance(carrier_manifest, dict) else []
        if isinstance(carrier_artifacts, list):
            for artifact in carrier_artifacts:
                if isinstance(artifact, dict) and artifact.get("path") == ".loom/bin/loom_flow.py":
                    artifact["sha256"] = "1" * 64
                    break
        write_json(carrier_manifest_path, carrier_manifest)
        dry_run_payload, dry_run_error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "carrier", "refresh", "--target", str(carrier_refresh_target), "--dry-run"],
        )
        if dry_run_error:
            failures.append(Failure("adversarial-adoption", f"carrier refresh dry-run sample failed: {dry_run_error}"))
        else:
            refresh_needed = dry_run_payload.get("refresh_needed")
            if dry_run_payload.get("result") != "pass" or not isinstance(refresh_needed, list) or not refresh_needed:
                failures.append(Failure("adversarial-adoption", "carrier refresh dry-run must report runtime provenance refresh-needed"))
            actions = dry_run_payload.get("actions")
            summary_actions = [
                action
                for action in actions
                if isinstance(action, dict)
                and action.get("path") == ".loom/shadow/shadow-parity.json"
                and action.get("status") == "skipped"
            ] if isinstance(actions, list) else []
            if not summary_actions:
                failures.append(Failure("adversarial-adoption", "carrier refresh must skip aggregate shadow-parity.json without requiring source hashes"))
        write_payload, write_error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "carrier", "refresh", "--target", str(carrier_refresh_target), "--write"],
        )
        if write_error:
            failures.append(Failure("adversarial-adoption", f"carrier refresh write sample failed: {write_error}"))
        else:
            after_payload, after_error = load_command_json(
                root,
                ["python3", "tools/loom_flow.py", "carrier", "refresh", "--target", str(carrier_refresh_target), "--dry-run"],
            )
            if after_error:
                failures.append(Failure("adversarial-adoption", f"carrier refresh after-write sample failed: {after_error}"))
            elif after_payload.get("refresh_needed"):
                failures.append(Failure("adversarial-adoption", "carrier refresh --write must clear runtime provenance drift"))

        outside_comment = base / "outside-comment.md"
        outside_comment.write_text("sensitive local text\n", encoding="utf-8")
        comment_escape_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "reconciliation",
                "sync",
                "--target",
                str(baseline),
                "--comment-file",
                str(outside_comment),
                "--dry-run",
            ],
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"reconciliation comment-file boundary sample failed: {error}"))
        elif comment_escape_payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "reconciliation --comment-file must block absolute paths outside the target root"))
        else:
            missing_inputs = comment_escape_payload.get("missing_inputs")
            if not isinstance(missing_inputs, list) or not any(
                "reconciliation comment file" in str(item) and "must be repo-relative" in str(item)
                for item in missing_inputs
            ):
                failures.append(Failure("adversarial-adoption", "reconciliation --comment-file boundary block must report the comment file locator boundary error"))

        original_pr_payload = loom_flow_module.github_pr_payload
        original_issue_payload = loom_flow_module.github_issue_payload
        original_reconciliation_audit = loom_flow_module.reconciliation_audit_payload
        original_contains = loom_flow_module.contains_merged_commit
        seen_target_branches: list[str] = []
        try:
            loom_flow_module.github_pr_payload = lambda *_args, **_kwargs: (
                {
                    "state": "MERGED",
                    "baseRefName": "release/main",
                    "mergeCommit": {"oid": "abc123"},
                },
                [],
            )
            loom_flow_module.github_issue_payload = lambda *_args, **_kwargs: (
                {"state": "CLOSED", "id": "issue-id"},
                [],
            )
            loom_flow_module.reconciliation_audit_payload = lambda **_kwargs: (
                {
                    "result": "pass",
                    "findings": [],
                    "missing_inputs": [],
                    "fallback_to": None,
                },
                [],
            )

            def fake_contains(_root: Path, _merge_commit_sha: str, target_branch: str = "main") -> bool:
                seen_target_branches.append(target_branch)
                return target_branch == "release/main"

            loom_flow_module.contains_merged_commit = fake_contains
            closeout_target_branch_payload, closeout_errors = loom_flow_module.closeout_payload(
                target_root=baseline,
                phase_number=None,
                fr_number=None,
                issue_number=1,
                pr_number=2,
                project_number=None,
                branch_name=None,
                owner="owner",
                repo_name="repo",
                skip_gate=True,
            )
            if closeout_errors:
                failures.append(Failure("adversarial-adoption", f"closeout target branch fixture failed: {closeout_errors}"))
            elif closeout_target_branch_payload.get("result") != "pass":
                failures.append(Failure("adversarial-adoption", "closeout must pass when the merge commit is contained in the PR base branch"))
            if seen_target_branches != ["release/main"]:
                failures.append(Failure("adversarial-adoption", "closeout must check merge commit containment against the PR base branch, including slash branches"))

            seen_target_branches.clear()
            loom_flow_module.github_pr_payload = lambda *_args, **_kwargs: (
                {
                    "state": "MERGED",
                    "mergeCommit": {"oid": "abc123"},
                },
                [],
            )
            closeout_missing_base_payload, closeout_errors = loom_flow_module.closeout_payload(
                target_root=baseline,
                phase_number=None,
                fr_number=None,
                issue_number=1,
                pr_number=2,
                project_number=None,
                branch_name=None,
                owner="owner",
                repo_name="repo",
                skip_gate=True,
            )
            if closeout_errors:
                failures.append(Failure("adversarial-adoption", f"closeout missing baseRefName fixture failed: {closeout_errors}"))
            else:
                missing_inputs = closeout_missing_base_payload.get("missing_inputs")
                if closeout_missing_base_payload.get("result") != "block" or "pr baseRefName is missing" not in missing_inputs:
                    failures.append(Failure("adversarial-adoption", "closeout must block when PR baseRefName is missing instead of falling back to main"))
            if seen_target_branches:
                failures.append(Failure("adversarial-adoption", "closeout must not check origin/main when PR baseRefName is missing"))
        finally:
            loom_flow_module.github_pr_payload = original_pr_payload
            loom_flow_module.github_issue_payload = original_issue_payload
            loom_flow_module.reconciliation_audit_payload = original_reconciliation_audit
            loom_flow_module.contains_merged_commit = original_contains

        rollover_target = base / "active-rollover"
        shutil.copytree(baseline, rollover_target)
        payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "work-item",
                "create",
                "--target",
                str(rollover_target),
                "--item",
                "WORK-0002",
                "--goal",
                "Validate active item rollover",
                "--scope",
                "Keep the fixture constrained to Loom carriers",
                "--execution-path",
                "execution/support",
                "--workspace-entry",
                ".",
                "--validation-entry",
                "python3 .loom/bin/loom_init.py verify --target .",
                "--closing-condition",
                "The active item can be read mechanically.",
                "--init-recovery",
                "--activate",
            ],
        )
        if error:
            failures.append(Failure("adversarial-adoption", f"active item rollover create failed: {error}"))
        else:
            resume_payload, resume_error = load_command_json(
                root,
                ["python3", "tools/loom_flow.py", "flow", "resume", "--target", str(rollover_target), "--item", "WORK-0002"],
            )
            item_id = resume_payload.get("item", {}).get("id") if isinstance(resume_payload, dict) and isinstance(resume_payload.get("item"), dict) else None
            if resume_error:
                failures.append(Failure("adversarial-adoption", f"active item rollover resume failed: {resume_error}"))
            elif item_id != "WORK-0002":
                failures.append(Failure("adversarial-adoption", "active item rollover must consume WORK-0002 instead of bootstrap INIT-0001"))

        spoof_target = base / "metadata-spoof"
        shutil.copytree(baseline, spoof_target)
        work_item_path = spoof_target / ".loom/work-items/INIT-0001.md"
        work_item_path.write_text(
            work_item_path.read_text(encoding="utf-8").replace(
                "- Goal: Bootstrap the first executable Loom path for this repository\n",
                "- Goal: spoofed wrong goal\n- Goal: Bootstrap the first executable Loom path for this repository\n",
                1,
            ),
            encoding="utf-8",
        )
        payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "fact-chain", "--target", str(spoof_target)])
        if error:
            failures.append(Failure("adversarial-adoption", f"metadata spoof sample failed: {error}"))
        elif payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "metadata spoofing must fail closed in the canonical section"))

        def assert_broken_shadow_evidence(
            label: str,
            mutate: object,
            *,
            expect_validation_warn: bool = True,
        ) -> None:
            shadow_target = base / f"shadow-broken-{label}"
            shutil.copytree(baseline, shadow_target)
            if callable(mutate):
                mutate(shadow_target)
            warn_payload, warn_error = load_command_json(
                root,
                ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(shadow_target), "--surface", "review"],
            )
            block_payload, block_error = load_command_json(
                root,
                ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(shadow_target), "--surface", "review", "--blocking"],
            )
            if warn_error:
                failures.append(Failure("adversarial-adoption", f"shadow evidence `{label}` validation-only sample failed: {warn_error}"))
            elif expect_validation_warn and warn_payload.get("result") != "warn":
                failures.append(Failure("adversarial-adoption", f"shadow evidence `{label}` must warn in validation-only mode"))
            if block_error:
                failures.append(Failure("adversarial-adoption", f"shadow evidence `{label}` blocking sample failed: {block_error}"))
            elif block_payload.get("result") != "block":
                failures.append(Failure("adversarial-adoption", f"shadow evidence `{label}` must block in blocking mode"))

        def remove_source_hash(target: Path) -> None:
            shadow_payload = load_json_file(target / ".loom/shadow/review-repo.json")
            if isinstance(shadow_payload, dict):
                shadow_payload.pop("source_sha256", None)
                write_json(target / ".loom/shadow/review-repo.json", shadow_payload)

        def partial_source_hash(target: Path) -> None:
            shadow_payload = load_json_file(target / ".loom/shadow/review-repo.json")
            if isinstance(shadow_payload, dict):
                shadow_payload["source_files"] = ["native/status/review.json", "host/guardian-review.json"]
                shadow_payload["source_sha256"] = {"native/status/review.json": sha256_file(target / "native/status/review.json")}
                write_json(target / ".loom/shadow/review-repo.json", shadow_payload)

        def drift_source_hash(target: Path) -> None:
            shadow_payload = load_json_file(target / ".loom/shadow/review-repo.json")
            if isinstance(shadow_payload, dict):
                shadow_payload["source_sha256"] = {"native/status/review.json": "0" * 64}
                write_json(target / ".loom/shadow/review-repo.json", shadow_payload)

        def undeclared_shadow_evidence(target: Path) -> None:
            write_json(
                target / ".loom/shadow/rogue.json",
                {
                    "result": "pass",
                    "source_files": ["native/status/review.json"],
                    "source_sha256": {"native/status/review.json": sha256_file(target / "native/status/review.json")},
                },
            )

        assert_broken_shadow_evidence("missing-hash", remove_source_hash)
        assert_broken_shadow_evidence("partial-hash", partial_source_hash)
        assert_broken_shadow_evidence("hash-drift", drift_source_hash)
        assert_broken_shadow_evidence("undeclared", undeclared_shadow_evidence, expect_validation_warn=False)

        review_shadow_target = base / "review-shadow-carrier"
        shutil.copytree(baseline, review_shadow_target)
        reviewed_head = run_command(root, ["git", "rev-parse", "HEAD"], cwd=review_shadow_target, timeout_seconds=30).stdout.strip()
        review_path = ".loom/reviews/INIT-0001.json"
        review_payload = load_json_file(review_shadow_target / review_path)
        if isinstance(review_payload, dict):
            review_payload["summary"] = "Carrier-only review artifact refresh."
            write_json(review_shadow_target / review_path, review_payload)
            write_json(
                review_shadow_target / ".loom/shadow/review-loom.json",
                {
                    "decision": "allow",
                    "source_files": [review_path],
                    "source_sha256": {review_path: sha256_file(review_shadow_target / review_path)},
                },
            )
            write_json(
                review_shadow_target / ".loom/shadow/review-repo.json",
                {
                    "decision": "allow",
                    "source_files": ["native/status/review.json"],
                    "source_sha256": {"native/status/review.json": sha256_file(review_shadow_target / "native/status/review.json")},
                },
            )
            run_command(
                root,
                ["git", "add", "-f", review_path, ".loom/shadow/review-loom.json", ".loom/shadow/review-repo.json"],
                cwd=review_shadow_target,
                timeout_seconds=30,
            )
            run_command(root, ["git", "commit", "-m", "refresh review carrier evidence"], cwd=review_shadow_target, timeout_seconds=30)
            carrier_context = {
                "target_root": review_shadow_target,
                "report": {
                    "fact_chain": {
                        "entry_points": {
                            "recovery_entry": ".loom/progress/INIT-0001.md",
                            "status_surface": ".loom/status/current.md",
                        }
                    }
                },
            }
            binding_payload, binding_errors = review_head_binding(
                review_shadow_target,
                reviewed_head=reviewed_head,
                allowed_paths=allowed_post_review_carrier_paths(carrier_context, review_path),
            )
            if binding_errors or binding_payload.get("status") != "carrier-only":
                failures.append(Failure("adversarial-adoption", "review shadow evidence tied to a review artifact must be carrier-only after review refresh"))
        else:
            failures.append(Failure("adversarial-adoption", "review shadow carrier fixture could not load review artifact"))

        unreadable_review_shadow_target = base / "unreadable-review-shadow"
        shutil.copytree(baseline, unreadable_review_shadow_target)
        (unreadable_review_shadow_target / ".loom/shadow/review-repo.json").write_text("{not-json", encoding="utf-8")
        run_command(
            root,
            ["git", "add", "-f", ".loom/shadow/review-repo.json"],
            cwd=unreadable_review_shadow_target,
            timeout_seconds=30,
        )
        run_command(
            root,
            ["git", "commit", "-m", "corrupt review shadow evidence"],
            cwd=unreadable_review_shadow_target,
            timeout_seconds=30,
        )
        unreadable_payload, unreadable_error = load_command_json(
            root,
            [
                "python3",
                str(unreadable_review_shadow_target / ".loom/bin/loom_flow.py"),
                "checkpoint",
                "merge",
                "--target",
                str(unreadable_review_shadow_target),
                "--item",
                "INIT-0001",
            ],
        )
        if unreadable_error:
            failures.append(Failure("adversarial-adoption", f"unreadable review shadow evidence must fail closed without crashing: {unreadable_error}"))
        elif unreadable_payload.get("result") == "pass":
            failures.append(Failure("adversarial-adoption", "unreadable review shadow evidence must fail closed instead of passing"))

        invalid_review_schema_target = base / "invalid-review-schema"
        shutil.copytree(baseline, invalid_review_schema_target)
        invalid_review_payload = load_json_file(invalid_review_schema_target / review_path)
        if isinstance(invalid_review_payload, dict):
            invalid_review_payload["schema_version"] = "loom-review/v0"
            write_json(invalid_review_schema_target / review_path, invalid_review_payload)
            _, _, invalid_review_errors = loom_flow_module.load_review_record(
                invalid_review_schema_target,
                "INIT-0001",
                review_path,
            )
            if not any("schema_version must be `loom-review/v1`" in error for error in invalid_review_errors):
                failures.append(Failure("adversarial-adoption", "review artifact schema_version must be enforced before runtime consumption"))
        else:
            failures.append(Failure("adversarial-adoption", "invalid review schema fixture could not load review artifact"))

        head_before_drift = run_command(root, ["git", "rev-parse", "HEAD"], cwd=baseline, timeout_seconds=30).stdout.strip()
        (baseline / "implementation-drift.txt").write_text("changed after review\n", encoding="utf-8")
        run_command(root, ["git", "add", "implementation-drift.txt"], cwd=baseline, timeout_seconds=30)
        run_command(root, ["git", "commit", "-m", "implementation drift after review"], cwd=baseline, timeout_seconds=30)
        binding_payload, binding_errors = review_head_binding(
            baseline,
            reviewed_head=head_before_drift,
            allowed_paths=set(),
        )
        if not binding_errors or binding_payload.get("status") != "implementation-drift-only":
            failures.append(Failure("adversarial-adoption", "review head binding must classify implementation drift after review"))
        drift_refresh_payload, drift_refresh_error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "carrier", "refresh", "--target", str(baseline), "--dry-run"],
        )
        if drift_refresh_error:
            failures.append(Failure("adversarial-adoption", f"carrier refresh implementation-drift sample failed: {drift_refresh_error}"))
        elif drift_refresh_payload.get("result") != "block":
            failures.append(Failure("adversarial-adoption", "carrier refresh must block implementation drift instead of refreshing review metadata"))

    return failures


def check_node_installer(root: Path) -> list[Failure]:
    category = "node-installer"
    failures: list[Failure] = []
    package_root = root / "packages/loom-installer"
    if not package_root.exists():
        return [Failure(category, "missing `packages/loom-installer`")]
    npm_bin = shutil.which("npm")
    if not npm_bin:
        return [Failure(category, "`npm` is required to validate the Node installer")]

    commands = (
        ["npm", "ci"],
        ["npm", "test"],
        ["npm", "pack", "--dry-run"],
    )
    with tempfile.TemporaryDirectory(prefix="loom-check-npm-cache-") as cache_dir:
        npm_env = {
            "npm_config_cache": cache_dir,
            "NPM_CONFIG_CACHE": cache_dir,
        }
        for args in commands:
            try:
                result = run_command(root, args, cwd=package_root, env=npm_env, timeout_seconds=300)
            except subprocess.TimeoutExpired:
                failures.append(Failure(category, f"`{' '.join(args)}` timed out"))
                continue
            if result.returncode != 0:
                detail = result.stderr.strip() or result.stdout.strip() or "command failed without output"
                failures.append(Failure(category, f"`{' '.join(args)}` failed: {detail}"))
    return failures


def check_generated_artifacts_untracked(root: Path) -> list[Failure]:
    if not (root / ".git").exists():
        return []
    result = run_command(
        root,
        ["git", "ls-files", *GENERATED_TRACKED_PATHS],
        timeout_seconds=30,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git ls-files failed"
        return [Failure("generated-artifacts", detail)]
    tracked = [line for line in result.stdout.splitlines() if line.strip()]
    if not tracked:
        return []
    preview = ", ".join(tracked[:8])
    suffix = "" if len(tracked) <= 8 else f", ... (+{len(tracked) - 8} more)"
    return [
        Failure(
            "generated-artifacts",
            f"generated payload paths must not be tracked: {preview}{suffix}",
        )
    ]


def check_github_cli_budget(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    forbidden = tuple(f"gh {kind} view" for kind in ("repo", "issue", "pr"))
    search_roots = [root / "skills/shared/scripts", root / "tools"]
    for search_root in search_roots:
        if not search_root.exists():
            continue
        for path in search_root.rglob("*.py"):
            if path.name == "loom_check.py":
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except OSError:
                continue
            for needle in forbidden:
                if needle in text:
                    failures.append(
                        Failure(
                            "github-api-budget",
                            f"`{needle}` must not be used in high-frequency implementation path `{path.relative_to(root)}`",
                        )
                    )
    return failures


def check_operating_layer_contract(root: Path) -> list[Failure]:
    required_anchors = {
        "README.md": [
            "agent-first project operating layer",
            "behavior evidence",
            "test evidence",
            "trunk truth",
        ],
        "README.zh-CN.md": [
            "agent-first project operating layer",
            "行为证据",
            "测试证据",
            "主干真相",
        ],
        "VISION.md": [
            "agent-first project operating layer",
            "Behavior and Test Evidence",
            "BDD/TDD",
        ],
        "AGENTS.md": [
            "agent-first project operating layer",
            "behavior and test evidence",
            "外部方法论来源",
            "不得新增来源专属文档树",
        ],
        "docs/evidence/extraction-ledger.md": [
            "EXT-0057",
            "Superpowers-derived execution discipline",
            "EXT-0058",
            "dual evidence loop",
        ],
        "docs/evidence/landing-map.md": [
            "behavior and test evidence",
            "Superpowers-derived discipline",
            "不新增 `docs/superpowers/*`",
        ],
        "docs/methodology/templates/spec-suite.md": [
            "BDD 外环",
            "TDD 内环",
            "behavior evidence",
            "test evidence",
            "fresh verification evidence",
        ],
        "skills/shared/references/templates/spec-suite.md": [
            "BDD 外环",
            "TDD 内环",
            "behavior evidence",
            "test evidence",
            "fresh verification evidence",
        ],
        "docs/methodology/harness/status-surface.md": [
            "behavior evidence",
            "test evidence",
            "fresh verification evidence",
            "stale",
            "not_applicable",
        ],
        "skills/shared/references/harness/status-surface.md": [
            "behavior evidence",
            "test evidence",
            "fresh verification evidence",
            "stale",
            "not_applicable",
        ],
        "docs/methodology/harness/review-execution.md": [
            "review_instruction_locators",
            "disposition.status",
            "repeated blocker",
            "subagent",
        ],
        "skills/shared/references/harness/review-execution.md": [
            "review_instruction_locators",
            "disposition.status",
            "repeated blocker",
            "subagent",
        ],
        "docs/adoption/repo-companion-contract.md": [
            "review_instruction_locators",
            "spec_review",
            "implementation_review",
            "repo_declared | loom_default",
            "不得把 `spec_review.md`、`code_review.md` 或任何 repo-specific review instruction 路径硬编码",
        ],
        "docs/adoption/repo-interop-contract.md": [
            "review instruction locator",
            "repo-interface.json",
            "review_instruction_locators",
        ],
    }
    failures: list[Failure] = []
    for relative, anchors in required_anchors.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("operating-layer-contract", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("operating-layer-contract", f"`{relative}` must mention `{anchor}`"))

    forbidden_paths = [path for path in (root / "docs").rglob("*") if "superpowers" in path.parts]
    if forbidden_paths:
        preview = ", ".join(str(path.relative_to(root)) for path in forbidden_paths[:4])
        failures.append(Failure("operating-layer-contract", f"`docs/superpowers/*` must not be introduced: {preview}"))

    return failures


def check_orchestration_conformance_profiles(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    required_anchors = {
        "docs/evidence/orchestration-conformance-profiles.md": [
            "orchestration-core",
            "orchestration-extension",
            "orchestration-live",
            "non-blocking by default",
            "不得替代 governance maturity profile",
            "Core 缺口必须 fail closed",
            "Extension 缺口不得污染 `orchestration-core` pass/fail",
            "explicit skip / unavailable evidence",
        ],
    }
    for relative, anchors in required_anchors.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("orchestration-conformance", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("orchestration-conformance", f"`{relative}` must mention `{anchor}`"))

    return failures


def check_live_smoke_foundation_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    docs = {
        "docs/evidence/live-smoke-profile.md": [
            "loom-live-smoke/v1",
            "versioned prior-pass evidence",
            "explicit unavailable evidence",
            "validation-only",
            "shadow-parity --blocking",
        ],
        "docs/evidence/v0.10.0-release-readiness.md": [
            "orchestration-core",
            "orchestration-live",
            "confidence input",
            "profile-local failure",
            "blocking opt-in",
        ],
        "docs/evidence/validations/validation-v0.10-live-smoke-foundation.md": [
            "live-smoke run",
            "live-smoke replay",
            "unavailable evidence",
            "versioned prior-pass evidence",
            "validation-only / confidence-input",
        ],
    }
    for relative, anchors in docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("live-smoke-foundation", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("live-smoke-foundation", f"`{relative}` must mention `{anchor}`"))

    unavailable_payload = {
        "command": "live-smoke",
        "operation": "run",
        "schema_version": "loom-live-smoke/v1",
        "result": "warn",
        "summary": "live smoke recorded explicit unavailable evidence for the adopted-repo target.",
        "missing_inputs": ["adopted repo target is unavailable: /tmp/missing-live-target"],
        "fallback_to": "live-smoke-retry-or-record-unavailable",
        "runtime_state": {
            "result": "pass",
            "summary": "runtime carrier `repo-local-wrapper` is executing as `repo-local-demo` with a consistent bundled runtime.",
            "missing_inputs": [],
            "fallback_to": None,
            "scene": "repo-local-demo",
            "carrier": "repo-local-wrapper",
            "entry_family": "loom-flow",
            "install_root": "/tmp/install-root",
            "runtime_root": "/tmp/runtime-root",
            "registry_path": "/tmp/registry.json",
            "layout_or_manifest_path": "/tmp/install-layout.json",
            "source_repo_root": "/tmp/source-repo",
            "target_root": "/tmp/missing-live-target",
            "checks": {
                "scene_marker": {"status": "pass", "summary": "scene marker is consistent."},
                "carrier_layout": {"status": "pass", "summary": "carrier layout is readable.", "evidence": {"install_root": "/tmp/install-root"}},
                "registry_contract": {"status": "pass", "summary": "registry contract is readable.", "evidence": {"path": "/tmp/registry.json"}},
                "shared_runtime": {"status": "pass", "summary": "shared runtime is readable.", "evidence": {"path": "/tmp/runtime-root"}},
                "referenced_resources": {"status": "pass", "summary": "referenced resources are present."},
            },
        },
        "target": {
            "path": "/tmp/missing-live-target",
            "exists": False,
            "worktree": "/tmp/missing-live-target",
            "git_branch": None,
            "head_sha": None,
        },
        "command_plan": [
            {"id": "target-check", "command": "test -d /tmp/missing-live-target", "description": "Confirm the adopted-repo target path exists before running live smoke checks."},
            {"id": "governance-profile-status", "command": "python3 tools/loom_flow.py governance-profile status --target /tmp/missing-live-target", "description": "Read the adopted repo governance maturity surface."},
        ],
        "reports": [
            {
                "id": "target-check",
                "attempted": True,
                "command": "test -d /tmp/missing-live-target",
                "reported_command": "target-check",
                "reported_result": "unavailable",
                "result": "warn",
                "summary": "adopted-repo target root is unavailable.",
                "missing_inputs": ["adopted repo target is unavailable: /tmp/missing-live-target"],
                "fallback_to": "live-smoke-retry-or-record-unavailable",
            }
        ],
        "live_smoke": {
            "status": "unavailable",
            "executed_at": "2026-05-09T00:00:00Z",
            "release_interpretation": "explicit unavailable evidence is a non-blocking confidence input and does not silently pass.",
        },
    }
    require_live_smoke_payload(
        failures,
        category="live-smoke-foundation",
        context="unavailable-live-smoke",
        payload=unavailable_payload,
        expected_operation="run",
    )

    replay_payload = {
        "command": "live-smoke",
        "operation": "replay",
        "schema_version": "loom-live-smoke/v1",
        "result": "pass",
        "summary": "versioned prior-pass live smoke evidence was replayed.",
        "missing_inputs": [],
        "fallback_to": None,
        "runtime_state": unavailable_payload["runtime_state"],
        "command_plan": [
            {"id": "prior-evidence-read", "command": "python3 tools/loom_flow.py live-smoke replay --prior-evidence docs/evidence/validations/validation-v0.7-live-orchestration-smoke.md", "description": "Replay versioned prior-pass evidence without rerunning adopted-repo commands."}
        ],
        "reports": [
            {
                "id": "prior-evidence",
                "attempted": False,
                "command": "read docs/evidence/validations/validation-v0.7-live-orchestration-smoke.md",
                "reported_command": "prior-evidence",
                "reported_result": "versioned-prior-pass",
                "result": "pass",
                "summary": "versioned prior-pass live smoke evidence was replayed without rerunning adopted-repo commands.",
                "missing_inputs": [],
                "fallback_to": None,
            }
        ],
        "live_smoke": {
            "status": "replayed",
            "executed_at": "2026-05-09T00:00:00Z",
            "release_interpretation": "versioned prior-pass evidence can be consumed as release confidence input without rerunning adopted-repo commands.",
        },
        "prior_evidence": {
            "path": "docs/evidence/validations/validation-v0.7-live-orchestration-smoke.md",
            "status": "versioned-prior-pass",
            "target_family": "Syvert-style strong governance adopted repo",
            "smoke_branch": "chore/loom-phase-d-smoke-companion",
            "smoke_commit": "9a7b2923b6ab39631d8a3eafc1be8e5090709b9d",
            "smoke_worktree": "/Users/mc/dev/syvert-loom-phase-d-smoke",
            "commands": [
                "test -d /Users/mc/dev/syvert-loom-phase-d-smoke",
                "python3 <loom_repo_root>/tools/loom_flow.py governance-profile status --target /Users/mc/dev/syvert-loom-phase-d-smoke",
            ],
        },
    }
    require_live_smoke_payload(
        failures,
        category="live-smoke-foundation",
        context="replayed-live-smoke",
        payload=replay_payload,
        expected_operation="replay",
    )
    return failures


def check_host_adapter_live_drift_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []

    def write_json_local(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def install_interop_local(target: Path, *, interop: dict[str, object]) -> None:
        companion_dir = target / ".loom" / "companion"
        companion_dir.mkdir(parents=True, exist_ok=True)
        write_json_local(companion_dir / "interop.json", interop)

    docs = {
        "docs/adoption/repo-interop-contract.md": [
            "live-smoke host-adapter-drift",
            "host_adapter_version",
            "permission_unavailable",
            "profile-local evidence",
        ],
        "docs/methodology/harness/host-action-contract.md": [
            "live-smoke host-adapter-drift",
            "profile-local drift evidence",
            "不是新的 host-facing action",
        ],
        "docs/evidence/live-smoke-profile.md": [
            "loom-host-adapter-live-drift/v1",
            "host-adapter-drift",
            "version_drift",
            "permission_unavailable",
        ],
        "docs/evidence/validations/validation-v0.10-host-adapter-live-drift.md": [
            "loom-host-adapter-live-drift/v1",
            "examples/new-project",
            "profile-local `warn`",
            "python3 tools/host_adapter_check.py",
        ],
    }
    for relative, anchors in docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("host-adapter-live-drift", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("host-adapter-live-drift", f"`{relative}` must mention `{anchor}`"))

    expected_version = "1.0.0"

    absent_payload = {
        "command": "live-smoke",
        "operation": "host-adapter-drift",
        "schema_version": "loom-host-adapter-live-drift/v1",
        "result": "warn",
        "summary": "repo interop contract is absent, so no host adapter retained result can be consumed.",
        "missing_inputs": ["repo interop contract is absent"],
        "fallback_to": "live-smoke-retry-or-record-unavailable",
        "runtime_state": {
            "result": "pass",
            "summary": "runtime carrier `repo-local-wrapper` is executing as `repo-local-demo` with a consistent bundled runtime.",
            "missing_inputs": [],
            "fallback_to": None,
            "scene": "repo-local-demo",
            "carrier": "repo-local-wrapper",
            "entry_family": "loom-flow",
            "install_root": "/tmp/install-root",
            "runtime_root": "/tmp/runtime-root",
            "registry_path": "/tmp/registry.json",
            "layout_or_manifest_path": "/tmp/install-layout.json",
            "source_repo_root": "/tmp/source-repo",
            "target_root": "/tmp/absent-live-target",
            "checks": {
                "scene_marker": {"status": "pass", "summary": "scene marker is consistent."},
                "carrier_layout": {"status": "pass", "summary": "carrier layout is readable.", "evidence": {"install_root": "/tmp/install-root"}},
                "registry_contract": {"status": "pass", "summary": "registry contract is readable.", "evidence": {"path": "/tmp/registry.json"}},
                "shared_runtime": {"status": "pass", "summary": "shared runtime is readable.", "evidence": {"path": "/tmp/runtime-root"}},
                "referenced_resources": {"status": "pass", "summary": "referenced resources are present."},
            },
        },
        "target": {
            "path": "/tmp/absent-live-target",
            "exists": True,
            "worktree": "/tmp/absent-live-target",
            "git_branch": "main",
            "head_sha": "deadbeef",
        },
        "command_plan": [
            {"id": "target-check", "command": "test -d /tmp/absent-live-target", "description": "Confirm the adopted-repo target path exists before reading host adapter retained result locators."},
            {"id": "repo-interop-contract", "command": "read /tmp/absent-live-target/.loom/companion/interop.json", "description": "Read the repo interop contract and discover declared host adapter retained result locators."},
        ],
        "reports": [
            {
                "id": "target-check",
                "attempted": True,
                "command": "test -d /tmp/absent-live-target",
                "reported_command": "target-check",
                "reported_result": "pass",
                "result": "pass",
                "summary": "adopted-repo target root exists.",
                "missing_inputs": [],
                "fallback_to": None,
            },
            {
                "id": "repo-interop-contract",
                "attempted": True,
                "command": "read /tmp/absent-live-target/.loom/companion/interop.json",
                "reported_command": "repo-interop-contract",
                "reported_result": "absent",
                "result": "warn",
                "summary": "repo interop contract is absent, so no host adapter retained result can be consumed.",
                "missing_inputs": ["repo interop contract is absent"],
                "fallback_to": "live-smoke-retry-or-record-unavailable",
            },
        ],
        "profile_check": {"id": "host-adapter-live-drift", "result": "warn"},
        "host_adapter_drift": {
            "contract_locator": ".loom/companion/interop.json",
            "availability": "absent",
            "expected_host_adapter_version": expected_version,
            "checks": [],
        },
    }
    require_host_adapter_live_drift_payload(
        failures,
        category="host-adapter-live-drift",
        context="absent-host-adapter-live-drift",
        payload=absent_payload,
    )

    permission_payload = json.loads(json.dumps(absent_payload))
    permission_payload.update(
        {
            "result": "block",
            "summary": "host adapter live drift found blocking retained result declaration or readability gaps.",
            "missing_inputs": ["host adapter `guardian-review` reported permission_unavailable"],
            "fallback_to": "live-smoke-config-repair",
            "reports": [
                absent_payload["reports"][0],
                {
                    "id": "guardian-review",
                    "attempted": True,
                    "command": "read host/guardian-review.json",
                    "reported_command": "host-adapter-retained-result",
                    "reported_result": "permission_unavailable",
                    "result": "block",
                    "summary": "host adapter requires additional permission before its retained result can be read.",
                    "missing_inputs": ["host adapter `guardian-review` reported permission_unavailable"],
                    "fallback_to": "build",
                },
            ],
            "profile_check": {"id": "host-adapter-live-drift", "result": "block"},
            "host_adapter_drift": {
                "contract_locator": ".loom/companion/interop.json",
                "availability": "present",
                "expected_host_adapter_version": expected_version,
                "checks": [
                    {
                        "id": "guardian-review",
                        "owner": "host-adapter",
                        "requirement": "required",
                        "surfaces": ["review", "merge_ready"],
                        "locator": "host/guardian-review.json",
                        "result": "block",
                        "classification": "permission_unavailable",
                        "summary": "host adapter requires additional permission before its retained result can be read.",
                        "missing_inputs": ["host adapter `guardian-review` reported permission_unavailable"],
                        "fallback_to": "build",
                        "evidence": {
                            "locator_status": "readable",
                            "envelope_status": "permission_unavailable",
                            "declared_host_adapter_version": expected_version,
                            "expected_host_adapter_version": expected_version,
                        },
                    }
                ],
            },
        }
    )
    require_host_adapter_live_drift_payload(
        failures,
        category="host-adapter-live-drift",
        context="permission-unavailable-host-adapter-live-drift",
        payload=permission_payload,
    )

    example_target = root / "examples/new-project"
    absent_target = Path(tempfile.mkdtemp(prefix="loom-host-adapter-live-drift-absent-"))
    shutil.rmtree(absent_target)
    shutil.copytree(example_target, absent_target)
    (absent_target / ".loom" / "companion" / "interop.json").unlink(missing_ok=True)
    payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "live-smoke", "host-adapter-drift", "--target", str(absent_target)])
    if error:
        failures.append(Failure("host-adapter-live-drift", f"`host-adapter-drift` absent sample failed: {error}"))
    else:
        require_host_adapter_live_drift_payload(
            failures,
            category="host-adapter-live-drift",
            context="absent-host-adapter-live-drift-command",
            payload=payload,
        )
        if not isinstance(payload, dict) or payload.get("result") != "warn":
            failures.append(Failure("host-adapter-live-drift", "absent host adapter live drift sample must warn"))

    with tempfile.TemporaryDirectory(prefix="loom-host-adapter-live-drift-") as tmp:
        base = Path(tmp)
        valid_interop = {
            "schema_version": "loom-repo-interop/v1",
            "host_adapters": [
                {
                    "id": "guardian-review",
                    "summary": "Read guardian review verdicts without reimplementing the host action.",
                    "surfaces": ["review", "merge_ready"],
                    "locator": "host/guardian-review.json",
                    "owner": "host-adapter",
                    "requirement": "required",
                    "fallback_to": "build",
                }
            ],
            "repo_native_carriers": [],
            "shadow_surfaces": {
                "admission": {"summary": "Compare admission parity.", "loom_locator": ".loom/shadow/admission-loom.json", "repo_locator": ".loom/shadow/admission-repo.json"},
                "review": {"summary": "Compare review parity.", "loom_locator": ".loom/shadow/review-loom.json", "repo_locator": ".loom/shadow/review-repo.json"},
                "merge_ready": {"summary": "Compare merge-ready parity.", "loom_locator": ".loom/shadow/merge-ready-loom.json", "repo_locator": ".loom/shadow/merge-ready-repo.json"},
                "closeout": {"summary": "Compare closeout parity.", "loom_locator": ".loom/shadow/closeout-loom.json", "repo_locator": ".loom/shadow/closeout-repo.json"},
            },
        }

        present_target = base / "present"
        shutil.copytree(example_target, present_target)
        install_interop_local(present_target, interop=valid_interop)
        write_json_local(
            present_target / "host" / "guardian-review.json",
            {
                "summary": "guardian review verdict is readable.",
                "status": "pass",
                "host_adapter_version": expected_version,
            },
        )
        present_payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "live-smoke", "host-adapter-drift", "--target", str(present_target)])
        if error:
            failures.append(Failure("host-adapter-live-drift", f"`host-adapter-drift` present sample failed: {error}"))
        else:
            require_host_adapter_live_drift_payload(
                failures,
                category="host-adapter-live-drift",
                context="present-host-adapter-live-drift-command",
                payload=present_payload,
            )
            if not isinstance(present_payload, dict) or present_payload.get("result") != "pass":
                failures.append(Failure("host-adapter-live-drift", "present host adapter live drift sample must pass"))

        missing_target = base / "missing"
        shutil.copytree(example_target, missing_target)
        install_interop_local(missing_target, interop=valid_interop)
        missing_payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "live-smoke", "host-adapter-drift", "--target", str(missing_target)])
        if error:
            failures.append(Failure("host-adapter-live-drift", f"`host-adapter-drift` missing sample failed: {error}"))
        elif not isinstance(missing_payload, dict) or missing_payload.get("result") != "block":
            failures.append(Failure("host-adapter-live-drift", "required missing host adapter locator must block"))

        optional_target = base / "optional"
        shutil.copytree(example_target, optional_target)
        optional_interop = json.loads(json.dumps(valid_interop))
        optional_interop["host_adapters"][0]["requirement"] = "optional"
        install_interop_local(optional_target, interop=optional_interop)
        optional_payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "live-smoke", "host-adapter-drift", "--target", str(optional_target)])
        if error:
            failures.append(Failure("host-adapter-live-drift", f"`host-adapter-drift` optional sample failed: {error}"))
        elif not isinstance(optional_payload, dict) or optional_payload.get("result") != "warn":
            failures.append(Failure("host-adapter-live-drift", "optional missing host adapter locator must warn"))

        unsafe_target = base / "unsafe"
        shutil.copytree(example_target, unsafe_target)
        unsafe_interop = json.loads(json.dumps(valid_interop))
        unsafe_interop["host_adapters"][0]["locator"] = "../outside-host.json"
        install_interop_local(unsafe_target, interop=unsafe_interop)
        unsafe_payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "live-smoke", "host-adapter-drift", "--target", str(unsafe_target)])
        if error:
            failures.append(Failure("host-adapter-live-drift", f"`host-adapter-drift` unsafe sample failed: {error}"))
        elif not isinstance(unsafe_payload, dict) or unsafe_payload.get("result") != "block":
            failures.append(Failure("host-adapter-live-drift", "unsafe host adapter locator must block"))

        version_target = base / "version-drift"
        shutil.copytree(example_target, version_target)
        install_interop_local(version_target, interop=valid_interop)
        write_json_local(
            version_target / "host" / "guardian-review.json",
            {
                "summary": "guardian review verdict came from an older host adapter version.",
                "status": "pass",
                "host_adapter_version": "9.9.9",
            },
        )
        version_payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "live-smoke", "host-adapter-drift", "--target", str(version_target)])
        if error:
            failures.append(Failure("host-adapter-live-drift", f"`host-adapter-drift` version drift sample failed: {error}"))
        elif not isinstance(version_payload, dict) or version_payload.get("result") != "warn":
            failures.append(Failure("host-adapter-live-drift", "host adapter version drift sample must warn"))

        permission_target = base / "permission"
        shutil.copytree(example_target, permission_target)
        install_interop_local(permission_target, interop=valid_interop)
        write_json_local(
            permission_target / "host" / "guardian-review.json",
            {
                "summary": "host adapter requires additional permission before its retained result can be read.",
                "status": "permission_unavailable",
                "host_adapter_version": expected_version,
            },
        )
        permission_command_payload, error = load_command_json(root, ["python3", "tools/loom_flow.py", "live-smoke", "host-adapter-drift", "--target", str(permission_target)])
        if error:
            failures.append(Failure("host-adapter-live-drift", f"`host-adapter-drift` permission sample failed: {error}"))
        elif not isinstance(permission_command_payload, dict) or permission_command_payload.get("result") != "block":
            failures.append(Failure("host-adapter-live-drift", "required permission unavailable sample must block"))

    return failures


def check_dynamic_tool_live_availability_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []

    def write_json_local(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def install_companion_local(target: Path, *, repo_interface: dict[str, object]) -> None:
        companion_dir = target / ".loom" / "companion"
        companion_dir.mkdir(parents=True, exist_ok=True)
        (companion_dir / "README.md").write_text("# Repo Companion\n", encoding="utf-8")
        write_json_local(
            companion_dir / "manifest.json",
            {
                "schema_version": "loom-repo-companion-manifest/v1",
                "companion_entry": ".loom/companion/README.md",
                "repo_interface": ".loom/companion/repo-interface.json",
            },
        )
        write_json_local(companion_dir / "repo-interface.json", repo_interface)

    docs = {
        "docs/methodology/harness/dynamic-tool-handshake.md": [
            "dynamic-tool-availability",
            "live/profile-local evidence",
            "does not call the tool",
            "Top-level `result` remains `pass | warn | block`",
        ],
        "docs/adoption/repo-companion-contract.md": [
            "dynamic-tool-availability",
            "live smoke",
            "declaration-time locator",
            "attempt-time result",
        ],
        "docs/evidence/live-smoke-profile.md": [
            "loom-dynamic-tool-live-availability/v1",
            "dynamic-tool-availability",
            "optional/advisory",
            "does not execute the tool",
        ],
        "docs/evidence/validations/validation-v0.10-dynamic-tool-live-availability.md": [
            "loom-dynamic-tool-live-availability/v1",
            "dynamic-tool-availability",
            "profile-local `warn`",
            "tool-specific protocol",
        ],
    }
    for relative, anchors in docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("dynamic-tool-live-availability", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("dynamic-tool-live-availability", f"`{relative}` must mention `{anchor}`"))

    example_target = root / "examples/new-project"

    missing_target = Path("/tmp/loom-missing-live-target")
    payload, error = load_command_json(
        root,
        ["python3", "tools/loom_flow.py", "live-smoke", "dynamic-tool-availability", "--target", str(missing_target)],
    )
    if error:
        failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` missing target sample failed: {error}"))
    else:
        require_dynamic_tool_live_availability_payload(
            failures,
            category="dynamic-tool-live-availability",
            context="missing-target-dynamic-tool-live-availability",
            payload=payload,
        )
        if not isinstance(payload, dict) or payload.get("result") != "warn":
            failures.append(Failure("dynamic-tool-live-availability", "missing target sample must warn"))

    absent_target = Path(tempfile.mkdtemp(prefix="loom-dynamic-tool-live-availability-absent-"))
    shutil.rmtree(absent_target)
    shutil.copytree(example_target, absent_target)
    shutil.rmtree(absent_target / ".loom" / "companion", ignore_errors=True)
    absent_payload, error = load_command_json(
        root,
        ["python3", "tools/loom_flow.py", "live-smoke", "dynamic-tool-availability", "--target", str(absent_target)],
    )
    if error:
        failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` absent interface sample failed: {error}"))
    else:
        require_dynamic_tool_live_availability_payload(
            failures,
            category="dynamic-tool-live-availability",
            context="absent-interface-dynamic-tool-live-availability",
            payload=absent_payload,
        )
        if not isinstance(absent_payload, dict) or absent_payload.get("result") != "warn":
            failures.append(Failure("dynamic-tool-live-availability", "absent repo interface sample must warn"))

    valid_interface = {
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
    }

    with tempfile.TemporaryDirectory(prefix="loom-dynamic-tool-live-availability-") as tmp:
        base = Path(tmp)

        present_target = base / "present"
        shutil.copytree(example_target, present_target)
        install_companion_local(present_target, repo_interface=valid_interface)
        present_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "dynamic-tool-availability", "--target", str(present_target)],
        )
        if error:
            failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` present sample failed: {error}"))
        else:
            require_dynamic_tool_live_availability_payload(
                failures,
                category="dynamic-tool-live-availability",
                context="present-dynamic-tool-live-availability",
                payload=present_payload,
            )
            if not isinstance(present_payload, dict) or present_payload.get("result") != "pass":
                failures.append(Failure("dynamic-tool-live-availability", "no-tools present sample must pass"))

        required_target = base / "required-block"
        shutil.copytree(example_target, required_target)
        required_interface = json.loads(json.dumps(valid_interface))
        required_interface["dynamic_tool_locators"] = [
            {
                "id": "required-unsupported-tool",
                "summary": "Required tool reports unsupported.",
                "locator": ".loom/companion/tool-unsupported.json",
                "owner": "host-adapter",
                "requirement": "required",
                "surface": "merge_ready",
                "fallback_to": "merge",
            }
        ]
        install_companion_local(required_target, repo_interface=required_interface)
        write_json_local(
            required_target / ".loom" / "companion" / "tool-unsupported.json",
            {
                "schema_version": "loom-dynamic-tool-handshake/v1",
                "status": "unsupported",
                "summary": "Host adapter does not support this tool call.",
                "failure_category": "unsupported",
                "fallback_to": "merge",
                "evidence": {"status": "present"},
            },
        )
        required_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "dynamic-tool-availability",
                "--target",
                str(required_target),
                "--surface",
                "merge_ready",
            ],
        )
        if error:
            failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` required sample failed: {error}"))
        elif not isinstance(required_payload, dict) or required_payload.get("result") != "block":
            failures.append(Failure("dynamic-tool-live-availability", "required unsupported dynamic tool must block"))

        optional_target = base / "optional-warn"
        shutil.copytree(example_target, optional_target)
        optional_interface = json.loads(json.dumps(valid_interface))
        optional_interface["dynamic_tool_locators"] = [
            {
                "id": "optional-unavailable-tool",
                "summary": "Optional tool is unavailable in this runtime.",
                "locator": ".loom/companion/missing-tool.json",
                "owner": "host-adapter",
                "requirement": "optional",
                "surface": "review",
                "fallback_to": "build",
            }
        ]
        install_companion_local(optional_target, repo_interface=optional_interface)
        optional_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "dynamic-tool-availability",
                "--target",
                str(optional_target),
                "--surface",
                "review",
            ],
        )
        if error:
            failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` optional sample failed: {error}"))
        elif not isinstance(optional_payload, dict) or optional_payload.get("result") != "warn":
            failures.append(Failure("dynamic-tool-live-availability", "optional unavailable dynamic tool must warn"))

        advisory_target = base / "advisory-warn"
        shutil.copytree(example_target, advisory_target)
        advisory_interface = json.loads(json.dumps(valid_interface))
        advisory_interface["dynamic_tool_locators"] = [
            {
                "id": "advisory-failed-tool",
                "summary": "Advisory tool reports a failed handshake.",
                "locator": ".loom/companion/tool-failed.json",
                "owner": "external-tool",
                "requirement": "advisory",
                "surface": "attempt_time",
                "fallback_to": "build",
            }
        ]
        install_companion_local(advisory_target, repo_interface=advisory_interface)
        write_json_local(
            advisory_target / ".loom" / "companion" / "tool-failed.json",
            {
                "schema_version": "loom-dynamic-tool-handshake/v1",
                "status": "failed",
                "summary": "External tool handshake failed.",
                "failure_category": "failed",
                "fallback_to": "build",
                "evidence": {"status": "present"},
            },
        )
        advisory_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "dynamic-tool-availability", "--target", str(advisory_target)],
        )
        if error:
            failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` advisory sample failed: {error}"))
        elif not isinstance(advisory_payload, dict) or advisory_payload.get("result") != "warn":
            failures.append(Failure("dynamic-tool-live-availability", "advisory failed dynamic tool must warn"))

        unsafe_target = base / "unsafe"
        shutil.copytree(example_target, unsafe_target)
        unsafe_interface = json.loads(json.dumps(valid_interface))
        unsafe_interface["dynamic_tool_locators"] = [
            {
                "id": "unsafe-tool",
                "summary": "Unsafe locator must fail closed.",
                "locator": "../outside-tool.json",
                "owner": "repo-companion",
                "requirement": "required",
                "surface": "attempt_time",
                "fallback_to": "admission",
            }
        ]
        install_companion_local(unsafe_target, repo_interface=unsafe_interface)
        unsafe_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "dynamic-tool-availability", "--target", str(unsafe_target)],
        )
        if error:
            failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` unsafe sample failed: {error}"))
        elif not isinstance(unsafe_payload, dict) or unsafe_payload.get("result") != "block":
            failures.append(Failure("dynamic-tool-live-availability", "unsafe dynamic tool locator must block"))

        invalid_required_target = base / "invalid-required"
        shutil.copytree(example_target, invalid_required_target)
        invalid_required_interface = json.loads(json.dumps(valid_interface))
        invalid_required_interface["dynamic_tool_locators"] = [
            {
                "id": "invalid-required-tool",
                "summary": "Required tool has invalid handshake JSON.",
                "locator": ".loom/companion/tool-invalid.json",
                "owner": "host-adapter",
                "requirement": "required",
                "surface": "attempt_time",
                "fallback_to": "build",
            }
        ]
        install_companion_local(invalid_required_target, repo_interface=invalid_required_interface)
        (invalid_required_target / ".loom" / "companion" / "tool-invalid.json").write_text("{not-json}\n", encoding="utf-8")
        invalid_required_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "dynamic-tool-availability", "--target", str(invalid_required_target)],
        )
        if error:
            failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` invalid required sample failed: {error}"))
        elif not isinstance(invalid_required_payload, dict) or invalid_required_payload.get("result") != "block":
            failures.append(Failure("dynamic-tool-live-availability", "required invalid handshake sample must block"))

        invalid_optional_target = base / "invalid-optional"
        shutil.copytree(example_target, invalid_optional_target)
        invalid_optional_interface = json.loads(json.dumps(valid_interface))
        invalid_optional_interface["dynamic_tool_locators"] = [
            {
                "id": "invalid-optional-tool",
                "summary": "Optional tool has invalid handshake JSON.",
                "locator": ".loom/companion/tool-invalid.json",
                "owner": "host-adapter",
                "requirement": "optional",
                "surface": "attempt_time",
                "fallback_to": "build",
            }
        ]
        install_companion_local(invalid_optional_target, repo_interface=invalid_optional_interface)
        (invalid_optional_target / ".loom" / "companion" / "tool-invalid.json").write_text("{not-json}\n", encoding="utf-8")
        invalid_optional_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "dynamic-tool-availability", "--target", str(invalid_optional_target)],
        )
        if error:
            failures.append(Failure("dynamic-tool-live-availability", f"`dynamic-tool-availability` invalid optional sample failed: {error}"))
        elif not isinstance(invalid_optional_payload, dict) or invalid_optional_payload.get("result") != "warn":
            failures.append(Failure("dynamic-tool-live-availability", "optional invalid handshake sample must warn"))

    return failures


def check_hook_envelope_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []

    def write_json_local(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    docs = {
        "docs/methodology/harness/hook-envelope-contract.md": [
            "loom-hook-envelope/v1",
            "context_injection",
            "blocking_decision",
            "runtime_evidence",
            "permission_unavailable",
            "host_mapping_failed",
            "must not carry",
        ],
        "docs/methodology/harness/README.md": [
            "hook-envelope-contract.md",
            "context injection / blocking decision / runtime evidence",
        ],
    }
    for relative, anchors in docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("hook-envelope", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("hook-envelope", f"`{relative}` must mention `{anchor}`"))

    example_target = root / "examples/new-project"

    def valid_envelope(category: str) -> dict[str, object]:
        return {
            "schema_version": "loom-hook-envelope/v1",
            "hook": {
                "id": f"{category}-hook",
                "lifecycle": "before-run",
                "locator": ".loom/companion/hooks/before-run.md",
            },
            "input": {
                "item_locator": ".loom/items/WI-617.md",
                "workspace_locator": ".loom/workspaces/current.json",
                "attempt_locator": ".loom/runtime/attempts/attempt-1.json",
                "host_adapter_mapping": {
                    "host": "codex",
                    "event": "PreToolUse",
                    "adapter_result": "supported",
                },
            },
            "output": {
                "category": category,
                "summary": f"{category} output mapped into Loom envelope.",
                "evidence": {"mapped": True},
            },
        }

    with tempfile.TemporaryDirectory(prefix="loom-hook-envelope-") as tmp:
        base = Path(tmp)
        valid_target = base / "valid"
        shutil.copytree(example_target, valid_target)
        for category in ("context_injection", "blocking_decision", "runtime_evidence"):
            locator = f".loom/companion/hooks/{category}.json"
            write_json_local(valid_target / locator, valid_envelope(category))
            payload, error = load_command_json(
                root,
                [
                    "python3",
                    "tools/loom_flow.py",
                    "live-smoke",
                    "hook-envelope",
                    "--target",
                    str(valid_target),
                    "--envelope",
                    locator,
                ],
            )
            if error:
                failures.append(Failure("hook-envelope", f"`hook-envelope` valid {category} sample failed: {error}"))
            else:
                require_hook_envelope_live_check_payload(
                    failures,
                    category="hook-envelope",
                    context=f"valid-{category}-hook-envelope",
                    payload=payload,
                )
                if not isinstance(payload, dict) or payload.get("result") != "pass":
                    failures.append(Failure("hook-envelope", f"valid {category} hook envelope must pass"))

        missing_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(valid_target),
                "--envelope",
                ".loom/companion/hooks/missing-required.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` missing required sample failed: {error}"))
        elif not isinstance(missing_payload, dict) or missing_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "required missing hook envelope must block"))

        optional_missing_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(valid_target),
                "--envelope",
                ".loom/companion/hooks/missing-optional.json",
                "--requirement",
                "optional",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` missing optional sample failed: {error}"))
        elif not isinstance(optional_missing_payload, dict) or optional_missing_payload.get("result") != "warn":
            failures.append(Failure("hook-envelope", "optional missing hook envelope must warn"))

        invalid_category_target = base / "invalid-category"
        shutil.copytree(example_target, invalid_category_target)
        invalid_category = valid_envelope("runtime_evidence")
        invalid_category["output"] = {"category": "host_raw_output", "summary": "invalid category"}
        write_json_local(invalid_category_target / ".loom/companion/hooks/invalid-category.json", invalid_category)
        invalid_category_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(invalid_category_target),
                "--envelope",
                ".loom/companion/hooks/invalid-category.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` invalid category sample failed: {error}"))
        elif not isinstance(invalid_category_payload, dict) or invalid_category_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "invalid hook envelope category must block"))

        truth_target = base / "truth-pollution"
        shutil.copytree(example_target, truth_target)
        truth_polluting = valid_envelope("runtime_evidence")
        truth_polluting["output"] = {
            "category": "runtime_evidence",
            "summary": "truth pollution must fail",
            "authored_progress": "done",
        }
        write_json_local(truth_target / ".loom/companion/hooks/truth.json", truth_polluting)
        truth_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(truth_target),
                "--envelope",
                ".loom/companion/hooks/truth.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` truth pollution sample failed: {error}"))
        elif not isinstance(truth_payload, dict) or truth_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "hook envelope authored truth pollution must block"))

        status_truth_target = base / "status-truth-write"
        shutil.copytree(example_target, status_truth_target)
        status_truth_polluting = valid_envelope("runtime_evidence")
        status_truth_polluting["output"] = {
            "category": "runtime_evidence",
            "summary": "status authored field write must fail",
            "evidence": {
                "latest_validation_summary": "hook tried to author status truth",
            },
        }
        write_json_local(status_truth_target / ".loom/companion/hooks/status-truth.json", status_truth_polluting)
        status_truth_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(status_truth_target),
                "--envelope",
                ".loom/companion/hooks/status-truth.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` status authored field sample failed: {error}"))
        elif not isinstance(status_truth_payload, dict) or status_truth_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "hook envelope status authored field write must block"))

        cleanup_target = base / "cleanup-non-loom-owned"
        shutil.copytree(example_target, cleanup_target)
        cleanup_intent = valid_envelope("runtime_evidence")
        cleanup_intent["hook"]["lifecycle"] = "cleanup"
        cleanup_intent["output"] = {
            "category": "runtime_evidence",
            "summary": "cleanup intent must be constrained to Loom-owned residue.",
            "evidence": {
                "cleanup_targets": [
                    {
                        "locator": "README.md",
                        "ownership": "repo_owned",
                    }
                ],
            },
        }
        write_json_local(cleanup_target / ".loom/companion/hooks/cleanup-non-loom-owned.json", cleanup_intent)
        cleanup_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(cleanup_target),
                "--envelope",
                ".loom/companion/hooks/cleanup-non-loom-owned.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` cleanup non-Loom-owned sample failed: {error}"))
        elif not isinstance(cleanup_payload, dict) or cleanup_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "hook envelope non-Loom-owned cleanup intent must block"))

        permission_target = base / "permission"
        shutil.copytree(example_target, permission_target)
        permission_envelope = valid_envelope("blocking_decision")
        permission_envelope["failure"] = {
            "classification": "permission_unavailable",
            "summary": "host permission is unavailable after adapter mapping.",
            "fallback_to": "build",
        }
        write_json_local(permission_target / ".loom/companion/hooks/permission.json", permission_envelope)
        permission_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(permission_target),
                "--envelope",
                ".loom/companion/hooks/permission.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` permission sample failed: {error}"))
        elif not isinstance(permission_payload, dict) or permission_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "permission_unavailable hook envelope must block when required"))

        advisory_unsafe_target = base / "advisory-unsafe"
        shutil.copytree(example_target, advisory_unsafe_target)
        unsafe_envelope = valid_envelope("blocking_decision")
        unsafe_envelope["failure"] = {
            "classification": "unsafe",
            "summary": "host mapping reported unsafe.",
            "fallback_to": "manual_repair",
        }
        write_json_local(advisory_unsafe_target / ".loom/companion/hooks/unsafe.json", unsafe_envelope)
        advisory_unsafe_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(advisory_unsafe_target),
                "--envelope",
                ".loom/companion/hooks/unsafe.json",
                "--requirement",
                "advisory",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` advisory unsafe sample failed: {error}"))
        elif not isinstance(advisory_unsafe_payload, dict) or advisory_unsafe_payload.get("result") != "warn":
            failures.append(Failure("hook-envelope", "advisory unsafe hook envelope must warn"))

        host_private_target = base / "host-private-fallback"
        shutil.copytree(example_target, host_private_target)
        host_private = valid_envelope("blocking_decision")
        host_private["failure"] = {
            "classification": "unsupported",
            "summary": "fallback must not point to host-private action.",
            "fallback_to": "Codex SessionEnd",
        }
        write_json_local(host_private_target / ".loom/companion/hooks/host-private.json", host_private)
        host_private_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(host_private_target),
                "--envelope",
                ".loom/companion/hooks/host-private.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` host-private fallback sample failed: {error}"))
        elif not isinstance(host_private_payload, dict) or host_private_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "host-private fallback must block"))

        unsafe_mapping_target = base / "unsafe-adapter-mapping"
        shutil.copytree(example_target, unsafe_mapping_target)
        unsafe_mapping = valid_envelope("blocking_decision")
        unsafe_mapping["input"]["host_adapter_mapping"]["adapter_result"] = "unsafe"
        write_json_local(unsafe_mapping_target / ".loom/companion/hooks/unsafe-adapter.json", unsafe_mapping)
        unsafe_mapping_payload, error = load_command_json(
            root,
            [
                "python3",
                "tools/loom_flow.py",
                "live-smoke",
                "hook-envelope",
                "--target",
                str(unsafe_mapping_target),
                "--envelope",
                ".loom/companion/hooks/unsafe-adapter.json",
            ],
        )
        if error:
            failures.append(Failure("hook-envelope", f"`hook-envelope` unsafe adapter mapping sample failed: {error}"))
        elif not isinstance(unsafe_mapping_payload, dict) or unsafe_mapping_payload.get("result") != "block":
            failures.append(Failure("hook-envelope", "unsafe hook adapter mapping must block when required"))

    return failures


def check_hooks_extension_profile_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []

    def write_json_local(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def install_companion_local(target: Path, *, repo_interface: dict[str, object]) -> None:
        companion_dir = target / ".loom" / "companion"
        companion_dir.mkdir(parents=True, exist_ok=True)
        (companion_dir / "README.md").write_text("# Repo Companion\n", encoding="utf-8")
        write_json_local(
            companion_dir / "manifest.json",
            {
                "schema_version": "loom-repo-companion-manifest/v1",
                "companion_entry": ".loom/companion/README.md",
                "repo_interface": ".loom/companion/repo-interface.json",
            },
        )
        write_json_local(companion_dir / "repo-interface.json", repo_interface)

    docs = {
        "docs/evidence/orchestration-conformance-profiles.md": [
            "orchestration-extension/hooks",
            "not_applicable",
            "profile-local `warn`",
            "core profile remains pass",
        ],
        "docs/evidence/live-smoke-profile.md": [
            "loom-hooks-extension-profile/v1",
            "hooks-extension",
            "optional/advisory",
            "does not execute hooks",
        ],
        "docs/methodology/harness/hook-envelope-contract.md": [
            "hooks-extension",
            "profile-local evidence",
        ],
        "docs/methodology/harness/hook-locator-contract.md": [
            "orchestration-extension/hooks",
            "profile-local advisory evidence",
        ],
    }
    for relative, anchors in docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("hooks-extension-profile", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("hooks-extension-profile", f"`{relative}` must mention `{anchor}`"))

    example_target = root / "examples/new-project"
    absent_target = Path(tempfile.mkdtemp(prefix="loom-hooks-extension-absent-"))
    shutil.rmtree(absent_target)
    shutil.copytree(example_target, absent_target)
    shutil.rmtree(absent_target / ".loom" / "companion", ignore_errors=True)
    absent_payload, error = load_command_json(
        root,
        ["python3", "tools/loom_flow.py", "live-smoke", "hooks-extension", "--target", str(absent_target)],
    )
    if error:
        failures.append(Failure("hooks-extension-profile", f"`hooks-extension` absent interface sample failed: {error}"))
    else:
        require_hooks_extension_live_check_payload(
            failures,
            category="hooks-extension-profile",
            context="absent-hooks-extension",
            payload=absent_payload,
        )
        hooks_extension = absent_payload.get("hooks_extension") if isinstance(absent_payload, dict) else None
        if not isinstance(absent_payload, dict) or absent_payload.get("result") != "pass":
            failures.append(Failure("hooks-extension-profile", "absent hooks extension sample must pass"))
        elif not isinstance(hooks_extension, dict) or hooks_extension.get("status") != "not_applicable":
            failures.append(Failure("hooks-extension-profile", "absent hooks extension sample must be not_applicable"))

    valid_interface = {
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
        "hook_locators": [],
    }
    safe_hook = {
        "id": "before-run-context",
        "summary": "Read Loom context before a host run.",
        "lifecycle": "before-run",
        "locator": ".loom/companion/hooks/before-run.md",
        "owner": "host-adapter",
        "requirement": "required",
        "fallback_to": "build",
        "safety": {
            "path_containment": "repo_relative",
            "truth_boundary": "context_only",
            "cleanup_scope": "not_applicable",
            "host_trust": "trusted",
            "permission_risk": "none",
        },
    }

    with tempfile.TemporaryDirectory(prefix="loom-hooks-extension-") as tmp:
        base = Path(tmp)

        present_target = base / "present"
        shutil.copytree(example_target, present_target)
        present_interface = json.loads(json.dumps(valid_interface))
        present_interface["hook_locators"] = [safe_hook]
        install_companion_local(present_target, repo_interface=present_interface)
        (present_target / ".loom" / "companion" / "hooks").mkdir(parents=True, exist_ok=True)
        (present_target / ".loom" / "companion" / "hooks" / "before-run.md").write_text(
            "# Before Run\n",
            encoding="utf-8",
        )
        present_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "hooks-extension", "--target", str(present_target)],
        )
        if error:
            failures.append(Failure("hooks-extension-profile", f"`hooks-extension` present sample failed: {error}"))
        else:
            require_hooks_extension_live_check_payload(
                failures,
                category="hooks-extension-profile",
                context="present-hooks-extension",
                payload=present_payload,
            )
            if not isinstance(present_payload, dict) or present_payload.get("result") != "pass":
                failures.append(Failure("hooks-extension-profile", "safe hooks extension sample must pass"))

        optional_target = base / "optional-warn"
        shutil.copytree(example_target, optional_target)
        optional_hook = json.loads(json.dumps(safe_hook))
        optional_hook["id"] = "optional-after-run"
        optional_hook["lifecycle"] = "after-run"
        optional_hook["requirement"] = "optional"
        optional_hook["locator"] = ".loom/companion/hooks/missing-optional.md"
        optional_hook.pop("safety")
        optional_interface = json.loads(json.dumps(valid_interface))
        optional_interface["hook_locators"] = [optional_hook]
        install_companion_local(optional_target, repo_interface=optional_interface)
        optional_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "hooks-extension", "--target", str(optional_target)],
        )
        if error:
            failures.append(Failure("hooks-extension-profile", f"`hooks-extension` optional sample failed: {error}"))
        else:
            require_hooks_extension_live_check_payload(
                failures,
                category="hooks-extension-profile",
                context="optional-hooks-extension",
                payload=optional_payload,
            )
            core_profile = optional_payload.get("core_profile") if isinstance(optional_payload, dict) else None
            if not isinstance(optional_payload, dict) or optional_payload.get("result") != "warn":
                failures.append(Failure("hooks-extension-profile", "optional hooks extension gaps must warn"))
            elif not isinstance(core_profile, dict) or core_profile.get("result") != "pass":
                failures.append(Failure("hooks-extension-profile", "optional hooks extension gaps must not block core profile"))

        required_target = base / "required-block"
        shutil.copytree(example_target, required_target)
        required_hook = json.loads(json.dumps(safe_hook))
        required_hook["id"] = "required-unsafe"
        required_hook["safety"]["host_trust"] = "untrusted"
        required_interface = json.loads(json.dumps(valid_interface))
        required_interface["hook_locators"] = [required_hook]
        install_companion_local(required_target, repo_interface=required_interface)
        (required_target / ".loom" / "companion" / "hooks").mkdir(parents=True, exist_ok=True)
        (required_target / ".loom" / "companion" / "hooks" / "before-run.md").write_text(
            "# Before Run\n",
            encoding="utf-8",
        )
        required_payload, error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "live-smoke", "hooks-extension", "--target", str(required_target)],
        )
        if error:
            failures.append(Failure("hooks-extension-profile", f"`hooks-extension` required sample failed: {error}"))
        else:
            require_hooks_extension_live_check_payload(
                failures,
                category="hooks-extension-profile",
                context="required-hooks-extension",
                payload=required_payload,
            )
            core_profile = required_payload.get("core_profile") if isinstance(required_payload, dict) else None
            if not isinstance(required_payload, dict) or required_payload.get("result") != "block":
                failures.append(Failure("hooks-extension-profile", "required unsafe hook must block the hooks extension profile"))
            elif not isinstance(core_profile, dict) or core_profile.get("result") != "pass":
                failures.append(Failure("hooks-extension-profile", "required unsafe hook must not rewrite core profile result"))
        governance_surface = build_governance_surface(required_target)
        repo_interface = governance_surface.get("repo_interface")
        core_missing = repo_interface.get("missing_inputs", []) if isinstance(repo_interface, dict) else []
        if any("hook_locators" in str(message) for message in core_missing):
            failures.append(Failure("hooks-extension-profile", "hooks extension gaps must not pollute repo_interface core missing_inputs"))

    return failures


def check_live_validation_only_guardrail_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []

    def write_json_local(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def sha256_file_local(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def write_shadow_evidence_local(target: Path, evidence: str, value_key: str, value: str, source: str) -> None:
        source_path = target / source
        if not source_path.exists():
            write_json_local(source_path, {value_key: value})
        write_json_local(
            target / evidence,
            {
                value_key: value,
                "source_files": [source],
                "source_sha256": {source: sha256_file_local(source_path)},
            },
        )

    docs = {
        "docs/evidence/v0.10.0-release-readiness.md": [
            "validation-only shadow parity mismatch",
            "explicit blocking opt-in",
            "owner、fallback、override path、authority-of-truth 与 live evidence",
            "单个 adopted repo smoke",
        ],
        "docs/evidence/live-smoke-profile.md": [
            "--include-blocking-shadow",
            "not sufficient blocking-upgrade evidence on its own",
            "不得把 `orchestration-live` 提升为普通 PR 的默认 blocking gate",
        ],
        "docs/methodology/harness/closeout-gate.md": [
            "shadow parity` 默认不进入 closeout 阻断面",
            "owner、fallback、override path 与 authority-of-truth",
        ],
        "docs/evidence/validations/validation-v0.10-live-validation-only-guardrail.md": [
            "validation-only shadow parity mismatch returns `warn`",
            "explicit blocking opt-in",
            "single adopted repo live smoke run is not sufficient",
        ],
    }
    for relative, anchors in docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("live-validation-only-guardrail", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("live-validation-only-guardrail", f"`{relative}` must mention `{anchor}`"))

    missing_target = Path("/tmp/loom-missing-live-target")
    unavailable_payload, error = load_command_json(
        root,
        ["python3", "tools/loom_flow.py", "live-smoke", "run", "--target", str(missing_target), "--item", "INIT-0001"],
    )
    if error:
        failures.append(Failure("live-validation-only-guardrail", f"`live-smoke run` unavailable sample failed: {error}"))
    else:
        require_live_smoke_payload(
            failures,
            category="live-validation-only-guardrail",
            context="unavailable-live-smoke-guardrail",
            payload=unavailable_payload,
            expected_operation="run",
        )
        if not isinstance(unavailable_payload, dict) or unavailable_payload.get("result") != "warn":
            failures.append(Failure("live-validation-only-guardrail", "missing target live smoke must warn"))

    dry_run_payload, error = load_command_json(
        root,
        [
            "python3",
            "tools/loom_flow.py",
            "live-smoke",
            "run",
            "--target",
            str(root / "examples/new-project"),
            "--dry-run",
            "--include-blocking-shadow",
        ],
    )
    if error:
        failures.append(Failure("live-validation-only-guardrail", f"`live-smoke run --include-blocking-shadow --dry-run` failed: {error}"))
    else:
        require_live_smoke_payload(
            failures,
            category="live-validation-only-guardrail",
            context="dry-run-live-smoke-guardrail",
            payload=dry_run_payload,
            expected_operation="run",
        )
        command_plan = dry_run_payload.get("command_plan")
        if not isinstance(command_plan, list):
            failures.append(Failure("live-validation-only-guardrail", "dry-run live smoke must include command_plan"))
        else:
            blocking_steps = [step for step in command_plan if isinstance(step, dict) and step.get("id") == "shadow-parity-blocking"]
            if len(blocking_steps) != 1:
                failures.append(Failure("live-validation-only-guardrail", "dry-run live smoke must include exactly one explicit blocking shadow step when requested"))
            elif "not sufficient blocking-upgrade evidence on its own" not in str(blocking_steps[0].get("description") or ""):
                failures.append(Failure("live-validation-only-guardrail", "blocking shadow step must say it is not sufficient blocking-upgrade evidence on its own"))

    example_target = root / "examples/new-project"
    with tempfile.TemporaryDirectory(prefix="loom-live-validation-guardrail-") as tmp:
        mismatch_target = Path(tmp) / "shadow-mismatch"
        shutil.copytree(example_target, mismatch_target)
        write_shadow_evidence_local(mismatch_target, ".loom/shadow/review-repo.json", "decision", "allow", "native/status/review.json")
        shadow_payload = load_json_file(mismatch_target / ".loom/shadow/review-repo.json")
        if isinstance(shadow_payload, dict):
            shadow_payload["source_sha256"] = {"native/status/review.json": "0" * 64}
            write_json_local(mismatch_target / ".loom/shadow/review-repo.json", shadow_payload)

        warn_payload, warn_error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(mismatch_target), "--surface", "review"],
        )
        if warn_error:
            failures.append(Failure("live-validation-only-guardrail", f"`shadow-parity` validation-only mismatch sample failed: {warn_error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="live-validation-only-guardrail",
                context="validation-only-shadow-mismatch",
                payload=warn_payload,
                expected_reports=1,
            )
            if not isinstance(warn_payload, dict) or warn_payload.get("result") != "warn":
                failures.append(Failure("live-validation-only-guardrail", "validation-only shadow mismatch must warn"))

        block_payload, block_error = load_command_json(
            root,
            ["python3", "tools/loom_flow.py", "shadow-parity", "--target", str(mismatch_target), "--surface", "review", "--blocking"],
        )
        if block_error:
            failures.append(Failure("live-validation-only-guardrail", f"`shadow-parity --blocking` mismatch sample failed: {block_error}"))
        else:
            require_shadow_parity_payload(
                failures,
                category="live-validation-only-guardrail",
                context="blocking-shadow-mismatch",
                payload=block_payload,
                expected_reports=1,
            )
            if not isinstance(block_payload, dict) or block_payload.get("result") != "block":
                failures.append(Failure("live-validation-only-guardrail", "blocking shadow mismatch must block"))

    return failures


def fake_event_evidence(
    *,
    event_id: str,
    event_type: str,
    source_kind: str,
    subject_kind: str,
    result: str,
    summary: str,
    subject_locator: str = ".loom/runtime/attempts/WI-576/latest.json",
) -> dict[str, object]:
    return {
        "schema_version": EVENT_EVIDENCE_SCHEMA,
        "item_id": "WI-576",
        "session_id": "fixture-session",
        "attempt_id": "fixture-attempt",
        "event_id": event_id,
        "event_type": event_type,
        "source": {
            "kind": source_kind,
            "locator": f"loom_check.fixture.{source_kind}",
        },
        "subject": {
            "kind": subject_kind,
            "locator": subject_locator,
        },
        "result": result,
        "summary": summary,
        "observed_at": "fixture",
        "provenance": {
            "authority": "event_evidence",
            "truth_boundary": "evidence_only",
        },
    }


def check_structured_event_evidence_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    docs = {
        "docs/methodology/harness/structured-event-evidence.md": [
            "loom-event-evidence/v1",
            "fake agent",
            "fake tracker",
            "tool failure",
            "drift",
            "evidence_only",
            "`next_step`",
        ],
        "skills/shared/references/harness/structured-event-evidence.md": [
            "loom-event-evidence/v1",
            "fake agent",
            "fake tracker",
            "evidence_only",
        ],
    }
    for relative, anchors in docs.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("structured-event-evidence", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("structured-event-evidence", f"`{relative}` must mention `{anchor}`"))

    events = [
        fake_event_evidence(
            event_id="fake-agent-success",
            event_type="agent.step",
            source_kind="fake_agent",
            subject_kind="attempt",
            result="pass",
            summary="fake agent completed the orchestration step",
        ),
        fake_event_evidence(
            event_id="fake-agent-failure",
            event_type="failure.observed",
            source_kind="fake_agent",
            subject_kind="failure",
            result="fail",
            summary="fake agent reported a controlled failure",
            subject_locator=".loom/runtime/events/WI-576/failure.json",
        ),
        fake_event_evidence(
            event_id="fake-agent-tool-failure",
            event_type="agent.tool",
            source_kind="fake_agent",
            subject_kind="tool",
            result="block",
            summary="fake agent reported a tool failure without calling a real tool",
            subject_locator=".loom/runtime/events/WI-576/tool.json",
        ),
        fake_event_evidence(
            event_id="fake-tracker-active",
            event_type="tracker.state",
            source_kind="fake_tracker",
            subject_kind="tracker",
            result="pass",
            summary="fake tracker observed active state",
            subject_locator="fake-tracker://WI-576",
        ),
        fake_event_evidence(
            event_id="fake-tracker-closed",
            event_type="tracker.state",
            source_kind="fake_tracker",
            subject_kind="tracker",
            result="pass",
            summary="fake tracker observed closed state",
            subject_locator="fake-tracker://WI-576",
        ),
        fake_event_evidence(
            event_id="fake-tracker-drift",
            event_type="tracker.state",
            source_kind="fake_tracker",
            subject_kind="tracker",
            result="block",
            summary="fake tracker observed state drift",
            subject_locator="fake-tracker://WI-576",
        ),
    ]
    for event in events:
        require_structured_event_evidence(
            failures,
            category="structured-event-evidence",
            context=str(event.get("event_id")),
            payload=event,
        )

    missing_required = dict(events[0])
    missing_required.pop("attempt_id", None)
    if not any("attempt_id" in error for error in structured_event_evidence_errors(missing_required, context="missing-required")):
        failures.append(Failure("structured-event-evidence", "event evidence must reject missing required fields"))

    truth_poisoned = dict(events[0])
    truth_poisoned["next_step"] = "close the issue"
    if not any("authored truth fields" in error for error in structured_event_evidence_errors(truth_poisoned, context="truth-poisoned")):
        failures.append(Failure("structured-event-evidence", "event evidence must reject copied recovery truth"))

    tracker_poisoned = dict(events[-1])
    tracker_poisoned["recovery"] = {"next_step": "invented tracker recovery"}
    if not any("authored truth fields" in error for error in structured_event_evidence_errors(tracker_poisoned, context="tracker-poisoned")):
        failures.append(Failure("structured-event-evidence", "fake tracker drift must not carry scheduler or recovery truth"))

    return failures


def deferred_roadmap_inventory_section(body: str) -> str:
    match = re.search(r"(?ims)^## Roadmap Inventory\s*(.*?)(?=^## |\Z)", body)
    return match.group(1).strip() if match else ""


def markdown_issue_numbers(text: str) -> set[str]:
    return set(re.findall(r"#(\d+)", text))


def deferred_roadmap_fixture_failures(name: str, body: str) -> list[str]:
    failures: list[str] = []
    text = body.lower()
    has_deferred_semantics = (
        "deferred-roadmap" in text
        or "closed deferred children are deferred, not completed" in text
        or "deferred, not completed" in text
    )
    if has_deferred_semantics:
        if "## Activation Policy" not in body:
            failures.append(f"{name}: deferred_roadmap fixture must expose Activation Policy")
        if "## Roadmap Inventory" not in body:
            failures.append(f"{name}: deferred_roadmap fixture must expose Roadmap Inventory")

    inventory = deferred_roadmap_inventory_section(body)
    if "## Roadmap Inventory" in body:
        if not re.search(r"(?im)^FR:\s*#\d+", inventory):
            failures.append(f"{name}: deferred_roadmap Roadmap Inventory must list FR children")
        if not re.search(r"(?im)^Work Items:\s*#\d+", inventory):
            failures.append(f"{name}: deferred_roadmap Roadmap Inventory must list Work Item children")
        if "closed deferred children are deferred, not completed" not in text:
            failures.append(f"{name}: deferred_roadmap fixture must say closed deferred children are deferred, not completed")

        duplicate_lines = [
            line
            for line in inventory.splitlines()
            if "duplicate" in line.lower() or "retry artifact" in line.lower()
        ]
        duplicate_numbers = set().union(*(markdown_issue_numbers(line) for line in duplicate_lines)) if duplicate_lines else set()
        canonical_lines = [
            line
            for line in inventory.splitlines()
            if not ("duplicate" in line.lower() or "retry artifact" in line.lower())
        ]
        canonical_numbers = set().union(*(markdown_issue_numbers(line) for line in canonical_lines)) if canonical_lines else set()
        overlap = sorted(duplicate_numbers & canonical_numbers)
        if overlap:
            failures.append(
                f"{name}: deferred_roadmap duplicate/retry artifacts must be excluded from canonical inventory: "
                + ", ".join(f"#{number}" for number in overlap)
            )

    if (
        "completed delivery" in text
        and "closeout basis" not in text
        and "deferred-roadmap" not in text
    ):
        failures.append(
            f"{name}: completed_delivery closed child must have closeout basis or explicit deferred_roadmap semantics"
        )
    return failures


def normalized_issue_labels(issue: dict[str, Any]) -> set[str]:
    labels = issue.get("labels")
    if not isinstance(labels, list):
        return set()
    return {str(label).lower() for label in labels}


def parse_roadmap_inventory(body: str) -> dict[str, set[int]]:
    inventory = deferred_roadmap_inventory_section(body)
    parsed = {"fr": set(), "work_item": set(), "duplicates": set()}
    if not inventory:
        return parsed
    for line in inventory.splitlines():
        lower = line.lower()
        numbers = {int(number) for number in markdown_issue_numbers(line)}
        if "duplicate" in lower or "retry artifact" in lower:
            parsed["duplicates"].update(numbers)
        elif re.match(r"(?i)^fr:\s*", line.strip()):
            parsed["fr"].update(numbers)
        elif re.match(r"(?i)^work items:\s*", line.strip()):
            parsed["work_item"].update(numbers)
    return parsed


def is_duplicate_roadmap_artifact(issue: dict[str, Any]) -> bool:
    labels = normalized_issue_labels(issue)
    return "duplicate" in labels or issue.get("duplicate_of") is not None


def validate_deferred_roadmap_graph_fixture(name: str, issues: list[dict[str, Any]]) -> list[str]:
    failures: list[str] = []
    by_number = {
        int(issue["number"]): issue
        for issue in issues
        if isinstance(issue, dict) and isinstance(issue.get("number"), int)
    }
    phases = [issue for issue in by_number.values() if issue.get("type") == "phase"]
    if not phases:
        return [f"{name}: deferred_roadmap graph fixture must include a phase issue"]

    for phase in phases:
        phase_number = int(phase["number"])
        body = str(phase.get("body") or "")
        inventory = parse_roadmap_inventory(body)
        canonical_fr: set[int] = set()
        canonical_work_items: set[int] = set()
        inventory_numbers = inventory["fr"] | inventory["work_item"]

        for number, issue in by_number.items():
            labels = normalized_issue_labels(issue)
            parent = issue.get("parent")
            parent_issue = by_number.get(parent) if isinstance(parent, int) else None
            under_phase = parent == phase_number or (
                isinstance(parent_issue, dict) and parent_issue.get("parent") == phase_number
            )
            if not under_phase or "deferred-roadmap" not in labels or is_duplicate_roadmap_artifact(issue):
                continue
            if issue.get("type") == "fr" and parent == phase_number:
                canonical_fr.add(number)
            elif issue.get("type") == "work-item":
                canonical_work_items.add(number)

        if canonical_fr or canonical_work_items:
            if "## Activation Policy" not in body:
                failures.append(f"{name}: deferred_roadmap phase #{phase_number} must expose Activation Policy")
            if "## Roadmap Inventory" not in body:
                failures.append(f"{name}: deferred_roadmap phase #{phase_number} must expose Roadmap Inventory")
            if "closed deferred children are deferred, not completed" not in body.lower():
                failures.append(
                    f"{name}: deferred_roadmap phase #{phase_number} must say closed deferred children are deferred, not completed"
                )

        missing_fr = sorted(canonical_fr - inventory["fr"])
        missing_work_items = sorted(canonical_work_items - inventory["work_item"])
        if missing_fr:
            failures.append(
                f"{name}: deferred_roadmap Roadmap Inventory missing FR children: "
                + ", ".join(f"#{number}" for number in missing_fr)
            )
        if missing_work_items:
            failures.append(
                f"{name}: deferred_roadmap Roadmap Inventory missing Work Item children: "
                + ", ".join(f"#{number}" for number in missing_work_items)
            )

        duplicate_overlap = sorted((inventory["fr"] | inventory["work_item"]) & inventory["duplicates"])
        if duplicate_overlap:
            failures.append(
                f"{name}: deferred_roadmap duplicate/retry artifacts must be excluded from canonical inventory: "
                + ", ".join(f"#{number}" for number in duplicate_overlap)
            )

        for number in sorted(inventory_numbers):
            issue = by_number.get(number)
            if issue is None:
                failures.append(f"{name}: Roadmap Inventory references unknown issue #{number}")
                continue
            expected_type = "fr" if number in inventory["fr"] else "work-item"
            if issue.get("type") != expected_type:
                failures.append(
                    f"{name}: Roadmap Inventory issue #{number} must be a {expected_type}, got {issue.get('type')}"
                )
            parent = issue.get("parent")
            parent_issue = by_number.get(parent) if isinstance(parent, int) else None
            belongs_to_phase = parent == phase_number or (
                expected_type == "work-item"
                and isinstance(parent_issue, dict)
                and parent_issue.get("parent") == phase_number
            )
            if not belongs_to_phase:
                failures.append(
                    f"{name}: Roadmap Inventory issue #{number} must belong to phase #{phase_number} through parent references"
                )
            if is_duplicate_roadmap_artifact(issue):
                failures.append(f"{name}: duplicate/retry artifact #{number} must not be canonical inventory")
            labels = normalized_issue_labels(issue)
            if (
                str(issue.get("state", "")).lower() == "closed"
                and "deferred-roadmap" not in labels
                and not issue.get("closeout_basis")
            ):
                failures.append(
                    f"{name}: completed_delivery issue #{number} needs closeout basis or deferred_roadmap label"
                )

    return failures


def check_deferred_roadmap_tree_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    required_anchors = {
        "docs/methodology/governance/issue-model.md": [
            "deferred roadmap issue",
            "`closed + deferred-roadmap`",
            "roadmap reservation",
            "不是 `closed_out`",
            "open Phase",
            "duplicate/retry artifacts",
            "Roadmap Inventory",
            "`deferred_roadmap`",
            "`completed_delivery`",
        ],
        "src/skills/shared/references/governance/issue-model.md": [
            "deferred roadmap issue",
            "`closed + deferred-roadmap`",
            "roadmap reservation",
            "不是 `closed_out`",
            "open Phase",
            "duplicate/retry artifacts",
            "Roadmap Inventory",
            "`deferred_roadmap`",
            "`completed_delivery`",
        ],
        "docs/methodology/governance/github-delivery-funnel.md": [
            "Deferred Phase container",
            "`Activation Policy`",
            "`Roadmap Inventory`",
            "canonical FR children",
            "canonical Work Item children",
            "closed deferred children are deferred, not completed",
            "duplicate/retry artifacts",
            "canonical inventory",
        ],
        "src/skills/shared/references/governance/github-delivery-funnel.md": [
            "Deferred Phase container",
            "`Activation Policy`",
            "`Roadmap Inventory`",
            "canonical FR children",
            "canonical Work Item children",
            "closed deferred children are deferred, not completed",
            "duplicate/retry artifacts",
            "canonical inventory",
        ],
        "docs/adoption/github-profile.md": [
            "deferred Phase container",
            "`Activation Policy`",
            "`Roadmap Inventory`",
            "canonical FR children",
            "canonical Work Item children",
            "closed deferred children are deferred, not completed",
            "duplicate/retry artifacts",
            "canonical inventory",
        ],
        "src/skills/shared/references/adoption/github-profile.md": [
            "deferred Phase container",
            "`Activation Policy`",
            "`Roadmap Inventory`",
            "canonical FR children",
            "canonical Work Item children",
            "closed deferred children are deferred, not completed",
            "duplicate/retry artifacts",
            "canonical inventory",
        ],
        "docs/evidence/fixtures/deferred-roadmap-tree.json": [
            "loom-deferred-roadmap-fixtures/v1",
            "valid #649-style deferred tree",
            "missing roadmap inventory",
            "completed delivery confusion",
            "duplicate included in canonical inventory",
            "deferred-roadmap",
            "duplicate_of",
            "closeout_basis",
        ],
    }
    for relative, anchors in required_anchors.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure("deferred-roadmap", f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure("deferred-roadmap", f"`{relative}` must mention `{anchor}`"))

    fixture_path = root / "docs/evidence/fixtures/deferred-roadmap-tree.json"
    try:
        fixture_payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        failures.append(Failure("deferred-roadmap", f"`docs/evidence/fixtures/deferred-roadmap-tree.json` is unreadable: {exc}"))
        return failures
    fixtures = fixture_payload.get("fixtures")
    if not isinstance(fixtures, list):
        failures.append(Failure("deferred-roadmap", "`deferred-roadmap-tree.json` must expose fixtures list"))
        return failures
    for fixture in fixtures:
        if not isinstance(fixture, dict):
            failures.append(Failure("deferred-roadmap", "`deferred-roadmap-tree.json` fixture entries must be objects"))
            continue
        name = str(fixture.get("name") or "unnamed fixture")
        issues = fixture.get("issues")
        if not isinstance(issues, list):
            failures.append(Failure("deferred-roadmap", f"`{name}` must expose issues list"))
            continue
        fixture_failures = validate_deferred_roadmap_graph_fixture(
            name,
            [issue for issue in issues if isinstance(issue, dict)],
        )
        expect = fixture.get("expect")
        if expect == "pass" and fixture_failures:
            failures.append(
                Failure("deferred-roadmap", f"`{name}` expected pass, got failures: {fixture_failures}")
            )
        elif expect == "fail" and not fixture_failures:
            failures.append(
                Failure(
                    "deferred-roadmap",
                    f"`{name}` expected deferred_roadmap fixture failure but passed",
                )
            )

    return failures


def check_execution_budget_fixture_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    fixture_path = root / "docs/evidence/fixtures/execution-budget-fixtures.json"
    category = "execution-budget"
    try:
        fixture_payload = load_json_file(fixture_path)
    except (OSError, json.JSONDecodeError) as exc:
        failures.append(Failure(category, f"`docs/evidence/fixtures/execution-budget-fixtures.json` is unreadable: {exc}"))
        return failures

    if not isinstance(fixture_payload, dict):
        failures.append(Failure(category, "`execution-budget-fixtures.json` must be an object"))
        return failures

    schema_version = fixture_payload.get("schema_version")
    if schema_version != EXECUTION_BUDGET_FIXTURE_SCHEMA:
        failures.append(
            Failure(
                category,
                f"`docs/evidence/fixtures/execution-budget-fixtures.json` schema_version must be `{EXECUTION_BUDGET_FIXTURE_SCHEMA}`",
            )
        )

    fixtures = fixture_payload.get("fixtures")
    if not isinstance(fixtures, list):
        failures.append(Failure(category, "`execution-budget-fixtures.json` must expose fixtures list"))
        return failures

    for index, fixture in enumerate(fixtures, start=1):
        if not isinstance(fixture, dict):
            failures.append(Failure(category, f"`execution-budget-fixtures.json` fixture #{index} must be an object"))
            continue
        name = str(fixture.get("name") or f"fixture-{index}")
        context = f"{name} (#{index})"
        expect = fixture.get("expect")
        if not isinstance(expect, dict):
            failures.append(Failure(category, f"`{context}` must expose fixture `expect` as an object"))
            continue

        payload = governance_surface_module.normalize_execution_budget_payload(
            fixture.get("input"),
            fallback_status="not_applicable",
            fallback_summary="execution budget is not currently available",
            fallback_locator="",
        )

        if not isinstance(payload, dict):
            failures.append(Failure(category, f"`{context}` budget payload must normalize to object"))
            continue

        if payload.get("schema_version") != governance_surface_module.LOOM_EXECUTION_BUDGET_SCHEMA:
            failures.append(
                Failure(
                    category,
                    f"`{context}` normalized budget schema_version must be `{governance_surface_module.LOOM_EXECUTION_BUDGET_SCHEMA}`",
                )
            )
        if set(payload.keys()) - EXECUTION_BUDGET_STABLE_FIELDS:
            failures.append(
                Failure(
                    category,
                    f"`{context}` normalized budget payload must stay in stable field vocabulary",
                )
            )

        status = payload.get("status")
        if status not in EXECUTION_BUDGET_STATUS:
            failures.append(Failure(category, f"`{context}` normalized budget status must be stable"))
        expected_status = expect.get("status")
        if expected_status is not None and status != expected_status:
            failures.append(Failure(category, f"`{context}` normalized budget status `{status}` != expected `{expected_status}`"))

        expected_enforcement = expect.get("enforcement", "advisory")
        if payload.get("enforcement") != expected_enforcement:
            failures.append(
                Failure(
                    category,
                    f"`{context}` budget enforcement `{payload.get('enforcement')}` != expected `{expected_enforcement}`",
                )
            )

        dimensions = payload.get("dimensions")
        if not isinstance(dimensions, list):
            failures.append(Failure(category, f"`{context}` budget dimensions must stay a list"))
            dimensions = []

        expected_dimension_ids = expect.get("dimension_ids")
        if isinstance(expected_dimension_ids, list):
            actual_ids = [dimension.get("id") for dimension in dimensions if isinstance(dimension, dict)]
            if actual_ids != expected_dimension_ids:
                failures.append(
                    Failure(
                        category,
                        f"`{context}` budget dimension ids {actual_ids} != expected {expected_dimension_ids}",
                    )
                )

        expected_dimension_fields = expect.get("dimension_fields")
        if isinstance(expected_dimension_fields, list):
            field_set = set(str(field) for field in expected_dimension_fields)
            if not field_set.issubset(EXECUTION_BUDGET_DIMENSION_FIELDS):
                failures.append(
                    Failure(
                        category,
                        f"`{context}` expect `dimension_fields` contains non-stable budget dimension fields",
                    )
                )
            for position, dimension in enumerate(dimensions):
                if not isinstance(dimension, dict):
                    failures.append(Failure(category, f"`{context}` budget dimension #{position} must be an object"))
                    continue
                budget_id = dimension.get("id")
                if not isinstance(budget_id, str) or budget_id not in EXECUTION_BUDGET_DIMENSION_IDS:
                    failures.append(
                        Failure(
                            category,
                            f"`{context}` budget dimension #{position} id `{budget_id}` must stay in stable vocabulary",
                        )
                    )
                extra_fields = set(dimension.keys()) - set(expected_dimension_fields)
                if extra_fields:
                    failures.append(
                        Failure(
                            category,
                            f"`{context}` budget dimension {budget_id} has unsupported fields: {sorted(extra_fields)}",
                        )
                    )

        expected_forbidden_fields = expect.get("forbidden_fields")
        if isinstance(expected_forbidden_fields, list):
            forbidden = {str(field) for field in expected_forbidden_fields}
            for field in forbidden:
                for key in payload.keys():
                    if key == field:
                        failures.append(Failure(category, f"`{context}` budget payload must not contain forbidden field `{field}`"))
                for dimension in dimensions:
                    if isinstance(dimension, dict) and field in dimension:
                        failures.append(
                            Failure(
                                category,
                                f"`{context}` budget dimension `{dimension.get('id')}` must not contain forbidden field `{field}`",
                            )
                        )

        expected_count = expect.get("dimensions_count")
        if isinstance(expected_count, int) and isinstance(dimensions, list) and len(dimensions) != expected_count:
            failures.append(Failure(category, f"`{context}` budget dimensions count {len(dimensions)} != expected {expected_count}"))

        if status in {"not_applicable", "unavailable"} and payload.get("enforcement") != "advisory":
            failures.append(Failure(category, f"`{context}` missing budget should keep advisory enforcement"))

        if status in {"not_applicable", "unavailable"} and isinstance(payload.get("dimensions"), list):
            if payload["dimensions"]:
                failures.append(
                    Failure(
                        category,
                        f"`{context}` missing budget should not expose dimensions",
                    )
                )

        provenance = payload.get("provenance")
        if not isinstance(provenance, dict):
            failures.append(Failure(category, f"`{context}` budget provenance must be an object"))

        locator = payload.get("adapter_evidence_locator")
        if locator is not None and not isinstance(locator, str):
            failures.append(Failure(category, f"`{context}` budget adapter_evidence_locator must be a string when present"))

        derived_risk = governance_surface_module.derive_execution_budget_risk(payload)
        if derived_risk.get("enforcement") != "advisory":
            failures.append(Failure(category, f"`{context}` derived budget risk must remain advisory"))
        expected_highest_risk = expect.get("highest_risk")
        if expected_highest_risk is not None and derived_risk.get("highest_risk") != expected_highest_risk:
            failures.append(
                Failure(
                    category,
                    f"`{context}` derived highest_risk `{derived_risk.get('highest_risk')}` != expected `{expected_highest_risk}`",
                )
            )
        expected_risk_dimensions = expect.get("risk_dimensions")
        if isinstance(expected_risk_dimensions, list) and derived_risk.get("risk_dimensions") != expected_risk_dimensions:
            failures.append(
                Failure(
                    category,
                    f"`{context}` derived risk_dimensions {derived_risk.get('risk_dimensions')} != expected {expected_risk_dimensions}",
                )
            )
        if status == "present" and derived_risk.get("highest_risk") == "high" and payload.get("enforcement") != "advisory":
            failures.append(Failure(category, f"`{context}` high-risk budget must not bypass advisory enforcement"))

    return failures


def check_execution_failure_fixture_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    fixture_path = root / "docs/evidence/fixtures/execution-failure-fixtures.json"
    category = "execution-failure"
    try:
        fixture_payload = load_json_file(fixture_path)
    except (OSError, json.JSONDecodeError) as exc:
        failures.append(Failure(category, f"`docs/evidence/fixtures/execution-failure-fixtures.json` is unreadable: {exc}"))
        return failures

    if not isinstance(fixture_payload, dict):
        failures.append(Failure(category, "`execution-failure-fixtures.json` must be an object"))
        return failures
    if fixture_payload.get("schema_version") != EXECUTION_FAILURE_FIXTURE_SCHEMA:
        failures.append(
            Failure(
                category,
                f"`docs/evidence/fixtures/execution-failure-fixtures.json` schema_version must be `{EXECUTION_FAILURE_FIXTURE_SCHEMA}`",
            )
        )

    fixtures = fixture_payload.get("fixtures")
    if not isinstance(fixtures, list):
        failures.append(Failure(category, "`execution-failure-fixtures.json` must expose fixtures list"))
        return failures

    for index, fixture in enumerate(fixtures, start=1):
        if not isinstance(fixture, dict):
            failures.append(Failure(category, f"`execution-failure-fixtures.json` fixture #{index} must be an object"))
            continue
        name = str(fixture.get("name") or f"fixture-{index}")
        context = f"{name} (#{index})"
        input_payload = fixture.get("input")
        if not isinstance(input_payload, dict):
            failures.append(Failure(category, f"`{context}` input must be an object"))
            continue
        expect = fixture.get("expect")
        if not isinstance(expect, dict):
            failures.append(Failure(category, f"`{context}` expect must be an object"))
            continue

        details = loom_flow_module.execution_failure_details(input_payload)
        expected_classification = expect.get("classification")
        if expected_classification is not None and details.get("classification") != expected_classification:
            failures.append(
                Failure(
                    category,
                    f"`{context}` execution failure classification `{details.get('classification')}` != expected `{expected_classification}`",
                )
            )
        expected_fallback = expect.get("fallback_to")
        if expected_fallback is not None and details.get("fallback_to") != expected_fallback:
            failures.append(
                Failure(
                    category,
                    f"`{context}` execution failure fallback_to `{details.get('fallback_to')}` != expected `{expected_fallback}`",
                )
            )
        summary_contains = expect.get("summary_contains")
        if isinstance(summary_contains, str) and summary_contains not in str(details.get("summary")):
            failures.append(Failure(category, f"`{context}` execution failure summary must contain `{summary_contains}`"))

    return failures


def check_retry_evidence_fixture_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    fixture_path = root / "docs/evidence/fixtures/retry-evidence-fixtures.json"
    category = "retry-evidence"
    try:
        fixture_payload = load_json_file(fixture_path)
    except (OSError, json.JSONDecodeError) as exc:
        failures.append(Failure(category, f"`docs/evidence/fixtures/retry-evidence-fixtures.json` is unreadable: {exc}"))
        return failures

    if not isinstance(fixture_payload, dict):
        failures.append(Failure(category, "`retry-evidence-fixtures.json` must be an object"))
        return failures
    if fixture_payload.get("schema_version") != RETRY_EVIDENCE_FIXTURE_SCHEMA:
        failures.append(
            Failure(
                category,
                f"`docs/evidence/fixtures/retry-evidence-fixtures.json` schema_version must be `{RETRY_EVIDENCE_FIXTURE_SCHEMA}`",
            )
        )

    fixtures = fixture_payload.get("fixtures")
    if not isinstance(fixtures, list):
        failures.append(Failure(category, "`retry-evidence-fixtures.json` must expose fixtures list"))
        return failures

    with tempfile.TemporaryDirectory(prefix="loom-check-retry-evidence-") as tmp:
        root_dir = Path(tmp)
        current_head = "1" * 40
        stale_head = "0" * 40
        for index, fixture in enumerate(fixtures, start=1):
            if not isinstance(fixture, dict):
                failures.append(Failure(category, f"`retry-evidence-fixtures.json` fixture #{index} must be an object"))
                continue
            name = str(fixture.get("name") or f"fixture-{index}")
            context = f"{name} (#{index})"
            fixture_target = root_dir / name
            attempts_dir = fixture_target / ".loom/runtime/attempts/INIT-0001"
            attempts_dir.mkdir(parents=True, exist_ok=True)
            envelopes = fixture.get("attempts")
            if not isinstance(envelopes, list):
                failures.append(Failure(category, f"`{context}` attempts must be a list"))
                continue
            latest_index = fixture.get("latest_index", len(envelopes))
            for attempt_index, envelope in enumerate(envelopes, start=1):
                if not isinstance(envelope, dict):
                    continue
                payload = dict(envelope)
                payload.setdefault("schema_version", loom_flow_module.EXECUTION_ATTEMPT_SCHEMA)
                payload.setdefault("item_id", "INIT-0001")
                payload.setdefault("command", "flow")
                payload.setdefault("operation", "review")
                payload.setdefault("result", "block")
                payload.setdefault("created_at", f"2026-05-09T06:00:{attempt_index:02d}Z")
                payload.setdefault("head_sha", current_head if fixture.get("freshness") != "stale" else stale_head)
                payload.setdefault("attempt_id", f"INIT-0001-review-{attempt_index}")
                payload.setdefault("branch", "work/594-retry-evidence-boundary")
                payload.setdefault("workspace", {"entry": ".", "path": "."})
                payload.setdefault(
                    "failure",
                    {
                        "category": "review",
                        "execution_classification": "timeout",
                        "execution_summary": "default review engine timed out after 900s",
                        "missing_inputs": ["default review engine timed out after 900s"],
                        "fallback_to": "build",
                    },
                )
                payload.setdefault(
                    "evidence",
                    {
                        "status": "present",
                        "locator": f".loom/runtime/attempts/INIT-0001/{payload['attempt_id']}.json",
                        "latest_locator": ".loom/runtime/attempts/INIT-0001/latest.json",
                    },
                )
                attempt_path = attempts_dir / f"{payload['attempt_id']}.json"
                attempt_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                if attempt_index == latest_index:
                    (attempts_dir / "latest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            head_result = run_command(root, ["git", "init"], cwd=fixture_target, timeout_seconds=30)
            if head_result.returncode != 0:
                failures.append(Failure(category, f"`{context}` git init failed"))
                continue
            run_command(root, ["git", "config", "user.email", "loom-check@example.com"], cwd=fixture_target, timeout_seconds=30)
            run_command(root, ["git", "config", "user.name", "loom-check"], cwd=fixture_target, timeout_seconds=30)
            (fixture_target / "README.md").write_text("retry fixture\n", encoding="utf-8")
            run_command(root, ["git", "add", "."], cwd=fixture_target, timeout_seconds=30)
            run_command(root, ["git", "commit", "-m", "baseline"], cwd=fixture_target, timeout_seconds=30)
            if fixture.get("freshness") != "stale":
                actual_head = run_command(root, ["git", "rev-parse", "HEAD"], cwd=fixture_target, timeout_seconds=30).stdout.strip()
                for attempt_file in attempts_dir.glob("*.json"):
                    payload = json.loads(attempt_file.read_text(encoding="utf-8"))
                    payload["head_sha"] = actual_head
                    attempt_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            payload = loom_flow_module.latest_retry_evidence_payload(fixture_target, "INIT-0001")
            expect = fixture.get("expect")
            if not isinstance(expect, dict):
                failures.append(Failure(category, f"`{context}` expect must be an object"))
                continue
            for field in ("status", "attempt_count", "retry_count", "latest_failure_classification", "exhausted", "stale_attempt_count"):
                if field in expect and payload.get(field) != expect.get(field):
                    failures.append(Failure(category, f"`{context}` retry evidence `{field}` {payload.get(field)!r} != expected {expect.get(field)!r}"))

    return failures


def check_execution_attempt_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    example_target = root / "examples/new-project"
    if not example_target.exists():
        return failures

    with tempfile.TemporaryDirectory(prefix="loom-check-execution-attempt-") as tmp:
        target = Path(tmp) / "target"
        shutil.copytree(example_target, target)
        for args in (
            ["git", "init"],
            ["git", "config", "user.email", "loom-check@example.com"],
            ["git", "config", "user.name", "loom-check"],
            ["git", "add", "."],
            ["git", "commit", "-m", "baseline"],
        ):
            result = run_command(root, args, cwd=target, timeout_seconds=30)
            if result.returncode != 0:
                detail = result.stderr.strip() or result.stdout.strip() or "git setup failed"
                failures.append(Failure("execution-attempt", f"fixture git setup failed: {detail}"))
                return failures

        context, errors = loom_flow_module.load_context(target, ".loom/bootstrap/init-result.json", "INIT-0001")
        if errors:
            failures.append(Failure("execution-attempt", f"fixture fact chain failed: {'; '.join(errors)}"))
            return failures

        flow_payload = {
            "command": "flow",
            "operation": "resume",
            "result": "pass",
            "summary": "synthetic resume flow passed",
            "missing_inputs": [],
            "fallback_to": None,
            "steps": [
                {
                    "name": "fact-chain",
                    "result": "pass",
                    "missing_inputs": [],
                    "fallback_to": None,
                }
            ],
        }
        summary = loom_flow_module.persist_execution_attempt(
            context,
            command="flow",
            operation="resume",
            payload=flow_payload,
        )
        require_execution_attempt_summary(
            failures,
            category="execution-attempt",
            context="synthetic flow resume",
            payload=summary,
            expected_operation="resume",
        )
        evidence = summary.get("evidence") if isinstance(summary, dict) else None
        if not isinstance(evidence, dict) or evidence.get("status") != "present":
            failures.append(Failure("execution-attempt", "persisted attempt summary must include present evidence"))

        latest = loom_flow_module.latest_execution_attempt_payload(target, "INIT-0001")
        if latest.get("freshness") != "fresh":
            failures.append(Failure("execution-attempt", "latest attempt must be fresh immediately after write"))
        envelope = latest.get("attempt")
        if not isinstance(envelope, dict):
            failures.append(Failure("execution-attempt", "latest attempt must expose the persisted envelope"))
            return failures
        failure = envelope.get("failure")
        if not isinstance(failure, dict) or failure.get("execution_classification") != "none":
            failures.append(Failure("execution-attempt", "pass attempt must classify execution failure as `none`"))

        timeout_summary = loom_flow_module.persist_execution_attempt(
            context,
            command="flow",
            operation="review",
            payload={
                "command": "flow",
                "operation": "review",
                "result": "block",
                "summary": "default review engine failed closed before a formal review record could be authored.",
                "missing_inputs": ["default review engine timed out after 900s"],
                "fallback_to": "build",
                "steps": [
                    {
                        "name": "review-engine",
                        "result": "block",
                        "summary": "default review engine timed out after 900s",
                        "missing_inputs": ["default review engine timed out after 900s"],
                        "fallback_to": "build",
                    }
                ],
            },
        )
        if timeout_summary.get("execution_classification") != "timeout":
            failures.append(Failure("execution-attempt", "timed-out attempt must classify execution failure as `timeout`"))
        latest_timeout = loom_flow_module.latest_execution_attempt_payload(target, "INIT-0001")
        execution_failure = loom_flow_module.latest_execution_failure_payload(latest_timeout)
        if execution_failure.get("status") != "present":
            failures.append(Failure("execution-attempt", "fresh classified execution failure must surface as present"))
        if execution_failure.get("classification") != "timeout":
            failures.append(Failure("execution-attempt", "latest execution failure surface must preserve timeout classification"))
        retry_evidence = loom_flow_module.latest_retry_evidence_payload(target, "INIT-0001")
        if retry_evidence.get("status") != "present":
            failures.append(Failure("execution-attempt", "multiple current-head attempts must surface retry evidence as present"))
        if retry_evidence.get("attempt_count") != 2 or retry_evidence.get("retry_count") != 1:
            failures.append(Failure("execution-attempt", "retry evidence must count current-head attempt history"))
        if retry_evidence.get("latest_failure_classification") != "timeout":
            failures.append(Failure("execution-attempt", "retry evidence must preserve latest failure classification"))

        poisoned = dict(envelope)
        poisoned["next_step"] = "forbidden duplicate recovery progress"
        _, poison_errors, _ = loom_flow_module.validate_execution_attempt_envelope(
            poisoned,
            target_root=target,
            expected_item="INIT-0001",
            expected_head=str(envelope.get("head_sha")),
        )
        if not any("authored progress field" in error for error in poison_errors):
            failures.append(Failure("execution-attempt", "attempt envelope must reject copied recovery progress fields"))

        latest_path = target / ".loom/runtime/attempts/INIT-0001/latest.json"
        latest_path.unlink()
        missing = loom_flow_module.latest_execution_attempt_payload(target, "INIT-0001")
        if missing.get("status") != "missing" or missing.get("freshness") != "missing":
            failures.append(Failure("execution-attempt", "missing latest attempt evidence must be marked missing"))

        stale = dict(envelope)
        stale["head_sha"] = "0" * 40
        latest_path.parent.mkdir(parents=True, exist_ok=True)
        latest_path.write_text(json.dumps(stale, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        stale_payload = loom_flow_module.latest_execution_attempt_payload(target, "INIT-0001")
        if stale_payload.get("freshness") != "stale":
            failures.append(Failure("execution-attempt", "status must not display a stale attempt as fresh"))
        stale_retry = loom_flow_module.latest_retry_evidence_payload(target, "INIT-0001")
        if stale_retry.get("status") != "stale":
            failures.append(Failure("execution-attempt", "retry evidence must not display a stale attempt chain as fresh"))

    return failures


def check_build_execution_contract(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    example_target = root / "examples/new-project"
    if not example_target.exists():
        return failures

    with tempfile.TemporaryDirectory(prefix="loom-check-build-execution-") as tmp:
        target = Path(tmp) / "target"
        shutil.copytree(example_target, target)
        context, errors = loom_flow_module.load_context(target, ".loom/bootstrap/init-result.json", "INIT-0001")
        if errors:
            failures.append(Failure("build-execution", f"fixture fact chain failed: {'; '.join(errors)}"))
            return failures
        context["closing_condition"] = f"{context['closing_condition']} Ownership constraints are declared for build fixtures."

        evidence_dir = target / ".loom/runtime/build"
        evidence_dir.mkdir(parents=True, exist_ok=True)

        def write_evidence(name: str, delegations: list[dict[str, object]]) -> str:
            relative = f".loom/runtime/build/{name}.json"
            payload = {
                "schema_version": "loom-build-evidence/v1",
                "delegations": delegations,
                "integration_evidence": [
                    {
                        "carrier": "recovery",
                        "locator": ".loom/progress/INIT-0001.md",
                    }
                ],
            }
            (target / relative).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            return relative

        base_delegation = {
            "id": "worker-a",
            "task_goal": "update build fixture",
            "context_locators": [".loom/work-items/INIT-0001.md"],
            "read_scope": [".loom/specs/INIT-0001/plan.md"],
            "write_ownership": ["docs/example.md"],
            "non_goals": ["do not edit review records"],
            "validation_expectation": "make check",
            "output_format": "summary plus changed paths",
            "integration_target": ".loom/progress/INIT-0001.md",
            "status": "integrated",
        }

        integrated = loom_flow_module.build_execution_payload(
            context,
            write_evidence("integrated", [dict(base_delegation)]),
        )
        if integrated.get("result") != "pass":
            failures.append(Failure("build-execution", "integrated subagent output must pass build execution readiness"))

        unintegrated_delegation = dict(base_delegation)
        unintegrated_delegation["id"] = "worker-unintegrated"
        unintegrated_delegation["status"] = "unintegrated"
        unintegrated = loom_flow_module.build_execution_payload(
            context,
            write_evidence("unintegrated", [unintegrated_delegation]),
        )
        if unintegrated.get("result") != "block":
            failures.append(Failure("build-execution", "unintegrated subagent output must block build readiness"))
        elif not any("not integrated" in message for message in unintegrated.get("missing_inputs", [])):
            failures.append(Failure("build-execution", "unintegrated output must be named in missing_inputs"))

        overlap_a = dict(base_delegation)
        overlap_a["id"] = "worker-overlap-a"
        overlap_b = dict(base_delegation)
        overlap_b["id"] = "worker-overlap-b"
        overlap_b["read_scope"] = [".loom/specs/INIT-0001/spec.md"]
        overlap = loom_flow_module.build_execution_payload(
            context,
            write_evidence("overlap", [overlap_a, overlap_b]),
        )
        if overlap.get("result") != "block" or not overlap.get("ownership_conflicts"):
            failures.append(Failure("build-execution", "overlapping write ownership must fail closed"))

        repeated_a = dict(base_delegation)
        repeated_a["id"] = "worker-repeat-a"
        repeated_a["write_ownership"] = ["docs/a.md"]
        repeated_a["blocker_signature"] = "validation-gap"
        repeated_b = dict(base_delegation)
        repeated_b["id"] = "worker-repeat-b"
        repeated_b["write_ownership"] = ["docs/b.md"]
        repeated_b["blocker_signature"] = "validation-gap"
        repeated = loom_flow_module.build_execution_payload(
            context,
            write_evidence("repeated", [repeated_a, repeated_b]),
        )
        signal = repeated.get("repeated_blocker_signal")
        if repeated.get("result") != "block" or not isinstance(signal, dict) or signal.get("result") != "block":
            failures.append(Failure("build-execution", "repeated blocker candidates must block and expose root-cause signal"))

    return failures


STORY_FORBIDDEN_FIELDS = {
    "delivery_handoff",
    "spec_locator",
    "plan_locator",
    "recovery_state",
    "review_findings",
    "pr_summary",
    "merge_ready_result",
    "closeout_result",
}
STORY_SCENARIO_DIMENSIONS = {
    "happy_path",
    "negative_path",
    "edge_case",
    "alternative_path",
    "security_permission",
    "environment_interruption",
}
STORY_READINESS_DECISIONS = {"ready", "needs-shaping", "blocked", "not-applicable"}


def require_user_story_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
    expect_pass: bool,
) -> None:
    errors: list[str] = []
    if not isinstance(payload, dict):
        errors.append("must be an object")
    else:
        if payload.get("schema_version") != "loom-user-story/v1":
            errors.append("schema_version must be `loom-user-story/v1`")
        for field in ("actor", "capability", "outcome", "business_value", "acceptance_scenarios", "provenance"):
            if field not in payload:
                errors.append(f"missing `{field}`")
        forbidden_present = sorted(STORY_FORBIDDEN_FIELDS.intersection(payload))
        if forbidden_present:
            errors.append(f"forbidden delivery-state fields present: {', '.join(forbidden_present)}")

        actor = payload.get("actor")
        if not isinstance(actor, dict):
            errors.append("actor must be an object")
        else:
            if actor.get("name") in {None, "", "User", "user"} and not actor.get("specificity_rationale"):
                errors.append("actor must be specific or include specificity_rationale")
            if actor.get("type") not in {"human-persona", "stakeholder", "system", "component"}:
                errors.append("actor.type must be a stable actor type")

        scenarios = payload.get("acceptance_scenarios")
        if not isinstance(scenarios, list) or not scenarios:
            errors.append("acceptance_scenarios must be a non-empty list")
        else:
            dimensions: set[str] = set()
            for index, scenario in enumerate(scenarios):
                if not isinstance(scenario, dict):
                    errors.append(f"acceptance_scenarios[{index}] must be an object")
                    continue
                dimension = scenario.get("dimension")
                if dimension not in STORY_SCENARIO_DIMENSIONS:
                    errors.append(f"acceptance_scenarios[{index}].dimension must stay within the story coverage vocabulary")
                else:
                    dimensions.add(str(dimension))
                for field in ("id", "given", "when", "then"):
                    if not isinstance(scenario.get(field), str) or not scenario.get(field):
                        errors.append(f"acceptance_scenarios[{index}] missing non-empty `{field}`")
                if any(token in " ".join(str(scenario.get(field, "")) for field in ("given", "when", "then")).lower() for token in ("pytest", "npm test", "implementation step")):
                    errors.append(f"acceptance_scenarios[{index}] must stay business-readable, not a test script")
            if "happy_path" not in dimensions:
                errors.append("at least one happy_path scenario is required")

        provenance = payload.get("provenance")
        if not isinstance(provenance, list) or not provenance:
            errors.append("provenance must be a non-empty list")

    if expect_pass and errors:
        failures.append(Failure(category, f"{context} should pass story contract: {'; '.join(errors)}"))
    if not expect_pass and not errors:
        failures.append(Failure(category, f"{context} should fail story contract"))


def require_story_readiness_payload(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-story-readiness/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-story-readiness/v1`"))
    if payload.get("decision") not in STORY_READINESS_DECISIONS:
        failures.append(Failure(category, f"{context} decision must stay within the readiness vocabulary"))
    for field in ("rationale", "story_locator"):
        if not isinstance(payload.get(field), str) or not payload.get(field):
            failures.append(Failure(category, f"{context} must include non-empty `{field}`"))
    if not isinstance(payload.get("missing_inputs"), list):
        failures.append(Failure(category, f"{context} must include `missing_inputs` as a list"))
    checks = payload.get("checks")
    if not isinstance(checks, dict):
        failures.append(Failure(category, f"{context} must include checks"))
        return
    for field in (
        "actor_specificity",
        "outcome_clarity",
        "value_signal",
        "acceptance_scenario_quality",
        "unresolved_blockers",
        "story_size",
    ):
        if field not in checks:
            failures.append(Failure(category, f"{context}.checks missing `{field}`"))
    if payload.get("product_strategy_verdict") is not None:
        failures.append(Failure(category, f"{context} must not claim product strategy approval"))


def require_story_delivery_mapping(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("schema_version") != "loom-story-delivery-mapping/v1":
        failures.append(Failure(category, f"{context} schema_version must be `loom-story-delivery-mapping/v1`"))
    if payload.get("execution_entry") != "Work Item":
        failures.append(Failure(category, f"{context} must keep Work Item as the execution entry"))
    spec = payload.get("spec_behavior_contract")
    plan = payload.get("plan_validation_strategy")
    if not isinstance(spec, list) or not spec:
        failures.append(Failure(category, f"{context} must include spec behavior mapping"))
    if not isinstance(plan, list) or not plan:
        failures.append(Failure(category, f"{context} must include plan validation mapping"))
    spec_ids = {
        str(entry.get("story_scenario_id"))
        for entry in spec or []
        if isinstance(entry, dict) and entry.get("story_scenario_id")
    }
    plan_ids = {
        str(entry.get("story_scenario_id"))
        for entry in plan or []
        if isinstance(entry, dict) and entry.get("story_scenario_id")
    }
    if not spec_ids or not spec_ids.issubset(plan_ids):
        failures.append(Failure(category, f"{context} plan must map every spec-consumed story scenario to evidence strategy"))
    forbidden = payload.get("story_authored_delivery_state")
    if forbidden not in (False, None):
        failures.append(Failure(category, f"{context} must not let story author delivery state"))


def require_story_flow_contract_summary(
    failures: list[Failure],
    *,
    category: str,
    context: str,
    payload: object,
) -> None:
    if not isinstance(payload, dict):
        failures.append(Failure(category, f"{context} must be an object"))
        return
    if payload.get("command") != "flow" or payload.get("operation") != "story":
        failures.append(Failure(category, f"{context} must be flow story output"))
    if payload.get("result") != "pass":
        failures.append(Failure(category, f"{context} must pass when runtime is available"))
    summary = payload.get("contract_summary")
    if not isinstance(summary, dict):
        failures.append(Failure(category, f"{context} must include contract_summary"))
    elif summary.get("runtime_generates_story") is not False:
        failures.append(Failure(category, f"{context} must declare that runtime does not generate story truth"))
    story_contract = payload.get("story_contract")
    if not isinstance(story_contract, dict) or story_contract.get("schema_version") != "loom-user-story/v1":
        failures.append(Failure(category, f"{context} must include loom-user-story/v1 story_contract"))
    readiness_contract = payload.get("readiness_contract")
    if not isinstance(readiness_contract, dict) or readiness_contract.get("schema_version") != "loom-story-readiness/v1":
        failures.append(Failure(category, f"{context} must include loom-story-readiness/v1 readiness_contract"))
    elif "story_locator" not in readiness_contract.get("required_fields", []):
        failures.append(Failure(category, f"{context} readiness_contract must require story_locator"))
    delivery_contract = payload.get("delivery_consumption_contract")
    if not isinstance(delivery_contract, dict) or delivery_contract.get("execution_entry") != "Work Item":
        failures.append(Failure(category, f"{context} must keep Work Item as delivery consumption entry"))
    if any(key in payload for key in ("story", "readiness", "delivery_consumption")):
        failures.append(Failure(category, f"{context} must not expose actual story/readiness payload keys from contract-summary mode"))


def check_story_intake_contract(root: Path) -> list[Failure]:
    category = "story-intake"
    failures: list[Failure] = []
    required_anchors = {
        "docs/methodology/governance/story-intake.md": [
            "loom-user-story/v1",
            "loom-story-readiness/v1",
            "Work Item",
            "delivery handoff",
            "not-applicable",
            "actor specificity",
        ],
        "docs/methodology/templates/spec-suite.md": [
            "User Story",
            "story scenario id",
            "plan.md",
        ],
        "docs/methodology/templates/scaffold/user-story.md": [
            "Actor",
            "Capability",
            "Story Readiness",
            "Delivery Consumption Boundary",
        ],
        "skills/route-matrix.md": [
            "loom-story",
            "story readiness",
            "User Story",
        ],
        "skills/loom-story/SKILL.md": [
            "Story Readiness",
            "Work Item",
            "actor specificity",
        ],
        "skills/loom-story/references/output-contract.md": [
            "loom-user-story/v1",
            "loom-story-readiness/v1",
            "contract_summary",
            "delivery handoff",
        ],
    }
    for relative, anchors in required_anchors.items():
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            failures.append(Failure(category, f"`{relative}` is unreadable: {exc}"))
            continue
        for anchor in anchors:
            if anchor not in text:
                failures.append(Failure(category, f"`{relative}` must mention `{anchor}`"))

    valid_story = {
        "schema_version": "loom-user-story/v1",
        "actor": {
            "name": "Release shepherd",
            "type": "human-persona",
        },
        "capability": "turn product discussion into a delivery-ready story",
        "outcome": "the delivery funnel can consume accepted behavior scenarios",
        "business_value": "reduces drift between product intent and spec / plan evidence",
        "acceptance_scenarios": [
            {
                "id": "S1",
                "dimension": "happy_path",
                "given": "a roadmap phase has product context",
                "when": "the actor shapes the intake",
                "then": "a business-readable story is available",
            },
            {
                "id": "S2",
                "dimension": "negative_path",
                "given": "the actor is vague",
                "when": "readiness is checked",
                "then": "the result asks for a specific actor or rationale",
            },
        ],
        "provenance": [{"kind": "roadmap", "locator": "https://github.com/MC-and-his-Agents/Loom/issues/649"}],
    }
    require_user_story_payload(failures, category=category, context="valid story", payload=valid_story, expect_pass=True)

    invalid_story = dict(valid_story)
    invalid_story["actor"] = {"name": "User", "type": "human-persona"}
    invalid_story["plan_locator"] = ".loom/specs/WI-649/plan.md"
    require_user_story_payload(failures, category=category, context="invalid delivery-state story", payload=invalid_story, expect_pass=False)

    readiness = {
        "schema_version": "loom-story-readiness/v1",
        "decision": "ready",
        "rationale": "actor, outcome, value, and scenarios are clear enough to enter spec / plan",
        "story_locator": "docs/methodology/templates/scaffold/user-story.md",
        "missing_inputs": [],
        "fallback_to": None,
        "checks": {
            "actor_specificity": "pass",
            "outcome_clarity": "pass",
            "value_signal": "pass",
            "acceptance_scenario_quality": "pass",
            "unresolved_blockers": "pass",
            "story_size": "pass",
        },
    }
    require_story_readiness_payload(failures, category=category, context="ready story", payload=readiness)
    for decision in STORY_READINESS_DECISIONS:
        candidate = dict(readiness)
        candidate["decision"] = decision
        if decision == "not-applicable":
            candidate["rationale"] = "story intake bypassed because the change is a pure repository maintenance closeout"
        require_story_readiness_payload(failures, category=category, context=f"{decision} readiness", payload=candidate)

    mapping = {
        "schema_version": "loom-story-delivery-mapping/v1",
        "execution_entry": "Work Item",
        "story_locator": "docs/methodology/templates/scaffold/user-story.md",
        "spec_behavior_contract": [
            {"story_scenario_id": "S1", "spec_section": "Key Scenarios"},
            {"story_scenario_id": "S2", "spec_section": "Exceptions And Boundaries"},
        ],
        "plan_validation_strategy": [
            {"story_scenario_id": "S1", "evidence": "automated check"},
            {"story_scenario_id": "S2", "evidence": "manual validation or not_applicable rationale"},
        ],
        "story_authored_delivery_state": False,
    }
    require_story_delivery_mapping(failures, category=category, context="story-to-delivery mapping", payload=mapping)

    payload, error = load_command_json(
        root,
        ["python3", "tools/loom_flow.py", "flow", "story", "--target", "examples/new-project"],
    )
    if error:
        failures.append(Failure(category, f"flow story contract summary failed: {error}"))
    else:
        require_story_flow_contract_summary(
            failures,
            category=category,
            context="flow story contract summary",
            payload=payload,
        )

    return failures


def is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def collect_failures(root: Path) -> list[Failure]:
    if is_bootstrapped_target_runtime(root):
        return collect_bootstrapped_target_failures(root)

    failures: list[Failure] = []
    failures.extend(check_required_paths(root, "top-level-dirs", TOP_LEVEL_DIRS))
    failures.extend(check_required_paths(root, "top-level-files", TOP_LEVEL_FILES))
    failures.extend(check_required_paths(root, "area-readmes", AREA_READMES))
    failures.extend(check_required_paths(root, "core-docs", CORE_DOCS))
    failures.extend(
        check_required_paths(root, "automation-frontload-templates", AUTOMATION_FRONTLOAD_TEMPLATES)
    )
    failures.extend(check_required_paths(root, "automation-frontload-skills", AUTOMATION_FRONTLOAD_SKILLS))
    failures.extend(
        check_required_paths(
            root,
            "automation-frontload-execution-support",
            AUTOMATION_FRONTLOAD_EXECUTION_SUPPORT,
        )
    )
    failures.extend(check_root_route_contracts(root))
    failures.extend(check_skill_manifests(root))
    failures.extend(check_skill_routing(root))
    failures.extend(check_demo_assets(root))
    failures.extend(check_demo_fact_chain(root))
    failures.extend(check_demo_repo_local_cli(root))
    failures.extend(check_root_self_adoption_carrier(root))
    failures.extend(check_deep_existing_repo_bootstrap(root))
    failures.extend(check_daily_execution_cli(root))
    failures.extend(check_repo_companion_interface_contracts(root))
    failures.extend(check_repo_interop_contracts(root))
    failures.extend(check_external_orchestrator_interop_fixture_contract(root))
    failures.extend(check_external_orchestrator_conformance_contract(root))
    failures.extend(check_external_runtime_devendor_contract(root))
    failures.extend(check_status_closeout_binding_contract(root))
    failures.extend(check_behavior_first_locator_contracts(root))
    failures.extend(check_adversarial_adoption_fixture(root))
    failures.extend(check_node_installer(root))
    failures.extend(check_generated_artifacts_untracked(root))
    failures.extend(check_github_cli_budget(root))
    failures.extend(check_operating_layer_contract(root))
    failures.extend(check_orchestration_conformance_profiles(root))
    failures.extend(check_live_smoke_foundation_contract(root))
    failures.extend(check_host_adapter_live_drift_contract(root))
    failures.extend(check_dynamic_tool_live_availability_contract(root))
    failures.extend(check_hook_envelope_contract(root))
    failures.extend(check_hooks_extension_profile_contract(root))
    failures.extend(check_live_validation_only_guardrail_contract(root))
    failures.extend(check_structured_event_evidence_contract(root))
    failures.extend(check_deferred_roadmap_tree_contract(root))
    failures.extend(check_execution_budget_fixture_contract(root))
    failures.extend(check_execution_failure_fixture_contract(root))
    failures.extend(check_retry_evidence_fixture_contract(root))
    failures.extend(check_execution_attempt_contract(root))
    failures.extend(check_build_execution_contract(root))
    failures.extend(check_story_intake_contract(root))
    failures.extend(check_markdown_links(root))
    return failures


def is_bootstrapped_target_runtime(root: Path) -> bool:
    return (
        (root / ".loom/bootstrap/manifest.json").exists()
        and (root / ".loom/bin/loom_init.py").exists()
        and not (root / "skills").exists()
    )


def collect_bootstrapped_target_failures(root: Path) -> list[Failure]:
    failures: list[Failure] = []
    required_paths = (
        ".loom/README.md",
        ".loom/bootstrap/init-result.json",
        ".loom/bootstrap/manifest.json",
        ".loom/bootstrap/capability-map.md",
        ".loom/companion/README.md",
        ".loom/companion/manifest.json",
        ".loom/companion/repo-interface.json",
        ".loom/companion/interop.json",
        ".loom/bin/loom_init.py",
    )
    failures.extend(check_required_paths(root, "bootstrapped-target-runtime", required_paths))
    if failures:
        return failures

    try:
        completed = subprocess.run(
            ["python3", ".loom/bin/loom_init.py", "verify", "--target", "."],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
            timeout=ADOPT_VERIFY_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        failures.append(Failure("bootstrapped-target-runtime", "`loom_init.py verify` timed out"))
        return failures
    if completed.returncode != 0:
        detail = (completed.stdout or completed.stderr).strip().replace("\n", " ")
        failures.append(Failure("bootstrapped-target-runtime", f"`loom_init.py verify` failed: {detail}"))
    return failures


def print_report(root: Path, failures: list[Failure]) -> None:
    categories_checked = 1 if is_bootstrapped_target_runtime(root) else 36
    if not failures:
        print(f"loom_check: OK ({root})")
        print(f"checked {categories_checked} surfaces")
        return

    grouped: dict[str, list[str]] = defaultdict(list)
    for failure in failures:
        grouped[failure.category].append(failure.detail)

    print(f"loom_check: FAILED ({root})")
    for category in sorted(grouped):
        print(f"- {category}")
        for detail in grouped[category]:
            print(f"  - {detail}")
    print(f"failures: {len(failures)} across {len(grouped)} categories")


def main(argv: list[str]) -> int:
    root = repo_root_from_argv(argv)
    if not root.exists():
        print(f"loom_check: repo root does not exist: {root}", file=sys.stderr)
        return 2
    failures = collect_failures(root)
    print_report(root, failures)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
