# Руководство по деплою и поддержке

В этом документе описано, как перенести проект с локального компьютера на рабочий сервер и как поддерживать его актуальность через GitHub.

## 1. Рекомендуемые характеристики сервера
*   **Процессор (CPU)**: 2 ядра (минимум 1).
*   **Оперативная память (RAM)**: 4 ГБ (минимум 2 ГБ).
*   **Диск**: 40+ ГБ SSD или NVMe.
*   **ОС**: Ubuntu 22.04 LTS или 24.04 LTS.

## 2. Рекомендуемый стек для сервера
*   **ОС**: Linux (Ubuntu 22.04 LTS или новее)
*   **Среда**: Node.js 18+
*   **База данных**: PostgreSQL 14+
*   **Менеджер процессов**: PM2
*   **Веб-сервер**: Nginx (в качестве Reverse Proxy)

## 2. Первоначальная настройка на сервере

1.  **Клонируйте репозиторий**:
    ```bash
    git clone https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПОЗИТОРИЙ.git
    cd techsupport-pro
    ```

2.  **Установите зависимости**:
    ```bash
    npm install
    ```

3.  **Настройте окружение**:
    Создайте файл `.env` на сервере и заполните его данными для подключения к серверной БД PostgreSQL.

4.  **Соберите фронтенд**:
    ```bash
    npm run build
    ```

5.  **Запустите сервер через PM2**:
    ```bash
    npm install -g pm2
    pm2 start server/index.js --name techsupport-pro
    pm2 save
    pm2 startup
    ```

## 3. Обновление через GitHub

Когда вы вносите изменения в код локально и загружаете их в GitHub (`git push`), на сервере нужно выполнить следующие шаги:

### Ручной способ (простой)
Зайдите по SSH на сервер и выполните скрипт обновления:

```bash
git pull origin main
npm install
npm run build
pm2 restart techsupport-pro
```

> [!TIP]
> Вы можете создать файл `deploy.sh` на сервере с этими командами, чтобы запускать его одной командой `./deploy.sh`.

### Автоматический способ (GitHub Actions)
Вы можете настроить автоматический деплой при каждом пуше в ветку `main`.
Для этого нужно создать файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Server
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ~/techsupport-pro
            git pull origin main
            npm install
            npm run build
            pm2 restart techsupport-pro
```

## 4. Поддержка Базы Данных

В этом проекте реализована система **авто-миграций** в файле `server/index.js`. 
Это означает, что:
1.  Вам **не нужно** вручную выполнять SQL-запросы для добавления новых колонок.
2.  При запуске (`pm2 restart`) сервер сам проверит структуру таблиц и добавит недостающие поля (например, колонки для времени работы или новые статусы).

## 5. Резервное копирование

Рекомендуется настроить ежедневный бэкап базы данных с помощью `cron`:

```bash
# Пример команды для бэкапа (в crontab -e)
0 3 * * * pg_dump -U postgres equipment_management > ~/backups/db_$(date +\%Y\%m\%d).sql
```
