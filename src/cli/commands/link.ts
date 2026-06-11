import type { PackageRelationship } from "../../kernel/contracts/vocabulary.js";
import {
  loadPackageBundle,
  packageLinkTarget,
  resolveLoopRoot,
  savePackageDocument,
} from "../../loop/package-store.js";
import { failure, success, type CommandResult } from "../types.js";

export interface LinkPackageOptions {
  fromPackageId: string;
  toPackageId: string;
  relation: PackageRelationship;
  baseDir?: string;
}

export async function runLinkPackage(options: LinkPackageOptions): Promise<CommandResult> {
  const loopRootPath = resolveLoopRoot(options.baseDir);
  const fromBundle = await loadPackageBundle(loopRootPath, options.fromPackageId);
  const toBundle = await loadPackageBundle(loopRootPath, options.toPackageId);
  const now = new Date().toISOString();

  const updatedPackage = {
    ...fromBundle.package,
    metadata: {
      ...fromBundle.package.metadata,
      revision: fromBundle.package.metadata.revision + 1,
      updatedAt: now,
    },
    spec: {
      ...fromBundle.package.spec,
      relationships: [
        ...fromBundle.package.spec.relationships,
        {
          relation: options.relation,
          target: packageLinkTarget(toBundle.package),
        },
      ],
    },
  };

  const path = await savePackageDocument(loopRootPath, options.fromPackageId, updatedPackage);
  return success(
    `Linked ${options.fromPackageId} -[${options.relation}]-> ${options.toPackageId}\n${path}\nNote: parent package revision changed; re-run downstream gates if needed.`,
  );
}
