export interface CommandResult {
  code: number;
  output: string;
}

export function success(output = ""): CommandResult {
  return { code: 0, output };
}

export function failure(message: string, code = 1): CommandResult {
  return { code, output: message };
}
