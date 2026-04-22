import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const envFlagIndex = args.findIndex((value) => value === "--env");
const targetEnvironment = envFlagIndex >= 0 ? args[envFlagIndex + 1] : undefined;
const allowedEnvironments = new Set(["preview", "production"]);
const wranglerCommand = process.platform === "win32" ? "wrangler.cmd" : "wrangler";

if (!targetEnvironment || !allowedEnvironments.has(targetEnvironment)) {
  process.stderr.write(
    "Deploy commands require an explicit --env preview|production argument. Use the app dev commands for local work.\n"
  );
  process.exit(1);
}

execFileSync(wranglerCommand, ["deploy", ...args], {
  stdio: "inherit"
});