#!/usr/bin/env python3
from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve()
SKILLS_ROOT = SCRIPT_PATH.parents[2]

os.environ.setdefault("LOOM_INSTALLED_SKILLS_ROOT", str(SKILLS_ROOT))
sys.path.insert(0, str(SKILLS_ROOT / "shared/scripts"))
runpy.run_path(SKILLS_ROOT / "shared/scripts/loom_init.py", run_name="__main__")
