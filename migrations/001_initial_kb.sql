-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    category VARCHAR(100),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Apply triggers
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER audit_knowledge_base_trigger AFTER INSERT OR UPDATE OR DELETE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Indexes
CREATE INDEX idx_kb_title ON knowledge_base(title);
CREATE INDEX idx_kb_category ON knowledge_base(category);
