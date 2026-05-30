import type { JsonRecord } from "./xhs-search-types.js";
import type {
  ControlledUploadArtifactIdentity,
  MediaUploadDiscoveryResult
} from "./xhs-media-upload-discovery.js";

export type XhsControlledLiveWriteInput = {
  live_write_attempt_id: string;
  source_media_ref: string;
  source_media_digest: string;
  source_media_kind: "image" | "video" | "mixed";
  publish_visibility_scope: "private_or_self_visible" | "limited_test_visibility" | "public_visible";
  cleanup_policy_ref: string;
  run_id: string;
  profile_ref: string | null;
  target_tab_id: number | null;
  page_url: string;
  latest_head_sha?: string | null;
};

export type XhsControlledLiveWriteResult = {
  live_write_action: "controlled_upload_submit_publish";
  target_page: "creator_publish_tab";
  live_write_evidence: JsonRecord;
  live_write_evaluation: JsonRecord;
  uploaded: boolean;
  submitted: boolean;
  published: boolean;
  cleanup_attempted: boolean;
  out_of_scope_actions: string[];
};

export type XhsControlledUploadPlatformCapture = {
  source: "chrome_debugger_network";
  platform_staging_ref: string;
  url: string;
  method: string;
  status: number;
  captured_at: string;
};

export type XhsControlledUploadPlatformCaptureStatus = {
  attempted: true;
  status: "not_started" | "started" | "timeout";
  reason: string | null;
  recorded_at: string;
  observed_requests?: JsonRecord[];
};

export type XhsControlledUploadNetworkResponseInput = {
  url: string;
  method: string;
  status: number;
  body: unknown;
  captured_at: string;
};

export type XhsControlledUploadNetworkBodyInput = {
  body: unknown;
  base64Encoded?: unknown;
  maxBodyBytes?: number;
};

type UploadBlockedInput = {
  blockerCode: string;
  blockerMessage: string;
  detailsRef: string;
  requiredRecoveryAction: string;
};

const FR0032_FIXTURE_IMAGE_A_REF = "media-ref/fr-0032/fixture-image-a";
const FR0032_FIXTURE_IMAGE_A_DIGEST =
  "sha256:3ed47d9dd37eefd01bbd3521cfeef60c227c5f69676a470cf314e8e683407d18";
const FR0032_FIXTURE_IMAGE_A_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAG5ElEQVR42u3WMQ0AAAjAMGQhB//BA5jgo0cN7Fp01gAAv4QIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAADIAIAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAGQAgAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAHBnAVzllrXr0ZtlAAAAAElFTkSuQmCC";

const nowIso = (): string => new Date().toISOString();

const asPlainRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const xhsControlledUploadCaptureDefaultMaxBodyBytes = 256_000;

const xhsControlledUploadPlatformEndpointAllowlist = [
  {
    host: "creator.xiaohongshu.com",
    path:
      /^\/(?:api|web_api)\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
  },
  {
    host: "edith.xiaohongshu.com",
    path:
      /^\/api\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
  },
  {
    host: "upload.xiaohongshu.com",
    path:
      /^\/.*(?:^|[/_.-])(?:upload|media|material|asset|image|file|oss|pic|photo)(?:$|[/_.-])/iu
  }
] as const;

