-- PostgreSQL Database Schema for Equipment Management System
-- Created for TechSupport Pro Equipment Management System

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (for clean re-creation)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS instructions CASCADE;
DROP TABLE IF EXISTS line_tasks CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS remote_access CASCADE;
DROP TABLE IF EXISTS network_configs CASCADE;
DROP TABLE IF EXISTS equipment CASCADE;
DROP TABLE IF EXISTS equipment_types CASCADE;
DROP TABLE IF EXISTS production_lines CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- Enum types for better data integrity
CREATE TYPE equipment_status_enum AS ENUM ('active', 'maintenance', 'faulty');
CREATE TYPE remote_access_type_enum AS ENUM ('anydesk', 'rdp', 'vpn', 'other');

-- Clients table - stores client information
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sites table - stores site/location information for clients
CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    notes TEXT, -- Additional comments about the site
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, name)
);

-- Production lines table - stores production line information
CREATE TABLE production_lines (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mounting_features TEXT,
    operational_specifics TEXT,
    -- Database connection parameters for the line
    db_ip TEXT, -- Changed from INET to TEXT to allow localhost
    db_name VARCHAR(100),
    db_user VARCHAR(100),
    db_password TEXT, -- Should be encrypted in application layer
    db_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(site_id, name)
);

-- Equipment types table - stores categories of equipment
CREATE TABLE equipment_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Equipment table - stores individual equipment items
CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    line_id INTEGER NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL REFERENCES equipment_types(id),
    serial_number VARCHAR(100) UNIQUE,
    model VARCHAR(255) NOT NULL,
    article VARCHAR(100), -- Article/part number
    status equipment_status_enum NOT NULL DEFAULT 'active',
    install_date DATE,
    notes TEXT,
    display_order INTEGER DEFAULT 0, -- For ordering equipment display
    -- Network configuration fields (can be moved to network_configs table for normalization)
    ip_address INET,
    subnet_mask INET,
    gateway INET,
    db_connection TEXT, -- Should be encrypted in application layer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Network configurations table - detailed network settings for equipment
CREATE TABLE network_configs (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    subnet_mask INET NOT NULL,
    gateway INET NOT NULL,
    db_connection TEXT, -- Encrypted field
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(equipment_id)
);

