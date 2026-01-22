# Настройка PostgreSQL для Equipment Management System

## 1. Установка PostgreSQL

### Windows:
1. Скачайте PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/
2. Установите PostgreSQL, запомните пароль пользователя postgres
3. Убедитесь, что PostgreSQL запущен как служба

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## 2. Создание базы данных

1. Откройте pgAdmin или используйте командную строку
2. Подключитесь к PostgreSQL с пользователем postgres
3. Выполните SQL-команды:

```sql
-- Создание базы данных
CREATE DATABASE equipment_management;

-- Создание пользователя (опционально)
CREATE USER equipment_user WITH PASSWORD 'your_password';

-- Предоставление прав пользователю
GRANT ALL PRIVILEGES ON DATABASE equipment_management TO equipment_user;
```

## 3. Настройка подключения

Откройте файл `.env` в корне проекта и установите правильные параметры:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=equipment_management
DB_USER=postgres
DB_PASSWORD=ВАШ_ПАРОЛЬ_ОТ_POSTGRES
```

## 4. Создание таблиц

Выполните SQL-скрипт `database.sql`:

### Через pgAdmin:
1. Откройте pgAdmin
2. Подключитесь к базе данных `equipment_management`
3. Откройте Query Tool
4. Скопируйте и выполните содержимое файла `database.sql`

### Через командную строку:
```bash
psql -U postgres -d equipment_management -f database.sql
```

## 5. Запуск приложения

1. Установите зависимости:
```bash
npm install
```

2. Запустите приложение:
```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3001

## 6. Проверка подключения

1. Откройте в браузере: http://localhost:3001
2. Проверьте, что данные загружаются из базы данных
3. Попробуйте добавить нового клиента - он должен сохраниться в базе

## Возможные проблемы

### "Database: undefined" в консоли сервера:
- Проверьте, что файл `.env` существует и заполнен правильно
- Убедитесь, что PostgreSQL запущен
- Проверьте правильность пароля в `.env`

### Ошибка "ECONNREFUSED":
- PostgreSQL не запущен
- Неверный порт (обычно 5432)
- Брандмауэр блокирует подключение

### Ошибка "database does not exist":
- База данных не создана
- Опечатка в названии базы данных в `.env`

### Ошибка "password authentication failed":
- Неверный пароль пользователя postgres
- Неверное имя пользователя

## Полезные команды PostgreSQL

```bash
# Проверка статуса PostgreSQL
sudo systemctl status postgresql

# Перезапуск PostgreSQL
sudo systemctl restart postgresql

# Подключение к базе данных
psql -U postgres -d equipment_management

# Просмотр таблиц
\dt

# Просмотр данных в таблице
SELECT * FROM clients;
```
