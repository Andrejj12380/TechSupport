import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool, types } = pkg;
// Force DATE (1082) to be returned as string, avoiding timezone shifts
types.setTypeParser(1082, val => val);
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection test
console.log('Starting server with port:', process.env.PORT || 5001);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Auto-migration: Ensure site_contacts table exists
pool.query(`
  CREATE TABLE IF NOT EXISTS site_contacts (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
    fio TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    position TEXT,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => console.log('✓ site_contacts table ensured'))
  .catch(err => console.error('✗ Failed to ensure site_contacts table:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'techsupport-pro-secret-key-2025';

// Configure Multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/kb');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function ensureTicketCategories() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration for existing table: add description if missing
    const descColRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ticket_categories' AND column_name = 'description'");
    if (descColRes.rows.length === 0) {
      await pool.query('ALTER TABLE ticket_categories ADD COLUMN description TEXT');
      console.log('Applied migration: added ticket_categories.description');
    }

    await pool.query('CREATE INDEX IF NOT EXISTS idx_ticket_categories_active ON ticket_categories(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ticket_categories_sort_order ON ticket_categories(sort_order)');
    // If duplicates already exist with different casing, merge them deterministically:
    // keep the most recently updated row, re-point tickets, delete the rest.
    const dupRes = await pool.query(`
      SELECT LOWER(name) AS name_lc, array_agg(id ORDER BY updated_at DESC, id DESC) AS ids
      FROM ticket_categories
      GROUP BY LOWER(name)
      HAVING COUNT(*) > 1
    `);

    for (const row of dupRes.rows) {
      const ids = row.ids || [];
      const keepId = ids[0];
      const dropIds = ids.slice(1);
      if (!keepId || dropIds.length === 0) continue;

      await pool.query(
        'UPDATE support_tickets SET category_id = $1 WHERE category_id = ANY($2::int[])',
        [keepId, dropIds]
      );
      await pool.query('DELETE FROM ticket_categories WHERE id = ANY($1::int[])', [dropIds]);
    }

    // Prevent case-variant duplicates (e.g. "Принтер" vs "принтер")
    // Must run AFTER dedupe, otherwise index creation will fail.
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS ux_ticket_categories_name_lower ON ticket_categories (LOWER(name))');

    // Seed defaults ONLY on first run (when table is empty).
    // This avoids re-creating categories you already edited/renamed.
    const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM ticket_categories');
    const cnt = countRes.rows[0]?.cnt ?? 0;
    if (cnt === 0) {
      await pool.query(
        `INSERT INTO ticket_categories (name, is_active, sort_order) VALUES
          ('Принтер', true, 10),
          ('Аппликатор', true, 20),
          ('Камера', true, 30),
          ('Контур', true, 40),
          ('Кластер', true, 50),
          ('Не известно', true, 999)
         ON CONFLICT DO NOTHING`
      );
    }

    const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name = 'category_id'");
    if (colRes.rows.length === 0) {
      await pool.query('ALTER TABLE support_tickets ADD COLUMN category_id INTEGER');
      console.log('Applied migration: added support_tickets.category_id');
    }

    const fkRes = await pool.query("SELECT tc.constraint_name FROM information_schema.table_constraints tc WHERE tc.table_name = 'support_tickets' AND tc.constraint_type = 'FOREIGN KEY' AND tc.constraint_name = 'support_tickets_category_id_fkey'");
    if (fkRes.rows.length === 0) {
      await pool.query('ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE SET NULL');
      console.log('Applied migration: added support_tickets.category_id FK');
    }

    await pool.query('CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON support_tickets(category_id)');

    const unknownRes = await pool.query("SELECT id FROM ticket_categories WHERE LOWER(name) = LOWER('Не известно') LIMIT 1");
    const unknownId = unknownRes.rows[0]?.id;
    if (unknownId) {
      await pool.query('UPDATE support_tickets SET category_id = $1 WHERE category_id IS NULL', [unknownId]);
    }

    console.log('Applied migration: ensured ticket categories');
  } catch (err) {
    console.error('Error ensuring ticket categories:', err);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if session exists in DB
    const sessionRes = await pool.query(
      'SELECT * FROM user_sessions WHERE user_id = $1 AND token_hash = $2 AND expires_at > CURRENT_TIMESTAMP',
      [decoded.id, token]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    const userRes = await pool.query('SELECT id, username, role, email FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) return res.status(401).json({ error: 'User not found' });

    req.user = userRes.rows[0];
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Check permissions middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    next();
  };
};

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight for all routes explicitly
app.options('*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/api/ticket-categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, is_active, sort_order, created_at, updated_at FROM ticket_categories ORDER BY sort_order ASC, name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching ticket categories:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/ticket-categories', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { name, description, is_active, sort_order } = req.body;
    if (!name || String(name).trim() === '') return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `INSERT INTO ticket_categories (name, description, is_active, sort_order)
       VALUES ($1, $2, COALESCE($3, true), COALESCE($4, 0))
       RETURNING id, name, description, is_active, sort_order, created_at, updated_at`,
      [String(name).trim(), description, is_active, sort_order]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating ticket category:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ticket-categories/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active, sort_order } = req.body;
    if (!name || String(name).trim() === '') return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(
      `UPDATE ticket_categories
       SET name = $1, description = $2, is_active = COALESCE($3, is_active), sort_order = COALESCE($4, sort_order), updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, description, is_active, sort_order, created_at, updated_at`,
      [String(name).trim(), description, is_active, sort_order, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating ticket category:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ticket-categories/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const usedRes = await pool.query('SELECT 1 FROM support_tickets WHERE category_id = $1 LIMIT 1', [id]);
    if (usedRes.rows.length > 0) {
      const result = await pool.query(
        `UPDATE ticket_categories
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, name, description, is_active, sort_order, created_at, updated_at`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
      return res.json({ success: true, mode: 'deactivated', category: result.rows[0] });
    }

    const result = await pool.query('DELETE FROM ticket_categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true, mode: 'deleted' });
  } catch (err) {
    console.error('Error deleting ticket category:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/analytics/categories', authenticateToken, async (req, res) => {
  try {
    const { period } = req.query;
    let interval = null;
    if (period === '7d') interval = "7 days";
    else if (period === '30d') interval = "30 days";
    else if (period === '90d') interval = "90 days";
    else if (period === '365d') interval = "365 days";

    const filterClause = interval ? `AND t.reported_at >= NOW() - INTERVAL '${interval}'` : '';

    const query = `
      SELECT c.id as category_id, c.name as category_name, c.description,
              COUNT(t.id) FILTER (WHERE 1=1 ${filterClause}) as total_tickets,
              COUNT(t.id) FILTER (WHERE t.status = 'in_progress' ${filterClause}) as open_tickets,
              COUNT(t.id) FILTER (WHERE t.status = 'on_hold' ${filterClause}) as on_hold_tickets,
              COUNT(t.id) FILTER (WHERE t.status = 'solved' ${filterClause}) as solved_tickets,
              COUNT(t.id) FILTER (WHERE t.status = 'unsolved' ${filterClause}) as unsolved_tickets,
              ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.reported_at)) / 3600.0)
                    FILTER (WHERE t.resolved_at IS NOT NULL AND t.reported_at IS NOT NULL), 2) as avg_total,
              ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.reported_at)) / 3600.0)
                    FILTER (WHERE t.resolved_at IS NOT NULL AND t.reported_at IS NOT NULL AND t.reported_at >= NOW() - INTERVAL '7 days'), 2) as avg_7d,
              ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.reported_at)) / 3600.0)
                    FILTER (WHERE t.resolved_at IS NOT NULL AND t.reported_at IS NOT NULL AND t.reported_at >= NOW() - INTERVAL '30 days'), 2) as avg_30d,
              ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.reported_at)) / 3600.0)
                    FILTER (WHERE t.resolved_at IS NOT NULL AND t.reported_at IS NOT NULL AND t.reported_at >= NOW() - INTERVAL '90 days'), 2) as avg_90d,
              ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.reported_at)) / 3600.0)
                    FILTER (WHERE t.resolved_at IS NOT NULL AND t.reported_at IS NOT NULL AND t.reported_at >= NOW() - INTERVAL '365 days'), 2) as avg_365d,
              COUNT(t.id) FILTER (WHERE t.reported_at >= NOW() - INTERVAL '7 days') as last_7d_tickets
       FROM ticket_categories c
       LEFT JOIN support_tickets t ON t.category_id = c.id
       WHERE c.is_active = true
       GROUP BY c.id, c.name, c.description
       ORDER BY total_tickets DESC, c.name ASC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching ticket category analytics:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test database connection
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: 'connected',
      time: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// --- Auth Endpoints ---

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const userRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = userRes.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    // Save session to DB
    await pool.query(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'24 hours\')',
      [user.id, token]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    await pool.query('DELETE FROM user_sessions WHERE user_id = $1 AND token_hash = $2', [req.user.id, token]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json(req.user);
});

