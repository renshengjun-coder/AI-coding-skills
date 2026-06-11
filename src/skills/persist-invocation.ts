import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SkillInvocationResult } from "./contract/types.js";
import { packageDir } from "../loop/paths.js";
import { savePackageDocument } from "../loop/package-store.js";

export async function persistSkillInvocationResult(
  loopRootPath: string,
  packageId: string,
  result: SkillInvocationResult,
): Promise<string[]> {
  if (result.status !== "success" || !result.envelope || !result.artifactContentPath) {
    throw new Error(result.error ?? "cannot persist unsuccessful skill invocation");
  }
  if (!result.artifactMarkdown) {
    throw new Error("artifact markdown is required to persist invocation result");
  }

  const packagePath = packageDir(loopRootPath, packageId);
  const relativeName = result.artifactContentPath.split("/artifacts/").pop() ?? "artifact.md";
  const markdownPath = join(packagePath, "artifacts", relativeName);

  await mkdir(join(packagePath, "artifacts"), { recursive: true });
  await writeFile(markdownPath, result.artifactMarkdown, "utf8");

  const savedPaths: string[] = [markdownPath];
  savedPaths.push(await savePackageDocument(loopRootPath, packageId, result.envelope));
  for (const finding of result.findings) {
    savedPaths.push(await savePackageDocument(loopRootPath, packageId, finding));
  }
  return savedPaths;
}
