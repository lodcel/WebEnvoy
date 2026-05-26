setup_review_status_fixture() {
  local case_name="$1"
  local pr_author="$2"
  local reviewer="$3"
  local review_state="$4"
  local verdict="$5"
  local safe_to_merge="$6"
  local include_metadata="${7:-1}"
  local metadata_mode="${8:-valid}"

  setup_case_dir "${case_name}"
  restore_test_repo_root

  HEAD_SHA="head-sha-123"
  BASE_REF="main"
  BASE_SHA="base-sha-123"
  MERGE_BASE_SHA="merge-base-sha-123"
  REVIEW_PROFILE="high_risk_impl_profile"
  REVIEW_BASIS_DIGEST="review-basis-digest-123"
  PROMPT_DIGEST="prompt-digest-123"
  PR_AUTHOR="${pr_author}"
  export HEAD_SHA BASE_REF MERGE_BASE_SHA REVIEW_PROFILE REVIEW_BASIS_DIGEST PROMPT_DIGEST PR_AUTHOR

  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/loom-review-record.json"
  PR_NUMBER="274"
  export LOOM_REVIEW_RECORD_FILE PR_NUMBER
  printf '{"verdict":"%s","safe_to_merge":%s,"summary":"summary","findings":[],"required_actions":[]}\n' "${verdict}" "${safe_to_merge}" > "${RESULT_FILE}"
  build_markdown_review "${RESULT_FILE}" "${REVIEW_MD_FILE}"

  case "${include_metadata}:${metadata_mode}" in
    1:valid)
      ;;
    1:invalid)
      perl -0pi -e 's/\n<!-- webenvoy-guardian-meta:v1 [A-Za-z0-9+\/=]+ -->\n?/\n<!-- webenvoy-guardian-meta:v1 bm90LWpzb24= -->\n/s' "${REVIEW_MD_FILE}"
      ;;
    0:*)
      perl -0pi -e 's/\n<!-- webenvoy-guardian-meta:v1 [A-Za-z0-9+\/=]+ -->\n?/\n/s' "${REVIEW_MD_FILE}"
      ;;
    *)
      echo "unknown metadata mode: ${metadata_mode}" >&2
      exit 1
      ;;
  esac

  local review_body_json
  review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"

  MOCK_GH_USER_LOGIN="${reviewer}"
  export MOCK_GH_USER_LOGIN

  MOCK_GH_PR_VIEW_JSON="${TEST_TMP_DIR}/${case_name}/mock/pr-view.json"
  printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}' > "${MOCK_GH_PR_VIEW_JSON}"
  export MOCK_GH_PR_VIEW_JSON

  MOCK_GH_CHECKS_JSON="${TEST_TMP_DIR}/${case_name}/mock/checks.json"
  printf '%s\n' '[{"name":"Run Tests","bucket":"pass","state":"SUCCESS","link":"https://example.test/tests"}]' > "${MOCK_GH_CHECKS_JSON}"
  export MOCK_GH_CHECKS_JSON

  MOCK_GH_REVIEWS_JSON="${TEST_TMP_DIR}/${case_name}/mock/reviews.json"
  printf '[[{"id":41,"user":{"login":"%s"},"commit_id":"%s","state":"%s","submitted_at":"2026-04-07T10:00:00Z","body":%s}]]\n' "${reviewer}" "${HEAD_SHA}" "${review_state}" "${review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"
  export MOCK_GH_REVIEWS_JSON
}

setup_spec_review_status_fixture() {
  local case_name="$1"
  local reviewer="$2"
  local review_state="$3"
  local decision="$4"
  local finding_severity="${5:-}"

  setup_case_dir "${case_name}"

  HEAD_SHA="head-sha-123"
  BASE_REF="main"
  BASE_SHA="base-sha-123"
  MERGE_BASE_SHA="merge-base-sha-123"
  REVIEW_PROFILE="spec_review_profile"
  REVIEW_BASIS_DIGEST="review-basis-digest-123"
  PROMPT_DIGEST="prompt-digest-123"
  PR_AUTHOR="pr-author"
  PR_NUMBER="274"
  export HEAD_SHA BASE_REF BASE_SHA MERGE_BASE_SHA REVIEW_PROFILE REVIEW_BASIS_DIGEST PROMPT_DIGEST PR_AUTHOR PR_NUMBER

  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  SPEC_LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/loom-spec-review-record.json"
  export CHANGED_FILES_FILE SPEC_LOOM_REVIEW_RECORD_FILE
  printf '%s\n' "docs/dev/specs/FR-0001-demo/spec.md" > "${CHANGED_FILES_FILE}"

  jq -n \
    --arg decision "${decision}" \
    --arg finding_severity "${finding_severity}" \
    --arg pr_number "${PR_NUMBER}" \
    --arg head_sha "${HEAD_SHA}" \
    --arg base_sha "${BASE_SHA}" \
    '
      ($finding_severity | length > 0) as $has_finding
      | {
          schema_version: "loom-review/v1",
          item_id: ("github-pr-" + $pr_number),
          decision: $decision,
          kind: "spec_review",
          summary: (if $decision == "allow" then "spec review approved" elif $decision == "fallback" then "spec review fallback" else "spec review blocked" end),
          reviewer: "loom/default-codex-exec",
          reviewed_head: $head_sha,
          reviewed_validation_summary: "spec validation summary",
          fallback_to: (if $decision == "fallback" then "build" else null end),
          findings: (
            if $has_finding then
              [{
                id: "spec-finding-1",
                summary: "spec finding",
                severity: $finding_severity,
                rebuttal: null,
                disposition: {status: "accepted", summary: "spec review finding accepted"}
              }]
            else
              []
            end
          ),
          blocking_issues: (if $finding_severity == "block" then ["spec finding"] else [] end),
          follow_ups: (if $finding_severity == "warn" then ["spec finding"] else [] end),
          review_subject: {
            pr_number: $pr_number,
            head_sha: $head_sha,
            base_sha: $base_sha,
            spec_locator: "spec_review.md",
            reviewed_scope: ["docs/dev/specs/FR-0001-demo/spec.md"]
          },
          review_provenance: {
            reviewer: "loom/default-codex-exec",
            engine_adapter: "loom/default-codex-exec",
            engine_profile: {profile_id: "spec-review"},
            engine_evidence: {raw_result: "mock"},
            normalized_findings: "mock-findings.json",
            fail_closed_reason: (if $decision == "fallback" then "fallback requested" else null end)
          },
          consumed_inputs: {
            source: "webenvoy-guardian-spec-review",
            spec_locator: "spec_review.md",
            reviewed_scope: ["docs/dev/specs/FR-0001-demo/spec.md"]
          }
        }
    ' > "${SPEC_LOOM_REVIEW_RECORD_FILE}"

  loom_spec_review_record_to_guardian_result "${SPEC_LOOM_REVIEW_RECORD_FILE}" "${RESULT_FILE}"
  build_markdown_review "${RESULT_FILE}" "${REVIEW_MD_FILE}"

  local review_body_json
  review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"

  MOCK_GH_USER_LOGIN="${reviewer}"
  export MOCK_GH_USER_LOGIN

  MOCK_GH_PR_VIEW_JSON="${TEST_TMP_DIR}/${case_name}/mock/pr-view.json"
  printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}' > "${MOCK_GH_PR_VIEW_JSON}"
  export MOCK_GH_PR_VIEW_JSON

  MOCK_GH_CHECKS_JSON="${TEST_TMP_DIR}/${case_name}/mock/checks.json"
  printf '%s\n' '[{"name":"Run Tests","bucket":"pass","state":"SUCCESS","link":"https://example.test/tests"}]' > "${MOCK_GH_CHECKS_JSON}"
  export MOCK_GH_CHECKS_JSON

  MOCK_GH_REVIEWS_JSON="${TEST_TMP_DIR}/${case_name}/mock/reviews.json"
  printf '[[{"id":41,"user":{"login":"%s"},"commit_id":"%s","state":"%s","submitted_at":"2026-04-07T10:00:00Z","body":%s}]]\n' "${reviewer}" "${HEAD_SHA}" "${review_state}" "${review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"
  export MOCK_GH_REVIEWS_JSON
}

