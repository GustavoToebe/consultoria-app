#!/usr/bin/env bash
# Diz quais partes do repositório mudaram desde <base> e pedem teste e publicação: a API (api/) e o app (app/).
#
# Uso: partes-mudadas.sh <base>   (rode dentro do repositório, com o histórico baixado: checkout com fetch-depth 0)
#   <base> = no pull request, o commit base; no push da main, o último commit cujo deploy deu certo.
#
# Saída (para o $GITHUB_OUTPUT): duas linhas, `api=true|false` e `app=true|false`.
# Documentação (.md fora de src/ e tudo em docs/) não conta; mudar o próprio workflow ou estes scripts conta para as duas.
# NA DÚVIDA É SEMPRE true NAS DUAS (testa e publica tudo, como antes): base vazia, inválida ou que não está no histórico.
set -uo pipefail
base="${1:-}"

tudo() { echo "api=true"; echo "app=true"; echo "partes: tudo ($1)" >&2; exit 0; }

[[ "$base" =~ ^[0-9a-f]{40}$ ]] || tudo "sem base"
git cat-file -e "${base}^{commit}" 2>/dev/null || tudo "base fora do histórico"
arquivos="$(git diff --name-only "$base" HEAD 2>/dev/null)" || tudo "diff falhou"

api=false; app=false
while IFS= read -r f; do
  [ -n "$f" ] || continue
  case "$f" in
    .github/workflows/deploy.yml|.github/scripts/*) api=true; app=true; continue ;;
    docs/*) continue ;;
  esac
  # .md é documentação, menos dentro de src/ (os termos de uso saem no jar).
  if [[ "$f" == *.md && "$f" != */src/* ]]; then continue; fi
  case "$f" in
    api/*) api=true ;;
    app/*) app=true ;;
    # Fotos dos exercícios do catálogo: o Dockerfile da web baixa por este script e confere o manifesto.
    scripts/catalogo/imagens*|scripts/catalogo/comum.py) app=true ;;
  esac
done <<< "$arquivos"

echo "api=$api"
echo "app=$app"
echo "partes: api=$api app=$app desde ${base:0:12}" >&2
