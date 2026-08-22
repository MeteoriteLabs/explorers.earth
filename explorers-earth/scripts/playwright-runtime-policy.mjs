export function playwrightRuntimePolicy({ project, reuseRequested }) {
  const protectedProject = project === "real-account";
  return {
    reuseExistingServer: protectedProject ? false : reuseRequested === true,
    stdout: protectedProject ? "ignore" : "pipe",
    stderr: protectedProject ? "ignore" : "pipe",
  };
}
