#!/usr/bin/env python3
import base64
import importlib.util
import json
import pathlib
import tempfile
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "pr_guardian" / "review_status.py"
spec = importlib.util.spec_from_file_location("review_status", MODULE_PATH)
review_status = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(review_status)


def encode_meta(meta):
    return base64.b64encode(json.dumps(meta, separators=(",", ":")).encode("utf-8")).decode("ascii")


class ReviewStatusTest(unittest.TestCase):
    def setUp(self):
        self.ctx = {
            "repo_slug": "owner/repo",
            "pr_number": "274",
            "requesting_user": "human-reviewer",
            "trusted_reviewers": ["github-actions[bot]", "poller[bot]"],
            "strict_prompt_digest": "1",
            "pr_author": "pr-author",
            "head_sha": "head-sha",
            "base_ref": "main",
            "base_sha": "base-sha",
            "merge_base_sha": "merge-base",
            "review_profile": "high_risk_impl_profile",
            "review_basis_digest": "basis-digest",
            "guardian_runtime_sha256": "runtime-sha",
            "prompt_digest": "prompt-digest",
            "review_item_id": "github-pr-274",
            "expected_spec_locator": "",
            "expected_spec_scope": [],
            "allow_legacy_schema_authority": "0",
        }

    def loom_record(self, decision="allow"):
        return {
            "schema_version": "loom-review/v1",
            "item_id": "github-pr-274",
            "decision": decision,
            "kind": "code_review",
            "summary": "summary",
            "reviewer": "loom/default-codex-exec",
            "reviewed_head": "head-sha",
            "reviewed_validation_summary": "validation summary",
            "fallback_to": None,
            "findings": [],
            "blocking_issues": [],
            "follow_ups": [],
        }

    def review_body(self, *, decision="allow", safe=True, runtime="runtime-sha", body_text="review body"):
        record = self.loom_record(decision)
        verdict = "APPROVE" if safe else "REQUEST_CHANGES"
        meta = {
            "source_authority": "loom_review_record",
            "head_sha": "head-sha",
            "base_ref": "main",
            "merge_base_sha": "merge-base",
            "review_profile": "high_risk_impl_profile",
            "review_basis_digest": "basis-digest",
            "guardian_runtime_sha256": runtime,
            "prompt_digest": "prompt-digest",
            "review_body_sha256": review_status.review_body_sha256(body_text),
            "loom_review_record_sha256": review_status.canonical_json_sha256(record),
            "loom_review_record": record,
            "verdict": verdict,
            "safe_to_merge": safe,
            "compatibility_verdict": verdict,
            "compatibility_safe_to_merge": safe,
        }
        return f"{body_text}\n<!-- webenvoy-guardian-meta:v1 {encode_meta(meta)} -->\n"

    def reviews_payload(self, reviewer="github-actions[bot]", state="APPROVED", body=None):
        return [
            [
                {
                    "id": 41,
                    "user": {"login": reviewer},
                    "commit_id": "head-sha",
                    "state": state,
                    "submitted_at": "2026-04-07T10:00:00Z",
                    "body": body if body is not None else self.review_body(),
                }
            ]
        ]

    def test_annotation_removes_metadata_and_hashes_cleaned_body(self):
        payload = review_status.normalize_reviews_payload(self.reviews_payload())
        review = payload[0][0]

        self.assertEqual(review["cleaned_body"], "review body")
        self.assertEqual(review["cleaned_body_sha256"], review_status.review_body_sha256("review body"))

    def test_trusted_bot_review_is_reusable_without_local_proof(self):
        status = review_status.evaluate_review_status(
            reviews_payload=self.reviews_payload(),
            proof_store={"proofs": {}},
            proof_store_available=False,
            ctx=self.ctx,
        )

        self.assertTrue(status["reusable"])
        self.assertEqual(status["reason"], "matching_metadata")
        self.assertEqual(status["verdict"], "APPROVE")
        self.assertTrue(status["safe_to_merge"])

    def test_human_review_requires_matching_local_proof(self):
        status = review_status.evaluate_review_status(
            reviews_payload=self.reviews_payload(reviewer="human-reviewer"),
            proof_store={"proofs": {}},
            proof_store_available=True,
            ctx=self.ctx,
        )
        self.assertFalse(status["reusable"])
        self.assertEqual(status["reason"], "missing_review")

        body = self.review_body()
        proof = {
            "repo_slug": "owner/repo",
            "pr_number": "274",
            "review_id": "41",
            "reviewer_login": "human-reviewer",
            "head_sha": "head-sha",
            "base_ref": "main",
            "merge_base_sha": "merge-base",
            "review_profile": "high_risk_impl_profile",
            "review_basis_digest": "basis-digest",
            "guardian_runtime_sha256": "runtime-sha",
            "prompt_digest": "prompt-digest",
            "review_body_sha256": review_status.review_body_sha256(body),
            "source_authority": "loom_review_record",
            "loom_review_record_sha256": review_status.canonical_json_sha256(self.loom_record()),
            "loom_spec_review_record_sha256": "",
            "verdict": "APPROVE",
            "safe_to_merge": True,
            "review_state": "APPROVED",
            "submitted_at": "2026-04-07T10:00:00Z",
        }
        status = review_status.evaluate_review_status(
            reviews_payload=self.reviews_payload(reviewer="human-reviewer", body=body),
            proof_store={"proofs": {"41": proof}},
            proof_store_available=True,
            ctx=self.ctx,
        )

        self.assertTrue(status["reusable"])
        self.assertEqual(status["reviewer_login"], "human-reviewer")

    def test_invalid_metadata_fails_closed(self):
        status = review_status.evaluate_review_status(
            reviews_payload=self.reviews_payload(body="review body\n<!-- webenvoy-guardian-meta:v1 bm90LWpzb24= -->\n"),
            proof_store={"proofs": {}},
            proof_store_available=False,
            ctx=self.ctx,
        )

        self.assertFalse(status["reusable"])
        self.assertEqual(status["reason"], "invalid_metadata")

    def test_hydrate_result_falls_back_to_blocking_summary(self):
        result = review_status.hydrate_result({"verdict": "REQUEST_CHANGES", "safe_to_merge": False})

        self.assertEqual(result["verdict"], "REQUEST_CHANGES")
        self.assertFalse(result["safe_to_merge"])
        self.assertIn("阻断", result["summary"])

    def test_proof_store_recovers_from_invalid_json_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = pathlib.Path(tmp) / "proofs.json"
            store.write_text("{invalid-json", encoding="utf-8")

            payload, available = review_status.load_proof_store(store)

        self.assertFalse(available)
        self.assertEqual(payload, {"proofs": {}})


if __name__ == "__main__":
    unittest.main()
