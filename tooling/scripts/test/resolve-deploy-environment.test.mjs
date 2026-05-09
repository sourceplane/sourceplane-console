import { describe, expect, it } from "vitest";

import { isAllowedEnvironment, resolveDeployEnvironment } from "../resolve-deploy-environment.mjs";

describe("resolveDeployEnvironment", () => {
  // ──────────────────────────────────────────────────────────
  // 1. Explicit --env CLI argument
  // ──────────────────────────────────────────────────────────

  describe("explicit --env CLI argument", () => {
    it("returns 'production' when --env production is passed", () => {
      const result = resolveDeployEnvironment({ args: ["--env", "production"], env: {} });
      expect(result).toEqual({ environment: "production", source: "cli" });
    });

    it("returns 'preview' when --env preview is passed", () => {
      const result = resolveDeployEnvironment({ args: ["--env", "preview"], env: {} });
      expect(result).toEqual({ environment: "preview", source: "cli" });
    });

    it("returns 'preview' when short -e preview is passed", () => {
      const result = resolveDeployEnvironment({ args: ["-e", "preview"], env: {} });
      expect(result).toEqual({ environment: "preview", source: "cli" });
    });

    it("CLI --env takes precedence over DEPLOY_ENV", () => {
      const result = resolveDeployEnvironment({
        args: ["--env", "preview"],
        env: { DEPLOY_ENV: "production" }
      });
      expect(result).toEqual({ environment: "preview", source: "cli" });
    });

    it("CLI --env takes precedence over CI+GITHUB_REF inference", () => {
      const result = resolveDeployEnvironment({
        args: ["--env", "preview"],
        env: { CI: "true", GITHUB_REF: "refs/heads/main" }
      });
      expect(result).toEqual({ environment: "preview", source: "cli" });
    });

    it("passes an invalid env value through (caller validates)", () => {
      const result = resolveDeployEnvironment({ args: ["--env", "dev"], env: {} });
      expect(result).toEqual({ environment: "dev", source: "cli" });
    });
  });

  // ──────────────────────────────────────────────────────────
  // 2. DEPLOY_ENV environment variable
  // ──────────────────────────────────────────────────────────

  describe("DEPLOY_ENV environment variable", () => {
    it("returns 'production' from DEPLOY_ENV when no CLI arg is given", () => {
      const result = resolveDeployEnvironment({ args: [], env: { DEPLOY_ENV: "production" } });
      expect(result).toEqual({ environment: "production", source: "DEPLOY_ENV" });
    });

    it("returns 'preview' from DEPLOY_ENV when no CLI arg is given", () => {
      const result = resolveDeployEnvironment({ args: [], env: { DEPLOY_ENV: "preview" } });
      expect(result).toEqual({ environment: "preview", source: "DEPLOY_ENV" });
    });

    it("DEPLOY_ENV takes precedence over CI+GITHUB_REF inference", () => {
      const result = resolveDeployEnvironment({
        args: [],
        env: { DEPLOY_ENV: "preview", CI: "true", GITHUB_REF: "refs/heads/main" }
      });
      expect(result).toEqual({ environment: "preview", source: "DEPLOY_ENV" });
    });
  });

  // ──────────────────────────────────────────────────────────
  // 3. CI + GITHUB_REF inference (Orun/GitHub Actions production path)
  // ──────────────────────────────────────────────────────────

  describe("CI+GITHUB_REF inference", () => {
    it("infers 'production' when CI=true and GITHUB_REF=refs/heads/main", () => {
      const result = resolveDeployEnvironment({
        args: [],
        env: { CI: "true", GITHUB_REF: "refs/heads/main" }
      });
      expect(result).toEqual({ environment: "production", source: "CI+GITHUB_REF" });
    });

    it("does not infer when CI is not 'true'", () => {
      const result = resolveDeployEnvironment({
        args: [],
        env: { CI: "1", GITHUB_REF: "refs/heads/main" }
      });
      expect(result).toEqual({ environment: undefined, source: "none" });
    });

    it("does not infer when GITHUB_REF is not main", () => {
      const result = resolveDeployEnvironment({
        args: [],
        env: { CI: "true", GITHUB_REF: "refs/heads/feature/my-branch" }
      });
      expect(result).toEqual({ environment: undefined, source: "none" });
    });

    it("does not infer when GITHUB_REF is a PR ref", () => {
      const result = resolveDeployEnvironment({
        args: [],
        env: { CI: "true", GITHUB_REF: "refs/pull/42/merge" }
      });
      expect(result).toEqual({ environment: undefined, source: "none" });
    });
  });

  // ──────────────────────────────────────────────────────────
  // 4. Local / no-env safety: must return undefined
  // ──────────────────────────────────────────────────────────

  describe("local/no-env safety", () => {
    it("returns undefined when no args and no env are present", () => {
      const result = resolveDeployEnvironment({ args: [], env: {} });
      expect(result).toEqual({ environment: undefined, source: "none" });
    });

    it("returns undefined when CI is not set but GITHUB_REF is main", () => {
      const result = resolveDeployEnvironment({
        args: [],
        env: { GITHUB_REF: "refs/heads/main" }
      });
      expect(result).toEqual({ environment: undefined, source: "none" });
    });

    it("returns undefined when CI=true but GITHUB_REF is absent", () => {
      const result = resolveDeployEnvironment({ args: [], env: { CI: "true" } });
      expect(result).toEqual({ environment: undefined, source: "none" });
    });
  });

  // ──────────────────────────────────────────────────────────
  // 5. Invalid / ambiguous environment values
  // ──────────────────────────────────────────────────────────

  describe("isAllowedEnvironment validation", () => {
    it("returns true for 'production'", () => {
      expect(isAllowedEnvironment("production")).toBe(true);
    });

    it("returns true for 'preview'", () => {
      expect(isAllowedEnvironment("preview")).toBe(true);
    });

    it("returns false for 'staging'", () => {
      expect(isAllowedEnvironment("staging")).toBe(false);
    });

    it("returns false for 'dev'", () => {
      expect(isAllowedEnvironment("dev")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isAllowedEnvironment(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isAllowedEnvironment("")).toBe(false);
    });

    it("returns false for 'PRODUCTION' (case sensitive)", () => {
      expect(isAllowedEnvironment("PRODUCTION")).toBe(false);
    });
  });
});
