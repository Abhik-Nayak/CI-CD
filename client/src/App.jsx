import { useState, useEffect } from "react";
import TodoForm from "./components/TodoForm";
import TodoList from "./components/TodoList";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [todos, setTodos] = useState([]);
  const [editingTodo, setEditingTodo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTodos = async () => {
    try {
      setError(null);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Failed to load todos");
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const addTodo = async (title) => {
    try {
      setError(null);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to add todo");
      const newTodo = await res.json();
      setTodos((prev) => [newTodo, ...prev]);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateTodo = async (id, updates) => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update todo");
      const updated = await res.json();
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingTodo(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTodo = async (id) => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete todo");
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="app">
      <h1>Todo App2</h1>
      {error && (
        <div className="error-banner">
          {error}
          <button className="dismiss-btn" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      <TodoForm
        onSubmit={addTodo}
        editingTodo={editingTodo}
        onUpdate={updateTodo}
        onCancelEdit={() => setEditingTodo(null)}
      />
      {loading ? (
        <p className="loading">Loading todos...</p>
      ) : (
        <TodoList
          todos={todos}
          onToggle={(id, completed) =>
            updateTodo(id, { completed: !completed })
          }
          onDelete={deleteTodo}
          onEdit={setEditingTodo}
        />
      )}
    </div>
  );
}

export default App;