export const isXhsControlledUploadPlatformCaptureUrl = (
  url: string,
  method: string
): boolean => {
  if (!/^(POST|PUT|PATCH)$/iu.test(method)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return xhsControlledUploadPlatformEndpointAllowlist.some(
      (entry) => parsed.hostname === entry.host && entry.path.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

export const parseXhsControlledUploadNetworkResponseBody = (
  value: unknown,
  maxBodyBytes = xhsControlledUploadCaptureDefaultMaxBodyBytes
): unknown => {
  if (typeof value !== "string" || value.length === 0 || value.length > maxBodyBytes) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

export const decodeXhsControlledUploadNetworkResponseBody = (
  input: XhsControlledUploadNetworkBodyInput
): unknown => {
  const maxBodyBytes = input.maxBodyBytes ?? xhsControlledUploadCaptureDefaultMaxBodyBytes;
  if (typeof input.body !== "string" || input.body.length === 0) {
    return null;
  }
  if (input.body.length > maxBodyBytes) {
    return null;
  }
  if (input.base64Encoded === true) {
    if (typeof atob !== "function") {
      return null;
    }
    try {
      const decoded = atob(input.body);
      return parseXhsControlledUploadNetworkResponseBody(decoded, maxBodyBytes);
    } catch {
      return null;
    }
  }
  return parseXhsControlledUploadNetworkResponseBody(input.body, maxBodyBytes);
};

const trustedPlatformRefKeys = new Set([
  "upload_id",
  "uploadId",
  "media_id",
  "mediaId",
  "material_id",
  "materialId",
  "asset_id",
  "assetId",
  "file_id",
  "fileId",
  "fileid",
  "image_file_id",
  "imageFileId",
  "oss_id",
  "ossId",
  "image_id",
  "imageId"
]);

const normalizePlatformRefValue = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const normalized = String(value).trim();
  if (
    normalized.length < 6 ||
    normalized.length > 256 ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("data:") ||
    /^https?:\/\//iu.test(normalized)
  ) {
    return null;
  }
  return normalized;
};

const findTrustedPlatformStagingRef = (value: unknown): string | null => {
  if (typeof value === "string") {
    for (const key of trustedPlatformRefKeys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const match = new RegExp(`["']${escapedKey}["']\\s*:\\s*["']([^"']{6,256})["']`, "u").exec(value);
      const normalizedValue = normalizePlatformRefValue(match?.[1]);
      if (normalizedValue) {
        return `${key}:${normalizedValue}`;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findTrustedPlatformStagingRef(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }
  const record = asPlainRecord(value);
  if (!record) {
    return null;
  }
  for (const [key, item] of Object.entries(record)) {
    const normalizedValue = normalizePlatformRefValue(item);
    if (trustedPlatformRefKeys.has(key) && normalizedValue) {
      return `${key}:${normalizedValue}`;
    }
  }
  for (const item of Object.values(record)) {
    const nested = findTrustedPlatformStagingRef(item);
    if (nested) {
      return nested;
    }
  }
  return null;
};

export const extractXhsControlledUploadPlatformCapture = (
  input: XhsControlledUploadNetworkResponseInput
): XhsControlledUploadPlatformCapture | null => {
  if (
    input.status < 200 ||
    input.status >= 300 ||
    !isXhsControlledUploadPlatformCaptureUrl(input.url, input.method)
  ) {
    return null;
  }
  const platformStagingRef = findTrustedPlatformStagingRef(input.body);
  if (!platformStagingRef) {
    return null;
  }
  return {
    source: "chrome_debugger_network",
    platform_staging_ref: platformStagingRef,
    url: input.url,
    method: input.method,
    status: input.status,
    captured_at: input.captured_at
  };
};

const sourceMediaKind = (value: string): "image" | "video" | "mixed" =>
  value === "video" || value === "mixed" ? value : "image";

const sha256DigestForBytes = async (bytes: Uint8Array): Promise<string | null> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return null;
  }
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await subtle.digest("SHA-256", digestInput);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
};

const decodeBase64Bytes = (value: string): Uint8Array | null => {
  if (typeof atob !== "function") {
    return null;
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const imageAcceptTokenPattern = /(^|\W)(image\/|\*\/\*|\*|\.jpe?g|\.png|\.webp|\.gif|\.bmp|\.heic|\.heif)(\W|$)/iu;

const acceptsImageMedia = (accept: string | null | undefined): boolean => {
  const normalized = (accept ?? "").trim();
  if (normalized.length === 0) {
    return false;
  }
  return normalized
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .some((token) => imageAcceptTokenPattern.test(token));
};

const collectUploadFileInputs = (): HTMLInputElement[] => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return [];
  }
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
};

const findUploadFileInput = (inputs: HTMLInputElement[]): HTMLInputElement | null => {
  return inputs.find((input) => !input.disabled && acceptsImageMedia(input.accept)) ?? null;
};

const isVisibleElement = (element: Element): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
};

const textContentOf = (element: Element): string =>
  (element.textContent ?? "").trim().replace(/\s+/g, " ");

const imageModeTextPattern = /上传图文|图文|图片|image|photo/iu;
const imageModeHrefPattern = /(?:[?&]target=image(?:&|$)|target%3Dimage)/iu;

const imageModeCandidateScore = (element: HTMLElement): number => {
  const href = getElementAttribute(element, "href") ?? "";
  if (imageModeHrefPattern.test(href)) {
    return 0;
  }
  if (element.getAttribute("role") === "tab") {
    return 1;
  }
  if (element.tagName.toUpperCase() === "BUTTON") {
    return 2;
  }
  return 3;
};

const selectImagePublishMode = async (): Promise<void> => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return;
  }
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        'a[href*="target=image" i]',
        '[href*="target=image" i]',
        '[data-target*="image" i]',
        "button",
        '[role="tab"]',
        '[class*="tab" i]',
        '[class*="publish" i]'
      ].join(",")
    )
  );
  const imageMode = candidates
    .filter((element) => {
      const href = getElementAttribute(element, "href") ?? "";
      const signal = `${href} ${textContentOf(element)}`;
      return isVisibleElement(element) && imageModeTextPattern.test(signal) && typeof element.click === "function";
    })
    .sort((left, right) => imageModeCandidateScore(left) - imageModeCandidateScore(right))[0];
  if (!imageMode) {
    return;
  }
  imageMode.click();
  await sleep(800);
};

const uploadIntentTextPattern = /上传|图片|图文|素材|拖拽|点击上传|upload|image|media|photo/iu;
const nonUploadClassPattern = /dropdown|drop-down|drop_shadow|drop-shadow|backdrop/iu;

