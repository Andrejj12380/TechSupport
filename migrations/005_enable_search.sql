-- Enable pg_trgm extension for fuzzy string matching (similarity searches)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for faster similarity searches on Support Tickets
-- Using GIN index with gin_trgm_ops for standard fuzzy matching

CREATE INDEX IF NOT EXISTS idx_support_tickets_problem_trgm 
ON support_tickets 
USING GIN (problem_description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_support_tickets_solution_trgm 
ON support_tickets 
USING GIN (solution_description gin_trgm_ops);

-- Also add index for title just in case
CREATE INDEX IF NOT EXISTS idx_support_tickets_title_trgm 
ON support_tickets 
USING GIN (title gin_trgm_ops);
