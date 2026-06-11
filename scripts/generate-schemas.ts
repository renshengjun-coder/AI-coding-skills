import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderSchemas } from "../src/kernel/contracts/schemas.js";

export async function generateSchemas(outputDirectory = ".loop/schemas/v1"): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });

  const rendered = renderSchemas();
  const expectedFilenames = new Set(Object.keys(rendered));
  const existingFilenames = (await readdir(outputDirectory)).sort();

  for (const filename of existingFilenames) {
    if (filename.endsWith(".schema.json") && !expectedFilenames.has(filename)) {
      await unlink(join(outputDirectory, filename));
    }
  }

  const renderedEntries = Object.entries(rendered).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [filename, content] of renderedEntries) {
    await writeFile(join(outputDirectory, filename), content, "utf8");
  }
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href) {
  await generateSchemas();
}
