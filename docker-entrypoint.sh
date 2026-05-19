#!/bin/bash

###############################################################################
# PJTKI Docker Entrypoint Script
# Runs initialization tasks before starting the app
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   PJTKI App Starting...               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database...${NC}"
for i in $(seq 1 30); do
    if node -e "
      const { Client } = require('pg');
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      client.connect().then(() => {
        client.end();
        process.exit(0);
      }).catch(() => process.exit(1));
    " 2>/dev/null; then
        echo -e "${GREEN}✔ Database is ready!${NC}"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo -e "${RED}✖ Database not ready after 30 seconds${NC}"
        exit 1
    fi
    
    echo -e "   Attempt ${i}/30..."
    sleep 1
done

# Run database migrations/initialization if needed
echo -e "${YELLOW}📦 Checking database tables...${NC}"
node -e "
  const db = require('./database');
  const { Client } = require('pg');

  async function ensureDockerAuthTable() {
    if (!process.env.DATABASE_URL) return;

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query(\`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          name TEXT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          status TEXT DEFAULT 'active',
          phone TEXT DEFAULT '',
          createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      \`);
    } finally {
      await client.end();
    }
  }

  db.init()
    .then(() => ensureDockerAuthTable())
    .then(() => {
      console.log('${GREEN}✔ Database connection established${NC}');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
" || {
    echo -e "${RED}✖ Database initialization failed${NC}"
    exit 1
}

# Seed admin account if SEED_ADMIN=true (skip here, let server.js handle it)
if [ "${SEED_ADMIN:-true}" = "true" ]; then
    echo ""
    echo -e "${YELLOW}🌱 Admin seeding will run on app startup${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Starting Application...             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Start the application
exec node server.js
