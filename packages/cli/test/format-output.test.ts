import { describe, expect, it } from "vitest";

import { formatOutput, parseCliArgs } from "@sourceplane/cli";

describe("cli formatting", () => {
  it("parses the base URL flag and command arguments", () => {
    expect(parseCliArgs(["--base-url", "https://api.sourceplane.test", "routes"])).toEqual({
      baseUrl: "https://api.sourceplane.test",
      command: ["routes"]
    });
  });

  it("formats JSON output with a trailing newline", () => {
    expect(formatOutput({ ok: true })).toBe('{\n  "ok": true\n}\n');
  });
});
