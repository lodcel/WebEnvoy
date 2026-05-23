import { describe, expect, it } from "vitest";

import { ContentScriptHandler } from "../extension/content-script-handler.js";

const waitForResult = async (results: Array<Record<string, unknown>>): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (results.length > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("content script result was not emitted");
};

const createMockElement = (input: {
  tagName?: string;
  text?: string;
  attrs?: Record<string, string>;
  onClick?: () => void;
}) => ({
  tagName: input.tagName ?? "A",
  innerText: input.text ?? "",
  textContent: input.text ?? "",
  getAttribute: (name: string) => input.attrs?.[name] ?? null,
  click: input.onClick ?? (() => undefined)
});

const installMockPage = (input: {
  href?: string;
  querySelector?: (selector: string) => unknown;
  querySelectorAll?: (selector: string) => unknown[];
  createElement?: (tag: string) => unknown;
}) => {
  (globalThis as { location?: unknown }).location = {
    href: input.href ?? "https://example.com/export"
  };
  (globalThis as { document?: unknown }).document = {
    title: "Download Contract Page",
    querySelector: input.querySelector ?? (() => null),
    querySelectorAll: input.querySelectorAll ?? (() => []),
    createElement:
      input.createElement ??
      (() =>
        createMockElement({
          attrs: {},
          onClick: () => undefined
        })),
    documentElement: {
      append: (_node: unknown) => undefined
    }
  };
};

const dispatchDownloadTrigger = (input: {
  request: Record<string, unknown>;
  triggerMode?: "resolve_only" | "dispatch_click";
}) => {
  const handler = new ContentScriptHandler();
  const results: Array<Record<string, unknown>> = [];
  handler.onResult((message) => {
    results.push(message as unknown as Record<string, unknown>);
  });
  handler.onBackgroundMessage({
    kind: "forward",
    id: "run-download-content-001",
    runId: "run-download-content-001",
    tabId: 3,
    profile: "profile-a",
    cwd: "/workspace/WebEnvoy",
    timeoutMs: 1_000,
    command: "download.trigger",
    params: {},
    commandParams: {
      trigger_mode: input.triggerMode ?? "resolve_only",
      download_ability_request: input.request
    },
    fingerprintContext: null
  });
  return results;
};

describe("content script download trigger contract", () => {
  it("resolves and triggers a page-derived download target in the browser surface", async () => {
    let clicked = false;
    const button = createMockElement({
      tagName: "BUTTON",
      text: "Export PDF",
      onClick: () => {
        clicked = true;
      }
    });
    installMockPage({
      querySelector: () => null,
      querySelectorAll: () => [button]
    });

    const results = dispatchDownloadTrigger({
      triggerMode: "dispatch_click",
      request: {
        ability_ref: "generic.file.download.v1",
        download_source: {
          source_kind: "page_derived",
          derive_mode: "export_flow",
          trigger_hint: "export"
        },
        download_goal: "single_file"
      }
    });
    await waitForResult(results);

    expect(clicked).toBe(true);
    expect(results[0]).toMatchObject({
      ok: true,
      payload: {
        download_browser_result: {
          success: true,
          download_target: {
            source_kind: "page_derived",
            source_url: "https://example.com/export#page_derived",
            trigger_status: "triggered",
            trigger_mode: "dispatch_click",
            trigger_surface: "dom_button"
          }
        }
      }
    });
  });

  it("resolves a blob locator without treating blob_url-only as the browser target", async () => {
    const anchor = createMockElement({
      tagName: "A",
      attrs: {
        href: "blob:https://example.com/blob-001",
        download: "export.bin"
      }
    });
    installMockPage({
      querySelector: (selector) => (selector === "#blob-download" ? anchor : null)
    });

    const results = dispatchDownloadTrigger({
      request: {
        ability_ref: "generic.file.download.v1",
        download_source: {
          source_kind: "page_blob",
          blob_locator: "#blob-download",
          blob_url: "blob:https://example.com/blob-ignored"
        },
        download_goal: "single_file"
      }
    });
    await waitForResult(results);

    expect(results[0]).toMatchObject({
      ok: true,
      payload: {
        download_browser_result: {
          success: true,
          download_target: {
            target_ref: "#blob-download",
            source_kind: "page_blob",
            source_url: "blob:https://example.com/blob-001",
            file_name_hint: "export.bin",
            trigger_status: "resolved",
            trigger_surface: "blob_locator"
          },
          trigger_audit: {
            locator_found: true
          }
        }
      }
    });
  });

  it("returns SOURCE_UNAVAILABLE when no browser target can be located", async () => {
    installMockPage({
      querySelector: () => null,
      querySelectorAll: () => []
    });

    const results = dispatchDownloadTrigger({
      request: {
        ability_ref: "generic.file.download.v1",
        download_source: {
          source_kind: "page_derived",
          derive_mode: "export_flow",
          trigger_hint: "missing export"
        },
        download_goal: "single_file"
      }
    });
    await waitForResult(results);

    expect(results[0]).toMatchObject({
      ok: true,
      payload: {
        download_browser_result: {
          success: false,
          failure_reason: "SOURCE_UNAVAILABLE"
        }
      }
    });
  });

  it("rejects page_blob blob_url-only when the browser locator is missing", async () => {
    installMockPage({
      querySelector: () => null,
      querySelectorAll: () => []
    });

    const results = dispatchDownloadTrigger({
      request: {
        ability_ref: "generic.file.download.v1",
        download_source: {
          source_kind: "page_blob",
          blob_locator: "#missing-blob",
          blob_url: "blob:https://example.com/unresolved"
        },
        download_goal: "single_file"
      }
    });
    await waitForResult(results);

    expect(results[0]).toMatchObject({
      ok: true,
      payload: {
        download_browser_result: {
          success: false,
          failure_reason: "SOURCE_UNAVAILABLE",
          trigger_audit: {
            locator_found: false,
            blob_url_present: true
          }
        }
      }
    });
  });

  it("rejects page_blob blob_url when the browser locator has no verifiable source url", async () => {
    const button = createMockElement({
      tagName: "BUTTON",
      attrs: {
        "data-testid": "blob-trigger"
      }
    });
    installMockPage({
      querySelector: (selector) => (selector === "#blob-trigger" ? button : null),
      querySelectorAll: () => []
    });

    const results = dispatchDownloadTrigger({
      request: {
        ability_ref: "generic.file.download.v1",
        download_source: {
          source_kind: "page_blob",
          blob_locator: "#blob-trigger",
          blob_url: "blob:https://example.com/unverified"
        },
        download_goal: "single_file"
      }
    });
    await waitForResult(results);

    expect(results[0]).toMatchObject({
      ok: true,
      payload: {
        download_browser_result: {
          success: false,
          failure_reason: "SOURCE_UNAVAILABLE",
          trigger_audit: {
            locator_found: true,
            blob_url_present: true
          }
        }
      }
    });
  });
});
