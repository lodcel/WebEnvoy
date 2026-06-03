#!/usr/bin/env python3
"""Validate repo-local Loom story carriers."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

from fact_chain_support import parse_work_item

STORY_MARKERS = (
    "loom-user-story/v1",
    "loom-story-readiness/v1",
    "loom-story-business-confirmation/v1",
    "loom-story-delivery-mapping/v1",
)
PLACEHOLDER_MARKERS = (
    "a clear product or system starting point",
    "the actor uses the target capability",
    "the intended outcome is observable",
    "pending | confirmed | revision-requested | not_applicable",
)
EMPTY_FIELD_MARKERS = (
    "- Actor:",
    "- Capability:",
    "- Outcome:",
    "- Business value:",
    "- Out of scope:",
    "- Decision:",
    "- Scenario id:",
    "- Scenario locator:",
    "- Business Confirmation locator:",
)


def story_files(stories_root: Path) -> list[Path]:
    return sorted(
        path
        for path in stories_root.glob("*.md")
        if path.name != "_template.md" and path.is_file()
    )


def validate_story_file(target_root: Path, story_path: Path) -> list[str]:
    relative = story_path.relative_to(target_root).as_posix()
    item_id = story_path.stem
    errors: list[str] = []
    if not item_id:
        return [f"{relative}: story file name must be `.loom/stories/<item-id>.md`"]

    work_item_path = target_root / ".loom/work-items" / f"{item_id}.md"
    if not work_item_path.exists():
        errors.append(f"{relative}: matching work item is missing: .loom/work-items/{item_id}.md")
    else:
        work_item, parse_errors = parse_work_item(work_item_path, target_root)
        errors.extend(parse_errors)
        artifacts = work_item.get("associated_artifacts")
        if not isinstance(artifacts, list) or relative not in artifacts:
            errors.append(f"{relative}: matching work item must register the story in Associated Artifacts")

    try:
        text = story_path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"{relative}: unreadable story carrier: {exc}"]
    for marker in STORY_MARKERS:
        if marker not in text:
            errors.append(f"{relative}: missing schema marker `{marker}`")
    has_empty_fields = any(re.search(rf"^{re.escape(marker)}\s*$", text, re.MULTILINE) for marker in EMPTY_FIELD_MARKERS)
    if has_empty_fields or any(marker in text for marker in PLACEHOLDER_MARKERS):
        errors.append(f"{relative}: copied template placeholders must be replaced before the story can pass")
    if re.search(r"^-\s*Decision:\s*(pending|revision-requested)\s*$", text, re.MULTILINE):
        errors.append(f"{relative}: story business confirmation must be confirmed or not_applicable before delivery consumption")
    if not re.search(r"^-\s*Scenario id:\s*\S+", text, re.MULTILINE):
        errors.append(f"{relative}: at least one scenario id is required for spec / plan consumption")
    if not re.search(r"^-\s*Scenario locator:\s*\S+", text, re.MULTILINE):
        errors.append(f"{relative}: at least one scenario locator is required for spec / plan consumption")
    has_business_confirmation_locator = bool(
        re.search(r"^-\s*Business Confirmation locator:\s*\S+", text, re.MULTILINE)
    )
    has_not_applicable_rationale = bool(
        re.search(r"^-\s*Bypass rationale, if `?not_applicable`?:\s*\S+", text, re.MULTILINE)
        or re.search(r"^-\s*Bypass rationale, if not applicable:\s*\S+", text, re.MULTILINE)
    )
    if not has_business_confirmation_locator and not has_not_applicable_rationale:
        errors.append(f"{relative}: story must expose a Business Confirmation locator or not_applicable rationale")
    return errors


def payload(target_root: Path) -> dict[str, Any]:
    stories_root = target_root / ".loom/stories"
    template = stories_root / "_template.md"
    errors: list[str] = []
    if not stories_root.exists():
        errors.append("missing story carrier directory: .loom/stories")
    if not template.exists():
        errors.append("missing story carrier template: .loom/stories/_template.md")

    checked: list[str] = []
    if stories_root.exists():
        for path in story_files(stories_root):
            checked.append(path.relative_to(target_root).as_posix())
            errors.extend(validate_story_file(target_root, path))

    result = "pass" if not errors else "block"
    return {
        "schema_version": "loom-story-carriers-check/v1",
        "result": result,
        "summary": (
            "story carriers are registered and schema-marked."
            if result == "pass"
            else "story carriers are missing, unregistered, or still contain template placeholders."
        ),
        "checked": checked,
        "missing_inputs": errors,
        "fallback_to": None if result == "pass" else "story-intake",
    }


def main(argv: list[str]) -> int:
    if len(argv) > 2:
        print("usage: loom_story_carriers.py [repo-root]", file=sys.stderr)
        return 2
    target_root = Path(argv[1] if len(argv) == 2 else ".").expanduser().resolve()
    result = payload(target_root)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
