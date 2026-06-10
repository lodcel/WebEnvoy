import { createHash } from "node:crypto";

import {
  type Fr0032UploadArtifactIdentity,
  type Fr0032UploadEntryGate
} from "./fr0032-controlled-upload-evidence.js";

export type Fr0032LiveWriteDecision = "PASS" | "NO_GO";
export type Fr0032LiveWriteAttemptState =
  | "initialized"
  | "uploaded"
  | "submitted"
  | "published"
  | "cleanup_started"
  | "closed"
  | "stopped"
  | "failed";
export type Fr0032PublishVisibilityScope =
  | "private_or_self_visible"
  | "limited_test_visibility"
  | "public_visible"
  | "unknown";

export type Fr0032LiveWriteBlockerCode =
  | "ENTRY_GATE_NOT_GO"
  | "REDACTION_INVALID"
  | "UPLOAD_ARTIFACT_MISSING"
  | "UPLOAD_NOT_ACCEPTED"
  | "SUBMIT_EVIDENCE_MISSING"
  | "SUBMIT_NOT_ACCEPTED"
  | "SUBMIT_BLOCKED_BY_RISK"
  | "PUBLISH_RESULT_IDENTITY_MISSING"
  | "PUBLISH_VISIBILITY_UNKNOWN"
  | "PUBLISH_RESULT_NOT_VERIFIED"
  | "CLEANUP_RESULT_MISSING"
  | "RESIDUAL_RECORD_REQUIRED"
  | "RISK_SIGNAL_BLOCKING"
  | "STOP_SIGNAL_REQUIRED";

export type Fr0032LiveWriteStopCode =
  | "SPEC_REVIEW_NOT_PASSED"
  | "READMISSION_GO_STALE"
  | "RUNTIME_NOT_READY"
  | "IDENTITY_BINDING_NOT_BOUND"
  | "TARGET_BINDING_NOT_VERIFIED"
  | "ACCOUNT_SAFETY_NOT_CLEAR"
  | "VALIDATION_ROWS_NOT_READY"
  | "PUBLISH_VISIBILITY_NOT_SELECTED"
  | "UPLOAD_ARTIFACT_MISSING"
  | "UPLOAD_PLATFORM_REJECTED"
  | "SUBMIT_PLATFORM_VALIDATION_ERROR"
  | "PUBLISH_BLOCKED"
  | "PUBLISH_RESULT_IDENTITY_MISSING"
  | "CAPTCHA_REQUIRED"
  | "SECURITY_REDIRECT"
  | "BROWSER_ENV_ABNORMAL"
  | "CLEANUP_FAILED"
  | "RESIDUAL_RECORD_REQUIRED";

export type Fr0032LiveWriteRiskKind =
  | "account_safety"
  | "captcha_required"
  | "login_required"
  | "security_redirect"
  | "browser_env_abnormal"
  | "rate_limit"
  | "content_policy"
  | "upload_failure"
  | "submit_failure"
  | "publish_identity_missing"
  | "cleanup_failure";

export type Fr0032LiveWriteEvidenceSensitivity = "sensitive" | "secret";
export type Fr0032LiveWriteEvidenceLocatorKind =
  | "private_locator"
  | "secret_handle"
  | "public_locator";
export type Fr0032LiveWriteEvidenceRedactionState = "redacted" | "not_required" | "invalid";

export interface Fr0032LiveWriteEvidenceRedactionFinding {
  path: string;
  sensitivity: Fr0032LiveWriteEvidenceSensitivity;
  locator_kind: Fr0032LiveWriteEvidenceLocatorKind;
  redaction_state: "redacted" | "invalid";
  replacement: string;
}

export interface Fr0032LiveWriteEvidenceRedactionResult {
  evidence: EvaluateFr0032LiveWriteEvidenceInput;
  redaction_state: Fr0032LiveWriteEvidenceRedactionState;
  redacted_field_count: number;
  findings: Fr0032LiveWriteEvidenceRedactionFinding[];
}

export interface Fr0032SubmitEvidence {
  submit_action_ref: string;
  submit_locator: string;
  submitted_at: string;
  submit_result_state:
    | "accepted"
    | "platform_validation_error"
    | "blocked_by_risk"
    | "unknown";
  platform_message: string | null;
}

export interface Fr0032PublishSuccessSignal {
  signal_source:
    | "platform_response"
    | "creator_result_page"
    | "current_page_state"
    | "followup_page_verification";
  signal_locator: string;
  platform_message: string | null;
  observed_at: string;
}

export interface Fr0032PublishResultIdentity {
  schema_version: "fr-0032.publish_result_identity.v1";
  publish_result_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  target_domain: "creator.xiaohongshu.com";
  target_page: "creator_publish_tab";
  source_upload_artifact_id: string;
  submit_action_ref: string;
  result_kind:
    | "note_id"
    | "published_url"
    | "creator_result_page"
    | "platform_publish_record";
  note_id: string | null;
  published_url: string | null;
  creator_result_url: string | null;
  platform_record_ref: string | null;
  publish_visibility_scope: Fr0032PublishVisibilityScope;
  success_signal: Fr0032PublishSuccessSignal;
  captured_at: string;
  verification_state: "verified" | "identity_missing" | "ambiguous" | "blocked";
}

