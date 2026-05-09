/**
 * Resolves the Wrangler deployment environment from the following sources, in
 * order of precedence:
 *
 * 1. The `--env` / `-e` CLI argument (explicit always wins).
 * 2. The `DEPLOY_ENV` environment variable (useful for CI wrappers that set
 *    the env explicitly without needing to forward CLI args).
 * 3. CI inference from `GITHUB_REF`: when `CI=true` and
 *    `GITHUB_REF=refs/heads/main`, the environment is inferred as
 *    `"production"`. This covers the Orun / GitHub Actions production deploy
 *    path where the composition calls `pnpm run deploy` without arguments.
 *
 * If none of the above yields a valid environment, the function returns
 * `undefined` and the caller is expected to exit with an error.
 *
 * Allowed environments: `"preview"` and `"production"`.
 *
 * Safety guarantee: local / no-env invocations will receive `undefined` and
 * the caller will refuse to deploy. A developer running `pnpm deploy` from
 * their shell will never accidentally deploy to production unless they pass
 * `--env production` explicitly.
 *
 * @param {object} options
 * @param {string[]} options.args  - Raw CLI arguments (process.argv.slice(2)).
 * @param {Record<string, string | undefined>} options.env - Process environment
 *   (process.env).
 * @returns {{ environment: string; source: string } | { environment: undefined; source: "none" }}
 */
export function resolveDeployEnvironment({ args, env }) {
  const allowedEnvironments = new Set(["preview", "production"]);

  // 1. Explicit CLI --env / -e argument.
  const cliValue = readOptionValue(args, ["--env", "-e"]);

  if (cliValue !== undefined) {
    return { environment: cliValue, source: "cli" };
  }

  // 2. DEPLOY_ENV environment variable.
  const deployEnvValue = env["DEPLOY_ENV"];

  if (deployEnvValue !== undefined) {
    return { environment: deployEnvValue, source: "DEPLOY_ENV" };
  }

  // 3. CI inference: CI=true + GITHUB_REF=refs/heads/main → production.
  //    This is the Orun/GitHub Actions production deploy path. The Orun
  //    composition for `cloudflare-worker-turbo` only reaches `pnpm run deploy`
  //    for the production environment on the production branch; staging and dev
  //    jobs are skipped or dry-run before they call the deploy script.
  if (env["CI"] === "true" && env["GITHUB_REF"] === "refs/heads/main") {
    return { environment: "production", source: "CI+GITHUB_REF" };
  }

  return { environment: undefined, source: "none" };
}

/**
 * Returns true if the resolved environment is in the allowed set.
 *
 * @param {string | undefined} environment
 * @returns {boolean}
 */
export function isAllowedEnvironment(environment) {
  return environment === "preview" || environment === "production";
}

/**
 * Reads the value of a named option from an args array.
 * For `["--env", "production"]`, `readOptionValue(args, ["--env", "-e"])`
 * returns `"production"`.
 *
 * @param {string[]} args
 * @param {string[]} names
 * @returns {string | undefined}
 */
export function readOptionValue(args, names) {
  for (let index = 0; index < args.length; index += 1) {
    if (names.includes(args[index])) {
      return args[index + 1];
    }
  }

  return undefined;
}
