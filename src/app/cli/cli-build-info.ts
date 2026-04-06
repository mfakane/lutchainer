declare const __BUILD_COMMIT_ID__: string;

function normalizeBuildCommitId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getBuildCommitId(): string | null {
  return normalizeBuildCommitId(__BUILD_COMMIT_ID__);
}

export function getCliBuildLabel(): string | null {
  const commitId = getBuildCommitId();
  return commitId ? `Build commit: ${commitId}` : null;
}
