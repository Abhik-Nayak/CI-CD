function TodoList({ todos, onToggle, onDelete, onEdit }) {
  if (todos.length === 0) {
    return <p className="empty">No todos yet. Add one above!</p>;
  }

  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <li key={todo.id} className={todo.completed ? "completed" : ""}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggle(todo.id, todo.completed)}
          />
          <span className="todo-title">{todo.title}</span>
          <div className="actions">
            <button className="edit-btn" onClick={() => onEdit(todo)}>
              Edit
            </button>
            <button className="delete-btn" onClick={() => onDelete(todo.id)}>
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default TodoList;
