import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { digestDocument } from "../kernel/canonical/canonicalize.js";
import type { AnyDocument, ChangePackage, GatePolicy, WorkflowProfile } from "../kernel/contracts/types.js";
import type { ContractKind } from "../kernel/contracts/vocabulary.js";
import { isContractKind } from "../kernel/contracts/vocabulary.js";
import { loadDocument } from "../kernel/io/load-document.js";
import { serializeDocument } from "../kernel/io/save-document.js";
import { storageDirForKind } from "./document-layout.js";
import {
  documentFileName,
  documentStorageDir,
  loopRoot,
  packageDir,
  packageManifestPath,
  packagesDir,
  policyPath,
  profilePath,
} from "./paths.js";

export interface PackageBundle {
  package: ChangePackage;
  documents: AnyDocument[];
  packagePath: string;
}

export interface LoopContext {
  loopRootPath: string;
  bundles: PackageBundle[];
  documents: AnyDocument[];
}

const CONTRACT_FILE_PATTERN = /\.(yaml|yml|json)$/i;

export function resolveLoopRoot(baseDir = process.cwd()): string {
  return loopRoot(baseDir);
}

export async function listPackageIds(loopRootPath: string): Promise<string[]> {
  const root = packagesDir(loopRootPath);
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function ensurePackageLayout(packagePath: string): Promise<void> {
  await mkdir(packagePath, { recursive: true });
  for (const subdir of ["artifacts", "findings", "gates", "decisions"] as const) {
    await mkdir(join(packagePath, subdir), { recursive: true });
  }
}

async function readDocumentsFromDir(dirPath: string): Promise<AnyDocument[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const documents: AnyDocument[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !CONTRACT_FILE_PATTERN.test(entry.name)) continue;
      const sourceName = join(dirPath, entry.name);
      const content = await readFile(sourceName, "utf8");
      documents.push(loadDocument(content, sourceName));
    }
    return documents;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function loadPackageBundle(loopRootPath: string, packageId: string): Promise<PackageBundle> {
  const packagePath = packageDir(loopRootPath, packageId);
  const manifestPath = packageManifestPath(packagePath);
  const manifestContent = await readFile(manifestPath, "utf8");
  const packageDocument = loadDocument(manifestContent, manifestPath);
  if (packageDocument.kind !== "ChangePackage") {
    throw new Error(`${manifestPath}: expected ChangePackage`);
  }

  const documents: AnyDocument[] = [packageDocument];
  for (const subdir of ["artifacts", "findings", "gates", "decisions"] as const) {
    documents.push(...await readDocumentsFromDir(documentStorageDir(packagePath, subdir)));
  }

  return { package: packageDocument, documents, packagePath };
}

function childPackageIds(packageDocument: ChangePackage): string[] {
  return packageDocument.spec.relationships
    .filter((link) => link.relation === "decomposes-into")
    .map((link) => link.target.id);
}

export async function loadPackageContext(
  loopRootPath: string,
  packageId: string,
  options: { includeChildren?: boolean } = {},
): Promise<LoopContext> {
  const includeChildren = options.includeChildren ?? true;
  const visited = new Set<string>();
  const bundles: PackageBundle[] = [];
  const documents: AnyDocument[] = [];

  const visit = async (id: string): Promise<void> => {
    if (visited.has(id)) return;
    visited.add(id);
    const bundle = await loadPackageBundle(loopRootPath, id);
    bundles.push(bundle);
    documents.push(...bundle.documents);
    if (includeChildren) {
      for (const childId of childPackageIds(bundle.package)) {
        await visit(childId);
      }
    }
  };

  await visit(packageId);
  return { loopRootPath, bundles, documents };
}

export async function savePackageDocument(
  loopRootPath: string,
  packageId: string,
  document: AnyDocument,
): Promise<string> {
  if (document.kind === "ChangePackage") {
    if (document.metadata.id !== packageId) {
      throw new Error(`package id mismatch: ${document.metadata.id} !== ${packageId}`);
    }
    const packagePath = packageDir(loopRootPath, packageId);
    await ensurePackageLayout(packagePath);
    const target = packageManifestPath(packagePath);
    await writeFile(target, serializeDocument(document), "utf8");
    return target;
  }

  const subdir = storageDirForKind(document.kind);
  if (!subdir) {
    throw new Error(`cannot store document kind ${document.kind} in a package directory`);
  }

  const packagePath = packageDir(loopRootPath, packageId);
  await ensurePackageLayout(packagePath);
  const dir = documentStorageDir(packagePath, subdir);
  const target = join(dir, documentFileName(document.metadata.id, document.metadata.revision));
  await writeFile(target, serializeDocument(document), "utf8");
  return target;
}

export function nextDocumentRevision(documents: AnyDocument[], kind: ContractKind, id: string): number {
  const revisions = documents
    .filter((document) => document.kind === kind && document.metadata.id === id)
    .map((document) => document.metadata.revision);
  return revisions.length === 0 ? 1 : Math.max(...revisions) + 1;
}

export function nextSequentialId(
  documents: AnyDocument[],
  kind: ContractKind,
  prefix: string,
): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const numbers = documents
    .filter((document) => document.kind === kind)
    .map((document) => {
      const match = document.metadata.id.match(pattern);
      return match ? Number(match[1]) : 0;
    });
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

const WORK_ITEM_PREFIX: Record<ChangePackage["spec"]["workItemType"], string> = {
  feature: "CHG-FEAT",
  requirement: "CHG-REQ",
  "bug-fix": "CHG-BUG",
  "development-task": "CHG-TASK",
};

export async function allocatePackageId(
  loopRootPath: string,
  workItemType: ChangePackage["spec"]["workItemType"],
): Promise<string> {
  const prefix = WORK_ITEM_PREFIX[workItemType];
  const existing = await listPackageIds(loopRootPath);
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const numbers = existing
    .map((id) => {
      const match = id.match(pattern);
      return match ? Number(match[1]) : 0;
    });
  const next = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export async function loadProfile(loopRootPath: string, profileId: string): Promise<WorkflowProfile> {
  const source = profilePath(loopRootPath, profileId);
  const document = loadDocument(await readFile(source, "utf8"), source);
  if (document.kind !== "WorkflowProfile") throw new Error(`${source}: expected WorkflowProfile`);
  return document;
}

export async function loadPolicy(loopRootPath: string, policyId: string): Promise<GatePolicy> {
  const source = policyPath(loopRootPath, policyId);
  const document = loadDocument(await readFile(source, "utf8"), source);
  if (document.kind !== "GatePolicy") throw new Error(`${source}: expected GatePolicy`);
  return document;
}

export async function loadPoliciesForProfile(
  loopRootPath: string,
  profile: WorkflowProfile,
): Promise<GatePolicy[]> {
  return Promise.all(profile.spec.policyIds.map((policyId) => loadPolicy(loopRootPath, policyId)));
}

export function packageLinkTarget(packageDocument: ChangePackage): {
  kind: "ChangePackage";
  id: string;
  revision: number;
  digest: ReturnType<typeof digestDocument>;
} {
  return {
    kind: "ChangePackage",
    id: packageDocument.metadata.id,
    revision: packageDocument.metadata.revision,
    digest: digestDocument(packageDocument),
  };
}

export function collectDocumentsSorted(documents: AnyDocument[]): AnyDocument[] {
  return [...documents].sort((left, right) => {
    const leftTime = Date.parse(left.metadata.updatedAt ?? left.metadata.createdAt);
    const rightTime = Date.parse(right.metadata.updatedAt ?? right.metadata.createdAt);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return `${left.kind}:${left.metadata.id}@${left.metadata.revision}`
      .localeCompare(`${right.kind}:${right.metadata.id}@${right.metadata.revision}`);
  });
}

export function parseContractFileName(fileName: string): { id: string; revision: number } | null {
  const match = fileName.match(/^(.+)@(\d+)\.(yaml|yml|json)$/i);
  if (!match?.[1] || !match[2]) return null;
  return { id: match[1], revision: Number(match[2]) };
}

export function isContractKindDocument(value: unknown): value is AnyDocument {
  return typeof value === "object" && value !== null && isContractKind((value as { kind?: string }).kind);
}
