import { describe, expect, it } from "vitest";
import { loadDocument } from "../../src/kernel/io/load-document.js";

const validYaml = `
apiVersion: loop.dev/v1
kind: ChangePackage
metadata:
  id: CHG-TASK-0001
  revision: 1
  createdAt: 2026-06-11T00:00:00.000Z
spec:
  workItemType: development-task
  title: Build kernel
  owner: platform-team
  profileId: standard
  status: active
  relationships: []
`;

describe("loadDocument", () => {
  it("loads and validates YAML", () => {
    expect(loadDocument(validYaml, "package.yaml").metadata.id).toBe("CHG-TASK-0001");
  });

  it("loads and validates JSON", () => {
    const json = JSON.stringify(loadDocument(validYaml, "package.yaml"));

    expect(loadDocument(json, "package.json").kind).toBe("ChangePackage");
  });

  it("reports the source name when validation fails", () => {
    expect(() => loadDocument("kind: Other", "broken.yaml")).toThrow("broken.yaml");
  });

  it.each([
    ["JSON", '{"kind":', "broken.json"],
    ["YAML", "kind: [", "broken.yaml"],
  ])("reports the source name when %s parsing fails", (_format, content, sourceName) => {
    expect(() => loadDocument(content, sourceName)).toThrow(sourceName);
  });
});
