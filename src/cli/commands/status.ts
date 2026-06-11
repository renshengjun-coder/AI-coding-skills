import {
  loadPackageContext,
  loadProfile,
  resolveLoopRoot,
} from "../../loop/package-store.js";
import { buildPackageStatus, formatPackageStatus } from "../../loop/status-report.js";
import { failure, success, type CommandResult } from "../types.js";

export interface StatusOptions {
  packageId: string;
  baseDir?: string;
}

export async function runStatus(options: StatusOptions): Promise<CommandResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const context = await loadPackageContext(loopRootPath, options.packageId);
  const rootBundle = context.bundles.find((bundle) => bundle.package.metadata.id === options.packageId);
  if (!rootBundle) return failure(`package ${options.packageId} not found`);

  const profile = await loadProfile(loopRootPath, rootBundle.package.spec.profileId);
  const status = buildPackageStatus(context, rootBundle.package, profile);
  return success(formatPackageStatus(status));
}
