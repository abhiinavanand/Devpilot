import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { workspaceApi, type Project } from '../api/workspace';

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('devpilot.user') || 'null') as { name?: string; email?: string } | null;
  } catch {
    return null;
  }
};

const projectCacheKey = () => `devpilot.projects.cache:${String(readStoredUser()?.email || 'guest').toLowerCase()}`;
const normalizeUrlInput = (value: string) => {
  const trimmed = value.trim();
  return trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
};

const emptyProject: Pick<Project, 'name' | 'description' | 'owner' | 'serviceName' | 'deploymentPlatform' | 'appUrl' | 'status'> = {
  name: '',
  description: '',
  owner: '',
  serviceName: '',
  deploymentPlatform: 'Other',
  appUrl: '',
  status: 'Active',
};

export const Projects = () => {
  const currentUser = readStoredUser();
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const cached = localStorage.getItem(projectCacheKey());
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState(emptyProject);
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!projects.length);

  const loadProjects = () =>
    workspaceApi
      .projects()
      .then((data) => {
        setProjects(data.projects);
        localStorage.setItem(projectCacheKey(), JSON.stringify(data.projects));
        setError('');
      })
      .catch(() => setError('Unable to load projects.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!editing && !draft.owner && currentUser?.name) {
      setDraft((current) => ({ ...current, owner: current.owner || currentUser.name || '' }));
    }
  }, [currentUser?.name, draft.owner, editing]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.serviceName.trim()) {
      setError('Project name and service name are required.');
      return;
    }

    if (editing) {
      const { project } = await workspaceApi.updateProject(editing.id, { ...draft, appUrl: normalizeUrlInput(draft.appUrl) });
      setProjects((current) => {
        const next = current.map((item) => (item.id === project.id ? project : item));
        localStorage.setItem(projectCacheKey(), JSON.stringify(next));
        return next;
      });
      setEditing(null);
    } else {
      const { project } = await workspaceApi.createProject({ ...draft, owner: draft.owner || currentUser?.name || '', appUrl: normalizeUrlInput(draft.appUrl) });
      setProjects((current) => {
        const next = [project, ...current];
        localStorage.setItem(projectCacheKey(), JSON.stringify(next));
        return next;
      });
    }
    setError('');
    setDraft(emptyProject);
  };

  const startEdit = (project: Project) => {
    setEditing(project);
    setDraft({ name: project.name, description: project.description, owner: project.owner, serviceName: project.serviceName, deploymentPlatform: project.deploymentPlatform, appUrl: project.appUrl, status: project.status });
  };

  const deleteProject = async (project: Project) => {
    await workspaceApi.deleteProject(project.id);
    setProjects((current) => {
      const next = current.filter((item) => item.id !== project.id);
      localStorage.setItem(projectCacheKey(), JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Projects</h1>
        <p className="subtle">Create a project to generate its deployment webhook, then add the deployed app URL inside the project.</p>
      </div>
      {loading ? <p className="subtle">Loading projects...</p> : null}
      {error ? <p className="subtle">{error}</p> : null}

      <form className="card grid gap-3 md:grid-cols-[1fr_1fr_1fr_160px_auto]" onSubmit={submit}>
        <input className="editor min-h-0" placeholder="Project name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <input className="editor min-h-0" placeholder="Owner" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} />
        <input className="editor min-h-0" placeholder="Service name, e.g. analytics-service" value={draft.serviceName} onChange={(event) => setDraft({ ...draft, serviceName: event.target.value })} />
        <select className="editor min-h-0" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Project['status'] })}>
          {['Active', 'Paused', 'Completed'].map((status) => <option key={status}>{status}</option>)}
        </select>
        <button className="toggle inline-flex items-center justify-center gap-2" type="submit"><Plus size={16} /> {editing ? 'Save' : 'Create'}</button>
        <input className="editor min-h-0 md:col-span-5" placeholder="App URL to monitor, optional until after webhook setup" value={draft.appUrl} onChange={(event) => setDraft({ ...draft, appUrl: event.target.value })} />
        <textarea className="editor md:col-span-5" placeholder="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </form>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Open Tasks</th>
              <th>Open Incidents</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td><strong>{project.name}</strong></td>
                <td>{project.owner}</td>
                <td><span className="badge">{project.status}</span></td>
                <td>{project.openTasks ?? 0}</td>
                <td>{project.openIncidents ?? 0}</td>
                <td>
                  <div className="flex gap-2">
                    <Link className="icon-button" title="Open project" to={`/projects/${project.id}`}><ExternalLink size={16} /></Link>
                    <button className="icon-button" title="Edit project" onClick={() => startEdit(project)}><Edit3 size={16} /></button>
                    <button className="icon-button" title="Delete project" onClick={() => deleteProject(project)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !projects.length ? (
              <tr>
                <td colSpan={6}>No projects yet. Create one to generate its deployment webhook.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};
