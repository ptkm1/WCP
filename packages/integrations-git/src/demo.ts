import { buildDashboardData } from "@wcp/application";
import { getRepositoryIdentityBundle, listRepositories } from "@wcp/db";
import { getGitIdentitySnapshot } from "./index";

export interface RepositoryGuardrailDemo {
  repositoryName: string;
  localPath: string | null;
  validationStatus: string | null;
}

export function buildRepositoryGuardrailDemo(
  workItems: Parameters<typeof buildDashboardData>[0]["workItems"],
  dependencies: Parameters<typeof buildDashboardData>[0]["dependencies"],
): RepositoryGuardrailDemo | null {
  const repository = listRepositories().find((entry) =>
    Boolean(entry.localPath),
  );

  if (!repository?.localPath) {
    return null;
  }

  const bundle = getRepositoryIdentityBundle(repository.id);

  if (!bundle?.identity) {
    return null;
  }

  const snapshot = getGitIdentitySnapshot(repository.localPath);
  const profile = bundle.profile;
  const dashboard = buildDashboardData({
    workItems,
    dependencies,
    currentTask: workItems[0],
    repositorySnapshot: snapshot,
    repositoryIdentity: bundle.identity,
    environmentProfile: profile,
    repository: bundle.repository,
  });

  return {
    repositoryName: repository.name,
    localPath: repository.localPath,
    validationStatus: dashboard.identityValidation?.status ?? null,
  };
}
