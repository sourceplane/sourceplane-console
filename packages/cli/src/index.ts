#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { SourceplaneClient } from "@sourceplane/sdk";

export interface CliOptions {
  baseUrl: string;
  command: string[];
}

export function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv];
  let baseUrl = "http://127.0.0.1:8787";

  while (args[0]?.startsWith("--")) {
    const flag = args.shift();
    if (flag === "--base-url") {
      baseUrl = args.shift() ?? baseUrl;
    }
  }

  return {
    baseUrl,
    command: args
  };
}

export function formatOutput(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main(): Promise<void> {
  const { baseUrl, command } = parseCliArgs(process.argv.slice(2));
  const client = new SourceplaneClient({ baseUrl });

  if (command[0] === "whoami") {
    process.stdout.write(formatOutput({
      note: "Authentication flows will land in a later task.",
      usingBaseUrl: baseUrl
    }));
    return;
  }

  if (command[0] === "routes") {
    process.stdout.write(formatOutput(await client.listRouteGroups()));
    return;
  }

  process.stdout.write(
    formatOutput({
      availableCommands: ["whoami", "routes"],
      note: "This scaffold is intentionally minimal until the public API surface stabilizes."
    })
  );
}

const isDirectExecution = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  void main();
}
