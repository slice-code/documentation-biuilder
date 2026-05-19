#!/bin/bash

###############################################################################
# PJTKI Files Backup Script (Uploads + Data)
# Usage: ./backup-files.sh [backup_directory]
###############################################################################

set -e

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pjtki_files_${TIMESTAMP}.tar.gz"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
UPLOADS_DIR="${PROJECT_ROOT}/data/uploads"
FILES_DIR="${PROJECT_ROOT}/files"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   PJTKI Files Backup Script           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo -e "${YELLOW}📦 Creating files backup...${NC}"
echo -e "   Uploads: ${UPLOADS_DIR}"
echo -e "   Files:   ${FILES_DIR}"
echo -e "   Output:  ${BACKUP_FILE}"
echo ""

# Check if directories exist
if [ ! -d "${UPLOADS_DIR}" ] && [ ! -d "${FILES_DIR}" ]; then
    echo -e "${RED}✖ No files directories found to backup${NC}"
    exit 1
fi

# Create tarball
tar -czf "${BACKUP_FILE}" \
    -C "${PROJECT_ROOT}" \
    $( [ -d "data/uploads" ] && echo "data/uploads" ) \
    $( [ -d "files" ] && echo "files" ) \
    2>/dev/null || true

# Verify backup
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✔ Backup successful!${NC}"
    echo -e "   File: ${BACKUP_FILE}"
    echo -e "   Size: ${BACKUP_SIZE}"
    echo ""
    
    # Show backup contents
    echo -e "${YELLOW}📋 Backup contents:${NC}"
    tar -tzf "${BACKUP_FILE}" | head -n 20
    FILE_COUNT=$(tar -tzf "${BACKUP_FILE}" | wc -l)
    if [ "${FILE_COUNT}" -gt 20 ]; then
        echo -e "${YELLOW}   ... and $((FILE_COUNT - 20)) more files${NC}"
    fi
    echo ""
    
    # Clean old backups (keep last 5)
    OLD_BACKUPS=$(ls -t "${BACKUP_DIR}"/pjtki_files_*.tar.gz 2>/dev/null | tail -n +6)
    if [ -n "${OLD_BACKUPS}" ]; then
        echo -e "${YELLOW}🧹 Cleaning old backups (keeping last 5)...${NC}"
        echo "${OLD_BACKUPS}" | while read -r old_backup; do
            rm -f "${old_backup}"
            echo -e "   Removed: $(basename "${old_backup}")"
        done
        echo ""
    fi
    
    # List all backups
    echo -e "${GREEN}📁 Available backups:${NC}"
    ls -lh "${BACKUP_DIR}"/pjtki_files_*.tar.gz 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'
    echo ""
    
else
    echo -e "${RED}✖ Backup failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✨ Done!${NC}"
