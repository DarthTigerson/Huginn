#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  echo "Building native modules..."
  npm run rebuild
fi

# Remove stale tsc artifacts that shadow .tsx source files and confuse Vite
find src -name "*.js" -not -path "*/node_modules/*" -delete 2>/dev/null || true
find src -name "*.d.ts" -not -path "*/node_modules/*" -not -path "src/types/api.d.ts" -delete 2>/dev/null || true

npm run dev
