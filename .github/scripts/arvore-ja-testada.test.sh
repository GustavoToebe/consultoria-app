#!/usr/bin/env bash
# Testes do arvore-ja-testada.sh com um `gh` falso (sem rede, sem token). Rodam na CI, no job `escopo` do pull request.
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$AQUI/arvore-ja-testada.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

REPO="dono/repo"
SHA="1111111111111111111111111111111111111111"
ARVORE="2222222222222222222222222222222222222222"
OUTRA="3333333333333333333333333333333333333333"
FLUXO="back-deploy.yml"

# gh falso: lê as respostas de $FIX e aplica --jq com o jq de verdade.
cat > "$TMP/gh" <<'FALSO'
#!/usr/bin/env bash
[ "${FALHA_API:-}" = 1 ] && exit 1
caminho="$2"; expr=""
[ "${3:-}" = "--jq" ] && expr="$4"
vazio='{"total_count":0,"artifacts":[]}'
case "$caminho" in
  repos/*/git/commits/*) arq="$FIX/commit.json" ;;
  repos/*/actions/artifacts\?name=*)
    nome="${caminho#*name=}"; nome="${nome%%&*}"
    arq="$FIX/artefatos/$nome.json"
    [ -f "$arq" ] || { echo "$vazio"; exit 0; } ;;
  repos/*/actions/runs/*) arq="$FIX/runs/${caminho##*/}.json" ;;
  *) exit 1 ;;
esac
[ -f "$arq" ] || exit 1
if [ -n "$expr" ]; then jq -r "$expr" "$arq"; else cat "$arq"; fi
FALSO
chmod +x "$TMP/gh"

falhas=0
caso() { # caso <nome> <esperado> <argumentos do script...>
  local nome="$1" esperado="$2"; shift 2
  local obtido
  obtido="$(GH="$TMP/gh" FIX="$TMP/fix" "$SCRIPT" "$@" 2>/dev/null)"
  if [ "$obtido" = "$esperado" ]; then echo "ok   - $nome"; else echo "ERRO - $nome (esperado '$esperado', veio '$obtido')"; falhas=$((falhas + 1)); fi
}

# Monta o cenário padrão: o commit tem a árvore $ARVORE e há um artefato aprovado vindo do pull request (execução 77).
cenario() {
  rm -rf "$TMP/fix"; mkdir -p "$TMP/fix/artefatos" "$TMP/fix/runs"
  echo "{\"sha\":\"$SHA\",\"tree\":{\"sha\":\"$ARVORE\"}}" > "$TMP/fix/commit.json"
  artefato "back-testar" "$ARVORE" 77 false
  execucao 77 pull_request ".github/workflows/$FLUXO" "$REPO" "$REPO"
}
artefato() { # artefato <job> <árvore> <execução> <expirado>
  echo "{\"total_count\":1,\"artifacts\":[{\"name\":\"aprovado-$1-$2\",\"expired\":$4,\"workflow_run\":{\"id\":$3}}]}" \
    > "$TMP/fix/artefatos/aprovado-$1-$2.json"
}
execucao() { # execucao <id> <evento> <caminho> <repositório> <repositório de origem>
  echo "{\"id\":$1,\"event\":\"$2\",\"path\":\"$3\",\"repository\":{\"full_name\":\"$4\"},\"head_repository\":{\"full_name\":\"$5\"}}" \
    > "$TMP/fix/runs/$1.json"
}

cenario
caso "mesma árvore: reaproveita" sim "$REPO" "$SHA" "$FLUXO" back-testar

cenario; echo "{\"sha\":\"$SHA\",\"tree\":{\"sha\":\"$OUTRA\"}}" > "$TMP/fix/commit.json"
caso "árvore diferente: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario
export FALHA_API=1
caso "API fora: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar
unset FALHA_API

cenario; artefato "back-testar" "$ARVORE" 77 true
caso "artefato expirado: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario; execucao 77 push ".github/workflows/$FLUXO" "$REPO" "$REPO"
caso "artefato de execução que não é pull request: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario; execucao 77 pull_request ".github/workflows/outro.yml" "$REPO" "$REPO"
caso "artefato de outro workflow: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario; execucao 77 pull_request ".github/workflows/$FLUXO" "$REPO" "fork/repo"
caso "pull request vindo de fork: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario; execucao 77 pull_request ".github/workflows/$FLUXO" "outro/repo" "outro/repo"
caso "execução de outro repositório: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario; echo 'isto nao e json' > "$TMP/fix/artefatos/aprovado-back-testar-$ARVORE.json"
caso "resposta que não é JSON: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario; echo '{"sha":"x","tree":{"sha":"lixo"}}' > "$TMP/fix/commit.json"
caso "árvore ilegível: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario; rm "$TMP/fix/runs/77.json"
caso "execução do artefato some: roda tudo" nao "$REPO" "$SHA" "$FLUXO" back-testar

cenario
caso "faltam argumentos: roda tudo" nao "$REPO" "$SHA" "$FLUXO"
caso "commit inválido: roda tudo" nao "$REPO" "nao-e-sha" "$FLUXO" back-testar
caso "nome de job com caractere estranho: roda tudo" nao "$REPO" "$SHA" "$FLUXO" 'back-testar;ls'

# Dois jobs obrigatórios (front: testar e e2e): só reaproveita se os dois passaram.
cenario; artefato "front-testar" "$ARVORE" 77 false
caso "front: só o testar aprovado, falta o e2e: roda tudo" nao "$REPO" "$SHA" "$FLUXO" front-testar front-e2e
artefato "front-e2e" "$ARVORE" 77 false
caso "front: testar e e2e aprovados: reaproveita" sim "$REPO" "$SHA" "$FLUXO" front-testar front-e2e
artefato "front-e2e" "$OUTRA" 77 false; rm "$TMP/fix/artefatos/aprovado-front-e2e-$ARVORE.json"
caso "front: e2e aprovado só para outra árvore: roda tudo" nao "$REPO" "$SHA" "$FLUXO" front-testar front-e2e

if [ "$falhas" -gt 0 ]; then echo "$falhas caso(s) falharam."; exit 1; fi
echo "Todos os casos passaram."
