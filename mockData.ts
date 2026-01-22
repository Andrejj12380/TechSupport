
import { Client, Site, ProductionLine, Equipment, EquipmentType, RemoteAccess, NetworkConfig, AuditLog } from './types';

export const CLIENTS: Client[] = [
  { id: 1, name: 'ООО ТехноПром', contact_info: 'Иван Петров, +7 900 123-45-67', created_at: '2023-01-15', updated_at: '2023-01-15' },
  { id: 2, name: 'АО ПищеМаш', contact_info: 'Мария Сидорова, m.sidorova@pishche.ru', created_at: '2023-02-20', updated_at: '2023-02-20' },
  { id: 3, name: 'ГК СтройСнаб', contact_info: 'Алексей Волков, info@stroysnab.com', created_at: '2023-03-10', updated_at: '2023-03-10' },
];

export const SITES: Site[] = [
  { id: 1, client_id: 1, name: 'Завод №1 (Запад)', address: 'г. Москва, ул. Промышленная, 12' },
  { id: 2, client_id: 1, name: 'Складской терминал', address: 'МО, г. Подольск, проезд Строителей, 45' },
  { id: 3, client_id: 2, name: 'Цех №4 (Хлебозавод)', address: 'г. Казань, ул. Центральная, 8' },
];

export const LINES: ProductionLine[] = [
  {
    id: 1,
    site_id: 1,
    name: 'Линия упаковки A1',
    description: 'Автоматическая линия фасовки',
    mounting_features: 'Требуется усиленный фундамент',
    operational_specifics: 'Работа в 3 смены',
    db_ip: '192.168.1.50',
    db_name: 'prod_line_a1',
    db_user: 'operator',
    db_password: 'Password123!',
    db_notes: 'База данных SCADA системы'
  },
  {
    id: 2,
    site_id: 1,
    name: 'Конвейер B2',
    description: 'Транспортировочная лента',
    mounting_features: 'Стандартный монтаж',
    operational_specifics: 'Низкая шумность',
    db_ip: '192.168.1.51',
    db_name: 'conveyor_db',
    db_user: 'admin',
    db_password: 'root_password',
    db_notes: 'Логирование событий конвейера'
  },
];

export const EQUIP_TYPES: EquipmentType[] = [
  { id: 1, name: 'Контроллер (PLC)', description: 'Программируемый логический контроллер' },
  { id: 2, name: 'Привод', description: 'Частотный преобразователь' },
  { id: 3, name: 'Сенсор', description: 'Датчик приближения или веса' },
];

export const EQUIPMENT: Equipment[] = [
  {
    id: 1,
    line_id: 1,
    type_id: 1,
    serial_number: 'SN-001-XYZ',
    article: null,
    model: 'Siemens S7-1200',
    status: 'active',
    install_date: '2023-05-12',
    notes: 'Прошивка v2.4',
    ip_address: '192.168.1.10',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.1.1',
    db_connection: 'Server=192.168.1.10;Database=Production;'
  },
  {
    id: 2,
    line_id: 1,
    type_id: 2,
    serial_number: 'DR-99-ABC',
    article: null,
    model: 'Danfoss VLT',
    status: 'maintenance',
    install_date: '2023-06-01',
    notes: 'Требуется замена подшипников',
    ip_address: '192.168.1.11'
  },
  {
    id: 3,
    line_id: 2,
    type_id: 3,
    serial_number: 'SE-12345',
    article: null,
    model: 'Sick GL6',
    status: 'faulty',
    install_date: '2023-07-20',
    notes: 'Сгорел блок питания',
    ip_address: '192.168.2.50'
  },
];

export const REMOTE_ACCESS: RemoteAccess[] = [
  { id: 1, line_id: 1, type: 'anydesk', credentials: 'Encrypted:User/Pass', url_or_address: '123 456 789', notes: 'Пароль у дежурного инженера' },
  { id: 2, line_id: 2, type: 'vpn', credentials: 'Encrypted:Certs', url_or_address: 'vpn.client.ru', notes: 'Через OpenVPN' },
];

export const NETWORK_CONFIGS: NetworkConfig[] = [
  { id: 1, equipment_id: 1, ip_address: '192.168.1.10', subnet_mask: '255.255.255.0', gateway: '192.168.1.1', db_connection: 'Encrypted:ConnStr', notes: 'Главный ПЛК' },
];

export const AUDIT_LOGS: AuditLog[] = [
  { id: 1, user: 'admin', action: 'CREATE', entity: 'Client', timestamp: '2023-10-25 14:00', details: 'Добавлен клиент ООО ТехноПром' },
  { id: 2, user: 'support', action: 'UPDATE', entity: 'Equipment', timestamp: '2023-10-25 15:30', details: 'Изменен статус оборудования SN-001-XYZ на Активен' },
];
