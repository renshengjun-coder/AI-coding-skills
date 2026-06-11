import { prepareRelease } from "../../release/prepare-release.js";
import { failure, success, type CommandResult } from "../types.js";

export interface ReleasePrepareOptions {
  packageId: string;
  gitCommit: string;
  baseDir?: string;
  workflowRunId?: string;
}

export async function runReleasePrepare(options: ReleasePrepareOptions): Promise<CommandResult> {
  try {
    const result = await prepareRelease({
      packageId: options.packageId,
      gitCommit: options.gitCommit,
      ...(options.baseDir ? { baseDir: options.baseDir } : {}),
      ...(options.workflowRunId ? { workflowRunId: options.workflowRunId } : {}),
    });
    return success([
      `Release manifest: ${result.manifestPath}`,
      `Provenance finding: ${result.provenanceFindingPath}`,
      `Attestation subjects (${result.subjectPaths.length}):`,
      ...result.subjectPaths.map((path) => `  - ${path}`),
    ].join("\n"));
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}
