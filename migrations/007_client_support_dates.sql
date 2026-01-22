-- Add support period tracking columns to clients table

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
ADD COLUMN IF NOT EXISTS paid_support_start_date DATE,
ADD COLUMN IF NOT EXISTS paid_support_end_date DATE;

COMMENT ON COLUMN clients.warranty_start_date IS 'Start date for the 12-month default warranty period';
COMMENT ON COLUMN clients.paid_support_start_date IS 'Start date for the paid technical support period';
COMMENT ON COLUMN clients.paid_support_end_date IS 'End date for the paid technical support period';