setup_mixed_review_status_fixture() {
  local case_name="$1"
  local reviewer="$2"
  local review_state="$3"

  setup_case_dir "${case_name}"
  restore_test_repo_root

  HEAD_SHA="head-sha-123"
  BASE_REF="main"
  BASE_SHA="base-sha-123"
  MERGE_BASE_SHA="merge-base-sha-123"
  REVIEW_PROFILE="mixed_high_risk_spec_profile"
  REVIEW_BASIS_DIGEST="review-basis-digest-123"
  PROMPT_DIGEST="prompt-digest-123"
  PR_AUTHOR="pr-author"
  PR_NUMBER="274"
  export HEAD_SHA BASE_REF BASE_SHA MERGE_BASE_SHA REVIEW_PROFILE REVIEW_BASIS_DIGEST PROMPT_DIGEST PR_AUTHOR PR_NUMBER

  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/loom-review-record.json"
  SPEC_LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/loom-spec-review-record.json"
  export RESULT_FILE REVIEW_MD_FILE CHANGED_FILES_FILE LOOM_REVIEW_RECORD_FILE SPEC_LOOM_REVIEW_RECORD_FILE
  printf '%s\n' "docs/dev/specs/FR-0001-demo/spec.md" "scripts/pr-guardian.sh" > "${CHANGED_FILES_FILE}"
  printf '%s\n' '{"verdict":"APPROVE","safe_to_merge":true,"summary":"summary","findings":[],"required_actions":[]}' > "${RESULT_FILE}"
  write_loom_review_record_from_guardian_result "${RESULT_FILE}" "${LOOM_REVIEW_RECORD_FILE}"

  jq -n \
    --arg pr_number "${PR_NUMBER}" \
    --arg head_sha "${HEAD_SHA}" \
    --arg base_sha "${BASE_SHA}" \
    '{
      schema_version: "loom-review/v1",
      item_id: ("github-pr-" + $pr_number),
      decision: "allow",
      kind: "spec_review",
      summary: "spec review approved",
      reviewer: "loom/default-codex-exec",
      reviewed_head: $head_sha,
      reviewed_validation_summary: "spec validation summary",
      fallback_to: null,
      findings: [],
      blocking_issues: [],
      follow_ups: [],
      review_subject: {
        pr_number: $pr_number,
        head_sha: $head_sha,
        base_sha: $base_sha,
        spec_locator: "spec_review.md",
        reviewed_scope: ["docs/dev/specs/FR-0001-demo/spec.md"]
      },
      review_provenance: {
        reviewer: "loom/default-codex-exec",
        engine_adapter: "loom/default-codex-exec",
        engine_profile: {profile_id: "spec-review"},
        engine_evidence: {raw_result: "mock"},
        normalized_findings: "mock-findings.json",
        fail_closed_reason: null
      }
    }' > "${SPEC_LOOM_REVIEW_RECORD_FILE}"

  build_markdown_review "${RESULT_FILE}" "${REVIEW_MD_FILE}"

  local review_body_json
  review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"

  MOCK_GH_USER_LOGIN="${reviewer}"
  export MOCK_GH_USER_LOGIN

  MOCK_GH_PR_VIEW_JSON="${TEST_TMP_DIR}/${case_name}/mock/pr-view.json"
  printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}' > "${MOCK_GH_PR_VIEW_JSON}"
  export MOCK_GH_PR_VIEW_JSON

  MOCK_GH_CHECKS_JSON="${TEST_TMP_DIR}/${case_name}/mock/checks.json"
  printf '%s\n' '[{"name":"Run Tests","bucket":"pass","state":"SUCCESS","link":"https://example.test/tests"}]' > "${MOCK_GH_CHECKS_JSON}"
  export MOCK_GH_CHECKS_JSON

  MOCK_GH_REVIEWS_JSON="${TEST_TMP_DIR}/${case_name}/mock/reviews.json"
  printf '[[{"id":41,"user":{"login":"%s"},"commit_id":"%s","state":"%s","submitted_at":"2026-04-07T10:00:00Z","body":%s}]]\n' "${reviewer}" "${HEAD_SHA}" "${review_state}" "${review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"
  export MOCK_GH_REVIEWS_JSON
}

rewrite_guardian_metadata() {
  local source_file="$1"
  local target_file="$2"
  local jq_filter="$3"
  local metadata_file="${TMP_DIR}/guardian-meta.json"
  local rewritten_metadata_file="${TMP_DIR}/guardian-meta.rewritten.json"
  local encoded_metadata

  perl -MMIME::Base64=decode_base64 -0ne '
    if (/<!-- webenvoy-guardian-meta:v1 ([A-Za-z0-9+\/=]+) -->/) {
      print decode_base64($1);
    }
  ' "${source_file}" > "${metadata_file}"

  jq -cS "${jq_filter}" "${metadata_file}" > "${rewritten_metadata_file}"
  encoded_metadata="$(perl -MMIME::Base64=encode_base64 -0777 -ne 'print encode_base64($_, q{})' "${rewritten_metadata_file}")"

  GUARDIAN_META_B64="${encoded_metadata}" perl -0pe '
    s/<!-- webenvoy-guardian-meta:v1 [A-Za-z0-9+\/=]+ -->/"<!-- webenvoy-guardian-meta:v1 " . $ENV{GUARDIAN_META_B64} . " -->"/eg
  ' "${source_file}" > "${target_file}"
}

replace_mock_review_body() {
  local review_file="$1"
  local reviewer="${2:-github-actions[bot]}"
  local review_state="${3:-APPROVED}"
  local review_body_json

  review_body_json="$(jq -Rs . < "${review_file}")"
  printf '[[{"id":41,"user":{"login":"%s"},"commit_id":"%s","state":"%s","submitted_at":"2026-04-07T10:00:00Z","body":%s}]]\n' "${reviewer}" "${HEAD_SHA}" "${review_state}" "${review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"
}

test_review_status_reports_reusable_review_for_matching_metadata() {
  setup_review_status_fixture \
    "review-status-reusable" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.verdict' "${status_file}")" "APPROVE"
  assert_equal "$(jq -r '.safe_to_merge' "${status_file}")" "true"
  assert_equal "$(jq -r '.review_basis_digest' "${status_file}")" "review-basis-digest-123"
  assert_file_not_contains "${MOCK_GH_CALLS_LOG}" "collaborators/"
}

test_review_status_reports_reusable_review_from_other_reviewer() {
  setup_review_status_fixture \
    "review-status-reusable-other-reviewer" \
    "pr-author" \
    "poller[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.reviewer_login' "${status_file}")" "poller[bot]"
  assert_file_not_contains "${MOCK_GH_CALLS_LOG}" "collaborators/"
}

test_spec_review_status_reports_reusable_allow_record() {
  setup_spec_review_status_fixture \
    "spec-review-status-allow" \
    "github-actions[bot]" \
    "APPROVED" \
    "allow"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.verdict' "${status_file}")" "APPROVE"
  assert_equal "$(jq -r '.safe_to_merge' "${status_file}")" "true"
  assert_file_contains "${REVIEW_MD_FILE}" "**Source authority**: Loom spec review record"
}

test_spec_review_status_reports_reusable_block_record() {
  setup_spec_review_status_fixture \
    "spec-review-status-block" \
    "github-actions[bot]" \
    "CHANGES_REQUESTED" \
    "block" \
    "block"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.verdict' "${status_file}")" "REQUEST_CHANGES"
  assert_equal "$(jq -r '.safe_to_merge' "${status_file}")" "false"
}

