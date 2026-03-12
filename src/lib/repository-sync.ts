export function getStaleRepositoryIds(input: {
  persistedRepositories: Array<{
    id: string;
    githubRepoId: number;
  }>;
  githubRepositoryIds: number[];
}) {
  const activeRepositoryIds = new Set(input.githubRepositoryIds);

  return input.persistedRepositories
    .filter((repository) => !activeRepositoryIds.has(repository.githubRepoId))
    .map((repository) => repository.id);
}
