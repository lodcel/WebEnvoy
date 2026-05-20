#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "pr_guardian" / "compatibility_renderer.py"
spec = importlib.util.spec_from_file_location("compatibility_renderer", MODULE_PATH)
compatibility_renderer = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(compatibility_renderer)


class CompatibilityRendererTest(unittest.TestCase):
    def test_coerce_result_fails_closed_for_required_actions(self):
        result = compatibility_renderer.coerce_result(
            {
                "verdict": "APPROVE",
                "safe_to_merge": True,
                "summary": "Looks good",
                "required_actions": ["补充验证"],
            },
            "/repo/scripts/pr-guardian.sh",
        )

        self.assertEqual(result["verdict"], "REQUEST_CHANGES")
        self.assertFalse(result["safe_to_merge"])
        self.assertEqual(result["required_actions"], ["补充验证"])

    def test_loom_review_record_to_guardian_result_maps_block(self):
        result = compatibility_renderer.loom_review_record_to_guardian(
            {
                "decision": "block",
                "summary": "needs work",
                "findings": [
                    {
                        "summary": "Fix gate",
                        "severity": "block",
                        "disposition": {"summary": "Gate is unsafe"},
                        "code_location": {
                            "absolute_file_path": "scripts/pr-guardian.sh",
                            "line_range": {"start": 10, "end": 11},
                        },
                    }
                ],
            }
        )

        self.assertEqual(result["verdict"], "REQUEST_CHANGES")
        self.assertEqual(result["findings"][0]["severity"], "high")
        self.assertEqual(result["required_actions"], ["修复：Fix gate"])

    def test_spec_review_record_to_guardian_result_uses_spec_location_shape(self):
        result = compatibility_renderer.loom_review_record_to_guardian(
            {
                "decision": "allow",
                "summary": "spec approved",
                "findings": [
                    {
                        "summary": "Minor spec note",
                        "severity": "warn",
                        "code_location": {"path": "spec_review.md", "line": 3, "end_line": 4},
                    }
                ],
            },
            spec=True,
        )

        self.assertTrue(result["safe_to_merge"])
        self.assertEqual(result["summary"], "Spec review authority: spec approved")
        self.assertEqual(result["findings"][0]["code_location"]["absolute_file_path"], "spec_review.md")

    def test_render_markdown_preserves_compatibility_review_sections(self):
        markdown = compatibility_renderer.render_markdown(
            {
                "verdict": "APPROVE",
                "safe_to_merge": True,
                "summary": "No blockers",
                "findings": [],
                "required_actions": [],
            },
            "Loom review record",
        )

        self.assertIn("**Source authority**: Loom review record", markdown)
        self.assertIn("**结论**: APPROVE", markdown)
        self.assertIn("- 未发现新的阻断性问题。", markdown)


if __name__ == "__main__":
    unittest.main()