test_spec_review_status_reports_reusable_fallback_record() {
  setup_spec_review_status_fixture \
    "spec-review-status-fallback" \
    "github-actions[bot]" \
    "CHANGES_REQUESTED" \
    "fallback" \
    "block"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.safe_to_merge' "${status_file}")" "false"
}

test_spec_review_status_rejects_missing_record() {
  setup_spec_review_status_fixture \
    "spec-review-status-missing-record" \
    "github-actions[bot]" \
    "APPROVED" \
    "allow"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/missing-spec-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" 'del(.loom_review_record)'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_spec_review_status_rejects_stale_head() {
  setup_spec_review_status_fixture \
    "spec-review-status-stale-head" \
    "github-actions[bot]" \
    "APPROVED" \
    "allow"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/stale-spec-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" '.loom_review_record.reviewed_head = "old-head-sha" | .loom_review_record.review_subject.head_sha = "old-head-sha"'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_spec_review_status_rejects_malformed_record() {
  setup_spec_review_status_fixture \
    "spec-review-status-malformed" \
    "github-actions[bot]" \
    "APPROVED" \
    "allow"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/malformed-spec-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" '.loom_review_record.schema_version = "loom-review/v2"'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_spec_review_status_rejects_spec_locator_mismatch() {
  setup_spec_review_status_fixture \
    "spec-review-status-locator-mismatch" \
    "github-actions[bot]" \
    "APPROVED" \
    "allow"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/locator-mismatch-spec-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" '.loom_review_record.review_subject.spec_locator = "code_review.md"'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_spec_review_status_rejects_target_scope_mismatch() {
  setup_spec_review_status_fixture \
    "spec-review-status-target-mismatch" \
    "github-actions[bot]" \
    "APPROVED" \
    "allow"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/target-mismatch-spec-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" '.loom_review_record.review_subject.reviewed_scope = ["docs/dev/specs/FR-9999-wrong/spec.md"]'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_mixed_review_status_rejects_human_proof_when_spec_record_sha_mismatches() {
  setup_mixed_review_status_fixture \
    "mixed-review-status-human-proof-spec-sha-mismatch" \
    "human-reviewer" \
    "APPROVED"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  override_local_guardian_proof_field "41" "loom_spec_review_record_sha256" "tampered-spec-sha"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_untrusted_bot_reviewer() {
  setup_review_status_fixture \
    "review-status-untrusted-bot-reviewer" \
    "pr-author" \
    "other-bot[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_does_not_auto_trust_requesting_bot_reviewer() {
  setup_review_status_fixture \
    "review-status-requesting-bot-not-auto-trusted" \
    "pr-author" \
    "other-bot[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 "other-bot[bot]" "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_untrusted_other_reviewer() {
  setup_review_status_fixture \
    "review-status-untrusted-other-reviewer" \
    "pr-author" \
    "other-human" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_allows_invoking_human_reviewer_in_strict_mode() {
  setup_review_status_fixture \
    "review-status-invoking-human-strict" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.reviewer_login' "${status_file}")" "human-reviewer"
}

test_light_review_status_rejects_invoking_human_reviewer_without_proof() {
  setup_review_status_fixture \
    "review-status-invoking-human-light" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_light_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_light_review_status_allows_invoking_human_reviewer_with_proof() {
  setup_review_status_fixture \
    "review-status-invoking-human-light-proof" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  assert_pass write_light_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.reviewer_login' "${status_file}")" "human-reviewer"
}

test_light_review_status_rejects_other_human_reviewer() {
  setup_review_status_fixture \
    "review-status-other-human-light" \
    "pr-author" \
    "other-human" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_light_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_light_review_status_rejects_other_human_reviewer_even_with_proof() {
  setup_review_status_fixture \
    "review-status-other-human-light-proof" \
    "pr-author" \
    "other-human" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "other-human" "APPROVED" "2026-04-07T10:00:00Z"
  assert_pass write_light_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_invoking_human_reviewer_when_proof_review_id_mismatches() {
  setup_review_status_fixture \
    "review-status-human-proof-review-id-mismatch" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "99" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_invoking_human_reviewer_when_proof_body_hash_mismatches() {
  setup_review_status_fixture \
    "review-status-human-proof-body-mismatch" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  override_local_guardian_proof_field "41" "review_body_sha256" "bad-proof-body"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_invoking_human_reviewer_when_proof_head_mismatches() {
  setup_review_status_fixture \
    "review-status-human-proof-head-mismatch" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  override_local_guardian_proof_field "41" "head_sha" "other-head"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_invoking_human_reviewer_when_proof_merge_base_mismatches() {
  setup_review_status_fixture \
    "review-status-human-proof-merge-base-mismatch" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  override_local_guardian_proof_field "41" "merge_base_sha" "other-merge-base"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_invoking_human_reviewer_when_proof_review_basis_mismatches() {
  setup_review_status_fixture \
    "review-status-human-proof-review-basis-mismatch" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  override_local_guardian_proof_field "41" "review_basis_digest" "other-review-basis"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_rejects_invoking_human_reviewer_when_proof_store_is_invalid() {
  setup_review_status_fixture \
    "review-status-human-proof-store-invalid" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  printf '%s\n' '{invalid-json' > "$(guardian_proof_store_file)"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_review"
}

test_review_status_allows_trusted_bot_reuse_when_proof_store_is_invalid() {
  setup_review_status_fixture \
    "review-status-bot-proof-store-invalid" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  printf '%s\n' '{invalid-json' > "$(guardian_proof_store_file)"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
}

test_review_status_reuses_valid_review_when_newer_trusted_comment_lacks_metadata() {
  setup_review_status_fixture \
    "review-status-reuse-older-valid-review" \
    "pr-author" \
    "poller[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local review_body_json
  review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"
  printf '[[{"id":41,"user":{"login":"poller[bot]"},"commit_id":"head-sha-123","state":"APPROVED","submitted_at":"2026-04-07T10:00:00Z","body":%s},{"id":42,"user":{"login":"human-reviewer"},"commit_id":"head-sha-123","state":"COMMENTED","submitted_at":"2026-04-07T10:05:00Z","body":"plain follow-up comment"}]]\n' "${review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.reviewer_login' "${status_file}")" "poller[bot]"
}

test_review_status_rejects_dismissed_latest_review() {
  setup_review_status_fixture \
    "review-status-dismissed-latest-review" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local review_body_json
  review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"
  printf '[[{"id":41,"user":{"login":"github-actions[bot]"},"commit_id":"head-sha-123","state":"APPROVED","submitted_at":"2026-04-07T10:00:00Z","body":%s},{"id":42,"user":{"login":"github-actions[bot]"},"commit_id":"head-sha-123","state":"DISMISSED","submitted_at":"2026-04-07T10:05:00Z","body":%s}]]\n' "${review_body_json}" "${review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "review_state_mismatch"
}

test_review_status_prefers_latest_trusted_review_over_older_approval() {
  setup_review_status_fixture \
    "review-status-latest-trusted-review-wins" \
    "pr-author" \
    "mcontheway" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local latest_result_file="${TMP_DIR}/latest-review.json"
  local latest_review_file="${TMP_DIR}/latest-review.md"
  local older_review_body_json
  local latest_review_body_json

  printf '%s\n' '{"verdict":"REQUEST_CHANGES","safe_to_merge":false,"summary":"blocked","findings":[],"required_actions":[]}' > "${latest_result_file}"
  RESULT_FILE="${latest_result_file}"
  REVIEW_MD_FILE="${latest_review_file}"
  LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/latest-loom-review-record.json"
  export LOOM_REVIEW_RECORD_FILE
  build_markdown_review "${RESULT_FILE}" "${REVIEW_MD_FILE}"
  latest_review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"

  older_review_body_json="$(jq -Rs . < "${TMP_DIR}/review.md")"
  printf '[[{"id":41,"user":{"login":"mcontheway"},"commit_id":"head-sha-123","state":"APPROVED","submitted_at":"2026-04-07T10:00:00Z","body":%s},{"id":42,"user":{"login":"github-actions[bot]"},"commit_id":"head-sha-123","state":"CHANGES_REQUESTED","submitted_at":"2026-04-07T10:05:00Z","body":%s}]]\n' "${older_review_body_json}" "${latest_review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"

  assert_pass write_review_status_json 274 github-actions[bot] "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reviewer_login' "${status_file}")" "github-actions[bot]"
  assert_equal "$(jq -r '.verdict' "${status_file}")" "REQUEST_CHANGES"
  assert_equal "$(jq -r '.safe_to_merge' "${status_file}")" "false"
}

test_review_status_rejects_older_bot_approval_when_newer_other_human_blocks() {
  setup_review_status_fixture \
    "review-status-newer-other-human-blocks-older-bot" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local latest_result_file="${TMP_DIR}/other-human-review.json"
  local latest_review_file="${TMP_DIR}/other-human-review.md"
  local older_review_body_json
  local latest_review_body_json

  older_review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"

  printf '%s\n' '{"verdict":"REQUEST_CHANGES","safe_to_merge":false,"summary":"blocked","findings":[],"required_actions":[]}' > "${latest_result_file}"
  RESULT_FILE="${latest_result_file}"
  REVIEW_MD_FILE="${latest_review_file}"
  LOOM_REVIEW_RECORD_FILE="${TMP_DIR}/other-human-loom-review-record.json"
  export LOOM_REVIEW_RECORD_FILE
  build_markdown_review "${RESULT_FILE}" "${REVIEW_MD_FILE}"
  latest_review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"

  printf '[[{"id":41,"user":{"login":"github-actions[bot]"},"commit_id":"head-sha-123","state":"APPROVED","submitted_at":"2026-04-07T10:00:00Z","body":%s},{"id":42,"user":{"login":"other-human"},"commit_id":"head-sha-123","state":"CHANGES_REQUESTED","submitted_at":"2026-04-07T10:05:00Z","body":%s}]]\n' "${older_review_body_json}" "${latest_review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "newer_blocking_review"
  assert_equal "$(jq -r '.reviewer_login' "${status_file}")" "other-human"
  assert_equal "$(jq -r '.verdict' "${status_file}")" "REQUEST_CHANGES"
  assert_equal "$(jq -r '.safe_to_merge' "${status_file}")" "false"
}

test_review_status_rejects_prompt_digest_mismatch() {
  setup_review_status_fixture \
    "review-status-prompt-digest-mismatch" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  PROMPT_DIGEST="prompt-digest-new"
  export PROMPT_DIGEST

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "prompt_digest_mismatch"
}

test_review_status_rejects_invoking_human_reviewer_when_prompt_digest_mismatches() {
  setup_review_status_fixture \
    "review-status-human-prompt-digest-mismatch" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  seed_local_guardian_proof "41" "human-reviewer" "APPROVED" "2026-04-07T10:00:00Z"
  PROMPT_DIGEST="prompt-digest-new"
  export PROMPT_DIGEST

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "prompt_digest_mismatch"
}

test_light_review_status_ignores_prompt_digest_mismatch() {
  setup_review_status_fixture \
    "review-status-light-prompt-digest-mismatch" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  PROMPT_DIGEST="prompt-digest-new"
  export PROMPT_DIGEST

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_light_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  assert_equal "$(jq -r '.review_basis_digest' "${status_file}")" "review-basis-digest-123"
  assert_equal "$(jq -r '.prompt_digest' "${status_file}")" "prompt-digest-123"
}

test_review_status_rejects_review_basis_digest_mismatch() {
  setup_review_status_fixture \
    "review-status-review-basis-digest-mismatch" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  REVIEW_BASIS_DIGEST="review-basis-digest-new"
  export REVIEW_BASIS_DIGEST

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "review_basis_digest_mismatch"
  assert_equal "$(jq -r '.review_basis_digest' "${status_file}")" "review-basis-digest-new"
}

test_review_status_rejects_missing_metadata() {
  setup_review_status_fixture \
    "review-status-missing-metadata" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "0"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "missing_metadata"
}

test_review_status_rejects_invalid_metadata() {
  setup_review_status_fixture \
    "review-status-invalid-metadata" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "invalid"

  local status_file="${TMP_DIR}/review-status.json"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_review_status_rejects_missing_loom_review_record() {
  setup_review_status_fixture \
    "review-status-missing-loom-record" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/missing-loom-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" 'del(.loom_review_record)'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_review_status_rejects_stale_loom_review_record_head() {
  setup_review_status_fixture \
    "review-status-stale-loom-record-head" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/stale-loom-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" '.loom_review_record.reviewed_head = "old-head-sha"'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_review_status_rejects_malformed_loom_review_record() {
  setup_review_status_fixture \
    "review-status-malformed-loom-record" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/malformed-loom-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" '.loom_review_record.schema_version = "loom-review/v2"'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_review_status_rejects_loom_record_fallback_on_allow() {
  setup_review_status_fixture \
    "review-status-loom-record-fallback-on-allow" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/fallback-on-allow-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" '.loom_review_record.fallback_to = "merge"'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_review_status_rejects_loom_record_missing_minimum_arrays() {
  setup_review_status_fixture \
    "review-status-loom-record-missing-arrays" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/missing-arrays-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" 'del(.loom_review_record.blocking_issues, .loom_review_record.follow_ups)'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_build_markdown_review_rejects_malformed_existing_loom_record() {
  setup_review_status_fixture \
    "review-status-build-rejects-malformed-record" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local review_file="${TMP_DIR}/malformed-existing-record.md"
  local err_file="${TMP_DIR}/malformed-existing-record.err"
  jq '.fallback_to = "merge" | del(.blocking_issues, .follow_ups)' "${LOOM_REVIEW_RECORD_FILE}" > "${LOOM_REVIEW_RECORD_FILE}.tmp"
  mv "${LOOM_REVIEW_RECORD_FILE}.tmp" "${LOOM_REVIEW_RECORD_FILE}"

  assert_fail build_markdown_review "${RESULT_FILE}" "${review_file}" 2>"${err_file}"
  assert_file_contains "${err_file}" "Loom review record 缺失、过期或格式错误"
}

test_loom_review_record_sha256_uses_hash_string_fallbacks() {
  setup_review_status_fixture \
    "review-status-record-hash-fallback" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local hash_bin="${TMP_DIR}/hash-bin"
  local original_path="${PATH}"
  mkdir -p "${hash_bin}"
  cat > "${hash_bin}/sha256sum" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
printf '%s  -\n' "mock-record-hash"
EOF
  cat > "${hash_bin}/shasum" <<'EOF'
#!/usr/bin/env bash
echo "shasum must not be used when sha256sum is available" >&2
exit 72
EOF
  chmod +x "${hash_bin}/sha256sum" "${hash_bin}/shasum"

  PATH="${hash_bin}:${PATH}"
  assert_equal "$(loom_review_record_sha256 "${LOOM_REVIEW_RECORD_FILE}")" "mock-record-hash"
  PATH="${original_path}"
}

test_review_status_rejects_contradictory_compatibility_verdict() {
  setup_review_status_fixture \
    "review-status-contradictory-compatibility-verdict" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/contradictory-loom-record-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${tampered_review_file}" \
    '.loom_review_record.decision = "block"
      | .verdict = "APPROVE"
      | .safe_to_merge = true
      | .compatibility_verdict = "APPROVE"
      | .compatibility_safe_to_merge = true'
  replace_mock_review_body "${tampered_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_review_status_legacy_schema_authority_requires_explicit_rollback_flag() {
  setup_review_status_fixture \
    "review-status-legacy-schema-rollback" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local legacy_review_file="${TMP_DIR}/legacy-schema-review.md"
  rewrite_guardian_metadata "${REVIEW_MD_FILE}" "${legacy_review_file}" \
    'del(.source_authority, .authority_role, .compatibility_verdict, .compatibility_safe_to_merge, .loom_review_record_sha256, .loom_review_record)'
  replace_mock_review_body "${legacy_review_file}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"

  PR_GUARDIAN_LEGACY_SCHEMA_AUTHORITY=1
  export PR_GUARDIAN_LEGACY_SCHEMA_AUTHORITY
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  assert_equal "$(jq -r '.reason' "${status_file}")" "matching_metadata"
  unset PR_GUARDIAN_LEGACY_SCHEMA_AUTHORITY
}

test_build_markdown_review_metadata_omits_embedded_result() {
  setup_review_status_fixture \
    "review-status-metadata-omits-result" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local metadata_file="${TMP_DIR}/guardian-meta.json"
  perl -MMIME::Base64=decode_base64 -0ne '
    if (/<!-- webenvoy-guardian-meta:v1 ([A-Za-z0-9+\/=]+) -->/) {
      print decode_base64($1);
    }
  ' "${REVIEW_MD_FILE}" > "${metadata_file}"

  assert_equal "$(jq -r 'has("result")' "${metadata_file}")" "false"
  assert_equal "$(jq -r '.source_authority' "${metadata_file}")" "loom_review_record"
  assert_equal "$(jq -r '.authority_role' "${metadata_file}")" "compatibility_rendering_mirror"
  assert_equal "$(jq -r '.loom_review_record.schema_version' "${metadata_file}")" "loom-review/v1"
  assert_file_contains "${REVIEW_MD_FILE}" "**Source authority**: Loom review record"
  assert_equal "$(jq -r '.verdict' "${metadata_file}")" "APPROVE"
  assert_equal "$(jq -r '.safe_to_merge' "${metadata_file}")" "true"
  if [[ -z "$(jq -r '.guardian_runtime_sha256 // ""' "${metadata_file}")" ]]; then
    echo "expected guardian metadata to include guardian_runtime_sha256" >&2
    exit 1
  fi
}

test_build_markdown_review_rejects_contradictory_existing_loom_record() {
  setup_review_status_fixture \
    "review-status-build-rejects-contradictory-record" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local rejected_result_file="${TMP_DIR}/rejected-review.json"
  local rejected_review_file="${TMP_DIR}/rejected-review.md"
  local err_file="${TMP_DIR}/rejected-review.err"

  printf '%s\n' '{"verdict":"REQUEST_CHANGES","safe_to_merge":false,"summary":"blocked","findings":[],"required_actions":["fix"]}' > "${rejected_result_file}"
  assert_fail build_markdown_review "${rejected_result_file}" "${rejected_review_file}" 2>"${err_file}"
  assert_file_contains "${err_file}" "Loom review record 与兼容 verdict 矛盾"
}

test_review_status_rejects_guardian_runtime_sha256_mismatch() {
  setup_review_status_fixture \
    "review-status-runtime-hash-mismatch" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/tampered-runtime-review.md"
  local tampered_review_body_json

  perl -MJSON::PP -MMIME::Base64=decode_base64,encode_base64 -0pe '
    s/<!-- webenvoy-guardian-meta:v1 ([A-Za-z0-9+\/=]+) -->/
      my $meta = JSON::PP->new->decode(decode_base64($1));
      $meta->{guardian_runtime_sha256} = "other-runtime-hash";
      "<!-- webenvoy-guardian-meta:v1 " . encode_base64(JSON::PP->new->canonical->encode($meta), q{}) . " -->"
    /eg
  ' "${REVIEW_MD_FILE}" > "${tampered_review_file}"
  tampered_review_body_json="$(jq -Rs . < "${tampered_review_file}")"
  printf '[[{"id":41,"user":{"login":"github-actions[bot]"},"commit_id":"%s","state":"APPROVED","submitted_at":"2026-04-07T10:00:00Z","body":%s}]]\n' "${HEAD_SHA}" "${tampered_review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "guardian_runtime_sha256_mismatch"
}

test_review_status_rejects_tampered_review_body() {
  setup_review_status_fixture \
    "review-status-tampered-review-body" \
    "pr-author" \
    "github-actions[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local tampered_review_file="${TMP_DIR}/tampered-review.md"
  local tampered_review_body_json
  sed 's/\*\*摘要\*\*: summary/**摘要**: tampered review body/' "${REVIEW_MD_FILE}" > "${tampered_review_file}"
  tampered_review_body_json="$(jq -Rs . < "${tampered_review_file}")"
  printf '[[{"id":41,"user":{"login":"github-actions[bot]"},"commit_id":"%s","state":"APPROVED","submitted_at":"2026-04-07T10:00:00Z","body":%s}]]\n' "${HEAD_SHA}" "${tampered_review_body_json}" > "${MOCK_GH_REVIEWS_JSON}"

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "false"
  assert_equal "$(jq -r '.reason' "${status_file}")" "invalid_metadata"
}

test_reused_request_changes_does_not_become_mergeable() {
  setup_review_status_fixture \
    "review-status-request-changes" \
    "pr-author" \
    "github-actions[bot]" \
    "CHANGES_REQUESTED" \
    "REQUEST_CHANGES" \
    "false" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  local err_file="${TMP_DIR}/merge.err"
  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reusable' "${status_file}")" "true"
  hydrate_reused_review_result "${status_file}" || {
    echo "expected hydrate_reused_review_result to pass" >&2
    exit 1
  }
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "implementation review decision is block"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_accepts_reused_review_from_other_reviewer() {
  setup_review_status_fixture \
    "merge-reused-review-other-reviewer" \
    "pr-author" \
    "poller[bot]" \
    "APPROVED" \
    "APPROVE" \
    "true" \
    "1" \
    "valid"

  local status_file="${TMP_DIR}/review-status.json"
  MOCK_GH_USER_LOGIN="human-reviewer"
  export MOCK_GH_USER_LOGIN

  assert_pass write_review_status_json 274 human-reviewer "${status_file}"
  assert_equal "$(jq -r '.reviewer_login' "${status_file}")" "poller[bot]"
  REUSED_REVIEWER_LOGIN="poller[bot]"
  export REUSED_REVIEWER_LOGIN
  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"
  assert_file_contains "${MOCK_GH_MERGE_LOG}" '"merge_method": "squash"'
  assert_file_contains "${MOCK_GH_MERGE_LOG}" '"sha": "head-sha-123"'
}

test_merge_if_safe_without_post_review_respects_comment_contract() {
  setup_merge_if_safe_fixture \
    "merge-without-post-review-comment-contract" \
    "review-bot" \
    "review-bot" \
    "COMMENTED" \
    "head-sha-123" \
    "0"

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"
}

test_merge_if_safe_allows_blocked_state_when_author_comment_review_is_visible() {
  setup_merge_if_safe_fixture \
    "merge-blocked-author-comment-review-visible" \
    "review-bot" \
    "review-bot" \
    "COMMENTED" \
    "head-sha-123" \
    "0"

  cat > "${MOCK_GH_PR_VIEW_JSON}" <<'EOF'
{
  "baseRefName": "main",
  "baseRefOid": "base-sha-123",
  "headRefName": "work/mock",
  "headRefOid": "head-sha-123",
  "headRepoFullName": "mcontheway/WebEnvoy",
  "mergeable": "MERGEABLE",
  "mergeStateStatus": "BLOCKED",
  "isDraft": false,
  "body": "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: false\n  trigger_reasons: N/A\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n\ncloseout_control:\n  issue_type: implementation\n  readiness_admission_status: static_and_gate_ready\n  readiness_matrix: N/A\n  live_validation_ladder: static tests\n  closeout_evidence: local validation\n  fallback_limitations: N/A\n  blocker_split_handling: N/A\n"
}
EOF

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"
}

test_merge_if_safe_blocks_blocked_state_when_required_checks_fail() {
  setup_merge_if_safe_fixture \
    "merge-blocked-required-check-failure" \
    "review-bot" \
    "review-bot" \
    "COMMENTED" \
    "head-sha-123" \
    "0"

  jq '.mergeStateStatus = "BLOCKED"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  MOCK_GH_REQUIRED_CHECKS_JSON="${TEST_TMP_DIR}/merge-blocked-required-check-failure/mock/required-checks.json"
  printf '%s\n' '[{"name":"review-completed","bucket":"pass","state":"SUCCESS","link":"https://example.test/review"},{"name":"Run Tests","bucket":"fail","state":"FAILURE","link":"https://example.test/tests"}]' > "${MOCK_GH_REQUIRED_CHECKS_JSON}"
  export MOCK_GH_REQUIRED_CHECKS_JSON

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "GitHub check"
  assert_file_contains "${err_file}" "Run Tests"
  assert_file_contains "${err_file}" "passing retained PR checks snapshot"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_finds_head_review_across_paginated_reviews() {
  setup_merge_if_safe_fixture \
    "merge-paginated-reviews" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "1"

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_CALLS_LOG}" "repos/mcontheway/WebEnvoy/pulls/274/reviews"
  assert_file_contains "${MOCK_GH_CALLS_LOG}" "--paginate"
}

test_merge_if_safe_rejects_review_from_old_head() {
  setup_merge_if_safe_fixture \
    "merge-review-old-head" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "older-head-sha" \
    "0"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "expected GitHub review state is not visible"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_required_checks_fail() {
  setup_merge_if_safe_fixture \
    "merge-required-check-failure" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  MOCK_GH_REQUIRED_CHECKS_JSON="${TEST_TMP_DIR}/merge-required-check-failure/mock/required-checks.json"
  printf '%s\n' '[{"name":"review-completed","bucket":"pass","state":"SUCCESS","link":"https://example.test/review"},{"name":"Run Tests","bucket":"fail","state":"FAILURE","link":"https://example.test/tests"}]' > "${MOCK_GH_REQUIRED_CHECKS_JSON}"
  export MOCK_GH_REQUIRED_CHECKS_JSON

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "Run Tests"
  assert_file_contains "${MOCK_GH_CALLS_LOG}" "commits/head-sha-123/check-runs"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_review_completed_check_fails() {
  setup_merge_if_safe_fixture \
    "merge-required-review-completed-failure" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  MOCK_GH_REQUIRED_CHECKS_JSON="${TEST_TMP_DIR}/merge-required-review-completed-failure/mock/required-checks.json"
  printf '%s\n' '[{"name":"review-completed","bucket":"fail","state":"FAILURE","link":"https://example.test/review"},{"name":"Run Tests","bucket":"pass","state":"SUCCESS","link":"https://example.test/tests"}]' > "${MOCK_GH_REQUIRED_CHECKS_JSON}"
  export MOCK_GH_REQUIRED_CHECKS_JSON

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "review-completed"
  assert_file_contains "${MOCK_GH_CALLS_LOG}" "commits/head-sha-123/check-runs"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_uses_latest_review_state_on_same_head() {
  setup_merge_if_safe_fixture \
    "merge-review-latest-state-same-head" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  printf '%s\n' '[[{"id":22,"user":{"login":"review-bot"},"commit_id":"head-sha-123","state":"APPROVED","submitted_at":"2026-03-26T10:00:00Z"},{"id":11,"user":{"login":"review-bot"},"commit_id":"head-sha-123","state":"CHANGES_REQUESTED","submitted_at":"2026-03-26T09:00:00Z"}]]' > "${MOCK_GH_REVIEWS_JSON}"

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"
}

test_post_review_fails_when_head_changes_after_review_snapshot() {
  setup_merge_if_safe_fixture \
    "post-review-head-drift" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  MOCK_GH_PR_VIEW_SEQUENCE_FILE="${TEST_TMP_DIR}/post-review-head-drift/mock/pr-view-seq.jsonl"
  printf '%s\n' '{"headRefOid":"head-sha-999"}' > "${MOCK_GH_PR_VIEW_SEQUENCE_FILE}"
  export MOCK_GH_PR_VIEW_SEQUENCE_FILE

  assert_fail post_review 274
  assert_file_empty "${MOCK_GH_REVIEW_LOG}"
}

test_merge_if_safe_fails_when_head_changes_after_review_snapshot() {
  setup_merge_if_safe_fixture \
    "merge-head-drift" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  MOCK_GH_PR_VIEW_SEQUENCE_FILE="${TEST_TMP_DIR}/merge-head-drift/mock/pr-view-seq.jsonl"
  printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-999","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}' > "${MOCK_GH_PR_VIEW_SEQUENCE_FILE}"
  export MOCK_GH_PR_VIEW_SEQUENCE_FILE

  assert_fail merge_if_safe 274 0
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_retries_until_merge_state_behind_recovers() {
  setup_merge_if_safe_fixture \
    "merge-state-behind" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  MOCK_GH_PR_VIEW_SEQUENCE_FILE="${TEST_TMP_DIR}/merge-state-behind/mock/pr-view-seq.jsonl"
  {
    printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","mergeable":"MERGEABLE","mergeStateStatus":"BEHIND","isDraft":false}'
    printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}'
  } > "${MOCK_GH_PR_VIEW_SEQUENCE_FILE}"
  export MOCK_GH_PR_VIEW_SEQUENCE_FILE

  PR_GUARDIAN_MERGE_STATE_MAX_ATTEMPTS=2
  PR_GUARDIAN_MERGE_STATE_RETRY_DELAY_SECONDS=0
  export PR_GUARDIAN_MERGE_STATE_MAX_ATTEMPTS
  export PR_GUARDIAN_MERGE_STATE_RETRY_DELAY_SECONDS

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"
}

test_merge_if_safe_fails_when_merge_state_unknown_never_recovers() {
  setup_merge_if_safe_fixture \
    "merge-state-unknown" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  MOCK_GH_PR_VIEW_SEQUENCE_FILE="${TEST_TMP_DIR}/merge-state-unknown/mock/pr-view-seq.jsonl"
  {
    printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","mergeable":"MERGEABLE","mergeStateStatus":"UNKNOWN","isDraft":false}'
    printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","mergeable":"MERGEABLE","mergeStateStatus":"UNKNOWN","isDraft":false}'
  } > "${MOCK_GH_PR_VIEW_SEQUENCE_FILE}"
  export MOCK_GH_PR_VIEW_SEQUENCE_FILE

  PR_GUARDIAN_MERGE_STATE_MAX_ATTEMPTS=2
  PR_GUARDIAN_MERGE_STATE_RETRY_DELAY_SECONDS=0
  export PR_GUARDIAN_MERGE_STATE_MAX_ATTEMPTS
  export PR_GUARDIAN_MERGE_STATE_RETRY_DELAY_SECONDS

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "GitHub mergeStateStatus is not merge-ready"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_retries_until_review_state_is_visible() {
  setup_merge_if_safe_fixture \
    "merge-review-state-retry" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  MOCK_GH_REVIEWS_SEQUENCE_FILE="${TEST_TMP_DIR}/merge-review-state-retry/mock/reviews-seq.jsonl"
  {
    printf '%s\n' '[[{"user":{"login":"other-reviewer"},"commit_id":"head-sha-123","state":"APPROVED"}]]'
    printf '%s\n' '[[{"user":{"login":"review-bot"},"commit_id":"head-sha-123","state":"APPROVED"}]]'
  } > "${MOCK_GH_REVIEWS_SEQUENCE_FILE}"
  export MOCK_GH_REVIEWS_SEQUENCE_FILE

  PR_GUARDIAN_REVIEW_STATE_MAX_ATTEMPTS=2
  PR_GUARDIAN_REVIEW_STATE_RETRY_DELAY_SECONDS=0
  export PR_GUARDIAN_REVIEW_STATE_MAX_ATTEMPTS
  export PR_GUARDIAN_REVIEW_STATE_RETRY_DELAY_SECONDS

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"

  local review_calls
  review_calls="$(grep -c "repos/mcontheway/WebEnvoy/pulls/274/reviews" "${MOCK_GH_CALLS_LOG}")"
  if [[ "${review_calls}" -lt 2 ]]; then
    echo "expected merge_if_safe to retry review-state check at least once" >&2
    exit 1
  fi
}

test_merge_if_safe_rejects_when_latest_review_state_regresses_on_same_head() {
  setup_merge_if_safe_fixture \
    "merge-review-state-regression-same-head" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  printf '%s\n' '[[{"user":{"login":"review-bot"},"commit_id":"head-sha-123","state":"APPROVED"},{"user":{"login":"review-bot"},"commit_id":"head-sha-123","state":"CHANGES_REQUESTED"}]]' > "${MOCK_GH_REVIEWS_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "expected GitHub review state is not visible"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_post_review_self_review_uses_review_event_and_merge_gate_uses_reviews_api() {
  setup_merge_if_safe_fixture \
    "post-review-self-review-event" \
    "review-bot" \
    "review-bot" \
    "COMMENTED" \
    "head-sha-123" \
    "0"

  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  printf '%s\n' "self review body" > "${REVIEW_MD_FILE}"
  export REVIEW_MD_FILE

  RESULT_FILE="${TMP_DIR}/review.json"
  printf '%s\n' '{"verdict":"APPROVE","safe_to_merge":true,"findings":[]}' > "${RESULT_FILE}"
  export RESULT_FILE

  assert_pass post_review 274
  assert_file_contains "${MOCK_GH_REVIEW_LOG}" "pulls/274/reviews"
  assert_file_contains "${MOCK_GH_REVIEW_LOG}" '"event": "COMMENT"'
  assert_file_contains "${MOCK_GH_REVIEW_LOG}" '"commit_id": "head-sha-123"'
  assert_file_not_contains "${MOCK_GH_REVIEW_LOG}" "pr comment 274"

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_CALLS_LOG}" "repos/mcontheway/WebEnvoy/pulls/274/reviews"
  assert_file_not_contains "${MOCK_GH_CALLS_LOG}" "repos/mcontheway/WebEnvoy/issues/274/comments"
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"
}

test_merge_if_safe_delete_branch_deletes_same_repo_non_main_head_ref() {
  setup_merge_if_safe_fixture \
    "merge-delete-same-repo-branch" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","headRefName":"fix/delete-me","headRepoFullName":"mcontheway/WebEnvoy","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}' > "${MOCK_GH_PR_VIEW_JSON}"

  assert_pass merge_if_safe 274 1
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "pulls/274/merge"
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "git/refs/heads/fix/delete-me"
}

test_merge_if_safe_delete_branch_skips_main_head_ref() {
  setup_merge_if_safe_fixture \
    "merge-delete-skips-main-head" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","headRefName":"main","headRepoFullName":"mcontheway/WebEnvoy","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}' > "${MOCK_GH_PR_VIEW_JSON}"

  assert_pass merge_if_safe 274 1
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "pulls/274/merge"
  assert_file_not_contains "${MOCK_GH_MERGE_LOG}" "git/refs/heads/main"
}

test_merge_if_safe_delete_branch_skips_fork_head_ref() {
  setup_merge_if_safe_fixture \
    "merge-delete-skips-fork-head" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  printf '%s\n' '{"baseRefName":"main","headRefOid":"head-sha-123","headRefName":"fix/fork-branch","headRepoFullName":"external/WebEnvoy","mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","isDraft":false}' > "${MOCK_GH_PR_VIEW_JSON}"

  assert_pass merge_if_safe 274 1
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "pulls/274/merge"
  assert_file_not_contains "${MOCK_GH_MERGE_LOG}" "git/refs/heads/fix/fork-branch"
}

test_post_review_records_local_guardian_proof_for_human_reviewer() {
  setup_merge_if_safe_fixture \
    "post-review-records-human-proof" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  printf '%s\n' '{"verdict":"APPROVE","safe_to_merge":true,"summary":"summary","findings":[],"required_actions":[]}' > "${RESULT_FILE}"
  build_markdown_review "${RESULT_FILE}" "${REVIEW_MD_FILE}"
  export RESULT_FILE REVIEW_MD_FILE

  assert_pass post_review 274
  assert_file_contains "$(guardian_proof_store_file)" '"1000"'
  assert_file_contains "$(guardian_proof_store_file)" '"reviewer_login": "human-reviewer"'
  assert_file_contains "$(guardian_proof_store_file)" '"head_sha": "head-sha-123"'
}

test_post_review_retries_until_human_proof_review_is_visible() {
  setup_merge_if_safe_fixture \
    "post-review-retries-human-proof-visibility" \
    "pr-author" \
    "human-reviewer" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  printf '%s\n' '{"verdict":"APPROVE","safe_to_merge":true,"summary":"summary","findings":[],"required_actions":[]}' > "${RESULT_FILE}"
  build_markdown_review "${RESULT_FILE}" "${REVIEW_MD_FILE}"
  export RESULT_FILE REVIEW_MD_FILE

  local review_body_json
  review_body_json="$(jq -Rs . < "${REVIEW_MD_FILE}")"
  MOCK_GH_REVIEWS_SEQUENCE_FILE="${TEST_TMP_DIR}/post-review-retries-human-proof-visibility/mock/reviews-seq.jsonl"
  {
    printf '%s\n' '[[]]'
    printf '[[{"id":1000,"user":{"login":"human-reviewer"},"commit_id":"head-sha-123","state":"APPROVED","submitted_at":"2026-04-07T10:10:00Z","body":%s}]]\n' "${review_body_json}"
  } > "${MOCK_GH_REVIEWS_SEQUENCE_FILE}"
  export MOCK_GH_REVIEWS_SEQUENCE_FILE

  PR_GUARDIAN_PROOF_VISIBILITY_MAX_ATTEMPTS=2
  PR_GUARDIAN_PROOF_VISIBILITY_RETRY_DELAY_SECONDS=0
  export PR_GUARDIAN_PROOF_VISIBILITY_MAX_ATTEMPTS
  export PR_GUARDIAN_PROOF_VISIBILITY_RETRY_DELAY_SECONDS

  assert_pass post_review 274
  assert_file_contains "$(guardian_proof_store_file)" '"1000"'
  assert_equal "$(grep -c 'repos/mcontheway/WebEnvoy/pulls/274/reviews' "${MOCK_GH_CALLS_LOG}")" "3"
}

test_merge_if_safe_rejects_comment_marker_without_formal_review() {
  setup_merge_if_safe_fixture \
    "merge-review-comment-marker-only" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  printf '%s\n' '[]' > "${MOCK_GH_REVIEWS_JSON}"
  printf '%s\n' '[{"name":"review-completed","bucket":"pass","state":"SUCCESS","link":"https://example.test/review"},{"name":"Run Tests","bucket":"pass","state":"SUCCESS","link":"https://example.test/tests"}]' > "${MOCK_GH_CHECKS_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "expected GitHub review state is not visible"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_loom_review_record_missing() {
  setup_merge_if_safe_fixture \
    "merge-ready-missing-review-record" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  rm -f "${LOOM_REVIEW_RECORD_FILE}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "review record must be an object"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_loom_review_record_stale() {
  setup_merge_if_safe_fixture \
    "merge-ready-stale-review-record" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.reviewed_head = "old-head-sha"' "${LOOM_REVIEW_RECORD_FILE}" > "${LOOM_REVIEW_RECORD_FILE}.tmp"
  mv "${LOOM_REVIEW_RECORD_FILE}.tmp" "${LOOM_REVIEW_RECORD_FILE}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "reviewed_head mismatch"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_loom_review_record_malformed() {
  setup_merge_if_safe_fixture \
    "merge-ready-malformed-review-record" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.schema_version = "loom-review/v2"' "${LOOM_REVIEW_RECORD_FILE}" > "${LOOM_REVIEW_RECORD_FILE}.tmp"
  mv "${LOOM_REVIEW_RECORD_FILE}.tmp" "${LOOM_REVIEW_RECORD_FILE}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "schema_version"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_spec_review_record_missing() {
  setup_merge_if_safe_fixture \
    "merge-ready-missing-spec-record" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  REVIEW_PROFILE="mixed_high_risk_spec_profile"
  export REVIEW_PROFILE
  rm -f "${SPEC_LOOM_REVIEW_RECORD_FILE}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "spec review record"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_checks_missing() {
  setup_merge_if_safe_fixture \
    "merge-ready-missing-checks" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  printf '%s\n' '[]' > "${MOCK_GH_CHECKS_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "GitHub checks snapshot is missing"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_live_evidence_required_but_missing() {
  setup_merge_if_safe_fixture \
    "merge-ready-missing-live-evidence" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: true\n  trigger_reasons: live\n  n_a_allowed: false\n\nlive_evidence_record: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "live evidence"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_allows_live_evidence_required_success_record() {
  setup_merge_if_safe_fixture \
    "merge-ready-live-evidence-success" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: true\n  trigger_reasons: live\n  n_a_allowed: false\n\nlive_evidence_record:\n  latest_head_sha: head-sha-123\n  profile: live-profile\n  browser_channel: stable\n  execution_surface: real_browser\n  page_url: https://example.test\n  target_tab_id: tab-1\n  run_id: run-1\n  evidence_collected_at: 2026-05-19T00:00:00Z\n  artifact_identity: artifact-1\n  relay_path: relay-1\n  interaction_locator: button#submit\n  success_signals: completed\n  minimum_replay: replay command\n  artifact_log_ref: artifact-log-1\n  failure_reason: N/A\n  blocker_level: N/A\n\ncloseout_control:\n  issue_type: implementation\n  readiness_admission_status: static_and_gate_ready\n  readiness_matrix: N/A\n  live_validation_ladder: static tests\n  closeout_evidence: local validation\n  fallback_limitations: N/A\n  blocker_split_handling: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  assert_pass merge_if_safe 274 0
  assert_file_contains "${MOCK_GH_MERGE_LOG}" "head-sha-123"
}

test_merge_if_safe_blocks_when_live_evidence_surface_is_not_real_browser() {
  setup_merge_if_safe_fixture \
    "merge-ready-live-evidence-stub" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: true\n  trigger_reasons: live\n  n_a_allowed: false\n\nlive_evidence_record:\n  latest_head_sha: head-sha-123\n  profile: live-profile\n  browser_channel: stable\n  execution_surface: stub\n  page_url: https://example.test\n  target_tab_id: tab-1\n  run_id: run-1\n  evidence_collected_at: 2026-05-19T00:00:00Z\n  artifact_identity: artifact-1\n  relay_path: relay-1\n  success_signals: completed\n  minimum_replay: replay command\n  artifact_log_ref: artifact-log-1\n  failure_reason: N/A\n  blocker_level: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "live_evidence_record.execution_surface must be real_browser"
  assert_file_contains "${err_file}" "live_evidence_record.interaction_locator is missing"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_live_evidence_head_mismatches() {
  setup_merge_if_safe_fixture \
    "merge-ready-live-evidence-head-mismatch" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: true\n  trigger_reasons: live\n  n_a_allowed: false\n\nlive_evidence_record:\n  latest_head_sha: old-head-sha\n  profile: live-profile\n  browser_channel: stable\n  execution_surface: real_browser\n  page_url: https://example.test\n  target_tab_id: tab-1\n  run_id: run-1\n  evidence_collected_at: 2026-05-19T00:00:00Z\n  artifact_identity: artifact-1\n  relay_path: relay-1\n  interaction_locator: button#submit\n  success_signals: completed\n  minimum_replay: replay command\n  artifact_log_ref: artifact-log-1\n  failure_reason: N/A\n  blocker_level: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "live_evidence_record.latest_head_sha must match PR head"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_integration_check_missing() {
  setup_merge_if_safe_fixture \
    "merge-ready-missing-integration-check" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "gate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: false\n  trigger_reasons: N/A\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "integration_check"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_integration_check_relationships_are_inconsistent() {
  setup_merge_if_safe_fixture \
    "merge-ready-inconsistent-integration-check" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: yes\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: integration_governance\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: no\n  integration_status_checked_before_merge: no\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: false\n  trigger_reasons: N/A\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "integration_check.integration_applicable must be yes when integration gate inputs are present"
  assert_file_contains "${err_file}" "integration_check.merge_gate must be integration_check_required when integration gate inputs are present"
  assert_file_contains "${err_file}" "integration_check.integration_status_checked_before_merge must be yes when integration gate is required"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_integration_check_incomplete() {
  setup_merge_if_safe_fixture \
    "merge-ready-incomplete-integration-check" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: false\n  trigger_reasons: N/A\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "integration_check.integration_ref is missing"
  assert_file_contains "${err_file}" "integration_check.merge_gate is missing"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_closeout_control_missing() {
  setup_merge_if_safe_fixture \
    "merge-ready-missing-closeout-control" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: false\n  trigger_reasons: N/A\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "PR metadata is missing closeout_control"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_closeout_control_incomplete() {
  setup_merge_if_safe_fixture \
    "merge-ready-incomplete-closeout-control" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: general_pr\n  governance_context_issue_ref: N/A\n  governance_scope_targets: N/A\n  in_scope: false\n  trigger_reasons: N/A\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n\ncloseout_control:\n  issue_type: implementation\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "closeout_control.readiness_admission_status is missing"
  assert_file_contains "${err_file}" "closeout_control.closeout_evidence is missing"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_gate_applicability_review_lane_invalid() {
  setup_merge_if_safe_fixture \
    "merge-ready-invalid-review-lane" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  jq '.body |= sub("review_lane: general_pr"; "review_lane: implementation_pr")' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" 'gate_applicability.review_lane has invalid value `implementation_pr`'
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}

test_merge_if_safe_blocks_when_governance_lane_scope_mismatches() {
  setup_merge_if_safe_fixture \
    "merge-ready-governance-scope-mismatch" \
    "pr-author" \
    "review-bot" \
    "APPROVED" \
    "head-sha-123" \
    "0"

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  printf '%s\n' "AGENTS.md" "code_review.md" > "${CHANGED_FILES_FILE}"
  export CHANGED_FILES_FILE
  jq '.body = "integration_check:\n  integration_applicable: no\n  integration_touchpoint: none\n  integration_ref: none\n  shared_contract_changed: no\n  external_dependency: none\n  merge_gate: local_only\n  contract_surface: none\n  joint_acceptance_needed: no\n  integration_status_checked_before_pr: yes\n  integration_status_checked_before_merge: yes\n\ngate_applicability:\n  review_lane: governance_landing_pr\n  governance_context_issue_ref: #310\n  governance_scope_targets: [AGENTS.md, docs/dev/AGENTS.md, code_review.md, docs/dev/review/guardian-review-addendum.md, .github/PULL_REQUEST_TEMPLATE.md]\n  in_scope: false\n  trigger_reasons: []\n  n_a_allowed: true\n\nlive_evidence_record: N/A\n\ncloseout_control:\n  issue_type: governance\n  readiness_admission_status: static_and_gate_ready\n  readiness_matrix: N/A\n  live_validation_ladder: static tests\n  closeout_evidence: local validation\n  fallback_limitations: N/A\n  blocker_split_handling: N/A\n"' "${MOCK_GH_PR_VIEW_JSON}" > "${MOCK_GH_PR_VIEW_JSON}.tmp"
  mv "${MOCK_GH_PR_VIEW_JSON}.tmp" "${MOCK_GH_PR_VIEW_JSON}"

  local err_file="${TMP_DIR}/merge.err"
  assert_fail merge_if_safe 274 0 2>"${err_file}"
  assert_file_contains "${err_file}" "gate_applicability governance lane must exactly match frozen governance target files"
  assert_file_empty "${MOCK_GH_MERGE_LOG}"
}
