import { useState, useEffect } from "react";

function TodoForm({ onSubmit, editingTodo, onUpdate, onCancelEdit }) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (editingTodo) {
      setTitle(editingTodo.title);
    }
  }, [editingTodo]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingTodo) {
      onUpdate(editingTodo.id, { title: title.trim() });
    } else {
      onSubmit(title.trim());
    }
    setTitle("");
  };

  return (
    <form className="todo-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
      />
      <button type="submit">{editingTodo ? "Update" : "Add"}</button>
      {editingTodo && (
        <button
          type="button"
          className="cancel-btn"
          onClick={() => {
            onCancelEdit();
            setTitle("");
          }}
        >
          Cancel
        </button>
      )}
    </form>
  );
}

export default TodoForm;
