#!/bin/bash

###############################################################################
# PJTKI Files Restore Script
# Usage: ./restore-files.sh <backup_file.tar.gz>
###############################################################################

set -e

# Configuration
BACKUP_FILE="$1"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   PJTKI Files Restore Script          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Validate input
if [ -z "${BACKUP_FILE}" ]; then
    echo -e "${RED}✖ Usage: ./restore-files.sh <backup_file.tar.gz>${NC}"
    echo ""
    echo -e "${YELLOW}📁 Available backups:${NC}"
    ls -lh ./backups/pjtki_files_*.tar.gz 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}' || echo "   No backups found"
    echo ""
    exit 1
fi

# Check if file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}✖ Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

# Warning and confirmation
echo -e "${RED}⚠️  WARNING: This will REPLACE current files!${NC}"
echo -e "   From: ${BACKUP_FILE}"
echo -e "   To:   ${PROJECT_ROOT}"
echo ""
read -p "Are you sure? Type 'YES' to continue: " CONFIRM
if [ "${CONFIRM}" != "YES" ]; then
    echo -e "${YELLOW}ℹ Restore cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔄 Restoring files...${NC}"
echo -e "   File: ${BACKUP_FILE}"
echo -e "   To:   ${PROJECT_ROOT}"
echo ""

# Create backup of current files first (safety)
SAFETY_BACKUP="./backups/pjtki_files_pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz"
mkdir -p ./backups
echo -e "${YELLOW}💾 Creating safety backup of current files...${NC}"
tar -czf "${SAFETY_BACKUP}" \
    -C "${PROJECT_ROOT}" \
    $( [ -d "data/uploads" ] && echo "data/uploads" ) \
    $( [ -d "files" ] && echo "files" ) \
    2>/dev/null || true
echo -e "${GREEN}✔ Safety backup created: ${SAFETY_BACKUP}${NC}"
echo ""

# Extract backup
echo -e "${YELLOW}📥 Extracting backup...${NC}"
tar -xzf "${BACKUP_FILE}" -C "${PROJECT_ROOT}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Files Restore Complete!             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✨ Files restored successfully!${NC}"
echo -e "${YELLOW}ℹ You may need to fix permissions:${NC}"
echo -e "   sudo chown -R \$USER:\$USER data/uploads files"
echo ""
