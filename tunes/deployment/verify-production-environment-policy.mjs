import { pathToFileURL } from "node:url";

const environmentName = "tunes-production";
const mainRef = "refs/heads/main";

function required(environment, name) {
  const value = environment[name];
  if (!value || value.includes("\n") || value.includes("\r")) throw new Error(`invalid ${name}`);
  return value;
}

async function readJson(request, url, token) {
  const response = await request(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  });
  if (!response.ok) throw new Error("GitHub production policy preflight unavailable");
  try {
    return await response.json();
  } catch {
    throw new Error("GitHub production policy preflight returned invalid JSON");
  }
}

export async function verifyProductionEnvironmentPolicy({ environment = process.env, request = fetch } = {}) {
  if (environment.GITHUB_REF !== mainRef) throw new Error("main ref required before production environment access");
  const repository = required(environment, "GITHUB_REPOSITORY");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("invalid GITHUB_REPOSITORY");
  const apiUrl = required(environment, "GITHUB_API_URL");
  const parsedApiUrl = new URL(apiUrl);
  if (parsedApiUrl.protocol !== "https:" || parsedApiUrl.username || parsedApiUrl.password || parsedApiUrl.search || parsedApiUrl.hash) {
    throw new Error("invalid GITHUB_API_URL");
  }
  const token = required(environment, "GH_TOKEN");
  const base = parsedApiUrl.href.replace(/\/$/, "");
  const environmentUrl = `${base}/repos/${repository}/environments/${environmentName}`;
  const environmentPolicy = await readJson(request, environmentUrl, token);
  const protectedBranches = await readJson(request, `${base}/repos/${repository}/branches?protected=true&per_page=100`, token);
  const branch = await readJson(request, `${base}/repos/${repository}/branches/main`, token);
  const policy = environmentPolicy?.deployment_branch_policy;
  const onlyProtectedMain = Array.isArray(protectedBranches)
    && protectedBranches.length === 1
    && protectedBranches[0]?.name === "main"
    && protectedBranches[0]?.protected === true;
  if (policy?.protected_branches !== true
    || policy?.custom_branch_policies !== false
    || !onlyProtectedMain
    || branch?.name !== "main"
    || branch?.protected !== true) {
    throw new Error("protected-main production policy required");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyProductionEnvironmentPolicy().catch((error) => {
    console.error(error instanceof Error ? error.message : "production policy preflight failed");
    process.exitCode = 1;
  });
}
