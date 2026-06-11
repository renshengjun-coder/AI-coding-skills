import type { PhaseSkillManifest } from "../contract/manifest.js";
import type {
  RuntimeExecutor,
  RuntimeRequest,
  RuntimeResponse,
  SkillInvocationContext,
} from "../contract/types.js";
import { runDedicatedPhaseSkill } from "../phases/run-phase-skill.js";

export class PhaseSkillExecutor implements RuntimeExecutor {
  constructor(
    private readonly context: SkillInvocationContext,
    private readonly skill: PhaseSkillManifest,
  ) {}

  async execute(request: RuntimeRequest): Promise<RuntimeResponse> {
    try {
      const structuredOutput = runDedicatedPhaseSkill(this.skill, this.context);
      return {
        status: "success",
        modelId: request.modelId ?? `local-${this.skill.metadata.id}`,
        structuredOutput,
      };
    } catch (error) {
      return {
        status: "error",
        modelId: request.modelId ?? `local-${this.skill.metadata.id}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export function createPhaseSkillExecutor(
  context: SkillInvocationContext,
  skill: PhaseSkillManifest,
): RuntimeExecutor {
  return new PhaseSkillExecutor(context, skill);
}
