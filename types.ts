
export type EquipmentStatus = 'active' | 'maintenance' | 'faulty';
export type RemoteAccessType = 'anydesk' | 'rdp' | 'vpn' | 'rudesktop' | 'rustdesk' | 'other';
export type UserRole = 'admin' | 'engineer' | 'viewer';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  email: string | null;
  password_plain?: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}


export interface SiteContact {
  id: number;
  site_id: number;
  fio: string;
  phone?: string;
  email?: string;
  position?: string;
  comments?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  name: string;
  contact_info?: string; // Will be deprecated
  created_at: string;
  updated_at: string;
  warranty_start_date?: string;
  paid_support_start_date?: string;
  paid_support_end_date?: string;
}

export interface Site {
  id: number;
  client_id: number;
  name: string;
  address: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  contacts?: SiteContact[];
  line_count?: number;
  l3_provider?: string;
  l3_provider_custom?: string;
}

export interface ProductionLine {
  id: number;
  site_id: number;
  client_id?: number;
  name: string;
  description: string;
  mounting_features: string;
  cabinet_number?: string;
  operational_specifics: string;
  tooltip_message?: string;
  // Параметры БД Линии
  db_ip?: string;
  db_name?: string;
  db_user?: string;
  db_password?: string;
  db_notes?: string;
  // Support dates
  warranty_start_date?: string;
  paid_support_start_date?: string;
  paid_support_end_date?: string;
}

export interface EquipmentType {
  id: number;
  name: string;
  description: string;
}

export interface Equipment {
  id: number;
  line_id: number;
  type_id: number;
  serial_number?: string;
  article: string | null;
  model: string;
  status: EquipmentStatus;
  install_date: string;
  notes: string;
  // Интегрированные сетевые поля
  ip_address?: string;
  subnet_mask?: string;
  gateway?: string;
  db_connection?: string;
  display_order?: number;
}


export interface NetworkConfig {
  id: number;
  equipment_id: number;
  ip_address: string;
  subnet_mask: string;
  gateway: string;
  db_connection?: string;
  notes?: string;
}

export interface RemoteAccess {
  id: number;
  line_id: number;
  type: RemoteAccessType;
  credentials: string; // Encrypted field
  url_or_address: string;
  notes: string;
}

export interface Task {
  id: number;
  name: string;
  description: string;
}

export interface LineTask {
  line_id: number;
  task_id: number;
  config_details: string;
}

export interface Instruction {
  id: number;
  line_task_id: string; // Surrogate for composite
  module_type: string;
  link: string;
  version: string;
  notes: string;
}

export interface AuditLog {
  id: number;
  user: string;
  action: string;
  entity: string;
  timestamp: string;
  details: string;
}

export interface KnowledgeBaseAttachment {
  id: number;
  article_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface KnowledgeBaseArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  attachments?: KnowledgeBaseAttachment[];
}

export interface TicketCategory {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: number;
  client_id: number;
  line_id: number | null;
  user_id: number;
  contact_name: string;
  problem_description: string;
  solution_description: string | null;
  status: 'in_progress' | 'solved' | 'unsolved' | 'on_hold';
  support_line: 1 | 2 | 3;
  category_id?: number | null;
  // Время обращения и решения (ISO строки)
  reported_at?: string;
  resolved_at?: string;
  // Время работы
  work_started_at?: string | null;
  total_work_minutes?: number;
  created_at: string;
  updated_at: string;
  client_name?: string;
  line_name?: string;
  engineer_name?: string;
  category_name?: string;
  // Сроки поддержки для контекста
  client_warranty_start?: string;
  client_paid_support_start?: string;
  client_paid_support_end?: string;
  line_warranty_start?: string;
  line_paid_support_start?: string;
  line_paid_support_end?: string;
}

export interface CameraParams {
  resolutionWidth: number;
  resolutionHeight: number;
  fovWidth: number;
  fovHeight: number;
  pixelSizeUm: number;
  distanceMm: number;
  moduleSizeMm: number;
  lensFocalLengthMm: number;
}

export interface CameraPreset {
  id: number;
  name: string;
  resolution_width: number;
  resolution_height: number;
  pixel_size_um: number;
  has_built_in_lens: boolean;
  lens_focal_length_mm?: number | null;
}

export interface CalculationResult {
  pixelsPerMmW: number;
  pixelsPerMmH: number;
  ppmW: number;
  ppmH: number;
  ppm: number;
  sensorWidthMm: number;
  sensorHeightMm: number;
  magnification: number;
  isReliable: boolean;
  reliabilityStatus: 'low' | 'acceptable' | 'stable';
  statusMessage: string;
  opticalFovW: number;
  discrepancy: number;
}
