import { packageDir } from "../../loop/paths.js";
import {
  allocatePackageId,
  ensurePackageLayout,
  resolveLoopRoot,
  savePackageDocument,
} from "../../loop/package-store.js";
import type { ChangePackage } from "../../kernel/contracts/types.js";
import type { ProfileTier } from "../../kernel/contracts/vocabulary.js";
import { failure, success, type CommandResult } from "../types.js";

const WORK_ITEM_TYPES = ["feature", "requirement", "bug-fix", "development-task"] as const;
const PROFILE_TIERS: ProfileTier[] = ["routine", "standard", "high-risk"];

export interface StartOptions {
  type: ChangePackage["spec"]["workItemType"];
  title: string;
  owner: string;
  profileId: ProfileTier;
  packageId?: string;
  baseDir?: string;
}

export async function runStart(options: StartOptions): Promise<CommandResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const packageId = options.packageId ?? await allocatePackageId(loopRootPath, options.type);
  const packagePath = packageDir(loopRootPath, packageId);
  await ensurePackageLayout(packagePath);

  const now = new Date().toISOString();
  const document: ChangePackage = {
    apiVersion: "loop.dev/v1",
    kind: "ChangePackage",
    metadata: { id: packageId, revision: 1, createdAt: now },
    spec: {
      workItemType: options.type,
      title: options.title,
      owner: options.owner,
      profileId: options.profileId,
      status: "active",
      relationships: [],
    },
  };

  const savedPath = await savePackageDocument(loopRootPath, packageId, document);
  return success(`Created package ${packageId} at ${savedPath}`);
}

export function parseWorkItemType(value: string): ChangePackage["spec"]["workItemType"] | null {
  return WORK_ITEM_TYPES.includes(value as ChangePackage["spec"]["workItemType"])
    ? value as ChangePackage["spec"]["workItemType"]
    : null;
}

export function parseProfileTier(value: string): ProfileTier | null {
  return PROFILE_TIERS.includes(value as ProfileTier) ? value as ProfileTier : null;
}

export function validateStartOptions(options: Partial<StartOptions>): CommandResult | null {
  if (!options.type || !parseWorkItemType(options.type)) {
    return failure(`invalid --type; expected one of: ${WORK_ITEM_TYPES.join(", ")}`);
  }
  if (!options.title?.trim()) return failure("--title is required");
  if (!options.owner?.trim()) return failure("--owner is required");
  if (!options.profileId || !parseProfileTier(options.profileId)) {
    return failure(`invalid --profile; expected one of: ${PROFILE_TIERS.join(", ")}`);
  }
  return null;
}
