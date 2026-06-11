import { join } from "node:path";
import { validateSkillInvocationResult } from "../contract/validate-invocation.js";
import { buildSkillInvocationResult, parseStructuredOutput } from "../contract/build-result.js";
import type {
  RuntimeAdapter,
  RuntimeExecutor,
  RuntimeIdentity,
  RuntimeRequest,
  RuntimeResponse,
  SkillInvocationInput,
  SkillInvocationResult,
} from "../contract/types.js";

export abstract class BaseRuntimeAdapter implements RuntimeAdapter {
  constructor(
    protected readonly executor: RuntimeExecutor,
    public readonly runtimeId: string,
    protected readonly defaultModelId: string,
  ) {}

  async invoke(input: SkillInvocationInput): Promise<SkillInvocationResult> {
    const request = this.buildRequest(input);
    const response = await this.executor.execute(request);
    const runtime = this.runtimeIdentity(input, response);

    if (response.status === "error") {
      return {
        status: "error",
        runtime,
        findings: [],
        suggestedTrace: [],
        selfCheck: {
          result: "error",
          ruleIds: input.skill.spec.selfCheckRules,
          messages: [response.error ?? "runtime execution failed"],
        },
        error: response.error ?? "runtime execution failed",
      };
    }

    try {
      const structured = response.structuredOutput
        ?? parseStructuredOutput(JSON.parse(response.rawOutput ?? ""));
      const artifactRelativePath = structured.artifactRelativePath;
      const artifactContentPath = join(
        ".loop/packages",
        input.context.package.metadata.id,
        "artifacts",
        artifactRelativePath,
      );
      const built = buildSkillInvocationResult(
        input.skill,
        input.context,
        runtime,
        structured,
        artifactContentPath,
      );

      const result: SkillInvocationResult = {
        status: "success",
        runtime,
        artifactMarkdown: structured.artifactMarkdown,
        artifactContentPath,
        envelope: built.envelope,
        findings: built.findings,
        suggestedTrace: built.suggestedTrace,
        selfCheck: built.selfCheck,
      };

      const issues = validateSkillInvocationResult(result);
      if (issues.length > 0) {
        return {
          status: "error",
          runtime,
          findings: [],
          suggestedTrace: [],
          selfCheck: {
            result: "error",
            ruleIds: input.skill.spec.selfCheckRules,
            messages: issues.map((issue) => issue.message),
          },
          error: issues.map((issue) => issue.message).join("; "),
        };
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        runtime,
        findings: [],
        suggestedTrace: [],
        selfCheck: {
          result: "error",
          ruleIds: input.skill.spec.selfCheckRules,
          messages: [message],
        },
        error: message,
      };
    }
  }

  protected buildRequest(input: SkillInvocationInput): RuntimeRequest {
    const { skill, context } = input;
    const packageSummary = JSON.stringify({
      id: context.package.metadata.id,
      title: context.package.spec.title,
      profileId: context.package.spec.profileId,
      workItemType: context.package.spec.workItemType,
    });
    const artifactSummaries = context.documents
      .filter((document) => document.kind === "ArtifactEnvelope")
      .map((document) => ({
        id: document.metadata.id,
        phase: document.spec.phase,
        artifactType: document.spec.artifactType,
      }));

    return {
      runtime: this.runtimeId,
      modelId: this.defaultModelId,
      skillId: skill.metadata.id,
      skillPhase: skill.spec.phase,
      systemPrompt: [
        `You are the ${skill.metadata.id} phase skill (version ${skill.metadata.version}).`,
        `Produce structured JSON matching skill-structured-output-v1.`,
        `Output artifact type: ${skill.spec.outputArtifactType}.`,
        `Self-check rules: ${skill.spec.selfCheckRules.join(", ")}.`,
      ].join("\n"),
      userPrompt: [
        `Package: ${packageSummary}`,
        `Upstream artifacts: ${JSON.stringify(artifactSummaries)}`,
        `Phase: ${skill.spec.phase}`,
      ].join("\n"),
      capabilities: skill.spec.capabilities,
      workspaceRoot: context.workspaceRoot,
      responseSchema: "skill-structured-output-v1",
    };
  }

  protected runtimeIdentity(input: SkillInvocationInput, response: RuntimeResponse): RuntimeIdentity {
    return {
      runtime: this.runtimeId,
      actor: input.context.actor,
      ...(response.modelId ?? this.defaultModelId
        ? { modelId: response.modelId ?? this.defaultModelId }
        : {}),
    };
  }
}
