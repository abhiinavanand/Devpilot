"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubSnapshot = exports.syncGitHubRepository = void 0;
const store_1 = require("./store");
const githubHeaders = () => {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'devpilot-ai-local',
    };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
};
const githubJson = async (url) => {
    const response = await fetch(url, { headers: githubHeaders() });
    if (!response.ok) {
        throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
};
const syncGitHubRepository = async (owner, repo) => {
    const [repository, commits, pullRequests] = await Promise.all([
        githubJson(`https://api.github.com/repos/${owner}/${repo}`),
        githubJson(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`),
        githubJson(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10`),
    ]);
    const repositoryId = (0, store_1.upsertGitHubRepository)({
        owner,
        name: repo,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch,
        stars: repository.stargazers_count,
        openIssues: repository.open_issues_count,
    });
    const normalizedCommits = commits.map((commit) => ({
        sha: commit.sha,
        repositoryId,
        message: commit.commit?.message || 'No commit message',
        author: commit.commit?.author?.name || commit.author?.login || 'Unknown',
        committedAt: commit.commit?.author?.date || new Date().toISOString(),
        url: commit.html_url,
    }));
    const normalizedPrs = pullRequests.map((pr) => ({
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
    (0, store_1.replaceGitHubCommits)(repositoryId, normalizedCommits);
    (0, store_1.replaceGitHubPullRequests)(repositoryId, normalizedPrs);
    return (0, exports.githubSnapshot)();
};
exports.syncGitHubRepository = syncGitHubRepository;
const githubSnapshot = () => ({
    repositories: (0, store_1.listGitHubRepositories)(),
    commits: (0, store_1.listGitHubCommits)(),
    pullRequests: (0, store_1.listGitHubPullRequests)(),
});
exports.githubSnapshot = githubSnapshot;
