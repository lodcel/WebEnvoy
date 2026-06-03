test_normalize_native_review_result_maps_native_schema_to_guardian_schema() {
  setup_case_dir "normalize-native-review"

  local raw_file="${TMP_DIR}/native-review.json"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
{"findings":[{"title":"[P1] Keep native review path","body":"The script still shells out through generic exec instead of the native review engine, so it bypasses the built-in review rubric we explicitly migrated toward.","confidence_score":0.87,"priority":1,"code_location":{"absolute_file_path":"/tmp/worktree/scripts/pr-guardian.sh","line_range":{"start":717,"end":726}}}],"overall_correctness":"patch is incorrect","overall_explanation":"The patch still contains a blocking review-path regression.","overall_confidence_score":0.87}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
  assert_file_contains "${result_file}" '"severity":"high"'
  assert_file_contains "${result_file}" '"title":"Keep native review path"'
  assert_file_contains "${result_file}" '"details":"The script still shells out through generic exec instead of the native review engine, so it bypasses the built-in review rubric we explicitly migrated toward."'
  assert_file_contains "${result_file}" '"required_actions":["修复：Keep native review path"]'
}

test_normalize_native_review_result_maps_native_schema_without_code_location() {
  setup_case_dir "normalize-native-review-without-code-location"

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  printf '%s\n' 'scripts/pr-guardian.sh' > "${CHANGED_FILES_FILE}"
  export CHANGED_FILES_FILE

  local raw_file="${TMP_DIR}/native-review.json"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
{"findings":[{"title":"[P2] Preserve review context","body":"The patch drops required review context for medium items.","confidence_score":0.73}],"overall_correctness":"patch is incorrect","overall_explanation":"The patch still contains a blocking review-context regression.","overall_confidence_score":0.73}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"absolute_file_path":"'
  assert_file_contains "${result_file}" 'scripts/pr-guardian.sh'
  assert_file_contains "${result_file}" '"start":1'
  assert_file_contains "${result_file}" '"end":1'
}

test_normalize_native_review_result_coerces_stringified_legacy_schema_numbers() {
  setup_case_dir "normalize-native-review-stringified-numbers"

  local raw_file="${TMP_DIR}/native-review.json"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
{"findings":[{"title":"[P2] Preserve review context","body":"The patch drops required review context for medium items.","confidence_score":"0.73","priority":"2","code_location":{"absolute_file_path":"/tmp/worktree/scripts/pr-guardian.sh","line_range":{"start":"223","end":"225"}}}],"overall_correctness":"patch is incorrect","overall_explanation":"The patch still contains a blocking review-context regression.","overall_confidence_score":"0.73"}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"start":223'
  assert_file_contains "${result_file}" '"end":225'
  assert_file_contains "${result_file}" '"confidence_score":0.73'
  assert_file_contains "${result_file}" '"priority":2'
}

