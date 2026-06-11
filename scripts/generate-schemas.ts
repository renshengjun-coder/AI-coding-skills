import { mkdir, writeFile } from "node:fs/promises";
import { renderSchemas } from "../src/kernel/contracts/schemas.js";

const outputDirectory = ".loop/schemas/v1";
await mkdir(outputDirectory, { recursive: true });

for (const [filename, content] of Object.entries(renderSchemas())) {
  await writeFile(`${outputDirectory}/${filename}`, content, "utf8");
}
