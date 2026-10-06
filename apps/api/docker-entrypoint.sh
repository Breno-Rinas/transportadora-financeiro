#!/bin/sh
# Sobe a API: aplica migrations, roda o seed (só popula banco vazio) e inicia o servidor.
set -e

prisma migrate deploy
node dist/prisma/seed.js
exec node dist/src/main.js