export interface Fr0032ResidualRecord {
  residual_record_id: string;
  live_write_attempt_id: string;
  publish_result_id: string | null;
  visibility_scope: Fr0032PublishVisibilityScope;
  external_visibility_may_remain: boolean;
  residual_locator: string | null;
  reason:
    | "cleanup_failed"
    | "cleanup_blocked"
    | "rollback_not_supported"
    | "unsafe_to_cleanup"
    | "identity_missing_after_publish";
  required_followup: string;
  recorded_at: string;
}

export interface Fr0032CleanupRollbackProof {
  schema_version: "fr-0032.cleanup_rollback_proof.v1";
  cleanup_result_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  publish_result_identity: Fr0032PublishResultIdentity | null;
  cleanup_policy_ref: string;
  cleanup_action:
    | "delete_published_result"
    | "hide_published_result"
    | "remove_draft"
    | "abandon_unpublished_upload"
    | "no_safe_cleanup_action";
  cleanup_outcome:
    | "deleted"
    | "hidden"
    | "draft_removed"
    | "rollback_not_supported"
    | "cleanup_blocked"
    | "cleanup_failed"
    | "not_needed";
  proof_locator: string | null;
  platform_message: string | null;
  attempted_at: string;
  completed_at: string | null;
  residual_record: Fr0032ResidualRecord | null;
}

export interface Fr0032LiveWriteRiskSignal {
  risk_signal_id: string;
  detected_at: string;
  source:
    | "runtime.status"
    | "runtime.audit"
    | "page_observation"
    | "upload"
    | "submit"
    | "publish"
    | "cleanup";
  kind: Fr0032LiveWriteRiskKind;
  severity: "info" | "warning" | "blocking";
  details_ref: string;
}

export interface Fr0032LiveWriteStopSignal {
  schema_version: "fr-0032.live_write_stop_signal.v1";
  stop_signal_id: string;
  live_write_attempt_id: string;
  run_id: string;
  profile_ref: string;
  target_tab_id: number;
  stopped_at: string;
  stopped_step:
    | "entry_gate"
    | "upload"
    | "submit"
    | "publish"
    | "publish_identity"
    | "cleanup"
    | "closeout";
  blocker_layer:
    | "spec_review"
    | "profile_runtime"
    | "identity_binding"
    | "target_binding"
    | "account_safety"
    | "anti_detection_validation"
    | "upload"
    | "submit"
    | "publish"
    | "published_identity"
    | "cleanup"
    | "risk_policy";
  blocker_code: Fr0032LiveWriteStopCode;
  severity: "warning" | "blocking";
  later_write_actions_blocked: boolean;
  cleanup_required: boolean;
  cleanup_result_id: string | null;
  residual_record_id: string | null;
  required_recovery_action: string;
  evidence_ref: string;
}

export interface EvaluateFr0032LiveWriteEvidenceInput {
  entry_gate: Fr0032UploadEntryGate;
  upload_artifact_identity: Fr0032UploadArtifactIdentity | null;
  submit_evidence: Fr0032SubmitEvidence | null;
  publish_result_identity: Fr0032PublishResultIdentity | null;
  cleanup_result: Fr0032CleanupRollbackProof | null;
  risk_signals?: Fr0032LiveWriteRiskSignal[] | null;
  stop_signal?: Fr0032LiveWriteStopSignal | null;
  residual_record?: Fr0032ResidualRecord | null;
}

export interface Fr0032LiveWriteEvaluation {
  decision: Fr0032LiveWriteDecision;
  derived_attempt_state: Fr0032LiveWriteAttemptState;
  submit_gate_open: boolean;
  publish_gate_open: boolean;
  cleanup_gate_open: boolean;
  upload_success: boolean;
  submit_success: boolean;
  publish_success: boolean;
  cleanup_satisfied: boolean;
  cleanup_success: boolean;
  success_with_residual: boolean;
  full_live_write_success: boolean;
  later_write_actions_blocked: boolean;
  cleanup_required: boolean;
  cleanup_result_id: string | null;
  residual_record_id: string | null;
  residual_record_required: boolean;
  risk_signal_present: boolean;
  blocking_risk_signal_count: number;
  stop_signal_id: string | null;
  stop_signal_present: boolean;
  stop_signal_required: boolean;
  stop_signal_satisfied: boolean;
  redaction_state: Fr0032LiveWriteEvidenceRedactionState;
  redacted_field_count: number;
  redaction_findings: Fr0032LiveWriteEvidenceRedactionFinding[];
  blockers: Array<{
    blocker_code: Fr0032LiveWriteBlockerCode;
    message: string;
  }>;
}

