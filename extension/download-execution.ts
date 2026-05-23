export type DownloadTriggerMode = "resolve_only" | "dispatch_click";
export type DownloadFailureReason =
  | "SOURCE_UNAVAILABLE"
  | "AUTH_OR_SESSION_REQUIRED"
  | "WRITE_BLOCKED"
  | "RUNTIME_ERROR";

type DownloadSource =
  | {
      source_kind: "direct_url";
      target_url: string;
    }
  | {
      source_kind: "page_blob";
      blob_locator: string;
      blob_url?: string;
      page_context_hint?: string;
    }
  | {
      source_kind: "page_derived";
      derive_mode: "export_flow" | "runtime_resolve";
      trigger_hint?: string;
      page_context_hint?: string;
    };

export interface DownloadTriggerRequest {
  ability_ref: string;
  download_source: DownloadSource;
  download_goal: "single_file" | "single_media_asset";
}

export interface DownloadBrowserExecutionResult {
  success: boolean;
  download_target?: {
    target_ref: string;
    source_kind: DownloadSource["source_kind"];
    source_url: string;
    file_name_hint?: string;
    content_descriptor: {
      content_kind: string;
      mime_type: string;
      size_bytes?: number;
    };
    trigger_status: "resolved" | "triggered";
    trigger_mode: DownloadTriggerMode;
    trigger_surface: "direct_url" | "dom_anchor" | "dom_button" | "blob_locator";
  };
  failure_reason?: DownloadFailureReason;
  trigger_audit?: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const normalizeLocator = (locator: string): string =>
  locator.startsWith("css:") ? locator.slice("css:".length) : locator;

const safeQuerySelector = (selector: string): Element | null => {
  try {
    return document.querySelector(normalizeLocator(selector));
  } catch {
    return null;
  }
};

const textOf = (element: Element): string =>
  ((element as HTMLElement).innerText ?? element.textContent ?? "").trim().replace(/\s+/g, " ");

const attr = (element: Element, name: string): string | null => {
  const value = element.getAttribute(name);
  return value && value.trim().length > 0 ? value.trim() : null;
};

const absoluteUrl = (value: string, options: { allowBlob?: boolean } = {}): string | null => {
  try {
    const parsed = new URL(value, location.href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    if (options.allowBlob === true && parsed.protocol === "blob:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
};

const inferFileNameHint = (sourceUrl: string, element?: Element | null): string | undefined => {
  const downloadAttr = element ? attr(element, "download") : null;
  if (downloadAttr) {
    return downloadAttr;
  }
  try {
    const parsed = new URL(sourceUrl, location.href);
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    return segment && segment.includes(".") ? decodeURIComponent(segment) : undefined;
  } catch {
    return undefined;
  }
};

const inferMimeType = (sourceUrl: string, element?: Element | null): string => {
  const typeAttr = element ? attr(element, "type") : null;
  if (typeAttr) {
    return typeAttr;
  }
  const lowered = sourceUrl.toLowerCase();
  if (lowered.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (/\.(png|jpg|jpeg|webp|gif)(?:$|[?#])/u.test(lowered)) {
    return "image/*";
  }
  if (lowered.startsWith("blob:")) {
    return "application/octet-stream";
  }
  return "application/octet-stream";
};

const clickElement = (element: Element): void => {
  const clickable = element as Element & { click?: unknown };
  if (typeof clickable.click !== "function") {
    throw new Error("download target is not clickable");
  }
  clickable.click();
};

const targetFromUrl = (input: {
  sourceKind: DownloadSource["source_kind"];
  sourceUrl: string;
  triggerMode: DownloadTriggerMode;
  triggerSurface: "direct_url" | "dom_anchor" | "dom_button" | "blob_locator";
  element?: Element | null;
  targetRef?: string;
}): NonNullable<DownloadBrowserExecutionResult["download_target"]> => ({
  target_ref: input.targetRef ?? input.sourceUrl,
  source_kind: input.sourceKind,
  source_url: input.sourceUrl,
  ...(inferFileNameHint(input.sourceUrl, input.element)
    ? { file_name_hint: inferFileNameHint(input.sourceUrl, input.element) }
    : {}),
  content_descriptor: {
    content_kind: "file",
    mime_type: inferMimeType(input.sourceUrl, input.element)
  },
  trigger_status: input.triggerMode === "dispatch_click" ? "triggered" : "resolved",
  trigger_mode: input.triggerMode,
  trigger_surface: input.triggerSurface
});

const findDownloadHintElement = (hint: string): Element | null => {
  const selectorElement = safeQuerySelector(hint);
  if (selectorElement) {
    return selectorElement;
  }
  const normalizedHint = hint.trim().toLowerCase();
  const candidates = Array.from(
    document.querySelectorAll("a[download], a[href], button, [role='button']")
  );
  return (
    candidates.find((element) => {
      const text = textOf(element).toLowerCase();
      const aria = attr(element, "aria-label")?.toLowerCase() ?? "";
      const title = attr(element, "title")?.toLowerCase() ?? "";
      return (
        text.includes(normalizedHint) ||
        aria.includes(normalizedHint) ||
        title.includes(normalizedHint)
      );
    }) ?? null
  );
};

const resolveElementSourceUrl = (element: Element): string | null => {
  const href = attr(element, "href") ?? attr(element, "data-download-url") ?? attr(element, "data-href");
  return href ? absoluteUrl(href, { allowBlob: true }) : null;
};

const success = (
  target: NonNullable<DownloadBrowserExecutionResult["download_target"]>,
  audit: Record<string, unknown>
): DownloadBrowserExecutionResult => ({
  success: true,
  download_target: target,
  trigger_audit: audit
});

const failure = (
  reason: DownloadFailureReason,
  audit: Record<string, unknown>
): DownloadBrowserExecutionResult => ({
  success: false,
  failure_reason: reason,
  trigger_audit: audit
});

export const executeDownloadTriggerInPage = (input: {
  request: DownloadTriggerRequest;
  runId: string;
  triggerMode: DownloadTriggerMode;
}): DownloadBrowserExecutionResult => {
  const { request, runId, triggerMode } = input;
  const auditBase = {
    run_id: runId,
    ability_ref: request.ability_ref,
    source_kind: request.download_source.source_kind,
    trigger_mode: triggerMode,
    page_url: location.href
  };

  try {
    if (request.download_source.source_kind === "direct_url") {
      const sourceUrl = absoluteUrl(request.download_source.target_url);
      if (!sourceUrl) {
        return failure("SOURCE_UNAVAILABLE", auditBase);
      }
      if (triggerMode === "dispatch_click") {
        const anchor = document.createElement("a");
        anchor.href = sourceUrl;
        anchor.rel = "noopener";
        anchor.style.display = "none";
        document.documentElement.append(anchor);
        clickElement(anchor);
        anchor.remove();
      }
      return success(
        targetFromUrl({
          sourceKind: "direct_url",
          sourceUrl,
          triggerMode,
          triggerSurface: "direct_url",
          targetRef: "direct_url"
        }),
        auditBase
      );
    }

    if (request.download_source.source_kind === "page_blob") {
      const element = safeQuerySelector(request.download_source.blob_locator);
      if (!element) {
        return failure("SOURCE_UNAVAILABLE", {
          ...auditBase,
          locator_found: false,
          blob_url_present: Boolean(request.download_source.blob_url)
        });
      }
      const sourceUrl = resolveElementSourceUrl(element);
      if (!sourceUrl) {
        return failure("SOURCE_UNAVAILABLE", {
          ...auditBase,
          locator_found: true,
          blob_url_present: Boolean(request.download_source.blob_url)
        });
      }
      if (triggerMode === "dispatch_click" && element) {
        clickElement(element);
      }
      return success(
        targetFromUrl({
          sourceKind: "page_blob",
          sourceUrl,
          triggerMode,
          triggerSurface: "blob_locator",
          element,
          targetRef: request.download_source.blob_locator
        }),
        {
          ...auditBase,
          locator_found: Boolean(element)
        }
      );
    }

    const hint = request.download_source.trigger_hint ?? request.download_source.page_context_hint;
    if (!hint) {
      return failure("SOURCE_UNAVAILABLE", auditBase);
    }
    const element = findDownloadHintElement(hint);
    if (!element) {
      return failure("SOURCE_UNAVAILABLE", {
        ...auditBase,
        hint
      });
    }
    const sourceUrl = resolveElementSourceUrl(element) ?? `${location.href}#page_derived`;
    if (triggerMode === "dispatch_click") {
      clickElement(element);
    }
    return success(
      targetFromUrl({
        sourceKind: "page_derived",
        sourceUrl,
        triggerMode,
        triggerSurface: element.tagName.toLowerCase() === "a" ? "dom_anchor" : "dom_button",
        element,
        targetRef: hint
      }),
      {
        ...auditBase,
        hint,
        element_text: textOf(element).slice(0, 160)
      }
    );
  } catch (error) {
    return failure("RUNTIME_ERROR", {
      ...auditBase,
      error_name: error instanceof Error ? error.name : "Error"
    });
  }
};

export const parseDownloadTriggerRequestForExtension = (value: unknown): DownloadTriggerRequest | null => {
  const object = asRecord(value);
  const downloadSource = asRecord(object?.download_source);
  const abilityRef = asString(object?.ability_ref);
  const downloadGoal = asString(object?.download_goal);
  const sourceKind = asString(downloadSource?.source_kind);
  if (
    !object ||
    !downloadSource ||
    !abilityRef ||
    (downloadGoal !== "single_file" && downloadGoal !== "single_media_asset") ||
    (sourceKind !== "direct_url" && sourceKind !== "page_blob" && sourceKind !== "page_derived")
  ) {
    return null;
  }

  return object as unknown as DownloadTriggerRequest;
};
