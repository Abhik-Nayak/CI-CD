import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TodoForm from "../components/TodoForm";
import TodoList from "../components/TodoList";
import { useAuth } from "../context/AuthContext";
import { todosApi } from "../api/todos";

export default function Todos() {
  const [todos, setTodos] = useState([]);
  const [editingTodo, setEditingTodo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // On 401 the api client logs the user out (via AuthContext), which redirects
  // to /login — so we don't surface that as an error here.
  const showError = (err) => {
    if (err.status !== 401) setError(err.message);
  };

  const fetchTodos = async () => {
    try {
      setError(null);
      setTodos(await todosApi.list());
    } catch (err) {
      showError(err);
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
      const newTodo = await todosApi.create(title);
      setTodos((prev) => [newTodo, ...prev]);
    } catch (err) {
      showError(err);
    }
  };

  const updateTodo = async (id, updates) => {
    try {
      setError(null);
      const updated = await todosApi.update(id, updates);
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditingTodo(null);
    } catch (err) {
      showError(err);
    }
  };

  const deleteTodo = async (id) => {
    try {
      setError(null);
      await todosApi.remove(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      showError(err);
    }
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>Todo App</h1>
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
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
          onToggle={(id, completed) => updateTodo(id, { completed: !completed })}
          onDelete={deleteTodo}
          onEdit={setEditingTodo}
        />
      )}
    </div>
  );
}
