#!/bin/sh
# Roda a migração do banco com retentativas antes do build.
#
# O Neon (Postgres serverless) suspende a conexão quando fica ocioso e pode
# não "acordar" a tempo do timeout de 10s que o Prisma usa para o advisory
# lock do `migrate deploy`. Em vez de falhar o deploy inteiro nessa corrida,
# tenta de novo algumas vezes com um intervalo curto.
set -e

attempt=1
max_attempts=5

until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "prisma migrate deploy falhou após $max_attempts tentativas."
    exit 1
  fi
  echo "prisma migrate deploy falhou (tentativa $attempt/$max_attempts), tentando de novo em 5s..."
  attempt=$((attempt + 1))
  sleep 5
done

npm run db:seed
npx next build
