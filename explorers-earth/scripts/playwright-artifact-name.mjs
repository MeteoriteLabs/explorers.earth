function artifactPart(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unnamed";
}

const extensions = {
  screenshot: "png",
  trace: "zip",
  video: "webm",
};

export function deterministicFailureArtifactName({
  project,
  caseId,
  viewport,
  attempt,
  kind,
}) {
  const extension = extensions[kind];
  if (!extension) throw new Error(`UNSUPPORTED_ARTIFACT_KIND:${kind}`);
  return [
    artifactPart(project),
    artifactPart(caseId),
    `${viewport.width}x${viewport.height}`,
    `attempt-${attempt}`,
    artifactPart(kind),
  ].join("--") + `.${extension}`;
}
