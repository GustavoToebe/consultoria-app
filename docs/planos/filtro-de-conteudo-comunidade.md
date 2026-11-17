# Filtro de conteúdo da Comunidade

Situação: Em andamento (Onda 2F da sessão de 17/11/2026) · Onde: main · Atualizado: 17/11/2026 · Base: `e6537dc3`

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
- [ ] 1. Filtro na API (comunidade) e mensagem no app — executor (Onda 2F, depois dos aniversários) · commit: —
- [ ] 2. Revisão independente (falso positivo) — revisor, só leitura · commit: —

## Critérios de aceite
- Bloqueia: termo da lista, com acento, em maiúsculas e entre pontuação. Libera: "peito", "coxa", "glúteo", "bunda", palavra da lista como parte de outra.
- 422 sem texto do usuário no corpo, nem no log; nenhuma linha gravada.

## Fora do escopo
- Moderação automática de imagem, denúncia, lista configurável pelo treinador.

## O que ficou para trás
- (nada ainda)
