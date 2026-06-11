import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createTestLoopRoot(): Promise<string> {
  const temp = await mkdtemp(join(tmpdir(), "loop-test-"));
  const sourceLoop = join(process.cwd(), ".loop");
  await cp(join(sourceLoop, "profiles"), join(temp, "profiles"), { recursive: true });
  await cp(join(sourceLoop, "policies"), join(temp, "policies"), { recursive: true });
  await cp(join(sourceLoop, "schemas"), join(temp, "schemas"), { recursive: true });
  return temp;
}
