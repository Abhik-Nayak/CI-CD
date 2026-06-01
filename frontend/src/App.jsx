import React, { useState, useEffect, useCallback } from 'react';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import { getTasks, createTask, updateTask, deleteTask } from './api/tasks';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.priority) params.priority = filter.priority;
      const res = await getTasks(params);
      setTasks(res.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async (data) => {
    try {
      await createTask(data);
      fetchTasks();
    } catch (err) {
      setError('Failed to create task');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateTask(id, data);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      setError('Failed to update task');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTask(id);
      fetchTasks();
    } catch (err) {
      setError('Failed to delete task');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Task Manager</h1>
      </header>
      <main className="app-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>x</button>
          </div>
        )}
        <TaskForm
          onSubmit={editingTask ? (data) => handleUpdate(editingTask.id, data) : handleCreate}
          initialData={editingTask}
          onCancel={editingTask ? () => setEditingTask(null) : undefined}
        />
        <div className="filters">
          <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <select value={filter.priority} onChange={(e) => setFilter(f => ({ ...f, priority: e.target.value }))}>
            <option value="">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        {loading ? <p>Loading...</p> : (
          <TaskList tasks={tasks} onEdit={setEditingTask} onDelete={handleDelete} />
        )}
      </main>
    </div>
  );
}

export default App;
