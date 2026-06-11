import { validateGraphIntegrity } from "../../kernel/graph/evidence-graph.js";
import { validateDocument } from "../../kernel/validation/schema-registry.js";
import { loadPackageContext, resolveLoopRoot } from "../../loop/package-store.js";
import { failure, success, type CommandResult } from "../types.js";

export interface CheckOptions {
  packageId: string;
  baseDir?: string;
}

export async function runCheck(options: CheckOptions): Promise<CommandResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const context = await loadPackageContext(loopRootPath, options.packageId);

  const schemaIssues = context.documents.flatMap((document) => {
    const result = validateDocument(document);
    return result.valid
      ? []
      : result.issues.map((issue) => `${document.kind}:${document.metadata.id} ${issue.path}: ${issue.message}`);
  });
  if (schemaIssues.length > 0) {
    return failure(`Schema validation failed:\n${schemaIssues.join("\n")}`);
  }

  const graphIssues = validateGraphIntegrity(context.documents);
  if (graphIssues.length > 0) {
    const details = graphIssues.map((issue) => `${issue.ruleId}: ${issue.message}`).join("\n");
    return failure(`Graph integrity failed:\n${details}`);
  }

  return success(`Check passed for ${options.packageId} (${context.documents.length} documents)`);
}
