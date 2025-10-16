#!/bin/bash

# PCB Reverse Engineering Tool - Local Development Server
# This script starts the local development server with hot reload

echo "🔧 Starting PCB Reverse Engineering Tool..."
echo "📁 Project directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the development server
echo "🚀 Starting development server..."
echo "🌐 Your app will be available at: http://localhost:5173/"
echo "📝 Press Ctrl+C to stop the server"
echo ""

# Start with specific port (uncomment to use a specific port)
# npm run dev -- --port 5173
npm run dev
