#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo
    echo "Stopping application processes..."

    if [[ -n "$BACKEND_PID" ]]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    if [[ -n "$FRONTEND_PID" ]]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if [[ ! -f backend/.env.local ]]; then
    echo "backend/.env.local does not exist."
    echo "Create it from backend/.env.example before starting development."
    exit 1
fi

echo "Starting local Supabase..."
npm run db:start

echo "Building shared contracts..."
npm run build:shared

echo "Starting backend..."
npm --prefix backend run dev &
BACKEND_PID=$!

echo "Starting frontend..."
npm --prefix frontend run dev &
FRONTEND_PID=$!

echo
echo "Quiz Builder development environment is running."
echo "Press Ctrl+C to stop the frontend and backend."
echo

wait