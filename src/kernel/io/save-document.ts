import { stringify } from "yaml";
import type { AnyDocument } from "../contracts/types.js";

export function serializeDocument(document: AnyDocument): string {
  return stringify(document).trimEnd() + "\n";
}
