#!/usr/bin/env bash
# Testes do partes-mudadas.sh num repositório git de mentira (sem rede). Rodam na CI, no job `escopo` do pull request.
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$AQUI/partes-mudadas.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP" && git init -q && git config user.email t@example.com && git config user.name t
mkdir -p api/src/main/resources/termos app/src docs .github/workflows scripts/catalogo
echo a > api/A.java; echo b > app/src/b.ts; echo c > docs/c.md; echo d > README.md; echo e > scripts/e.mjs
echo i > scripts/catalogo/imagens-exercicios.json; echo j > scripts/catalogo/gerar_taco.py
echo f > api/src/main/resources/termos/uso.md; echo g > .github/workflows/deploy.yml
git add -A && git commit -qm base
BASE="$(git rev-parse HEAD)"

falhas=0
caso() { # caso <nome> <esperado> <base> <arquivo mudado...>
  local nome="$1" esperado="$2" base="$3"; shift 3
  git checkout -q "$BASE" 2>/dev/null
  for f in "$@"; do echo "x$RANDOM" >> "$f"; done
  [ "$#" -gt 0 ] && git commit -qam teste
  local obtido; obtido="$(bash "$SCRIPT" "$base" 2>/dev/null | tr '\n' ' ')"
  if [ "$obtido" = "$esperado" ]; then echo "ok   $nome"; else echo "FALHA $nome: esperado '$esperado', veio '$obtido'"; falhas=$((falhas+1)); fi
}

caso "só a API" "api=true app=false " "$BASE" api/A.java
caso "só o app" "api=false app=true " "$BASE" app/src/b.ts
caso "só documentação não pede nada" "api=false app=false " "$BASE" docs/c.md README.md
caso "script fora das imagens não pede nada" "api=false app=false " "$BASE" scripts/e.mjs
caso "o manifesto das fotos dos exercícios pede a web" "api=false app=true " "$BASE" scripts/catalogo/imagens-exercicios.json
caso "outro gerador do catálogo não pede nada" "api=false app=false " "$BASE" scripts/catalogo/gerar_taco.py
caso ".md dentro de src/ é código" "api=true app=false " "$BASE" api/src/main/resources/termos/uso.md
caso "o workflow pede as duas" "api=true app=true " "$BASE" .github/workflows/deploy.yml
caso "sem base: tudo" "api=true app=true " "" app/src/b.ts
caso "base que não existe: tudo" "api=true app=true " "0123456789012345678901234567890123456789" app/src/b.ts
caso "base inválida: tudo" "api=true app=true " "main" app/src/b.ts

[ "$falhas" = 0 ] && echo "partes-mudadas: tudo certo" || { echo "partes-mudadas: $falhas falha(s)"; exit 1; }
