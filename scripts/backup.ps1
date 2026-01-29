# PostgreSQL Backup Script for TechSupport-Pro
# Usage: powershell -File scripts/backup.ps1

$DB_NAME = "equipment_management"
$DB_USER = "postgres"
$BACKUP_DIR = "D:\Backups\TechSupport"
$KEEP_DAYS = 30

# Create backup directory if it doesn't exist
if (!(Test-Path -Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR
}

# Timestamp for filename
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HHmm"
$FILENAME = "$BACKUP_DIR\backup_$TIMESTAMP.sql"
$ZIP_FILENAME = "$FILENAME.gz"

Write-Host "Starting backup of $DB_NAME..." -ForegroundColor Green

# Perform pg_dump
# Note: Ensure pg_dump is in your PATH or specify full path
# Example: & "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" ...
& pg_dump -U $DB_USER -d $DB_NAME -f $FILENAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup successful. Compressing..." -ForegroundColor Green
    
    # Compress using PowerShell (creates .zip) or use Gzip if installed
    Compress-Archive -Path $FILENAME -DestinationPath "$FILENAME.zip"
    Remove-Item $FILENAME
    
    Write-Host "Backup compressed: $FILENAME.zip" -ForegroundColor Cyan
} else {
    Write-Host "Backup failed!" -ForegroundColor Red
    exit 1
}

# Cleanup old backups
Write-Host "Cleaning up backups older than $KEEP_DAYS days..." -ForegroundColor Yellow
Get-ChildItem -Path $BACKUP_DIR -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KEEP_DAYS) } | Remove-Item

Write-Host "Done!" -ForegroundColor Green
