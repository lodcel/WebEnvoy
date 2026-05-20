#!/usr/bin/env python3
import argparse
import importlib.util
import json
import pathlib
import tempfile
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "pr_guardian" / "merge_ready_signals.py"
spec = importlib.util.spec_from_file_location("merge_ready_signals", MODULE_PATH)
merge_ready_signals = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(merge_ready_signals)


class MergeReadySignalsTest(unittest.TestCase):
    def write_json(self, root: pathlib.Path, name: str, payload):
        path = root / name
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return str(path)

    def test_build_merge_ready_input_includes_host_signals_and_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            pr_meta = self.write_json(
                root,
                "pr.json",
                {
                    "number": 274,
                    "title": "merge ready",
                    "body": "body",
                    "url": "https://example.test/pr/274",
                    "baseRefName": "main",
                    "baseRefOid": "base-sha",
                    "headRefName": "work/274",
                    "headRefOid": "head-sha",
                    "headRepoFullName": "owner/repo",
                    "isDraft": False,
                    "mergeable": "MERGEABLE",
                    "mergeStateStatus": "CLEAN",
                },
            )
            checks = self.write_json(root, "checks.json", [{"name": "Run Tests", "bucket": "pass"}])
            record = self.write_json(
                root,
                "review-record.json",
                {
                    "schema_version": "loom-review/v1",
                    "item_id": "github-pr-274",
                    "decision": "allow",
                    "findings": [],
                },
            )
            changed_files = root / "changed-files.txt"
            changed_files.write_text("scripts/pr-guardian.sh\n\nREADME.md\n", encoding="utf-8")

            args = argparse.Namespace(
                pr_number="274",
                pr_meta_file=pr_meta,
                checks_file=checks,
                checks_load_result="pass",
                checks_all_pass=True,
                reviewer_for_gate="review-bot",
                expected_review_state="APPROVED",
                review_state_visible=True,
                review_profile="high_risk_impl_profile",
                checked_commit="head-sha",
                snapshot_head_sha="head-sha",
                base_sha="fallback-base",
                source_authority="loom_review_record",
                implementation_record_locator=record,
                implementation_record_file=record,
                spec_review_record_locator="",
                spec_review_record_file="",
                changed_files_file=str(changed_files),
                spec_review_required=False,
            )

            payload = merge_ready_signals.build_merge_ready_input(args)

        self.assertEqual(payload["schema_version"], "webenvoy-merge-ready-signals/v1")
        self.assertEqual(payload["changed_files"], ["scripts/pr-guardian.sh", "README.md"])
        self.assertEqual(payload["pr"]["head_sha"], "head-sha")
        self.assertTrue(payload["github_checks"]["all_pass"])
        self.assertEqual(payload["review"]["implementation_record"]["decision"], "allow")
        self.assertRegex(payload["review"]["implementation_record_sha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(payload["retained_host_action_results"]["github_review_state"]["visible"])
        self.assertEqual(
            payload["retained_host_action_results"]["controlled_merge_wrapper"]["action"],
            "host_merge_after_loom_allow",
        )

    def test_validate_merge_ready_result_requires_current_head_and_authority(self):
        merge_ready_signals.validate_merge_ready_result(
            {
                "schema_version": "loom-merge-ready-result/v1",
                "result": "pass",
                "decision": "allow",
                "pr": {"number": 274, "head_sha": "head-sha", "checked_commit": "head-sha"},
                "provenance": {"authority": "loom_merge_ready"},
            },
            pr_number="274",
            head_sha="head-sha",
        )

        with self.assertRaisesRegex(ValueError, "checked commit does not match PR head"):
            merge_ready_signals.validate_merge_ready_result(
                {
                    "schema_version": "loom-merge-ready-result/v1",
                    "result": "fail",
                    "decision": "block",
                    "pr": {"number": 274, "head_sha": "head-sha", "checked_commit": "old-head"},
                    "provenance": {"authority": "loom_merge_ready"},
                    "missing_inputs": ["checked commit does not match PR head"],
                },
                pr_number="274",
                head_sha="head-sha",
            )


if __name__ == "__main__":
    unittest.main()
