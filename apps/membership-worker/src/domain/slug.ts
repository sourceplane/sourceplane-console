const organizationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function normalizeOrganizationSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function slugifyOrganizationName(name: string): string {
  const slug = normalizeOrganizationSlug(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/u, "")
    .replace(/-+$/u, "")
    .replace(/-{2,}/g, "-");

  if (!slug) {
    throw new Error("Unable to derive an organization slug from the provided name.");
  }

  return slug;
}

export function isOrganizationSlug(value: string): boolean {
  return organizationSlugPattern.test(value);
}
