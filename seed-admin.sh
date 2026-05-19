#!/bin/bash

###############################################################################
# PJTKI Database Seed Script
# Creates initial admin account if not exists
###############################################################################

set -e

CONTAINER_NAME="pjtki-postgres"
DB_USER="${POSTGRES_USER:-pjtki}"
DB_NAME="${POSTGRES_DB:-pjtki}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@gmail.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-gugus\$123\$}"
ADMIN_ROLE="${ADMIN_ROLE:-admin}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🌱 Seeding initial admin account...${NC}"
echo -e "   Email:    ${ADMIN_EMAIL}"
echo -e "   Role:     ${ADMIN_ROLE}"
echo ""

# Check if admin already exists
EXISTING=$(docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -t -c \
  "SELECT COUNT(*) FROM users WHERE email = '${ADMIN_EMAIL}';" 2>/dev/null || echo "0")

if [ "${EXISTING}" -gt 0 ] 2>/dev/null; then
    echo -e "${YELLOW}ℹ Admin account already exists, skipping seed${NC}"
    exit 0
fi

# Generate bcrypt hash for password
PASSWORD_HASH=$(node -e "console.log(require('bcryptjs').hashSync('${ADMIN_PASSWORD}', 10))")

# Insert admin user
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" <<EOF
INSERT INTO users (email, password, role, status, created_at, updated_at)
VALUES (
  '${ADMIN_EMAIL}',
  '${PASSWORD_HASH}',
  '${ADMIN_ROLE}',
  'active',
  NOW(),
  NOW()
);
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✔ Admin account created successfully!${NC}"
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Login Credentials                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo -e "   Email:    ${ADMIN_EMAIL}"
    echo -e "   Password: ${ADMIN_PASSWORD}"
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Change password after first login!${NC}"
    echo ""
else
    echo -e "${RED}✖ Failed to create admin account${NC}"
    exit 1
fi
