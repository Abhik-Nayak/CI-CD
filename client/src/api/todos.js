import { api } from "./client";

// todo-service endpoints (gateway routes /api/todos → todo-service).
const BASE = "/api/todos";

export const todosApi = {
  list: () => api.get(BASE),
  create: (title) => api.post(BASE, { title }),
  update: (id, updates) => api.put(`${BASE}/${id}`, updates),
  remove: (id) => api.delete(`${BASE}/${id}`),
};