const hasUploadIntentSignal = (element: HTMLElement): boolean => {
  const signalText = [
    element.getAttribute("data-testid"),
    element.getAttribute("data-test"),
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.className,
    textContentOf(element)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  return uploadIntentTextPattern.test(signalText) && !nonUploadClassPattern.test(signalText);
};

const isPotentialDropzoneTarget = (element: HTMLElement): boolean =>
  !["IMG", "VIDEO", "SVG", "CANVAS"].includes(element.tagName.toUpperCase());

const findUploadDropzone = (): HTMLElement | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        '[data-testid*="upload" i]',
        '[class*="upload" i]',
        '[aria-label*="上传" i]',
        '[aria-label*="upload" i]',
        '[title*="上传" i]',
        '[title*="upload" i]'
      ].join(",")
    )
  );
  return (
    candidates.find(
      (element) => isPotentialDropzoneTarget(element) && isVisibleElement(element) && hasUploadIntentSignal(element)
    ) ?? null
  );
};

type EditorPreviewEvidence = {
  locator: string;
  platformStagingRef: string | null;
  acceptedByPlatform: boolean;
};

const uploadPlaceholderPattern = /upload[-_ ]?icon|upload[-_ ]?btn|placeholder|empty|add[-_ ]?(image|photo|media)|点击上传|上传图片|upload image|upload photo/iu;
const uploadCompleteTextPattern = /上传完成|上传成功|上传完毕|处理完成|已上传|upload(ed)? complete|upload(ed)? success|done|complete/iu;
const uploadPendingTextPattern = /上传中|处理中|加载中|转码中|uploading|processing|loading|progress/iu;
const uploadFailureTextPattern = /上传失败|上传错误|重新上传|upload failed|upload error|retry upload/iu;
const platformStagingAttributeNames = [
  "data-upload-id",
  "data-media-id",
  "data-material-id",
  "data-asset-id",
  "data-file-id",
  "data-oss-id",
  "data-image-id"
] as const;

const locatorForElement = (element: Element): string => {
  if (element.id) {
    return `#${element.id}`;
  }
  const className = Array.from(element.classList).find((item) => item.trim().length > 0);
  return className ? `${element.tagName.toLowerCase()}.${className}` : element.tagName.toLowerCase();
};

const getElementAttribute = (element: Element, name: string): string | null =>
  typeof element.getAttribute === "function" ? element.getAttribute(name) : null;

const signalTextForElement = (element: Element): string =>
  [
    element.id,
    getElementAttribute(element, "class"),
    getElementAttribute(element, "style"),
    getElementAttribute(element, "src"),
    getElementAttribute(element, "alt"),
    getElementAttribute(element, "aria-label"),
    getElementAttribute(element, "title"),
    element instanceof HTMLElement ? getComputedStyle(element).backgroundImage : null,
    textContentOf(element)
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

const isUploadPlaceholderPreview = (element: Element): boolean =>
  uploadPlaceholderPattern.test(signalTextForElement(element));

const ancestorSignalTextForElement = (element: Element, maxDepth = 3): string => {
  const parts = [signalTextForElement(element)];
  let current = element.parentElement;
  let depth = 0;
  while (current && depth < maxDepth) {
    parts.push(signalTextForElement(current));
    current = current.parentElement;
    depth += 1;
  }
  return parts.join(" ");
};

const platformStagingRefForElementOnly = (element: Element): string | null => {
  for (const attributeName of platformStagingAttributeNames) {
    const value = getElementAttribute(element, attributeName);
    if (!value) {
      continue;
    }
    const normalized = value.trim();
    if (normalized.length === 0 || normalized.startsWith("blob:") || normalized.startsWith("data:")) {
      continue;
    }
    return `${attributeName}:${normalized}`;
  }
  return null;
};

const platformStagingRefForElement = (element: Element, maxDepth = 3): string | null => {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth <= maxDepth) {
    const stagingRef = platformStagingRefForElementOnly(current);
    if (stagingRef) {
      return stagingRef;
    }
    current = current.parentElement;
    depth += 1;
  }
  return null;
};

const hasUploadCompletionSignal = (element: Element): boolean => {
  const text = ancestorSignalTextForElement(element);
  return (
    uploadCompleteTextPattern.test(text) &&
    !uploadPendingTextPattern.test(text) &&
    !uploadFailureTextPattern.test(text)
  );
};

const evidenceForPreviewElement = (preview: Element): EditorPreviewEvidence => {
  const hasCompletionSignal = hasUploadCompletionSignal(preview);
  const platformStagingRef = hasCompletionSignal ? platformStagingRefForElement(preview) : null;
  return {
    locator: locatorForElement(preview),
    platformStagingRef,
    acceptedByPlatform: platformStagingRef !== null
  };
};

const editorPreviewSelector = [
  'img[src^="blob:"]',
  'img[src^="data:image/"]',
  'img[src^="http://"]',
  'img[src^="https://"]',
  'video[src^="blob:"]',
  'video[src^="http://"]',
  'video[src^="https://"]',
  '[class*="preview" i] img',
  '[class*="cover" i] img',
  '[class*="media" i] img',
  '[style*="background-image" i]',
  '[class*="preview" i]',
  '[class*="cover" i]',
  '[class*="media" i]'
].join(",");

