# 🚀 Идеальный гайд по боевому деплою (TechSupport Pro)
*Этот гайд составлен на основе нашей успешной установки, содержит **все точные пути, логины и пароли**.*

---

## 🛠 ЭТАП 1: Подготовка сервера (Установка зависимостей)
Заходим на чистый Ubuntu сервер:
```bash
ssh root@ВАШ_IP_АДРЕС
```

Обновляем систему и устанавливаем нужные программы:
```bash
# Обновляем пакеты
sudo apt update && sudo apt upgrade -y

# Ставим Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Ставим Nginx (веб-сервер), Git (код) и PostgreSQL (базу данных)
sudo apt install -y nginx git postgresql postgresql-contrib

# Ставим PM2 (менеджер процессов для Node.js)
sudo npm install -g pm2
```

---

## 🗄 ЭТАП 2: Настройка Базы Данных
Устанавливаем пароль для системного пользователя `postgres` и создаем базу данных проекта:
```bash
# 1. Задаем пароль для пользователя postgres (пароль: postgres)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"

# 2. Создаем чистую базу данных (название: equipment_management)
sudo -u postgres psql -c "CREATE DATABASE equipment_management OWNER postgres;"
```

**Перенос базы данных с вашего ПК на Сервер:**
На **своем компьютере** в терминале проекта делаете дамп:
```cmd
pg_dump -U postgres -d equipment_management > prod_backup.sql
scp prod_backup.sql root@ВАШ_IP_АДРЕС:/root/TechSupport/
```
На **сервере** загружаете этот дамп в базу:
```bash
sudo -u postgres psql -d equipment_management -f /root/TechSupport/prod_backup.sql
```

---

## 📦 ЭТАП 3: Загрузка и настройка проекта
```bash
# 1. Скачиваем код (на сервере мы работаем в папке /root/TechSupport)
cd ~
git clone ВАША_ССЫЛКА_НА_GITHUB TechSupport  # ИЛИ если папка уже есть, просто cd ~/TechSupport && git pull

# 2. Заходим в папку и устанавливаем зависимости проекта
cd ~/TechSupport
npm install
```

Создаем системный файл окружения `.env`:
```bash
cat << 'EOF' > /root/TechSupport/.env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=equipment_management
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=super_secret_jwt_key_2026_pro
FRONTEND_URL=*
EOF
```

---

## 🏗 ЭТАП 4: Сборка и запуск
```bash
# 1. Собираем фронтенд (React/Vite) в статичную папку dist
npm run build

# 2. Запускаем Бэкенд с помощью PM2 на порту 5000
pm2 start server/index.js --name "tech-app"

# 3. Делаем так, чтобы бэкенд сам включался после перезагрузки сервера
pm2 startup
pm2 save
```

---

## 🌐 ЭТАП 5: Настройка Интернета (Nginx)
Nginx по умолчанию не имеет прав лазить в домашнюю директорию `/root`. Нужно дать ему права:
```bash
chmod 711 /root
chmod -R 755 /root/TechSupport
```

Создаем конфигурацию Nginx. Замените `ВАШ_ДОМЕН.ru` на ваш реальный домен, а `ВАШ_IP` на IP сервера.
```bash
cat << 'EOF' > /etc/nginx/sites-available/techsupport
server {
    listen 80 default_server;
    server_name ВАШ_ДОМЕН.ru www.ВАШ_ДОМЕН.ru ВАШ_IP;
    
    # Раздаем фронтенд-файлы React
    location / {
        root /root/TechSupport/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Раздаем загруженные файлы (инструкции/аватарки)
    location /uploads/ {
        alias /root/TechSupport/uploads/;
        autoindex off;
    }

    # Перенаправляем все запросы к /api/ на спрятанный Node.js бэкенд
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

Включаем конфигурацию:
```bash
# Удаляем стандартную заглушку Nginx
rm -f /etc/nginx/sites-enabled/default

# Активируем нашу
ln -s /etc/nginx/sites-available/techsupport /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

*После этого шага сайт уже доступен по IP-адресу!*

---

## 🔒 ЭТАП 6: SSL Сертификат (Зеленый замочек)
> ⚠️ **Внимание:** Запускайте только после того, как в панели DNS купленного домена вы прописали A-запись на IP сервера и подождали от 2 до 24 часов (DNS обновился).

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d ВАШ_ДОМЕН.ru -d www.ВАШ_ДОМЕН.ru --non-interactive --agree-tos -m admin@ВАШ_ДОМЕН.ru
```

---

## 🔄 ЭТАП 7: Ночные Бэкапы
Весь скрипт и задача создаются в 3 команды:
```bash
# 1. Создание скрипта
cat << 'EOF' > /root/backup.sh
#!/bin/bash
BACKUP_DIR="/root/backups"
APP_DIR="/root/TechSupport"
DATE=$(date +%Y-%m-%d_%H%M%S)

mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump -d equipment_management > $BACKUP_DIR/db_$DATE.sql
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $APP_DIR uploads/
find $BACKUP_DIR -type f -mtime +30 -delete
EOF

# 2. Выдача прав
chmod +x /root/backup.sh

# 3. Установка на 03:00 каждую ночь
(crontab -l 2>/dev/null; echo "0 3 * * * /root/backup.sh >> /root/backup.log 2>&1") | crontab -
```

---

## 🚀 ЭТАП 8: Как обновлять проект (Деплой новых фич)
Если вы протестировали новый код на своем компьютере и сделали `git commit` + `git push`, то на боевом сервере вам нужно выполнить всего один блок команд, чтобы безопасно обновить сайт:

```bash
# 1. Заходим на сервер
ssh root@ВАШ_IP_АДРЕС

# 2. Переходим в проект и скачиваем обновления
cd ~/TechSupport
git pull

# 3. Устанавливаем новые зависимости (если появились)
npm install

# 4. Собираем фронтенд-часть (React)
npm run build

# 5. Перезагружаем бэкенд (Node.js) для применения новых таблиц/изменений
pm2 restart tech-app
```
> [!TIP]
> **Важно про базы данных:** Вам не нужно переносить новые колонки вручную! Бэкенд (`pm2 restart tech-app`) при запуске сам проверяет базу данных и добавляет все недостающие таблицы и колонки (система Авто-Миграций в `server/index.js`).

**🎆 Всё готово! Ваш крутой проект работает.**