const opaqueRedactionRef = (kind: string, value: string): string => {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${kind}:redacted:${digest}`;
};

const safeRedactedPlaceholderPattern =
  /^<redacted:(?:proxy_credential|token|fingerprint_seed|account_identifier|path:(?:profile|source_media|private))>$/;
const redactedPlaceholderPattern = /^<redacted:([^>]+)>$/;

const alreadyRedacted = (value: string): boolean =>
  safeRedactedPlaceholderPattern.test(value) || /^[a-z-]+:redacted:[a-f0-9]{16}$/.test(value);

const unsafeRedactedPlaceholderContent = (value: string): string | null => {
  if (alreadyRedacted(value)) {
    return null;
  }
  return redactedPlaceholderPattern.exec(value)?.[1] ?? null;
};

const privatePosixPathPattern =
  /(?:^|[\s"'=/])(?:\/Users\/|\/home\/|\/private\/var\/|\/var\/folders\/|\/Volumes\/)[^\r\n"']+/i;
const encodedPrivatePosixPathPattern =
  /(?:^|[\s"'=/:])(?:%2fUsers%2f|%2fhome%2f|%2fprivate%2fvar%2f|%2fvar%2ffolders%2f|%2fVolumes%2f)[^\r\n"']+/i;
const windowsPrivatePathPattern =
  /[A-Za-z]:(?:\\|\/)(?:Users|Documents and Settings)(?:\\|\/)[^\r\n"']+/i;
const privatePosixPathReplacePattern =
  /(?:\/Users\/|\/home\/|\/private\/var\/|\/var\/folders\/|\/Volumes\/)[^\r\n"']+/gi;
const encodedPrivatePosixPathReplacePattern =
  /(?:%2fUsers%2f|%2fhome%2f|%2fprivate%2fvar%2f|%2fvar%2ffolders%2f|%2fVolumes%2f)[^\r\n"']+/gi;
const windowsPrivatePathReplacePattern =
  /[A-Za-z]:(?:\\|\/)(?:Users|Documents and Settings)(?:\\|\/)[^\r\n"']+/gi;

const hasPrivatePath = (value: string): boolean =>
  privatePosixPathPattern.test(value) ||
  encodedPrivatePosixPathPattern.test(value) ||
  windowsPrivatePathPattern.test(value);

const pathRedactionKind = (path: string): string => {
  if (path.endsWith(".profile_ref") || path.includes("profile")) {
    return "profile";
  }
  if (path.includes("source_media_ref")) {
    return "source_media";
  }
  return "private";
};

const secretHeaderReplacePatterns = [
  /\b((?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer|basic|digest|token)\s+)(?!\s*<redacted:token>(?=$|[\s"',;)&#]))[^\s"',;)]+/gi,
  /\b((?:authorization|proxy-authorization)\s*[:=])(?!(?:\s*(?:bearer|basic|digest|token)\s+)?\s*<redacted:token>(?=$|[\s"',;)&#]))(\s*)[^\s"',;)]+/gi,
  /\b((?:x-api-key|x-api-token|api-key|api-token|x-auth-token|x-access-token|authorization-token|access-token|refresh-token)\s*[:=])(?!(?:\s*<redacted:token>(?=$|[\s"',;)&#])))(\s*)[^\s"',;)]+/gi,
  /\b(set-cookie\s*[:=])(?!(?:\s*<redacted:token>(?=$|[\s"',;)&#])))(\s*)[^\r\n"']+/gi,
  /(?<!-)\b(cookie\s*[:=])(?!(?:\s*<redacted:token>(?=$|[\s"',;)&#])))(\s*)[^\r\n"']+/gi
];

const secretHeaderDetectPatterns = [
  /\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer|basic|digest|token)\s+(?!\s*<redacted:token>(?=$|[\s"',;)&#]))[^\s"',;)]+/i,
  /\b(?:authorization|proxy-authorization)\s*[:=](?!(?:\s*(?:bearer|basic|digest|token)\s+)?\s*<redacted:token>(?=$|[\s"',;)&#]))\s*[^\s"',;)]+/i,
  /\b(?:x-api-key|x-api-token|api-key|api-token|x-auth-token|x-access-token|authorization-token|access-token|refresh-token)\s*[:=](?!\s*<redacted:token>(?=$|[\s"',;)&#]))\s*[^\s"',;)]+/i,
  /\bset-cookie\s*[:=](?!\s*<redacted:token>(?=$|[\s"',;)&#]))\s*[^\r\n"']+/i,
  /(?<!-)\bcookie\s*[:=](?!\s*<redacted:token>(?=$|[\s"',;)&#]))\s*[^\r\n"']+/i
];

const tokenSuffixBoundaryFieldPattern =
  "(?:authorization|proxy-authorization|x-api-key|x-api-token|api-key|api-token|x-auth-token|x-access-token|authorization-token|access-token|refresh-token|xsec[-_ ]?token|access[-_ ]?token|refresh[-_ ]?token|api[-_ ]?key|api[-_ ]?token|auth[-_ ]?token|authorization[-_ ]?token|token|secret|password)\\s*[:=]|(?:set-cookie|cookie)\\s*:";

const redactedTokenSuffixReplacePatterns = [
  new RegExp(
    `\\b((?:authorization|proxy-authorization)\\s*[:=]\\s*(?:bearer|basic|digest|token)\\s*)<redacted:token>(?:(?!\\s+(?:${tokenSuffixBoundaryFieldPattern}))\\s*)[^\\s"',;)]+`,
    "gi"
  ),
  new RegExp(
    `\\b((?:x-api-key|x-api-token|api-key|api-token|x-auth-token|x-access-token|authorization-token|access-token|refresh-token)\\s*[:=]\\s*)<redacted:token>(?:(?!\\s+(?:${tokenSuffixBoundaryFieldPattern}))\\s*)[^\\s"',;)]+`,
    "gi"
  ),
  new RegExp(
    `\\b((?:xsec[-_ ]?token|access[-_ ]?token|refresh[-_ ]?token|api[-_ ]?key|api[-_ ]?token|auth[-_ ]?token|authorization[-_ ]?token|token|secret|password)\\s*[:=]\\s*)<redacted:token>(?:(?!\\s+(?:${tokenSuffixBoundaryFieldPattern}))\\s*)[^\\s"',;)&#]+`,
    "gi"
  ),
  /\b((?:set-cookie|cookie)\s*[:=]\s*)<redacted:token>(?:\s*;(?!\s*(?:httponly|secure|samesite|path|domain|expires|max-age)\b)\s*[^;\r\n"']+)+/gi
];

const redactedTokenSuffixDetectPatterns = [
  new RegExp(
    `\\b(?:authorization|proxy-authorization)\\s*[:=]\\s*(?:bearer|basic|digest|token)\\s*<redacted:token>(?:(?!\\s+(?:${tokenSuffixBoundaryFieldPattern}))\\s*)[^\\s"',;)]+`,
    "i"
  ),
  new RegExp(
    `\\b(?:x-api-key|x-api-token|api-key|api-token|x-auth-token|x-access-token|authorization-token|access-token|refresh-token)\\s*[:=]\\s*<redacted:token>(?:(?!\\s+(?:${tokenSuffixBoundaryFieldPattern}))\\s*)[^\\s"',;)]+`,
    "i"
  ),
  new RegExp(
    `\\b(?:xsec[-_ ]?token|access[-_ ]?token|refresh[-_ ]?token|api[-_ ]?key|api[-_ ]?token|auth[-_ ]?token|authorization[-_ ]?token|token|secret|password)\\s*[:=]\\s*<redacted:token>(?:(?!\\s+(?:${tokenSuffixBoundaryFieldPattern}))\\s*)[^\\s"',;)&#]+`,
    "i"
  ),
  /\b(?:set-cookie|cookie)\s*[:=]\s*<redacted:token>(?:\s*;(?!\s*(?:httponly|secure|samesite|path|domain|expires|max-age)\b)\s*[^;\r\n"']+)+/i
];

const secretKeyValuePattern =
  /\b((?:xsec[-_ ]?token|access[-_ ]?token|refresh[-_ ]?token|api[-_ ]?key|api[-_ ]?token|auth[-_ ]?token|authorization[-_ ]?token|token|secret|password)\s*[:=])(?!(?:\s*<redacted:token>(?=$|[\s"',;)&#])))(\s*)[^\s"',;)&#]+/gi;

const secretKeyValueDetectPattern =
  /\b(?:xsec[-_ ]?token|access[-_ ]?token|refresh[-_ ]?token|api[-_ ]?key|api[-_ ]?token|auth[-_ ]?token|authorization[-_ ]?token|token|secret|password)\s*[:=](?!\s*<redacted:token>(?=$|[\s"',;)&#]))\s*[^\s"',;)&#]+/i;

const accountIdentifierKeyValuePattern =
  /\b(?:account|account[-_ ]?id|user[-_ ]?id|uid|username|phone|mobile|tenant[-_ ]?id|workspace[-_ ]?id|organization[-_ ]?id)\s*[:=]\s*[^\s"',)]+/gi;

const accountIdentifierKeyValueDetectPattern =
  /\b(?:account|account[-_ ]?id|user[-_ ]?id|uid|username|phone|mobile|tenant[-_ ]?id|workspace[-_ ]?id|organization[-_ ]?id)\s*[:=]\s*[^\s"',)]+/i;

const freeTextPhonePattern = /(^|[^\w+])(\+\d[\d .()-]{7,}\d)(?=$|[^\d])/gi;
const freeTextPhoneDetectPattern = /(^|[^\w+])\+\d[\d .()-]{7,}\d(?=$|[^\d])/i;

const freeTextAccountIdentifierPattern =
  /\b((?:account|account\s+id|account\s+identifier|user|user\s+id|uid|username|tenant|workspace|organization)\s+)([A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*|[A-Za-z0-9_-]*\d[A-Za-z][A-Za-z0-9_-]*)(?=$|[\s"',;)])/gi;

const freeTextAccountIdentifierDetectPattern =
  /\b(?:account|account\s+id|account\s+identifier|user|user\s+id|uid|username|tenant|workspace|organization)\s+(?:[A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*|[A-Za-z0-9_-]*\d[A-Za-z][A-Za-z0-9_-]*)(?=$|[\s"',;)])/i;

const redactStringValue = (
  value: string,
  pathParts: string[]
): { value: string; findings: Fr0032LiveWriteEvidenceRedactionFinding[] } => {
  const path = pathParts.join(".");
  if (alreadyRedacted(value)) {
    return { value, findings: [] };
  }
  const placeholderContent = unsafeRedactedPlaceholderContent(value);
  if (placeholderContent !== null) {
    const contentResult = redactStringValue(placeholderContent, pathParts);
    if (contentResult.findings.length > 0) {
      return contentResult;
    }
  }

  const findings: Fr0032LiveWriteEvidenceRedactionFinding[] = [];
  let redacted = value;
  const addFinding = (
    sensitivity: Fr0032LiveWriteEvidenceSensitivity,
    locator_kind: Fr0032LiveWriteEvidenceLocatorKind,
    replacement: string
  ): void => {
    findings.push({
      path,
      sensitivity,
      locator_kind,
      redaction_state: "redacted",
      replacement
    });
  };

  if (path.endsWith(".profile_ref")) {
    redacted = opaqueRedactionRef("profile-ref", redacted);
    addFinding("sensitive", "private_locator", redacted);
    return { value: redacted, findings };
  }

  const proxyCredentialPattern = /\b(?:https?|socks5?|proxy):\/\/[^/\s:@]+:[^@\s/]+@[^\s"']+/gi;
  if (proxyCredentialPattern.test(redacted)) {
    redacted = redacted.replace(proxyCredentialPattern, "<redacted:proxy_credential>");
    addFinding("secret", "secret_handle", "<redacted:proxy_credential>");
  }

  const secretQueryPattern =
    /([?&](?:xsec_token|token|access_token|refresh_token|api_key|secret|password|cookie|auth|authorization)=)[^&#\s"']+/gi;
  if (secretQueryPattern.test(redacted)) {
    redacted = redacted.replace(secretQueryPattern, "$1<redacted:token>");
    addFinding("secret", "secret_handle", "<redacted:token>");
  }

  for (const pattern of redactedTokenSuffixReplacePatterns) {
    const nextRedacted = redacted.replace(pattern, "$1<redacted:token>");
    if (nextRedacted !== redacted) {
      redacted = nextRedacted;
      addFinding("secret", "secret_handle", "<redacted:token>");
    }
  }

  const keyValueRedacted = redacted.replace(secretKeyValuePattern, "$1$2<redacted:token>");
  if (keyValueRedacted !== redacted) {
    redacted = keyValueRedacted;
    addFinding("secret", "secret_handle", "<redacted:token>");
  }

  for (const pattern of secretHeaderReplacePatterns) {
    const nextRedacted = redacted.replace(pattern, (...match) => {
      const prefix = String(match[1]);
      const separator = typeof match[2] === "string" ? match[2] : "";
      return `${prefix}${separator}<redacted:token>`;
    });
    if (nextRedacted !== redacted) {
      redacted = nextRedacted;
      addFinding("secret", "secret_handle", "<redacted:token>");
    }
  }

  const seedPattern =
    /\b(?:fingerprint[-_ ]?seed|main_world_secret|bootstrap_secret|seed)[:=][^\s"',)]+/gi;
  if (seedPattern.test(redacted)) {
    redacted = redacted.replace(seedPattern, "<redacted:fingerprint_seed>");
    addFinding("secret", "secret_handle", "<redacted:fingerprint_seed>");
  }

  if (hasPrivatePath(redacted)) {
    const replacement = `<redacted:path:${pathRedactionKind(path)}>`;
    redacted = redacted
      .replace(privatePosixPathReplacePattern, replacement)
      .replace(encodedPrivatePosixPathReplacePattern, replacement)
      .replace(windowsPrivatePathReplacePattern, replacement);
    addFinding("sensitive", "private_locator", replacement);
  }

  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  if (emailPattern.test(redacted)) {
    redacted = redacted.replace(emailPattern, "<redacted:account_identifier>");
    addFinding("sensitive", "public_locator", "<redacted:account_identifier>");
  }

  if (accountIdentifierKeyValueDetectPattern.test(redacted)) {
    redacted = redacted.replace(accountIdentifierKeyValuePattern, "<redacted:account_identifier>");
    addFinding("sensitive", "public_locator", "<redacted:account_identifier>");
  }

  if (freeTextPhoneDetectPattern.test(redacted)) {
    redacted = redacted.replace(freeTextPhonePattern, "$1<redacted:account_identifier>");
    addFinding("sensitive", "public_locator", "<redacted:account_identifier>");
  }

  if (freeTextAccountIdentifierDetectPattern.test(redacted)) {
    redacted = redacted.replace(
      freeTextAccountIdentifierPattern,
      "$1<redacted:account_identifier>"
    );
    addFinding("sensitive", "public_locator", "<redacted:account_identifier>");
  }

  return { value: redacted, findings };
};

const redactEvidenceValue = (
  value: unknown,
  pathParts: string[],
  findings: Fr0032LiveWriteEvidenceRedactionFinding[]
): unknown => {
  if (typeof value === "string") {
    const result = redactStringValue(value, pathParts);
    findings.push(...result.findings);
    return result.value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactEvidenceValue(item, [...pathParts, String(index)], findings));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactEvidenceValue(item, [...pathParts, key], findings)
      ])
    );
  }
  return value;
};

const hasUnredactedSensitiveString = (value: unknown): boolean => {
  if (typeof value === "string") {
    if (alreadyRedacted(value)) {
      return false;
    }
    const valueToInspect = unsafeRedactedPlaceholderContent(value) ?? value;

    return (
      hasPrivatePath(valueToInspect) ||
      /\b(?:https?|socks5?|proxy):\/\/[^/\s:@]+:[^@\s/]+@[^\s"']+/i.test(valueToInspect) ||
      /\b(?:fingerprint[-_ ]?seed|main_world_secret|bootstrap_secret|seed)[:=][^\s"',)]+/i.test(
        valueToInspect
      ) ||
      secretHeaderDetectPatterns.some((pattern) => pattern.test(valueToInspect)) ||
      redactedTokenSuffixDetectPatterns.some((pattern) => pattern.test(valueToInspect)) ||
      /[?&](?:xsec_token|token|access_token|refresh_token|api_key|secret|password|cookie|auth|authorization)=((?!<redacted:)[^&#\s"']+)/i.test(
        valueToInspect
      ) ||
      secretKeyValueDetectPattern.test(valueToInspect) ||
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(valueToInspect) ||
      accountIdentifierKeyValueDetectPattern.test(valueToInspect) ||
      freeTextPhoneDetectPattern.test(valueToInspect) ||
      freeTextAccountIdentifierDetectPattern.test(valueToInspect)
    );
  }
  if (Array.isArray(value)) {
    return value.some(hasUnredactedSensitiveString);
  }
  if (value && typeof value === "object") {
    return Object.values(value).some(hasUnredactedSensitiveString);
  }
  return false;
};

export const redactFr0032LiveWriteEvidence = (
  input: EvaluateFr0032LiveWriteEvidenceInput
): Fr0032LiveWriteEvidenceRedactionResult => {
  const findings: Fr0032LiveWriteEvidenceRedactionFinding[] = [];
  const evidence = redactEvidenceValue(input, ["live_write_evidence"], findings);
  const redaction_state = hasUnredactedSensitiveString(evidence)
    ? "invalid"
    : findings.length > 0
      ? "redacted"
      : "not_required";

  return {
    evidence: evidence as EvaluateFr0032LiveWriteEvidenceInput,
    redaction_state,
    redacted_field_count: new Set(findings.map((finding) => finding.path)).size,
    findings
  };
};

const pushBlocker = (
  blockers: Fr0032LiveWriteEvaluation["blockers"],
  blocker_code: Fr0032LiveWriteBlockerCode,
  message: string
): void => {
  if (blockers.some((blocker) => blocker.blocker_code === blocker_code)) {
    return;
  }
  blockers.push({ blocker_code, message });
};

const entryGatePassed = (entryGate: Fr0032UploadEntryGate): boolean =>
  entryGate.spec_review_state === "passed" &&
  entryGate.latest_head_sha !== null &&
  entryGate.readmission_decision === "GO" &&
  entryGate.runtime_readiness === "ready" &&
  entryGate.identity_binding_state === "bound" &&
  entryGate.target_binding_state === "verified" &&
  entryGate.account_safety_state === "clear" &&
  entryGate.validation_rows_state === "ready_verified_no_drift" &&
  entryGate.publish_visibility_scope !== null &&
  entryGate.publish_visibility_scope !== "unknown" &&
  entryGate.cleanup_policy_ref !== null;

const hasStablePublishIdentity = (identity: Fr0032PublishResultIdentity): boolean =>
  identity.note_id !== null ||
  identity.published_url !== null ||
  identity.creator_result_url !== null ||
  identity.platform_record_ref !== null;

const cleanupOutcomeClosesAttempt = (
  cleanupResult: Fr0032CleanupRollbackProof,
  residualRecord: Fr0032ResidualRecord | null
): boolean => {
  if (
    cleanupResult.cleanup_outcome === "deleted" ||
    cleanupResult.cleanup_outcome === "hidden" ||
    cleanupResult.cleanup_outcome === "draft_removed" ||
    cleanupResult.cleanup_outcome === "not_needed"
  ) {
    return true;
  }
  return residualRecord !== null || cleanupResult.residual_record !== null;
};

const cleanupOutcomeSuccessful = (cleanupResult: Fr0032CleanupRollbackProof): boolean =>
  cleanupResult.cleanup_outcome === "deleted" ||
  cleanupResult.cleanup_outcome === "hidden" ||
  cleanupResult.cleanup_outcome === "draft_removed" ||
  cleanupResult.cleanup_outcome === "not_needed";

const deriveAttemptState = (input: {
  uploadSuccess: boolean;
  submitSuccess: boolean;
  publishSuccess: boolean;
  cleanupResult: Fr0032CleanupRollbackProof | null;
  cleanupSatisfied: boolean;
  cleanupSuccess: boolean;
  hasBlockingRisk: boolean;
  residualRecordRequired: boolean;
  blockerCount: number;
}): Fr0032LiveWriteAttemptState => {
  if (input.hasBlockingRisk) {
    return "stopped";
  }
  if (input.residualRecordRequired || input.blockerCount > 0) {
    return "failed";
  }
  if (input.cleanupSatisfied && !input.cleanupSuccess) {
    return "failed";
  }
  if (input.cleanupSuccess) {
    return "closed";
  }
  if (input.cleanupResult !== null) {
    return "cleanup_started";
  }
  if (input.publishSuccess) {
    return "published";
  }
  if (input.submitSuccess) {
    return "submitted";
  }
  if (input.uploadSuccess) {
    return "uploaded";
  }
  return "initialized";
};

export const evaluateFr0032LiveWriteEvidence = (
  input: EvaluateFr0032LiveWriteEvidenceInput
): Fr0032LiveWriteEvaluation => {
  const redaction = redactFr0032LiveWriteEvidence(input);
  const redactedInput = redaction.evidence;
  const blockers: Fr0032LiveWriteEvaluation["blockers"] = [];
  const riskSignals = input.risk_signals ?? [];

  if (redaction.redaction_state === "invalid") {
    pushBlocker(
      blockers,
      "REDACTION_INVALID",
      "live-write evidence contains unredacted sensitive or secret-bearing values"
    );
  }

  if (!entryGatePassed(input.entry_gate)) {
    pushBlocker(blockers, "ENTRY_GATE_NOT_GO", "fresh FR-0032 entry gate GO is required");
  }

  const uploadArtifact = input.upload_artifact_identity;
  if (!uploadArtifact) {
    pushBlocker(blockers, "UPLOAD_ARTIFACT_MISSING", "upload artifact identity is required");
  } else if (!uploadArtifact.accepted_by_platform || !uploadArtifact.visible_in_editor) {
    pushBlocker(
      blockers,
      "UPLOAD_NOT_ACCEPTED",
      "upload artifact must be accepted by the platform and visible in editor"
    );
  }

  const submitEvidence = input.submit_evidence;
  if (!submitEvidence) {
    pushBlocker(blockers, "SUBMIT_EVIDENCE_MISSING", "submit evidence is required");
  } else if (submitEvidence.submit_result_state !== "accepted") {
    pushBlocker(blockers, "SUBMIT_NOT_ACCEPTED", "submit result state must be accepted");
    if (submitEvidence.submit_result_state === "blocked_by_risk") {
      pushBlocker(
        blockers,
        "SUBMIT_BLOCKED_BY_RISK",
        "submit was blocked by risk and later write actions must stop"
      );
    }
  }

  const publishIdentity = input.publish_result_identity;
  if (!publishIdentity || !hasStablePublishIdentity(publishIdentity)) {
    pushBlocker(
      blockers,
      "PUBLISH_RESULT_IDENTITY_MISSING",
      "publish success requires a stable note id, URL, result page or platform record"
    );
  } else {
    if (publishIdentity.publish_visibility_scope === "unknown") {
      pushBlocker(blockers, "PUBLISH_VISIBILITY_UNKNOWN", "publish visibility scope is required");
    }
    if (publishIdentity.verification_state !== "verified") {
      pushBlocker(
        blockers,
        "PUBLISH_RESULT_NOT_VERIFIED",
        "publish result identity must be verified"
      );
    }
  }

  const cleanupResult = input.cleanup_result;
  if (!cleanupResult) {
    pushBlocker(blockers, "CLEANUP_RESULT_MISSING", "cleanup or rollback proof is required");
  }

  const inputResidualRecord = input.residual_record ?? null;
  const cleanupResidualRecord = cleanupResult?.residual_record ?? null;
  const residualRecord = inputResidualRecord ?? cleanupResidualRecord;
  const cleanupResultId = cleanupResult?.cleanup_result_id ?? null;
  const residualRecordId = residualRecord?.residual_record_id ?? null;
  const redactedCleanupResult = redactedInput.cleanup_result;
  const redactedInputResidualRecord = redactedInput.residual_record ?? null;
  const redactedCleanupResidualRecord = redactedCleanupResult?.residual_record ?? null;
  const redactedResidualRecord =
    inputResidualRecord !== null ? redactedInputResidualRecord : redactedCleanupResidualRecord;
  const outputCleanupResultId = redactedCleanupResult?.cleanup_result_id ?? null;
  const outputResidualRecordId = redactedResidualRecord?.residual_record_id ?? null;
  const residualRecordMismatch =
    inputResidualRecord !== null &&
    cleanupResidualRecord !== null &&
    inputResidualRecord.residual_record_id !== cleanupResidualRecord.residual_record_id;
  const cleanupSatisfied =
    cleanupResult !== null && cleanupOutcomeClosesAttempt(cleanupResult, residualRecord);
  const cleanupSuccess = cleanupResult !== null && cleanupOutcomeSuccessful(cleanupResult);
  const residualRecordRequired =
    cleanupResult !== null &&
    !cleanupOutcomeClosesAttempt(cleanupResult, null) &&
    residualRecord === null;
  const successWithResidual =
    cleanupResult !== null && !cleanupOutcomeSuccessful(cleanupResult) && residualRecord !== null;
  const noSafeCleanupAction = cleanupResult?.cleanup_action === "no_safe_cleanup_action";

  if (residualRecordRequired) {
    pushBlocker(
      blockers,
      "RESIDUAL_RECORD_REQUIRED",
      "cleanup failure, blocked cleanup or unsupported rollback requires residual record"
    );
  }
  if (residualRecordMismatch) {
    pushBlocker(
      blockers,
      "RESIDUAL_RECORD_REQUIRED",
      "cleanup proof residual record and top-level residual record must identify the same residual"
    );
  }

  const riskSignalPresent = riskSignals.length > 0;
  const hasBlockingRisk = riskSignals.some((riskSignal) => riskSignal.severity === "blocking");
  const blockingRiskSignalCount = riskSignals.filter((riskSignal) => riskSignal.severity === "blocking").length;
  const submitBlockedByRisk = submitEvidence?.submit_result_state === "blocked_by_risk";
  const stopSignalRequired = hasBlockingRisk || submitBlockedByRisk || noSafeCleanupAction;
  const stopSignal = input.stop_signal ?? null;
  const outputStopSignalId = redactedInput.stop_signal?.stop_signal_id ?? null;
  const blockingStopSignalPresent = stopSignal?.severity === "blocking";
  const stopSignalCleanupMismatch =
    stopSignal !== null &&
    (stopSignal.cleanup_result_id !== cleanupResultId ||
      stopSignal.residual_record_id !== residualRecordId);
  const stopSignalSatisfied =
    !stopSignalCleanupMismatch && (!stopSignalRequired || blockingStopSignalPresent);
  if (hasBlockingRisk) {
    pushBlocker(blockers, "RISK_SIGNAL_BLOCKING", "blocking risk signal stops live write");
  }
  if (!stopSignalSatisfied) {
    pushBlocker(
      blockers,
      "STOP_SIGNAL_REQUIRED",
      "blocking risk, risk-blocked submit or unsafe cleanup requires a matching blocking live write stop signal"
    );
  }

  const uploadSuccess =
    uploadArtifact !== null &&
    uploadArtifact.accepted_by_platform === true &&
    uploadArtifact.visible_in_editor === true;
  const submitSuccess = submitEvidence?.submit_result_state === "accepted";
  const publishSuccess =
    publishIdentity !== null &&
    publishIdentity.verification_state === "verified" &&
    publishIdentity.publish_visibility_scope !== "unknown" &&
    hasStablePublishIdentity(publishIdentity);
  const laterWriteActionsBlocked =
    hasBlockingRisk ||
    submitBlockedByRisk ||
    noSafeCleanupAction ||
    (stopSignal?.severity === "blocking" && stopSignal.later_write_actions_blocked);
  const cleanupRequired = uploadSuccess || submitSuccess || publishIdentity !== null || hasBlockingRisk;
  const submitGateOpen = blockers.length === 0 && uploadSuccess && !laterWriteActionsBlocked;
  const publishGateOpen = submitGateOpen && submitSuccess && !laterWriteActionsBlocked;
  const cleanupGateOpen = cleanupRequired;
  const derivedAttemptState = deriveAttemptState({
    uploadSuccess,
    submitSuccess,
    publishSuccess,
    cleanupResult,
    cleanupSatisfied,
    cleanupSuccess,
    hasBlockingRisk,
    residualRecordRequired,
    blockerCount: blockers.length
  });
  const fullLiveWriteSuccess =
    blockers.length === 0 &&
    uploadSuccess &&
    submitSuccess &&
    publishSuccess &&
    cleanupSuccess &&
    !laterWriteActionsBlocked;

  return {
    decision: blockers.length === 0 && !laterWriteActionsBlocked ? "PASS" : "NO_GO",
    derived_attempt_state: derivedAttemptState,
    submit_gate_open: submitGateOpen,
    publish_gate_open: publishGateOpen,
    cleanup_gate_open: cleanupGateOpen,
    upload_success: uploadSuccess,
    submit_success: submitSuccess,
    publish_success: publishSuccess,
    cleanup_satisfied: cleanupSatisfied,
    cleanup_success: cleanupSuccess,
    success_with_residual: successWithResidual,
    full_live_write_success: fullLiveWriteSuccess,
    later_write_actions_blocked: laterWriteActionsBlocked,
    cleanup_required: cleanupRequired,
    cleanup_result_id: outputCleanupResultId,
    residual_record_id: outputResidualRecordId,
    residual_record_required: residualRecordRequired,
    risk_signal_present: riskSignalPresent,
    blocking_risk_signal_count: blockingRiskSignalCount,
    stop_signal_id: outputStopSignalId,
    stop_signal_present: stopSignal !== null,
    stop_signal_required: stopSignalRequired,
    stop_signal_satisfied: stopSignalSatisfied,
    redaction_state: redaction.redaction_state,
    redacted_field_count: redaction.redacted_field_count,
    redaction_findings: redaction.findings,
    blockers
  };
};
