import React from 'react';

function TaskItem({ task, onEdit, onDelete }) {
  return (
    <div className={`task-card ${task.status}`}>
      <div className="task-info">
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        <div className="task-meta">
          <span className={`badge badge-${task.status}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className={`badge badge-${task.priority}`}>
            {task.priority}
          </span>
        </div>
      </div>
      <div className="task-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onEdit(task)}>Edit</button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(task.id)}>Delete</button>
      </div>
    </div>
  );
}

export default TaskItem;
