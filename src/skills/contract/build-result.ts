import { sha256Digest } from "../../kernel/canonical/canonicalize.js";
import type { ArtifactEnvelope, Finding, TraceEdge } from "../../kernel/contracts/types.js";
import type { PhaseSkillManifest } from "./manifest.js";
import type {
  RuntimeIdentity,
  SelfCheckReport,
  SkillInvocationContext,
  SkillStructuredOutput,
} from "./types.js";
import {
  nextDocumentRevision,
  nextSequentialId,
} from "../../loop/package-store.js";

export function buildSkillInvocationResult(
  skill: PhaseSkillManifest,
  context: SkillInvocationContext,
  runtime: RuntimeIdentity,
  structured: SkillStructuredOutput,
  artifactContentPath: string,
): {
  envelope: ArtifactEnvelope;
  findings: Finding[];
  suggestedTrace: TraceEdge[];
  selfCheck: SelfCheckReport;
} {
  const packageId = context.package.metadata.id;
  const phase = skill.spec.phase;
  const now = new Date().toISOString();
  const artifactId = nextSequentialId(context.documents, "ArtifactEnvelope", "ART");
  const artifactRevision = nextDocumentRevision(context.documents, "ArtifactEnvelope", artifactId);
  const contentDigest = sha256Digest(structured.artifactMarkdown);

  const findings: Finding[] = [];
  for (const item of structured.findings) {
    const findingId = nextSequentialId([...context.documents, ...findings], "Finding", "FND");
    findings.push({
      apiVersion: "loop.dev/v1",
      kind: "Finding",
      metadata: { id: findingId, revision: 1, createdAt: now },
      spec: {
        packageId,
        phase,
        sourceEvaluator: skill.metadata.id,
        ruleId: item.ruleId,
        severity: item.severity,
        status: "open",
        message: item.message,
        affectedEvidence: [],
        recommendedAction: item.recommendedAction,
      },
    });
  }
  const findingIds = findings.map((finding) => finding.metadata.id);

  const envelope: ArtifactEnvelope = {
    apiVersion: "loop.dev/v1",
    kind: "ArtifactEnvelope",
    metadata: { id: artifactId, revision: artifactRevision, createdAt: now },
    spec: {
      packageId,
      phase,
      artifactType: skill.spec.outputArtifactType,
      content: { path: artifactContentPath, digest: contentDigest },
      producer: {
        skill: skill.metadata.id,
        skillVersion: skill.metadata.version,
        runtime: runtime.runtime,
        actor: runtime.actor,
        ...(runtime.modelId ? { modelId: runtime.modelId } : {}),
      },
      inputs: [],
      outputs: [],
      trace: [],
      selfCheck: {
        result: structured.selfCheck.result,
        findingIds,
      },
    },
  };

  const artifactIndex = new Map(
    context.documents
      .filter((document) => document.kind === "ArtifactEnvelope")
      .map((document) => [document.metadata.id, document]),
  );

  const envelopeRef = {
    kind: "ArtifactEnvelope" as const,
    id: envelope.metadata.id,
    revision: envelope.metadata.revision,
    digest: envelope.spec.content.digest,
  };

  const suggestedTrace: TraceEdge[] = [];
  for (const suggestion of structured.traceSuggestions) {
    const upstream = artifactIndex.get(suggestion.upstreamArtifactId);
    if (!upstream || upstream.kind !== "ArtifactEnvelope") {
      continue;
    }
    suggestedTrace.push({
      relation: suggestion.relation,
      source: envelopeRef,
      target: {
        kind: "ArtifactEnvelope",
        id: upstream.metadata.id,
        revision: upstream.metadata.revision,
        digest: upstream.spec.content.digest,
      },
    });
  }

  if (suggestedTrace.length > 0) {
    envelope.spec.trace = suggestedTrace;
  }

  const selfCheck: SelfCheckReport = {
    result: structured.selfCheck.result,
    ruleIds: skill.spec.selfCheckRules,
    messages: structured.selfCheck.messages,
  };

  return { envelope, findings, suggestedTrace, selfCheck };
}

export function parseStructuredOutput(value: unknown): SkillStructuredOutput {
  if (!value || typeof value !== "object") {
    throw new Error("structured output must be an object");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.artifactMarkdown !== "string" || typeof record.artifactRelativePath !== "string") {
    throw new Error("structured output requires artifactMarkdown and artifactRelativePath");
  }
  const selfCheck = record.selfCheck;
  if (!selfCheck || typeof selfCheck !== "object") {
    throw new Error("structured output requires selfCheck");
  }
  const selfCheckRecord = selfCheck as Record<string, unknown>;
  if (
    selfCheckRecord.result !== "pass" &&
    selfCheckRecord.result !== "fail" &&
    selfCheckRecord.result !== "error"
  ) {
    throw new Error("selfCheck.result must be pass, fail, or error");
  }
  const messages = selfCheckRecord.messages;
  if (!Array.isArray(messages) || messages.some((item) => typeof item !== "string")) {
    throw new Error("selfCheck.messages must be a string array");
  }

  const findings = Array.isArray(record.findings) ? record.findings : [];
  const parsedFindings = findings.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`findings[${index}] must be an object`);
    const finding = item as Record<string, unknown>;
    if (typeof finding.ruleId !== "string" || typeof finding.message !== "string") {
      throw new Error(`findings[${index}] requires ruleId and message`);
    }
    const severity = finding.severity;
    if (severity !== "info" && severity !== "warning" && severity !== "blocking") {
      throw new Error(`findings[${index}].severity is invalid`);
    }
    return {
      ruleId: finding.ruleId,
      severity: severity as "info" | "warning" | "blocking",
      message: finding.message,
      recommendedAction: typeof finding.recommendedAction === "string"
        ? finding.recommendedAction
        : "Review and revise the artifact.",
    };
  });

  const traceSuggestions = Array.isArray(record.traceSuggestions) ? record.traceSuggestions : [];
  const parsedTrace = traceSuggestions.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`traceSuggestions[${index}] must be an object`);
    const edge = item as Record<string, unknown>;
    if (typeof edge.relation !== "string" || typeof edge.upstreamArtifactId !== "string") {
      throw new Error(`traceSuggestions[${index}] requires relation and upstreamArtifactId`);
    }
    return {
      relation: edge.relation as SkillStructuredOutput["traceSuggestions"][number]["relation"],
      upstreamArtifactId: edge.upstreamArtifactId,
    };
  });

  return {
    artifactMarkdown: record.artifactMarkdown,
    artifactRelativePath: record.artifactRelativePath,
    selfCheck: {
      result: selfCheckRecord.result as "pass" | "fail" | "error",
      messages: messages as string[],
    },
    findings: parsedFindings,
    traceSuggestions: parsedTrace,
  };
}
