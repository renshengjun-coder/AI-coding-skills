export type VerifyMode = "enforce" | "report-only";

export interface VerifyIssue {
  ruleId: string;
  message: string;
  blocking: boolean;
}

export interface PackageVerifyResult {
  packageId: string;
  passed: boolean;
  issues: VerifyIssue[];
}

export interface VerifyReport {
  mode: VerifyMode;
  results: PackageVerifyResult[];
  passed: boolean;
}
