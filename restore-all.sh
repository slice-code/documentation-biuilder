#!/bin/bash

###############################################################################
# PJTKI Full Restore Script (Database + Files)
# Usage: ./restore-all.sh <backup_directory>
###############################################################################

set -e

# Configuration
BACKUP_DIR="${1:-./backups}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   PJTKI Full Restore (DB + Files)     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Show available backups
echo -e "${YELLOW}📁 Available database backups:${NC}"
ls -lh "${BACKUP_DIR}"/pjtki_db_*.sql.gz 2>/dev/null | tail -n 5 | awk '{print "   " $9 " (" $5 ")"}'
LATEST_DB=$(ls -t "${BACKUP_DIR}"/pjtki_db_*.sql.gz 2>/dev/null | head -n 1)
echo ""

echo -e "${YELLOW}📁 Available files backups:${NC}"
ls -lh "${BACKUP_DIR}"/pjtki_files_*.tar.gz 2>/dev/null | tail -n 5 | awk '{print "   " $9 " (" $5 ")"}'
LATEST_FILES=$(ls -t "${BACKUP_DIR}"/pjtki_files_*.tar.gz 2>/dev/null | head -n 1)
echo ""

# Ask which backups to restore
if [ -n "${LATEST_DB}" ]; then
    echo -e "${YELLOW}Latest DB backup: $(basename ${LATEST_DB})${NC}"
    read -p "Use this? (Y/n): " USE_LATEST_DB
    if [[ "${USE_LATEST_DB,,}" != "n" ]]; then
        DB_FILE="${LATEST_DB}"
    else
        read -p "Enter DB backup path: " DB_FILE
    fi
else
    echo -e "${RED}✖ No database backups found${NC}"
    read -p "Enter DB backup path (or press Enter to skip): " DB_FILE
fi

if [ -n "${LATEST_FILES}" ]; then
    echo -e "${YELLOW}Latest files backup: $(basename ${LATEST_FILES})${NC}"
    read -p "Use this? (Y/n): " USE_LATEST_FILES
    if [[ "${USE_LATEST_FILES,,}" != "n" ]]; then
        FILES_FILE="${LATEST_FILES}"
    else
        read -p "Enter files backup path: " FILES_FILE
    fi
else
    echo -e "${RED}✖ No files backups found${NC}"
    read -p "Enter files backup path (or press Enter to skip): " FILES_FILE
fi

echo ""

# Warning
echo -e "${RED}⚠️  WARNING: This will REPLACE current database and files!${NC}"
echo ""
read -p "Are you sure? Type 'YES' to continue: " CONFIRM
if [ "${CONFIRM}" != "YES" ]; then
    echo -e "${YELLOW}ℹ Restore cancelled${NC}"
    exit 0
fi

echo ""

# Restore Database
if [ -n "${DB_FILE}" ] && [ -f "${DB_FILE}" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Step 1/2: Database Restore${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    "${SCRIPT_DIR}/restore-db.sh" "${DB_FILE}"
    echo ""
elif [ -n "${DB_FILE}" ]; then
    echo -e "${RED}✖ Database backup not found: ${DB_FILE}${NC}"
    echo ""
fi

# Restore Files
if [ -n "${FILES_FILE}" ] && [ -f "${FILES_FILE}" ]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Step 2/2: Files Restore${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    "${SCRIPT_DIR}/restore-files.sh" "${FILES_FILE}"
    echo ""
elif [ -n "${FILES_FILE}" ]; then
    echo -e "${RED}✖ Files backup not found: ${FILES_FILE}${NC}"
    echo ""
fi

# Summary
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Full Restore Complete!              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✨ Restore finished!${NC}"
echo -e "${YELLOW}ℹ Recommended: Restart all containers:${NC}"
echo -e "   docker compose restart"
echo ""
