import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { workspaceApi, type Task, type TaskStatus } from '../api/workspace';

type KanbanColumn = {
  id: TaskStatus;
  title: string;
  cards: Task[];
};

export const KanbanBoard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');

  const loadTasks = () => {
    workspaceApi
      .tasks()
      .then((data) => {
        setTasks(data.tasks);
        setError('');
      })
      .catch(() => setError('Unable to load workflow data.'));
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const columns = useMemo<KanbanColumn[]>(() => {
    const statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    return statuses.map((status) => ({
      id: status,
      title: status.replace('_', ' '),
      cards: tasks.filter((task) => task.status === status),
    }));
  }, [tasks]);

  const onDragStart = (event: DragEvent<HTMLDivElement>, cardId: string, columnId: TaskStatus) => {
    event.dataTransfer.setData('cardId', cardId);
    event.dataTransfer.setData('columnId', columnId);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>, destinationColumnId: TaskStatus) => {
    const cardId = event.dataTransfer.getData('cardId');
    const sourceColumnId = event.dataTransfer.getData('columnId');

    if (!cardId || sourceColumnId === destinationColumnId) {
      return;
    }

    const previousTasks = tasks;
    setTasks((current) =>
      current.map((task) => (task.id === cardId ? { ...task, status: destinationColumnId } : task)),
    );
    workspaceApi.updateTask(cardId, { status: destinationColumnId }).catch(() => {
      setTasks(previousTasks);
      setError('Could not save the workflow move.');
    });
  };

  return (
    <div className="card">
      <div className="topbar">
        <h3>Kanban Workflow</h3>
        <button className="toggle" onClick={loadTasks}>Refresh</button>
      </div>
      {error ? <p className="subtle">{error}</p> : null}
      <div className="kanban">
        {columns.map((column: KanbanColumn) => (
          <div
            key={column.id}
            className="kanban-column"
            onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
            onDrop={(event: DragEvent<HTMLDivElement>) => onDrop(event, column.id)}
          >
            <p className="subtle">{column.title}</p>
            {column.cards.map((card: Task) => (
              <div
                key={card.id}
                className="kanban-card"
                draggable
                onDragStart={(event: DragEvent<HTMLDivElement>) => onDragStart(event, card.id, column.id)}
              >
                <strong>{card.title}</strong>
                <p className="subtle">{card.assignee} · {card.priority} · {card.points} pts</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
