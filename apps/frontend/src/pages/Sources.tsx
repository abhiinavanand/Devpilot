import { FormEvent, useEffect, useState } from 'react';
import {
  workspaceApi,
  type DoraMetrics,
  type GitHubCommit,
  type GitHubPullRequest,
  type GitHubRepository,
} from '../api/workspace';

export const Sources = () => {
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [dora, setDora] = useState<DoraMetrics | null>(null);
  const [owner, setOwner] = useState('facebook');
  const [repo, setRepo] = useState('react');
  const [message, setMessage] = useState('');

  const load = () => {
    workspaceApi.github().then((data) => {
      setRepositories(data.repositories);
      setCommits(data.commits);
      setPullRequests(data.pullRequests);
    });
    workspaceApi.dora().then(setDora);
  };

  useEffect(() => {
    load();
  }, []);

  const sync = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('Syncing GitHub data...');
    try {
      const data = await workspaceApi.syncGithub(owner, repo);
      setRepositories(data.repositories);
      setCommits(data.commits);
      setPullRequests(data.pullRequests);
      setMessage(`Synced ${owner}/${repo}`);
      workspaceApi.dora().then(setDora);
    } catch {
      setMessage('GitHub sync failed. Showing the existing local snapshot.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2>Data Sources</h2>
        <p className="subtle">GitHub API, DORA metrics, and persisted engineering signals stored in SQLite.</p>
      </div>

      <form className="card space-y-3" onSubmit={sync}>
        <h3>GitHub API Sync</h3>
        <div className="section">
          <input className="editor" style={{ minHeight: 'auto' }} value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="owner" />
          <input className="editor" style={{ minHeight: 'auto' }} value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="repo" />
        </div>
        <button className="toggle" type="submit">Sync repository</button>
        {message ? <p className="subtle">{message}</p> : null}
      </form>

      {dora ? (
        <div className="grid">
          <div className="card"><h3>Deploy Frequency</h3><p className="metric">{dora.deploymentFrequency}/day</p></div>
          <div className="card"><h3>Lead Time</h3><p className="metric">{dora.leadTimeHours}h</p></div>
          <div className="card"><h3>Change Failure</h3><p className="metric">{dora.changeFailureRate}%</p></div>
          <div className="card"><h3>MTTR</h3><p className="metric">{dora.mttrMinutes}m</p></div>
        </div>
      ) : null}

      <div className="section">
        <div className="card">
          <h3>Repositories</h3>
          <div className="timeline">
            {repositories.map((repository) => (
              <div className="timeline-item" key={repository.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{repository.fullName}</strong>
                  <p className="subtle">{repository.stars} stars · {repository.openIssues} open issues · {repository.defaultBranch}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Recent Commits</h3>
          <div className="timeline">
            {commits.slice(0, 6).map((commit) => (
              <div className="timeline-item" key={commit.sha}>
                <span className="timeline-dot" />
                <div>
                  <strong>{commit.message.split('\n')[0]}</strong>
                  <p className="subtle">{commit.author} · {new Date(commit.committedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Pull Requests</h3>
          <div className="timeline">
            {pullRequests.slice(0, 6).map((pr) => (
              <div className="timeline-item" key={pr.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>#{pr.number} {pr.title}</strong>
                  <p className="subtle">{pr.state} · {pr.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
