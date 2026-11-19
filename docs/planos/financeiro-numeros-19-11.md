# Financeiro e Números: totais com cor, colunas, MM/AAAA, filtro padrão e grade dos indicadores

Situação: Entregue na branch (sem push nem merge) · Onde: branch `dieta-tabela` (worktree), sem push nem merge · Atualizado: 19/11/2026

## Objetivo
Cobranças, Visão geral e Números mais legíveis: totais e indicadores com a cor da situação (a mesma das pílulas da tabela), colunas distribuídas, mês em MM/AAAA, Cobranças abrindo já filtrada (ativas do mês atual) e a grade dos indicadores sem cartão sozinho na segunda linha.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Filtro padrão "Mês de vencimento: mês atual" (nome na tela e no endereço `mesVencimento=`; era "Competência", renomeado em 19/11 a pedido do Gustavo porque filtra pelo vencimento; a coluna "Competência" da tabela não muda) | Só no app, pelo filtro de vencimento que já existe (`de`/`ate` do mês, fuso de São Paulo); a API não muda. Avulsa e parcela de acordo (sem competência) entram pelo vencimento, então a avulsa recém-criada não some da lista | Gustavo, 19/11/2026 |
| D2 | "Ativas" | Tudo que não é cancelado, estornado nem renegociado (o critério dos Totais): ABERTA, PAGA e CONTESTADA | Gustavo, 19/11/2026 (texto do pedido) |
| D3 | Cartões de totais e indicadores | O mesmo cartão de indicador da Visão geral (borda colorida, ponto e rótulo na cor, valor grande); Pago = sucesso, Em aberto = atencao, Vencido = perigo (neutro com R$ 0,00), Total = neutro | Gustavo, 19/11/2026 |
| D4 | Grade dos indicadores | 6 por linha a partir de ~1600 px, 3 + 3 de ~1024 a 1600, 2 abaixo, 1 no celular; 4 cartões: 4, 2 + 2, 1 | Gustavo, 19/11/2026 |
| D6 | Lembretes e Recebimento | Padrão das duas abas: 2 colunas a partir de ~1100 px, "Tudo salvo" ou "Alterações não salvas" + Descartar + Salvar no rodapé do cartão, cada opção com interruptor numa linha própria | Gustavo, 19/11/2026 |
| D5 | Mês | "11/2026" em fonte numérica em todo o Financeiro e nos Números; "11/26" só no eixo do gráfico se não couber | Gustavo, 19/11/2026 |

## Passos
- [ ] 1. Peças compartilhadas: rótulo do mês, grade de indicadores, cartão de indicador, colunas da tabela — commit: —
- [ ] 2. Cobranças: totais com cor, colunas, MM/AAAA, filtro padrão em chips e na URL, estado vazio — commit: —
- [ ] 3. Visão geral: colunas da inadimplência, MM/AAAA, grade dos indicadores — commit: —
- [ ] 4. Números: MM/AAAA, indicadores no topo, colunas da equipe, duas colunas, "Como contamos" recolhível — commit: —
- [ ] 5. Abas Lembretes e Recebimento: duas colunas (ajustes 2fr e apoio 1fr), barra de salvar no rodapé, linhas de interruptor, linha do tempo dos lembretes e prévia "O que o aluno vê" — commit: —

## Verificação
Linha de base da worktree (19/11, árvore limpa): typecheck e lint sem erro, jest 8.801 testes, e2e `financeiro*` 175 verdes; `financeiro.spec.ts:657` (parametrizado, 4 variantes) 19 de 20 em 5 repetições, a falha foi `net::ERR_ABORTED` no `page.goto`, do servidor de teste.

## Fora do escopo
- Filtro de competência exato na API (o de "Mês de vencimento" só existe no app) (decidido não fazer em D1).

## O que ficou para trás
- Seis indicadores em linha só a partir de ~1833 px de janela (menu aberto), não ~1600 (D4 mede a área útil, não a janela).
- Lançamentos ainda pinta entrada e saída com cor (D13/D14); só o resultado ficou neutro.
- Merge com a `main` conflita em `CartaoFormasDeRecebimento.tsx` e `AbaRecebimentoOnline.tsx` (a `main` tem Kiwify e "Apagar dados do Pix"; esta branch não): resolver no merge.
- Guias em PDF precisam ser regenerados antes de publicar (textos da Ajuda mudaram).
- Cor da fibra e regra "cor de macro é só marca" estão em `editar-alimento-macros-e-cor-da-fibra.md` e no `docs/design-e-front.md`.
