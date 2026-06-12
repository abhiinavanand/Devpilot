import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { workspaceApi, type Deployment, type Incident, type Priority, type Project, type ServiceHealth, type Task, type TaskStatus } from '../api/workspace';

const tabs = ['Overview', 'Tasks', 'Kanban', 'Deployments', 'Incidents', 'Monitoring'] as const;
const statuses: Array<{ id: TaskStatus; title: string }> = [
  { id: 'TODO', title: 'Todo' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'REVIEW', title: 'Review' },
  { id: 'DONE', title: 'Done' },
];

export const ProjectDetail = () => {
  const { id = '' } = useParams();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview');
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', assignee: '', priority: 'Medium' as Priority, status: 'TODO' as TaskStatus });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [incidentDraft, setIncidentDraft] = useState({ title: '', description: '', severity: 'Medium' as Priority, service: 'api-gateway' });

  const load = () => {
    workspaceApi.projectSummary(id).then((data) => {
      setProject(data.project);
      setTasks(data.tasks);
      setDeployments(data.deployments);
      setIncidents(data.incidents);
    });
    workspaceApi.serviceHealth().then((data) => setServices(data.services)).catch(() => setServices([]));
  };

  useEffect(() => {
    load();
  }, [id]);

  const summary = useMemo(() => ({
    openTasks: tasks.filter((task) => task.status !== 'DONE').length,
    completedTasks: tasks.filter((task) => task.status === 'DONE').length,
    openIncidents: incidents.filter((incident) => incident.status !== 'Resolved').length,
    deployments: deployments.length,
  }), [tasks, incidents, deployments]);

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

  if (!project) {
    return <div className="card"><h2>Loading project</h2></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>{project.name}</h1>
        <p className="subtle">{project.owner} · {project.status}</p>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <button key={tab} className={`tab-button ${activeTab === tab ? 'tab-button-active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab === 'Overview' ? (
        <div className="space-y-6">
          <div className="grid">
            <div className="card"><h3>Project Information</h3><p className="subtle">{project.description}</p></div>
            <div className="card"><h3>Task Summary</h3><p className="metric">{summary.openTasks}</p><p className="subtle">open · {summary.completedTasks} completed</p></div>
            <div className="card"><h3>Deployment Summary</h3><p className="metric">{summary.deployments}</p><p className="subtle">deployment records</p></div>
            <div className="card"><h3>Incident Summary</h3><p className="metric">{summary.openIncidents}</p><p className="subtle">open incidents</p></div>
          </div>
          <ServiceHealthGrid services={services} />
        </div>
      ) : null}

      {activeTab === 'Tasks' ? (
        <div className="space-y-6">
          <TaskForm draft={taskDraft} setDraft={setTaskDraft} editing={Boolean(editingTask)} onSubmit={saveTask} />
          <TaskTable tasks={tasks} onEdit={editTask} onDelete={deleteTask} onStatus={(task, status) => workspaceApi.updateTask(task.id, { status }).then(({ task: updated }) => setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item))))} />
        </div>
      ) : null}

      {activeTab === 'Kanban' ? (
        <div className="kanban kanban-wide">
          {statuses.map((column) => (
            <div key={column.id} className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveTask(event, column.id)}>
              <div className="topbar"><h3>{column.title}</h3><span className="badge">{tasks.filter((task) => task.status === column.id).length}</span></div>
              {tasks.filter((task) => task.status === column.id).map((task) => (
                <div className="kanban-card" key={task.id} draggable onDragStart={(event) => event.dataTransfer.setData('taskId', task.id)}>
                  <strong>{task.title}</strong>
                  <p className="subtle">{task.assignee || 'Unassigned'} · {task.priority}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'Deployments' ? <DeploymentTable deployments={deployments} /> : null}

      {activeTab === 'Incidents' ? (
        <div className="space-y-6">
          <form className="card grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]" onSubmit={createIncident}>
            <input className="editor min-h-0" placeholder="Incident title" value={incidentDraft.title} onChange={(event) => setIncidentDraft({ ...incidentDraft, title: event.target.value })} />
            <input className="editor min-h-0" placeholder="Service" value={incidentDraft.service} onChange={(event) => setIncidentDraft({ ...incidentDraft, service: event.target.value })} />
            <select className="editor min-h-0" value={incidentDraft.severity} onChange={(event) => setIncidentDraft({ ...incidentDraft, severity: event.target.value as Priority })}>{['Low', 'Medium', 'High', 'Critical'].map((severity) => <option key={severity}>{severity}</option>)}</select>
            <button className="toggle inline-flex items-center justify-center gap-2" type="submit"><Plus size={16} /> Create</button>
            <textarea className="editor md:col-span-4" placeholder="Description" value={incidentDraft.description} onChange={(event) => setIncidentDraft({ ...incidentDraft, description: event.target.value })} />
          </form>
          <IncidentTable incidents={incidents} onUpdate={updateIncident} />
        </div>
      ) : null}

      {activeTab === 'Monitoring' ? <ServiceHealthGrid services={services} /> : null}
    </div>
  );
};

const TaskForm = ({ draft, setDraft, editing, onSubmit }: { draft: { title: string; description: string; assignee: string; priority: Priority; status: TaskStatus }; setDraft: (draft: { title: string; description: string; assignee: string; priority: Priority; status: TaskStatus }) => void; editing: boolean; onSubmit: (event: FormEvent) => void }) => (
  <form className="card grid gap-3 md:grid-cols-[1fr_1fr_140px_140px_auto]" onSubmit={onSubmit}>
    <input className="editor min-h-0" placeholder="Task title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
    <input className="editor min-h-0" placeholder="Assignee" value={draft.assignee} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })} />
    <select className="editor min-h-0" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>{['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority}>{priority}</option>)}</select>
    <select className="editor min-h-0" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as TaskStatus })}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.title}</option>)}</select>
    <button className="toggle" type="submit">{editing ? 'Save' : 'Create'}</button>
    <textarea className="editor md:col-span-5" placeholder="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
  </form>
);

const TaskTable = ({ tasks, onEdit, onDelete, onStatus }: { tasks: Task[]; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onStatus: (task: Task, status: TaskStatus) => void }) => (
  <div className="card overflow-x-auto">
    <table className="data-table"><thead><tr><th>Title</th><th>Priority</th><th>Assignee</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {tasks.map((task) => <tr key={task.id}><td>{task.title}</td><td>{task.priority}</td><td>{task.assignee}</td><td><select value={task.status} onChange={(event) => onStatus(task, event.target.value as TaskStatus)}>{statuses.map((status) => <option key={status.id} value={status.id}>{status.title}</option>)}</select></td><td><button onClick={() => onEdit(task)}>Edit</button> <button onClick={() => onDelete(task)}>Delete</button></td></tr>)}
    </tbody></table>
  </div>
);

const DeploymentTable = ({ deployments }: { deployments: Deployment[] }) => (
  <div className="card overflow-x-auto">
    <table className="data-table"><thead><tr><th>Version</th><th>Environment</th><th>Status</th><th>Service</th><th>Deployed At</th></tr></thead><tbody>
      {deployments.map((deployment) => <tr key={deployment.id}><td>{deployment.version}</td><td>{deployment.environment}</td><td>{deployment.status}</td><td>{deployment.service}</td><td>{new Date(deployment.startedAt).toLocaleString()}</td></tr>)}
    </tbody></table>
  </div>
);

const IncidentTable = ({ incidents, onUpdate }: { incidents: Incident[]; onUpdate: (incident: Incident, status: Incident['status']) => void }) => (
  <div className="card overflow-x-auto">
    <table className="data-table"><thead><tr><th>Title</th><th>Description</th><th>Severity</th><th>Status</th><th>Created At</th><th>Resolved At</th><th>Actions</th></tr></thead><tbody>
      {incidents.map((incident) => <tr key={incident.id}><td>{incident.title}</td><td>{incident.description}</td><td>{incident.severity}</td><td>{incident.status}</td><td>{new Date(incident.createdAt).toLocaleString()}</td><td>{incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : ''}</td><td><button onClick={() => onUpdate(incident, 'Investigating')}>Investigate</button> <button onClick={() => onUpdate(incident, 'Resolved')}>Resolve</button></td></tr>)}
    </tbody></table>
  </div>
);

const ServiceHealthGrid = ({ services }: { services: ServiceHealth[] }) => (
  <div className="card">
    <h3>Service Health</h3>
    <div className="grid">
      {services.map((service) => (
        <div className="health-row" key={service.service}>
          <span className={`health-dot ${service.status === 'healthy' ? 'health-dot-ok' : 'health-dot-bad'}`} />
          <div><strong>{service.name}</strong><p className="subtle">{service.status} · {new Date(service.timestamp).toLocaleTimeString()}</p></div>
        </div>
      ))}
    </div>
  </div>
);
