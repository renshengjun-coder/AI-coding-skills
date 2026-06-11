import { relative } from "node:path";

const PACKAGE_PATH_PATTERN = /(?:^|\/)\.loop\/packages\/([^/]+)\//;

export function discoverPackageIdsFromPaths(paths: string[]): string[] {
  const ids = new Set<string>();
  for (const path of paths) {
    const normalized = path.replace(/\\/g, "/");
    const match = normalized.match(PACKAGE_PATH_PATTERN);
    if (match?.[1]) ids.add(match[1]);
  }
  return [...ids].sort();
}

export function discoverPackageIdsFromDiffText(diffText: string, baseDir = ""): string[] {
  const paths: string[] = [];
  for (const line of diffText.split("\n")) {
    if (!line.startsWith("+++ ") && !line.startsWith("--- ") && !line.startsWith("diff --git")) {
      continue;
    }
    if (line.startsWith("diff --git")) {
      const parts = line.split(" ");
      const right = parts[3]?.replace(/^b\//, "");
      if (right) paths.push(baseDir ? relative(baseDir, right) : right);
      continue;
    }
    const path = line.slice(4).trim().replace(/^(a|b)\//, "");
    if (path !== "/dev/null") paths.push(baseDir ? relative(baseDir, path) : path);
  }
  return discoverPackageIdsFromPaths(paths);
}
