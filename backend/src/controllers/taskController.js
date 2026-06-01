const { validationResult } = require('express-validator');
const pool = require('../config/db');

const getAllTasks = async (req, res, next) => {
  try {
    const { status, priority, sort = 'created_at', order = 'DESC' } = req.query;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (priority) {
      conditions.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }

    const allowedSorts = ['created_at', 'updated_at', 'title', 'priority', 'status'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = 'SELECT * FROM tasks';
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ` ORDER BY ${sortCol} ${sortOrder}`;

    const result = await pool.query(query, values);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, status = 'pending', priority = 'medium' } = req.body;
    const result = await pool.query(
      'INSERT INTO tasks (title, description, status, priority) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description || null, status, priority]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, description, status, priority } = req.body;
    const result = await pool.query(
      `UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), priority = COALESCE($4, priority), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, description, status, priority, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllTasks, getTaskById, createTask, updateTask, deleteTask };
