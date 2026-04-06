#!/bin/bash
# 🛡️ Скрипт автоматического бэкапа TechSupport Pro (для Ubuntu)
# Этот скрипт сохраняет Базу Данных и загруженные файлы (картинки/инструкции)

# 1. Настройки (пути)
BACKUP_DIR="/root/backups"
APP_DIR="/root/app"
DATE=$(date +%Y-%m-%d_%H%M%S)

# Создаем папку для бэкапов, если её нет
mkdir -p $BACKUP_DIR

# 2. Бэкап Базы Данных (PostgreSQL)
echo "--- Начинаю бэкап базы данных ---"
pg_dump -U techadmin techsupport_db > $BACKUP_DIR/db_$DATE.sql

# 3. Бэкап загруженных файлов (папка uploads)
echo "--- Начинаю архивацию файлов (мануалы, картинки) ---"
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $APP_DIR uploads/

# 4. Очистка старых бэкапов (удаляем всё, что старше 30 дней)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "--- Бэкап успешно завершен! Файлы в $BACKUP_DIR ---"
