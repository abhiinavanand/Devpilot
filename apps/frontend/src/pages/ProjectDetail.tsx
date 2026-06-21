import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Boxes, Copy, ExternalLink, FolderKanban, Gauge, GitBranch, Link2, Plus, ShieldAlert, Siren, Trash2, UserPlus, Users, Waypoints, type LucideIcon } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { absoluteApiUrl } from '../api/client';
import { workspaceApi, type Deployment, type Incident, type Priority, type Project, type ProjectHealthCheck, type ProjectMember, type ProjectRole, type Task, type TaskStatus } from '../api/workspace';
import { useRealtimeListener } from '../api/realtime';

const tabs = ['Summary', 'Issues', 'Board', 'Releases', 'Incidents', 'Analytics', 'Monitoring'] as const;
const statuses: Array<{ id: TaskStatus; title: string }> = [
  { id: 'TODO', title: 'Todo' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'REVIEW', title: 'Review' },
  { id: 'DONE', title: 'Done' },
];
const defaultGrafanaUrl = (() => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:3001' : '';
})();
const grafanaUrl = import.meta.env.VITE_OPEN_GRAFANA_URL || defaultGrafanaUrl;
const deploymentProviders: Deployment['provider'][] = ['Manual', 'Vercel', 'GitHub Actions', 'Railway', 'Render', 'Other'];
const deploymentPlatforms: Project['deploymentPlatform'][] = ['GitHub Pages', 'Vercel', 'Railway', 'Render', 'Other'];
const projectRoles: ProjectRole[] = ['owner', 'admin', 'member', 'viewer'];
const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('devpilot.user') || 'null') as { name?: string; email?: string } | null;
  } catch {
    return null;
  }
};
const normalizeUrlInput = (value: string) => {
  const trimmed = value.trim();
  return trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
};
const detectDeploymentPlatform = (value: string): Project['deploymentPlatform'] => {
  try {
    const hostname = new URL(normalizeUrlInput(value)).hostname.toLowerCase();
    if (hostname.endsWith('github.io')) return 'GitHub Pages';
    if (hostname.endsWith('vercel.app')) return 'Vercel';
    if (hostname.includes('railway.app') || hostname.includes('up.railway.app')) return 'Railway';
    if (hostname.endsWith('onrender.com')) return 'Render';
  } catch {
    return 'Other';
  }
  return 'Other';
};
const providerInstructions: Record<Project['deploymentPlatform'], string> = {
  'GitHub Pages': 'GitHub setup: Repository Settings, Webhooks, Add webhook, paste this URL, choose application/json, then enable push and page_build events.',
  Vercel: 'Vercel setup: Project Settings, Webhooks, Add webhook, paste this URL, then select deployment events.',
  Railway: 'Railway setup: Project Settings, Webhooks, Add webhook, paste this URL, then enable deployment events.',
  Render: 'Render setup: Service Settings, Notifications or outgoing webhook, paste this URL, then enable deploy succeeded and deploy failed events.',
  Other: 'If your platform supports outgoing webhooks, paste this URL and send deployment status, commit, branch, and environment details to DevPilot.',
};
const projectCode = (project: Project) => project.projectKey || 'PROJ';
const issueKey = (project: Project, task: Task, index: number) => `${projectCode(project)}-${index + 1}`;
const priorityTone = (priority: Priority) => {
  if (priority === 'Critical') return 'priority-critical';
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
};
const webhookPlatformSlug = (platform: Project['deploymentPlatform']) => {
  if (platform === 'GitHub Pages') return 'github-pages';
  return platform.toLowerCase();
};
const resolveDeploymentLink = (project: Project, deployment: Deployment) => {
  if (!project.appUrl && !deployment.deploymentUrl) return '';
  if (!deployment.deploymentUrl) return project.appUrl || '';

  try {
    const deploymentHost = new URL(deployment.deploymentUrl).hostname.toLowerCase();
    const projectHost = project.appUrl ? new URL(project.appUrl).hostname.toLowerCase() : '';

    if (project.appUrl && project.deploymentPlatform === 'GitHub Pages' && !deploymentHost.endsWith('github.io')) {
      return project.appUrl;
    }
    if (project.appUrl && project.deploymentPlatform !== 'Vercel' && (deploymentHost.endsWith('vercel.app') || deploymentHost.endsWith('vercel.com'))) {
      return project.appUrl;
    }
    if (project.appUrl && projectHost && deploymentHost !== projectHost && project.deploymentPlatform !== 'Other') {
      return project.appUrl;
    }
  } catch {
    return project.appUrl || deployment.deploymentUrl;
  }

  return deployment.deploymentUrl;
};

type DeploymentDraft = {
  provider: Deployment['provider'];
  service: string;
  version: string;
  environment: Deployment['environment'];
  status: Deployment['status'];
  deploymentUrl: string;
  commitSha: string;
  branch: string;
  triggeredBy: string;
  externalId: string;
  startedAt: string;
};

