DELETE FROM equipment;

INSERT INTO equipment (line_id, type_id, serial_number, model, article, status, install_date, notes, ip_address, subnet_mask, gateway, db_connection, display_order) VALUES
(1, 1, 'SN-001-XYZ', 'Siemens S7-1200', '6ES7212-1BE40-0XB0', 'active', '2023-05-12', 'Firmware v2.4', '192.168.1.10', '255.255.255.0', '192.168.1.1', 'Server=192.168.1.10;Database=Production;', 1),
(1, 2, 'DR-99-ABC', 'Danfoss VLT', 'VLT2800-123', 'maintenance', '2023-06-01', 'Requires bearing replacement', '192.168.1.11', '255.255.255.0', '192.168.1.1', NULL, 2),
(2, 3, 'SE-12345', 'Sick GL6', 'GL6-R12', 'faulty', '2023-07-20', 'Power supply burned', '192.168.2.50', '255.255.255.0', '192.168.2.1', NULL, 1),
(1, 1, 'SN-002-LMN', 'Siemens S7-1500', '6ES7513-1AL00-0AB0', 'active', '2023-08-15', 'Main controller', '192.168.1.12', '255.255.255.0', '192.168.1.1', 'Server=192.168.1.12;Database=Main;', 3),
(1, 2, 'DR-200-DEF', 'ABB ACS880', 'ACS880-01-0126A-4', 'active', '2023-09-10', 'Variable frequency drive', '192.168.1.13', '255.255.255.0', '192.168.1.1', NULL, 4),
(2, 3, 'SE-54321', 'Omron E3X', 'E3X-DA11', 'active', '2023-10-05', 'Photoelectric sensor', '192.168.2.51', '255.255.255.0', '192.168.2.1', NULL, 2),
(1, 1, 'SN-003-OPQ', 'Rockwell ControlLogix', '1756-L71', 'active', '2023-11-20', 'Backup PLC', '192.168.1.14', '255.255.255.0', '192.168.1.1', 'Server=192.168.1.14;Database=Backup;', 5),
(2, 2, 'DR-300-GHI', 'Schneider ATV320', 'ATV320U03N4', 'maintenance', '2023-12-01', 'Scheduled maintenance', '192.168.2.52', '255.255.255.0', '192.168.2.1', NULL, 3),
(1, 3, 'SE-98765', 'Keyence LV', 'LV-H42', 'active', '2024-01-15', 'Laser sensor', '192.168.1.15', '255.255.255.0', '192.168.1.1', NULL, 6),
(2, 1, 'SN-004-RST', 'Mitsubishi FX3U', 'FX3U-32MT', 'faulty', '2024-02-10', 'Communication failure', '192.168.2.53', '255.255.255.0', '192.168.2.1', NULL, 4);
