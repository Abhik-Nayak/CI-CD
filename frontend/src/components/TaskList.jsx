import React from 'react';
import TaskItem from './TaskItem';

function TaskList({ tasks, onEdit, onDelete }) {
  if (tasks.length === 0) {
    return <div className="empty-state"><p>No tasks found. Create one above!</p></div>;
  }
  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default TaskList;