test_normalize_native_review_result_accepts_guardian_schema_json() {
  setup_case_dir "normalize-guardian-schema-json"

  local raw_file="${TMP_DIR}/guardian-review.json"
  local result_file="${TMP_DIR}/normalized-review.json"
  cat > "${raw_file}" <<'EOF'
{"verdict":"APPROVE","safe_to_merge":true,"summary":"未发现新的阻断性问题。","findings":[],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_coerces_sparse_guardian_schema_findings() {
  setup_case_dir "normalize-guardian-schema-sparse-findings"

  local raw_file="${TMP_DIR}/guardian-review.json"
  local result_file="${TMP_DIR}/normalized-review.json"
  cat > "${raw_file}" <<'EOF'
{"verdict":"REQUEST_CHANGES","safe_to_merge":false,"summary":"Need follow-up before merge.","findings":[{"details":"Missing explicit title and code location."}],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass coerce_review_result_shape "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"title":"Native review finding"'
  assert_file_contains "${result_file}" '"required_actions":["修复：Native review finding"]'
}

test_normalize_native_review_result_coerces_stringified_guardian_schema_numbers() {
  setup_case_dir "normalize-guardian-schema-stringified-numbers"

  local raw_file="${TMP_DIR}/guardian-review.json"
  local result_file="${TMP_DIR}/normalized-review.json"
  cat > "${raw_file}" <<'EOF'
{"verdict":"REQUEST_CHANGES","safe_to_merge":"false","summary":"Blocking issue found.","findings":[{"severity":"","title":"[P1] Normalize review output","details":"The parser still leaves numeric fields as strings.","code_location":{"absolute_file_path":"/tmp/worktree/scripts/pr-guardian.sh","line_range":{"start":"1555","end":"1559"}},"confidence_score":"0.83","priority":"1"}],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"start":1555'
  assert_file_contains "${result_file}" '"end":1559'
  assert_file_contains "${result_file}" '"confidence_score":0.83'
  assert_file_contains "${result_file}" '"priority":1'
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
}

test_normalize_native_review_result_fails_closed_for_inconsistent_guardian_schema_json() {
  setup_case_dir "normalize-guardian-schema-json-inconsistent"

  local raw_file="${TMP_DIR}/guardian-review.json"
  local result_file="${TMP_DIR}/normalized-review.json"
  cat > "${raw_file}" <<'EOF'
{"verdict":"APPROVE","safe_to_merge":true,"summary":"未发现新的阻断性问题。","findings":[{"severity":"high","title":"Dropped issue context","details":"The review still skips linked issue context on multi-issue PRs.","code_location":{"absolute_file_path":"/tmp/worktree/scripts/pr-guardian.sh","line_range":{"start":263,"end":265}}}],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
  assert_file_contains "${result_file}" '"required_actions":["修复：Dropped issue context"]'
}

test_normalize_native_review_result_keeps_approve_for_nonblocking_compat_finding() {
  setup_case_dir "normalize-guardian-schema-nonblocking-compat-finding"

  local raw_file="${TMP_DIR}/guardian-review.json"
  local result_file="${TMP_DIR}/normalized-review.json"
  cat > "${raw_file}" <<'EOF'
{"verdict":"APPROVE","safe_to_merge":true,"summary":"未发现新的阻断性问题。","findings":[{"severity":"low","title":"未发现新的阻断性问题。","details":"未发现新的阻断性问题。","code_location":{"absolute_file_path":"/tmp/worktree/.loom/bootstrap/init-result.json","line_range":{"start":1,"end":1}},"confidence_score":0.8,"priority":3}],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
  assert_file_contains "${result_file}" '"priority":3'
  assert_file_contains "${result_file}" '"required_actions":[]'
}

test_normalize_native_review_result_accepts_code_fenced_native_schema_json() {
  setup_case_dir "normalize-native-review-code-fenced-json"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Here is the structured review result:

```json
{"findings":[{"title":"[P1] Keep issue context loading","body":"The PR can skip issue context for linked non-closing work items.","confidence_score":0.66,"priority":1,"code_location":{"absolute_file_path":"/tmp/worktree/scripts/pr-guardian.sh","line_range":{"start":223,"end":225}}}],"overall_correctness":"patch is incorrect","overall_explanation":"The patch still contains a blocking context-loading regression.","overall_confidence_score":0.66}
```
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"title":"Keep issue context loading"'
}

test_normalize_native_review_result_accepts_preamble_guardian_schema_json() {
  setup_case_dir "normalize-guardian-schema-preamble-json"

  local raw_file="${TMP_DIR}/guardian-review.txt"
  local result_file="${TMP_DIR}/normalized-review.json"
  cat > "${raw_file}" <<'EOF'
Structured result follows:
{"verdict":"APPROVE","safe_to_merge":true,"summary":"未发现新的阻断性问题。","findings":[],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_relaxed_native_schema_correctness_phrase() {
  setup_case_dir "normalize-native-schema-relaxed-correctness"

  local raw_file="${TMP_DIR}/native-review.json"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
{"findings":[],"overall_correctness":"The patch is correct.","overall_explanation":"No blocking issues found.","overall_confidence_score":0.74}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_request_changes_verdict_when_summary_is_safe() {
  setup_case_dir "normalize-native-schema-request-changes-safe-summary"

  local raw_file="${TMP_DIR}/native-review.json"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
{"verdict":"REQUEST_CHANGES","safe_to_merge":false,"summary":"No blocking issues found.","findings":[],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_request_changes_verdict_when_summary_uses_merge_blocking_regression_free_phrase() {
  setup_case_dir "normalize-native-schema-request-changes-merge-blocking-regression-free"

  local raw_file="${TMP_DIR}/native-review.json"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
{"verdict":"REQUEST_CHANGES","safe_to_merge":false,"summary":"I did not find a concrete merge-blocking regression or safety hole introduced by this PR.","findings":[],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_fails_closed_for_legacy_schema_explanation_caveat() {
  setup_case_dir "normalize-native-schema-explanation-caveat"

  local raw_file="${TMP_DIR}/native-review.json"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
{"findings":[],"overall_correctness":"The patch is correct.","overall_explanation":"Looks good to me, but the fallback path still drops issue context and should not be merged.","overall_confidence_score":0.74}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_accepts_brace_bearing_preamble_json() {
  setup_case_dir "normalize-native-json-brace-preamble"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Reviewer notes {keep context intact}.
{"verdict":"APPROVE","safe_to_merge":true,"summary":"未发现新的阻断性问题。","findings":[],"required_actions":[]}
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
}

test_normalize_native_review_result_accepts_second_fenced_json_block() {
  setup_case_dir "normalize-native-json-second-fence"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Context first:
```text
{not-json}
```

```json
{"verdict":"APPROVE","safe_to_merge":true,"summary":"未发现新的阻断性问题。","findings":[],"required_actions":[]}
```
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
}

test_normalize_native_review_result_maps_native_text_findings_to_guardian_schema() {
  setup_case_dir "normalize-native-text-review"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
The new nullish guard introduces a behavioral regression by zeroing out valid additions whenever only one operand is nullish. That changes the function's arithmetic semantics and can hide missing-input bugs.

Review comment:

- [P1] Don't return 0 when only one operand is nullish — /tmp/worktree/app.js:2-2
  This guard changes `add`'s behavior for any call where exactly one argument is missing: for example, `add(5, null)` now returns `0` instead of preserving the non-null operand, and `add(5, undefined)` silently masks a missing-value bug instead of surfacing it.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
  assert_file_contains "${result_file}" '"summary":"The new nullish guard introduces a behavioral regression by zeroing out valid additions whenever only one operand is nullish. That changes the function'\''s arithmetic semantics and can hide missing-input bugs."'
  assert_file_contains "${result_file}" '"severity":"high"'
  assert_file_contains "${result_file}" '"title":"Don'\''t return 0 when only one operand is nullish"'
  assert_file_contains "${result_file}" '"absolute_file_path":"/tmp/worktree/app.js"'
  assert_file_contains "${result_file}" '"start":2'
  assert_file_contains "${result_file}" '"end":2'
}

test_normalize_native_review_result_fails_closed_for_unstructured_negative_text() {
  setup_case_dir "normalize-native-text-fail-closed"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
The new guardian path has a fail-open approval case for unstructured plain-text native reviews, and it can silently discard PR/Issue review context unless bodies match a narrow template. Either problem can lead to incorrect review outcomes on real PRs. Full review comments: - [P1] Fail closed when plain-text native reviews lack parsed findings — /tmp/worktree/scripts/pr-guardian.sh:956-957 If `codex review` falls back to plain text and the rejection does not include the exact `Review comment:` bullet format expected above, `$normalized_findings` stays empty and this branch converts the result to `APPROVE`.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_maps_native_text_approve_to_guardian_schema() {
  setup_case_dir "normalize-native-text-approve"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
The patch only adds a small wording tweak to README.md and does not affect code paths, tests, or runtime behavior. I did not identify any actionable bugs introduced by this change.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
  assert_file_contains "${result_file}" '"findings":[]'
  assert_file_contains "${result_file}" '"required_actions":[]'
}

test_normalize_native_review_result_accepts_chinese_plain_text_approve() {
  setup_case_dir "normalize-native-text-approve-zh"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
未发现新的阻断性问题。可以合并。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_common_plain_text_approve_phrases() {
  setup_case_dir "normalize-native-text-approve-common-phrases"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
No issues found. I didn't find any problems with this patch.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_live_plain_text_approve_summary() {
  setup_case_dir "normalize-native-text-approve-live-summary"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
I did not identify any current-PR-introduced issues that clearly block merge. The new guardian context-loading and review normalization logic appears internally consistent with the added test coverage and repository review baselines.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
  assert_file_contains "${result_file}" '"findings":[]'
}

test_normalize_native_review_result_accepts_review_context_preface_before_safe_summary() {
  setup_case_dir "normalize-native-text-approve-review-context-preface"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
审查了相对 origin/main 的实际差异，并对照相关架构/审查基线检查了 profile-runtime 中 readiness、lock 与 attach/status 路径的行为收敛。本次改动看起来保持了既有语义，没有发现当前 PR 新引入、足以阻止合并的离散问题。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
  assert_file_contains "${result_file}" '"findings":[]'
}

test_normalize_native_review_result_accepts_chinese_review_context_with_current_runtime_phrase() {
  setup_case_dir "normalize-native-text-chinese-review-context-current-runtime"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
审查了相对 origin/main 的实际差异，并对照相关架构/审查基线检查了当前运行时 profile 锁路径的行为收敛。未发现新的阻断性问题。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
  assert_file_contains "${result_file}" '"findings":[]'
}

test_normalize_native_review_result_fails_closed_for_merge_base_safe_summary_variant() {
  setup_case_dir "normalize-native-text-merge-base-safe-summary-variant"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
基于 merge-base `bc253d2f2dee41827a41a516d572eb38d97bb387` 的 diff 审查，这个 PR 主要是在 `background`、`loopback` 和 `xhs-search` 之间收敛重复的 XHS gate 逻辑到共享模块，未发现当前改动明确引入、且足以阻止合并的离散缺陷。已重点检查高风险执行路径与共享契约变更，未定位到可证实的行为回归。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_diff_only_guardian_summary_variant() {
  setup_case_dir "normalize-native-text-diff-only-guardian-summary-variant"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
相对 origin/main 的变更仅扩展了 guardian 对两类中文安全摘要的归一化规则，并补上了对应回归测试。基于当前 diff，未发现会错误放行阻断性评论或引入明显行为回归的可操作问题。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_arbitrary_merge_base_preface_with_blocker() {
  setup_case_dir "normalize-native-text-arbitrary-merge-base-preface-with-blocker"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
基于 merge-base `bc253d2f2dee41827a41a516d572eb38d97bb387` 的 diff 审查，这个 PR 仍会把 gate_applicability 缺失视为可合并。未定位到可证实的行为回归。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_behavior_regression_free_phrase_only() {
  setup_case_dir "normalize-native-text-behavior-regression-free-phrase-only"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
未定位到可证实的行为回归。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_merge_base_summary_with_inline_blocker_clause() {
  setup_case_dir "normalize-native-text-merge-base-inline-blocker-clause"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
基于 merge-base `bc253d2f2dee41827a41a516d572eb38d97bb387` 的 diff 审查，这个 PR 仍会把 gate_applicability 缺失视为可合并，未发现当前改动明确引入、且足以阻止合并的离散缺陷。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_review_context_with_incomplete_evidence() {
  setup_case_dir "normalize-native-text-review-context-incomplete-evidence"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Reviewed the diff against origin/main, and tests were not run in this environment. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_accepts_reviewed_diff_preface_before_safe_summary() {
  setup_case_dir "normalize-native-text-reviewed-diff-safe-preface"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Reviewed the diff against origin/main, and checked the touched merge-guard logic against the relevant guardian baselines. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_after_reviewing_diff_preserve_summary() {
  setup_case_dir "normalize-native-text-after-reviewing-diff-preserve"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
After reviewing the diff against origin/main, the refactor appears to preserve the existing readiness, lock-inspection, and attach/status behaviors while only extracting them into helpers. I did not identify any actionable correctness regressions in the changed code that should block merging this PR.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_fails_closed_for_after_reviewing_diff_static_reading_caveat() {
  setup_case_dir "normalize-native-text-after-reviewing-diff-static-reading-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
After reviewing the diff against origin/main, the patch appears to preserve behavior based on static reading only. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_preserve_summary_with_static_reading_disclaimer() {
  setup_case_dir "normalize-native-text-preserve-summary-static-reading-disclaimer"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
After reviewing the diff against origin/main, the patch appears to preserve the existing attach logic based on static reading while only extracting it into helpers. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_static_reading_in_review_preface() {
  setup_case_dir "normalize-native-text-static-reading-in-review-preface"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
After reviewing the diff against origin/main based on static reading only, the patch appears to preserve the existing attach logic while only extracting it into helpers. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_generic_should_followup() {
  setup_case_dir "normalize-native-text-generic-should-followup"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
The refactor does not affect code paths and should get another pass on Windows before merge. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_should_block_merge_until_caveat() {
  setup_case_dir "normalize-native-text-should-block-merge-until-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
The refactor does not affect code paths and should block merging this PR until the release note is restored. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_chinese_incomplete_evidence_prefix() {
  setup_case_dir "normalize-native-text-chinese-incomplete-evidence-prefix"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
仅基于静态阅读，没有发现当前 PR 新引入、足以阻止合并的离散问题。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_chinese_review_context_with_unfinished_convergence() {
  setup_case_dir "normalize-native-text-chinese-review-context-unfinished-convergence"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
审查了相对 origin/main 的实际差异，并对照相关架构/审查基线检查了 readiness、lock 与 attach/status 路径仍未收敛。本次改动看起来保持了既有语义，没有发现当前 PR 新引入、足以阻止合并的离散问题。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_accepts_polite_plain_text_approve_phrase() {
  setup_case_dir "normalize-native-text-approve-polite"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Looks good to me. Thanks!
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_fails_closed_for_polite_plain_text_with_followup() {
  setup_case_dir "normalize-native-text-approve-followup"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Looks good to me, please re-check the fallback path.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_accepts_merge_blocker_free_approve_phrase() {
  setup_case_dir "normalize-native-text-approve-merge-blockers"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
I don't see any merge blockers.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_concrete_merge_blocking_regression_free_phrase() {
  setup_case_dir "normalize-native-text-approve-concrete-merge-blocking-regression-free"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
I did not find a concrete merge-blocking regression or safety hole introduced by this PR.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_accepts_discrete_merge_blocking_regression_free_phrase() {
  setup_case_dir "normalize-native-text-approve-discrete-merge-blocking-regression-free"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
I did not identify a discrete, merge-blocking regression in the PR diff relative to origin/main.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_fails_closed_for_discrete_merge_blocking_regression_phrase_with_static_reading_caveat() {
  setup_case_dir "normalize-native-text-discrete-merge-blocking-regression-static-reading-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
I did not identify a discrete, merge-blocking regression in the PR diff relative to origin/main based on static reading only.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_preserve_summary_with_pending_pass_caveat() {
  setup_case_dir "normalize-native-text-preserve-summary-pending-pass-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
After reviewing the diff against origin/main, the patch appears to preserve the existing attach logic pending another pass on Windows while only extracting it into helpers. No blocking issues found.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_accepts_lgtm_phrase() {
  setup_case_dir "normalize-native-text-approve-lgtm"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
LGTM.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"APPROVE"'
  assert_file_contains "${result_file}" '"safe_to_merge":true'
}

test_normalize_native_review_result_fails_closed_for_chinese_caveat() {
  setup_case_dir "normalize-native-text-chinese-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
未发现新的阻断性问题，但仍缺少 issue 上下文，暂不建议合并。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_chinese_condition() {
  setup_case_dir "normalize-native-text-chinese-condition"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
可以合并，前提是先补齐 issue 上下文。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_chinese_followup() {
  setup_case_dir "normalize-native-text-chinese-followup"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
可以合并，建议后续补齐回归测试。
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_other_than_caveat() {
  setup_case_dir "normalize-native-text-other-than-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
No issues found other than the dropped issue context in the prompt builder.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_unparsed_priority_bullet() {
  setup_case_dir "normalize-native-text-unparsed-priority-bullet"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Looks good to me.

Review comment:

- [P1] Please revisit the fallback path
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_maps_numbered_review_comment_findings() {
  setup_case_dir "normalize-native-text-numbered-review-comment"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Looks good to me.

Review comment:

1. [P1] Keep fallback path fail-closed — /tmp/worktree/scripts/pr-guardian.sh:1844-1845
  The plain-text fallback still upgrades some unparsed review outputs to APPROVE.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"title":"Keep fallback path fail-closed"'
  assert_file_contains "${result_file}" '"absolute_file_path":"/tmp/worktree/scripts/pr-guardian.sh"'
}

test_normalize_native_review_result_maps_full_review_comments_embedded_in_summary() {
  setup_case_dir "normalize-native-text-full-review-comments-summary"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
The new guardian context-loading flow is directionally good. Full review comments: - [P2] Stop treating the caller's checkout as a trusted baseline — /tmp/worktree/scripts/pr-guardian.sh:465-466 When merge-base lacks the file, the code still falls back to the local checkout. - [P2] Force non-interactive SSH even with a custom GIT_SSH_COMMAND — /tmp/worktree/scripts/pr-guardian.sh:76-77 Existing custom SSH commands can still prompt instead of failing over cleanly.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"summary":"The new guardian context-loading flow is directionally good."'
  assert_file_contains "${result_file}" '"title":"Stop treating the caller'\''s checkout as a trusted baseline"'
  assert_file_contains "${result_file}" '"title":"Force non-interactive SSH even with a custom GIT_SSH_COMMAND"'
}

test_normalize_native_review_result_fails_closed_for_unparsed_review_comment_block() {
  setup_case_dir "normalize-native-text-unparsed-review-comment-block"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
Looks good to me.

Review comment:

- Please revisit fallback handling before merge.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
  assert_file_contains "${result_file}" '"summary":"Native review returned an unparsed Review comment block."'
}

test_normalize_native_review_result_fails_closed_for_ambiguous_safe_phrase() {
  setup_case_dir "normalize-native-text-ambiguous-safe-phrase"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
I did not identify any actionable bugs in the docs, but the new merge guard still drops issue context and should not be approved.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_colon_caveat() {
  setup_case_dir "normalize-native-text-colon-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
I did not identify any actionable bugs in the docs: the merge guard still approves an ambiguous native review and should not be merged.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_normalize_native_review_result_fails_closed_for_unless_caveat() {
  setup_case_dir "normalize-native-text-unless-caveat"

  local raw_file="${TMP_DIR}/native-review.txt"
  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${raw_file}" <<'EOF'
The patch does not affect code paths unless the review baseline file is deleted, in which case guardian may approve against stale rules.
EOF

  assert_pass normalize_native_review_result "${raw_file}" "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"verdict":"REQUEST_CHANGES"'
  assert_file_contains "${result_file}" '"safe_to_merge":false'
}

test_add_fallback_finding_for_unstructured_rejection_creates_actionable_output() {
  setup_case_dir "fallback-finding-for-unstructured-rejection"

  local result_file="${TMP_DIR}/guardian-review.json"
  cat > "${result_file}" <<'EOF'
{"verdict":"REQUEST_CHANGES","safe_to_merge":false,"summary":"Native review returned a negative freeform summary.","findings":[],"required_actions":[]}
EOF

  assert_pass add_fallback_finding_for_unstructured_rejection "${result_file}"
  assert_pass validate_review_result_shape "${result_file}"
  assert_file_contains "${result_file}" '"title":"Clarify native review rejection"'
  assert_file_contains "${result_file}" '"details":"Native review returned a negative freeform summary."'
  assert_file_contains "${result_file}" '"required_actions":["澄清并修复 native review 拒绝原因：Native review returned a negative freeform summary."]'
}

prepare_loom_guardian_review_worktree() {
  mkdir -p "${WORKTREE_DIR}/.loom/companion"
  cp "${REPO_ROOT}/.loom/companion/repo-interface.json" "${WORKTREE_DIR}/.loom/companion/repo-interface.json"
  seed_loom_skills_root_fixture
  git -C "${WORKTREE_DIR}" init -q
  git -C "${WORKTREE_DIR}" config user.email "guardian-test@example.test"
  git -C "${WORKTREE_DIR}" config user.name "Guardian Test"
  git -C "${WORKTREE_DIR}" add .
  git -C "${WORKTREE_DIR}" commit -qm "initial"
  HEAD_SHA="$(git -C "${WORKTREE_DIR}" rev-parse HEAD)"
  export HEAD_SHA
}

seed_loom_skills_root_fixture() {
  local skills_root="${WORKTREE_DIR}/plugins/loom/skills"
  local schema_file="${skills_root}/shared/assets/review/loom-review-result-schema.json"

  mkdir -p "$(dirname "${schema_file}")"
  printf '%s\n' '{"schema_version":"test-fixture","skills":[]}' > "${skills_root}/registry.json"
  cat > "${schema_file}" <<'EOF'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["decision", "summary", "findings"],
  "properties": {
    "decision": { "enum": ["allow", "block", "fallback"] },
    "summary": { "type": "string" },
    "findings": { "type": "array" }
  },
  "additionalProperties": true
}
EOF
}

seed_repo_bootstrap_manifest_fixture() {
  mkdir -p "${REPO_ROOT}/.loom/bootstrap"
  printf '%s\n' '{"schema_version":"loom-bootstrap-manifest/v1","fixture":"merge-if-safe"}' > "${REPO_ROOT}/.loom/bootstrap/manifest.json"
}

cleanup_repo_bootstrap_manifest_fixture() {
  rm -f "${REPO_ROOT}/.loom/bootstrap/manifest.json"
  rmdir "${REPO_ROOT}/.loom/bootstrap" 2>/dev/null || true
}

test_run_codex_review_prefers_codex_app_proof_raw_file() {
  setup_case_dir "run-codex-app-proof-review"

  BASE_REF="main"
  PR_TITLE="app proof review"
  PR_URL="https://example.test/pr/7"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  export BASE_REF PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.json"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  SPEC_LOOM_REVIEW_RECORD_FILE="${WORKTREE_DIR}/.loom/runtime/review/guardian-spec/${HEAD_SHA:-pending}/spec-review-record.json"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE SPEC_LOOM_REVIEW_RECORD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"
  prepare_loom_guardian_review_worktree

  mkdir -p "${WORKTREE_DIR}/.loom/runtime/mock"
  cat > "${WORKTREE_DIR}/.loom/runtime/mock/codex-app-review.json" <<'EOF'
{"decision":"allow","summary":"No blocking issues found.","findings":[]}
EOF
  export LOOM_CODEX_APP_REVIEW_ENDPOINT="mock-app-proof"
  export LOOM_CODEX_APP_REVIEW_THREAD_ID="thread-123"
  export LOOM_CODEX_APP_REVIEW_CWD="${WORKTREE_DIR}"
  export LOOM_CODEX_APP_REVIEW_RAW_FILE=".loom/runtime/mock/codex-app-review.json"

  local previous_ci="${CI-}"
  local previous_codex_ci="${CODEX_CI-}"
  unset CI || true
  unset CODEX_CI || true
  assert_pass run_codex_review 7
  if [[ -n "${previous_ci}" ]]; then
    export CI="${previous_ci}"
  fi
  if [[ -n "${previous_codex_ci}" ]]; then
    export CODEX_CI="${previous_codex_ci}"
  fi
  assert_equal "$(wc -l < "${MOCK_CODEX_CALLS_LOG}" | tr -d '[:space:]')" "0"
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"adapter": "loom/codex-app-review"'
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"selection_source": "explicit-cli"'
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"fallback_reason": null'
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"thread_id": "thread-123"'
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"raw_source": ".loom/runtime/mock/codex-app-review.json"'
  assert_file_contains "${TMP_DIR}/review-engine-metadata.json" '"selected_adapter": "loom/codex-app-review"'
  local metadata_file="${TMP_DIR}/review-metadata.json"
  python3 - "${REVIEW_MD_FILE}" "${metadata_file}" <<'PY'
import base64
import json
import re
import sys

body = open(sys.argv[1], encoding="utf-8").read()
match = re.search(r"<!-- webenvoy-guardian-meta:v1 ([A-Za-z0-9+/=]+) -->", body)
if not match:
    raise SystemExit("missing guardian metadata")
payload = json.loads(base64.b64decode(match.group(1)).decode("utf-8"))
with open(sys.argv[2], "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, sort_keys=True)
PY
  assert_file_contains "${metadata_file}" '"selected_adapter": "loom/codex-app-review"'
  assert_file_contains "${metadata_file}" '"selection_source": "explicit-cli"'
  assert_file_contains "${metadata_file}" '"fallback_reason": null'
  assert_file_contains "${metadata_file}" '"thread_id_present": true'
  assert_file_contains "${metadata_file}" '"thread_cwd_present": true'
  assert_file_contains "${metadata_file}" '"thread_cwd_matches_target_root": true'
  assert_file_contains "${metadata_file}" '"raw_source_present": true'
  assert_file_not_contains "${metadata_file}" "mock-app-proof"
  assert_file_not_contains "${metadata_file}" "${WORKTREE_DIR}"
  assert_file_contains "${RESULT_FILE}" '"verdict":"APPROVE"'
}

test_codex_thread_id_alone_does_not_force_codex_app_adapter() {
  setup_case_dir "codex-thread-id-only-review-binding"

  local previous_endpoint="${LOOM_CODEX_APP_REVIEW_ENDPOINT-}"
  local previous_thread_id="${LOOM_CODEX_APP_REVIEW_THREAD_ID-}"
  local previous_codex_thread_id="${CODEX_THREAD_ID-}"
  local previous_cwd="${LOOM_CODEX_APP_REVIEW_CWD-}"
  local previous_raw_file="${LOOM_CODEX_APP_REVIEW_RAW_FILE-}"
  local previous_ci="${CI-}"
  local previous_codex_ci="${CODEX_CI-}"

  unset LOOM_CODEX_APP_REVIEW_ENDPOINT || true
  unset LOOM_CODEX_APP_REVIEW_THREAD_ID || true
  unset LOOM_CODEX_APP_REVIEW_CWD || true
  unset LOOM_CODEX_APP_REVIEW_RAW_FILE || true
  unset CI || true
  unset CODEX_CI || true
  export CODEX_THREAD_ID="thread-from-codex-cli"

  populate_codex_app_review_binding_args
  assert_equal "${#REVIEW_ADAPTER_ARGS[@]}" "0"

  if [[ -n "${previous_endpoint}" ]]; then export LOOM_CODEX_APP_REVIEW_ENDPOINT="${previous_endpoint}"; else unset LOOM_CODEX_APP_REVIEW_ENDPOINT || true; fi
  if [[ -n "${previous_thread_id}" ]]; then export LOOM_CODEX_APP_REVIEW_THREAD_ID="${previous_thread_id}"; else unset LOOM_CODEX_APP_REVIEW_THREAD_ID || true; fi
  if [[ -n "${previous_codex_thread_id}" ]]; then export CODEX_THREAD_ID="${previous_codex_thread_id}"; else unset CODEX_THREAD_ID || true; fi
  if [[ -n "${previous_cwd}" ]]; then export LOOM_CODEX_APP_REVIEW_CWD="${previous_cwd}"; else unset LOOM_CODEX_APP_REVIEW_CWD || true; fi
  if [[ -n "${previous_raw_file}" ]]; then export LOOM_CODEX_APP_REVIEW_RAW_FILE="${previous_raw_file}"; else unset LOOM_CODEX_APP_REVIEW_RAW_FILE || true; fi
  if [[ -n "${previous_ci}" ]]; then export CI="${previous_ci}"; else unset CI || true; fi
  if [[ -n "${previous_codex_ci}" ]]; then export CODEX_CI="${previous_codex_ci}"; else unset CODEX_CI || true; fi
}

test_engine_model_override_requires_reason_and_preserves_default_binding() {
  setup_case_dir "engine-model-override-review-binding"

  local previous_endpoint="${LOOM_CODEX_APP_REVIEW_ENDPOINT-}"
  local previous_thread_id="${LOOM_CODEX_APP_REVIEW_THREAD_ID-}"
  local previous_cwd="${LOOM_CODEX_APP_REVIEW_CWD-}"
  local previous_raw_file="${LOOM_CODEX_APP_REVIEW_RAW_FILE-}"
  local previous_ci="${CI-}"
  local previous_codex_ci="${CODEX_CI-}"
  local previous_engine_model="${PR_GUARDIAN_ENGINE_MODEL-}"
  local previous_engine_reason="${PR_GUARDIAN_ENGINE_OVERRIDE_REASON-}"

  unset LOOM_CODEX_APP_REVIEW_ENDPOINT || true
  unset LOOM_CODEX_APP_REVIEW_THREAD_ID || true
  unset LOOM_CODEX_APP_REVIEW_CWD || true
  unset LOOM_CODEX_APP_REVIEW_RAW_FILE || true
  unset CI || true
  unset CODEX_CI || true
  unset PR_GUARDIAN_ENGINE_MODEL || true
  unset PR_GUARDIAN_ENGINE_OVERRIDE_REASON || true

  populate_codex_app_review_binding_args impl_review
  assert_equal "${#REVIEW_ADAPTER_ARGS[@]}" "0"

  export PR_GUARDIAN_ENGINE_MODEL="gpt-5.5"
  unset PR_GUARDIAN_ENGINE_OVERRIDE_REASON || true
  assert_fail populate_codex_app_review_binding_args impl_review

  export PR_GUARDIAN_ENGINE_OVERRIDE_REASON="default gpt-5.2 unsupported by current Codex account"
  populate_codex_app_review_binding_args impl_review
  assert_equal "${#REVIEW_ADAPTER_ARGS[@]}" "4"
  assert_equal "${REVIEW_ADAPTER_ARGS[0]}" "--engine-model"
  assert_equal "${REVIEW_ADAPTER_ARGS[1]}" "gpt-5.5"
  assert_equal "${REVIEW_ADAPTER_ARGS[2]}" "--engine-override-reason"
  assert_equal "${REVIEW_ADAPTER_ARGS[3]}" "default gpt-5.2 unsupported by current Codex account"

  export CODEX_CI=1
  populate_codex_app_review_binding_args impl_review
  assert_equal "${#REVIEW_ADAPTER_ARGS[@]}" "4"
  assert_equal "${REVIEW_ADAPTER_ARGS[0]}" "--engine-model"
  assert_equal "${REVIEW_ADAPTER_ARGS[1]}" "gpt-5.5"
  assert_equal "${REVIEW_ADAPTER_ARGS[2]}" "--engine-override-reason"
  assert_equal "${REVIEW_ADAPTER_ARGS[3]}" "default gpt-5.2 unsupported by current Codex account"

  if [[ -n "${previous_endpoint}" ]]; then export LOOM_CODEX_APP_REVIEW_ENDPOINT="${previous_endpoint}"; else unset LOOM_CODEX_APP_REVIEW_ENDPOINT || true; fi
  if [[ -n "${previous_thread_id}" ]]; then export LOOM_CODEX_APP_REVIEW_THREAD_ID="${previous_thread_id}"; else unset LOOM_CODEX_APP_REVIEW_THREAD_ID || true; fi
  if [[ -n "${previous_cwd}" ]]; then export LOOM_CODEX_APP_REVIEW_CWD="${previous_cwd}"; else unset LOOM_CODEX_APP_REVIEW_CWD || true; fi
  if [[ -n "${previous_raw_file}" ]]; then export LOOM_CODEX_APP_REVIEW_RAW_FILE="${previous_raw_file}"; else unset LOOM_CODEX_APP_REVIEW_RAW_FILE || true; fi
  if [[ -n "${previous_ci}" ]]; then export CI="${previous_ci}"; else unset CI || true; fi
  if [[ -n "${previous_codex_ci}" ]]; then export CODEX_CI="${previous_codex_ci}"; else unset CODEX_CI || true; fi
  if [[ -n "${previous_engine_model}" ]]; then export PR_GUARDIAN_ENGINE_MODEL="${previous_engine_model}"; else unset PR_GUARDIAN_ENGINE_MODEL || true; fi
  if [[ -n "${previous_engine_reason}" ]]; then export PR_GUARDIAN_ENGINE_OVERRIDE_REASON="${previous_engine_reason}"; else unset PR_GUARDIAN_ENGINE_OVERRIDE_REASON || true; fi
}

test_spec_review_requires_raw_file_before_forcing_codex_app_adapter() {
  setup_case_dir "spec-review-codex-app-binding-without-raw"

  local previous_endpoint="${LOOM_CODEX_APP_REVIEW_ENDPOINT-}"
  local previous_thread_id="${LOOM_CODEX_APP_REVIEW_THREAD_ID-}"
  local previous_cwd="${LOOM_CODEX_APP_REVIEW_CWD-}"
  local previous_raw_file="${LOOM_CODEX_APP_REVIEW_RAW_FILE-}"
  local previous_ci="${CI-}"
  local previous_codex_ci="${CODEX_CI-}"

  export LOOM_CODEX_APP_REVIEW_ENDPOINT="mock-app-proof"
  export LOOM_CODEX_APP_REVIEW_THREAD_ID="thread-123"
  export LOOM_CODEX_APP_REVIEW_CWD="${TMP_DIR}/worktree"
  unset LOOM_CODEX_APP_REVIEW_RAW_FILE || true
  unset CI || true
  unset CODEX_CI || true

  populate_codex_app_review_binding_args spec_review
  assert_equal "${#REVIEW_ADAPTER_ARGS[@]}" "0"

  export LOOM_CODEX_APP_REVIEW_RAW_FILE=".loom/runtime/mock/codex-app-review.json"
  populate_codex_app_review_binding_args spec_review
  assert_equal "${REVIEW_ADAPTER_ARGS[0]}" "--engine-adapter"
  assert_equal "${REVIEW_ADAPTER_ARGS[1]}" "loom/codex-app-review"

  if [[ -n "${previous_endpoint}" ]]; then export LOOM_CODEX_APP_REVIEW_ENDPOINT="${previous_endpoint}"; else unset LOOM_CODEX_APP_REVIEW_ENDPOINT || true; fi
  if [[ -n "${previous_thread_id}" ]]; then export LOOM_CODEX_APP_REVIEW_THREAD_ID="${previous_thread_id}"; else unset LOOM_CODEX_APP_REVIEW_THREAD_ID || true; fi
  if [[ -n "${previous_cwd}" ]]; then export LOOM_CODEX_APP_REVIEW_CWD="${previous_cwd}"; else unset LOOM_CODEX_APP_REVIEW_CWD || true; fi
  if [[ -n "${previous_raw_file}" ]]; then export LOOM_CODEX_APP_REVIEW_RAW_FILE="${previous_raw_file}"; else unset LOOM_CODEX_APP_REVIEW_RAW_FILE || true; fi
  if [[ -n "${previous_ci}" ]]; then export CI="${previous_ci}"; else unset CI || true; fi
  if [[ -n "${previous_codex_ci}" ]]; then export CODEX_CI="${previous_codex_ci}"; else unset CODEX_CI || true; fi
}

test_run_codex_review_fails_closed_when_codex_app_proof_is_incomplete() {
  setup_case_dir "run-codex-app-incomplete-proof-review"

  BASE_REF="main"
  PR_TITLE="app incomplete proof review"
  PR_URL="https://example.test/pr/17"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  export BASE_REF PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.json"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  SPEC_LOOM_REVIEW_RECORD_FILE="${WORKTREE_DIR}/.loom/runtime/review/guardian-spec/${HEAD_SHA:-pending}/spec-review-record.json"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE SPEC_LOOM_REVIEW_RECORD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"
  prepare_loom_guardian_review_worktree

  export LOOM_CODEX_APP_REVIEW_ENDPOINT="mock-app-proof"
  export LOOM_CODEX_APP_REVIEW_THREAD_ID="thread-123"
  unset LOOM_CODEX_APP_REVIEW_CWD || true
  unset LOOM_CODEX_APP_REVIEW_RAW_FILE || true

  local previous_ci="${CI-}"
  local previous_codex_ci="${CODEX_CI-}"
  unset CI || true
  unset CODEX_CI || true

  local err_file="${TMP_DIR}/run.err"
  assert_fail run_codex_review 17 2>"${err_file}"

  if [[ -n "${previous_ci}" ]]; then
    export CI="${previous_ci}"
  fi
  if [[ -n "${previous_codex_ci}" ]]; then
    export CODEX_CI="${previous_codex_ci}"
  fi

  assert_equal "$(wc -l < "${MOCK_CODEX_CALLS_LOG}" | tr -d '[:space:]')" "0"
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"adapter": "loom/codex-app-review"'
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"selection_source": "explicit-cli"'
  assert_file_contains "${TMP_DIR}/loom-guardian-review.json" '"failure_reason": "runtime_conflict"'
  assert_file_contains "${err_file}" "--codex-app-review-cwd"
}

test_run_codex_review_fails_closed_on_head_mismatch() {
  setup_case_dir "run-head-binding-review"

  BASE_REF="main"
  PR_TITLE="head mismatch review"
  PR_URL="https://example.test/pr/8"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  export BASE_REF PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.json"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"
  prepare_loom_guardian_review_worktree
  HEAD_SHA="deadbeef"
  export HEAD_SHA

  MOCK_CODEX_REVIEW_RESULT_JSON="${TMP_DIR}/unused-review.json"
  cat > "${MOCK_CODEX_REVIEW_RESULT_JSON}" <<'EOF'
{"decision":"allow","summary":"No blocking issues found.","findings":[]}
EOF
  export MOCK_CODEX_REVIEW_RESULT_JSON

  local err_file="${TMP_DIR}/run.err"
  assert_fail run_codex_review 8 2>"${err_file}"
  assert_equal "$(wc -l < "${MOCK_CODEX_CALLS_LOG}" | tr -d '[:space:]')" "0"
}

test_run_codex_review_uses_loom_spec_review_record_for_spec_profile() {
  setup_case_dir "run-loom-spec-review"

  BASE_REF="main"
  PR_TITLE="spec review"
  PR_URL="https://example.test/pr/9"
  PR_BODY=$'## 摘要\n\n- 变更目的：Spec review\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="spec_review_profile"
  MERGE_BASE_SHA="merge-base-sha-123"
  BASE_SHA="base-sha-123"
  PR_NUMBER="9"
  export BASE_REF PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE MERGE_BASE_SHA BASE_SHA PR_NUMBER

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev/specs/FR-0001-demo"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  mkdir -p "${WORKTREE_DIR}/plugins/loom/skills/loom-spec-review/scripts"
  mkdir -p "${WORKTREE_DIR}/.loom/companion"
  export WORKTREE_DIR
  seed_loom_skills_root_fixture

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.json"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'docs/dev/specs/FR-0001-demo/spec.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REPO_ROOT}/spec_review.md" "${WORKTREE_DIR}/spec_review.md"
  cp "${REPO_ROOT}/.loom/companion/repo-interface.json" "${WORKTREE_DIR}/.loom/companion/repo-interface.json"
  cat > "${WORKTREE_DIR}/plugins/loom/skills/loom-spec-review/scripts/loom-spec-review.py" <<'PY'
#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("domain")
parser.add_argument("operation")
parser.add_argument("--target", required=True)
parser.add_argument("--review-file", required=True)
parser.add_argument("--guardian-prompt-file", required=True)
parser.add_argument("--guardian-output-file", required=True)
parser.add_argument("--guardian-expected-head", required=True)
parser.add_argument("--guardian-tmp-dir", required=True)
parser.add_argument("--guardian-pr-number", required=True)
parser.add_argument("--guardian-base-sha", required=True)
parser.add_argument("--guardian-reviewed-scope-file", required=True)
args, _ = parser.parse_known_args()

target = Path(args.target)
prompt = Path(args.guardian_prompt_file).read_text(encoding="utf-8")
scope_lines = [
    line.strip()
    for line in Path(args.guardian_reviewed_scope_file).read_text(encoding="utf-8").splitlines()
    if line.strip()
]
interface_file = target / ".loom/companion/repo-interface.json"
spec_locator = "spec_review.md"
if interface_file.exists():
    spec_locator = (
        json.loads(interface_file.read_text(encoding="utf-8"))
        .get("review_instruction_locators", {})
        .get("spec_review", {})
        .get("locator", spec_locator)
    )
capture = os.environ.get("MOCK_CODEX_PROMPT_CAPTURE")
if capture:
    engine_prompt = "\n".join([
        "你是 Loom spec review engine。",
        f"Spec review instruction locator: `{spec_locator}`",
        "以下是 locator 指向的 WebEnvoy spec review 规则全文：",
        prompt,
    ])
    Path(capture).write_text(engine_prompt, encoding="utf-8")

raw_result = Path(os.environ["MOCK_CODEX_REVIEW_RESULT_JSON"]).read_text(encoding="utf-8")
Path(args.guardian_output_file).write_text(raw_result, encoding="utf-8")
review_result = json.loads(raw_result)
decision = "allow" if review_result.get("decision") == "allow" else "block"
record = {
    "schema_version": "loom-review/v1",
    "item_id": f"github-pr-{args.guardian_pr_number}",
    "kind": "spec_review",
    "decision": decision,
    "reviewer": "mock-loom-spec-review",
    "reviewed_head": args.guardian_expected_head,
    "reviewed_validation_summary": "Mock Loom spec review fixture for guardian spec profile.",
    "fallback_to": None,
    "summary": review_result.get("summary", ""),
    "findings": review_result.get("findings", []),
    "blocking_issues": [],
    "follow_ups": [],
    "review_subject": {
        "pr_number": args.guardian_pr_number,
        "head_sha": args.guardian_expected_head,
        "base_sha": args.guardian_base_sha,
        "spec_locator": spec_locator,
        "reviewed_scope": scope_lines,
    },
    "review_provenance": {
        "reviewer": "mock-loom-spec-review",
        "engine_adapter": "mock-python-launcher",
        "fail_closed_reason": None,
    },
}
record_path = target / args.review_file
record_path.parent.mkdir(parents=True, exist_ok=True)
record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"spec_review": {"record": record}}, ensure_ascii=False))
PY
  chmod +x "${WORKTREE_DIR}/plugins/loom/skills/loom-spec-review/scripts/loom-spec-review.py"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"
  cp "${SPEC_REVIEW_SUMMARY_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-spec-review-summary.md"
  printf '%s\n' "# Spec" > "${WORKTREE_DIR}/docs/dev/specs/FR-0001-demo/spec.md"
  printf '%s\n' "# TODO" > "${WORKTREE_DIR}/docs/dev/specs/FR-0001-demo/TODO.md"
  printf '%s\n' "# Plan" > "${WORKTREE_DIR}/docs/dev/specs/FR-0001-demo/plan.md"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"
  git -C "${WORKTREE_DIR}" init -q
  git -C "${WORKTREE_DIR}" config user.email "guardian-test@example.test"
  git -C "${WORKTREE_DIR}" config user.name "Guardian Test"
  git -C "${WORKTREE_DIR}" add .
  git -C "${WORKTREE_DIR}" commit -qm "initial"
  HEAD_SHA="$(git -C "${WORKTREE_DIR}" rev-parse HEAD)"
  SPEC_LOOM_REVIEW_RECORD_FILE="${WORKTREE_DIR}/.loom/runtime/review/guardian-spec/${HEAD_SHA}/spec-review-record.json"
  export HEAD_SHA SPEC_LOOM_REVIEW_RECORD_FILE

  MOCK_CODEX_REVIEW_RESULT_JSON="${TMP_DIR}/spec-review.json"
  cat > "${MOCK_CODEX_REVIEW_RESULT_JSON}" <<'EOF'
{"decision":"allow","summary":"Spec review approved.","findings":[]}
EOF
  export MOCK_CODEX_REVIEW_RESULT_JSON

  assert_pass run_codex_review 9
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "你是 Loom spec review engine"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" 'Spec review instruction locator: `spec_review.md`'
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "WebEnvoy spec review"
  assert_file_contains "${RESULT_FILE}" '"verdict":"APPROVE"'
  assert_file_contains "${REVIEW_MD_FILE}" "**Source authority**: Loom spec review record"
  assert_equal "$(jq -r '.kind' "${SPEC_LOOM_REVIEW_RECORD_FILE}")" "spec_review"
  assert_equal "$(jq -r '.review_subject.pr_number' "${SPEC_LOOM_REVIEW_RECORD_FILE}")" "9"
  assert_equal "$(jq -r '.review_subject.base_sha' "${SPEC_LOOM_REVIEW_RECORD_FILE}")" "base-sha-123"
  assert_equal "$(jq -r '.review_subject.spec_locator' "${SPEC_LOOM_REVIEW_RECORD_FILE}")" "spec_review.md"
}

test_run_codex_review_uses_context_budget_prompt_and_native_review_engine() {
  setup_case_dir "run-budget-review"

  BASE_REF="main"
  HEAD_SHA="head-sha-123"
  PR_TITLE="test title"
  PR_URL="https://example.test/pr/1"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n\n## 关联事项\n\n- Issue: #123\n- Closing: Refs #123\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="high_risk_impl_profile"
  ISSUE_NUMBER="123"
  export BASE_REF HEAD_SHA PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE ISSUE_NUMBER

  WORKTREE_DIR="${TMP_DIR}/worktree"
  BASELINE_SNAPSHOT_ROOT="${TMP_DIR}/baseline-snapshot"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  mkdir -p "${BASELINE_SNAPSHOT_ROOT}/docs/dev/review"
  export WORKTREE_DIR BASELINE_SNAPSHOT_ROOT

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.json"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'scripts/pr-guardian.sh' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  printf '%s\n' "branch todo" > "${WORKTREE_DIR}/TODO.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${BASELINE_SNAPSHOT_ROOT}/docs/dev/review/guardian-review-addendum.md"
  cp "${SPEC_REVIEW_SUMMARY_FILE}" "${BASELINE_SNAPSHOT_ROOT}/docs/dev/review/guardian-spec-review-summary.md"

  MOCK_GH_ISSUE_VIEW_JSON="${TMP_DIR}/issue-view.json"
  printf '%s\n' '{"number":123,"title":"Guardian issue","body":"## 目标\n\n- Keep acceptance\n\n## 关闭条件\n\n- guardian approve\n"}' > "${MOCK_GH_ISSUE_VIEW_JSON}"
  export MOCK_GH_ISSUE_VIEW_JSON
  fetch_issue_summary > "${ISSUE_SUMMARY_FILE}"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"

  prepare_loom_guardian_review_worktree

  MOCK_CODEX_REVIEW_RESULT_JSON="${TMP_DIR}/native-review.json"
  cat > "${MOCK_CODEX_REVIEW_RESULT_JSON}" <<'EOF'
{"decision":"allow","summary":"No blocking issues found.","findings":[]}
EOF
  export MOCK_CODEX_REVIEW_RESULT_JSON

  assert_pass run_codex_review 1
  assert_file_contains "${MOCK_CODEX_CALLS_LOG}" "exec -C"
  assert_file_contains "${MOCK_CODEX_CALLS_LOG}" "--add-dir"
  assert_file_contains "${MOCK_CODEX_CALLS_LOG}" "run-budget-review/tmp"
  assert_file_contains "${MOCK_CODEX_CALLS_LOG}" "--output-schema"
  assert_file_not_contains "${MOCK_CODEX_CALLS_LOG}" " review "
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "Guardian 常驻审查摘要"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "Loom guardian compatibility review engine"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "vision.md"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "AGENTS.md"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "docs/dev/roadmap.md"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "code_review.md"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "Issue #123: Guardian issue"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "## 目标"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "- Keep acceptance"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "${BASELINE_SNAPSHOT_ROOT}/docs/dev/review/guardian-review-addendum.md"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" "绝对路径临时文件表示 merge-base / trusted snapshot"
  assert_file_contains "${MOCK_CODEX_PROMPT_CAPTURE}" 'git merge-base HEAD origin/main'
  assert_file_contains "${WORKTREE_DIR}/TODO.md" "branch todo"
  assert_file_not_contains "${WORKTREE_DIR}/TODO.md" "Guardian 常驻审查摘要"
  assert_file_contains "${RESULT_FILE}" '"verdict":"APPROVE"'
}

test_run_codex_review_uses_loom_schema_without_formatter() {
  setup_case_dir "run-loom-schema-review"

  BASE_REF="main"
  HEAD_SHA="head-sha-321"
  PR_TITLE="plain text review"
  PR_URL="https://example.test/pr/4"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  export BASE_REF HEAD_SHA PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.txt"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"

  prepare_loom_guardian_review_worktree

  MOCK_CODEX_REVIEW_RESULT_JSON="${TMP_DIR}/loom-review.json"
  cat > "${MOCK_CODEX_REVIEW_RESULT_JSON}" <<'EOF'
{"decision":"allow","summary":"未发现新的阻断性问题。","findings":[]}
EOF
  export MOCK_CODEX_REVIEW_RESULT_JSON

  assert_pass run_codex_review 4
  assert_equal "$(wc -l < "${MOCK_CODEX_CALLS_LOG}" | tr -d '[:space:]')" "1"
  assert_file_contains "${PROMPT_RUN_FILE}" "请保持结构化 JSON 输出"
  if [[ -e "${TMP_DIR}/codex-native-review-format.prompt.md" ]]; then
    echo "formatter prompt should not be created when Loom returns schema output" >&2
    exit 1
  fi
  assert_file_contains "${RESULT_FILE}" '"verdict":"APPROVE"'
  assert_file_contains "${REVIEW_MD_FILE}" "**结论**: APPROVE"
}

test_run_codex_review_fails_closed_when_native_review_command_fails() {
  setup_case_dir "run-review-native-failure"

  BASE_REF="main"
  HEAD_SHA="head-sha-789"
  PR_TITLE="native review failure"
  PR_URL="https://example.test/pr/3"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  export BASE_REF HEAD_SHA PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.json"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"
  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"

  MOCK_CODEX_FORCE_FAIL=1
  export MOCK_CODEX_FORCE_FAIL
  prepare_loom_guardian_review_worktree

  MOCK_CODEX_REVIEW_RESULT_JSON="${TMP_DIR}/unused-review.json"
  cat > "${MOCK_CODEX_REVIEW_RESULT_JSON}" <<'EOF'
{"findings":[],"overall_correctness":"patch is correct","overall_explanation":"No blocking issues found.","overall_confidence_score":0.42}
EOF
  export MOCK_CODEX_REVIEW_RESULT_JSON

  local err_file="${TMP_DIR}/run.err"
  assert_fail run_codex_review 3 2>"${err_file}"
  assert_file_contains "${MOCK_CODEX_CALLS_LOG}" "--output-schema"
  assert_file_contains "${err_file}" "mock codex failure"
  assert_file_contains "${err_file}" "Loom guardian review engine 执行失败"
}

test_run_codex_review_fails_closed_on_loom_schema_drift() {
  setup_case_dir "run-review-schema-drift"

  BASE_REF="main"
  HEAD_SHA="head-sha-987"
  PR_TITLE="formatter failure"
  PR_URL="https://example.test/pr/5"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  export BASE_REF HEAD_SHA PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.txt"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"

  prepare_loom_guardian_review_worktree

  MOCK_CODEX_REVIEW_RESULT_JSON="${TMP_DIR}/invalid-loom-review.json"
  cat > "${MOCK_CODEX_REVIEW_RESULT_JSON}" <<'EOF'
{"decision":"allow","summary":"missing findings"}
EOF
  export MOCK_CODEX_REVIEW_RESULT_JSON

  local err_file="${TMP_DIR}/run.err"
  assert_fail run_codex_review 5 2>"${err_file}"
  assert_equal "$(wc -l < "${MOCK_CODEX_CALLS_LOG}" | tr -d '[:space:]')" "1"
  assert_file_contains "${err_file}" "schema_drift"
  assert_file_contains "${err_file}" "Loom guardian review engine 执行失败"
}

test_run_codex_review_fails_closed_when_engine_mutates_tracked_file() {
  setup_case_dir "run-review-tracked-mutation"

  BASE_REF="main"
  HEAD_SHA="head-sha-654"
  PR_TITLE="sparse formatter schema"
  PR_URL="https://example.test/pr/6"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  export BASE_REF HEAD_SHA PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.txt"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"
  printf '%s\n' "tracked mutation target" > "${WORKTREE_DIR}/README.md"

  collect_context_docs "${CHANGED_FILES_FILE}" "${CONTEXT_DOCS_FILE}"

  prepare_loom_guardian_review_worktree

  MOCK_CODEX_REVIEW_RESULT_JSON="${TMP_DIR}/loom-review.json"
  cat > "${MOCK_CODEX_REVIEW_RESULT_JSON}" <<'EOF'
{"decision":"allow","summary":"No blocking issues found.","findings":[]}
EOF
  export MOCK_CODEX_REVIEW_RESULT_JSON
  export MOCK_CODEX_MUTATE_TRACKED_FILE="${WORKTREE_DIR}/README.md"

  local err_file="${TMP_DIR}/run.err"
  assert_fail run_codex_review 6 2>"${err_file}"
  assert_file_contains "${err_file}" "repo_diff_detected"
  assert_file_contains "${err_file}" "Loom guardian review engine 执行失败"
}

test_main_review_mode_does_not_fail_on_mode_expansion_after_summary() {
  setup_case_dir "main-review-mode"

  local call_log="${TMP_DIR}/main.calls.log"
  export call_log

  (
    require_cmd() { :; }
    check_gh_auth() { printf '%s\n' "check_gh_auth" >> "${call_log}"; }
    prepare_pr_workspace() { printf '%s\n' "prepare_pr_workspace:$1" >> "${call_log}"; }
    assert_required_review_context_available() { printf '%s\n' "assert_required_review_context_available" >> "${call_log}"; }
    ensure_review_prompt_prepared() { printf '%s\n' "ensure_review_prompt_prepared:$1" >> "${call_log}"; }
    run_codex_review() { printf '%s\n' "run_codex_review:$1" >> "${call_log}"; }
    print_summary() { printf '%s\n' "print_summary" >> "${call_log}"; }
    post_review() { printf '%s\n' "post_review:$1" >> "${call_log}"; }
    merge_if_safe() { printf '%s\n' "merge_if_safe:$1:$2" >> "${call_log}"; }
    cleanup() { :; }

    assert_pass main review 274
  )
  assert_file_contains "${call_log}" "check_gh_auth"
  assert_file_contains "${call_log}" "prepare_pr_workspace:274"
  assert_file_contains "${call_log}" "ensure_review_prompt_prepared:274"
  assert_file_contains "${call_log}" "run_codex_review:274"
  assert_file_contains "${call_log}" "print_summary"
  assert_file_not_contains "${call_log}" "post_review:274"
  assert_file_not_contains "${call_log}" "merge_if_safe:274"
}

test_main_review_without_post_review_does_not_write_local_guardian_proof() {
  setup_case_dir "main-review-without-post-review-proof"

  local call_log="${TMP_DIR}/main.calls.log"
  local proof_file
  export call_log

  proof_file="$(guardian_proof_store_file)"

  (
    require_cmd() { :; }
    check_gh_auth() { printf '%s\n' "check_gh_auth" >> "${call_log}"; }
    prepare_pr_workspace() { printf '%s\n' "prepare_pr_workspace:$1" >> "${call_log}"; }
    assert_required_review_context_available() { printf '%s\n' "assert_required_review_context_available" >> "${call_log}"; }
    ensure_review_prompt_prepared() { printf '%s\n' "ensure_review_prompt_prepared:$1" >> "${call_log}"; }
    run_codex_review() {
      printf '%s\n' "run_codex_review:$1" >> "${call_log}"
      RESULT_FILE="${TMP_DIR}/review.json"
      REVIEW_MD_FILE="${TMP_DIR}/review.md"
      printf '%s\n' '{"verdict":"APPROVE","safe_to_merge":true,"summary":"fresh","findings":[],"required_actions":[]}' > "${RESULT_FILE}"
      printf '%s\n' "fresh review body" > "${REVIEW_MD_FILE}"
      export RESULT_FILE REVIEW_MD_FILE
    }
    print_summary() { printf '%s\n' "print_summary" >> "${call_log}"; }
    post_review() { printf '%s\n' "post_review:$1" >> "${call_log}"; }
    merge_if_safe() { printf '%s\n' "merge_if_safe:$1:$2" >> "${call_log}"; }
    cleanup() { :; }

    assert_pass main review 274
  )

  assert_file_contains "${call_log}" "run_codex_review:274"
  assert_file_not_contains "${call_log}" "post_review:274"
  if [[ -e "${proof_file}" ]]; then
    echo "expected no local guardian proof file at ${proof_file}" >&2
    exit 1
  fi
}

test_main_review_status_uses_lightweight_context_only() {
  setup_case_dir "main-review-status-lightweight"

  local call_log="${TEST_TMP_DIR}/main-review-status-lightweight/main.calls.log"
  export call_log

  (
    unset TMP_DIR || true
    require_cmd() { :; }
    gh() {
      if [[ "${1:-}" == "api" && "${2:-}" == "user" ]]; then
        printf '%s\n' "review-bot"
        return 0
      fi
      echo "unexpected gh call: $*" >&2
      return 1
    }
    check_gh_auth() { printf '%s\n' "check_gh_auth" >> "${call_log}"; }
    prepare_review_status_context() {
      TMP_DIR="${TEST_TMP_DIR}/main-review-status-lightweight/runtime-tmp"
      mkdir -p "${TMP_DIR}"
      export TMP_DIR
      printf '%s\n' "prepare_review_status_context:$1" >> "${call_log}"
    }
    write_light_review_status_json() {
      printf '%s\n' "write_light_review_status_json:$1:$2" >> "${call_log}"
      cat > "$3" <<'EOF'
{"reusable":true,"reason":"matching_metadata","head_sha":"head-sha-123","review_profile":"high_risk_impl_profile","prompt_digest":"prompt-digest-123","verdict":"APPROVE","safe_to_merge":true}
EOF
    }
    prepare_pr_workspace() { printf '%s\n' "prepare_pr_workspace:$1" >> "${call_log}"; return 42; }
    assert_required_review_context_available() { printf '%s\n' "assert_required_review_context_available" >> "${call_log}"; return 42; }
    ensure_review_prompt_prepared() { printf '%s\n' "ensure_review_prompt_prepared:$1" >> "${call_log}"; return 42; }
    run_codex_review() { printf '%s\n' "run_codex_review:$1" >> "${call_log}"; return 42; }
    print_summary() { printf '%s\n' "print_summary" >> "${call_log}"; }
    post_review() { printf '%s\n' "post_review:$1" >> "${call_log}"; return 42; }
    merge_if_safe() { printf '%s\n' "merge_if_safe:$1:$2" >> "${call_log}"; return 42; }
    cleanup() { :; }

    assert_pass main review-status 274
  )

  assert_file_contains "${call_log}" "check_gh_auth"
  assert_file_contains "${call_log}" "prepare_review_status_context:274"
  assert_file_contains "${call_log}" "write_light_review_status_json:274:review-bot"
  assert_file_not_contains "${call_log}" "prepare_pr_workspace:274"
  assert_file_not_contains "${call_log}" "assert_required_review_context_available"
  assert_file_not_contains "${call_log}" "ensure_review_prompt_prepared:274"
  assert_file_not_contains "${call_log}" "run_codex_review:274"
  assert_file_not_contains "${call_log}" "post_review:274"
  assert_file_not_contains "${call_log}" "merge_if_safe:274"
}

test_main_review_with_post_review_reuses_existing_guardian_review() {
  setup_case_dir "main-review-reuse"

  local call_log="${TMP_DIR}/main.calls.log"
  export call_log

  (
    require_cmd() { :; }
    gh() {
      if [[ "${1:-}" == "api" && "${2:-}" == "user" ]]; then
        printf '%s\n' "review-bot"
        return 0
      fi
      echo "unexpected gh call: $*" >&2
      return 1
    }
    check_gh_auth() { printf '%s\n' "check_gh_auth" >> "${call_log}"; }
    prepare_pr_workspace() { printf '%s\n' "prepare_pr_workspace:$1" >> "${call_log}"; }
    assert_required_review_context_available() { printf '%s\n' "assert_required_review_context_available" >> "${call_log}"; }
    ensure_review_prompt_prepared() { printf '%s\n' "ensure_review_prompt_prepared:$1" >> "${call_log}"; }
    write_review_status_json() {
      cat > "$3" <<'EOF'
{"reusable":true,"reason":"matching_metadata","head_sha":"head-sha-123","review_profile":"high_risk_impl_profile","prompt_digest":"prompt-digest-123","verdict":"APPROVE","safe_to_merge":true,"review_body":"reused review body"}
EOF
    }
    hydrate_reused_review_result() { printf '%s\n' "hydrate_reused_review_result" >> "${call_log}"; }
    run_codex_review() { printf '%s\n' "run_codex_review:$1" >> "${call_log}"; }
    print_summary() { printf '%s\n' "print_summary" >> "${call_log}"; }
    post_review() { printf '%s\n' "post_review:$1" >> "${call_log}"; }
    merge_if_safe() { printf '%s\n' "merge_if_safe:$1:$2" >> "${call_log}"; }
    cleanup() { :; }

    assert_pass main review 274 --post-review
  )

  assert_file_contains "${call_log}" "check_gh_auth"
  assert_file_contains "${call_log}" "prepare_pr_workspace:274"
  assert_file_contains "${call_log}" "ensure_review_prompt_prepared:274"
  assert_file_contains "${call_log}" "hydrate_reused_review_result"
  assert_file_contains "${call_log}" "print_summary"
  assert_file_not_contains "${call_log}" "run_codex_review:274"
  assert_file_not_contains "${call_log}" "post_review:274"
  assert_file_not_contains "${call_log}" "merge_if_safe:274"
}

test_main_merge_if_safe_reuses_existing_guardian_review() {
  setup_case_dir "main-merge-if-safe-reuse"
  seed_repo_bootstrap_manifest_fixture

  local call_log="${TMP_DIR}/main.calls.log"
  export call_log

  (
    require_cmd() { :; }
    gh() {
      if [[ "${1:-}" == "api" && "${2:-}" == "user" ]]; then
        printf '%s\n' "review-bot"
        return 0
      fi
      echo "unexpected gh call: $*" >&2
      return 1
    }
    check_gh_auth() { printf '%s\n' "check_gh_auth" >> "${call_log}"; }
    prepare_pr_workspace() { printf '%s\n' "prepare_pr_workspace:$1" >> "${call_log}"; }
    assert_required_review_context_available() { printf '%s\n' "assert_required_review_context_available" >> "${call_log}"; }
    ensure_review_prompt_prepared() { printf '%s\n' "ensure_review_prompt_prepared:$1" >> "${call_log}"; }
    write_review_status_json() {
      printf '%s\n' "write_review_status_json:$1:$2" >> "${call_log}"
      cat > "$3" <<'EOF'
{"reusable":true,"reason":"matching_metadata","head_sha":"head-sha-123","review_profile":"high_risk_impl_profile","prompt_digest":"prompt-digest-123","verdict":"APPROVE","safe_to_merge":true,"review_body":"reused review body"}
EOF
    }
    hydrate_reused_review_result() {
      printf '%s\n' "hydrate_reused_review_result:$1" >> "${call_log}"
      RESULT_FILE="${TMP_DIR}/review.json"
      REVIEW_MD_FILE="${TMP_DIR}/review.md"
      printf '%s\n' '{"verdict":"APPROVE","safe_to_merge":true,"summary":"reused","findings":[],"required_actions":[]}' > "${RESULT_FILE}"
      printf '%s\n' "reused review body" > "${REVIEW_MD_FILE}"
      export RESULT_FILE REVIEW_MD_FILE
    }
    run_codex_review() { printf '%s\n' "run_codex_review:$1" >> "${call_log}"; }
    print_summary() { printf '%s\n' "print_summary" >> "${call_log}"; }
    post_review() { printf '%s\n' "post_review:$1" >> "${call_log}"; }
    merge_if_safe() { printf '%s\n' "merge_if_safe:$1:$2" >> "${call_log}"; }
    cleanup() { :; }

    assert_pass main merge-if-safe 274
  )

  assert_file_contains "${call_log}" "check_gh_auth"
  assert_file_contains "${call_log}" "prepare_pr_workspace:274"
  assert_file_contains "${call_log}" "ensure_review_prompt_prepared:274"
  assert_file_contains "${call_log}" "write_review_status_json:274:review-bot"
  assert_file_contains "${call_log}" "hydrate_reused_review_result:"
  assert_file_contains "${call_log}" "print_summary"
  assert_file_contains "${call_log}" "merge_if_safe:274:0"
  assert_file_not_contains "${call_log}" "run_codex_review:274"
  assert_file_not_contains "${call_log}" "post_review:274"
  cleanup_repo_bootstrap_manifest_fixture
}

test_main_review_with_post_review_falls_back_to_fresh_review_when_status_query_fails() {
  setup_case_dir "main-review-fallback-after-status-query-failure"

  local call_log="${TMP_DIR}/main.calls.log"
  export call_log

  (
    require_cmd() { :; }
    gh() {
      if [[ "${1:-}" == "api" && "${2:-}" == "user" ]]; then
        printf '%s\n' "review-bot"
        return 0
      fi
      echo "unexpected gh call: $*" >&2
      return 1
    }
    check_gh_auth() { printf '%s\n' "check_gh_auth" >> "${call_log}"; }
    prepare_pr_workspace() { printf '%s\n' "prepare_pr_workspace:$1" >> "${call_log}"; }
    assert_required_review_context_available() { printf '%s\n' "assert_required_review_context_available" >> "${call_log}"; }
    ensure_review_prompt_prepared() { printf '%s\n' "ensure_review_prompt_prepared:$1" >> "${call_log}"; }
    write_review_status_json() {
      printf '%s\n' "write_review_status_json:$1:$2" >> "${call_log}"
      return 42
    }
    hydrate_reused_review_result() { printf '%s\n' "hydrate_reused_review_result" >> "${call_log}"; }
    run_codex_review() { printf '%s\n' "run_codex_review:$1" >> "${call_log}"; }
    print_summary() { printf '%s\n' "print_summary" >> "${call_log}"; }
    post_review() { printf '%s\n' "post_review:$1" >> "${call_log}"; }
    merge_if_safe() { printf '%s\n' "merge_if_safe:$1:$2" >> "${call_log}"; }
    cleanup() { :; }

    assert_pass main review 274 --post-review
  )

  assert_file_contains "${call_log}" "write_review_status_json:274:review-bot"
  assert_file_contains "${call_log}" "run_codex_review:274"
  assert_file_contains "${call_log}" "post_review:274"
  assert_file_not_contains "${call_log}" "hydrate_reused_review_result"
}

test_main_merge_if_safe_falls_back_to_fresh_review_when_status_query_fails() {
  setup_case_dir "main-merge-if-safe-fallback-after-status-query-failure"
  seed_repo_bootstrap_manifest_fixture

  local call_log="${TMP_DIR}/main.calls.log"
  export call_log

  (
    require_cmd() { :; }
    gh() {
      if [[ "${1:-}" == "api" && "${2:-}" == "user" ]]; then
        printf '%s\n' "review-bot"
        return 0
      fi
      echo "unexpected gh call: $*" >&2
      return 1
    }
    check_gh_auth() { printf '%s\n' "check_gh_auth" >> "${call_log}"; }
    prepare_pr_workspace() { printf '%s\n' "prepare_pr_workspace:$1" >> "${call_log}"; }
    assert_required_review_context_available() { printf '%s\n' "assert_required_review_context_available" >> "${call_log}"; }
    ensure_review_prompt_prepared() { printf '%s\n' "ensure_review_prompt_prepared:$1" >> "${call_log}"; }
    write_review_status_json() {
      printf '%s\n' "write_review_status_json:$1:$2" >> "${call_log}"
      return 42
    }
    hydrate_reused_review_result() { printf '%s\n' "hydrate_reused_review_result:$1" >> "${call_log}"; }
    run_codex_review() { printf '%s\n' "run_codex_review:$1" >> "${call_log}"; }
    print_summary() { printf '%s\n' "print_summary" >> "${call_log}"; }
    post_review() { printf '%s\n' "post_review:$1" >> "${call_log}"; }
    merge_if_safe() { printf '%s\n' "merge_if_safe:$1:$2" >> "${call_log}"; }
    cleanup() { :; }

    assert_pass main merge-if-safe 274
  )

  assert_file_contains "${call_log}" "write_review_status_json:274:review-bot"
  assert_file_contains "${call_log}" "run_codex_review:274"
  assert_file_contains "${call_log}" "merge_if_safe:274:0"
  assert_file_not_contains "${call_log}" "hydrate_reused_review_result"
  cleanup_repo_bootstrap_manifest_fixture
}

test_ensure_loom_installed_skills_root_prefers_review_worktree_over_stale_env() {
  setup_case_dir "loom-installed-skills-root-prefers-review-worktree"

  REPO_ROOT="${TMP_DIR}/source-repo"
  WORKTREE_DIR="${TMP_DIR}/review-worktree"
  local stale_root="${TMP_DIR}/stale-worktree/plugins/loom/skills"
  local review_root="${WORKTREE_DIR}/plugins/loom/skills"
  mkdir -p "${stale_root}/shared" "${review_root}/shared"
  touch "${stale_root}/registry.json" "${review_root}/registry.json"
  export REPO_ROOT WORKTREE_DIR
  LOOM_INSTALLED_SKILLS_ROOT="${stale_root}"
  export LOOM_INSTALLED_SKILLS_ROOT

  assert_pass ensure_loom_installed_skills_root
  assert_equal "${review_root}" "${LOOM_INSTALLED_SKILLS_ROOT}"
  restore_test_repo_root
}

test_ensure_loom_installed_skills_root_uses_user_plugin_for_metadata_only_repo() {
  setup_case_dir "loom-installed-skills-root-user-plugin-metadata-only"

  REPO_ROOT="${TMP_DIR}/source-repo"
  WORKTREE_DIR="${TMP_DIR}/review-worktree"
  HOME="${TMP_DIR}/home"
  local stale_root="${TMP_DIR}/stale-worktree/plugins/loom/skills"
  local user_root="${HOME}/plugins/loom/skills"
  mkdir -p "${stale_root}/shared" "${user_root}/shared"
  touch "${stale_root}/registry.json" "${user_root}/registry.json"
  export REPO_ROOT WORKTREE_DIR HOME
  LOOM_INSTALLED_SKILLS_ROOT="${stale_root}"
  export LOOM_INSTALLED_SKILLS_ROOT

  assert_pass ensure_loom_installed_skills_root
  assert_equal "${user_root}" "${LOOM_INSTALLED_SKILLS_ROOT}"
  restore_test_repo_root
}

test_fetch_issue_summary_fails_closed_when_issue_lookup_fails() {
  setup_case_dir "run-review-without-issue-summary"

  BASE_REF="main"
  HEAD_SHA="head-sha-456"
  PR_TITLE="issue lookup degraded"
  PR_URL="https://example.test/pr/2"
  PR_BODY=$'## 摘要\n\n- 变更目的：Guardian\n\n## 关联事项\n\n- Issue: #123\n'
  PR_AUTHOR="author"
  REVIEW_PROFILE="default_impl_profile"
  ISSUE_NUMBER="123"
  export BASE_REF HEAD_SHA PR_TITLE PR_URL PR_BODY PR_AUTHOR REVIEW_PROFILE ISSUE_NUMBER

  WORKTREE_DIR="${TMP_DIR}/worktree"
  mkdir -p "${WORKTREE_DIR}/docs/dev/review"
  mkdir -p "${WORKTREE_DIR}/docs/dev/architecture"
  mkdir -p "${WORKTREE_DIR}/docs/dev"
  export WORKTREE_DIR

  CHANGED_FILES_FILE="${TMP_DIR}/changed-files.txt"
  CONTEXT_DOCS_FILE="${TMP_DIR}/context-docs.txt"
  SLIM_PR_FILE="${TMP_DIR}/pr-summary.md"
  ISSUE_SUMMARY_FILE="${TMP_DIR}/issue-summary.md"
  PROMPT_RUN_FILE="${TMP_DIR}/prompt.md"
  REVIEW_STATS_FILE="${TMP_DIR}/review-stats.txt"
  RAW_RESULT_FILE="${TMP_DIR}/review.raw.json"
  RESULT_FILE="${TMP_DIR}/review.json"
  REVIEW_MD_FILE="${TMP_DIR}/review.md"
  export CHANGED_FILES_FILE CONTEXT_DOCS_FILE SLIM_PR_FILE ISSUE_SUMMARY_FILE PROMPT_RUN_FILE REVIEW_STATS_FILE RAW_RESULT_FILE RESULT_FILE REVIEW_MD_FILE

  printf '%s\n' 'README.md' > "${CHANGED_FILES_FILE}"
  slim_pr_body > "${SLIM_PR_FILE}"
  cp "${REPO_ROOT}/vision.md" "${WORKTREE_DIR}/vision.md"
  cp "${REPO_ROOT}/AGENTS.md" "${WORKTREE_DIR}/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/AGENTS.md" "${WORKTREE_DIR}/docs/dev/AGENTS.md"
  cp "${REPO_ROOT}/docs/dev/roadmap.md" "${WORKTREE_DIR}/docs/dev/roadmap.md"
  cp "${REPO_ROOT}/docs/dev/architecture/system-design.md" "${WORKTREE_DIR}/docs/dev/architecture/system-design.md"
  cp "${REPO_ROOT}/code_review.md" "${WORKTREE_DIR}/code_review.md"
  cp "${REVIEW_ADDENDUM_FILE}" "${WORKTREE_DIR}/docs/dev/review/guardian-review-addendum.md"

  MOCK_GH_ISSUE_VIEW_EXIT_CODE=1
  MOCK_GH_ISSUE_VIEW_STDERR="issue not found"
  export MOCK_GH_ISSUE_VIEW_EXIT_CODE MOCK_GH_ISSUE_VIEW_STDERR

  local err_file="${TMP_DIR}/issue.err"
  assert_fail fetch_issue_summary > "${ISSUE_SUMMARY_FILE}" 2>"${err_file}"
  assert_file_contains "${err_file}" "关联 Issue 拉取失败，无法按仓库要求补齐审查上下文: #123"
}

setup_hydrate_fixture() {
  local case_name="$1"
  setup_case_dir "${case_name}"

  local fixture_root="${TEST_TMP_DIR}/${case_name}/hydrate"
  local source_root="${fixture_root}/repo"
  local worktree_root="${fixture_root}/worktree"
  mkdir -p "${source_root}" "${worktree_root}"

  REPO_ROOT="${source_root}"
  WORKTREE_DIR="${worktree_root}"
  export REPO_ROOT
  export WORKTREE_DIR

  MOCK_NPM_CALLS_LOG="${TEST_TMP_DIR}/${case_name}/mock/npm.calls.log"
  : > "${MOCK_NPM_CALLS_LOG}"
  export MOCK_NPM_CALLS_LOG
}
