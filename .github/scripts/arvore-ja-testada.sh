#!/usr/bin/env bash
# Diz se o commit que entrou na main tem a MESMA árvore (tree) que já passou nos testes de um pull request.
#
# Uso: arvore-ja-testada.sh <dono/repo> <sha-do-commit> <arquivo-do-workflow> <job> [<job>...]
#   Ex.: arvore-ja-testada.sh GustavoToebe/central "$GITHUB_SHA" back-deploy.yml back-testar
#
# Como funciona: no pull request, o fim de cada job de teste que passou sobe um artefato minúsculo chamado
# `aprovado-<job>-<árvore do commit testado>` (o commit de merge, refs/pull/N/merge). Aqui procuramos esse nome para a
# árvore do commit da main. Só vale se TODOS os jobs pedidos tiverem artefato não expirado, vindo de uma execução
# `pull_request` deste mesmo repositório e deste mesmo workflow.
#
# Saída: uma linha em stdout, `sim` ou `nao`; o motivo vai para stderr. NA DÚVIDA É SEMPRE `nao` (roda tudo, como antes):
# API fora, resposta estranha, nome inesperado, artefato expirado ou de outro lugar. O script nunca falha o job.
# Variável GH: o comando `gh` (os testes trocam por um falso).
set -uo pipefail
GH="${GH:-gh}"

nao() { echo "nao"; echo "testes completos: $1" >&2; exit 0; }
sim() { echo "sim"; echo "testes reaproveitados: $1" >&2; exit 0; }

[ "$#" -ge 4 ] || nao "uso incorreto"
repo="$1"; sha="$2"; fluxo="$3"; shift 3
[[ "$repo" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || nao "repositório inválido"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || nao "commit inválido"
[[ "$fluxo" =~ ^[A-Za-z0-9._-]+\.yml$ ]] || nao "workflow inválido"

arvore="$($GH api "repos/$repo/git/commits/$sha" --jq .tree.sha 2>/dev/null)" || nao "API fora ao ler o commit"
[[ "$arvore" =~ ^[0-9a-f]{40}$ ]] || nao "árvore ilegível"

for job in "$@"; do
  [[ "$job" =~ ^[A-Za-z0-9_-]+$ ]] || nao "nome de job inválido"
  nome="aprovado-${job}-${arvore}"
  lista="$($GH api "repos/$repo/actions/artifacts?name=${nome}&per_page=30" 2>/dev/null)" || nao "API fora ao listar artefatos"
  execucoes="$(printf '%s' "$lista" | jq -r --arg n "$nome" \
    '[.artifacts[] | select(.name == $n and .expired == false) | .workflow_run.id | select(. != null)] | unique | .[]' 2>/dev/null)" \
    || nao "resposta de artefatos ilegível"
  achou=0
  for execucao in $execucoes; do
    [[ "$execucao" =~ ^[0-9]+$ ]] || continue
    dados="$($GH api "repos/$repo/actions/runs/${execucao}" 2>/dev/null)" || continue
    if printf '%s' "$dados" | jq -e --arg repo "$repo" --arg fluxo ".github/workflows/$fluxo" \
      '.event == "pull_request" and .path == $fluxo and .repository.full_name == $repo and .head_repository.full_name == $repo' \
      >/dev/null 2>&1; then
      achou=1
      break
    fi
  done
  [ "$achou" = 1 ] || nao "sem aprovação de $job para a árvore $arvore"
done

sim "árvore $arvore já passou em pull request ($*)"
