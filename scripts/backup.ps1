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

# --- Load .env file if exists ---
# Assuming script is in /scripts folder, .env is in parent folder
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$envFile = Join-Path (Split-Path -Parent $scriptPath) ".env"

if (Test-Path $envFile) {
    Write-Host "Loading configuration from .env..." -ForegroundColor Gray
    Get-Content $envFile | Where-Object { $_ -match "=" -and $_ -notmatch "^#" } | ForEach-Object {
        $parts = $_.split('=', 2)
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            Set-Item -Path "Env:$key" -Value $value
        }
    }
}

# Use environment variables if they were loaded or already set
if ($env:DB_NAME) { $DB_NAME = $env:DB_NAME }
if ($env:DB_USER) { $DB_USER = $env:DB_USER }
$env:PGPASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }

# Timestamp for filename
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HHmm"
$FILENAME = "$BACKUP_DIR\backup_$TIMESTAMP.sql"

Write-Host "Starting backup of $DB_NAME..." -ForegroundColor Green

# Perform pg_dump
# Note: Ensure pg_dump is in your PATH or specify full path
& pg_dump -U $DB_USER -d $DB_NAME -f $FILENAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup successful. Compressing..." -ForegroundColor Green
    
    # Compress using PowerShell (creates .zip)
    Compress-Archive -Path $FILENAME -DestinationPath "$FILENAME.zip" -Force
    Remove-Item $FILENAME
    
    Write-Host "Backup compressed: $FILENAME.zip" -ForegroundColor Cyan
} else {
    Write-Host "Backup failed! (Check database connection and PGPASSWORD)" -ForegroundColor Red
    exit 1
}

# Cleanup old backups
Write-Host "Cleaning up backups older than $KEEP_DAYS days..." -ForegroundColor Yellow
Get-ChildItem -Path $BACKUP_DIR -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KEEP_DAYS) } | Remove-Item

Write-Host "Backup process completed!" -ForegroundColor Green
