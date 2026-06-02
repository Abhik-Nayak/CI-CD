import { useState, useEffect } from "react";
import TodoForm from "./components/TodoForm";
import TodoList from "./components/TodoList";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [todos, setTodos] = useState([]);
  const [editingTodo, setEditingTodo] = useState(null);

  const fetchTodos = async () => {
    const res = await fetch(API_URL);
    const data = await res.json();
    setTodos(data);
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const addTodo = async (title) => {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) fetchTodos();
  };

  const updateTodo = async (id, updates) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      fetchTodos();
      setEditingTodo(null);
    }
  };

  const deleteTodo = async (id) => {
    const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (res.ok) fetchTodos();
  };

  return (
    <div className="app">
      <h1>Todo App</h1>
      <TodoForm
        onSubmit={addTodo}
        editingTodo={editingTodo}
        onUpdate={updateTodo}
        onCancelEdit={() => setEditingTodo(null)}
      />
      <TodoList
        todos={todos}
        onToggle={(id, completed) => updateTodo(id, { completed: !completed })}
        onDelete={deleteTodo}
        onEdit={setEditingTodo}
      />
    </div>
  );
}

export default App;
