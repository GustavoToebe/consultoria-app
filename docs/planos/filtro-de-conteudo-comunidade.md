# Filtro de conteúdo da Comunidade

Situação: Em andamento até a Onda 5 (Onda 2F da sessão de 17/11/2026) · Onde: main · Atualizado: 17/11/2026 · Base: `e6537dc3`

Fonte: decisões do Gustavo de 17/11/2026. Validade: vale enquanto a lista de termos abaixo for a fixa do servidor.

## Objetivo
Post e comentário de aluno com termo sexual explícito não são publicados. A lista é curta e fixa; falso positivo é o risco principal.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Lista | fixa e curta, no servidor, só termos sexuais explícitos; **nenhum termo de anatomia ou de treino** (peito, coxa, glúteo, bunda etc. ficam liberados) | Gustavo, 17/11 |
| D2 | Comparação | sem acento, sem diferença de maiúsculas, só palavra inteira | Gustavo, 17/11 |
| D3 | Onde vale | post e comentário de aluno, em qualquer mural | Gustavo, 17/11 |
| D4 | Resposta | 422 com "Sua publicação tem uma palavra não permitida.", nada gravado, sem repetir o texto; o app mostra a mensagem no campo | Gustavo, 17/11 |
| D5 | Teste | casos que bloqueiam e casos que não bloqueiam (anatomia e treino liberados, palavra dentro de outra palavra) | Gustavo, 17/11 |
| D6 | Equipe | o filtro não vale para a equipe (`COMUNIDADE_MODERAR`) | decorrência de D3 |

## Passos
- [x] 1. Filtro na API (comunidade) e mensagem no app — executor (Onda 2F, depois dos aniversários) · **API feita em 17/11/2026**: `comunidade/FiltroDeConteudo` (19 termos, palavra inteira, sem acento), 422 `texto` no post (`POST_INVALIDO`) e no comentário de aluno (`COMUNIDADE_INVALIDA`); testes `FiltroDeConteudoTest` e `FiltroDeConteudoIntegrationTest`; **a mensagem no app (campo `texto` do post e do comentário)** · commit: `87f90ead` (API), `3a851bc1` (app, mensagem no campo), `c6296fab` (correções da revisão)
- [x] 2. Revisão independente (falso positivo) — revisor, só leitura · **FEITO em 17/11/2026**: sem achado grave; correções aplicadas: tirou "orgia(s)" e "putaria(s)" da lista por falso positivo, o dígito passou a separar palavra, caracteres invisíveis do Hangul passaram a ser tratados e o corpo da resposta tardia do cliente do YouTube foi fechado · commit: `c6296fab`

## Critérios de aceite
- Bloqueia: termo da lista, com acento, em maiúsculas e entre pontuação. Libera: "peito", "coxa", "glúteo", "bunda", palavra da lista como parte de outra.
- 422 sem texto do usuário no corpo, nem no log; nenhuma linha gravada.

## Fora do escopo
- Moderação automática de imagem, denúncia, lista configurável pelo treinador.

## O que ficou para trás
- (nada ainda)
