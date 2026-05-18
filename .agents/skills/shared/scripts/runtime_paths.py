#!/usr/bin/env python3
"""Resolve installed-skills runtime paths without assuming a repo-local layout."""

from __future__ import annotations

import os
from pathlib import Path


def caller_path(caller_file: str) -> Path:
    return Path(caller_file).resolve()


def installed_skills_root(caller_file: str) -> Path | None:
    env_root = os.environ.get("LOOM_INSTALLED_SKILLS_ROOT")
    if env_root:
        return Path(env_root).expanduser().resolve()

    path = caller_path(caller_file)
    if path.parent.name == "scripts" and path.parent.parent.name == "shared":
        return path.parents[2]
    if path.parent.name == "scripts" and path.parents[2].name == "skills":
        return path.parents[2]
    return None


def source_repo_root() -> Path | None:
    env_root = os.environ.get("LOOM_SOURCE_REPO_ROOT")
    if not env_root:
        return None
    return Path(env_root).expanduser().resolve()


def repo_local_root(caller_file: str) -> Path | None:
    hinted = source_repo_root()
    if hinted is not None:
        return hinted

    path = caller_path(caller_file)
    if path.parent.name == "bin" and path.parent.parent.name == ".loom":
        return path.parents[2]
    return None


def bootstrap_runtime_root(caller_file: str) -> Path | None:
    path = caller_path(caller_file)
    if path.parent.name == "bin" and path.parent.parent.name == ".loom":
        return path.parent
    return None


def bootstrap_manifest_path(caller_file: str) -> Path | None:
    runtime_root = bootstrap_runtime_root(caller_file)
    if runtime_root is None:
        return None
    return runtime_root.parent / "bootstrap" / "manifest.json"


def shared_root(caller_file: str) -> Path:
    skills_root = installed_skills_root(caller_file)
    if skills_root is None:
        raise RuntimeError("installed skills root is not available for this runtime")
    shared = skills_root / "shared"
    if not shared.exists():
        raise RuntimeError(f"shared runtime root is missing: {shared}")
    return shared


def shared_script(caller_file: str, script_name: str) -> Path:
    script_path = shared_root(caller_file) / "scripts" / script_name
    if not script_path.exists():
        raise RuntimeError(f"shared runtime script is missing: {script_path}")
    return script_path


def shared_asset(caller_file: str, relative_path: str) -> Path:
    asset_path = shared_root(caller_file) / "assets" / relative_path
    if not asset_path.exists():
        raise RuntimeError(f"shared runtime asset is missing: {asset_path}")
    return asset_path


def shared_reference(caller_file: str, relative_path: str) -> Path:
    reference_path = shared_root(caller_file) / "references" / relative_path
    if not reference_path.exists():
        raise RuntimeError(f"shared reference is missing: {reference_path}")
    return reference_path


def registry_path(caller_file: str) -> Path:
    skills_root = installed_skills_root(caller_file)
    if skills_root is not None:
        return skills_root / "registry.json"

    path = caller_path(caller_file)
    if path.parent.name == "bin" and path.parent.parent.name == ".loom":
        return path.parent.parent / "skills" / "registry.json"

    raise RuntimeError("registry path is unavailable outside installed-skills or .loom/bin runtime")


def install_layout_path(caller_file: str) -> Path:
    skills_root = installed_skills_root(caller_file)
    if skills_root is None:
        raise RuntimeError("install layout path is unavailable outside installed-skills runtime")
    return skills_root / "install-layout.json"


def installed_skill_script(caller_file: str, skill_id: str) -> Path:
    skills_root = installed_skills_root(caller_file)
    if skills_root is None:
        raise RuntimeError("installed skills root is not available for skill entry lookup")
    script_path = skills_root / skill_id / "scripts" / f"{skill_id}.py"
    if not script_path.exists():
        raise RuntimeError(f"installed skill entry script is missing: {script_path}")
    return script_path
