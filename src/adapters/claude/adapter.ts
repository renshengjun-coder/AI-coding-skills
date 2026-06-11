import { BaseRuntimeAdapter } from "../../skills/runtime/base-adapter.js";
import type { RuntimeExecutor } from "../../skills/contract/types.js";

export const CLAUDE_RUNTIME_ID = "claude";
export const CLAUDE_DEFAULT_MODEL = "claude-sonnet";

export class ClaudeRuntimeAdapter extends BaseRuntimeAdapter {
  constructor(executor: RuntimeExecutor, modelId = CLAUDE_DEFAULT_MODEL) {
    super(executor, CLAUDE_RUNTIME_ID, modelId);
  }
}
