#!/bin/bash

###############################################################################
# PJTKI Full Backup Script (Database + Files)
# Usage: ./backup-all.sh [backup_directory]
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
echo -e "${GREEN}║   PJTKI Full Backup (DB + Files)      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Backup Database
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 1/2: Database Backup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
"${SCRIPT_DIR}/backup-db.sh" "${BACKUP_DIR}"
echo ""

# Step 2: Backup Files
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 2/2: Files Backup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
"${SCRIPT_DIR}/backup-files.sh" "${BACKUP_DIR}"
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Full Backup Complete!               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📁 Backup location: ${BACKUP_DIR}${NC}"
echo ""
echo -e "${YELLOW}📊 Backup summary:${NC}"
ls -lh "${BACKUP_DIR}"/pjtki_* 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'
echo ""

TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1)
echo -e "${GREEN}💾 Total backup size: ${TOTAL_SIZE}${NC}"
echo ""
