import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..", "..");
const [baseRef = "HEAD^", headRef = "HEAD"] = process.argv.slice(2);

const deployableApps = [
  "api-edge",
  "identity-worker",
  "web-console"
];

const deployAllTriggers = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "tooling/",
  "packages/",
  "infra/",
  ".github/workflows/"
];

const diffOutput = execFileSync("git", ["diff", "--name-only", baseRef, headRef], {
  cwd: workspaceRoot,
  encoding: "utf8"
});

const changedFiles = diffOutput
  .split("\n")
  .map((value) => value.trim())
  .filter(Boolean);

const deployAll = changedFiles.some((file) =>
  deployAllTriggers.some((prefix) => file === prefix || file.startsWith(prefix))
);

const changedApps = new Set();

for (const file of changedFiles) {
  const match = /^apps\/([^/]+)\//.exec(file);
  if (!match) {
    continue;
  }

  const appName = match[1];
  if (deployableApps.includes(appName) && existsSync(resolve(workspaceRoot, "apps", appName, "package.json"))) {
    changedApps.add(appName);
  }
}

const result = deployAll ? deployableApps : [...changedApps].sort();
process.stdout.write(JSON.stringify(result));
