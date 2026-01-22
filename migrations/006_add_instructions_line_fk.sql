-- Add line_id to instructions and index
ALTER TABLE instructions
  ADD COLUMN IF NOT EXISTS line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_instructions_line_id ON instructions(line_id);