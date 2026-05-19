#!/bin/bash

###############################################################################
# PJTKI Database Restore Script
# Usage: ./restore-db.sh <backup_file.sql.gz>
###############################################################################

set -e

# Configuration
BACKUP_FILE="$1"
CONTAINER_NAME="pjtki-postgres"
DB_USER="${POSTGRES_USER:-pjtki}"
DB_NAME="${POSTGRES_DB:-pjtki}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   PJTKI Database Restore Script       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Validate input
if [ -z "${BACKUP_FILE}" ]; then
    echo -e "${RED}✖ Usage: ./restore-db.sh <backup_file.sql.gz>${NC}"
    echo ""
    echo -e "${YELLOW}📁 Available backups:${NC}"
    ls -lh ./backups/pjtki_db_*.sql.gz 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}' || echo "   No backups found"
    echo ""
    exit 1
fi

# Check if file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}✖ Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

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

# Warning and confirmation
echo -e "${RED}⚠️  WARNING: This will REPLACE the current database!${NC}"
echo -e "   Database: ${DB_NAME}"
echo -e "   From:     ${BACKUP_FILE}"
echo ""
read -p "Are you sure? Type 'YES' to continue: " CONFIRM
if [ "${CONFIRM}" != "YES" ]; then
    echo -e "${YELLOW}ℹ Restore cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔄 Restoring database...${NC}"
echo -e "   File: ${BACKUP_FILE}"
echo -e "   To:   ${CONTAINER_NAME}/${DB_NAME}"
echo ""

# Create backup before restore (safety)
SAFETY_BACKUP="./backups/pjtki_db_pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p ./backups
echo -e "${YELLOW}💾 Creating safety backup first...${NC}"
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${SAFETY_BACKUP}"
echo -e "${GREEN}✔ Safety backup created: ${SAFETY_BACKUP}${NC}"
echo ""

# Drop and recreate database
echo -e "${YELLOW}🗑️  Dropping old database...${NC}"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${DB_NAME};" || true

echo -e "${YELLOW}📦 Creating fresh database...${NC}"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -c "CREATE DATABASE ${DB_NAME};" || true

echo -e "${YELLOW}📥 Restoring from backup...${NC}"
gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"

# Verify restore
echo ""
echo -e "${YELLOW}🔍 Verifying restore...${NC}"
TABLE_COUNT=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo -e "${GREEN}✔ Tables restored: ${TABLE_COUNT}${NC}"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Database Restore Complete!          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✨ Database restored successfully!${NC}"
echo -e "${YELLOW}ℹ You may need to restart the app container:${NC}"
echo -e "   docker compose restart app"
echo ""
