#!/usr/bin/env python3
"""Detect Loom runtime scene/carrier and enforce fail-closed runtime checks."""

from __future__ import annotations

import json
import hashlib
import os
import sys
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

from runtime_paths import (
    bootstrap_manifest_path,
    bootstrap_runtime_root,
    caller_path,
    installed_skills_root,
    repo_local_root,
    shared_root,
    source_repo_root,
)

SUPPORTED_SCENES = {"repo-local-demo", "installed-runtime", "upgrade-rehearsal"}
SUPPORTED_CARRIERS = {
    "repo-local-wrapper",
    "installed-skills-root",
    "bootstrapped-target-runtime",
}
SUPPORTED_ENTRY_FAMILIES = {"loom-init", "loom-flow"}

EXPECTED_SHARED_RUNTIME_SCRIPTS = (
    "runtime_paths.py",
    "runtime_state.py",
    "loom_init.py",
    "fact_chain_support.py",
    "governance_surface.py",
    "loom_flow.py",
    "loom_status.py",
    "loom_check.py",
    "loom_story_carriers.py",
)

EXPECTED_BOOTSTRAP_RUNTIME_SOURCES = {
    ".loom/bin/loom_init.py": "skills/shared/scripts/loom_init.py",
    ".loom/bin/fact_chain_support.py": "skills/shared/scripts/fact_chain_support.py",
    ".loom/bin/governance_surface.py": "skills/shared/scripts/governance_surface.py",
    ".loom/bin/loom_flow.py": "skills/shared/scripts/loom_flow.py",
    ".loom/bin/loom_status.py": "skills/shared/scripts/loom_status.py",
    ".loom/bin/runtime_paths.py": "skills/shared/scripts/runtime_paths.py",
    ".loom/bin/runtime_state.py": "skills/shared/scripts/runtime_state.py",
    ".loom/bin/loom_check.py": "skills/shared/scripts/loom_check.py",
    ".loom/bin/loom_story_carriers.py": "skills/shared/scripts/loom_story_carriers.py",
}


def _path_text(path: Path | None) -> str | None:
    return str(path) if path is not None else None


