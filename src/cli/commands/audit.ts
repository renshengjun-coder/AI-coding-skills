import { loadPackageContext, resolveLoopRoot } from "../../loop/package-store.js";
import { buildAuditReport } from "../../loop/audit-report.js";
import { failure, success, type CommandResult } from "../types.js";

export interface AuditOptions {
  packageId: string;
  baseDir?: string;
}

export async function runAudit(options: AuditOptions): Promise<CommandResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const context = await loadPackageContext(loopRootPath, options.packageId);
  if (context.bundles.length === 0) return failure(`package ${options.packageId} not found`);
  return success(buildAuditReport(context));
}
