-- Create camera_presets table
CREATE TABLE IF NOT EXISTS camera_presets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    resolution_width INTEGER NOT NULL,
    resolution_height INTEGER NOT NULL,
    pixel_size_um NUMERIC NOT NULL,
    has_built_in_lens BOOLEAN DEFAULT FALSE,
    lens_focal_length_mm NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_camera_presets_updated_at') THEN
        CREATE TRIGGER update_camera_presets_updated_at BEFORE UPDATE ON camera_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_camera_presets_trigger') THEN
        CREATE TRIGGER audit_camera_presets_trigger AFTER INSERT OR UPDATE OR DELETE ON camera_presets FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_camera_presets_name ON camera_presets(name);