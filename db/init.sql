CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO tasks (title, description, status, priority) VALUES
    ('Set up project', 'Initialize the PERN stack application', 'completed', 'high'),
    ('Design database schema', 'Create tables for task management', 'completed', 'high'),
    ('Build REST API', 'Implement CRUD endpoints', 'in_progress', 'high'),
    ('Create React UI', 'Build frontend components', 'in_progress', 'medium'),
    ('Add Docker support', 'Containerize the application', 'pending', 'medium'),
    ('Write tests', 'Add unit and integration tests', 'pending', 'low');