const previewSignatureForElement = (element: Element): string =>
  [
    element.tagName.toLowerCase(),
    locatorForElement(element),
    getElementAttribute(element, "src") ?? "",
    getElementAttribute(element, "style") ?? "",
    getElementAttribute(element, "data-upload-id") ?? "",
    getElementAttribute(element, "data-media-id") ?? "",
    getElementAttribute(element, "data-material-id") ?? "",
    getElementAttribute(element, "data-asset-id") ?? "",
    getElementAttribute(element, "data-file-id") ?? "",
    getElementAttribute(element, "data-oss-id") ?? ""
  ].join("|");

const collectEditorPreviewSignatures = (): Set<string> => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return new Set();
  }
  return new Set(
    Array.from(document.querySelectorAll<HTMLElement>(editorPreviewSelector))
      .filter((element) => isVisibleElement(element) && !isUploadPlaceholderPreview(element))
      .map(previewSignatureForElement)
  );
};

const findEditorPreviewEvidence = (previousSignatures: Set<string>): EditorPreviewEvidence | null => {
  if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
    return null;
  }
  const preview = Array.from(
    document.querySelectorAll<HTMLElement>(editorPreviewSelector)
  ).find(
    (element) =>
      isVisibleElement(element) &&
      !isUploadPlaceholderPreview(element) &&
      !previousSignatures.has(previewSignatureForElement(element))
  );
  if (!preview) {
    return null;
  }
  return evidenceForPreviewElement(preview);
};

const waitForEditorPreviewEvidence = async (
  previousSignatures: Set<string>,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {}
): Promise<EditorPreviewEvidence | null> => {
  const isExtensionBrowserSurface =
    typeof window !== "undefined" &&
    typeof window.document !== "undefined" &&
    "chrome" in globalThis;
  const timeoutMs = options.timeoutMs ?? (isExtensionBrowserSurface ? 10_000 : 50);
  const intervalMs = options.intervalMs ?? (isExtensionBrowserSurface ? 500 : 10);
  const deadline = Date.now() + timeoutMs;
  let latestVisiblePreview: EditorPreviewEvidence | null = null;
  do {
    const previewEvidence = findEditorPreviewEvidence(previousSignatures);
    if (previewEvidence) {
      latestVisiblePreview = previewEvidence;
      if (previewEvidence.acceptedByPlatform) {
        return previewEvidence;
      }
    }
    if (Date.now() >= deadline) {
      break;
    }
    await sleep(intervalMs);
  } while (true);
  return latestVisiblePreview;
};

const resolveApprovedFixtureMediaFile = async (
  input: XhsControlledLiveWriteInput
): Promise<File | UploadBlockedInput> => {
  if (input.source_media_ref !== FR0032_FIXTURE_IMAGE_A_REF) {
    return {
      blockerCode: "SOURCE_MEDIA_RESOLVER_UNAVAILABLE",
      blockerMessage:
        "Controlled live write cannot resolve the requested source media ref without an approved resolver.",
      detailsRef: "source_media_ref_not_approved",
      requiredRecoveryAction:
        "register the source media ref in the FR-0032 approved source media resolver"
    };
  }
  if (input.source_media_digest !== FR0032_FIXTURE_IMAGE_A_DIGEST) {
    return {
      blockerCode: "SOURCE_MEDIA_DIGEST_MISMATCH",
      blockerMessage:
        "Controlled live write cannot upload because the requested source media digest does not match the approved fixture.",
      detailsRef: "source_media_digest_mismatch",
      requiredRecoveryAction:
        "rerun with the approved fixture digest for media-ref/fr-0032/fixture-image-a"
    };
  }
  if (input.source_media_kind !== "image") {
    return {
      blockerCode: "SOURCE_MEDIA_KIND_UNSUPPORTED",
      blockerMessage: "Controlled live write currently supports only the approved FR-0032 image fixture.",
      detailsRef: "source_media_kind_unsupported",
      requiredRecoveryAction: "provide an approved image source media ref before controlled upload"
    };
  }
  if (typeof File !== "function") {
    return {
      blockerCode: "FILE_CONSTRUCTOR_UNAVAILABLE",
      blockerMessage: "Controlled live write cannot construct the approved media File in this execution surface.",
      detailsRef: "file_constructor_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports File construction"
    };
  }
  const bytes = decodeBase64Bytes(FR0032_FIXTURE_IMAGE_A_BASE64);
  if (!bytes) {
    return {
      blockerCode: "SOURCE_MEDIA_DECODE_UNAVAILABLE",
      blockerMessage: "Controlled live write cannot decode the approved fixture media bytes.",
      detailsRef: "source_media_decode_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports base64 media decoding"
    };
  }
  const actualDigest = await sha256DigestForBytes(bytes);
  if (!actualDigest) {
    return {
      blockerCode: "SOURCE_MEDIA_DIGEST_VERIFIER_UNAVAILABLE",
      blockerMessage: "Controlled live write cannot verify the approved fixture digest in this execution surface.",
      detailsRef: "source_media_digest_verifier_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports Web Crypto digest verification"
    };
  }
  if (actualDigest !== FR0032_FIXTURE_IMAGE_A_DIGEST) {
    return {
      blockerCode: "SOURCE_MEDIA_FIXTURE_DIGEST_DRIFT",
      blockerMessage:
        "Controlled live write cannot upload because the embedded approved fixture bytes no longer match the approved digest.",
      detailsRef: "source_media_fixture_digest_drift",
      requiredRecoveryAction: "restore the approved fixture bytes or update the approved digest through FR-0032 review"
    };
  }
  const mediaBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(mediaBuffer).set(bytes);
  return new File([mediaBuffer], "fr-0032-fixture-image-a.png", {
    type: "image/png",
    lastModified: 0
  });
};

