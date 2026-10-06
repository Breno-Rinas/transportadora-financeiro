# syntax=docker/dockerfile:1
# Contexto de build: raiz do monorepo (docker-compose.yml já configura).

# ---- deps: instala as dependências do workspace da API (inclui dev) ----
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/api --ignore-scripts

# ---- build: gera o Prisma Client e compila o TypeScript ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run build --workspace apps/api

# ---- runtime: só dependências de produção + código compilado ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# `prisma` (CLI) é dependência de produção: o container roda `migrate deploy` ao subir.
# --ignore-scripts evita o `prisma generate` do postinstall (o client já vem compilado do
# estágio build); o rebuild baixa só o binário do schema engine.
RUN npm ci --workspace apps/api --omit=dev --ignore-scripts \
  && npm rebuild @prisma/engines \
  && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/docker-entrypoint.sh apps/api/
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads
ENV PATH=/app/node_modules/.bin:$PATH \
  UPLOAD_DIR=/data/uploads
WORKDIR /app/apps/api
USER node
EXPOSE 3333
CMD ["sh", "./docker-entrypoint.sh"]
