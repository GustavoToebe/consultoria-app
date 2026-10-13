# Web: exporta o app Expo para a web e serve com o Caddy.
# O Caddyfile vem de deploy-local/ (montado pelo docker-compose).
FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Sem EXPO_PUBLIC_API_URL: na web servida pelo Caddy a API é a mesma origem (/api).
RUN npx expo export --platform web

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
