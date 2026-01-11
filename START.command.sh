#!/bin/bash
# Mac/Linux launcher for BooksWithMusic

cd "$(dirname "$0")"

echo ""
echo "================================"
echo "   BooksWithMusic Launcher"
echo "================================"
echo ""

# Check if this is first run
if [ ! -d "node_modules" ]; then
    echo "[INFO] First time setup detected..."
    echo "[TASK] Installing dependencies..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies!"
        echo "[INFO] Make sure Node.js is installed: https://nodejs.org"
        exit 1
    fi
    echo ""
    echo "[TASK] Building application..."
    echo ""
    npm run build
    if [ $? -ne 0 ]; then
        echo "[ERROR] Build failed!"
        exit 1
    fi
    echo ""
    echo "[SUCCESS] Setup complete!"
    echo ""
fi

# Open in default browser
echo "[LAUNCH] Opening BooksWithMusic in your browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open start.html
else
    xdg-open start.html 2>/dev/null || sensible-browser start.html 2>/dev/null || echo "Please open start.html in your browser"
fi

echo ""
echo "[OK] BooksWithMusic is running!"
echo ""
echo "You can now:"
echo "  1. Import EPUB files"
echo "  2. Start reading with music"
echo "  3. Close this window anytime"
echo ""