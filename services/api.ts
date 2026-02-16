import {
  AuthResponse,
  User,
  Client,
  Site,
  ProductionLine,
  Equipment,
  EquipmentStatus,
  RemoteAccess,
  Instruction,
  AuditLog,
  KnowledgeBaseArticle,
  KnowledgeBaseAttachment,
  SupportTicket,
  SiteContact,
  TicketCategory,
  CameraPreset
} from '../types';

class ApiService {
  private baseUrl = '/api';

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem('auth_token');

    // Build headers carefully: if body is FormData, do not set Content-Type so browser can add multipart boundary
    const headers: Record<string, string> = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        ...options,
      });
    } catch (err: any) {
      // Network-level error (CORS/preflight/network down)
      throw new Error(`Network error during API request: ${err && err.message ? err.message : String(err)}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        window.location.reload();
      }

      // Try to parse response body for better error messages
      let errorBody: any = null;
      try {
        const text = await response.text();
        errorBody = text ? JSON.parse(text) : null;
      } catch (e) {
        // not JSON
        errorBody = { message: (await response.text()) };
      }

      const errMsg = errorBody && (errorBody.error || errorBody.message) ? `${response.status} ${response.statusText}: ${errorBody.error || errorBody.message}` : `API Error: ${response.status} ${response.statusText}`;
      throw new Error(errMsg);
    }

    return response.json();
  }

  // Authentication
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data: AuthResponse = await response.json();
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('current_user', JSON.stringify(data.user));
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const userStr = localStorage.getItem('current_user');
    if (!userStr) return null;

    try {
      // Verify token is still valid
      const user = await this.request('/auth/me');
      return user;
    } catch {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      return null;
    }
  }

  // User Management (Admin Only)
  async getUsers(): Promise<User[]> {
    return this.request('/users');
  }

  async createUser(userData: any): Promise<User> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: number, userData: any): Promise<User> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: number): Promise<void> {
    await this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // Knowledge Base Attachments
  async getKbAttachments(articleId: number): Promise<KnowledgeBaseAttachment[]> {
    const response = await this.request(`/kb/${articleId}/attachments`);
    return response; // this.request already returns json
  }

  async uploadKbAttachment(articleId: number, formData: FormData): Promise<KnowledgeBaseAttachment> {
    const response = await this.request(`/kb/${articleId}/attachments`, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser handle boundary for FormData
    });
    return response; // this.request already returns json
  }

  async deleteKbAttachment(id: number): Promise<void> {
    await this.request(`/kb/attachments/${id}`, { method: 'DELETE' });
  }

  // Support Tickets
  async getTickets(filters?: { clientId?: number; status?: string; supportLine?: number }): Promise<SupportTicket[]> {
    const params = new URLSearchParams();
    if (filters?.clientId) params.append('clientId', filters.clientId.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.supportLine) params.append('supportLine', filters.supportLine.toString());

    const response = await this.request(`/tickets?${params.toString()}`);
    return response; // this.request already returns json
  }

  async createTicket(ticket: Partial<SupportTicket>): Promise<SupportTicket> {
    const response = await this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticket)
    });
    return response; // this.request already returns json
  }

  async updateTicket(id: number, ticket: Partial<SupportTicket>): Promise<SupportTicket> {
    const response = await this.request(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ticket)
    });
    return response; // this.request already returns json
  }

  async analyzeTicket(description: string): Promise<any[]> {
    const response = await this.request('/tickets/analyze', {
      method: 'POST',
      body: JSON.stringify({ description })
    });
    return response;
  }

  async deleteTicket(id: number): Promise<void> {
    return this.request(`/tickets/${id}`, {
      method: 'DELETE',
    });
  }

  async startTicketWork(id: number): Promise<SupportTicket> {
    return this.request(`/tickets/${id}/work/start`, {
      method: 'POST',
    });
  }

  async stopTicketWork(id: number): Promise<SupportTicket> {
    return this.request(`/tickets/${id}/work/stop`, {
      method: 'POST',
    });
  }

  async pauseTicketWork(id: number): Promise<SupportTicket> {
    return this.request(`/tickets/${id}/work/pause`, {
      method: 'POST',
    });
  }

  async getTicketCategories(): Promise<TicketCategory[]> {
    return this.request('/ticket-categories');
  }

  async createTicketCategory(data: Partial<TicketCategory>): Promise<TicketCategory> {
    return this.request('/ticket-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTicketCategory(id: number, data: Partial<TicketCategory>): Promise<TicketCategory> {
    return this.request(`/ticket-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTicketCategory(id: number): Promise<any> {
    return this.request(`/ticket-categories/${id}`, {
      method: 'DELETE',
    });
  }

  async getTicketCategoryAnalytics(period?: string): Promise<any[]> {
    const url = period ? `/tickets/analytics/categories?period=${period}` : '/tickets/analytics/categories';
    return this.request(url);
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return this.request('/clients');
  }

  async addClient(data: any) {
    return this.request('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: number, data: any) {
    return this.request(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: number) {
    return this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Sites
  async getSites(clientId: number): Promise<Site[]> {
    return this.request(`/sites/${clientId}`);
  }

  async addSite(data: any) {
    return this.request('/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSite(id: number, data: any) {
    return this.request(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSite(id: number) {
    return this.request(`/sites/${id}`, {
      method: 'DELETE',
    });
  }

  // Site Contacts
  async addSiteContact(siteId: number, data: Partial<SiteContact>): Promise<SiteContact> {
    return this.request(`/sites/${siteId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSiteContact(id: number, data: Partial<SiteContact>): Promise<SiteContact> {
    return this.request(`/site-contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSiteContact(id: number): Promise<void> {
    return this.request(`/site-contacts/${id}`, {
      method: 'DELETE',
    });
  }

  // Production Lines
  async getLines(siteId: number): Promise<ProductionLine[]> {
    return this.request(`/lines/${siteId}`);
  }

  async getProductionLines(clientId: number): Promise<ProductionLine[]> {
    return this.request(`/clients/${clientId}/lines`);
  }

  async getAllLines(): Promise<ProductionLine[]> {
    return this.request('/lines/all');
  }

  async duplicateLine(id: number): Promise<ProductionLine> {
    return this.request(`/lines/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async addLine(data: any) {
    return this.request('/lines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLine(id: number, data: any) {
    return this.request(`/lines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLine(id: number) {
    return this.request(`/lines/${id}`, {
      method: 'DELETE',
    });
  }

  // Equipment
  async getEquipment(lineId?: number): Promise<Equipment[]> {
    const endpoint = lineId ? `/equipment/${lineId}` : '/equipment';
    return this.request(endpoint);
  }

  async getEquipmentTypes() {
    return this.request('/equipment-types');
  }

  async addEquipment(data: Partial<Equipment>): Promise<Equipment> {
    return this.request('/equipment', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateEquipment(id: number, data: Partial<Equipment>): Promise<Equipment> {
    return this.request(`/equipment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async updateEquipmentStatus(id: number, status: string) {
    return this.request(`/equipment/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteEquipment(id: number) {
    return this.request(`/equipment/${id}`, {
      method: 'DELETE',
    });
  }

  // Remote Access
  async getRemoteAccess(lineId: number): Promise<RemoteAccess[]> {
    return this.request(`/remote-access/${lineId}`);
  }

  async saveRemoteAccess(id: number | null, data: any) {
    if (id) {
      return this.request(`/remote-access/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } else {
      return this.request('/remote-access', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  }

  async deleteRemoteAccess(id: number) {
    return this.request(`/remote-access/${id}`, {
      method: 'DELETE',
    });
  }

  // Instructions
  async getInstructions(lineId: number): Promise<Instruction[]> {
    const response = await this.request(`/instructions/${lineId}`);
    return response;
  }

  async saveInstruction(id: number | null, data: any) {
    if (id) {
      return this.request(`/instructions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      return this.request('/instructions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  }

  async deleteInstruction(id: number) {
    return this.request(`/instructions/${id}`, {
      method: 'DELETE'
    });
  }

  async uploadInstructionAttachment(lineId: number, formData: FormData) {
    const response = await this.request(`/instructions/${lineId}/attachments`, {
      method: 'POST',
      body: formData,
      headers: {} // allow browser to set multipart boundary
    });
    return response;
  }

  // Search
  async search(query: string) {
    return this.request(`/search?q=${encodeURIComponent(query)}`);
  }

  // Audit Logs
  async getLogs(): Promise<AuditLog[]> {
    return this.request('/logs');
  }

  // Knowledge Base
  async getKbArticles(category?: string, tag?: string, query?: string): Promise<any[]> {
    let url = '/kb?';
    if (category) url += `category=${encodeURIComponent(category)}&`;
    if (tag) url += `tag=${encodeURIComponent(tag)}&`;
    if (query) url += `q=${encodeURIComponent(query)}`;
    return this.request(url);
  }

  async getKbArticle(id: number): Promise<any> {
    return this.request(`/kb/${id}`);
  }

  async addKbArticle(data: any) {
    return this.request('/kb', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateKbArticle(id: number, data: any) {
    return this.request(`/kb/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteKbArticle(id: number) {
    return this.request(`/kb/${id}`, {
      method: 'DELETE',
    });
  }

  // Camera Presets
  async getCameraPresets(): Promise<CameraPreset[]> {
    return this.request('/camera-presets');
  }

  async addCameraPreset(data: Partial<CameraPreset>) {
    return this.request('/camera-presets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCameraPreset(id: number, data: Partial<CameraPreset>) {
    return this.request(`/camera-presets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCameraPreset(id: number) {
    return this.request(`/camera-presets/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
