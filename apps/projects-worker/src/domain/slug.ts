export function slugifyDisplayName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]+/gu, "")
    .trim()
    .replace(/[\s_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 63);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value) && value.length >= 2 && value.length <= 63;
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}
