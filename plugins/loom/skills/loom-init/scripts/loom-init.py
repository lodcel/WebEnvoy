#!/usr/bin/env python3
from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path

os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
sys.dont_write_bytecode = True
SCRIPT_PATH = Path(__file__).resolve()
PACKAGE_ROOT = SCRIPT_PATH.parents[1]
RUNTIME_ROOT = PACKAGE_ROOT / ".loom-runtime"

os.environ.setdefault("LOOM_INSTALLED_SKILLS_ROOT", str(RUNTIME_ROOT))
os.environ.setdefault("LOOM_PACKAGE_SKILL_ID", "loom-init")
sys.path.insert(0, str(RUNTIME_ROOT / "shared/scripts"))
runpy.run_path(RUNTIME_ROOT / "shared/scripts/loom_init.py", run_name="__main__")
