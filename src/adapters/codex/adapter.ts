import { BaseRuntimeAdapter } from "../../skills/runtime/base-adapter.js";
import type { RuntimeExecutor } from "../../skills/contract/types.js";

export const CODEX_RUNTIME_ID = "codex";
export const CODEX_DEFAULT_MODEL = "codex";

export class CodexRuntimeAdapter extends BaseRuntimeAdapter {
  constructor(executor: RuntimeExecutor, modelId = CODEX_DEFAULT_MODEL) {
    super(executor, CODEX_RUNTIME_ID, modelId);
  }
}