// --- User Management Endpoints (Admin Only) ---

// Get all users
app.get('/api/users', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, email, password_plain, created_at, updated_at FROM users ORDER BY username ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user
app.post('/api/users', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { username, password, role, email } = req.body;
    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role, email, password_plain) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, email, password_plain',
      [username, password_hash, role, email, password]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, email, password } = req.body;

    let query = 'UPDATE users SET username = $1, role = $2, email = $3, updated_at = CURRENT_TIMESTAMP';
    const params = [username, role, email, id];

    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET username = $1, role = $2, email = $3, password_hash = $5, password_plain = $6, updated_at = CURRENT_TIMESTAMP';
      params.push(password_hash, password);
    }

    query += ' WHERE id = $4 RETURNING id, username, role, email, password_plain';

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clients endpoints
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { name, contact_info, warranty_start_date, paid_support_start_date, paid_support_end_date } = req.body;

    // Normalize dates (empty string -> null)
    const wDate = warranty_start_date || null;
    const psDate = paid_support_start_date || null;
    const peDate = paid_support_end_date || null;

    const result = await pool.query(
      'INSERT INTO clients (name, contact_info, warranty_start_date, paid_support_start_date, paid_support_end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, contact_info, wDate, psDate, peDate]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { name, contact_info, warranty_start_date, paid_support_start_date, paid_support_end_date } = req.body;

    // Normalize dates
    const wDate = warranty_start_date || null;
    const psDate = paid_support_start_date || null;
    const peDate = paid_support_end_date || null;

    const result = await pool.query(
      'UPDATE clients SET name = $1, contact_info = $2, warranty_start_date = $3, paid_support_start_date = $4, paid_support_end_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name, contact_info, wDate, psDate, peDate, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM clients WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sites endpoints
app.get('/api/sites/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      `SELECT s.*, 
       (SELECT json_agg(sc ORDER BY sc.created_at) FROM site_contacts sc WHERE sc.site_id = s.id) as contacts,
       (SELECT COUNT(*)::int FROM production_lines pl WHERE pl.site_id = s.id) as line_count
       FROM sites s WHERE s.client_id = $1 ORDER BY s.name`,
      [clientId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sites', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { client_id, name, address, notes, l3_provider, l3_provider_custom } = req.body;
    const result = await pool.query(
      'INSERT INTO sites (client_id, name, address, notes, l3_provider, l3_provider_custom) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [client_id, name, address, notes, l3_provider, l3_provider_custom]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sites/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { name, address, notes, l3_provider, l3_provider_custom } = req.body;
    const result = await pool.query(
      'UPDATE sites SET name = $1, address = $2, notes = $3, l3_provider = $4, l3_provider_custom = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name, address, notes, l3_provider, l3_provider_custom, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sites/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM sites WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Site Contacts endpoints
app.post('/api/sites/:siteId/contacts', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { siteId } = req.params;
    const { fio, phone, email, position, comments } = req.body;
    const result = await pool.query(
      'INSERT INTO site_contacts (site_id, fio, phone, email, position, comments) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [siteId, fio, phone, email, position, comments]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/site-contacts/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { fio, phone, email, position, comments } = req.body;
    const result = await pool.query(
      'UPDATE site_contacts SET fio = $1, phone = $2, email = $3, position = $4, comments = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [fio, phone, email, position, comments, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/site-contacts/:id', authenticateToken, authorize(['admin', 'engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM site_contacts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Production Lines endpoints

// Get ALL lines (for dashboard stats)
app.get('/api/lines/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pl.*, s.client_id 
      FROM production_lines pl
      JOIN sites s ON pl.site_id = s.id
      ORDER BY pl.name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/lines/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const result = await pool.query(
      'SELECT * FROM production_lines WHERE site_id = $1 ORDER BY name',
      [siteId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lines', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const {
      site_id, name, description, mounting_features, cabinet_number,
      operational_specifics, tooltip_message, db_ip, db_name, db_user, db_password, db_notes,
      warranty_start_date, paid_support_start_date, paid_support_end_date
    } = req.body;

    // Normalize values
    const wDate = warranty_start_date || null;
    const psDate = paid_support_start_date || null;
    const peDate = paid_support_end_date || null;
    const tMessage = tooltip_message || null;
    const dIp = db_ip || null;
    const dName = db_name || null;
    const dUser = db_user || null;
    const dPass = db_password || null;
    const dNotes = db_notes || null;
    const cabNum = cabinet_number || null;

    const result = await pool.query(
      `INSERT INTO production_lines 
       (site_id, name, description, mounting_features, cabinet_number, operational_specifics, tooltip_message,
        db_ip, db_name, db_user, db_password, db_notes,
        warranty_start_date, paid_support_start_date, paid_support_end_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [site_id, name, description, mounting_features, cabNum, operational_specifics, tMessage,
        dIp, dName, dUser, dPass, dNotes,
        wDate, psDate, peDate]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/lines/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const {
      name, description, mounting_features, cabinet_number, operational_specifics, tooltip_message,
      db_ip, db_name, db_user, db_password, db_notes,
      warranty_start_date, paid_support_start_date, paid_support_end_date
    } = req.body;

    // Normalize values
    const wDate = warranty_start_date || null;
    const psDate = paid_support_start_date || null;
    const peDate = paid_support_end_date || null;
    const tMessage = tooltip_message || null;
    const dIp = db_ip || null;
    const dName = db_name || null;
    const dUser = db_user || null;
    const dPass = db_password || null;
    const dNotes = db_notes || null;
    const cabNum = cabinet_number || null;

    const result = await pool.query(
      `UPDATE production_lines SET 
       name = $1, description = $2, mounting_features = $3, cabinet_number = $4, operational_specifics = $5, tooltip_message = $6,
       db_ip = $7, db_name = $8, db_user = $9, db_password = $10, db_notes = $11,
       warranty_start_date = $12, paid_support_start_date = $13, paid_support_end_date = $14,
       updated_at = CURRENT_TIMESTAMP WHERE id = $15 RETURNING *`,
      [name, description, mounting_features, cabNum, operational_specifics, tMessage,
        dIp, dName, dUser, dPass, dNotes,
        wDate, psDate, peDate, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lines/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM production_lines WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Duplicate a production line (and its related data) for faster setup
app.post('/api/lines/:id/duplicate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;

    await client.query('BEGIN');

    const srcLineRes = await client.query('SELECT * FROM production_lines WHERE id = $1', [id]);
    const srcLine = srcLineRes.rows[0];
    if (!srcLine) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Line not found' });
    }

    // Generate a unique name within the same site (UNIQUE(site_id, name))
    const baseName = `${srcLine.name} (копия)`;
    let newName = baseName;
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await client.query(
        'SELECT 1 FROM production_lines WHERE site_id = $1 AND name = $2 LIMIT 1',
        [srcLine.site_id, newName]
      );
      if (exists.rowCount === 0) break;
      newName = `${srcLine.name} (копия ${i})`;
      i += 1;
    }

    const newLineRes = await client.query(
      `INSERT INTO production_lines
       (site_id, name, description, mounting_features, cabinet_number, operational_specifics, tooltip_message,
        db_ip, db_name, db_user, db_password, db_notes,
        warranty_start_date, paid_support_start_date, paid_support_end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        srcLine.site_id,
        newName,
        srcLine.description,
        srcLine.mounting_features,
        srcLine.cabinet_number || null,
        srcLine.operational_specifics,
        srcLine.tooltip_message || null,
        srcLine.db_ip,
        srcLine.db_name,
        srcLine.db_user,
        srcLine.db_password,
        srcLine.db_notes,
        srcLine.warranty_start_date || null,
        srcLine.paid_support_start_date || null,
        srcLine.paid_support_end_date || null,
      ]
    );

    const newLine = newLineRes.rows[0];

    // Duplicate equipment (including network fields)
    const eqRes = await client.query(
      `SELECT type_id, serial_number, model, article, status, install_date, notes,
              ip_address, subnet_mask, gateway, db_connection, display_order
       FROM equipment
       WHERE line_id = $1
       ORDER BY display_order ASC, created_at ASC`,
      [srcLine.id]
    );

    for (const eq of eqRes.rows) {
      // serial_number is UNIQUE, so do not copy it
      await client.query(
        `INSERT INTO equipment
         (line_id, type_id, serial_number, model, article, status, install_date, notes,
          ip_address, subnet_mask, gateway, db_connection, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          newLine.id,
          eq.type_id,
          null,
          eq.model,
          eq.article,
          eq.status,
          eq.install_date,
          eq.notes,
          eq.ip_address,
          eq.subnet_mask,
          eq.gateway,
          eq.db_connection,
          eq.display_order ?? 0,
        ]
      );
    }

    // Duplicate remote access records
    const raRes = await client.query(
      `SELECT type, credentials, url_or_address, notes
       FROM remote_access
       WHERE line_id = $1
       ORDER BY created_at ASC`,
      [srcLine.id]
    );
    for (const ra of raRes.rows) {
      await client.query(
        `INSERT INTO remote_access (line_id, type, credentials, url_or_address, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [newLine.id, ra.type, ra.credentials, ra.url_or_address, ra.notes]
      );
    }

    // Duplicate instructions (keep line_task_id as-is; it is informational in this app)
    const instrRes = await client.query(
      `SELECT line_task_id, module_type, link, version, notes
       FROM instructions
       WHERE line_id = $1
       ORDER BY created_at ASC`,
      [srcLine.id]
    );
    for (const ins of instrRes.rows) {
      await client.query(
        `INSERT INTO instructions (line_id, line_task_id, module_type, link, version, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [newLine.id, ins.line_task_id, ins.module_type, ins.link, ins.version, ins.notes]
      );
    }

    await client.query('COMMIT');
    res.json(newLine);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Equipment endpoints
app.get('/api/equipment/:lineId?', async (req, res) => {
  try {
    const { lineId } = req.params;
    let query = `
      SELECT e.*, et.name as type_name, et.description as type_description,
             pl.name as line_name, s.name as site_name, c.name as client_name
      FROM equipment e
      JOIN equipment_types et ON e.type_id = et.id
      JOIN production_lines pl ON e.line_id = pl.id
      JOIN sites s ON pl.site_id = s.id
      JOIN clients c ON s.client_id = c.id
    `;
    const params = [];

    if (lineId) {
      query += ' WHERE e.line_id = $1';
      params.push(lineId);
    }
    query += ' ORDER BY e.display_order ASC, e.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/equipment-types', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM equipment_types ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/equipment', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const {
      line_id, type_id, article, model, status,
      install_date, notes, ip_address, subnet_mask, gateway, db_connection
    } = req.body;

    // Normalize empty strings to null to avoid DB type errors (INET/DATE)
    const normalizedIp = ip_address && ip_address !== '' ? ip_address : null;
    const normalizedMask = subnet_mask && subnet_mask !== '' ? subnet_mask : null;
    const normalizedGateway = gateway && gateway !== '' ? gateway : null;
    const normalizedDbConn = db_connection && db_connection !== '' ? db_connection : null;
    const normalizedInstallDate = install_date && install_date !== '' ? install_date : null;

    // Get max display_order for this line and add 1
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM equipment WHERE line_id = $1',
      [line_id]
    );
    const display_order = maxOrderResult.rows[0].next_order;

    const result = await pool.query(
      `INSERT INTO equipment 
       (line_id, type_id, article, model, status, install_date, notes, 
        ip_address, subnet_mask, gateway, db_connection, display_order) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [line_id, type_id, article, model, status, normalizedInstallDate, notes,
        normalizedIp, normalizedMask, normalizedGateway, normalizedDbConn, display_order]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding equipment:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/equipment/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    let {
      type_id, article, model, status,
      install_date, notes, ip_address, subnet_mask, gateway, db_connection
    } = req.body;

    // Normalize empty strings to null to avoid DB type errors (INET/DATE)
    ip_address = ip_address && ip_address !== '' ? ip_address : null;
    subnet_mask = subnet_mask && subnet_mask !== '' ? subnet_mask : null;
    gateway = gateway && gateway !== '' ? gateway : null;
    db_connection = db_connection && db_connection !== '' ? db_connection : null;
    install_date = install_date && install_date !== '' ? install_date : null;

    const result = await pool.query(
      `UPDATE equipment SET 
       type_id = $1, article = $2, model = $3, status = $4, 
       install_date = $5, notes = $6, ip_address = $7, subnet_mask = $8, 
       gateway = $9, db_connection = $10, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $11 RETURNING *`,
      [type_id, article, model, status, install_date, notes,
        ip_address, subnet_mask, gateway, db_connection, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating equipment:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/equipment/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE equipment SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update equipment display order
app.patch('/api/equipment/:id/order', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { display_order } = req.body;
    const result = await pool.query(
      'UPDATE equipment SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [display_order, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/equipment/:id', authenticateToken, authorize(['admin', 'engineer']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM equipment WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search endpoint
app.get('/api/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const term = `%${q}%`;
    const results = [];

    // Clients
    const clients = await pool.query('SELECT * FROM clients WHERE name ILIKE $1 OR contact_info ILIKE $1 ORDER BY name LIMIT 10', [term]);
    clients.rows.forEach(c => results.push({ type: 'Клиент', name: c.name, id: c.id, raw: c }));

    // Production Lines
    const lines = await pool.query('SELECT pl.*, c.name as client_name, c.id as client_id FROM production_lines pl JOIN sites s ON pl.site_id = s.id JOIN clients c ON s.client_id = c.id WHERE pl.name ILIKE $1 OR pl.cabinet_number ILIKE $1 ORDER BY pl.name LIMIT 10', [term]);
    lines.rows.forEach(l => results.push({ type: 'Линия', name: `${l.name} (${l.client_name})`, id: l.id, raw: l }));

    // Equipment
    const equipment = await pool.query(
      `SELECT e.*, et.name as type_name, pl.name as line_name, s.name as site_name, c.name as client_name
       FROM equipment e
       LEFT JOIN equipment_types et ON e.type_id = et.id
       LEFT JOIN production_lines pl ON e.line_id = pl.id
       LEFT JOIN sites s ON pl.site_id = s.id
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE e.model ILIKE $1 OR e.article ILIKE $1 OR e.notes ILIKE $1
       ORDER BY e.model LIMIT 20`,
      [term]
    );
    equipment.rows.forEach(e => results.push({
      type: 'Оборудование',
      name: `${e.model} (${e.article})`,
      id: e.id,
      raw: e
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Remote Access endpoints
app.get('/api/remote-access/:lineId', async (req, res) => {
  try {
    const { lineId } = req.params;
    const result = await pool.query(
      'SELECT * FROM remote_access WHERE line_id = $1',
      [lineId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/remote-access', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { line_id, type, credentials, url_or_address, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO remote_access (line_id, type, credentials, url_or_address, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [line_id, type, credentials, url_or_address, notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/remote-access/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { type, credentials, url_or_address, notes } = req.body;
    const result = await pool.query(
      'UPDATE remote_access SET type = $1, credentials = $2, url_or_address = $3, notes = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [type, credentials, url_or_address, notes, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/remote-access/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    await pool.query('DELETE FROM remote_access WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Instructions endpoints
app.get('/api/instructions/:lineId', async (req, res) => {
  try {
    const { lineId } = req.params;
    const result = await pool.query('SELECT * FROM instructions WHERE line_id = $1 ORDER BY created_at DESC', [lineId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching instructions:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/instructions', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { line_id, module_type, link, version, notes, line_task_id } = req.body;
    if (!line_id) return res.status(400).json({ error: 'line_id is required' });
    if (!link) return res.status(400).json({ error: 'link is required' });

    // line_task_id is required by schema; generate a sensible default when missing
    const taskId = line_task_id || `manual-${line_id}-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO instructions (line_id, line_task_id, module_type, link, version, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [line_id, taskId, module_type || null, link, version || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating instruction:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/instructions/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { module_type, link, version, notes, line_task_id } = req.body;
    if (!link) return res.status(400).json({ error: 'link is required' });

    const result = await pool.query(
      `UPDATE instructions SET module_type = $1, link = $2, version = $3, notes = $4, line_task_id = COALESCE($5, line_task_id), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *`,
      [module_type || null, link, version || null, notes || null, line_task_id || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Instruction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating instruction:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/instructions/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM instructions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Instruction not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting instruction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download or proxy instruction file/link
app.get('/api/instructions/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM instructions WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Instruction not found' });
    const instruction = result.rows[0];
    const link = instruction.link;
    if (!link) return res.status(404).json({ error: 'No link provided' });

    // If HTTP(S), redirect
    if (/^https?:\/\//i.test(link)) {
      return res.redirect(link);
    }

    // If file URI (file://) or UNC or absolute path, attempt to read from filesystem
    let filePath = link;

    // file://server/share/path or file:///C:/path
    if (/^file:\/\//i.test(link)) {
      try {
        const u = new URL(link);
        filePath = decodeURIComponent(u.pathname);
        // On Windows, pathname may start with /C:/... remove leading slash
        if (process.platform === 'win32' && filePath.startsWith('/')) {
          filePath = filePath.slice(1);
        }
      } catch (err) {
        console.error('Invalid file:// URL:', err);
        return res.status(400).json({ error: 'Invalid file URL' });
      }
    }

    // Convert forward/back slashes to OS-specific separators for fs
    filePath = filePath.replace(/\\/g, path.sep).replace(/\//g, path.sep);

    // Check file existence and stream
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ error: 'File not found on server' });
    }

    const filename = path.basename(filePath);
    // Sanitize filename to avoid invalid header characters (quotes, control chars)
    const safeFilename = filename.replace(/\"|\r|\n/g, '_').replace(/[\x00-\x1F\x7F]/g, '_');
    // Provide both a safe ASCII fallback and an RFC5987 encoded UTF-8 filename* value
    const encodedFilename = encodeURIComponent(filename);
    try {
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
    } catch (err) {
      // Fallback: set a very conservative filename
      console.error('Failed to set Content-Disposition header with original filename, using fallback. Error:', err);
      res.setHeader('Content-Disposition', `inline; filename="file"`);
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Error streaming file:', err);
      res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Error downloading instruction:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/remote-access/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { type, credentials, url_or_address, notes } = req.body;
    const result = await pool.query(
      'UPDATE remote_access SET type = $1, credentials = $2, url_or_address = $3, notes = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [type, credentials, url_or_address, notes, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit logs endpoint
app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Knowledge Base endpoints
app.get('/api/kb', async (req, res) => {
  try {
    const { category, tag, q } = req.query;
    let query = 'SELECT * FROM knowledge_base';
    const params = [];
    const conditions = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (tag) {
      params.push(tag);
      conditions.push(`$${params.length} = ANY(tags)`);
    }

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/kb/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM knowledge_base WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/kb', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { title, content, category, tags } = req.body;
    const result = await pool.query(
      'INSERT INTO knowledge_base (title, content, category, tags) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, category, tags]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/kb/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    const { id } = req.params;
    const { title, content, category, tags } = req.body;
    const result = await pool.query(
      'UPDATE knowledge_base SET title = $1, content = $2, category = $3, tags = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [title, content, category, tags, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/kb/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM knowledge_base WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// KB Attachments Endpoints
app.get('/api/kb/:articleId/attachments', async (req, res) => {
  try {
    const { articleId } = req.params;
    const result = await pool.query(
      'SELECT * FROM kb_attachments WHERE article_id = $1 ORDER BY created_at DESC',
      [articleId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/kb/:articleId/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { articleId } = req.params;
    console.log('KB attachment upload attempt for article', articleId, 'user', req.user?.id, 'filePresent', !!req.file);
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const result = await pool.query(
      'INSERT INTO kb_attachments (article_id, filename, original_name, mime_type, size_bytes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [articleId, filename, originalname, mimetype, size]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file and create an instruction record for a production line
app.post('/api/instructions/:lineId/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { lineId } = req.params;
    console.log('Instruction attachment upload attempt for line', lineId, 'user', req.user?.id, 'filePresent', !!req.file);
    if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const link = `/uploads/kb/${filename}`; // served statically
    const taskId = `manual-${lineId}-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO instructions (line_id, line_task_id, module_type, link, version, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [lineId, taskId, originalname, link, null, null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error uploading instruction attachment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/kb/attachments/:id', authenticateToken, authorize(['admin', 'engineer']), async (req, res) => {
  try {
    const { id } = req.params;

    // Get file info first to delete from disk
    const infoRes = await pool.query('SELECT filename FROM kb_attachments WHERE id = $1', [id]);
    if (infoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const filePath = path.join(uploadDir, infoRes.rows[0].filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM kb_attachments WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Support Tickets Endpoints ---

// Helper to get lines by client
app.get('/api/clients/:clientId/lines', authenticateToken, async (req, res) => {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT pl.* FROM production_lines pl
             JOIN sites s ON pl.site_id = s.id
             WHERE s.client_id = $1`,
      [clientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Analyze ticket for similar solutions
app.post('/api/tickets/analyze', authenticateToken, async (req, res) => {
  try {
    const { description, problem_type } = req.body;
    if (!description) return res.status(400).json({ error: 'Description is required' });

    console.log(`Analyzing ticket: "${description}"`);

    // Use pg_trgm similarity to find matches
    // We filter for tickets that have a solution ('solved' or have resolution_details)
    // We return top 3 matches
    const result = await pool.query(
      `SELECT t.id, t.problem_description,
              COALESCE(t.solution_description, '') as resolution_details,
              t.status,
              similarity(t.problem_description, $1) as relevance,
              pl.name as line_name
       FROM support_tickets t
       LEFT JOIN production_lines pl ON t.line_id = pl.id
       WHERE (t.status = 'solved' OR t.solution_description IS NOT NULL)
         AND similarity(t.problem_description, $1) > 0.05
       ORDER BY relevance DESC
       LIMIT 3`,
      [description]
    );

    console.log(`Found ${result.rows.length} similar tickets`);

    res.json(result.rows);
  } catch (err) {
    console.error('Error analyzing ticket:', err);
    res.status(500).json({ error: 'Server error during analysis' });
  }
});

// Get all tickets with filters
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const { clientId, status, supportLine } = req.query;
    let query = `
            SELECT t.*, c.name as client_name, pl.name as line_name, u.username as engineer_name,
                   tc.name as category_name,
                   c.warranty_start_date as client_warranty_start,
                   c.paid_support_start_date as client_paid_support_start,
                   c.paid_support_end_date as client_paid_support_end,
                   pl.warranty_start_date as line_warranty_start,
                   pl.paid_support_start_date as line_paid_support_start,
                   pl.paid_support_end_date as line_paid_support_end
            FROM support_tickets t
            JOIN clients c ON t.client_id = c.id
            LEFT JOIN production_lines pl ON t.line_id = pl.id
            LEFT JOIN ticket_categories tc ON t.category_id = tc.id
            JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;
    const params = [];

    if (clientId) {
      params.push(clientId);
      query += ` AND t.client_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    if (supportLine) {
      params.push(supportLine);
      query += ` AND t.support_line = $${params.length}`;
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a ticket
app.post('/api/tickets', authenticateToken, async (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'Access denied' });
  const { client_id, line_id, contact_name, problem_description, solution_description, status, support_line, reported_at, resolved_at, category_id } = req.body;
  try {
    // Basic validation
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });
    if (!contact_name) return res.status(400).json({ error: 'contact_name is required' });
    if (!problem_description) return res.status(400).json({ error: 'problem_description is required' });

    const unknownRes = await pool.query("SELECT id FROM ticket_categories WHERE LOWER(name) = LOWER('Не известно') LIMIT 1");
    const unknownId = unknownRes.rows[0]?.id || null;
    const resolvedCategoryId = category_id || unknownId;

    const result = await pool.query(
      `INSERT INTO support_tickets 
            (client_id, line_id, user_id, contact_name, problem_description, solution_description, status, support_line, reported_at, resolved_at, category_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, CURRENT_TIMESTAMP), $10::timestamptz, $11)
            RETURNING *`,
      [client_id, line_id, req.user.id, contact_name, problem_description, solution_description, status || 'in_progress', support_line, reported_at || null, resolved_at || null, resolvedCategoryId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update a ticket
app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { line_id, contact_name, problem_description, solution_description, status, support_line, reported_at, resolved_at, category_id } = req.body;
  try {
    // Only allow engineer or admin to update
    if (req.user.role === 'viewer') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Basic validation
    if (!contact_name) return res.status(400).json({ error: 'contact_name is required' });
    if (!problem_description) return res.status(400).json({ error: 'problem_description is required' });

    // If status is 'solved' and no resolved_at provided, set it to now
    let resolvedAtValue = resolved_at || null;
    if (status === 'solved' && !resolvedAtValue) {
      resolvedAtValue = new Date().toISOString();
    }

    const result = await pool.query(
      `UPDATE support_tickets 
            SET line_id = $1, contact_name = $2, problem_description = $3, 
                solution_description = $4, status = $5, support_line = $6, reported_at = $7::timestamptz, resolved_at = $8::timestamptz, updated_at = CURRENT_TIMESTAMP
                , category_id = COALESCE($9, category_id), user_id = COALESCE($11, user_id)
            WHERE id = $10
            RETURNING *`,
      [line_id, contact_name, problem_description, solution_description, status, support_line, reported_at || null, resolvedAtValue, category_id || null, id, req.body.user_id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a ticket
app.delete('/api/tickets/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM support_tickets WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ message: 'Ticket deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start work on a ticket
app.post('/api/tickets/:id/work/start', authenticateToken, authorize(['admin', 'engineer']), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE support_tickets 
       SET work_started_at = CURRENT_TIMESTAMP, status = 'in_progress' 
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop work on a ticket
app.post('/api/tickets/:id/work/stop', authenticateToken, authorize(['admin', 'engineer']), async (req, res) => {
  const { id } = req.params;
  try {
    const ticketRes = await pool.query('SELECT work_started_at, total_work_minutes FROM support_tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const ticket = ticketRes.rows[0];
    if (!ticket.work_started_at) return res.status(400).json({ error: 'Work not started' });

    const start = new Date(ticket.work_started_at);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.max(1, Math.ceil(diffMs / (1000 * 60))); // Min 1 minute if started

    const result = await pool.query(
      `UPDATE support_tickets 
       SET total_work_minutes = COALESCE(total_work_minutes, 0) + $2, 
           work_started_at = NULL 
       WHERE id = $1 RETURNING *`,
      [id, diffMins]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause work on a ticket (stops timer, sets status to on_hold)
app.post('/api/tickets/:id/work/pause', authenticateToken, authorize(['admin', 'engineer']), async (req, res) => {
  const { id } = req.params;
  try {
    const ticketRes = await pool.query('SELECT work_started_at, total_work_minutes FROM support_tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const ticket = ticketRes.rows[0];
    if (!ticket.work_started_at) {
      // If already paused, just ensure status is on_hold
      await pool.query("UPDATE support_tickets SET status = 'on_hold' WHERE id = $1", [id]);
      const updated = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
      return res.json(updated.rows[0]);
    }

    const start = new Date(ticket.work_started_at);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.max(1, Math.ceil(diffMs / (1000 * 60)));

    const result = await pool.query(
      `UPDATE support_tickets 
       SET total_work_minutes = COALESCE(total_work_minutes, 0) + $2, 
           work_started_at = NULL,
           status = 'on_hold'
       WHERE id = $1 RETURNING *`,
      [id, diffMins]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function ensureTicketTimestamps() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'support_tickets' AND column_name IN ('reported_at','resolved_at')");
    const existing = res.rows.map(r => r.column_name);
    const queries = [];

    if (!existing.includes('reported_at')) {
      queries.push("ALTER TABLE support_tickets ADD COLUMN reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP");
    }
    if (!existing.includes('resolved_at')) {
      queries.push("ALTER TABLE support_tickets ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE");
    }
    if (!existing.includes('work_started_at')) {
      queries.push("ALTER TABLE support_tickets ADD COLUMN work_started_at TIMESTAMP WITH TIME ZONE");
    }
    if (!existing.includes('total_work_minutes')) {
      queries.push("ALTER TABLE support_tickets ADD COLUMN total_work_minutes INTEGER DEFAULT 0");
    }

    for (const q of queries) {
      await pool.query(q);
    }

    if (queries.length) {
      await pool.query("CREATE INDEX IF NOT EXISTS idx_tickets_reported_at ON support_tickets(reported_at)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at ON support_tickets(resolved_at)");
      console.log('Applied migrations: added ticket timestamp columns');
    } else {
      console.log('Ticket timestamp columns already exist');
    }
  } catch (err) {
    console.error('Error ensuring ticket timestamp columns:', err);
    // don't crash the server — let errors be visible in logs
  }
}

async function ensureInstructionsLineFk() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'instructions' AND column_name = 'line_id'");
    if (res.rows.length === 0) {
      await pool.query("ALTER TABLE instructions ADD COLUMN line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_instructions_line_id ON instructions(line_id)");
      console.log('Applied migration: added instructions.line_id column');
    } else {
      console.log('instructions.line_id already exists');
    }
  } catch (err) {
    console.error('Error ensuring instructions.line_id column:', err);
  }
}

async function ensureClientSupportColumns() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clients' AND column_name IN ('warranty_start_date', 'paid_support_start_date', 'paid_support_end_date')");
    const existing = res.rows.map(r => r.column_name);
    const queries = [];

    if (!existing.includes('warranty_start_date')) queries.push("ALTER TABLE clients ADD COLUMN warranty_start_date DATE");
    if (!existing.includes('paid_support_start_date')) queries.push("ALTER TABLE clients ADD COLUMN paid_support_start_date DATE");
    if (!existing.includes('paid_support_end_date')) queries.push("ALTER TABLE clients ADD COLUMN paid_support_end_date DATE");

    for (const q of queries) await pool.query(q);
    if (queries.length) console.log('Applied migration: added client support columns');
  } catch (err) {
    console.error('Error ensuring client support columns:', err);
  }
}

async function ensureLineSupportColumns() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'production_lines' AND column_name IN ('warranty_start_date', 'paid_support_start_date', 'paid_support_end_date')");
    const existing = res.rows.map(r => r.column_name);
    const queries = [];

    if (!existing.includes('warranty_start_date')) queries.push("ALTER TABLE production_lines ADD COLUMN warranty_start_date DATE");
    if (!existing.includes('paid_support_start_date')) queries.push("ALTER TABLE production_lines ADD COLUMN paid_support_start_date DATE");
    if (!existing.includes('paid_support_end_date')) queries.push("ALTER TABLE production_lines ADD COLUMN paid_support_end_date DATE");

    for (const q of queries) await pool.query(q);
    if (queries.length) console.log('Applied migration: added line support columns');
  } catch (err) {
    console.error('Error ensuring line support columns:', err);
  }
}

async function ensureUserPlaintextPassword() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_plain'");
    if (res.rows.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN password_plain TEXT");
      console.log('Applied migration: added users.password_plain column');
    } else {
      console.log('users.password_plain already exists');
    }
  } catch (err) {
    console.error('Error ensuring users.password_plain column:', err);
  }
}

async function ensureLineCabinetNumber() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'production_lines' AND column_name = 'cabinet_number'");
    if (res.rows.length === 0) {
      await pool.query("ALTER TABLE production_lines ADD COLUMN cabinet_number TEXT");
      console.log('Applied migration: added production_lines.cabinet_number column');
    } else {
      console.log('production_lines.cabinet_number already exists');
    }
  } catch (err) {
    console.error('Error ensuring production_lines.cabinet_number column:', err);
  }
}

async function ensurePgTrgm() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('Applied migration: enabled pg_trgm extension');
  } catch (err) {
    console.error('Error enabling pg_trgm extension:', err);
  }
}

async function ensureRemoteAccessEnum() {
  try {
    const res = await pool.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'remote_access_type_enum'");
    const existingValues = res.rows.map(r => r.enumlabel);

    if (!existingValues.includes('rudesktop')) {
      await pool.query("ALTER TYPE remote_access_type_enum ADD VALUE 'rudesktop'");
      console.log('Applied migration: added rudesktop to remote_access_type_enum');
    }

    if (!existingValues.includes('rustdesk')) {
      await pool.query("ALTER TYPE remote_access_type_enum ADD VALUE 'rustdesk'");
      console.log('Applied migration: added rustdesk to remote_access_type_enum');
    }
  } catch (err) {
    console.error('Error ensuring remote_access_type_enum values:', err);
  }
}

async function ensureSiteL3Provider() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'l3_provider'");
    if (res.rows.length === 0) {
      await pool.query('ALTER TABLE sites ADD COLUMN l3_provider TEXT');
      await pool.query('ALTER TABLE sites ADD COLUMN l3_provider_custom TEXT');
      console.log('Applied migration: added l3_provider columns to sites');
    }
  } catch (err) {
    console.error('Error ensuring site L3 provider columns:', err);
  }
}

async function ensureTicketStatusMigration() {
  try {
    const res = await pool.query("UPDATE support_tickets SET status = 'in_progress' WHERE status = 'open' RETURNING id");
    if (res.rowCount > 0) {
      console.log(`Applied migration: updated ${res.rowCount} 'open' tickets to 'in_progress'`);
    }
  } catch (err) {
    console.error('Error during ticket status migration:', err);
  }
}

async function ensureSupportTicketStatusConstraint() {
  try {
    // Drop existing constraint if it exists. Postgres usually names it support_tickets_status_check
    // but it's safer to check the information_schema
    const checkRes = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.constraint_column_usage 
      WHERE table_name = 'support_tickets' AND column_name = 'status'
    `);

    for (const row of checkRes.rows) {
      if (row.constraint_name.includes('status_check')) {
        await pool.query(`ALTER TABLE support_tickets DROP CONSTRAINT ${row.constraint_name}`);
        console.log(`Dropped old status constraint: ${row.constraint_name}`);
      }
    }

    // Add new constraint including on_hold
    await pool.query(`
      ALTER TABLE support_tickets 
      ADD CONSTRAINT support_tickets_status_check 
      CHECK (status IN ('in_progress', 'solved', 'unsolved', 'on_hold'))
    `);
    console.log('Applied migration: added status check constraint for support_tickets');
  } catch (err) {
    // If it already exists with the same name, it might fail, which is fine if we just want it ensured
    if (!err.message.includes('already exists')) {
      console.error('Error ensuring support_ticket status constraint:', err);
    }
  }
}

ensureTicketCategories()
  .then(() => ensureTicketTimestamps())
  .then(() => ensureInstructionsLineFk())
  .then(() => ensureClientSupportColumns())
  .then(() => ensureLineSupportColumns())
  .then(() => ensureUserPlaintextPassword())
  .then(() => ensureLineCabinetNumber())
  .then(() => ensurePgTrgm())
  .then(() => ensureRemoteAccessEnum())
  .then(() => ensureSiteL3Provider())
  .then(() => ensureTicketStatusMigration())
  .then(() => ensureSupportTicketStatusConstraint())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database: ${process.env.DB_NAME}`);
    });
  }).catch(err => {
    console.error('Failed to ensure DB schema:', err);
    process.exit(1);
  });
