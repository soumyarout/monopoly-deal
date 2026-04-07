#!/bin/bash

echo "🎲 Starting Monopoly Deal Multiplayer..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the app
echo "🔨 Building the app..."
npm run build

# Start the server
echo "🚀 Starting the server..."
echo ""
echo "=================================="
echo "  Monopoly Deal is ready!"
echo "  Open http://localhost:3000"
echo "=================================="
echo ""

npm start
