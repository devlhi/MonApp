#!/bin/bash
# AppMon Installer Script for Ubuntu/Debian

set -e

echo "========================================"
echo "      AppMon Installation Script        "
echo "========================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

echo "[1/6] Updating system and installing prerequisites..."
apt-get update -y
apt-get install -y curl git build-essential

echo "[2/6] Installing Node.js (v20)..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js is already installed."
fi

echo "[3/6] Installing PM2..."
npm install -g pm2

# Define installation directory
INSTALL_DIR="/opt/appmon"
REPO_URL="https://github.com/devlhi/MonApp.git"

echo "[4/6] Setting up application in $INSTALL_DIR..."
if [ -d "$INSTALL_DIR" ]; then
    echo "Directory $INSTALL_DIR already exists. Pulling latest changes..."
    cd $INSTALL_DIR
    git pull
else
    git clone $REPO_URL $INSTALL_DIR
    cd $INSTALL_DIR
fi

echo "[5/6] Installing dependencies and building frontend..."
# Install server dependencies
npm install

# Install web dependencies and build
cd web
npm install
npm run build
cd ..

echo "[6/6] Starting application with PM2..."
# Start server using PM2
pm2 start server/index.js --name "appmon"

# Setup PM2 to start on boot
pm2 startup
pm2 save

echo "========================================"
echo "    AppMon Installation Completed!      "
echo "========================================"
echo "Access the dashboard at: http://<your_server_ip>:3027"
