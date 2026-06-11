export const DEFAULT_MAX_REVISION_ATTEMPTS = 3;
export const DEFAULT_NO_PROGRESS_REPEAT_COUNT = 2;

export interface LoopSafetyConfig {
  maxRevisionAttempts: number;
  noProgressRepeatCount: number;
}

export const DEFAULT_LOOP_SAFETY: LoopSafetyConfig = {
  maxRevisionAttempts: DEFAULT_MAX_REVISION_ATTEMPTS,
  noProgressRepeatCount: DEFAULT_NO_PROGRESS_REPEAT_COUNT,
};
