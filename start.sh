#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:migrate

echo "Starting Next.js application..."
npm start
