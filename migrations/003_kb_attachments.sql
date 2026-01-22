-- Create kb_attachments table
CREATE TABLE IF NOT EXISTS kb_attachments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES knowledge_base(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX idx_kb_attachments_article_id ON kb_attachments(article_id);
