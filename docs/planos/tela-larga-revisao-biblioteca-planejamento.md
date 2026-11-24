# Tela larga: revisão da Biblioteca e do Planejamento (7b)

Situação: Concluída em 24/11/2026 (sem commit) · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`) · Atualizado: 24/11/2026

## Objetivo
No monitor grande (1920, 2560 e 3440 px, menu aberto), as listas da Biblioteca e do Planejamento não esticam as linhas
pela tela inteira: o espaço extra vira colunas (4.10 do `docs/design-e-front.md`), e os campos dos editores de modelo
param no teto do projeto. Nada muda em 1280 e 390.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Listas em colunas lidas de cima para baixo (coluna 1 inteira, depois a 2) | cada coluna é uma `ListaDeLinhas` própria, com as mesmas divisórias | executor-front, padrão 4.10 (24/11) |
| 2 | Colunas pela largura medida da própria lista, não pela faixa | mínimo por coluna 560 px (Biblioteca) e 720 px (modelos do Planejamento, com 3 botões); teto 3; nunca coluna vazia | executor-front (24/11) |
| 3 | Coleções e categorias continuam em cartões de largura cheia; só as linhas de dentro viram colunas | cartões em grade ficariam com alturas desiguais ao abrir | executor-front (24/11) |
| 4 | Busca do Planejamento com o teto da busca da Biblioteca | 480 px (`BarraDaBiblioteca`) | executor-front, precedente (24/11) |
| 5 | Nome do modelo (dieta) e Nome + Descrição (mobilidade) com o teto do nome do modelo de treino | `LARGURA_EDITOR` (1040), como `NomeDoModeloDeTreino` | executor-front, precedente (24/11) |

## Passos
- [x] 1. Regra pura `dominio/listaEmColunas.ts` + teste — commit: — (aguardando a sessão principal)
- [x] 2. `treinador/ListaEmColunas.tsx` nas cinco abas da Biblioteca e nas coleções do Planejamento — commit: — (aguardando a sessão principal)
- [x] 3. Busca do Planejamento, nome do modelo de dieta e "Sobre o modelo" da mobilidade com teto — commit: — (aguardando a sessão principal)
- [x] 4. E2e `e2e/tela-larga-biblioteca-planejamento.spec.ts` (geometria em 1280, 1920, 2560 e 3440; capturas com `CAPTURAS_TELA_LARGA_BP`) — commit: — (aguardando a sessão principal)

Evidência: jest 403/9.429 verde; e2e do grupo 6/6; vizinhos 104 + 1 instável (passou sozinho); capturas em
`capturas/24-11/tela-larga/<tela>/antes|depois|conferencia/` (fora do git). Extra: em 390 os botões da busca do
Planejamento quebram linha ("Nova semana de treino" era cortado na borda).

## Fora do escopo
- Editores de pacote, metodologia e séries (uma coluna de `LARGURA_EDITOR`, centralizada): regra da 4.10; preencher os
  lados pediria painel novo (sugestão no relatório).
- Descrições de cartão e subtítulo de cabeçalho acima de 72ch: moram em `ui/Cartao` e `ui/Cabecalho` (peças compartilhadas).
- Abas de questionário do Planejamento (Atualização, Anamnese, Inscrição) e a ficha do aluno.

## O que ficou para trás
- Relatório: `capturas/24-11/tela-larga/biblioteca-planejamento-relatorio.md` (fora do git).
