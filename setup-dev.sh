#!/bin/bash
# Quick Development Setup Script

echo "🚀 Setting up development environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL dev database
echo "📦 Starting PostgreSQL dev database..."
docker compose -f docker-compose.dev.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Check if database is healthy
if docker compose -f docker-compose.dev.yml ps | grep -q "healthy"; then
    echo "✅ Database is ready!"
else
    echo "⚠️  Database might not be ready yet. Waiting 5 more seconds..."
    sleep 5
fi

# Copy dev env file
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from .env.dev..."
    cp .env.dev .env.local
    echo "✅ .env.local created!"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Development Environment Ready!         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Start app: npm run dev"
echo "  2. Or use:    npm run dev:full (db + app)"
echo ""
echo "Database connection:"
echo "  Host: localhost:5433"
echo "  User: pjtki_dev"
echo "  Pass: dev_password_123"
echo "  DB:   pjtki_dev"
echo ""
echo "Default admin login:"
echo "  Email: admin@gmail.com"
echo "  Password: gugus\$123\$"
echo ""
echo "💡 Tips:"
echo "  - Stop DB:       npm run dev:db-down"
echo "  - Reset DB:      npm run dev:db-reset"
echo "  - View logs:     docker compose -f docker-compose.dev.yml logs -f"
echo ""
