#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
  echo "Building native modules..."
  npm run rebuild
fi

npm run dev