def _load_json(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, f"missing `{path}`"
    except json.JSONDecodeError as exc:
        return None, f"`{path}` is invalid JSON: {exc.msg}"
    if not isinstance(payload, dict):
        return None, f"`{path}` must be a JSON object"
    return payload, None


def _check(status: str, summary: str, *, evidence: object | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": status,
        "summary": summary,
    }
    if evidence is not None:
        payload["evidence"] = evidence
    return payload


def detect_carrier(caller_file: str) -> str | None:
    if bootstrap_runtime_root(caller_file) is not None:
        return "bootstrapped-target-runtime"
    if source_repo_root() is not None:
        return "repo-local-wrapper"
    if installed_skills_root(caller_file) is not None:
        return "installed-skills-root"
    return None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_inside(root: Path, relative: str, *, label: str) -> tuple[Path | None, str | None]:
    if Path(relative).is_absolute():
        return None, f"{label} must stay inside the runtime root: {relative}"
    try:
        candidate = (root / relative).resolve()
        candidate.relative_to(root.resolve())
    except ValueError:
        return None, f"{label} must stay inside the runtime root: {relative}"
    return candidate, None


def _path_is_inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
    except (OSError, ValueError):
        return False
    return True


def _default_scene_for_carrier(carrier: str) -> str:
    if carrier == "repo-local-wrapper":
        return "repo-local-demo"
    return "installed-runtime"


def _scene_check(carrier: str | None) -> tuple[str | None, dict[str, Any], list[str]]:
    marker = os.environ.get("LOOM_RUNTIME_SCENE")
    errors: list[str] = []
    if carrier is None:
        return None, _check("block", "runtime carrier could not be determined."), ["runtime carrier is unknown"]

    if marker is None or not marker.strip():
        scene = _default_scene_for_carrier(carrier)
        return scene, _check("pass", f"scene defaults to `{scene}` for carrier `{carrier}`."), []

    marker = marker.strip()
    if marker not in SUPPORTED_SCENES:
        errors.append(f"unsupported LOOM_RUNTIME_SCENE `{marker}`")
        return None, _check("block", "scene marker is not part of the stable runtime-state vocabulary."), errors

    scene = marker
    if scene == "repo-local-demo" and carrier != "repo-local-wrapper":
        errors.append(f"`repo-local-demo` scene conflicts with carrier `{carrier}`")
    elif scene == "upgrade-rehearsal" and carrier not in {"installed-skills-root", "bootstrapped-target-runtime"}:
        errors.append(f"`upgrade-rehearsal` scene conflicts with carrier `{carrier}`")
    elif scene == "installed-runtime" and carrier == "repo-local-wrapper":
        errors.append("`installed-runtime` scene cannot be asserted from a repo-local wrapper")

    if errors:
        return scene, _check("block", "scene marker conflicts with the detected runtime carrier."), errors
    return scene, _check("pass", f"scene marker `{scene}` is consistent with carrier `{carrier}`."), []


def _validate_install_layout(skills_root: Path) -> tuple[dict[str, Any], list[str], Path | None]:
    errors: list[str] = []
    layout_path = skills_root / "install-layout.json"
    layout, error = _load_json(layout_path)
    if error:
        return _check("block", "install layout manifest is missing or invalid."), [error], layout_path

    required_paths = layout.get("required_paths")
    if not isinstance(required_paths, list) or not required_paths:
        errors.append("`install-layout.json` must declare a non-empty `required_paths`")
    else:
        missing = []
        for relative in required_paths:
            if not isinstance(relative, str) or not relative:
                errors.append("`install-layout.json` required paths must be non-empty strings")
                continue
            path, path_error = _resolve_inside(skills_root, relative, label="install layout required path")
            if path_error:
                errors.append(path_error)
                continue
            if path is None or not path.exists():
                missing.append(relative)
        if missing:
            errors.append("install layout is missing required paths: " + ", ".join(sorted(missing)))

    status = "pass" if not errors else "block"
    summary = (
        "install layout manifest and required paths are present."
        if status == "pass"
        else "install layout manifest is incomplete or points to missing paths."
    )
    return _check(status, summary, evidence={"path": str(layout_path)}), errors, layout_path


def _validate_registry_contract(skills_root: Path) -> tuple[dict[str, Any], list[str], Path]:
    errors: list[str] = []
    registry_path = skills_root / "registry.json"
    registry, error = _load_json(registry_path)
    if error:
        return _check("block", "registry contract is missing or invalid."), [error], registry_path

    if registry.get("install_layout") != "install-layout.json":
        errors.append("`registry.json` must point `install_layout` to `install-layout.json`")
    if registry.get("upgrade_contract") != "upgrade-contract.json":
        errors.append("`registry.json` must point `upgrade_contract` to `upgrade-contract.json`")

    entries = registry.get("entries")
    if not isinstance(entries, list) or not entries:
        errors.append("`registry.json` must declare a non-empty `entries` list")
    else:
        for entry in entries:
            if not isinstance(entry, dict):
                errors.append("registry entries must be JSON objects")
                continue
            skill_id = entry.get("id")
            executable = entry.get("executable")
            manifest = entry.get("manifest")
            if not isinstance(skill_id, str) or not skill_id:
                errors.append("registry entry is missing a non-empty `id`")
                continue
            if not isinstance(executable, str) or not executable:
                errors.append(f"registry entry `{skill_id}` must declare a non-empty `executable`")
            else:
                executable_path, executable_error = _resolve_inside(
                    skills_root,
                    executable,
                    label=f"registry entry `{skill_id}` executable",
                )
                if executable_error:
                    errors.append(executable_error)
                elif executable_path is None or not executable_path.exists():
                    errors.append(f"registry entry `{skill_id}` points to missing executable `{executable}`")
            if not isinstance(manifest, str) or not manifest:
                errors.append(f"registry entry `{skill_id}` must declare a non-empty `manifest`")
            else:
                manifest_path, manifest_error = _resolve_inside(
                    skills_root,
                    manifest,
                    label=f"registry entry `{skill_id}` manifest",
                )
                if manifest_error:
                    errors.append(manifest_error)
                elif manifest_path is None or not manifest_path.exists():
                    errors.append(f"registry entry `{skill_id}` points to missing manifest `{manifest}`")

    upgrade_path = skills_root / "upgrade-contract.json"
    upgrade_contract, upgrade_error = _load_json(upgrade_path)
    if upgrade_error:
        errors.append(upgrade_error)
    else:
        refresh_required = upgrade_contract.get("upgrade_policy", {}).get("refresh_required")
        if not isinstance(refresh_required, list) or "layout_manifest" not in refresh_required:
            errors.append("`upgrade-contract.json` must require refreshing `layout_manifest`")

    status = "pass" if not errors else "block"
    summary = (
        "registry, upgrade contract, and skill entrypoints are consistent."
        if status == "pass"
        else "registry or upgrade contract drifted from the installed runtime layout."
    )
    return _check(status, summary, evidence={"path": str(registry_path)}), errors, registry_path


def _validate_shared_runtime(skills_root: Path) -> tuple[dict[str, Any], list[str], Path]:
    errors: list[str] = []
    scripts_root = skills_root / "shared" / "scripts"
    if not scripts_root.exists():
        errors.append(f"missing shared runtime scripts root `{scripts_root}`")
    else:
        for script_name in EXPECTED_SHARED_RUNTIME_SCRIPTS:
            if not (scripts_root / script_name).exists():
                errors.append(f"missing shared runtime script `shared/scripts/{script_name}`")
    status = "pass" if not errors else "block"
    summary = (
        "shared runtime scripts are present and executable roots can be resolved."
        if status == "pass"
        else "shared runtime scripts are missing or incomplete."
    )
    return _check(status, summary, evidence={"path": str(scripts_root)}), errors, scripts_root


def _validate_referenced_resources(skills_root: Path) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    required_resources = (
        "shared/assets/templates/scaffold/spec.md",
        "shared/assets/templates/scaffold/plan.md",
        "shared/assets/github/PULL_REQUEST_TEMPLATE.md",
        "shared/references/harness/status-surface-contract.md",
        "shared/references/harness/status-surface.md",
        "shared/references/harness/runtime-state.md",
        "shared/references/harness/gate-chain.md",
        "shared/references/harness/controlled-merge.md",
        "shared/references/harness/pr-merge-gate.md",
        "shared/references/harness/governance-failure-taxonomy.md",
        "shared/references/harness/governance-lint-taxonomy.md",
        "shared/references/harness/host-binding-inspector.md",
        "shared/references/harness/native-dependency-contract.md",
        "shared/references/governance/governance-maturity-model.md",
        "shared/references/governance/goal-schema.md",
        "shared/references/adoption/github-profile-upgrade.md",
    )
    for relative in required_resources:
        if not (skills_root / relative).exists():
            errors.append(f"missing referenced resource `{relative}`")
    status = "pass" if not errors else "block"
    summary = (
        "shared references and assets required by the installed runtime are present."
        if status == "pass"
        else "shared references or assets required by the runtime are missing."
    )
    return _check(status, summary), errors


def _validate_bootstrapped_runtime(caller_file: str) -> tuple[dict[str, Any], list[str], Path | None]:
    errors: list[str] = []
    runtime_root = bootstrap_runtime_root(caller_file)
    manifest_path = bootstrap_manifest_path(caller_file)
    if runtime_root is None or manifest_path is None:
        errors.append("bootstrap runtime root or manifest path is unavailable")
        return _check("block", "bootstrapped target runtime is missing its bootstrap carrier."), errors, manifest_path

    if not runtime_root.exists():
        errors.append(f"missing bootstrapped runtime root `{runtime_root}`")
    manifest, manifest_error = _load_json(manifest_path)
    if manifest_error:
        errors.append(manifest_error)
        return _check("block", "bootstrap manifest is missing or invalid."), errors, manifest_path

    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        errors.append("bootstrap manifest must declare a non-empty `artifacts` list")
        return _check("block", "bootstrap manifest does not describe runtime artifacts."), errors, manifest_path

    artifact_by_path = {
        artifact.get("path"): artifact
        for artifact in artifacts
        if isinstance(artifact, dict) and isinstance(artifact.get("path"), str)
    }
    for relative, expected_source in EXPECTED_BOOTSTRAP_RUNTIME_SOURCES.items():
        artifact = artifact_by_path.get(relative)
        if artifact is None:
            errors.append(f"bootstrap manifest is missing runtime artifact `{relative}`")
            continue
        if artifact.get("source") != expected_source:
            errors.append(
                f"bootstrap runtime artifact `{relative}` must point to `{expected_source}`, got `{artifact.get('source')}`"
            )
        runtime_file = runtime_root / Path(relative).name
        if not runtime_file.exists():
            errors.append(f"bootstrapped runtime file is missing: `{relative}`")
            continue
        expected_hash = artifact.get("sha256")
        if not isinstance(expected_hash, str) or not expected_hash.strip():
            errors.append(f"bootstrap runtime artifact `{relative}` must declare sha256 provenance")
            continue
        actual_hash = sha256_file(runtime_file)
        if actual_hash != expected_hash:
            errors.append(f"bootstrap runtime artifact `{relative}` sha256 drifted")

    status = "pass" if not errors else "block"
    summary = (
        "bootstrap manifest and .loom/bin runtime files are aligned."
        if status == "pass"
        else "bootstrap manifest or .loom/bin runtime files drifted from the expected bundled runtime."
    )
    return _check(status, summary, evidence={"path": str(manifest_path)}), errors, manifest_path


def detect_runtime_state(caller_file: str, entry_family: str, *, target_root: Path | None = None) -> dict[str, Any]:
    if entry_family not in SUPPORTED_ENTRY_FAMILIES:
        raise RuntimeError(f"unsupported entry family `{entry_family}`")

    caller = caller_path(caller_file)
    carrier = detect_carrier(caller_file)
    scene, scene_check, scene_errors = _scene_check(carrier)
    install_root = installed_skills_root(caller_file)
    runtime_root = bootstrap_runtime_root(caller_file) or caller.parent
    layout_or_manifest_path: Path | None = None
    registry_location: Path | None = None
    checks: dict[str, dict[str, Any]] = {
        "scene_marker": scene_check,
    }
    errors = list(scene_errors)

    if carrier is None:
        checks["carrier_layout"] = _check("block", "runtime carrier cannot be classified from the current entrypoint.")
        checks["registry_contract"] = _check("not_applicable", "no carrier-specific registry contract is available.")
        checks["shared_runtime"] = _check("not_applicable", "no carrier-specific runtime root is available.")
        checks["referenced_resources"] = _check("not_applicable", "no carrier-specific resources can be inspected.")
    elif carrier in {"repo-local-wrapper", "installed-skills-root"}:
        if install_root is None:
            checks["carrier_layout"] = _check("block", "installed skills root is unavailable for the active carrier.")
            errors.append("installed skills root is unavailable")
        else:
            carrier_errors: list[str] = []
            try:
                shared = shared_root(caller_file)
            except RuntimeError as exc:
                carrier_errors.append(str(exc))
                shared = install_root / "shared"
            if carrier == "repo-local-wrapper":
                repo_root = repo_local_root(caller_file)
                if repo_root is None:
                    carrier_errors.append("repo-local wrapper is missing `LOOM_SOURCE_REPO_ROOT`")
                elif not _path_is_inside(install_root, repo_root):
                    carrier_errors.append("repo-local wrapper install root must stay inside the source repository")
            if not shared.exists():
                carrier_errors.append(f"shared runtime root is missing: {shared}")
            checks["carrier_layout"] = _check(
                "pass" if not carrier_errors else "block",
                (
                    "carrier layout exposes an installed skills root and shared runtime tree."
                    if not carrier_errors
                    else "carrier layout does not expose the expected installed skills root or shared runtime tree."
                ),
                evidence={"install_root": str(install_root)},
            )
            errors.extend(carrier_errors)

            registry_check, registry_errors, registry_location = _validate_registry_contract(install_root)
            layout_check, layout_errors, layout_or_manifest_path = _validate_install_layout(install_root)
            shared_check, shared_errors, _ = _validate_shared_runtime(install_root)
            resources_check, resources_errors = _validate_referenced_resources(install_root)
            checks["registry_contract"] = registry_check
            checks["shared_runtime"] = shared_check
            checks["referenced_resources"] = resources_check
            if layout_check["status"] == "block":
                if checks["carrier_layout"]["status"] == "pass":
                    checks["carrier_layout"] = _check(
                        "block",
                        "carrier layout is present but its install layout manifest is incomplete.",
                        evidence=layout_check.get("evidence"),
                    )
                errors.extend(layout_errors)
            errors.extend(registry_errors)
            errors.extend(shared_errors)
            errors.extend(resources_errors)
    else:
        carrier_check, carrier_errors, layout_or_manifest_path = _validate_bootstrapped_runtime(caller_file)
        checks["carrier_layout"] = carrier_check
        checks["registry_contract"] = _check(
            "not_applicable",
            "bootstrapped target runtime does not consume `skills/registry.json`; it uses `.loom/bootstrap/manifest.json`.",
        )
        checks["shared_runtime"] = carrier_check
        checks["referenced_resources"] = _check(
            "not_applicable",
            "bootstrapped target runtime validates copied runtime artifacts via the bootstrap manifest instead of shared references.",
        )
        errors.extend(carrier_errors)

    unique_errors: list[str] = []
    for message in errors:
        if message not in unique_errors:
            unique_errors.append(message)

    result = "pass" if not unique_errors else "block"
    if result == "pass":
        summary = f"runtime carrier `{carrier}` is executing as `{scene}` with a consistent bundled runtime."
    else:
        summary = "runtime state is inconsistent with the expected carrier/layout contract."

    if carrier == "installed-skills-root":
        fallback_to = "refresh-install" if unique_errors else None
    elif carrier == "bootstrapped-target-runtime":
        fallback_to = "rebootstrap-runtime" if unique_errors else None
    else:
        fallback_to = "manual-runtime-reconciliation" if unique_errors else None

    return {
        "result": result,
        "summary": summary,
        "missing_inputs": unique_errors,
        "fallback_to": fallback_to,
        "scene": scene,
        "carrier": carrier,
        "entry_family": entry_family,
        "install_root": _path_text(install_root),
        "runtime_root": _path_text(runtime_root),
        "registry_path": _path_text(registry_location),
        "layout_or_manifest_path": _path_text(layout_or_manifest_path),
        "source_repo_root": _path_text(source_repo_root()),
        "target_root": _path_text(target_root.resolve() if target_root is not None else None),
        "checks": checks,
    }
