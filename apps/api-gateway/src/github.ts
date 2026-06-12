import {
  GitHubCommit,
  GitHubPullRequest,
  listGitHubCommits,
  listGitHubPullRequests,
  listGitHubRepositories,
  replaceGitHubCommits,
  replaceGitHubPullRequests,
  upsertGitHubRepository,
} from './store';

const githubHeaders = () => {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'devpilot-ai-local',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
};

const githubJson = async <T>(url: string) => {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};

export const syncGitHubRepository = async (owner: string, repo: string) => {
  const [repository, commits, pullRequests] = await Promise.all([
    githubJson<any>(`https://api.github.com/repos/${owner}/${repo}`),
    githubJson<any[]>(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`),
    githubJson<any[]>(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10`),
  ]);

  const repositoryId = upsertGitHubRepository({
    owner,
    name: repo,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    stars: repository.stargazers_count,
    openIssues: repository.open_issues_count,
  });

  const normalizedCommits: GitHubCommit[] = commits.map((commit) => ({
    sha: commit.sha,
    repositoryId,
    message: commit.commit?.message || 'No commit message',
    author: commit.commit?.author?.name || commit.author?.login || 'Unknown',
    committedAt: commit.commit?.author?.date || new Date().toISOString(),
    url: commit.html_url,
  }));

  const normalizedPrs: GitHubPullRequest[] = pullRequests.map((pr) => ({
    id: String(pr.id),
    repositoryId,
    number: pr.number,
    title: pr.title,
    state: pr.merged_at ? 'merged' : pr.state,
    author: pr.user?.login || 'Unknown',
    createdAt: pr.created_at,
    mergedAt: pr.merged_at,
    url: pr.html_url,
  }));

  replaceGitHubCommits(repositoryId, normalizedCommits);
  replaceGitHubPullRequests(repositoryId, normalizedPrs);

  return githubSnapshot();
};

export const githubSnapshot = () => ({
  repositories: listGitHubRepositories(),
  commits: listGitHubCommits(),
  pullRequests: listGitHubPullRequests(),
});
