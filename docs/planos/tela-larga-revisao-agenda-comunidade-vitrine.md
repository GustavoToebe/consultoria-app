# Tela larga: revisão de Agenda, Comunidade e Vitrine (24/11)

Situação: Código pronto, sem commit (a sessão principal commita) · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`) · Atualizado: 24/11/2026

## Objetivo
No monitor grande (1920, 2560 e 3440 px, menu aberto), o espaço extra da Agenda, da Comunidade (Vídeos e Mural) e da
Vitrine do treinador vira colunas, sem elemento esticado nem cartão sozinho na linha (4.10 de `docs/design-e-front.md`).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Ano: meses por linha | o maior divisor de 12 que cabe (12, 6, 4, 3, 2, 1): nunca 8 + 4 nem 5 + 5 + 2 | executor-front (padrão da `GradeDeIndicadores`: colunas que dividem o total) |
| D2 | Dia: blocos | a pista dos blocos de cada dia para em `LARGURA_TEXTO_CORRIDO`; as linhas das horas e o clique para criar seguem na coluna toda | executor-front |
| D3 | Semana e Mês | sem mudança: as colunas são os dias (estrutura do dado), não campo esticado | executor-front |
| D4 | Vídeos: colunas | 4 de 1600 a 2000 px de área, 5 de 2000 a 2400, 6 a partir de 2400 (`ultralarga`) | executor-front |
| D5 | Mural | sem mudança no código; o vão à direita pede decisão de produto (sugestão no relatório) | executor-front, a confirmar com o Gustavo |
| D6 | Vitrine | na faixa `larga` ou maior: Itens (2fr) e Página pública (1fr) lado a lado, o par até `LARGURA_EDITOR_DE_CAMPOS`; sem a loja, a lista até `LARGURA_EDITOR` | executor-front |

## Passos
- [x] 1. Capturas "antes" em 1920, 2560 e 3440 (`capturas/24-11/tela-larga/<tela>/antes`) — evidência: capturas
- [x] 2. Agenda: Ano (regra pura `mesesPorLinhaDoAno` + jest) e Dia (pista dos blocos) — commit: —
- [x] 3. Comunidade › Vídeos: 5 e 6 colunas (`colunasDosVideos`) — commit: —
- [x] 4. Vitrine: duas colunas na faixa larga — commit: —
- [x] 5. e2e `tela-larga-agenda-comunidade-vitrine.spec.ts` (geometria nas larguras) e vizinhos; capturas "depois" — evidência: relatório `capturas/24-11/tela-larga/agenda-comunidade-vitrine-relatorio.md`

## Fora do escopo
- Mural em tela larga (D5): decisão de produto, no relatório.
- Dia com painel ao lado (lista do dia ou próximos dias): decisão de produto, no relatório.

## O que ficou para trás
- S1 (Dia com coluna ao lado), S2 (Mural na tela larga) e S3 (Vitrine em 3440): decisões de produto, no relatório.
- Texto para a 4.10 e a 4.11 de `docs/design-e-front.md` (no relatório; este agente não edita o documento).
