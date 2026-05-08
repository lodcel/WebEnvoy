import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));

const gitHeadResult = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"]
});
const gitHead = gitHeadResult.status === 0 ? gitHeadResult.stdout.trim() : null;

if (!gitHead) {
  process.exit(0);
}

const metadataPath = resolve(repoRoot, "dist", "runtime-build-metadata.json");
mkdirSync(dirname(metadataPath), { recursive: true });
writeFileSync(
  metadataPath,
  `${JSON.stringify(
    {
      name: packageJson.name,
      gitHead
    },
    null,
    2
  )}\n`,
  "utf8"
);
