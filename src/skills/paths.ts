import { join } from "node:path";
import type { Phase } from "../kernel/contracts/vocabulary.js";

export const SKILLS_DIR = "skills";

export function skillsRoot(workspaceRoot = process.cwd()): string {
  return join(workspaceRoot, SKILLS_DIR);
}

export function phaseSkillDir(workspaceRoot: string, phase: Phase): string {
  return join(skillsRoot(workspaceRoot), "phases", phase);
}

export function phaseSkillManifestPath(workspaceRoot: string, phase: Phase): string {
  return join(phaseSkillDir(workspaceRoot, phase), "SKILL.yaml");
}

export function adaptersRoot(workspaceRoot = process.cwd()): string {
  return join(workspaceRoot, "adapters");
}
