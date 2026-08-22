export interface PlaywrightRuntimePolicyInput {
  project: string;
  reuseRequested: boolean;
}

export interface PlaywrightRuntimePolicy {
  reuseExistingServer: boolean;
  stdout: "pipe" | "ignore";
  stderr: "pipe" | "ignore";
}

export function playwrightRuntimePolicy(
  input: PlaywrightRuntimePolicyInput,
): PlaywrightRuntimePolicy;
