#!/usr/bin/env bash
# Limpa versões antigas das imagens deste repositório no GHCR (os Packages gastam o orçamento do GitHub).
#
# Variáveis: DONO (usuário dono dos pacotes), PACOTES (nomes separados por espaço), MANTER (quantas versões recentes ficam, mínimo 10),
#            APAGAR (`true` apaga; qualquer outro valor só LISTA, que é o padrão), GH (comando gh; os testes trocam por um falso).
#
# Regras de segurança (o rollback.sh e a VPS baixam as imagens pela tag, então apagar errado derruba um deploy ou um rollback):
#  1. Ficam SEMPRE as MANTER versões com tag mais recentes de cada pacote. A VPS só usa a release atual e a anterior (releases/<app>/
#     atual.env e anterior.env) e as duas estão entre as últimas publicadas, a menos que MANTER deploys seguidos falhem.
#  2. Só é apagada versão cujas tags são TODAS de commit (12 caracteres hexadecimais). Tag com outro formato nunca é apagada.
#  3. Versão SEM tag nunca é apagada aqui: no GHCR as imagens têm manifestos filhos sem tag (attestations) que pertencem a uma
#     imagem com tag; apagar um deles quebra o `docker pull` da tag que fica. Só é listada.
#  4. Qualquer erro ao listar (API fora, JSON estranho) para tudo sem apagar nada.
set -uo pipefail
GH="${GH:-gh}"
DONO="${DONO:?DONO é obrigatório}"
PACOTES="${PACOTES:?PACOTES é obrigatório}"
MANTER="${MANTER:-20}"
APAGAR="${APAGAR:-false}"

[[ "$MANTER" =~ ^[0-9]+$ ]] && [ "$MANTER" -ge 10 ] || { echo "MANTER deve ser um número de 10 para cima (veio '$MANTER')." >&2; exit 2; }
[[ "$DONO" =~ ^[A-Za-z0-9-]+$ ]] || { echo "DONO inválido." >&2; exit 2; }

if [ "$APAGAR" = true ]; then echo "MODO: APAGAR (mantém as $MANTER versões com tag mais recentes de cada pacote)"; else echo "MODO: SIMULAÇÃO (nada é apagado; mantém as $MANTER versões com tag mais recentes de cada pacote)"; fi

status=0
for pacote in $PACOTES; do
  [[ "$pacote" =~ ^[a-z0-9._-]+$ ]] || { echo "Nome de pacote inválido: $pacote" >&2; status=1; continue; }
  echo
  echo "=== $DONO/$pacote"
  if ! bruto="$($GH api --paginate "/users/$DONO/packages/container/$pacote/versions?per_page=100" 2>&1)"; then
    echo "Não consegui listar as versões (nada foi apagado): $(printf '%s' "$bruto" | head -c 300)" >&2
    status=1; continue
  fi
  # --paginate concatena um array por página; `jq -s add` junta.
  if ! versoes="$(printf '%s' "$bruto" | jq -s 'add // []' 2>/dev/null)" || ! printf '%s' "$versoes" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "Resposta ilegível da API (nada foi apagado)." >&2; status=1; continue
  fi

  total="$(printf '%s' "$versoes" | jq 'length')"
  semtag="$(printf '%s' "$versoes" | jq '[.[] | select((.metadata.container.tags // []) | length == 0)] | length')"
  echo "Versões: $total no total, $semtag sem tag (não mexo nelas)."

  # Com tag, da mais nova para a mais antiga. As MANTER primeiras ficam; das demais, só as de tag de commit são candidatas.
  plano="$(printf '%s' "$versoes" | jq -r --argjson manter "$MANTER" '
    [.[] | select((.metadata.container.tags // []) | length > 0)]
    | sort_by(.created_at) | reverse
    | to_entries[]
    | .key as $i | .value as $v
    | ($v.metadata.container.tags) as $tags
    | (if $i < $manter then "MANTER"
       elif ($tags | all(test("^[0-9a-f]{12}$"))) then "APAGAR"
       else "MANTER-TAG-ESPECIAL" end) as $acao
    | [$acao, ($v.id | tostring), $v.created_at, ($tags | join(","))] | @tsv')"

  [ -n "$plano" ] || { echo "Nenhuma versão com tag."; continue; }
  printf '%s\n' "$plano" | awk -F'\t' '{printf "  %-20s id=%-12s %s  tags=%s\n", $1, $2, $3, $4}'

  apagar_ids="$(printf '%s\n' "$plano" | awk -F'\t' '$1 == "APAGAR" {print $2}')"
  n="$(printf '%s\n' "$apagar_ids" | grep -c . || true)"
  echo "Resultado: $n versão(ões) $([ "$APAGAR" = true ] && echo 'a apagar' || echo 'seriam apagadas')."

  if [ "$APAGAR" = true ]; then
    for id in $apagar_ids; do
      [[ "$id" =~ ^[0-9]+$ ]] || continue
      if $GH api -X DELETE "/users/$DONO/packages/container/$pacote/versions/$id" >/dev/null 2>&1; then
        echo "  apagada: $id"
      else
        echo "  FALHOU ao apagar $id (o token pode não ter permissão de apagar pacotes)." >&2
        status=1
      fi
    done
  fi
done
exit "$status"
