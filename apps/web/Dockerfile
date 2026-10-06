# syntax=docker/dockerfile:1
# Contexto de build: raiz do monorepo (docker-compose.yml já configura).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace apps/web --ignore-scripts
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN npm run build --workspace apps/web

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
