import { SourceplaneHttpError } from "@sourceplane/shared";

export function describeError(error: unknown): { message: string; detail?: string } {
  if (error instanceof SourceplaneHttpError) {
    const detailEntries = Object.entries(error.details ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" · ");
    return {
      message: `${error.code}: ${error.message}`,
      ...(detailEntries ? { detail: detailEntries } : {})
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Unknown error" };
}
