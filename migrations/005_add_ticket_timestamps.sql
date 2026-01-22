-- Add reported_at and resolved_at to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Indexes for queries by reported/resolved time
CREATE INDEX IF NOT EXISTS idx_tickets_reported_at ON support_tickets(reported_at);
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at ON support_tickets(resolved_at);
