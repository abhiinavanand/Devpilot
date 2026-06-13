import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { workspaceApi, type Project } from '../api/workspace';

const emptyProject: Pick<Project, 'name' | 'description' | 'owner' | 'serviceName' | 'appUrl' | 'status'> = {
  name: '',
  description: '',
  owner: '',
  serviceName: '',
  appUrl: '',
  status: 'Active',
};

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [draft, setDraft] = useState(emptyProject);
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState('');

  const loadProjects = () =>
    workspaceApi
      .projects()
      .then((data) => {
        setProjects(data.projects);
        setError('');
      })
      .catch(() => setError('Unable to load projects.'));

  useEffect(() => {
    loadProjects();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.serviceName.trim()) {
      setError('Project name and service name are required.');
      return;
    }

    if (editing) {
      const { project } = await workspaceApi.updateProject(editing.id, draft);
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
      setEditing(null);
    } else {
      const { project } = await workspaceApi.createProject(draft);
      setProjects((current) => [project, ...current]);
    }
    setError('');
    setDraft(emptyProject);
  };

  const startEdit = (project: Project) => {
    setEditing(project);
    setDraft({ name: project.name, description: project.description, owner: project.owner, serviceName: project.serviceName, appUrl: project.appUrl, status: project.status });
  };

  const deleteProject = async (project: Project) => {
    await workspaceApi.deleteProject(project.id);
    setProjects((current) => current.filter((item) => item.id !== project.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Projects</h1>
        <p className="subtle">Create a project to generate its deployment webhook, then add the deployed app URL inside the project.</p>
      </div>
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
          </tbody>
        </table>
      </div>
    </div>
  );
};
