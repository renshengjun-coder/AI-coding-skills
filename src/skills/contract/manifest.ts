import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { ArtifactType, Phase } from "../../kernel/contracts/vocabulary.js";
import { isPhase, PHASES } from "../../kernel/contracts/vocabulary.js";
import { skillsRoot, phaseSkillManifestPath } from "../paths.js";

export interface PhaseSkillManifest {
  apiVersion: "loop.dev/v1";
  kind: "PhaseSkill";
  metadata: {
    id: string;
    version: string;
    description?: string;
  };
  spec: {
    phase: Phase;
    outputArtifactType: ArtifactType;
    requiredContext: string[];
    optionalContext: string[];
    capabilities: string[];
    selfCheckRules: string[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validatePhaseSkillManifest(value: unknown, sourceName: string): PhaseSkillManifest {
  if (!isRecord(value)) throw new Error(`${sourceName}: manifest must be an object`);
  if (value.apiVersion !== "loop.dev/v1") throw new Error(`${sourceName}: apiVersion must be loop.dev/v1`);
  if (value.kind !== "PhaseSkill") throw new Error(`${sourceName}: kind must be PhaseSkill`);

  const metadata = value.metadata;
  if (!isRecord(metadata) || typeof metadata.id !== "string" || typeof metadata.version !== "string") {
    throw new Error(`${sourceName}: metadata.id and metadata.version are required`);
  }

  const spec = value.spec;
  if (!isRecord(spec) || !isPhase(spec.phase)) {
    throw new Error(`${sourceName}: spec.phase must be one of ${PHASES.join(", ")}`);
  }
  if (typeof spec.outputArtifactType !== "string") {
    throw new Error(`${sourceName}: spec.outputArtifactType is required`);
  }

  const stringArray = (field: string, key: string): string[] => {
    const items = spec[key];
    if (!Array.isArray(items) || items.some((item) => typeof item !== "string")) {
      throw new Error(`${sourceName}: spec.${field} must be a string array`);
    }
    return items;
  };

  return {
    apiVersion: "loop.dev/v1",
    kind: "PhaseSkill",
    metadata: {
      id: metadata.id,
      version: metadata.version,
      ...(typeof metadata.description === "string" ? { description: metadata.description } : {}),
    },
    spec: {
      phase: spec.phase as Phase,
      outputArtifactType: spec.outputArtifactType as ArtifactType,
      requiredContext: stringArray("requiredContext", "requiredContext"),
      optionalContext: stringArray("optionalContext", "optionalContext"),
      capabilities: stringArray("capabilities", "capabilities"),
      selfCheckRules: stringArray("selfCheckRules", "selfCheckRules"),
    },
  };
}

export async function loadPhaseSkillManifest(
  phase: Phase,
  workspaceRoot = process.cwd(),
): Promise<PhaseSkillManifest> {
  const path = phaseSkillManifestPath(workspaceRoot, phase);
  const content = await readFile(path, "utf8");
  const parsed = parse(content);
  const manifest = validatePhaseSkillManifest(parsed, path);
  if (manifest.spec.phase !== phase) {
    throw new Error(`${path}: manifest phase ${manifest.spec.phase} does not match requested ${phase}`);
  }
  return manifest;
}

export function defaultSkillsRoot(workspaceRoot = process.cwd()): string {
  return skillsRoot(workspaceRoot);
}
