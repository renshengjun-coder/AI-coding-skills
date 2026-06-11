import { describe, expect, it } from "vitest";
import { createRuntimeAdapter } from "../../src/adapters/registry.js";
import { changePackage } from "../fixtures/builders.js";
import { loadPhaseSkillManifest } from "../../src/skills/contract/manifest.js";
import { validateSkillInvocationResult } from "../../src/skills/contract/validate-invocation.js";
import type { RuntimeExecutor, RuntimeRequest, RuntimeResponse } from "../../src/skills/contract/types.js";

class RecordingExecutor implements RuntimeExecutor {
  public lastRequest?: RuntimeRequest;

  constructor(private readonly response: RuntimeResponse) {}

  async execute(request: RuntimeRequest): Promise<RuntimeResponse> {
    this.lastRequest = request;
    return this.response;
  }
}

const successResponse: RuntimeResponse = {
  status: "success",
  modelId: "test-model",
  structuredOutput: {
    artifactMarkdown: "# Requirements\n\nAcceptance criteria are measurable.",
    artifactRelativePath: "requirements.md",
    selfCheck: { result: "pass", messages: ["complete"] },
    findings: [],
    traceSuggestions: [],
  },
};

describe("runtime adapter conformance", () => {
  it.each(["codex", "claude"] as const)("%s adapter returns a valid invocation result", async (runtimeId) => {
    const recording = new RecordingExecutor(successResponse);
    const adapter = createRuntimeAdapter(runtimeId, recording);
    const skill = await loadPhaseSkillManifest("requirements");

    const result = await adapter.invoke({
      skill,
      context: {
        workspaceRoot: process.cwd(),
        loopRoot: `${process.cwd()}/.loop`,
        package: changePackage(),
        documents: [changePackage()],
        phase: "requirements",
        actor: "conformance-test",
      },
    });

    expect(result.status).toBe("success");
    expect(result.runtime.runtime).toBe(runtimeId);
    expect(result.envelope?.spec.producer.runtime).toBe(runtimeId);
    expect(validateSkillInvocationResult(result)).toEqual([]);
    expect(recording.lastRequest?.runtime).toBe(runtimeId);
    expect(recording.lastRequest?.responseSchema).toBe("skill-structured-output-v1");
  });

  it("maps runtime errors to error invocation results", async () => {
    const recording = new RecordingExecutor({ status: "error", error: "model unavailable" });
    const adapter = createRuntimeAdapter("codex", recording);
    const skill = await loadPhaseSkillManifest("requirements");
    const result = await adapter.invoke({
      skill,
      context: {
        workspaceRoot: process.cwd(),
        loopRoot: `${process.cwd()}/.loop`,
        package: changePackage(),
        documents: [changePackage()],
        phase: "requirements",
        actor: "test",
      },
    });
    expect(result.status).toBe("error");
    expect(result.selfCheck.result).toBe("error");
    expect(result.error).toContain("model unavailable");
  });
});
