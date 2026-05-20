#!/usr/bin/env python3
"""Reusable guardian review status and proof-store helpers."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


META_RE = re.compile(r"\n?<!-- webenvoy-guardian-meta:v1 [A-Za-z0-9+/=]+ -->\n?")
META_CAPTURE_RE = re.compile(r"<!-- webenvoy-guardian-meta:v1 (?P<meta>[A-Za-z0-9+/=]+) -->")
COMPLETED_STATES = {"APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"}
VALID_DECISIONS = {"allow", "block", "fallback"}
VALID_FALLBACKS = {"admission", "build", "merge"}
VALID_VERDICTS = {"APPROVE", "REQUEST_CHANGES"}


def load_json(path: str | Path) -> Any:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: str | Path, payload: Any) -> None:
    with Path(path).open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def write_pretty_json(path: str | Path, payload: Any) -> None:
    with Path(path).open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def canonical_json_sha256(payload: Any) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def clean_review_body(body: Any) -> str:
    text = "" if body is None else str(body)
    return META_RE.sub("\n", text).rstrip()


def review_body_sha256(body: Any) -> str:
    return hashlib.sha256(clean_review_body(body).encode("utf-8")).hexdigest()


def normalize_reviews_payload(payload: Any) -> list[list[dict[str, Any]]]:
    if not isinstance(payload, list):
        return []
    pages: list[list[dict[str, Any]]] = []
    for page in payload:
        if not isinstance(page, list):
            pages.append([])
            continue
        normalized_page: list[dict[str, Any]] = []
        for review in page:
            if not isinstance(review, dict):
                continue
            row = dict(review)
            cleaned = clean_review_body(row.get("body", ""))
            row["cleaned_body"] = cleaned
            row["cleaned_body_sha256"] = hashlib.sha256(cleaned.encode("utf-8")).hexdigest()
            normalized_page.append(row)
        pages.append(normalized_page)
    return pages


def proof_store_path(codex_home: str | None = None) -> Path:
    root = codex_home or os.environ.get("CODEX_HOME") or str(Path.home() / ".codex")
    return Path(root) / "state" / "webenvoy-pr-guardian-proofs.json"


def ensure_proof_store(path: str | Path | None = None) -> Path:
    store = Path(path) if path else proof_store_path()
    store.parent.mkdir(parents=True, exist_ok=True)
    if not store.exists():
        write_pretty_json(store, {"proofs": {}})
    return store


def load_proof_store(path: str | Path | None = None) -> tuple[dict[str, Any], bool]:
    store = ensure_proof_store(path)
    try:
        payload = load_json(store)
    except (OSError, json.JSONDecodeError):
        return {"proofs": {}}, False
    if not isinstance(payload, dict):
        return {"proofs": {}}, False
    proofs = payload.get("proofs")
    if not isinstance(proofs, dict):
        payload["proofs"] = {}
    return payload, True


def persist_proof(args: argparse.Namespace) -> None:
    store = ensure_proof_store(args.proof_store)
    payload, _available = load_proof_store(store)
    proof = {
        "repo_slug": args.repo_slug,
        "pr_number": str(args.pr_number),
        "review_id": str(args.review_id),
        "reviewer_login": args.reviewer_login,
        "head_sha": args.head_sha,
        "base_ref": args.base_ref,
        "merge_base_sha": args.merge_base_sha,
        "review_profile": args.review_profile,
        "review_basis_digest": args.review_basis_digest,
        "guardian_runtime_sha256": args.guardian_runtime_sha256,
        "prompt_digest": args.prompt_digest,
        "review_body_sha256": args.review_body_sha256,
        "source_authority": args.source_authority,
        "loom_review_record_sha256": args.loom_review_record_sha256,
        "loom_spec_review_record_sha256": args.loom_spec_review_record_sha256,
        "verdict": args.verdict,
        "safe_to_merge": args.safe_to_merge,
        "review_state": args.review_state,
        "submitted_at": args.submitted_at,
        "recorded_at": args.recorded_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    payload.setdefault("proofs", {})[str(args.review_id)] = proof
    tmp = store.with_name(f"{store.name}.tmp")
    write_pretty_json(tmp, payload)
    tmp.replace(store)


def as_str(value: Any) -> str:
    return "" if value is None else str(value)


def sorted_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return sorted(item for item in value if isinstance(item, str))


def record_safe_to_merge(record: dict[str, Any]) -> bool:
    findings = record.get("findings")
    if not isinstance(findings, list):
        findings = []
    return record.get("decision") == "allow" and all(
        not (isinstance(finding, dict) and finding.get("severity") == "block")
        for finding in findings
    )


def record_verdict(record: dict[str, Any]) -> str:
    return "APPROVE" if record_safe_to_merge(record) else "REQUEST_CHANGES"


def valid_finding(finding: Any) -> bool:
    if not isinstance(finding, dict):
        return False
    if not isinstance(finding.get("id"), str) or not finding["id"]:
        return False
    if not isinstance(finding.get("summary"), str) or not finding["summary"]:
        return False
    if finding.get("severity") not in {"warn", "block"}:
        return False
    rebuttal = finding.get("rebuttal")
    if rebuttal is not None and (not isinstance(rebuttal, str) or not rebuttal):
        return False
    disposition = finding.get("disposition")
    if disposition is not None:
        if not isinstance(disposition, dict):
            return False
        if disposition.get("status") not in {"accepted", "rejected", "deferred"}:
            return False
        if not isinstance(disposition.get("summary"), str) or not disposition["summary"]:
            return False
    return True


def record_common_is_valid(record: Any, ctx: dict[str, Any]) -> bool:
    if not isinstance(record, dict):
        return False
    if record.get("schema_version") != "loom-review/v1":
        return False
    if record.get("item_id") != ctx["review_item_id"]:
        return False
    if record.get("decision") not in VALID_DECISIONS:
        return False
    if not isinstance(record.get("summary"), str) or not record["summary"]:
        return False
    if not isinstance(record.get("reviewer"), str) or not record["reviewer"]:
        return False
    if record.get("reviewed_head") != ctx["head_sha"]:
        return False
    if not isinstance(record.get("reviewed_validation_summary"), str) or not record["reviewed_validation_summary"]:
        return False
    if record.get("decision") == "fallback":
        if record.get("fallback_to") not in VALID_FALLBACKS:
            return False
    elif record.get("fallback_to") is not None:
        return False
    for key in ("findings", "blocking_issues", "follow_ups"):
        if not isinstance(record.get(key), list):
            return False
    return all(valid_finding(finding) for finding in record.get("findings", []))


def implementation_record_is_valid(record: Any, ctx: dict[str, Any]) -> bool:
    return record_common_is_valid(record, ctx) and record.get("kind") in {"general_review", "code_review"}


def spec_record_is_valid(record: Any, ctx: dict[str, Any]) -> bool:
    if not record_common_is_valid(record, ctx) or record.get("kind") != "spec_review":
        return False
    subject = record.get("review_subject")
    provenance = record.get("review_provenance")
    if not isinstance(subject, dict) or not isinstance(provenance, dict):
        return False
    if subject.get("pr_number") != str(ctx["pr_number"]):
        return False
    if subject.get("head_sha") != ctx["head_sha"]:
        return False
    if subject.get("base_sha") != ctx["base_sha"]:
        return False
    if subject.get("spec_locator") != ctx["expected_spec_locator"]:
        return False
    scope = subject.get("reviewed_scope")
    if not isinstance(scope, list) or not scope or not all(isinstance(item, str) and item for item in scope):
        return False
    if sorted_strings(scope) != sorted_strings(ctx["expected_spec_scope"]):
        return False
    if not isinstance(provenance.get("reviewer"), str) or not provenance["reviewer"]:
        return False
    if not isinstance(provenance.get("engine_adapter"), str) or not provenance["engine_adapter"]:
        return False
    return "fail_closed_reason" in provenance


def legacy_meta_is_valid(meta: Any, ctx: dict[str, Any]) -> bool:
    if ctx["allow_legacy_schema_authority"] != "1" or not isinstance(meta, dict):
        return False
    if meta.get("verdict") not in VALID_VERDICTS or not isinstance(meta.get("safe_to_merge"), bool):
        return False
    if not as_str(meta.get("guardian_runtime_sha256")):
        return False
    result = meta.get("result")
    return not isinstance(result, dict) or (
        result.get("verdict") == meta.get("verdict")
        and result.get("safe_to_merge") == meta.get("safe_to_merge")
    )


def authority_meta(meta: Any, ctx: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(meta, dict):
        return None
    source = meta.get("source_authority")
    if source == "loom_review_record":
        record = meta.get("loom_review_record")
        if not implementation_record_is_valid(record, ctx):
            return None
        return meta_from_record(meta, record)
    if source == "loom_spec_review_record":
        record = meta.get("loom_review_record")
        if not spec_record_is_valid(record, ctx):
            return None
        return meta_from_record(meta, record)
    if source == "loom_review_record_with_loom_spec_review_gate":
        record = meta.get("loom_review_record")
        spec_record = meta.get("loom_spec_review_record")
        if not implementation_record_is_valid(record, ctx) or not spec_record_is_valid(spec_record, ctx):
            return None
        record_v = record_verdict(record)
        combined_safe = record_safe_to_merge(record) and record_safe_to_merge(spec_record)
        combined_v = record_v if combined_safe else "REQUEST_CHANGES"
        if (
            not as_str(meta.get("loom_review_record_sha256"))
            or not as_str(meta.get("loom_spec_review_record_sha256"))
            or meta.get("verdict", combined_v) != combined_v
            or not isinstance(meta.get("safe_to_merge"), bool)
            or meta.get("safe_to_merge") != combined_safe
            or meta.get("compatibility_verdict", combined_v) != combined_v
            or not isinstance(meta.get("compatibility_safe_to_merge"), bool)
            or meta.get("compatibility_safe_to_merge") != combined_safe
        ):
            return None
        merged = dict(meta)
        merged.update(
            {
                "verdict": combined_v,
                "safe_to_merge": combined_safe,
                "result": {
                    "verdict": combined_v,
                    "safe_to_merge": combined_safe,
                    "summary": record.get("summary", ""),
                    "findings": [],
                    "required_actions": [],
                },
            }
        )
        return merged
    if legacy_meta_is_valid(meta, ctx):
        return dict(meta)
    return None


def meta_from_record(meta: dict[str, Any], record: dict[str, Any]) -> dict[str, Any] | None:
    verdict = record_verdict(record)
    safe = record_safe_to_merge(record)
    if (
        not as_str(meta.get("loom_review_record_sha256"))
        or meta.get("verdict", verdict) != verdict
        or not isinstance(meta.get("safe_to_merge"), bool)
        or meta.get("safe_to_merge") != safe
        or meta.get("compatibility_verdict", verdict) != verdict
        or not isinstance(meta.get("compatibility_safe_to_merge"), bool)
        or meta.get("compatibility_safe_to_merge") != safe
    ):
        return None
    merged = dict(meta)
    merged.update(
        {
            "verdict": verdict,
            "safe_to_merge": safe,
            "result": {
                "verdict": verdict,
                "safe_to_merge": safe,
                "summary": record.get("summary", ""),
                "findings": [],
                "required_actions": [],
            },
        }
    )
    return merged


def expected_state(verdict: str, reviewer: str, pr_author: str) -> str:
    if pr_author and pr_author == reviewer:
        return "COMMENTED"
    return "APPROVED" if verdict == "APPROVE" else "CHANGES_REQUESTED"


def review_key(review: dict[str, Any]) -> tuple[str, int, int]:
    try:
        review_id = int(review.get("id") or 0)
    except (TypeError, ValueError):
        review_id = 0
    return (as_str(review.get("submitted_at")), review_id, int(review.get("_index", 0)))


def latest_review(reviews: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not reviews:
        return None
    return sorted(reviews, key=review_key)[-1]


def group_latest_by_login(reviews: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_login: dict[str, list[dict[str, Any]]] = {}
    for review in sorted(reviews, key=lambda item: as_str((item.get("user") or {}).get("login"))):
        by_login.setdefault(as_str((review.get("user") or {}).get("login")), []).append(review)
    return [latest for items in by_login.values() if (latest := latest_review(items)) is not None]


def decode_review_meta(body: str) -> Any | None:
    matches = list(META_CAPTURE_RE.finditer(body))
    if not matches:
        return None
    encoded = matches[-1].group("meta")
    try:
        return json.loads(base64.b64decode(encoded).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return False


def normalize_review(review: dict[str, Any], ctx: dict[str, Any]) -> dict[str, Any]:
    row = dict(review)
    row["cleaned_body"] = as_str(row.get("cleaned_body"))
    decoded = decode_review_meta(as_str(row.get("body")))
    if decoded is None:
        row.update({"meta_status": "missing_metadata", "meta": None})
        return row
    auth_meta = None if decoded is False else authority_meta(decoded, ctx)
    if (
        decoded is False
        or auth_meta is None
        or not as_str(auth_meta.get("guardian_runtime_sha256"))
        or auth_meta.get("review_body_sha256") != row.get("cleaned_body_sha256")
    ):
        row.update({"meta_status": "invalid_metadata", "meta": None if decoded is False else decoded})
        return row
    login = as_str((row.get("user") or {}).get("login"))
    row.update(
        {
            "meta_status": "ok",
            "meta": auth_meta,
            "expected_state": expected_state(as_str(auth_meta.get("verdict")), login, ctx["pr_author"]),
        }
    )
    return row


def meta_safe_to_merge(review: dict[str, Any]) -> bool | None:
    meta = review.get("meta")
    if isinstance(meta, dict) and isinstance(meta.get("safe_to_merge"), bool):
        return meta["safe_to_merge"]
    return None


def review_id_string(review: dict[str, Any]) -> str:
    return as_str(review.get("id"))


def trusted_bot_reviewer(login: str, ctx: dict[str, Any]) -> bool:
    return login in ctx["trusted_reviewers"] and login.endswith("[bot]")


def proof_matches_remote_review(review: dict[str, Any], proofs: dict[str, Any], ctx: dict[str, Any]) -> bool:
    proof = proofs.get(review_id_string(review))
    meta = review.get("meta")
    if not isinstance(proof, dict) or not isinstance(meta, dict):
        return False
    return (
        as_str(proof.get("repo_slug")) == ctx["repo_slug"]
        and as_str(proof.get("pr_number")) == str(ctx["pr_number"])
        and as_str(proof.get("review_id")) == review_id_string(review)
        and as_str(proof.get("reviewer_login")) == as_str((review.get("user") or {}).get("login"))
        and as_str(proof.get("head_sha")) == as_str(review.get("commit_id"))
        and as_str(proof.get("base_ref")) == as_str(meta.get("base_ref"))
        and as_str(proof.get("merge_base_sha")) == as_str(meta.get("merge_base_sha"))
        and as_str(proof.get("review_profile")) == as_str(meta.get("review_profile"))
        and as_str(proof.get("review_basis_digest")) == as_str(meta.get("review_basis_digest"))
        and as_str(proof.get("guardian_runtime_sha256")) == as_str(meta.get("guardian_runtime_sha256"))
        and as_str(proof.get("prompt_digest")) == as_str(meta.get("prompt_digest"))
        and as_str(proof.get("review_body_sha256")) == as_str(review.get("cleaned_body_sha256"))
        and as_str(proof.get("source_authority")) == as_str(meta.get("source_authority"))
        and as_str(proof.get("loom_review_record_sha256")) == as_str(meta.get("loom_review_record_sha256"))
        and as_str(proof.get("loom_spec_review_record_sha256")) == as_str(meta.get("loom_spec_review_record_sha256"))
        and as_str(proof.get("verdict")) == as_str(meta.get("verdict"))
        and proof.get("safe_to_merge") == meta_safe_to_merge(review)
        and as_str(proof.get("review_state")) == as_str(review.get("state"))
        and as_str(proof.get("submitted_at")) == as_str(review.get("submitted_at"))
    )


def reviewer_trusted_for_reuse(review: dict[str, Any], proofs: dict[str, Any], proof_available: bool, ctx: dict[str, Any]) -> bool:
    login = as_str((review.get("user") or {}).get("login"))
    if trusted_bot_reviewer(login, ctx):
        return True
    return (
        proof_available
        and bool(ctx["requesting_user"])
        and login == ctx["requesting_user"]
        and not login.endswith("[bot]")
        and proof_matches_remote_review(review, proofs, ctx)
    )


def review_matches_reuse_basis(review: dict[str, Any], ctx: dict[str, Any]) -> bool:
    meta = review.get("meta")
    return (
        isinstance(meta, dict)
        and review.get("meta_status") == "ok"
        and meta.get("head_sha") == ctx["head_sha"]
        and meta.get("base_ref") == ctx["base_ref"]
        and meta.get("merge_base_sha") == ctx["merge_base_sha"]
        and meta.get("review_profile") == ctx["review_profile"]
        and meta.get("review_basis_digest") == ctx["review_basis_digest"]
        and meta.get("guardian_runtime_sha256") == ctx["guardian_runtime_sha256"]
        and (ctx["strict_prompt_digest"] != "1" or meta.get("prompt_digest", "") == ctx["prompt_digest"])
    )


def review_matches_current_context(review: dict[str, Any], ctx: dict[str, Any]) -> bool:
    return review_matches_reuse_basis(review, ctx) and review.get("state", "") == review.get("expected_state", "")


def review_regresses_merge_safety(review: dict[str, Any], reused: dict[str, Any], ctx: dict[str, Any]) -> bool:
    return review_matches_reuse_basis(review, ctx) and meta_safe_to_merge(reused) is True and meta_safe_to_merge(review) is False


def review_blocks_reuse(review: dict[str, Any], reused: dict[str, Any], ctx: dict[str, Any]) -> bool:
    if review.get("meta_status") == "missing_metadata":
        return review.get("state") != "COMMENTED"
    if review.get("meta_status") == "invalid_metadata":
        return True
    meta = review.get("meta")
    if not isinstance(meta, dict):
        return True
    return (
        meta.get("head_sha") != ctx["head_sha"]
        or meta.get("base_ref") != ctx["base_ref"]
        or meta.get("merge_base_sha") != ctx["merge_base_sha"]
        or meta.get("review_profile") != ctx["review_profile"]
        or meta.get("review_basis_digest") != ctx["review_basis_digest"]
        or meta.get("guardian_runtime_sha256") != ctx["guardian_runtime_sha256"]
        or (ctx["strict_prompt_digest"] == "1" and meta.get("prompt_digest", "") != ctx["prompt_digest"])
        or review.get("state", "") != review.get("expected_state", "")
        or review_regresses_merge_safety(review, reused, ctx)
    )


def status_payload_from_review(review: dict[str, Any], ctx: dict[str, Any], *, reusable: bool, reason: str) -> dict[str, Any]:
    meta = review.get("meta") if isinstance(review.get("meta"), dict) else {}
    payload = {
        "reusable": reusable,
        "reason": reason,
        "head_sha": ctx["head_sha"],
        "review_profile": ctx["review_profile"],
        "review_basis_digest": meta.get("review_basis_digest", "") if reusable else ctx["review_basis_digest"],
        "prompt_digest": meta.get("prompt_digest", ""),
        "verdict": meta.get("verdict"),
        "safe_to_merge": meta_safe_to_merge(review),
        "result": meta.get("result"),
        "base_ref": meta.get("base_ref", ""),
        "merge_base_sha": meta.get("merge_base_sha", ""),
        "review_state": review.get("state", ""),
        "review_id": review.get("id"),
        "review_body": review.get("cleaned_body", ""),
        "reviewer_login": as_str((review.get("user") or {}).get("login")),
    }
    if reusable:
        payload.update(
            {
                "source_authority": meta.get("source_authority", ""),
                "selected_adapter": meta.get("selected_adapter"),
                "selection_source": meta.get("selection_source"),
                "fallback_reason": meta.get("fallback_reason"),
                "binding_summary": meta.get("binding_summary"),
                "review_engine_metadata": meta.get("review_engine_metadata"),
                "loom_review_record_sha256": meta.get("loom_review_record_sha256", ""),
                "loom_review_record": meta.get("loom_review_record"),
                "loom_spec_review_record_sha256": meta.get("loom_spec_review_record_sha256", ""),
                "loom_spec_review_record": meta.get("loom_spec_review_record"),
            }
        )
    return payload


def evaluate_review_status(
    *,
    reviews_payload: Any,
    proof_store: dict[str, Any],
    proof_store_available: bool,
    ctx: dict[str, Any],
) -> dict[str, Any]:
    proofs = proof_store.get("proofs") if isinstance(proof_store.get("proofs"), dict) else {}
    flattened: list[dict[str, Any]] = []
    for page in normalize_reviews_payload(reviews_payload):
        for review in page:
            review["_index"] = len(flattened)
            if review.get("commit_id", "") == ctx["head_sha"] and review.get("state", "") in COMPLETED_STATES:
                flattened.append(normalize_review(review, ctx))

    matching = group_latest_by_login(
        [review for review in flattened if reviewer_trusted_for_reuse(review, proofs, proof_store_available, ctx)]
    )
    blocking_candidates = group_latest_by_login(
        [
            review
            for review in flattened
            if reviewer_trusted_for_reuse(review, proofs, proof_store_available, ctx)
            or review.get("meta_status") != "missing_metadata"
        ]
    )
    latest_matching = latest_review(matching)
    reusable_reviews = [review for review in matching if review_matches_current_context(review, ctx)]

    if not matching:
        return {
            "reusable": False,
            "reason": "missing_review",
            "head_sha": ctx["head_sha"],
            "review_profile": ctx["review_profile"],
            "review_basis_digest": ctx["review_basis_digest"],
            "prompt_digest": "",
            "verdict": None,
            "safe_to_merge": None,
            "reviewer_login": ctx["requesting_user"],
        }

    latest_reusable = latest_review(reusable_reviews)
    blocking_reviews: list[dict[str, Any]] = []
    if latest_reusable is not None:
        blocking_reviews = [
            review
            for review in blocking_candidates
            if review_key(review) > review_key(latest_reusable) and review_blocks_reuse(review, latest_reusable, ctx)
        ]
    if latest_reusable is not None and not blocking_reviews:
        return status_payload_from_review(latest_reusable, ctx, reusable=True, reason="matching_metadata")

    latest = latest_review(blocking_reviews) if blocking_reviews else latest_matching
    if latest is None:
        raise ValueError("internal review-status invariant failed")
    if latest.get("meta_status") == "missing_metadata":
        return {
            "reusable": False,
            "reason": "missing_metadata",
            "head_sha": ctx["head_sha"],
            "review_profile": ctx["review_profile"],
            "review_basis_digest": ctx["review_basis_digest"],
            "prompt_digest": "",
            "verdict": None,
            "safe_to_merge": None,
            "reviewer_login": as_str((latest.get("user") or {}).get("login")),
        }
    if latest.get("meta_status") == "invalid_metadata":
        return {
            "reusable": False,
            "reason": "invalid_metadata",
            "head_sha": ctx["head_sha"],
            "review_profile": ctx["review_profile"],
            "review_basis_digest": ctx["review_basis_digest"],
            "prompt_digest": "",
            "verdict": (latest.get("meta") or {}).get("verdict") if isinstance(latest.get("meta"), dict) else None,
            "safe_to_merge": meta_safe_to_merge(latest),
            "result": (latest.get("meta") or {}).get("result") if isinstance(latest.get("meta"), dict) else None,
            "reviewer_login": as_str((latest.get("user") or {}).get("login")),
        }

    meta = latest.get("meta") if isinstance(latest.get("meta"), dict) else {}
    if meta.get("head_sha") != ctx["head_sha"]:
        reason = "head_sha_mismatch"
    elif meta.get("base_ref") != ctx["base_ref"]:
        reason = "base_ref_mismatch"
    elif meta.get("merge_base_sha") != ctx["merge_base_sha"]:
        reason = "merge_base_sha_mismatch"
    elif meta.get("review_profile") != ctx["review_profile"]:
        reason = "review_profile_mismatch"
    elif meta.get("review_basis_digest") != ctx["review_basis_digest"]:
        reason = "review_basis_digest_mismatch"
    elif meta.get("guardian_runtime_sha256") != ctx["guardian_runtime_sha256"]:
        reason = "guardian_runtime_sha256_mismatch"
    elif ctx["strict_prompt_digest"] == "1" and meta.get("prompt_digest", "") != ctx["prompt_digest"]:
        reason = "prompt_digest_mismatch"
    elif latest_reusable is not None and review_regresses_merge_safety(latest, latest_reusable, ctx):
        reason = "newer_blocking_review"
    elif latest.get("state", "") != latest.get("expected_state", ""):
        reason = "review_state_mismatch"
    else:
        reason = "matching_metadata"
    return status_payload_from_review(latest, ctx, reusable=False, reason=reason)


def hydrate_result(status: dict[str, Any]) -> dict[str, Any]:
    result = status.get("result")
    if isinstance(result, dict):
        return result
    safe = status.get("safe_to_merge") is True
    return {
        "verdict": status.get("verdict"),
        "safe_to_merge": status.get("safe_to_merge"),
        "summary": "已复用当前 HEAD 的 guardian review 结论。" if safe else "已复用当前 HEAD 的 guardian 阻断结论。",
        "findings": [],
        "required_actions": [],
    }


def command_annotate(args: argparse.Namespace) -> None:
    write_json(args.output, normalize_reviews_payload(load_json(args.input)))


def command_proof_store_path(_args: argparse.Namespace) -> None:
    print(proof_store_path())


def command_ensure_proof_store(args: argparse.Namespace) -> None:
    print(ensure_proof_store(args.proof_store))


def command_load_proof_store(args: argparse.Namespace) -> None:
    payload, available = load_proof_store(args.proof_store)
    if not available:
        raise SystemExit(1)
    write_json(args.output, payload)


def command_persist_proof(args: argparse.Namespace) -> None:
    persist_proof(args)


def command_status(args: argparse.Namespace) -> None:
    proof_store, proof_available = load_proof_store(args.proof_store)
    if args.proof_store_available == "0":
        proof_store = {"proofs": {}}
        proof_available = False
    ctx = {
        "repo_slug": args.repo_slug,
        "pr_number": str(args.pr_number),
        "requesting_user": args.requesting_user,
        "trusted_reviewers": load_json(args.trusted_reviewers_file),
        "strict_prompt_digest": args.strict_prompt_digest,
        "pr_author": args.pr_author,
        "head_sha": args.head_sha,
        "base_ref": args.base_ref,
        "base_sha": args.base_sha,
        "merge_base_sha": args.merge_base_sha,
        "review_profile": args.review_profile,
        "review_basis_digest": args.review_basis_digest,
        "guardian_runtime_sha256": args.guardian_runtime_sha256,
        "prompt_digest": args.prompt_digest,
        "review_item_id": args.review_item_id,
        "expected_spec_locator": args.expected_spec_locator,
        "expected_spec_scope": load_json(args.expected_spec_scope_file),
        "allow_legacy_schema_authority": args.allow_legacy_schema_authority,
    }
    status = evaluate_review_status(
        reviews_payload=load_json(args.reviews_file),
        proof_store=proof_store,
        proof_store_available=proof_available,
        ctx=ctx,
    )
    write_json(args.output, status)


def command_hydrate(args: argparse.Namespace) -> None:
    status = load_json(args.status_file)
    write_json(args.result_output, hydrate_result(status))
    if isinstance(status.get("loom_review_record"), dict) and args.loom_record_output:
        write_json(args.loom_record_output, status["loom_review_record"])
    if isinstance(status.get("loom_spec_review_record"), dict) and args.spec_loom_record_output:
        write_json(args.spec_loom_record_output, status["loom_spec_review_record"])
    review_body = status.get("review_body")
    if isinstance(review_body, str) and review_body:
        Path(args.review_body_output).write_text(review_body + ("\n" if not review_body.endswith("\n") else ""), encoding="utf-8")
        print("review_body")
    else:
        print("build_markdown")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    proof_path = sub.add_parser("proof-store-path")
    proof_path.set_defaults(func=command_proof_store_path)

    ensure = sub.add_parser("ensure-proof-store")
    ensure.add_argument("--proof-store")
    ensure.set_defaults(func=command_ensure_proof_store)

    load = sub.add_parser("load-proof-store")
    load.add_argument("--proof-store")
    load.add_argument("--output", required=True)
    load.set_defaults(func=command_load_proof_store)

    annotate = sub.add_parser("annotate-reviews")
    annotate.add_argument("--input", required=True)
    annotate.add_argument("--output", required=True)
    annotate.set_defaults(func=command_annotate)

    persist = sub.add_parser("persist-proof")
    for name in (
        "repo-slug",
        "pr-number",
        "review-id",
        "reviewer-login",
        "head-sha",
        "base-ref",
        "merge-base-sha",
        "review-profile",
        "review-basis-digest",
        "guardian-runtime-sha256",
        "prompt-digest",
        "review-body-sha256",
        "source-authority",
        "loom-review-record-sha256",
        "loom-spec-review-record-sha256",
        "verdict",
        "review-state",
        "submitted-at",
    ):
        persist.add_argument(f"--{name}", required=True)
    persist.add_argument("--safe-to-merge", required=True, type=lambda value: value.lower() == "true")
    persist.add_argument("--recorded-at", default="")
    persist.add_argument("--proof-store")
    persist.set_defaults(func=command_persist_proof)

    status = sub.add_parser("status")
    for name in (
        "reviews-file",
        "repo-slug",
        "pr-number",
        "requesting-user",
        "trusted-reviewers-file",
        "strict-prompt-digest",
        "pr-author",
        "head-sha",
        "base-ref",
        "base-sha",
        "merge-base-sha",
        "review-profile",
        "review-basis-digest",
        "guardian-runtime-sha256",
        "prompt-digest",
        "review-item-id",
        "expected-spec-locator",
        "expected-spec-scope-file",
        "allow-legacy-schema-authority",
        "output",
    ):
        status.add_argument(f"--{name}", required=True)
    status.add_argument("--proof-store")
    status.add_argument("--proof-store-available", choices=("0", "1"), default="1")
    status.set_defaults(func=command_status)

    hydrate = sub.add_parser("hydrate")
    hydrate.add_argument("--status-file", required=True)
    hydrate.add_argument("--result-output", required=True)
    hydrate.add_argument("--review-body-output", required=True)
    hydrate.add_argument("--loom-record-output")
    hydrate.add_argument("--spec-loom-record-output")
    hydrate.set_defaults(func=command_hydrate)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
