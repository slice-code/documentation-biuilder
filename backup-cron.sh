#!/bin/bash

###############################################################################
# PJTKI Automated Backup Script (for cron jobs)
# Usage: Add to crontab: 0 2 * * * /path/to/backup-cron.sh
# Runs daily at 2:00 AM
###############################################################################

set -e

# Configuration
BACKUP_DIR="./backups"
LOG_FILE="./backups/backup.log"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create backup directory and log file
mkdir -p "${BACKUP_DIR}"
touch "${LOG_FILE}"

# Logging function
log() {
    echo "[${TIMESTAMP}] $1" | tee -a "${LOG_FILE}"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Starting automated backup..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log "ERROR: Docker is not running"
    exit 1
fi

# Check if containers are running
if ! docker ps --format '{{.Names}}' | grep -q "pjtki-postgres"; then
    log "ERROR: Database container is not running"
    exit 1
fi

# Backup database
log "Step 1/2: Backing up database..."
if "${SCRIPT_DIR}/backup-db.sh" "${BACKUP_DIR}" >> "${LOG_FILE}" 2>&1; then
    log "✔ Database backup successful"
else
    log "✖ Database backup FAILED"
fi

# Backup files
log "Step 2/2: Backing up files..."
if "${SCRIPT_DIR}/backup-files.sh" "${BACKUP_DIR}" >> "${LOG_FILE}" 2>&1; then
    log "✔ Files backup successful"
else
    log "✖ Files backup FAILED"
fi

# Clean old backups (keep last 7 days)
log "Cleaning backups older than 7 days..."
find "${BACKUP_DIR}" -name "pjtki_db_*.sql.gz" -mtime +7 -delete
find "${BACKUP_DIR}" -name "pjtki_files_*.tar.gz" -mtime +7 -delete
log "✔ Cleanup complete"

# Backup summary
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Backup completed"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check disk space
DISK_USAGE=$(df -h "${BACKUP_DIR}" | awk 'NR==2 {print $5}')
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
log "Disk usage: ${DISK_USAGE}"
log "Backup directory size: ${BACKUP_SIZE}"
log ""
