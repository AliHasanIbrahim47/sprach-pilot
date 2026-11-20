import { REQUIRED_PRIVACY_DOMAINS } from "@sprachpilot/shared";

export interface PrivacyDomainHandler {
  id: string;
  exportUser: (userId: string) => Promise<unknown>;
  deleteUser: (userId: string) => Promise<void>;
}

/** Fails closed when a personal-data domain has no export and delete handler. */
export function assertPrivacyDomains(registered: readonly PrivacyDomainHandler[]): void {
  const present = new Set<string>();
  for (const domain of registered) {
    if (typeof domain.exportUser !== "function" || typeof domain.deleteUser !== "function") {
      throw new Error(`privacy domain ${domain.id} is missing an export or delete handler`);
    }
    present.add(domain.id);
  }
  const missing = REQUIRED_PRIVACY_DOMAINS.filter((domain) => !present.has(domain));
  if (missing.length > 0) {
    throw new Error(`privacy domains are not registered: ${missing.join(", ")}`);
  }
}

/**
 * Columns marked `/// @pii` in schema.prisma.
 * A new annotation that is not listed in PII_COLUMNS fails the privacy test.
 */
export function piiColumnsInSchema(source: string): string[] {
  const columns: string[] = [];
  const models = source.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g);
  for (const model of models) {
    const name = model[1];
    const body = model[2];
    if (!name || body === undefined) continue;
    const chunks = body.split("/// @pii").slice(1);
    for (const chunk of chunks) {
      const following = chunk.split("\n").slice(1);
      for (const raw of following) {
        const trimmed = raw.trim();
        if (trimmed.startsWith("///") || trimmed.startsWith("//") || trimmed === "") continue;
        const field = trimmed.match(/^(\w+)\s+/);
        if (field?.[1]) {
          columns.push(`${name}.${field[1]}`);
          break;
        }
      }
    }
  }
  return columns.sort();
}
