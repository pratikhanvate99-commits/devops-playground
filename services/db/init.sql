CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prepopulate with some initial tasks
INSERT INTO tasks (title, description, status) VALUES 
('Setup CI/CD Pipeline', 'Configure linting and security scanning workflows', 'completed'),
('Deploy Prometheus & Grafana', 'Provision monitoring data sources and dashboard panels', 'completed'),
('Verify Service Self-Healing', 'Kill containers and verify Docker restart policies', 'pending');