export const ProjectDetail = () => {
  const { id = '' } = useParams();
  const currentUser = readStoredUser();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Summary');
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [healthChecks, setHealthChecks] = useState<ProjectHealthCheck[]>([]);
  const [loadError, setLoadError] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [appUrlDraft, setAppUrlDraft] = useState('');
  const [deploymentPlatformDraft, setDeploymentPlatformDraft] = useState<Project['deploymentPlatform']>('Other');
  const [memberDrafts, setMemberDrafts] = useState<ProjectMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('member');
  const [issueStatusFilter, setIssueStatusFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [issuePriorityFilter, setIssuePriorityFilter] = useState<'ALL' | Priority>('ALL');
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', assignee: '', priority: 'Medium' as Priority, status: 'TODO' as TaskStatus });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [incidentDraft, setIncidentDraft] = useState({ title: '', description: '', severity: 'Medium' as Priority, service: 'api-gateway' });
  const [deploymentDraft, setDeploymentDraft] = useState({
    provider: 'Manual' as Deployment['provider'],
    service: '',
    version: '',
    environment: 'staging' as Deployment['environment'],
    status: 'Queued' as Deployment['status'],
    deploymentUrl: '',
    commitSha: '',
    branch: '',
    triggeredBy: '',
    externalId: '',
    startedAt: new Date().toISOString().slice(0, 16),
  } satisfies DeploymentDraft);

  const load = () => {
    workspaceApi.projectSummary(id)
      .then((data) => {
        setProject(data.project);
        setTasks(data.tasks);
        setDeployments(data.deployments);
        setIncidents(data.incidents);
        setHealthChecks(data.healthChecks);
        setLoadError('');
      })
      .catch(() => {
        setProject(null);
        setTasks([]);
        setDeployments([]);
        setIncidents([]);
        setHealthChecks([]);
        setLoadError('Project not found in the connected DevPilot API. Open Projects and select a project from the current backend.');
      });
  };

  // Subscribe to real-time updates
  useRealtimeListener(['task.created', 'task.updated', 'task.deleted', 'deployment.created', 'incident.created', 'incident.updated', 'project.updated', 'project.health.checked'], (message) => {
    // Re-fetch data when updates arrive
    if (message.payload?.projectId === id || message.type.startsWith('project')) {
      load();
    }
  });

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, [id]);

  useEffect(() => {
    setAppUrlDraft(project?.appUrl || '');
    setDeploymentPlatformDraft(project?.deploymentPlatform || detectDeploymentPlatform(project?.appUrl || ''));
    setMemberDrafts(project?.members || []);
  }, [project?.id, project?.deploymentPlatform, project?.appUrl, project?.members]);

  const summary = useMemo(() => ({
    totalTasks: tasks.length,
    openTasks: tasks.filter((task) => task.status !== 'DONE').length,
    completedTasks: tasks.filter((task) => task.status === 'DONE').length,
    openIncidents: incidents.filter((incident) => incident.status !== 'Resolved').length,
    deployments: deployments.length,
  }), [tasks, incidents, deployments]);
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const statusMatches = issueStatusFilter === 'ALL' || task.status === issueStatusFilter;
    const priorityMatches = issuePriorityFilter === 'ALL' || task.priority === issuePriorityFilter;
    return statusMatches && priorityMatches;
  }), [tasks, issuePriorityFilter, issueStatusFilter]);
  const currentMembership = useMemo(() => {
    const email = String(currentUser?.email || '').trim().toLowerCase();
    if (!email || !project) return undefined;
    return (project.members || []).find((member) => member.email.toLowerCase() === email)
      || (project.ownerEmail?.toLowerCase() === email ? { email, name: project.owner, role: 'owner' as const } : undefined);
  }, [currentUser?.email, project]);
  const canManageAccess = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  const canEditContent = currentMembership?.role === 'owner' || currentMembership?.role === 'admin' || currentMembership?.role === 'member';
  const effectiveDeploymentPlatform = deploymentPlatformDraft || project?.deploymentPlatform || 'Other';
  const deploymentWebhookUrl = project?.deploymentWebhookToken
    ? absoluteApiUrl(`/webhooks/deployments/${webhookPlatformSlug(effectiveDeploymentPlatform)}/${project.deploymentWebhookToken}`)
    : '';

  const copyDeploymentWebhook = async () => {
    if (!deploymentWebhookUrl) return;
    await navigator.clipboard.writeText(deploymentWebhookUrl);
    setCopiedWebhook(true);
    window.setTimeout(() => setCopiedWebhook(false), 1800);
  };

  const saveAppUrl = async (event: FormEvent) => {
    event.preventDefault();
    if (!project || !appUrlDraft.trim()) return;
    const normalizedAppUrl = normalizeUrlInput(appUrlDraft);
    const { project: updated } = await workspaceApi.updateProject(project.id, {
      appUrl: normalizedAppUrl,
      deploymentPlatform: deploymentPlatformDraft === 'Other' ? detectDeploymentPlatform(normalizedAppUrl) : deploymentPlatformDraft,
    });
    setProject(updated);
    setAppUrlDraft(updated.appUrl || '');
    setDeploymentPlatformDraft(updated.deploymentPlatform || 'Other');
  };

  const updateMemberRole = (email: string, role: ProjectRole) => {
    setMemberDrafts((current) => current.map((member) => (
      member.email === email
        ? { ...member, role: member.role === 'owner' ? 'owner' : role }
        : member
    )));
  };

  const removeMember = (email: string) => {
    setMemberDrafts((current) => current.filter((member) => member.email !== email || member.role === 'owner'));
  };

  const addMember = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setMemberDrafts((current) => {
      if (current.some((member) => member.email.toLowerCase() === email)) return current;
      return [...current, { email, name: email, role: inviteRole }];
    });
    setInviteEmail('');
    setInviteRole('member');
  };

  const saveMembers = async () => {
    if (!project) return;
    const { project: updated } = await workspaceApi.updateProject(project.id, { members: memberDrafts });
    setProject(updated);
    setMemberDrafts(updated.members || []);
  };

  const saveTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!taskDraft.title.trim()) return;
    if (editingTask) {
      const { task } = await workspaceApi.updateTask(editingTask.id, taskDraft);
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      setEditingTask(null);
    } else {
      const { task } = await workspaceApi.createTask({ ...taskDraft, projectId: id, type: 'Task', points: 1, labels: [] });
      setTasks((current) => [task, ...current]);
    }
    setTaskDraft({ title: '', description: '', assignee: '', priority: 'Medium', status: 'TODO' });
  };

  const editTask = (task: Task) => {
    setEditingTask(task);
    setTaskDraft({ title: task.title, description: task.description, assignee: task.assignee, priority: task.priority, status: task.status });
  };

  const deleteTask = async (task: Task) => {
    await workspaceApi.deleteTask(task.id);
    setTasks((current) => current.filter((item) => item.id !== task.id));
  };

  const moveTask = (event: DragEvent<HTMLDivElement>, status: TaskStatus) => {
    const taskId = event.dataTransfer.getData('taskId');
    if (!taskId) return;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
    workspaceApi.updateTask(taskId, { status }).then(({ task }) => setTasks((current) => current.map((item) => (item.id === task.id ? task : item))));
  };

  const createIncident = async (event: FormEvent) => {
    event.preventDefault();
    if (!incidentDraft.title.trim()) return;
    const { incident } = await workspaceApi.createIncident({ ...incidentDraft, projectId: id, status: 'Open' });
    setIncidents((current) => [incident, ...current]);
    setIncidentDraft({ title: '', description: '', severity: 'Medium', service: 'api-gateway' });
  };

  const updateIncident = async (incident: Incident, status: Incident['status']) => {
    const { incident: updated } = await workspaceApi.updateIncident(incident.id, { status });
    setIncidents((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  const createDeployment = async (event: FormEvent) => {
    event.preventDefault();
    if (!deploymentDraft.service.trim() || !deploymentDraft.version.trim()) return;
    const { deployment } = await workspaceApi.createDeployment({
      ...deploymentDraft,
      projectId: id,
      startedAt: new Date(deploymentDraft.startedAt).toISOString(),
    });
    setDeployments((current) => [deployment, ...current]);
    setDeploymentDraft({
      provider: 'Manual',
      service: project?.serviceName || '',
      version: '',
      environment: 'staging',
      status: 'Queued',
      deploymentUrl: '',
      commitSha: '',
      branch: '',
      triggeredBy: '',
      externalId: '',
      startedAt: new Date().toISOString().slice(0, 16),
    });
  };

  useEffect(() => {
    if (project && !deploymentDraft.service) {
      setDeploymentDraft((current) => ({ ...current, service: project.serviceName }));
    }
    if (project && incidentDraft.service === 'api-gateway' && project.serviceName) {
      setIncidentDraft((current) => ({ ...current, service: project.serviceName }));
    }
  }, [project]);

  if (!project) {
    return <div className="card"><h2>{loadError ? 'Project unavailable' : 'Loading project'}</h2>{loadError ? <p className="subtle">{loadError}</p> : null}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card hero-panel hero-panel-compact">
        <div className="hero-copy">
          <div>
            <h1>{project.name}</h1>
            <p className="subtle">{project.description || 'Use this project to manage delivery, releases, incidents, and monitoring around a single service.'}</p>
          </div>
          <div className="hero-meta">
            <StatusBadge value={project.status} />
            <span className="issue-key">{project.projectKey}</span>
            <span className="subtle">{project.owner} · {project.serviceName || 'No service mapped yet'} · {(project.members || []).length} team member{(project.members || []).length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      <ProjectSetupPanel
        project={project}
        appUrlDraft={appUrlDraft}
        setAppUrlDraft={setAppUrlDraft}
        deploymentPlatformDraft={deploymentPlatformDraft}
        setDeploymentPlatformDraft={setDeploymentPlatformDraft}
        webhookUrl={deploymentWebhookUrl}
        copied={copiedWebhook}
        onCopy={copyDeploymentWebhook}
        onSaveAppUrl={saveAppUrl}
        memberDrafts={memberDrafts}
        canManageAccess={canManageAccess}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        onAddMember={addMember}
        onRemoveMember={removeMember}
        onUpdateMemberRole={updateMemberRole}
        onSaveMembers={saveMembers}
      />

      <div className="tabs">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={`tab-button ${activeTab === tab ? 'tab-button-active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab === 'Summary' ? (
        <div className="space-y-6">
          <div className="grid">
            <div className="card surface-card metric-card">
              <div className="metric-card-top">
                <div className="stack-sm">
                  <span className="metric-kicker">Project information</span>
                  <h3>Project snapshot</h3>
                </div>
                <span className="metric-icon"><Link2 size={18} /></span>
              </div>
              <div className="stack-sm">
                <p className="subtle">Service: {project.serviceName || 'Not mapped'}</p>
                <p className="subtle">App URL: {project.appUrl || 'Not configured'}</p>
                <p className="subtle">Deployment platform: {project.deploymentPlatform}</p>
              </div>
            </div>
            <MetricTile label="Open Issues" value={summary.openTasks} helper={`${summary.completedTasks} completed`} icon={FolderKanban} />
            <MetricTile label="Releases" value={summary.deployments} helper="Tracked for this project" icon={GitBranch} />
            <MetricTile label="Open Incidents" value={summary.openIncidents} helper="Operational issues still active" icon={Siren} />
          </div>
          <ProjectHealthPanel project={project} healthChecks={healthChecks} />
        </div>
      ) : null}

      {activeTab === 'Issues' ? (
        <div className="space-y-6">
          <TaskForm draft={taskDraft} setDraft={setTaskDraft} editing={Boolean(editingTask)} onSubmit={saveTask} assigneeOptions={(project.members || []).map((member) => member.email)} disabled={!canEditContent} />
          <div className="card surface-card">
            <div className="topbar">
              <div>
                <h3>Issue Backlog</h3>
                <p className="subtle">Filter by workflow status and priority, then work the backlog like a Jira queue.</p>
              </div>
              <div className="hero-actions">
                <select className="editor min-h-0" style={{ minWidth: 150 }} value={issueStatusFilter} onChange={(event) => setIssueStatusFilter(event.target.value as 'ALL' | TaskStatus)}>
                  <option value="ALL">All statuses</option>
                  {statuses.map((status) => <option key={status.id} value={status.id}>{status.title}</option>)}
                </select>
                <select className="editor min-h-0" style={{ minWidth: 150 }} value={issuePriorityFilter} onChange={(event) => setIssuePriorityFilter(event.target.value as 'ALL' | Priority)}>
                  <option value="ALL">All priorities</option>
                  {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </div>
            </div>
          </div>
          <TaskTable project={project} tasks={filteredTasks} onEdit={editTask} onDelete={deleteTask} onStatus={(task, status) => workspaceApi.updateTask(task.id, { status }).then(({ task: updated }) => setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item))))} disabled={!canEditContent} />
        </div>
      ) : null}

      {activeTab === 'Board' ? (
        <div className="kanban kanban-wide">
          {statuses.map((column) => (
            <div key={column.id} className="kanban-column" onDragOver={(event) => canEditContent && event.preventDefault()} onDrop={(event) => canEditContent && moveTask(event, column.id)}>
              <div className="topbar"><h3>{column.title}</h3><span className="badge">{tasks.filter((task) => task.status === column.id).length}</span></div>
              {tasks.filter((task) => task.status === column.id).map((task, index) => (
                <div className="kanban-card" key={task.id} draggable={canEditContent} onDragStart={(event) => canEditContent && event.dataTransfer.setData('taskId', task.id)}>
                  <span className="issue-key">{issueKey(project, task, index)}</span>
                  <strong>{task.title}</strong>
                  <div className="hero-meta">
                    <span className={`priority-pill ${priorityTone(task.priority)}`}>{task.priority}</span>
                    <span className="subtle">{task.assignee || 'Unassigned'}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'Releases' ? (
        <div className="space-y-6">
          <DeploymentWebhookSetup webhookUrl={deploymentWebhookUrl} copied={copiedWebhook} onCopy={copyDeploymentWebhook} platform={effectiveDeploymentPlatform} />
          <DeploymentForm draft={deploymentDraft} setDraft={setDeploymentDraft} onSubmit={createDeployment} disabled={!canEditContent} />
          <DeploymentTable deployments={deployments} project={project} />
        </div>
      ) : null}

      {activeTab === 'Incidents' ? (
        <div className="space-y-6">
          <form className="card surface-card grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]" onSubmit={createIncident}>
            <input className="editor min-h-0" placeholder="Incident title" value={incidentDraft.title} onChange={(event) => setIncidentDraft({ ...incidentDraft, title: event.target.value })} disabled={!canEditContent} />
            <input className="editor min-h-0" placeholder="Service" value={incidentDraft.service} onChange={(event) => setIncidentDraft({ ...incidentDraft, service: event.target.value })} disabled={!canEditContent} />
            <select className="editor min-h-0" value={incidentDraft.severity} onChange={(event) => setIncidentDraft({ ...incidentDraft, severity: event.target.value as Priority })} disabled={!canEditContent}>{['Low', 'Medium', 'High', 'Critical'].map((severity) => <option key={severity}>{severity}</option>)}</select>
            <button className="toggle inline-flex items-center justify-center gap-2" type="submit" disabled={!canEditContent}><Plus size={16} /> Create</button>
            <textarea className="editor md:col-span-4" placeholder="Description" value={incidentDraft.description} onChange={(event) => setIncidentDraft({ ...incidentDraft, description: event.target.value })} disabled={!canEditContent} />
          </form>
          <IncidentTable incidents={incidents} onUpdate={updateIncident} disabled={!canEditContent} />
        </div>
      ) : null}

      {activeTab === 'Analytics' ? <ProjectAnalytics tasks={tasks} deployments={deployments} incidents={incidents} summary={summary} /> : null}

      {activeTab === 'Monitoring' ? <ProjectMonitoring project={project} incidents={incidents} deployments={deployments} healthChecks={healthChecks} /> : null}
    </div>
  );
};

const TaskForm = ({ draft, setDraft, editing, onSubmit, assigneeOptions, disabled }: { draft: { title: string; description: string; assignee: string; priority: Priority; status: TaskStatus }; setDraft: (draft: { title: string; description: string; assignee: string; priority: Priority; status: TaskStatus }) => void; editing: boolean; onSubmit: (event: FormEvent) => void; assigneeOptions: string[]; disabled: boolean }) => (
  <form className="card surface-card grid gap-3 md:grid-cols-[1fr_1fr_140px_140px_auto]" onSubmit={onSubmit}>
    <input className="editor min-h-0" placeholder="Issue title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} disabled={disabled} />
    <>
      <input className="editor min-h-0" list="project-assignees" placeholder="Assignee" value={draft.assignee} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })} disabled={disabled} />
      <datalist id="project-assignees">
        {assigneeOptions.map((option) => <option key={option} value={option} />)}
      </datalist>
    </>
    <select className="editor min-h-0" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })} disabled={disabled}>{['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority}>{priority}</option>)}</select>
    <select className="editor min-h-0" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as TaskStatus })} disabled={disabled}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.title}</option>)}</select>
    <button className="toggle" type="submit" disabled={disabled}>{editing ? 'Save Issue' : 'Create Issue'}</button>
    <textarea className="editor md:col-span-5" placeholder="Issue description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} disabled={disabled} />
  </form>
);

const TaskTable = ({ project, tasks, onEdit, onDelete, onStatus, disabled }: { project: Project; tasks: Task[]; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onStatus: (task: Task, status: TaskStatus) => void; disabled: boolean }) => (
  <div className="card surface-card overflow-x-auto">
    <table className="data-table"><thead><tr><th>Issue</th><th>Priority</th><th>Assignee</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {tasks.map((task, index) => <tr key={task.id}><td><div className="stack-sm"><span className="issue-key">{issueKey(project, task, index)}</span><strong>{task.title}</strong></div></td><td><span className={`priority-pill ${priorityTone(task.priority)}`}>{task.priority}</span></td><td>{task.assignee}</td><td><select value={task.status} disabled={disabled} onChange={(event) => onStatus(task, event.target.value as TaskStatus)}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.title}</option>)}</select></td><td><button className="button-secondary" type="button" disabled={disabled} onClick={() => onEdit(task)}>Edit</button> <button className="button-secondary" type="button" disabled={disabled} onClick={() => onDelete(task)}>Delete</button></td></tr>)}
      {!tasks.length ? <tr><td colSpan={5}>No issues recorded for this project.</td></tr> : null}
    </tbody></table>
  </div>
);

const DeploymentTable = ({ deployments, project }: { deployments: Deployment[]; project: Project }) => (
  <div className="card surface-card overflow-x-auto">
    <table className="data-table"><thead><tr><th>Provider</th><th>Service</th><th>Version</th><th>Environment</th><th>Status</th><th>Branch</th><th>Commit</th><th>Deployed At</th><th>Link</th></tr></thead><tbody>
      {deployments.map((deployment) => (
        <tr key={deployment.id}>
          <td>{deployment.provider}</td>
          <td>{deployment.service}</td>
          <td>{deployment.version}</td>
          <td>{deployment.environment}</td>
          <td>{deployment.status}</td>
          <td>{deployment.branch || ''}</td>
          <td>{deployment.commitSha ? deployment.commitSha.slice(0, 7) : ''}</td>
          <td>{new Date(deployment.startedAt).toLocaleString()}</td>
          <td>{resolveDeploymentLink(project, deployment) ? <a className="table-link" href={resolveDeploymentLink(project, deployment)} target="_blank" rel="noreferrer">Open</a> : ''}</td>
        </tr>
      ))}
      {!deployments.length ? <tr><td colSpan={9}>No deployments recorded for this project.</td></tr> : null}
    </tbody></table>
  </div>
);

const ProjectSetupPanel = ({
  project,
  appUrlDraft,
  setAppUrlDraft,
  deploymentPlatformDraft,
  setDeploymentPlatformDraft,
  webhookUrl,
  copied,
  onCopy,
  onSaveAppUrl,
  memberDrafts,
  canManageAccess,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  onAddMember,
  onRemoveMember,
  onUpdateMemberRole,
  onSaveMembers,
}: {
  project: Project;
  appUrlDraft: string;
  setAppUrlDraft: (value: string) => void;
  deploymentPlatformDraft: Project['deploymentPlatform'];
  setDeploymentPlatformDraft: (value: Project['deploymentPlatform']) => void;
  webhookUrl: string;
  copied: boolean;
  onCopy: () => void;
  onSaveAppUrl: (event: FormEvent) => void;
  memberDrafts: ProjectMember[];
  canManageAccess: boolean;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteRole: ProjectRole;
  setInviteRole: (value: ProjectRole) => void;
  onAddMember: () => void;
  onRemoveMember: (email: string) => void;
  onUpdateMemberRole: (email: string, role: ProjectRole) => void;
  onSaveMembers: () => void;
}) => {
  const appUrlReady = Boolean(project.appUrl);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
      <div className="card surface-card space-y-4">
        <div className="topbar">
          <div>
            <h3>Project Connection</h3>
            <p className="subtle">Add the public App URL, let DevPilot detect where it is deployed, then use the generated webhook with that platform.</p>
          </div>
          <span className="badge">{appUrlReady ? 'Monitoring connected' : 'App URL needed'}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input className="editor min-h-0" readOnly value={webhookUrl || 'Webhook is being generated.'} />
          <button className="toggle inline-flex items-center justify-center gap-2" type="button" onClick={onCopy} disabled={!webhookUrl}>
            <Copy size={16} /> {copied ? 'Copied' : 'Copy webhook'}
          </button>
        </div>
        <form className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]" onSubmit={onSaveAppUrl}>
          <input className="editor min-h-0" placeholder="https://your-deployed-app.com" value={appUrlDraft} onChange={(event) => setAppUrlDraft(event.target.value)} />
          <select className="editor min-h-0" value={deploymentPlatformDraft} onChange={(event) => setDeploymentPlatformDraft(event.target.value as Project['deploymentPlatform'])}>
            {deploymentPlatforms.map((platform) => <option key={platform}>{platform}</option>)}
          </select>
          <button className="toggle inline-flex items-center justify-center" type="button" onClick={() => setDeploymentPlatformDraft(detectDeploymentPlatform(appUrlDraft))} disabled={!appUrlDraft.trim()}>
            Detect Platform
          </button>
          <button className="toggle inline-flex items-center justify-center" type="submit" disabled={!appUrlDraft.trim() || !canManageAccess}>
            Save Connection
          </button>
        </form>
        <p className="subtle">{providerInstructions[deploymentPlatformDraft]}</p>
        <p className="subtle">After saving the App URL, DevPilot checks it every 30 seconds and Prometheus sends uptime, response time, HTTP status, and health state to Grafana.</p>
      </div>

      <div className="card surface-card space-y-4">
        <div className="topbar">
          <div>
            <h3>Access Control</h3>
            <p className="subtle">Roles are scoped to this project. Viewers can read, members can work, admins can manage, and only the owner can delete the project.</p>
          </div>
          <span className="badge inline-flex items-center gap-2"><Users size={14} /> {memberDrafts.length} members</span>
        </div>

        <div className="space-y-3">
          {memberDrafts.map((member) => (
            <div key={member.email} className="grid gap-3 md:grid-cols-[1fr_140px_auto] items-center">
              <div>
                <strong>{member.name || member.email}</strong>
                <p className="subtle">{member.email}</p>
              </div>
              <select
                className="editor min-h-0"
                value={member.role}
                disabled={!canManageAccess || member.role === 'owner'}
                onChange={(event) => onUpdateMemberRole(member.email, event.target.value as ProjectRole)}
              >
                {projectRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <button
                className="icon-button"
                type="button"
                title="Remove member"
                disabled={!canManageAccess || member.role === 'owner'}
                onClick={() => onRemoveMember(member.email)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
          <input className="editor min-h-0" placeholder="teammate@company.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} disabled={!canManageAccess} />
          <select className="editor min-h-0" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as ProjectRole)} disabled={!canManageAccess}>
            {projectRoles.filter((role) => role !== 'owner').map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button className="toggle inline-flex items-center justify-center gap-2" type="button" onClick={onAddMember} disabled={!canManageAccess || !inviteEmail.trim()}>
            <UserPlus size={16} /> Add
          </button>
        </div>

        <div className="hero-actions">
          <button className="toggle inline-flex items-center justify-center" type="button" onClick={onSaveMembers} disabled={!canManageAccess}>
            Save Access
          </button>
        </div>
      </div>
    </div>
  );
};

const DeploymentWebhookSetup = ({ webhookUrl, copied, onCopy, platform }: { webhookUrl: string; copied: boolean; onCopy: () => void; platform: Project['deploymentPlatform'] }) => (
  <div className="card surface-card">
    <div className="topbar">
      <div>
        <h3>Auto Deployment Tracking</h3>
        <p className="subtle">Use this project webhook in {platform} to record deployments automatically.</p>
      </div>
      <button className="toggle inline-flex items-center gap-2" type="button" onClick={onCopy} disabled={!webhookUrl}>
        <Copy size={16} /> {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
    <input className="editor min-h-0 mt-3" readOnly value={webhookUrl || 'Create or reload the project to generate a webhook URL.'} />
    <p className="subtle mt-3">{providerInstructions[platform]}</p>
  </div>
);

const DeploymentForm = ({ draft, setDraft, onSubmit, disabled }: { draft: DeploymentDraft; setDraft: (draft: DeploymentDraft) => void; onSubmit: (event: FormEvent) => void; disabled: boolean }) => (
  <form className="card surface-card grid gap-3 md:grid-cols-[180px_1fr_1fr_150px_150px_220px_auto]" onSubmit={onSubmit}>
    <select className="editor min-h-0" value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value as Deployment['provider'] })} disabled={disabled}>
      {deploymentProviders.map((provider) => <option key={provider}>{provider}</option>)}
    </select>
    <input className="editor min-h-0" placeholder="Service" value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value })} disabled={disabled} />
    <input className="editor min-h-0" placeholder="Version" value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} disabled={disabled} />
    <select className="editor min-h-0" value={draft.environment} onChange={(event) => setDraft({ ...draft, environment: event.target.value as Deployment['environment'] })} disabled={disabled}>
      {['staging', 'production'].map((environment) => <option key={environment}>{environment}</option>)}
    </select>
    <select className="editor min-h-0" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Deployment['status'] })} disabled={disabled}>
      {['Queued', 'Running', 'Succeeded', 'Failed', 'Rolled Back'].map((status) => <option key={status}>{status}</option>)}
    </select>
    <input className="editor min-h-0" type="datetime-local" value={draft.startedAt} onChange={(event) => setDraft({ ...draft, startedAt: event.target.value })} disabled={disabled} />
    <button className="toggle inline-flex items-center justify-center gap-2" type="submit" disabled={disabled}><Plus size={16} /> Add</button>
    <input className="editor min-h-0 md:col-span-2" placeholder="Deployment URL" value={draft.deploymentUrl} onChange={(event) => setDraft({ ...draft, deploymentUrl: event.target.value })} disabled={disabled} />
    <input className="editor min-h-0" placeholder="Commit SHA" value={draft.commitSha} onChange={(event) => setDraft({ ...draft, commitSha: event.target.value })} disabled={disabled} />
    <input className="editor min-h-0" placeholder="Branch" value={draft.branch} onChange={(event) => setDraft({ ...draft, branch: event.target.value })} disabled={disabled} />
    <input className="editor min-h-0" placeholder="Triggered by" value={draft.triggeredBy} onChange={(event) => setDraft({ ...draft, triggeredBy: event.target.value })} disabled={disabled} />
    <input className="editor min-h-0" placeholder="External ID" value={draft.externalId} onChange={(event) => setDraft({ ...draft, externalId: event.target.value })} disabled={disabled} />
  </form>
);

const IncidentTable = ({ incidents, onUpdate, disabled }: { incidents: Incident[]; onUpdate: (incident: Incident, status: Incident['status']) => void; disabled: boolean }) => (
  <div className="card surface-card overflow-x-auto">
    <table className="data-table"><thead><tr><th>Title</th><th>Description</th><th>Severity</th><th>Status</th><th>Created At</th><th>Resolved At</th><th>Actions</th></tr></thead><tbody>
      {incidents.map((incident) => (
        <tr key={incident.id}>
          <td>{incident.title}</td>
          <td>{incident.description}</td>
          <td>{incident.severity}</td>
          <td>{incident.status}</td>
          <td>{new Date(incident.createdAt).toLocaleString()}</td>
          <td>{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : ''}</td>
          <td>
            <div className="flex gap-2">
              <select value={incident.status} disabled={disabled} onChange={(event) => onUpdate(incident, event.target.value as Incident['status'])}>
                {['Open', 'Investigating', 'Resolved'].map((status) => <option key={status}>{status}</option>)}
              </select>
              {incident.status !== 'Resolved' ? <button className="button-secondary" type="button" disabled={disabled} onClick={() => onUpdate(incident, 'Resolved')}>Resolve</button> : null}
            </div>
          </td>
        </tr>
      ))}
      {!incidents.length ? <tr><td colSpan={7}>No incidents recorded for this project.</td></tr> : null}
    </tbody></table>
  </div>
);

const formatProjectHealthStatus = (check?: ProjectHealthCheck) => {
  if (!check) return 'No checks yet';
  if (check.status === 'healthy') return 'Healthy';
  if (check.status === 'warning') return 'Warning';
  return 'Down';
};

const statusTone = (value: string) => {
  const normalized = value.toLowerCase();
  if (['healthy', 'active', 'succeeded', 'done', 'resolved', 'completed'].includes(normalized)) return 'status-healthy';
  if (['down', 'failed', 'critical'].includes(normalized)) return 'status-down';
  return 'status-warning';
};

const StatusBadge = ({ value }: { value: string }) => (
  <span className={`status-badge ${statusTone(value)}`}>
    <span className="status-badge-dot" />
    {value}
  </span>
);

const MetricTile = ({ label, value, helper, icon: Icon, compact = false }: { label: string; value: string | number; helper?: string; icon: LucideIcon; compact?: boolean }) => (
  <div className={`card surface-card metric-card ${compact ? 'metric-card-compact' : ''}`}>
    <div className="metric-card-top">
      <div className="stack-sm">
        <span className="metric-kicker">{compact ? 'Project metric' : 'Project overview'}</span>
        <h3>{label}</h3>
      </div>
      <span className="metric-icon"><Icon size={18} /></span>
    </div>
    <p className={compact ? 'metric-sm' : 'metric'}>{value}</p>
    {helper ? <p className="subtle">{helper}</p> : null}
  </div>
);

const ProjectHealthPanel = ({ project, healthChecks }: { project: Project; healthChecks: ProjectHealthCheck[] }) => {
  const latest = healthChecks[0];
  return (
  <div className="card surface-card">
    <div className="topbar">
      <div>
        <h3>Service Health</h3>
        <p className="subtle">Latest availability result for the mapped service or App URL.</p>
      </div>
      {latest ? <StatusBadge value={formatProjectHealthStatus(latest)} /> : null}
    </div>
    <div className="grid grid-dense">
      {project.appUrl ? (
        <div className="health-row">
          <span className={`health-dot ${latest?.status === 'healthy' ? 'health-dot-ok' : latest?.status === 'down' ? 'health-dot-bad' : ''}`} />
          <div>
            <strong>{project.serviceName || project.name}</strong>
            <p className="subtle">
              {formatProjectHealthStatus(latest)}
              {latest?.statusCode ? ` · HTTP ${latest.statusCode}` : ''}
              {latest?.responseTimeMs ? ` · ${latest.responseTimeMs} ms` : ''}
              {latest?.checkedAt ? ` · ${new Date(latest.checkedAt).toLocaleTimeString()}` : ''}
            </p>
          </div>
        </div>
      ) : <p className="subtle">Add an App URL to start project health checks.</p>}
    </div>
  </div>
  );
};

const dateKey = (value: string) => new Date(value).toISOString().slice(0, 10);

const buildSeries = (tasks: Task[], deployments: Deployment[], incidents: Incident[]) => {
  const dates = Array.from(new Set([
    ...tasks.map((task) => dateKey(task.createdAt)),
    ...deployments.map((deployment) => dateKey(deployment.startedAt)),
    ...incidents.map((incident) => dateKey(incident.createdAt)),
  ])).sort();

  return dates.map((date) => ({
    date,
    tasks: tasks.filter((task) => dateKey(task.createdAt) === date).length,
    deployments: deployments.filter((deployment) => dateKey(deployment.startedAt) === date).length,
    incidents: incidents.filter((incident) => dateKey(incident.createdAt) === date).length,
  }));
};

const ProjectAnalytics = ({ tasks, deployments, incidents, summary }: { tasks: Task[]; deployments: Deployment[]; incidents: Incident[]; summary: { totalTasks: number; openTasks: number; completedTasks: number; openIncidents: number; deployments: number } }) => {
  const series = buildSeries(tasks, deployments, incidents);
  const cards: Array<[string, number]> = [
    ['Total Tasks', summary.totalTasks],
    ['Completed Tasks', summary.completedTasks],
    ['Open Tasks', summary.openTasks],
    ['Total Deployments', summary.deployments],
    ['Open Incidents', summary.openIncidents],
  ];

  return (
    <div className="space-y-6">
      <div className="grid">
        {cards.map(([label, value]) => (
          <MetricTile key={label} label={label} value={value} icon={label.includes('Incident') ? ShieldAlert : label.includes('Deployment') ? GitBranch : FolderKanban} compact />
        ))}
      </div>
      <div className="section">
        <ProjectAreaChart title="Tasks Over Time" data={series} dataKey="tasks" />
        <ProjectBarChart title="Deployments Over Time" data={series} dataKey="deployments" />
        <ProjectBarChart title="Incidents Over Time" data={series} dataKey="incidents" />
      </div>
    </div>
  );
};

const ProjectAreaChart = ({ title, data, dataKey }: { title: string; data: Array<Record<string, string | number>>; dataKey: string }) => (
  <div className="card surface-card">
    <h3>{title}</h3>
    <div className="chart-container">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Area dataKey={dataKey} stroke="#2563eb" fill="#93c5fd" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const ProjectBarChart = ({ title, data, dataKey }: { title: string; data: Array<Record<string, string | number>>; dataKey: string }) => (
  <div className="card surface-card">
    <h3>{title}</h3>
    <div className="chart-container">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey={dataKey} fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const ProjectMonitoring = ({ project, incidents, deployments, healthChecks }: { project: Project; incidents: Incident[]; deployments: Deployment[]; healthChecks: ProjectHealthCheck[] }) => {
  const projectGrafanaUrl = grafanaUrl
    ? `${grafanaUrl}/d/devpilot-project-observability/project-observability?var-project_id=${encodeURIComponent(project.id)}`
    : '';
  const openIncidents = incidents.filter((incident) => incident.status !== 'Resolved');
  const recentDeployments = deployments.slice(0, 5);
  const failedDeployments = deployments.filter((deployment) => ['Failed', 'Rolled Back'].includes(deployment.status));
  const latestHealthCheck = healthChecks[0];
  const uptime = healthChecks.length ? ((healthChecks.filter((check) => check.status === 'healthy').length / healthChecks.length) * 100).toFixed(1) : null;
  const currentStatus = latestHealthCheck?.status === 'down'
    ? 'Down'
    : latestHealthCheck?.status === 'warning' || openIncidents.length || failedDeployments.length
      ? 'Warning'
      : latestHealthCheck ? 'Healthy' : 'No checks yet';
  const statusCodes = Object.entries(healthChecks.reduce<Record<string, number>>((counts, check) => {
    const code = check.statusCode ? String(check.statusCode) : 'No response';
    counts[code] = (counts[code] || 0) + 1;
    return counts;
  }, {})).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className="space-y-6">
      <div className="monitoring-summary">
        <div className="card surface-card">
          <div className="topbar">
            <div>
              <h3>Grafana Monitoring</h3>
              <p className="subtle">
                {projectGrafanaUrl
                  ? 'Open Grafana with this project selected to inspect uptime, response time, status codes, and health state from Prometheus.'
                  : 'Grafana is not configured for this deployed environment yet. Set VITE_OPEN_GRAFANA_URL in Vercel to enable the project dashboard link.'}
              </p>
            </div>
            {projectGrafanaUrl ? (
              <a className="toggle inline-flex items-center gap-2" href={projectGrafanaUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Open Grafana
              </a>
            ) : (
              <button className="toggle inline-flex items-center gap-2" type="button" disabled>
                <ExternalLink size={16} /> Grafana unavailable
              </button>
            )}
          </div>
          <div className="monitoring-meta">
            <div className="mini-stat">
              <span className="metric-kicker">Current status</span>
              <div className="hero-meta"><StatusBadge value={currentStatus} /></div>
            </div>
            <div className="mini-stat">
              <span className="metric-kicker">Mapped service</span>
              <span className="metric-sm">{project.serviceName || 'Not mapped'}</span>
            </div>
            <div className="mini-stat">
              <span className="metric-kicker">App URL</span>
              <span className="subtle">{project.appUrl || 'Not configured'}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-monitoring">
          <MetricTile label="URL Health" value={formatProjectHealthStatus(latestHealthCheck)} helper="Based on the latest check" icon={Gauge} compact />
          <MetricTile label="Last App Check" value={latestHealthCheck ? new Date(latestHealthCheck.checkedAt).toLocaleTimeString() : 'None'} helper="Latest completed probe" icon={Activity} compact />
          <MetricTile label="Project Uptime" value={uptime ? `${uptime}%` : 'No data'} helper="Share of healthy checks" icon={Waypoints} compact />
          <MetricTile label="Latest Response Time" value={latestHealthCheck ? `${latestHealthCheck.responseTimeMs} ms` : 'No data'} helper="Most recent measured latency" icon={Gauge} compact />
          <MetricTile label="Latest Status Code" value={latestHealthCheck?.statusCode || 'No data'} helper="HTTP code from the latest probe" icon={Boxes} compact />
          <MetricTile label="Open Incidents" value={openIncidents.length} helper="Unresolved issues attached to this project" icon={ShieldAlert} compact />
        </div>
      </div>
      <div className="section">
        <div className="card surface-card">
          <h3>App Health Checks</h3>
          <div className="timeline">
            {healthChecks.slice(0, 8).map((check) => (
              <div className="timeline-item" key={check.id}>
                <span className={`health-dot ${check.status === 'healthy' ? 'health-dot-ok' : check.status === 'down' ? 'health-dot-bad' : ''}`} />
                <div><strong>{check.status} · HTTP {check.statusCode || 'n/a'}</strong><p className="subtle">{check.responseTimeMs} ms · {new Date(check.checkedAt).toLocaleString()}{check.error ? ` · ${check.error}` : ''}</p></div>
              </div>
            ))}
            {!healthChecks.length ? <p className="subtle">No project health checks recorded yet. Add an App URL and wait for the checker to run.</p> : null}
          </div>
        </div>
        <div className="card surface-card">
          <h3>Status Codes</h3>
          <div className="timeline">
            {statusCodes.map(([code, count]) => (
              <div className="timeline-item" key={code}>
                <span className={`health-dot ${Number(code) >= 500 ? 'health-dot-bad' : Number(code) >= 400 ? '' : 'health-dot-ok'}`} />
                <div><strong>{code}</strong><p className="subtle">{count} project health checks</p></div>
              </div>
            ))}
            {!statusCodes.length ? <p className="subtle">No project health checks recorded yet.</p> : null}
          </div>
        </div>
        <div className="card surface-card">
          <h3>Open Incidents</h3>
          <div className="timeline">
            {openIncidents.slice(0, 5).map((incident) => (
              <div className="timeline-item" key={incident.id}>
                <span className="timeline-dot" />
                <div><strong>{incident.title}</strong><p className="subtle">{incident.severity} · {incident.status} · {new Date(incident.createdAt).toLocaleString()}</p></div>
              </div>
            ))}
            {!openIncidents.length ? <p className="subtle">No open incidents for this project.</p> : null}
          </div>
        </div>
        <div className="card surface-card">
          <h3>Recent Deployments</h3>
          <div className="timeline">
            {recentDeployments.map((deployment) => (
              <div className="timeline-item" key={deployment.id}>
                <span className="timeline-dot" />
                <div><strong>{deployment.version} · {deployment.service}</strong><p className="subtle">{deployment.provider} · {deployment.environment} · {deployment.status} · {new Date(deployment.startedAt).toLocaleString()}</p></div>
              </div>
            ))}
            {!recentDeployments.length ? <p className="subtle">No deployments recorded for this project.</p> : null}
          </div>
        </div>
        <ProjectHealthPanel project={project} healthChecks={healthChecks} />
      </div>
    </div>
  );
};