const dispatchFileInputUpload = (input: HTMLInputElement, file: File): UploadBlockedInput | null => {
  if (typeof DataTransfer === "undefined") {
    return {
      blockerCode: "DATA_TRANSFER_UNAVAILABLE",
      blockerMessage: "Controlled live upload cannot continue because DataTransfer is unavailable.",
      detailsRef: "data_transfer_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports DataTransfer"
    };
  }
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return null;
  } catch {
    return {
      blockerCode: "FILE_INPUT_ASSIGNMENT_FAILED",
      blockerMessage: "Controlled live upload cannot assign the approved media file to the page input.",
      detailsRef: "file_input_assignment_failed",
      requiredRecoveryAction:
        "provide a page-compatible controlled upload executor for the current creator UI"
    };
  }
};

const createControlledDragEvent = (
  type: "dragenter" | "dragover" | "drop",
  transfer: DataTransfer
): Event => {
  if (typeof DragEvent === "function") {
    return new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer
    });
  }
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: transfer
  });
  return event;
};

const dispatchDropzoneUpload = (dropzone: HTMLElement, file: File): UploadBlockedInput | null => {
  if (typeof DataTransfer === "undefined") {
    return {
      blockerCode: "DATA_TRANSFER_UNAVAILABLE",
      blockerMessage: "Controlled live upload cannot continue because DataTransfer is unavailable.",
      detailsRef: "data_transfer_unavailable",
      requiredRecoveryAction: "run controlled upload in a browser surface that supports DataTransfer"
    };
  }
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    for (const eventName of ["dragenter", "dragover", "drop"] as const) {
      dropzone.dispatchEvent(createControlledDragEvent(eventName, transfer));
    }
    return null;
  } catch {
    return {
      blockerCode: "DROPZONE_UPLOAD_DISPATCH_FAILED",
      blockerMessage: "Controlled live upload cannot dispatch the approved media file to the page dropzone.",
      detailsRef: "dropzone_upload_dispatch_failed",
      requiredRecoveryAction:
        "provide a page-compatible controlled dropzone upload executor for the current creator UI"
    };
  }
};

const isBrowserFile = (value: File | UploadBlockedInput): value is File =>
  typeof File === "function" && value instanceof File;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const buildXhsControlledLiveWriteUnavailableResult = (
  input: XhsControlledLiveWriteInput
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/executor-unavailable`;
  const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
  const stopSignal = {
    schema_version: "fr-0032.live_write_stop_signal.v1",
    stop_signal_id: stopSignalId,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    stopped_at: timestamp,
    stopped_step: "upload",
    blocker_layer: "upload",
    blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
    severity: "blocking",
    later_write_actions_blocked: true,
    cleanup_required: false,
    cleanup_result_id: null,
    residual_record_id: null,
    required_recovery_action: "provide a page executor that can safely perform controlled media upload before submit/publish",
    evidence_ref: evidenceRef
  };
  const liveWriteEvidence = {
    schema_version: "fr-0032.live_write_evidence.v1",
    live_write_attempt_id: input.live_write_attempt_id,
    canonical_issue_ref: "#835",
    execution_phase: "upload",
    scope: {
      platform: "xhs",
      target_domain: "creator.xiaohongshu.com",
      target_page: "creator_publish_tab",
      browser_channel: "Google Chrome stable",
      execution_surface: "real_browser",
      requested_execution_mode: "live_write",
      profile_ref: input.profile_ref ?? "unknown",
      target_tab_id: input.target_tab_id ?? 0,
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      run_id: input.run_id,
      artifact_identity: uploadArtifactId
    },
    entry_gate: null,
    stop_classification: {
      category: "capability_gap",
      evaluation_state: "not_evaluated",
      not_evaluated_reason: "controlled_live_write_executor_unavailable",
      latest_head_sha: input.latest_head_sha ?? null,
      publish_visibility_scope: input.publish_visibility_scope,
      cleanup_policy_ref: input.cleanup_policy_ref
    },
    upload_artifact_identity: {
      upload_artifact_id: uploadArtifactId,
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: sourceMediaKind(input.source_media_kind),
      platform_staging_ref: null,
      page_preview_locator: null,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: timestamp
    },
    submit_evidence: null,
    publish_result_identity: null,
    cleanup_result: null,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-unavailable`,
        detected_at: timestamp,
        source: "upload",
        kind: "upload_failure",
        severity: "blocking",
        details_ref: "controlled_live_write_executor_unavailable"
      }
    ],
    stop_signal: stopSignal,
    residual_record: null,
    created_at: timestamp,
    updated_at: timestamp
  };
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: liveWriteEvidence,
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: false,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: false,
      blockers: [
        {
          blocker_code: "CONTROLLED_LIVE_WRITE_EXECUTOR_UNAVAILABLE",
          blocker_layer: "upload",
          message: "No trusted page executor is available for controlled upload, so submit/publish are blocked."
        }
      ]
    },
    uploaded: false,
    submitted: false,
    published: false,
    cleanup_attempted: false,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

