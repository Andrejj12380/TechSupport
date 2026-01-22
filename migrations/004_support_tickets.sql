-- Support Ticket System Migration
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    line_id INTEGER REFERENCES production_lines(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    contact_name VARCHAR(255) NOT NULL,
    problem_description TEXT NOT NULL,
    solution_description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'solved', 'unsolved')),
    support_line INTEGER NOT NULL CHECK (support_line IN (1, 2, 3)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_support_tickets_updated_at 
BEFORE UPDATE ON support_tickets 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_tickets_client ON support_tickets(client_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_created ON support_tickets(created_at);
