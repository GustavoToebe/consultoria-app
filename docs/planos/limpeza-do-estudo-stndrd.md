# Limpeza do estudo STNDRD e do fallback "Café"

Situação: Em andamento (plano escrito antes do código, 16/11/2026) · Onde: main · Atualizado: 16/11/2026

Fonte: pedido do Gustavo de 16/11 (2A), revisão 1B e mapa de 16/11/2026, base `bee10fa0`. Validade: vale enquanto o commit visual `1f33299d` (paletas novas, selo de nível) for a base de `tema/tokens.ts`.

## Objetivo
Tirar o nome "STNDRD" do código e do texto da tela e acabar com o alias silencioso "Café" (`CAFE` virava `ESCURO` sem aviso), sem mudar nenhuma cor e sem decidir sozinho o que fica do estudo.

## O que existe hoje (conferido)
- `CAFE` é alias do Escuro em `tema/tokens.ts:207-208,256,264-278`, na leitura de preferências (`dominio/preferencias.ts:141`), no tipo `Tema` (`api/tipos.ts:8`), em `Consultoria.Tema` (Java) e no CHECK da V055. `paletaDe` já cai em `ESCURO` para qualquer código desconhecido (isso não é o Café).
- "STNDRD" aparece em ~70 usos de identificador (`stndrd`, `TokensStndrd`, `tokensStndrdDe`, `TOKENS_STNDRD_*`), em 2 textos visíveis (`ui/PreferenciasDoApp.tsx:76,83`) e em comentários. **`treinador/financeiro/VisaoGeral.tsx` e `ResultadoDoMes.tsx` usam `useTema().stndrd` e `TokensStndrd`** e são da outra sessão (InfinitePay): o rename dos identificadores não fecha sem tocá-los.
- Os três `*_STNDRD.md` da raiz ficam fora do git e não se tocam.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Rename dos identificadores | **bloqueado** até a outra sessão liberar `treinador/financeiro/`; nome sugerido `realce`/`TokensRealce` (sem alias temporário: é código de transição) | restrição do Gustavo (não tocar financeiro) |
| D2 | Texto visível e comentários | tirar "STNDRD" agora | pedido do Gustavo |
| D3 | Café | sai do app (tipo, `PALETAS`, alias, leitura de preferências) e, em commit próprio, da API: V080 troca `CAFE` por `ESCURO` e refaz o CHECK, enum sem `CAFE`; se não houver V080 livre, a API fica para depois | recomendação desta sessão (o Gustavo confirma) |
| D4 | O que fica do estudo | **não decidido**: lista e recomendação no relatório de 16/11 | pedido do Gustavo |

## Passos
- [ ] 1. Plano e entrada no README — commit: este
- [x] 2. App: tirar "STNDRD" do texto e dos comentários; tirar o Café (tipo, tokens, preferências, testes, docs de design) — commit: ver `git log` ("Limpeza do estudo STNDRD no app"); sobra o comentário "Liquid Glass (STNDRD)" em `aluno/BarraDescanso.tsx:26`, que vai com o rename (passo 4)
- [ ] 3. API: V080 (`CAFE` → `ESCURO`, CHECK refeito), enum sem `CAFE`, totais de migrations — commit: —
- [ ] 4. Rename dos identificadores `stndrd` (depende da liberação do `financeiro/`) — commit: —
- [ ] 5. e2e inteiro filtrado e capturas claro, Areia e escuro a 390 e 1280 — commit: —

## Fora do escopo
- Trocar valores de cor, superfícies ou o que fica do estudo (D4).

## O que ficou para trás
- (preencher na entrega e copiar para "Pendências soltas")
