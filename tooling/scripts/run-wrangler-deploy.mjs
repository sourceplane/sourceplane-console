import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const targetEnvironment = readOptionValue(args, ["--env", "-e"]);
const allowedEnvironments = new Set(["preview", "production"]);
const wranglerCommand = process.env.WRANGLER_BINARY ?? (process.platform === "win32" ? "wrangler.cmd" : "wrangler");

if (!targetEnvironment || !allowedEnvironments.has(targetEnvironment)) {
  process.stderr.write(
    "Deploy commands require an explicit --env preview|production argument. Use the app dev commands for local work.\n"
  );
  process.exit(1);
}

const preparedConfig = prepareDeployConfig({
  args,
  targetEnvironment,
  wranglerCommand
});

try {
  execFileSync(wranglerCommand, ["deploy", ...replaceConfigArgument(args, preparedConfig?.filePath ?? null)], {
    stdio: "inherit"
  });
} finally {
  preparedConfig?.cleanup();
}

function prepareDeployConfig({
  args,
  targetEnvironment,
  wranglerCommand
}) {
  const configuredPath = readOptionValue(args, ["--config", "-c"]);
  const sourceConfigPath = resolve(process.cwd(), configuredPath ?? "wrangler.jsonc");
  const sourceConfig = parseJsonc(readFileSync(sourceConfigPath, "utf8"));
  const environmentConfig = sourceConfig.env?.[targetEnvironment];

  if (!environmentConfig || !Array.isArray(environmentConfig.d1_databases)) {
    return null;
  }

  const bindingsNeedingResolution = environmentConfig.d1_databases.filter(needsResolvedDatabaseId);
  if (bindingsNeedingResolution.length === 0) {
    return null;
  }

  const databaseIdsByName = loadD1DatabaseIdsByName(wranglerCommand);

  for (const binding of bindingsNeedingResolution) {
    const databaseId = databaseIdsByName.get(binding.database_name);

    if (!databaseId) {
      throw new Error(
        `Could not resolve D1 database ID for '${binding.database_name}' while preparing the ${targetEnvironment} deploy.`
      );
    }

    binding.database_id = databaseId;
  }

  const generatedConfigPath = join(
    dirname(sourceConfigPath),
    `.wrangler.deploy.${targetEnvironment}.${process.pid}.${Date.now()}.json`
  );

  writeFileSync(generatedConfigPath, `${JSON.stringify(sourceConfig, null, 2)}\n`);

  return {
    cleanup() {
      rmSync(generatedConfigPath, { force: true });
    },
    filePath: generatedConfigPath
  };
}

function loadD1DatabaseIdsByName(wranglerCommand) {
  const output = execFileSync(wranglerCommand, ["d1", "list", "--json"], {
    encoding: "utf8"
  });
  const parsedValue = JSON.parse(output);

  if (!Array.isArray(parsedValue)) {
    throw new TypeError("Expected `wrangler d1 list --json` to return an array.");
  }

  const databasesByName = new Map();

  for (const entry of parsedValue) {
    if (!isRecord(entry)) {
      continue;
    }

    const databaseName = typeof entry.name === "string" ? entry.name : null;
    const databaseId = readDatabaseId(entry);

    if (!databaseName || !databaseId) {
      continue;
    }

    databasesByName.set(databaseName, databaseId);
  }

  return databasesByName;
}

function readDatabaseId(entry) {
  if (typeof entry.uuid === "string") {
    return entry.uuid;
  }

  if (typeof entry.id === "string") {
    return entry.id;
  }

  if (typeof entry.database_id === "string") {
    return entry.database_id;
  }

  return null;
}

function replaceConfigArgument(args, configFilePath) {
  const nextArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--config" || value === "-c") {
      index += 1;
      continue;
    }

    nextArgs.push(value);
  }

  if (configFilePath) {
    nextArgs.push("--config", configFilePath);
  }

  return nextArgs;
}

function readOptionValue(args, names) {
  for (let index = 0; index < args.length; index += 1) {
    if (names.includes(args[index])) {
      return args[index + 1];
    }
  }

  return undefined;
}

function needsResolvedDatabaseId(binding) {
  return (
    isRecord(binding) &&
    typeof binding.database_name === "string" &&
    (typeof binding.database_id !== "string" || isPlaceholderDatabaseId(binding.database_id))
  );
}

function isPlaceholderDatabaseId(value) {
  return /^([0-9a-f])\1{7}-\1{4}-\1{4}-\1{4}-\1{12}$/iu.test(value);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

function parseJsonc(sourceText) {
  let output = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;

  for (let index = 0; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    const nextCharacter = sourceText[index + 1];

    if (inLineComment) {
      if (character === "\n") {
        inLineComment = false;
        output += character;
      }

      continue;
    }

    if (inBlockComment) {
      if (character === "*" && nextCharacter === "/") {
        inBlockComment = false;
        index += 1;
      }

      continue;
    }

    if (inString) {
      output += character;

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += character;

    if (character === '"') {
      inString = true;
    }
  }

  return JSON.parse(output);
}