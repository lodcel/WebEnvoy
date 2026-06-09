import { createHash } from "node:crypto";
import { dirname, posix } from "node:path";

export interface ServiceWorkerBundleSource {
  scriptPath: string;
  source: string;
}

const normalizeSlashes = (value: string): string => value.replaceAll("\\", "/");

export const normalizeServiceWorkerBundleScriptPath = (scriptPath: string): string | null => {
  const withoutQuery = normalizeSlashes(scriptPath).split(/[?#]/u)[0] ?? "";
  const normalized = posix.normalize(withoutQuery.replace(/^\/+/u, ""));
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return null;
  }
  return normalized;
};

export const digestServiceWorkerBundleSources = (
  sources: readonly ServiceWorkerBundleSource[]
): string | null => {
  const normalized = new Map<string, string>();
  for (const source of sources) {
    const scriptPath = normalizeServiceWorkerBundleScriptPath(source.scriptPath);
    if (!scriptPath) {
      return null;
    }
    const previous = normalized.get(scriptPath);
    if (previous !== undefined && previous !== source.source) {
      return null;
    }
    normalized.set(scriptPath, source.source);
  }
  if (normalized.size === 0) {
    return null;
  }

  const hash = createHash("sha256");
  hash.update("webenvoy-service-worker-bundle-v1\n");
  for (const [scriptPath, source] of [...normalized.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    hash.update(scriptPath);
    hash.update("\0");
    hash.update(String(Buffer.byteLength(source, "utf8")));
    hash.update("\0");
    hash.update(source);
    hash.update("\n");
  }
  return hash.digest("hex");
};

export const extractRelativeModuleSpecifiers = (source: string): string[] => {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:])\/\/.*$/gmu, "$1");
  const specifiers = new Set<string>();
  const patterns = [
    /\bimport\s+(?:[^'"]*?\s+from\s*)?["']([^"']+)["']/gu,
    /\bexport\s+[^'"]*?\s+from\s*["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu
  ];
  for (const pattern of patterns) {
    for (const match of withoutComments.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier?.startsWith(".")) {
        specifiers.add(specifier);
      }
    }
  }
  return [...specifiers].sort();
};

export const resolveRelativeModuleScriptPath = (
  fromScriptPath: string,
  specifier: string
): string | null => {
  if (!specifier.startsWith(".")) {
    return null;
  }
  return normalizeServiceWorkerBundleScriptPath(
    posix.join(dirname(normalizeSlashes(fromScriptPath)), specifier)
  );
};
