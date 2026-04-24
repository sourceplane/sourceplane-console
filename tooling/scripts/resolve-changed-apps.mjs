import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..", "..");
const [baseRefArg = "HEAD^", headRef = "HEAD"] = process.argv.slice(2);
const emptyTreeRef = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function gitRefExists(ref) {
  if (!ref) {
    return false;
  }

  try {
    execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: "ignore"
    });

    return true;
  } catch {
    return false;
  }
}

function resolveBaseRef(baseRef) {
  if (baseRef && !/^0+$/.test(baseRef) && gitRefExists(baseRef)) {
    return baseRef;
  }

  if (gitRefExists("HEAD^")) {
    return "HEAD^";
  }

  return emptyTreeRef;
}

const baseRef = resolveBaseRef(baseRefArg.trim());

const deployableApps = [
  "api-edge",
  "identity-worker",
  "membership-worker",
  "policy-worker",
  "projects-worker",
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

function getDiffOutput(ref) {
  return execFileSync("git", ["diff", "--name-only", ref, headRef], {
    cwd: workspaceRoot,
    encoding: "utf8"
  });
}

const diffOutput = (() => {
  try {
    return getDiffOutput(baseRef);
  } catch {
    if (baseRef === emptyTreeRef) {
      throw new Error(`Unable to diff ${emptyTreeRef} against ${headRef}`);
    }

    return getDiffOutput(emptyTreeRef);
  }
})();

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
