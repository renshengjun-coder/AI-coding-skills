import { ClaudeRuntimeAdapter } from "./claude/adapter.js";
import { CodexRuntimeAdapter } from "./codex/adapter.js";
import type { RuntimeAdapter, RuntimeExecutor } from "../skills/contract/types.js";

export type SupportedRuntimeId = "codex" | "claude";

const RUNTIME_IDS: SupportedRuntimeId[] = ["codex", "claude"];

export function isSupportedRuntimeId(value: string): value is SupportedRuntimeId {
  return RUNTIME_IDS.includes(value as SupportedRuntimeId);
}

export function createRuntimeAdapter(
  runtimeId: SupportedRuntimeId,
  executor: RuntimeExecutor,
  modelId?: string,
): RuntimeAdapter {
  switch (runtimeId) {
    case "codex":
      return new CodexRuntimeAdapter(executor, modelId);
    case "claude":
      return new ClaudeRuntimeAdapter(executor, modelId);
  }
}

export function supportedRuntimeIds(): SupportedRuntimeId[] {
  return [...RUNTIME_IDS];
}
