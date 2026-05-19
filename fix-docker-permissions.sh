#!/bin/bash
# Fix Docker permissions - run once to avoid sudo requirement

echo "🔧 Setting up Docker permissions..."
echo ""

# Check if docker group exists
if ! getent group docker > /dev/null 2>&1; then
    echo "📦 Creating docker group..."
    sudo groupadd docker
fi

# Add current user to docker group
echo "👤 Adding user '$USER' to docker group..."
sudo usermod -aG docker $USER

echo ""
echo "✅ Done! Please LOG OUT and LOG BACK IN for changes to take effect."
echo ""
echo "After login, verify with:"
echo "  docker ps"
echo ""
echo "If it works without sudo, you're all set! 🎉"
echo ""
