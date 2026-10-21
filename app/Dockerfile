# Web: exporta o app Expo para a web e serve com o Caddy.
# O Caddyfile vem de deploy-local/ (montado pelo docker-compose).
#
# Fotos dos exercícios do catálogo (free-exercise-db, commit fixo em scripts/catalogo/imagens_exercicios.py): o estágio
# `imagens` as baixa, reduz e confere o sha256 de cada uma contra scripts/catalogo/imagens-exercicios.json. Sem rede ou com
# hash diferente a construção FALHA (nada de imagem pela metade). O contexto `catalogo` é a pasta scripts/catalogo e vem de
# fora de app/: `additional_contexts` no docker-compose.yml e `build-contexts` no deploy.yml. As imagens não ficam no git.
# Mesma imagem do Python e mesmo Pillow de quem gerou o manifesto (os hashes são dos bytes reduzidos).
FROM python:3.13.16-alpine@sha256:2d9aefe2fef018a7eb2c13064c89c71929800fd2e5dccdbf52ea5da5bb8d929a AS imagens
RUN pip install --no-cache-dir --root-user-action=ignore --only-binary=:all: pillow==13.0.0
# Dois níveis acima do script, como no repositório (comum.py acha a raiz por ali).
COPY --from=catalogo . /repo/scripts/catalogo
RUN python -I /repo/scripts/catalogo/imagens_exercicios.py baixar --saida /imagens

FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Sem EXPO_PUBLIC_API_URL: na web servida pelo Caddy a API é a mesma origem (/api).
RUN npx expo export --platform web

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY --from=imagens /imagens /srv/catalogo/exercicios
