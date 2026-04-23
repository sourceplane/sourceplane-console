import type * as z from "zod";

export interface ContractValidationIssue {
  code: string;
  message: string;
  path: string;
}

export class ContractValidationError extends Error {
  constructor(
    public readonly contractName: string,
    public readonly issues: readonly ContractValidationIssue[]
  ) {
    super(`Invalid ${contractName}`);
  }
}

export function assertWithSchema<TValue>(
  contractName: string,
  schema: z.ZodType<TValue>,
  value: unknown
): TValue {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  throw new ContractValidationError(contractName, toContractValidationIssues(result.error));
}

export function isWithSchema<TValue>(schema: z.ZodType<TValue>, value: unknown): value is TValue {
  return schema.safeParse(value).success;
}

export function toContractValidationIssues(error: z.ZodError): ContractValidationIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: formatIssuePath(issue.path)
  }));
}

function formatIssuePath(path: (number | string)[]): string {
  if (path.length === 0) {
    return "$";
  }

  return path.reduce<string>((formattedPath, segment) => {
    if (typeof segment === "number") {
      return `${formattedPath}[${segment}]`;
    }

    return `${formattedPath}.${segment}`;
  }, "$");
}