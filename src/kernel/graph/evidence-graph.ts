import { digestDocument } from "../canonical/canonicalize.js";
import {
  documentKey,
  type AnyDocument,
  type ChangePackage,
  type Digest,
  type EvidenceRef,
} from "../contracts/types.js";

export interface GraphIssue {
  ruleId: "duplicate-document" | "unresolved-reference" | "digest-mismatch" | "missing-package" | "package-cycle";
  documentKey: string;
  message: string;
}

export interface EvidenceGraph {
  byKey: Map<string, AnyDocument>;
  duplicates: string[];
}

export function evidenceRefKey(reference: Pick<EvidenceRef, "kind" | "id" | "revision">): string {
  return `${reference.kind}:${reference.id}@${reference.revision}`;
}

export function buildEvidenceGraph(documents: AnyDocument[]): EvidenceGraph {
  const byKey = new Map<string, AnyDocument>();
  const duplicates: string[] = [];
  for (const document of documents) {
    const key = documentKey(document);
    if (byKey.has(key)) duplicates.push(key);
    else byKey.set(key, document);
  }
  return { byKey, duplicates };
}

function referencesFrom(document: AnyDocument): EvidenceRef[] {
  switch (document.kind) {
    case "ChangePackage":
      return document.spec.relationships.map((link) => link.target);
    case "ArtifactEnvelope":
      return [
        ...document.spec.inputs,
        ...document.spec.outputs,
        ...document.spec.trace.flatMap((edge) => [edge.source, edge.target]),
      ];
    case "Finding":
      return [...document.spec.affectedEvidence, ...(document.spec.resolutionEvidence ?? [])];
    case "Waiver":
      return document.spec.scope;
    case "GateAttempt":
      return [
        ...document.spec.boundEvidence,
        ...document.spec.evaluations.flatMap((evaluation) => evaluation.evidence),
      ];
    default:
      return [];
  }
}

/** Artifact trace edges bind content digests; other documents bind full revision digests. */
export function digestForEvidenceReference(document: AnyDocument): Digest {
  if (document.kind === "ArtifactEnvelope") {
    return document.spec.content.digest;
  }
  return digestDocument(document);
}

function packageCycleIssues(documents: ChangePackage[]): GraphIssue[] {
  const edges = new Map<string, string[]>();
  for (const document of documents) {
    const children = document.spec.relationships
      .filter((link) => link.relation === "decomposes-into")
      .map((link) => link.target.id);
    edges.set(document.metadata.id, children);
  }

  const issues: GraphIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visiting.has(id)) {
      issues.push({
        ruleId: "package-cycle",
        documentKey: id,
        message: `package decomposition cycle reaches ${id}`,
      });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of edges.get(id) ?? []) visit(child);
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of edges.keys()) visit(id);
  return issues;
}

export function validateGraphIntegrity(documents: AnyDocument[]): GraphIssue[] {
  const graph = buildEvidenceGraph(documents);
  const packageIds = new Set(documents
    .filter((document) => document.kind === "ChangePackage")
    .map((document) => document.metadata.id));
  const issues: GraphIssue[] = graph.duplicates.map((key) => ({
    ruleId: "duplicate-document",
    documentKey: key,
    message: `duplicate exact document revision ${key}`,
  }));

  for (const document of documents) {
    if ("packageId" in document.spec && !packageIds.has(document.spec.packageId)) {
      issues.push({
        ruleId: "missing-package",
        documentKey: documentKey(document),
        message: `owning package ${document.spec.packageId} is missing`,
      });
    }
    for (const reference of referencesFrom(document)) {
      const referenced = graph.byKey.get(evidenceRefKey(reference));
      if (!referenced) {
        issues.push({
          ruleId: "unresolved-reference",
          documentKey: documentKey(document),
          message: `unresolved reference ${evidenceRefKey(reference)}`,
        });
      } else if (digestForEvidenceReference(referenced) !== reference.digest) {
        issues.push({
          ruleId: "digest-mismatch",
          documentKey: documentKey(document),
          message: `digest mismatch for ${evidenceRefKey(reference)}`,
        });
      }
    }
  }

  return [
    ...issues,
    ...packageCycleIssues(documents.filter((document): document is ChangePackage =>
      document.kind === "ChangePackage")),
  ];
}
