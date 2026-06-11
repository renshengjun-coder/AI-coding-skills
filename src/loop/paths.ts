import { join } from "node:path";

export const LOOP_DIR = ".loop";

export const PACKAGE_SUBDIRS = {
  artifacts: "artifacts",
  findings: "findings",
  gates: "gates",
  decisions: "decisions",
} as const;

export function loopRoot(baseDir = process.cwd()): string {
  return join(baseDir, LOOP_DIR);
}

export function packagesDir(loopRootPath: string): string {
  return join(loopRootPath, "packages");
}

export function packageDir(loopRootPath: string, packageId: string): string {
  return join(packagesDir(loopRootPath), packageId);
}

export function packageManifestPath(packagePath: string): string {
  return join(packagePath, "package.yaml");
}

export function profilePath(loopRootPath: string, profileId: string): string {
  return join(loopRootPath, "profiles", `${profileId}.yaml`);
}

export function policyPath(loopRootPath: string, policyId: string, version = "v1"): string {
  return join(loopRootPath, "policies", version, `${policyId}.yaml`);
}

export function documentStorageDir(packagePath: string, kind: AnyDocumentKindDir): string {
  return join(packagePath, PACKAGE_SUBDIRS[kind]);
}

export type AnyDocumentKindDir = keyof typeof PACKAGE_SUBDIRS;

export function documentFileName(id: string, revision: number): string {
  return `${id}@${revision}.yaml`;
}
