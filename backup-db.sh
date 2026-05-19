#!/bin/bash

###############################################################################
# PJTKI Database Backup Script
# Usage: ./backup-db.sh [backup_directory]
###############################################################################

set -e

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pjtki_db_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="pjtki-postgres"
DB_USER="${POSTGRES_USER:-pjtki}"
DB_NAME="${POSTGRES_DB:-pjtki}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   PJTKI Database Backup Script        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✖ Docker is not running${NC}"
    exit 1
fi

# Check if database container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}✖ Database container '${CONTAINER_NAME}' is not running${NC}"
    echo -e "${YELLOW}ℹ Start it with: docker compose up -d db${NC}"
    exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo -e "${YELLOW}📦 Creating backup...${NC}"
echo -e "   Container: ${CONTAINER_NAME}"
echo -e "   Database:  ${DB_NAME}"
echo -e "   User:      ${DB_USER}"
echo -e "   Output:    ${BACKUP_FILE}"
echo ""

# Perform backup
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Verify backup
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✔ Backup successful!${NC}"
    echo -e "   File: ${BACKUP_FILE}"
    echo -e "   Size: ${BACKUP_SIZE}"
    echo ""
    
    # Show backup contents (first 5 lines)
    echo -e "${YELLOW}📋 Backup preview:${NC}"
    zcat "${BACKUP_FILE}" | head -n 5
    echo -e "${YELLOW}   ...${NC}"
    echo ""
    
    # Clean old backups (keep last 10)
    OLD_BACKUPS=$(ls -t "${BACKUP_DIR}"/pjtki_db_*.sql.gz 2>/dev/null | tail -n +11)
    if [ -n "${OLD_BACKUPS}" ]; then
        echo -e "${YELLOW}🧹 Cleaning old backups (keeping last 10)...${NC}"
        echo "${OLD_BACKUPS}" | while read -r old_backup; do
            rm -f "${old_backup}"
            echo -e "   Removed: $(basename "${old_backup}")"
        done
        echo ""
    fi
    
    # List all backups
    echo -e "${GREEN}📁 Available backups:${NC}"
    ls -lh "${BACKUP_DIR}"/pjtki_db_*.sql.gz 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'
    echo ""
    
else
    echo -e "${RED}✖ Backup failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✨ Done!${NC}"
