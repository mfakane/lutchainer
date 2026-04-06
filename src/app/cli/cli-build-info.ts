import { getBuildCommitId } from '../../shared/build-info.ts';

export { getBuildCommitId } from '../../shared/build-info.ts';

export function getCliBuildLabel(): string | null {
  const commitId = getBuildCommitId();
  return commitId ? `Build commit: ${commitId}` : null;
}