export const buildXhsControlledLiveWriteUploadBlockedResult = (
  input: XhsControlledLiveWriteInput,
  reason: UploadBlockedInput,
  uploadArtifact?: ControlledUploadArtifactIdentity | null
): XhsControlledLiveWriteResult => {
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  const stopSignalId = `stop/fr-0032/${input.live_write_attempt_id}/upload-blocked`;
  const evidenceRef = `live_write_evidence/${input.live_write_attempt_id}`;
  const stopSignal = {
    schema_version: "fr-0032.live_write_stop_signal.v1",
    stop_signal_id: stopSignalId,
    live_write_attempt_id: input.live_write_attempt_id,
    run_id: input.run_id,
    profile_ref: input.profile_ref ?? "unknown",
    target_tab_id: input.target_tab_id ?? 0,
    stopped_at: timestamp,
    stopped_step: "upload",
    blocker_layer: "upload",
    blocker_code: reason.blockerCode,
    severity: "blocking",
    later_write_actions_blocked: true,
    cleanup_required: false,
    cleanup_result_id: null,
    residual_record_id: null,
    required_recovery_action: reason.requiredRecoveryAction,
    evidence_ref: evidenceRef
  };
  const liveWriteEvidence = {
    schema_version: "fr-0032.live_write_evidence.v1",
    live_write_attempt_id: input.live_write_attempt_id,
    canonical_issue_ref: "#835",
    execution_phase: "upload",
    scope: {
      platform: "xhs",
      target_domain: "creator.xiaohongshu.com",
      target_page: "creator_publish_tab",
      browser_channel: "Google Chrome stable",
      execution_surface: "real_browser",
      requested_execution_mode: "live_write",
      profile_ref: input.profile_ref ?? "unknown",
      target_tab_id: input.target_tab_id ?? 0,
      probe_bundle_ref: "probe-bundle/xhs-creator-live-write-admission-v1",
      run_id: input.run_id,
      artifact_identity: uploadArtifactId
    },
    entry_gate: null,
    stop_classification: {
      category: "upload_blocked",
      evaluation_state: "stopped",
      stop_reason: reason.detailsRef,
      latest_head_sha: input.latest_head_sha ?? null,
      publish_visibility_scope: input.publish_visibility_scope,
      cleanup_policy_ref: input.cleanup_policy_ref
    },
    upload_artifact_identity: uploadArtifact ?? {
      upload_artifact_id: uploadArtifactId,
      source_media_ref: input.source_media_ref,
      source_media_digest: input.source_media_digest,
      source_media_kind: sourceMediaKind(input.source_media_kind),
      platform_staging_ref: null,
      page_preview_locator: null,
      accepted_by_platform: false,
      visible_in_editor: false,
      captured_at: timestamp
    },
    submit_evidence: null,
    publish_result_identity: null,
    cleanup_result: null,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/upload-blocked`,
        detected_at: timestamp,
        source: "upload",
        kind: "upload_failure",
        severity: "blocking",
        details_ref: reason.detailsRef
      }
    ],
    stop_signal: stopSignal,
    residual_record: null,
    created_at: timestamp,
    updated_at: timestamp
  };
  return {
    live_write_action: "controlled_upload_submit_publish",
    target_page: "creator_publish_tab",
    live_write_evidence: liveWriteEvidence,
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: false,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: false,
      blockers: [
        {
          blocker_code: reason.blockerCode,
          blocker_layer: "upload",
          message: reason.blockerMessage
        }
      ]
    },
    uploaded: false,
    submitted: false,
    published: false,
    cleanup_attempted: false,
    out_of_scope_actions: ["provider_abstraction", "syvert_adapter", "cloakbrowser_provider"]
  };
};

const buildXhsControlledLiveWriteSubmitBlockedResult = (
  input: XhsControlledLiveWriteInput,
  artifact: ControlledUploadArtifactIdentity | null
): XhsControlledLiveWriteResult => {
  const result = buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "SUBMIT_EXECUTOR_UNAVAILABLE",
    blockerMessage: "Upload evidence exists, but submit/publish executor is not available.",
    detailsRef: "submit_executor_unavailable",
    requiredRecoveryAction: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
  });
  const evidence = result.live_write_evidence;
  const stopSignal = evidence.stop_signal as JsonRecord;
  return {
    ...result,
    live_write_evidence: {
      ...evidence,
      execution_phase: "submit",
      stop_classification: {
        ...(evidence.stop_classification as JsonRecord),
        category: "submit_blocked",
        stop_reason: "submit_executor_unavailable"
      },
      upload_artifact_identity: artifact,
      risk_signals: [
        {
          risk_signal_id: `risk/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
          detected_at: stopSignal.stopped_at,
          source: "submit",
          kind: "submit_failure",
          severity: "blocking",
          details_ref: "submit_executor_unavailable"
        }
      ],
      stop_signal: {
        ...stopSignal,
        stop_signal_id: `stop/fr-0032/${input.live_write_attempt_id}/submit-unavailable`,
        stopped_step: "submit",
        blocker_layer: "submit",
        blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
        cleanup_required: true,
        required_recovery_action: "provide a submit/publish executor and cleanup policy executor before continuing after upload"
      },
      updated_at: stopSignal.stopped_at
    },
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
          blocker_layer: "submit",
          message: "Upload evidence exists, but submit/publish executor is not available."
        }
      ]
    },
    uploaded: true,
    cleanup_attempted: false
  };
};

