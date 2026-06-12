import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { workspaceApi, type Priority, type Project, type Task, type TaskStatus } from '../api/workspace';

const statuses: Array<{ id: TaskStatus; title: string }> = [
  { id: 'TODO', title: 'TODO' },
  { id: 'IN_PROGRESS', title: 'IN PROGRESS' },
  { id: 'REVIEW', title: 'REVIEW' },
  { id: 'DONE', title: 'DONE' },
];

const emptyProject = {
  name: '',
  description: '',
  owner: '',
};

const emptyTask = {
  title: '',
  description: '',
  assignee: '',
  priority: 'Medium' as Priority,
};

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectDraft, setProjectDraft] = useState(emptyProject);
  const [taskDraft, setTaskDraft] = useState(emptyTask);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [error, setError] = useState('');

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  const loadProjects = () =>
    workspaceApi.projects().then((data) => {
      setProjects(data.projects);
      setSelectedProjectId((current) => current || data.projects[0]?.id || '');
    });

  const loadTasks = (projectId = selectedProjectId) => {
    if (!projectId) return;
    workspaceApi
      .tasks(projectId)
      .then((data) => {
        setTasks(data.tasks);
        setError('');
      })
      .catch(() => setError('Unable to load board data from the API.'));
  };

  useEffect(() => {
    loadProjects().catch(() => setError('Unable to load projects from the API.'));
  }, []);

  useEffect(() => {
    loadTasks(selectedProjectId);
  }, [selectedProjectId]);

  const totals = useMemo(() => {
    const done = tasks.filter((task) => task.status === 'DONE').length;
    return {
      done,
      active: tasks.length - done,
      review: tasks.filter((task) => task.status === 'REVIEW').length,
    };
  }, [tasks]);

  const createProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectDraft.name.trim()) return;
    const { project } = await workspaceApi.createProject({
      ...projectDraft,
      owner: projectDraft.owner || 'Platform Team',
      status: 'Active',
    });
    setProjects((current) => [project, ...current]);
    setSelectedProjectId(project.id);
    setProjectDraft(emptyProject);
  };

  const saveTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!taskDraft.title.trim() || !selectedProjectId) return;

    if (editingTask) {
      const { task } = await workspaceApi.updateTask(editingTask.id, taskDraft);
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      setEditingTask(null);
    } else {
      const { task } = await workspaceApi.createTask({
        ...taskDraft,
        projectId: selectedProjectId,
        type: 'Task',
        status: 'TODO',
        points: 3,
        due: new Date(Date.now() + 1209600000).toISOString().slice(0, 10),
        labels: ['kanban'],
      });
      setTasks((current) => [task, ...current]);
    }

    setTaskDraft(emptyTask);
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setTaskDraft({
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      priority: task.priority,
    });
  };

  const deleteTask = async (task: Task) => {
    await workspaceApi.deleteTask(task.id);
    setTasks((current) => current.filter((item) => item.id !== task.id));
  };

  const onDragStart = (event: DragEvent<HTMLDivElement>, task: Task) => {
    event.dataTransfer.setData('taskId', task.id);
    event.dataTransfer.setData('status', task.status);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>, destination: TaskStatus) => {
    const taskId = event.dataTransfer.getData('taskId');
    const source = event.dataTransfer.getData('status');
    if (!taskId || source === destination) return;

    const previousTasks = tasks;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status: destination } : task)));
    workspaceApi.updateTask(taskId, { status: destination }).catch(() => {
      setTasks(previousTasks);
      setError('Could not persist that workflow move.');
    });
  };

  return (
    <div className="space-y-6">
      <div className="topbar">
        <div>
          <h1>Projects</h1>
          <p className="subtle">Project-specific Jira-style boards with live task workflow updates.</p>
        </div>
        <select className="editor max-w-xs" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="subtle">{error}</p> : null}

      <div className="grid">
        <div className="card">
          <h3>{selectedProject?.name || 'No project selected'}</h3>
          <p className="subtle">{selectedProject?.description || 'Create a project to start planning work.'}</p>
          <p className="subtle">{totals.active} active tasks · {totals.review} in review · {totals.done} done</p>
        </div>

        <form className="card space-y-3" onSubmit={createProject}>
          <h3>Create Project</h3>
          <input className="editor min-h-0" placeholder="Project name" value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} />
          <input className="editor min-h-0" placeholder="Owner" value={projectDraft.owner} onChange={(event) => setProjectDraft({ ...projectDraft, owner: event.target.value })} />
          <textarea className="editor" placeholder="Description" value={projectDraft.description} onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })} />
          <button className="toggle inline-flex items-center gap-2" type="submit"><Plus size={16} /> Create</button>
        </form>
      </div>

      <form className="card grid gap-3 md:grid-cols-[1fr_1fr_160px_160px_auto]" onSubmit={saveTask}>
        <input className="editor min-h-0" placeholder="Task title" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} />
        <input className="editor min-h-0" placeholder="Assignee" value={taskDraft.assignee} onChange={(event) => setTaskDraft({ ...taskDraft, assignee: event.target.value })} />
        <select className="editor min-h-0" value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as Priority })}>
          {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority}>{priority}</option>)}
        </select>
        <input className="editor min-h-0" placeholder="Description" value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} />
        <button className="toggle inline-flex items-center justify-center gap-2" type="submit">
          <Plus size={16} /> {editingTask ? 'Save' : 'Add'}
        </button>
      </form>

      <div className="kanban kanban-wide">
        {statuses.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);
          return (
            <div key={column.id} className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, column.id)}>
              <div className="topbar">
                <h3>{column.title}</h3>
                <span className="badge">{columnTasks.length}</span>
              </div>
              {columnTasks.map((task) => (
                <div key={task.id} className="kanban-card" draggable onDragStart={(event) => onDragStart(event, task)}>
                  <div className="topbar">
                    <strong>{task.title}</strong>
                    <span className="badge">{task.priority}</span>
                  </div>
                  <p className="subtle">{task.description}</p>
                  <p className="subtle">{task.assignee || 'Unassigned'} · updated {new Date(task.updatedAt).toLocaleDateString()}</p>
                  <div className="flex gap-2">
                    <button className="icon-button" type="button" title="Edit task" onClick={() => startEdit(task)}><Edit3 size={16} /></button>
                    <button className="icon-button" type="button" title="Delete task" onClick={() => deleteTask(task)}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
