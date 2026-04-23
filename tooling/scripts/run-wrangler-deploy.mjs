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
  if (preparedConfig) {
    applyRemoteD1Migrations({
      bindings: preparedConfig.d1Bindings,
      configFilePath: preparedConfig.filePath ?? preparedConfig.sourceConfigPath,
      targetEnvironment,
      wranglerCommand
    });
  }

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
    return {
      cleanup() {},
      d1Bindings: [],
      filePath: null,
      sourceConfigPath
    };
  }

  const d1Bindings = environmentConfig.d1_databases.filter(isD1Binding);
  const bindingsNeedingResolution = d1Bindings.filter(needsResolvedDatabaseId);
  let generatedConfigPath = null;

  if (bindingsNeedingResolution.length > 0) {
    let databaseIdsByName = loadD1DatabaseIdsByName(wranglerCommand);

    for (const binding of bindingsNeedingResolution) {
      let databaseId = databaseIdsByName.get(binding.database_name);

      if (!databaseId) {
        ensureD1DatabaseExists({
          databaseName: binding.database_name,
          wranglerCommand
        });
        databaseIdsByName = loadD1DatabaseIdsByName(wranglerCommand);
        databaseId = databaseIdsByName.get(binding.database_name);
      }

      if (!databaseId) {
        throw new Error(
          `Could not resolve D1 database ID for '${binding.database_name}' while preparing the ${targetEnvironment} deploy.`
        );
      }

      binding.database_id = databaseId;
    }

    generatedConfigPath = join(
      dirname(sourceConfigPath),
      `.wrangler.deploy.${targetEnvironment}.${process.pid}.${Date.now()}.json`
    );

    writeFileSync(generatedConfigPath, `${JSON.stringify(sourceConfig, null, 2)}\n`);
  }

  return {
    cleanup() {
      if (generatedConfigPath) {
        rmSync(generatedConfigPath, { force: true });
      }
    },
    d1Bindings,
    filePath: generatedConfigPath,
    sourceConfigPath
  };
}

function applyRemoteD1Migrations({
  bindings,
  configFilePath,
  targetEnvironment,
  wranglerCommand
}) {
  const migrationTargets = new Set(bindings.map((binding) => binding.binding));

  for (const bindingName of migrationTargets) {
    process.stdout.write(`Applying D1 migrations for ${bindingName} (${targetEnvironment}).\n`);
    execFileSync(
      wranglerCommand,
      ["d1", "migrations", "apply", bindingName, "--env", targetEnvironment, "--config", configFilePath],
      {
        stdio: "inherit"
      }
    );
  }
}

function ensureD1DatabaseExists({
  databaseName,
  wranglerCommand
}) {
  process.stdout.write(`Creating missing D1 database '${databaseName}'.\n`);
  execFileSync(wranglerCommand, ["d1", "create", databaseName], {
    stdio: "inherit"
  });
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
    isD1Binding(binding) &&
    (typeof binding.database_id !== "string" || isPlaceholderDatabaseId(binding.database_id))
  );
}

function isD1Binding(value) {
  return isRecord(value) && typeof value.binding === "string" && typeof value.database_name === "string";
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