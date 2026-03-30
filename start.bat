@echo off
cd /d "d:\PycharmProjects\techsupport-pro---equipment-management-system"

echo Starting automatic database backup...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/backup.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Backup failed! Starting developer server anyway...
) else (
    echo [SUCCESS] Backup completed.
)

npm run dev
