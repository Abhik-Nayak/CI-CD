import React, { useState, useEffect } from 'react';

function TaskForm({ onSubmit, initialData, onCancel }) {
  const [form, setForm] = useState({ title: '', description: '', status: 'pending', priority: 'medium' });

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title,
        description: initialData.description || '',
        status: initialData.status,
        priority: initialData.priority,
      });
    } else {
      setForm({ title: '', description: '', status: 'pending', priority: 'medium' });
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit(form);
    if (!initialData) setForm({ title: '', description: '', status: 'pending', priority: 'medium' });
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <h2>{initialData ? 'Edit Task' : 'New Task'}</h2>
      <input
        placeholder="Task title *"
        value={form.title}
        onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
        required
      />
      <textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
      />
      <div className="form-row">
        <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {initialData ? 'Update' : 'Add Task'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default TaskForm;
