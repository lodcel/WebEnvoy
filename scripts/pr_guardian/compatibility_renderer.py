#!/usr/bin/env python3
"""Compatibility rendering helpers for scripts/pr-guardian.sh."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


SEVERITY_BY_PRIORITY = {
    0: "critical",
    1: "high",
    2: "medium",
    3: "low",
}


def trim_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def to_int_or(value: Any, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        return int(value)
    return default


def to_float_or(value: Any, default: float) -> float:
    if value is None or isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value):
        return float(value)
    return default


def to_bool_or(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
    return default


def priority_num(value: Any) -> int:
    if value in (0, "0", "P0", "critical"):
        return 0
    if value in (1, "1", "P1", "high"):
        return 1
    if value in (2, "2", "P2", "medium"):
        return 2
    return 3


def severity_for(priority: int) -> str:
    return SEVERITY_BY_PRIORITY.get(priority, "low")


def load_json(path: str | Path) -> Any:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: str | Path, payload: Any) -> None:
    with Path(path).open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def normalized_findings(entries: Any, fallback_path: str) -> list[dict[str, Any]]:
    if not isinstance(entries, list):
        return []
    findings: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            entry = {}
        location = entry.get("code_location")
        if not isinstance(location, dict):
            location = {}
        line_range = location.get("line_range")
        if not isinstance(line_range, dict):
            line_range = {}

        priority = priority_num(entry.get("priority", entry.get("severity", 2)))
        title = trim_text(
            entry.get("title")
            or entry.get("summary")
            or entry.get("message")
            or "Native review finding"
        )
        details = trim_text(
            entry.get("details")
            or entry.get("body")
            or entry.get("summary")
            or entry.get("message")
            or title
        )
        path = trim_text(location.get("absolute_file_path") or entry.get("absolute_file_path") or "")
        absolute_path = path if path else fallback_path
        line_start = to_int_or(line_range.get("start", entry.get("line", 1)), 1)
        line_end = to_int_or(line_range.get("end", entry.get("end_line", line_start)), line_start)
        findings.append(
            {
                "severity": severity_for(priority),
                "title": title or "Native review finding",
                "details": details or title or "Native review finding",
                "code_location": {
                    "absolute_file_path": absolute_path,
                    "line_range": {
                        "start": line_start,
                        "end": line_end,
                    },
                },
                "confidence_score": to_float_or(entry.get("confidence_score", entry.get("confidence")), 0.5),
                "priority": priority,
            }
        )
    return findings


def coerce_result(payload: dict[str, Any], fallback_path: str) -> dict[str, Any]:
    findings = normalized_findings(payload.get("findings"), fallback_path)
    required_actions = sorted(
        {
            trim_text(action)
            for action in (payload.get("required_actions") if isinstance(payload.get("required_actions"), list) else [])
            if trim_text(action) and trim_text(action) not in {"修复：", "修复:"}
        }
    )
    summary = trim_text(payload.get("summary") or "")
    raw_verdict = trim_text(payload.get("verdict") or "")
    raw_safe = to_bool_or(payload.get("safe_to_merge", False), False)
    blocking_findings = [finding for finding in findings if finding["priority"] <= 2]
    can_approve = raw_verdict == "APPROVE" and not blocking_findings and not required_actions and raw_safe
    if not summary:
      summary = "未发现新的阻断性问题。" if can_approve else "发现会阻止当前 PR 合并的阻断性问题。"

    if required_actions:
        actions = required_actions
    elif can_approve:
        actions = []
    elif blocking_findings:
        actions = sorted({"修复：" + finding["title"] for finding in blocking_findings})
    else:
        actions = ["澄清 native review 结论"]

    return {
        "verdict": "APPROVE" if can_approve else "REQUEST_CHANGES",
        "safe_to_merge": can_approve,
        "summary": summary,
        "findings": findings,
        "required_actions": actions,
    }


def validate_result(payload: Any) -> None:
    def fail(message: str) -> None:
        raise ValueError(message)

    if not isinstance(payload, dict):
        fail("result must be an object")
    if payload.get("verdict") not in {"APPROVE", "REQUEST_CHANGES"}:
        fail("invalid verdict")
    if not isinstance(payload.get("safe_to_merge"), bool):
        fail("safe_to_merge must be boolean")
    if not isinstance(payload.get("summary"), str) or not payload["summary"]:
        fail("summary must be non-empty string")
    if not isinstance(payload.get("findings"), list):
        fail("findings must be array")
    if not isinstance(payload.get("required_actions"), list):
        fail("required_actions must be array")
    for action in payload["required_actions"]:
        if not isinstance(action, str) or not action:
            fail("required_actions entries must be non-empty strings")
    for finding in payload["findings"]:
        if not isinstance(finding, dict):
            fail("finding must be object")
        if finding.get("severity") not in {"critical", "high", "medium", "low"}:
            fail("invalid finding severity")
        if not isinstance(finding.get("title"), str) or not finding["title"] or len(finding["title"]) > 120:
            fail("invalid finding title")
        if not isinstance(finding.get("details"), str) or not finding["details"]:
            fail("invalid finding details")
        location = finding.get("code_location")
        if not isinstance(location, dict):
            fail("invalid code_location")
        if not isinstance(location.get("absolute_file_path"), str) or not location["absolute_file_path"]:
            fail("invalid absolute_file_path")
        line_range = location.get("line_range")
        if not isinstance(line_range, dict):
            fail("invalid line_range")
        for key in ("start", "end"):
            value = line_range.get(key)
            if not isinstance(value, int) or value < 1:
                fail(f"invalid line_range.{key}")
        confidence = finding.get("confidence_score")
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
            fail("invalid confidence_score")
        priority = finding.get("priority")
        if not isinstance(priority, int) or priority < 0 or priority > 3:
            fail("invalid priority")


def guardian_severity(loom_severity: str) -> str:
    return "high" if loom_severity == "block" else "low"


def guardian_priority(loom_severity: str) -> int:
    return 1 if loom_severity == "block" else 3


def record_approved(record: dict[str, Any]) -> bool:
    return record.get("decision") == "allow" and all(
        finding.get("severity") != "block"
        for finding in record.get("findings", [])
        if isinstance(finding, dict)
    )


def loom_review_record_to_guardian(record: dict[str, Any], *, spec: bool = False) -> dict[str, Any]:
    fallback_name = "Loom spec review record" if spec else "Loom review record"
    finding_name = "Loom spec review finding" if spec else "Loom review finding"
    approved = record_approved(record)
    findings = []
    for finding in record.get("findings", []):
        if not isinstance(finding, dict):
            finding = {}
        loom_severity = finding.get("severity")
        location = finding.get("code_location")
        if isinstance(location, dict):
            if spec:
                code_location = {
                    "absolute_file_path": location.get("path") or fallback_name,
                    "line_range": {
                        "start": location.get("line", 1),
                        "end": location.get("end_line", location.get("line", 1)),
                    },
                }
            else:
                code_location = location
        else:
            code_location = {"absolute_file_path": fallback_name, "line_range": {"start": 1, "end": 1}}
        findings.append(
            {
                "severity": guardian_severity(loom_severity),
                "title": trim_text(finding.get("summary") or finding_name)[:120],
                "details": trim_text(
                    ((finding.get("disposition") or {}).get("summary") if isinstance(finding.get("disposition"), dict) else None)
                    or finding.get("summary")
                    or finding_name
                ),
                "code_location": code_location,
                "confidence_score": 0.85 if spec else 0.8,
                "priority": guardian_priority(loom_severity),
            }
        )
    if approved:
        actions: list[str] = []
    elif findings:
        prefix = "修复 spec review 阻断：" if spec else "修复："
        actions = [prefix + finding["title"] for finding in findings]
    else:
        actions = [
            "修复 Loom spec review record 指出的阻断原因。"
            if spec
            else "修复 Loom review record 指出的阻断原因。"
        ]
    summary = trim_text(record.get("summary") or "")
    return {
        "verdict": "APPROVE" if approved else "REQUEST_CHANGES",
        "safe_to_merge": approved,
        "summary": ("Spec review authority: " + summary) if spec else summary,
        "findings": findings,
        "required_actions": actions,
    }


def guardian_result_to_loom_record(payload: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    approved = payload.get("verdict") == "APPROVE" and payload.get("safe_to_merge") is True
    findings = []
    for index, finding in enumerate(payload.get("findings") or [], start=1):
        severity = finding.get("severity", "high")
        findings.append(
            {
                "id": f"guardian-finding-{index}",
                "summary": trim_text(finding.get("title") or finding.get("details") or "Guardian review finding"),
                "severity": "block" if severity in {"critical", "high"} else "warn",
                "rebuttal": None,
                "disposition": {
                    "status": "accepted",
                    "summary": trim_text(
                        finding.get("details") or finding.get("title") or "Projected from WebEnvoy compatibility review output."
                    ),
                },
                "code_location": finding.get("code_location"),
            }
        )
    required_actions = [trim_text(action) for action in payload.get("required_actions") or []]
    return {
        "schema_version": "loom-review/v1",
        "item_id": args.item_id,
        "decision": "allow" if approved else "block",
        "kind": "code_review",
        "summary": trim_text(payload.get("summary") or ""),
        "reviewer": "webenvoy-guardian",
        "reviewed_head": args.reviewed_head,
        "reviewed_validation_summary": args.reviewed_validation_summary,
        "fallback_to": None,
        "findings": findings,
        "blocking_issues": [] if approved else required_actions,
        "follow_ups": required_actions if approved else [],
        "consumed_inputs": {
            "source": "webenvoy-guardian-compatibility-review",
            "compatibility_schema": "scripts/pr-review-result.schema.json",
            "review_basis_digest": args.review_basis_digest,
            "prompt_digest": args.prompt_digest,
            "base_ref": args.base_ref,
            "merge_base_sha": args.merge_base_sha,
            "review_profile": args.review_profile,
            "guardian_runtime_sha256": args.guardian_runtime_sha256,
        },
    }


def severity_label(severity: str) -> str:
    if severity == "critical":
        return "P0 / critical"
    if severity == "high":
        return "P1 / high"
    if severity == "medium":
        return "P2 / medium"
    return "P3 / low"


def render_markdown(payload: dict[str, Any], source_label: str) -> str:
    if payload.get("findings"):
        finding_lines = []
        for index, finding in enumerate(payload["findings"], start=1):
            location = finding.get("code_location") or {}
            line_range = location.get("line_range") if isinstance(location, dict) else {}
            line_suffix = ""
            if isinstance(line_range, dict) and line_range.get("start") is not None and line_range.get("end") is not None:
                line_suffix = f" (L{line_range['start']}-{line_range['end']})"
            block = (
                f"{index}. **[{severity_label(finding.get('severity'))}] {finding.get('title')}**\n"
                f"文件: `{location.get('absolute_file_path', '')}`{line_suffix}\n"
                f"说明: {finding.get('details')}"
            )
            if finding.get("confidence_score") is not None:
                block += f"\n置信度: {finding['confidence_score']}"
            if finding.get("priority") is not None:
                block += f"\n优先级: P{finding['priority']}"
            finding_lines.append(block)
        findings = "\n\n".join(finding_lines)
    else:
        findings = "- 未发现新的阻断性问题。"

    actions = payload.get("required_actions") or []
    action_text = "\n".join("- " + str(action) for action in actions) if actions else "- 无。"
    safe_text = "是" if payload.get("safe_to_merge") else "否"
    return (
        "## PR Review 结论\n\n"
        f"**Source authority**: {source_label}\n\n"
        f"**结论**: {payload.get('verdict')}\n\n"
        f"**允许合并**: {safe_text}\n\n"
        f"**摘要**: {payload.get('summary')}\n\n"
        "### 需要关注的问题\n\n"
        f"{findings}\n\n"
        "### 合并前动作\n\n"
        f"{action_text}\n"
    )


def command_coerce(args: argparse.Namespace) -> None:
    write_json(args.output, coerce_result(load_json(args.input), args.fallback_path))


def command_validate(args: argparse.Namespace) -> None:
    try:
        validate_result(load_json(args.input))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)


def command_record_to_guardian(args: argparse.Namespace) -> None:
    write_json(args.output, loom_review_record_to_guardian(load_json(args.input), spec=args.spec))


def command_guardian_to_record(args: argparse.Namespace) -> None:
    write_json(args.output, guardian_result_to_loom_record(load_json(args.input), args))


def command_markdown(args: argparse.Namespace) -> None:
    Path(args.output).write_text(render_markdown(load_json(args.input), args.source_label), encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    coerce = subparsers.add_parser("coerce-result")
    coerce.add_argument("--input", required=True)
    coerce.add_argument("--output", required=True)
    coerce.add_argument("--fallback-path", required=True)
    coerce.set_defaults(func=command_coerce)

    validate = subparsers.add_parser("validate-result")
    validate.add_argument("--input", required=True)
    validate.set_defaults(func=command_validate)

    record_to_guardian = subparsers.add_parser("record-to-guardian")
    record_to_guardian.add_argument("--input", required=True)
    record_to_guardian.add_argument("--output", required=True)
    record_to_guardian.add_argument("--spec", action="store_true")
    record_to_guardian.set_defaults(func=command_record_to_guardian)

    guardian_to_record = subparsers.add_parser("guardian-to-record")
    guardian_to_record.add_argument("--input", required=True)
    guardian_to_record.add_argument("--output", required=True)
    guardian_to_record.add_argument("--item-id", required=True)
    guardian_to_record.add_argument("--reviewed-head", required=True)
    guardian_to_record.add_argument("--reviewed-validation-summary", required=True)
    guardian_to_record.add_argument("--review-basis-digest", required=True)
    guardian_to_record.add_argument("--prompt-digest", required=True)
    guardian_to_record.add_argument("--base-ref", required=True)
    guardian_to_record.add_argument("--merge-base-sha", required=True)
    guardian_to_record.add_argument("--review-profile", required=True)
    guardian_to_record.add_argument("--guardian-runtime-sha256", required=True)
    guardian_to_record.set_defaults(func=command_guardian_to_record)

    markdown = subparsers.add_parser("markdown")
    markdown.add_argument("--input", required=True)
    markdown.add_argument("--output", required=True)
    markdown.add_argument("--source-label", required=True)
    markdown.set_defaults(func=command_markdown)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
