#!/bin/sh
# Aplica o schema do banco e builda.
#
# Usa `prisma db execute` com SQL idempotente (prisma/deploy.sql) em vez de
# `prisma migrate deploy`: o migrate deploy precisa de um advisory lock de
# sessão que a conexão pooled do Neon (PgBouncer em modo transação) não
# sustenta, o que sempre falha com P1002 mesmo com retentativas. db execute
# não usa esse lock, então funciona direto pela conexão normal.
set -e

npx prisma db execute --file prisma/deploy.sql --schema prisma/schema.prisma
npm run db:seed
npx next build
