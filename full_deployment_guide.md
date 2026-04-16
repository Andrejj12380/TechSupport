# 🚀 ФИНАЛЬНАЯ ИНСТРУКЦИЯ ПО ДЕПЛОЮ И ПОДДЕРЖКЕ

Эта инструкция написана так, чтобы вы могли просто копировать команды и вставлять их в терминал.

## 🏁 Шаг 1. Переезд на новый GitHub
*Выполняйте на своем компьютере (в папке проекта).*

1.  **Смена адреса**:
    ```powershell
    git remote set-url origin https://github.com/НОВЫЙ_ЛОГИН/НОВЫЙ_РЕПО.git
    git push -u origin main
    ```
2.  **Проверка**: Зайдите в браузер на страницу нового репозитория — там должны появиться все ваши файлы.

---

## 🏗️ Шаг 2. Настройка нового сервера (Ubuntu 22.04)
*Зайдите на сервер через SSH: `ssh root@ваш_ip_адрес`.*

1.  **Обновление системы**:
    ```bash
    sudo apt update && sudo apt upgrade -y
    ```
2.  **Установка необходимых программ**:
    ```bash
    # Node.js
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs

    # Git и Nginx
    sudo apt install git nginx -y

    # Менеджер процессов PM2
    sudo npm install -g pm2
    ```
3.  **Установка Базы Данных (PostgreSQL)**:
    ```bash
    sudo apt install postgresql postgresql-contrib -y
    # Создаем пользователя и базу (замените 'ваш_пароль' на свой!)
    sudo -u postgres psql -c "CREATE USER techadmin WITH PASSWORD 'ваш_пароль';"
    sudo -u postgres psql -c "CREATE DATABASE techsupport_db OWNER techadmin;"
    ```

---

## 🚀 Шаг 3. Запуск вашего проекта
1.  **Клонирование**:
    ```bash
    cd ~
    git clone https://github.com/НОВЫЙ_ЛОГИН/НОВЫЙ_РЕПО.git app
    cd app
    npm install
    ```
2.  **Настройка «Сейфа» (Environment Variables)**:
    Создайте файл `.env`:
    ```bash
    nano .env
    ```
    Вставьте туда настройки из локального файла (подставив пароль от базы на сервере):
    ```env
    PORT=5000
    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=techsupport_db
    DB_USER=techadmin
    DB_PASSWORD=ваш_пароль
    JWT_SECRET=очень-длинный-секретный-ключ
    FRONTEND_URL=https://ваш-домен.ru
    ```
3.  **Сборка и старт**:
    ```bash
    npm run build
    pm2 start server/index.js --name "tech-app"
    pm2 save
    pm2 startup
    ```

---

## 🔒 Шаг 4. Настройка веб-сервера (Nginx) и HTTPS

Этот шаг сделает так, чтобы сайт был доступен из интернета.

1.  **Настройка конфигурации Nginx**:
    Откройте редактор для создания конфига:
    ```bash
    sudo nano /etc/nginx/sites-available/techsupport
    ```
    Вставьте туда этот блок (заменив `ваш-домен.ru` на ваш домен/IP, а `/root/app` на ваш путь к папке):
    ```nginx
    server {
        listen 80;
        server_name ваш-домен.ru;
        
        # 1. Раздаем собранный фронтенд (папку dist)
        location / {
            root /root/app/dist;
            index index.html;
            try_files $uri $uri/ /index.html;
        }

        # 2. Все запросы к API пробрасываем на сервер Node.js (порт 5000)
        location /api/ {
            proxy_pass http://127.0.0.1:5000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
    
2.  **Включение конфигурации и перезапуск Nginx**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/techsupport /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```

3.  **Получение бесплатного SSL Сертификата (HTTPS)**:
    ```bash
    sudo apt install certbot python3-certbot-nginx -y
    sudo certbot --nginx -d ваш-домен.ru
    ```

---

## 🛡️ Шаг 5. Как поддерживать (Бэкап и Обновление)
### Как обновлять сайт (Одной командой!):
Если вы изменили код на компьютере и сделали `git push`, на сервере просто напишите:
`cd ~/app && git pull && npm run build && pm2 restart tech-app`

### Как будут работать бэкапы:
Я подготовил для вас скрипт `scripts/backup.sh`. Который будет каждую ночь сохранять **Базу данных** и папку **Uploads** (картинки/инструкции) в отдельный архив.

---

### ✅ ЧЕК-ЛИСТ ПРОВЕРКИ
- [ ] Вы залогинились на сайте.
- [ ] Вы создали нового клиента и добавили к нему картинку.
- [ ] После перезагрузки страницы картинка НЕ пропала.
- [ ] Перезагрузите сервер командой `sudo reboot`. Через 1 минуту сайт должен сам заработать по адресу.

> [!TIP]
> Если на каком-то шаге появится ошибка (красный текст) — не пугайтесь! Просто скопируйте её мне, и мы разберемся за 5 секунд.
