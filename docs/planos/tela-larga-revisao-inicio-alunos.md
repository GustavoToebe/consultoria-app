# Tela larga: revisão do grupo Início, Alunos, Atualizações e Números (7b)

Situação: Código pronto, sem commit (a sessão principal commita) · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`) · Atualizado: 24/11/2026

## Objetivo
Conferir as quatro telas em 1920, 2560 e 3440 px (menu aberto, tema escuro) contra a 4.10 do `docs/design-e-front.md`
e corrigir o que estica em vez de ganhar colunas, sem mudar modais, folhas nem peças compartilhadas.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Início: teto de colunas da faixa `larga` | 5 → 6 (`MAXIMO_DE_COLUNAS`, `treinador/painel/grade.ts`); a coluna mínima continua decidindo, então 6 só a partir de ~1916 px de painel (2560 com o menu aberto) e 1920 segue com 5 | executor-front (noite de 24/11), a conferir com o Gustavo |
| D2 | Início: tamanhos dos blocos | não mudam (preferência gravada no Editar, D2/D5/D9 de `inicio-editavel.md`); Agenda Médio de fábrica fica como sugestão | executor-front |
| D3 | Números: borda direita | os indicadores ficam no mesmo teto das colunas (`LARGURA_MAXIMA`), com a sobra à direita vazia, como a 4.10 já aceita no editor | executor-front |
| D4 | Atualizações: linhas em caixa | viram uma grade de colunas iguais (célula mínima de 440 px escalada pelo texto, até 6), na ordem de leitura por linha | executor-front |
| D5 | Alunos: grupos | dois cartões de grupo lado a lado quando cada metade tem ao menos ~1000 px (a largura da lista em 1280); divisão por coluna, na ordem dos grupos, regra pura em `dominio/` | executor-front |

## Passos
- [x] 1. Capturas "antes" (1920/2560/3440, cheio e com poucos dados) — `capturas/24-11/tela-larga/<tela>/antes/`
- [x] 2. Início (D1) com jest em `grade.test.ts`
- [x] 3. Números (D3)
- [x] 4. Atualizações (D4) com jest da regra
- [x] 5. Alunos (D5) com jest da regra
- [x] 6. e2e `e2e/tela-larga-inicio-alunos.spec.ts`, capturas "depois", 1280/390, temas e texto grande
- [x] 7. typecheck, lint, jest e e2e vizinhos — tsc limpo; lint 0 erros; jest 403 suítes / 9.429 testes; e2e 209 passaram, 1 falhou (`financeiro-tela-larga` Planos, spec de outro agente em edição), 2 pulados

## Fora do escopo
- Ficha do aluno (outro momento), modais e folhas, peças de `ui/`, tokens.
- Painel de detalhe ao lado (aluno ou atualização): decisão de produto, vai como sugestão no relatório.

## O que ficou para trás
- Sugestões S1 (Agenda Pequeno de fábrica), S2 (painel de detalhe) e S3 (vão do Números em 3440) dependem do Gustavo.
- Relatório: `capturas/24-11/tela-larga/inicio-alunos-relatorio.md` (fora do git).