export const applyXhsControlledUploadPlatformCapture = (
  result: XhsControlledLiveWriteResult,
  capture: XhsControlledUploadPlatformCapture | null
): XhsControlledLiveWriteResult => {
  if (!capture) {
    return result;
  }
  const evidence = result.live_write_evidence;
  const uploadArtifact = evidence.upload_artifact_identity as ControlledUploadArtifactIdentity | null;
  if (!uploadArtifact || uploadArtifact.accepted_by_platform === true) {
    return result;
  }
  const timestamp = nowIso();
  const acceptedArtifact = {
    ...uploadArtifact,
    platform_staging_ref: capture.platform_staging_ref,
    accepted_by_platform: true,
    captured_at: capture.captured_at
  };
  const stopSignal = evidence.stop_signal as JsonRecord | null;
  const nextStopSignal = stopSignal
    ? {
        ...stopSignal,
        stop_signal_id: `stop/fr-0032/${String(evidence.live_write_attempt_id ?? "unknown")}/submit-unavailable`,
        stopped_step: "submit",
        blocker_layer: "submit",
        blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
        cleanup_required: true,
        required_recovery_action:
          "provide a submit/publish executor and cleanup policy executor before continuing after upload"
      }
    : null;
  const nextEvidence = {
    ...evidence,
    execution_phase: "submit",
    stop_classification: {
      ...((evidence.stop_classification as JsonRecord | undefined) ?? {}),
      category: "submit_blocked",
      evaluation_state: "stopped",
      stop_reason: "submit_executor_unavailable"
    },
    upload_artifact_identity: acceptedArtifact,
    platform_upload_acceptance_capture: capture,
    risk_signals: [
      {
        risk_signal_id: `risk/fr-0032/${String(evidence.live_write_attempt_id ?? "unknown")}/submit-unavailable`,
        detected_at: timestamp,
        source: "submit",
        kind: "submit_failure",
        severity: "blocking",
        details_ref: "submit_executor_unavailable"
      }
    ],
    stop_signal: nextStopSignal,
    updated_at: timestamp
  };
  return {
    ...result,
    live_write_evidence: nextEvidence,
    live_write_evaluation: {
      schema_version: "fr-0032.live_write_evaluation.v1",
      decision: "NO_GO",
      full_live_write_success: false,
      upload_success: true,
      submit_success: false,
      publish_success: false,
      cleanup_success: false,
      later_write_actions_blocked: true,
      cleanup_required: true,
      blockers: [
        {
          blocker_code: "SUBMIT_EXECUTOR_UNAVAILABLE",
          blocker_layer: "submit",
          message: "Upload evidence exists, but submit/publish executor is not available."
        }
      ]
    },
    uploaded: true,
    cleanup_attempted: false
  };
};

export const applyXhsControlledUploadPlatformCaptureStatus = (
  result: XhsControlledLiveWriteResult,
  status: XhsControlledUploadPlatformCaptureStatus | null
): XhsControlledLiveWriteResult => {
  if (!status) {
    return result;
  }
  const evidence = result.live_write_evidence;
  if (evidence.platform_upload_acceptance_capture) {
    return result;
  }
  return {
    ...result,
    live_write_evidence: {
      ...evidence,
      platform_upload_acceptance_capture_status: status,
      updated_at: nowIso()
    }
  };
};