-- Remote access table - stores remote access credentials for lines
CREATE TABLE remote_access (
    id SERIAL PRIMARY KEY,
    line_id INTEGER NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    type remote_access_type_enum NOT NULL,
    credentials TEXT, -- Encrypted field
    url_or_address VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table - stores available tasks
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Line tasks junction table - many-to-many relationship between lines and tasks
CREATE TABLE line_tasks (
    line_id INTEGER NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    config_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (line_id, task_id)
);

-- Instructions table - stores instructions for line tasks
CREATE TABLE instructions (
    id SERIAL PRIMARY KEY,
    line_task_id VARCHAR(50) NOT NULL, -- Composite key representation (line_id_task_id)
    module_type VARCHAR(255),
    link TEXT,
    version VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table - tracks all changes in the system
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, etc.
    entity VARCHAR(100) NOT NULL, -- Table name
    entity_id INTEGER, -- ID of the affected record
    details TEXT,
    old_values JSONB, -- Previous values for UPDATE operations
    new_values JSONB, -- New values for CREATE/UPDATE operations
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Support tickets table - tracks support requests and resolutions
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    problem_type VARCHAR(100), -- Type of problem (e.g., "network", "hardware", "software")
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved, closed
    reported_by VARCHAR(255), -- Who reported the issue
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_by VARCHAR(255), -- Who resolved the issue
    resolved_at TIMESTAMP WITH TIME ZONE, -- When the issue was resolved
    resolution_details TEXT, -- How the issue was resolved
    resolution_time_minutes INTEGER, -- Time to resolve in minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_sites_client_id ON sites(client_id);
CREATE INDEX idx_production_lines_site_id ON production_lines(site_id);
CREATE INDEX idx_equipment_line_id ON equipment(line_id);
CREATE INDEX idx_equipment_type_id ON equipment(type_id);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_network_configs_equipment_id ON network_configs(equipment_id);
CREATE INDEX idx_remote_access_line_id ON remote_access(line_id);
CREATE INDEX idx_line_tasks_line_id ON line_tasks(line_id);
CREATE INDEX idx_line_tasks_task_id ON line_tasks(task_id);
CREATE INDEX idx_instructions_line_task_id ON instructions(line_task_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_name);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX idx_support_tickets_equipment_id ON support_tickets(equipment_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_reported_at ON support_tickets(reported_at);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_lines_updated_at BEFORE UPDATE ON production_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_types_updated_at BEFORE UPDATE ON equipment_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_network_configs_updated_at BEFORE UPDATE ON network_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_remote_access_updated_at BEFORE UPDATE ON remote_access FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_line_tasks_updated_at BEFORE UPDATE ON line_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_instructions_updated_at BEFORE UPDATE ON instructions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_name, action, entity, entity_id, details, new_values)
        VALUES (current_user, TG_OP, TG_TABLE_NAME, NEW.id, 
                'Record created', row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_name, action, entity, entity_id, details, old_values, new_values)
        VALUES (current_user, TG_OP, TG_TABLE_NAME, NEW.id, 
                'Record updated', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_name, action, entity, entity_id, details, old_values)
        VALUES (current_user, TG_OP, TG_TABLE_NAME, OLD.id, 
                'Record deleted', row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to main tables
CREATE TRIGGER audit_clients_trigger AFTER INSERT OR UPDATE OR DELETE ON clients FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_sites_trigger AFTER INSERT OR UPDATE OR DELETE ON sites FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_production_lines_trigger AFTER INSERT OR UPDATE OR DELETE ON production_lines FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_equipment_types_trigger AFTER INSERT OR UPDATE OR DELETE ON equipment_types FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_equipment_trigger AFTER INSERT OR UPDATE OR DELETE ON equipment FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_network_configs_trigger AFTER INSERT OR UPDATE OR DELETE ON network_configs FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_remote_access_trigger AFTER INSERT OR UPDATE OR DELETE ON remote_access FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_tasks_trigger AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_line_tasks_trigger AFTER INSERT OR UPDATE OR DELETE ON line_tasks FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_instructions_trigger AFTER INSERT OR UPDATE OR DELETE ON instructions FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_support_tickets_trigger AFTER INSERT OR UPDATE OR DELETE ON support_tickets FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Create views for common queries
CREATE VIEW equipment_details AS
SELECT 
    e.id,
    e.serial_number,
    e.model,
    e.status,
    e.install_date,
    e.notes,
    e.ip_address,
    e.subnet_mask,
    e.gateway,
    et.name as equipment_type,
    et.description as equipment_type_description,
    pl.name as production_line,
    pl.description as line_description,
    s.name as site,
    s.address as site_address,
    c.name as client,
    c.contact_info as client_contact,
    e.created_at,
    e.updated_at
FROM equipment e
JOIN equipment_types et ON e.type_id = et.id
JOIN production_lines pl ON e.line_id = pl.id
JOIN sites s ON pl.site_id = s.id
JOIN clients c ON s.client_id = c.id;

CREATE VIEW line_summary AS
SELECT 
    pl.id,
    pl.name,
    pl.description,
    pl.db_ip,
    pl.db_name,
    s.name as site_name,
    s.address as site_address,
    c.name as client_name,
    COUNT(e.id) as equipment_count,
    COUNT(CASE WHEN e.status = 'active' THEN 1 END) as active_equipment,
    COUNT(CASE WHEN e.status = 'maintenance' THEN 1 END) as maintenance_equipment,
    COUNT(CASE WHEN e.status = 'faulty' THEN 1 END) as faulty_equipment,
    COUNT(ra.id) as remote_access_count
FROM production_lines pl
JOIN sites s ON pl.site_id = s.id
JOIN clients c ON s.client_id = c.id
LEFT JOIN equipment e ON pl.id = e.line_id
LEFT JOIN remote_access ra ON pl.id = ra.line_id
GROUP BY pl.id, pl.name, pl.description, pl.db_ip, pl.db_name, s.name, s.address, c.name;

-- Insert sample data (optional - can be removed for production)
INSERT INTO clients (name, contact_info) VALUES
('OOO TehnoProm', 'Ivan Petrov, +7 900 123-45-67'),
('AO PishcheMash', 'Maria Sidorova, m.sidorova@pishche.ru'),
('GK StroySna', 'Alexey Volkov, info@stroysnab.com');

INSERT INTO sites (client_id, name, address) VALUES
(1, 'Factory #1 (West)', 'Moscow, Promyshlennaya st, 12'),
(1, 'Warehouse Terminal', 'Moscow region, Podolsk, Stroiteley proezd, 45'),
(2, 'Workshop #4 (Bakery)', 'Kazan, Tsentralnaya st, 8');

INSERT INTO production_lines (site_id, name, description, mounting_features, operational_specifics, db_ip, db_name, db_user, db_password, db_notes) VALUES
(1, 'Packing Line A1', 'Automatic packing line', 'Requires reinforced foundation', 'Works in 3 shifts', '192.168.1.50', 'prod_line_a1', 'operator', 'Password123!', 'SCADA system database'),
(1, 'Conveyor B2', 'Transportation belt', 'Standard installation', 'Low noise', '192.168.1.51', 'conveyor_db', 'admin', 'root_password', 'Conveyor event logging');

INSERT INTO equipment_types (name, description) VALUES
('Controller (PLC)', 'Programmable logic controller'),
('Drive', 'Frequency converter'),
('Sensor', 'Proximity or weight sensor');

INSERT INTO equipment (line_id, type_id, serial_number, model, article, status, install_date, notes, ip_address, subnet_mask, gateway, db_connection) VALUES
(1, 1, 'SN-001-XYZ', 'Siemens S7-1200', '6ES7212-1BE40-0XB0', 'active', '2023-05-12', 'Firmware v2.4', '192.168.1.10', '255.255.255.0', '192.168.1.1', 'Server=192.168.1.10;Database=Production;'),
(1, 2, 'DR-99-ABC', 'Danfoss VLT', 'VLT2800-123', 'maintenance', '2023-06-01', 'Requires bearing replacement', '192.168.1.11', '255.255.255.0', '192.168.1.1', NULL),
(2, 3, 'SE-12345', 'Sick GL6', 'GL6-R12', 'faulty', '2023-07-20', 'Power supply burned', '192.168.2.50', '255.255.255.0', '192.168.2.1', NULL),
(1, 1, 'SN-002-LMN', 'Siemens S7-1500', '6ES7513-1AL00-0AB0', 'active', '2023-08-15', 'Main controller', '192.168.1.12', '255.255.255.0', '192.168.1.1', 'Server=192.168.1.12;Database=Main;'),
(1, 2, 'DR-200-DEF', 'ABB ACS880', 'ACS880-01-0126A-4', 'active', '2023-09-10', 'Variable frequency drive', '192.168.1.13', '255.255.255.0', '192.168.1.1', NULL),
(2, 3, 'SE-54321', 'Omron E3X', 'E3X-DA11', 'active', '2023-10-05', 'Photoelectric sensor', '192.168.2.51', '255.255.255.0', '192.168.2.1', NULL),
(1, 1, 'SN-003-OPQ', 'Rockwell ControlLogix', '1756-L71', 'active', '2023-11-20', 'Backup PLC', '192.168.1.14', '255.255.255.0', '192.168.1.1', 'Server=192.168.1.14;Database=Backup;'),
(2, 2, 'DR-300-GHI', 'Schneider ATV320', 'ATV320U03N4', 'maintenance', '2023-12-01', 'Scheduled maintenance', '192.168.2.52', '255.255.255.0', '192.168.2.1', NULL),
(1, 3, 'SE-98765', 'Keyence LV', 'LV-H42', 'active', '2024-01-15', 'Laser sensor', '192.168.1.15', '255.255.255.0', '192.168.1.1', NULL),
(2, 1, 'SN-004-RST', 'Mitsubishi FX3U', 'FX3U-32MT', 'faulty', '2024-02-10', 'Communication failure', '192.168.2.53', '255.255.255.0', '192.168.2.1', NULL);

INSERT INTO remote_access (line_id, type, credentials, url_or_address, notes) VALUES
(1, 'anydesk', 'Encrypted:User/Pass', '123 456 789', 'Password with duty engineer'),
(2, 'vpn', 'Encrypted:Certs', 'vpn.client.ru', 'Via OpenVPN');

INSERT INTO network_configs (equipment_id, ip_address, subnet_mask, gateway, db_connection, notes) VALUES
(1, '192.168.1.10', '255.255.255.0', '192.168.1.1', 'Encrypted:ConnStr', 'Main PLC');

-- Grant permissions (adjust as needed for your application)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- Create user roles (optional)
-- CREATE ROLE app_user WITH LOGIN PASSWORD 'your_app_password';
-- CREATE ROLE readonly_user WITH LOGIN PASSWORD 'your_readonly_password';

-- Comments for documentation
COMMENT ON TABLE clients IS 'Stores client company information';
COMMENT ON TABLE sites IS 'Stores site/location information for clients';
COMMENT ON TABLE production_lines IS 'Stores production line details including database connections';
COMMENT ON TABLE equipment_types IS 'Stores equipment categories';
COMMENT ON TABLE equipment IS 'Stores individual equipment items with network configuration';
COMMENT ON TABLE network_configs IS 'Detailed network settings for equipment';
COMMENT ON TABLE remote_access IS 'Remote access credentials for production lines';
COMMENT ON TABLE tasks IS 'Available tasks for production lines';
COMMENT ON TABLE line_tasks IS 'Junction table for many-to-many relationship between lines and tasks';
COMMENT ON TABLE instructions IS 'Instructions for specific line tasks';
COMMENT ON TABLE audit_logs IS 'Audit trail for all database changes';
COMMENT ON TABLE support_tickets IS 'Support requests and resolutions tracking for equipment';