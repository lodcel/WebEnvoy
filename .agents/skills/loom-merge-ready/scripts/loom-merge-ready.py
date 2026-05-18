#!/usr/bin/env python3
from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve()
PACKAGE_ROOT = SCRIPT_PATH.parents[1]
RUNTIME_ROOT = PACKAGE_ROOT / ".loom-runtime"

os.environ.setdefault("LOOM_INSTALLED_SKILLS_ROOT", str(PACKAGE_ROOT.parent))
os.environ.setdefault("LOOM_PACKAGE_SKILL_ID", "loom-merge-ready")


def target_root_from_argv(argv: list[str]) -> Path | None:
    for index, arg in enumerate(argv):
        if arg == "--target" and index + 1 < len(argv):
            return Path(argv[index + 1]).expanduser().resolve()
        if arg.startswith("--target="):
            return Path(arg.split("=", 1)[1]).expanduser().resolve()
    return None


target_root = target_root_from_argv(sys.argv[1:])
if target_root is not None:
    repo_runtime = target_root / ".loom/bin/loom_flow.py"
    if repo_runtime.exists():
        os.execv(sys.executable, [sys.executable, str(repo_runtime), *sys.argv[1:]])

sys.path.insert(0, str(RUNTIME_ROOT / "shared/scripts"))
runpy.run_path(RUNTIME_ROOT / "shared/scripts/loom_flow.py", run_name="__main__")