export const buildXhsControlledLiveWriteFromDiscovery = (
  input: XhsControlledLiveWriteInput,
  discovery: MediaUploadDiscoveryResult
): XhsControlledLiveWriteResult => {
  if (discovery.controlled_upload_evidence?.upload_artifact_identity?.accepted_by_platform === true) {
    return buildXhsControlledLiveWriteSubmitBlockedResult(
      input,
      discovery.controlled_upload_evidence.upload_artifact_identity
    );
  }
  const artifact = discovery.controlled_upload_evidence?.upload_artifact_identity ?? null;
  if (!artifact) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_ARTIFACT_MISSING",
      blockerMessage: "Controlled live write cannot continue because no upload artifact identity is available.",
      detailsRef: "upload_artifact_identity_missing",
      requiredRecoveryAction: "provide a source media resolver and upload executor that can produce platform-accepted upload artifact identity"
    });
  }
  return buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "UPLOAD_PLATFORM_REJECTED",
    blockerMessage: "Controlled live write cannot continue because recon evidence did not perform or prove platform upload acceptance.",
    detailsRef: "source_media_resolution_or_upload_acceptance_unavailable",
    requiredRecoveryAction: "provide a controlled media resolver and real upload executor before submit/publish"
  }, artifact);
};

export const performXhsControlledLiveWriteWithApprovedSourceMedia = async (
  input: XhsControlledLiveWriteInput
): Promise<XhsControlledLiveWriteResult> => {
  const resolvedFile = await resolveApprovedFixtureMediaFile(input);
  if (!isBrowserFile(resolvedFile)) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, resolvedFile);
  }
  if (input.source_media_kind === "image") {
    await selectImagePublishMode();
  }
  const previousPreviewSignatures = collectEditorPreviewSignatures();
  const fileInputs = collectUploadFileInputs();
  const fileInput = findUploadFileInput(fileInputs);
  const dropzone = findUploadDropzone();
  if (
    input.source_media_kind === "image" &&
    !fileInput &&
    !dropzone &&
    fileInputs.some((candidate) => !candidate.disabled)
  ) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "IMAGE_UPLOAD_ENTRY_MISSING",
      blockerMessage:
        "Controlled live upload found file inputs, but none accept the approved image fixture after selecting image publish mode.",
      detailsRef: "image_upload_entry_missing",
      requiredRecoveryAction:
        "open the creator image publish target or update the XHS image mode selector before controlled upload"
    });
  }
  if (!fileInput && !dropzone) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_ENTRY_MISSING",
      blockerMessage:
        "Controlled live upload cannot find an enabled file input or visible dropzone on the creator publish page.",
      detailsRef: "upload_entry_missing",
      requiredRecoveryAction: "restore the creator publish target page or update the XHS upload entry locator"
    });
  }
  let assignmentFailure: UploadBlockedInput | null = null;
  let previewEvidence: EditorPreviewEvidence | null = null;
  if (fileInput) {
    assignmentFailure = dispatchFileInputUpload(fileInput, resolvedFile);
    if (assignmentFailure) {
      return buildXhsControlledLiveWriteUploadBlockedResult(input, assignmentFailure);
    }
    previewEvidence = await waitForEditorPreviewEvidence(previousPreviewSignatures);
  }
  if (!previewEvidence && dropzone) {
    assignmentFailure = dispatchDropzoneUpload(dropzone, resolvedFile);
    if (assignmentFailure && !fileInput) {
      return buildXhsControlledLiveWriteUploadBlockedResult(input, assignmentFailure);
    }
    previewEvidence = await waitForEditorPreviewEvidence(previousPreviewSignatures);
  }
  if (!previewEvidence) {
    return buildXhsControlledLiveWriteUploadBlockedResult(input, {
      blockerCode: "UPLOAD_PREVIEW_NOT_VISIBLE",
      blockerMessage:
        "Controlled live upload injected the approved media file, but the editor preview did not become visible.",
      detailsRef: "upload_preview_not_visible",
      requiredRecoveryAction:
        "verify the current XHS creator upload UI accepts controlled file input assignment before submit"
    });
  }
  const timestamp = nowIso();
  const uploadArtifactId = `upload-artifact/fr-0032/${input.run_id}/${input.source_media_digest.slice(7, 19)}`;
  const uploadArtifact = {
    upload_artifact_id: uploadArtifactId,
    source_media_ref: input.source_media_ref,
    source_media_digest: input.source_media_digest,
    source_media_kind: input.source_media_kind,
    platform_staging_ref: previewEvidence.platformStagingRef,
    page_preview_locator: previewEvidence.locator,
    accepted_by_platform: previewEvidence.acceptedByPlatform,
    visible_in_editor: true,
    captured_at: timestamp
  };
  if (previewEvidence.acceptedByPlatform) {
    return buildXhsControlledLiveWriteSubmitBlockedResult(input, uploadArtifact);
  }
  return buildXhsControlledLiveWriteUploadBlockedResult(input, {
    blockerCode: "UPLOAD_ACCEPTANCE_UNVERIFIED",
    blockerMessage:
      "Controlled live upload observed an editor preview, but platform upload acceptance is not independently verified.",
    detailsRef: "upload_acceptance_unverified",
    requiredRecoveryAction:
      "collect platform-returned upload acceptance evidence before submit/publish"
  }, uploadArtifact);
};
