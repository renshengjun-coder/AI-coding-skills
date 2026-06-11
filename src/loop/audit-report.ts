import type { AnyDocument } from "../kernel/contracts/types.js";
import { collectDocumentsSorted } from "./package-store.js";
import type { LoopContext } from "./package-store.js";

export function buildAuditReport(context: LoopContext): string {
  const lines: string[] = [
    `# Audit report: ${context.bundles[0]?.package.metadata.id ?? "unknown"}`,
    "",
  ];

  for (const bundle of context.bundles) {
    lines.push(`## Package ${bundle.package.metadata.id}`, "");
    lines.push(`- Title: ${bundle.package.spec.title}`);
    lines.push(`- Owner: ${bundle.package.spec.owner}`);
    lines.push(`- Profile: ${bundle.package.spec.profileId}`);
    lines.push(`- Status: ${bundle.package.spec.status}`);
    lines.push("");
  }

  lines.push("## Chronological records", "");
  const sorted = collectDocumentsSorted(context.documents);
  for (const document of sorted) {
    const timestamp = document.metadata.updatedAt ?? document.metadata.createdAt;
    lines.push(
      `- ${timestamp} | ${document.kind} | ${document.metadata.id}@${document.metadata.revision}`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function summarizeDocuments(documents: AnyDocument[]): string {
  const counts = new Map<string, number>();
  for (const document of documents) {
    counts.set(document.kind, (counts.get(document.kind) ?? 0) + 1);
  }
  return [...counts.entries()].map(([kind, count]) => `${kind}: ${count}`).join(", ");
}
