#!/usr/bin/env bash
# Testes do limpar-ghcr.sh com um `gh` falso: confere o que seria apagado e o que NUNCA pode ser.
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$AQUI/limpar-ghcr.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# gh falso: GET devolve $FIX/versoes.json (em duas páginas, para provar a junção); DELETE só registra a chamada.
cat > "$TMP/gh" <<'FALSO'
#!/usr/bin/env bash
[ "${FALHA_API:-}" = 1 ] && { echo "HTTP 500" >&2; exit 1; }
if [ "$1" = api ] && [ "$2" = "-X" ] && [ "$3" = DELETE ]; then echo "$4" >> "$FIX/deletes.log"; exit 0; fi
if [ "$1" = api ] && [ "$2" = "--paginate" ]; then
  jq -c '.[0:15]' "$FIX/versoes.json"; jq -c '.[15:]' "$FIX/versoes.json"; exit 0
fi
exit 1
FALSO
chmod +x "$TMP/gh"

# 30 versões com tag de commit (ids 1..30, a 30 é a mais nova), uma com tag "latest", uma com tag de commit + "latest" e 3 sem tag.
gerar() {
  jq -n '
    [range(1; 31) | {id: ., created_at: ("2026-01-" + (("0" + tostring)[-2:]) + "T10:00:00Z"),
                      metadata: {container: {tags: [("abc" + (("000000000" + tostring)[-9:]))]}}}]
    + [{id: 101, created_at: "2025-12-01T10:00:00Z", metadata: {container: {tags: ["latest"]}}},
       {id: 102, created_at: "2025-12-02T10:00:00Z", metadata: {container: {tags: ["abc000000999", "latest"]}}},
       {id: 201, created_at: "2025-11-01T10:00:00Z", metadata: {container: {tags: []}}},
       {id: 202, created_at: "2025-11-02T10:00:00Z", metadata: {container: {tags: []}}},
       {id: 203, created_at: "2025-11-03T10:00:00Z", metadata: {container: {tags: []}}}]' > "$1"
}

falhas=0
confere() { # confere <nome> <condição em bash>
  if eval "$2"; then echo "ok   - $1"; else echo "ERRO - $1"; falhas=$((falhas + 1)); fi
}
rodar() { # rodar <APAGAR> [MANTER]
  rm -f "$TMP/fix/deletes.log"
  GH="$TMP/gh" FIX="$TMP/fix" DONO=dono PACOTES="pacote-a" MANTER="${2:-20}" APAGAR="$1" bash "$SCRIPT" > "$TMP/saida.txt" 2>"$TMP/erro.txt"
  echo $?
}

mkdir -p "$TMP/fix"; gerar "$TMP/fix/versoes.json"

# Simulação: lista e não apaga nada.
codigo="$(rodar false)"
confere "simulação termina bem" '[ "$codigo" = 0 ]'
confere "simulação não chama DELETE" '[ ! -f "$TMP/fix/deletes.log" ]'
confere "simulação anuncia as que seriam apagadas (10 de 30)" 'grep -q "10 versão(ões) seriam apagadas" "$TMP/saida.txt"'

# Apagar: só as 10 mais antigas com tag de commit (ids 1..10); ficam as 20 mais novas (11..30).
codigo="$(rodar true)"
confere "apagar termina bem" '[ "$codigo" = 0 ]'
confere "apaga exatamente 10 versões" '[ "$(wc -l < "$TMP/fix/deletes.log")" = 10 ]'
confere "apaga a mais antiga (id 1)" 'grep -q "/versions/1$" "$TMP/fix/deletes.log"'
confere "apaga a décima mais antiga (id 10)" 'grep -q "/versions/10$" "$TMP/fix/deletes.log"'
confere "NÃO apaga a 11ª (a 20ª mais nova fica)" '! grep -q "/versions/11$" "$TMP/fix/deletes.log"'
confere "NÃO apaga a mais nova (id 30)" '! grep -q "/versions/30$" "$TMP/fix/deletes.log"'
confere "NÃO apaga versão sem tag" '! grep -qE "/versions/20[123]$" "$TMP/fix/deletes.log"'
confere "NÃO apaga tag que não é de commit (latest)" '! grep -qE "/versions/(101|102)$" "$TMP/fix/deletes.log"'

# Menos versões do que MANTER: nada a apagar.
jq '.[0:8]' "$TMP/fix/versoes.json" > "$TMP/fix/curta.json" && mv "$TMP/fix/curta.json" "$TMP/fix/versoes.json"
codigo="$(rodar true)"
confere "poucas versões: não apaga nada" '[ "$codigo" = 0 ] && [ ! -f "$TMP/fix/deletes.log" ]'

# API fora: erro, nada apagado.
gerar "$TMP/fix/versoes.json"
export FALHA_API=1
codigo="$(rodar true)"
unset FALHA_API
confere "API fora: sai com erro e não apaga" '[ "$codigo" != 0 ] && [ ! -f "$TMP/fix/deletes.log" ]'

# MANTER pequeno demais é recusado.
codigo="$(rodar true 3)"
confere "MANTER abaixo de 10 é recusado" '[ "$codigo" = 2 ] && [ ! -f "$TMP/fix/deletes.log" ]'

if [ "$falhas" -gt 0 ]; then echo "$falhas caso(s) falharam."; exit 1; fi
echo "Todos os casos passaram."
