# Financeiro em tela larga (só app)

Situação: Concluída em 23/11/2026 · Onde: `main` (árvore local, sem commit) · Atualizado: 23/11/2026

## Objetivo
Em 1920 e 2560 px as abas Cobranças, Planos e Lançamentos usam a largura: o espaço extra vira colunas, e na faixa
ultralarga a cobrança abre num painel fixo ao lado da tabela, sem modal.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Teto | Não era o `LARGURA_EDITOR_DE_CAMPOS` (sem uso no financeiro): eram `maxWidth` locais nos cartões (2400 nas Cobranças, 1800 em Planos, Lançamentos e Pagamentos para conferir). Saíram os quatro | Gustavo (regra); Claude (achado) |
| D2 | Faixa do painel | A régua de 4.10 medida pela `Tela` (área ao lado do menu): `ui/Tela` passou a expor a faixa que já media (`useFaixaDaTela`, contexto, sem mudança visual). Medida por dentro do recuo, a `ultralarga` não chegaria em 2560. Em 2560 com o menu aberto (área ~2320) a faixa é `larga` e a cobrança abre na folha; com o menu recolhido (~2488), no painel | Claude |
| D3 | Painel fixo | `PainelDaCobranca` (480 px, `role=region` com o título; grudado na rolagem na web; corpo que rola e rodapé de ações; X e Esc fecham e devolvem o foco à linha; o foco vai ao título ao abrir; abrir outra troca o conteúdo; Renegociar abre por cima e o painel fica). O mesmo `DetalheDaCobranca` da folha | Gustavo; comportamento Claude |
| D4 | Planos | Grade de cartões (`ui/Grade` com `dominio/gradeDosPlanos.colunasDosPlanos`: 4 ≥ 1600, 3 ≥ 1024, 2 ≥ 600, 1 abaixo; sem cartão sozinho na última linha quando há mais planos que o teto). Cartão: nome, valor em destaque + periodicidade, mínimo e o que inclui, "Com link de pagamento", Kiwify; nome acessível "Abrir plano <nome>" | Gustavo |
| D5 | Arquivados | Selo neutro "Arquivado" e o valor em `textoSuave`, **sem opacidade** (o pedido dizia opacidade menor; texto esmaecido cai abaixo de 4,5:1, WCAG 1.4.3, e o 4.3 do documento diz "nunca opacidade") | Claude (conflito registrado) |
| D6 | Lançamentos | Descrição flex 2; Data (mín. 92), Tipo e Categoria flex 1; Valor flex 1 (mín. 112) à direita | Gustavo |

## Passos
- [x] 1. Tetos locais removidos (`AbaCobrancas`, `AbaPlanos`, `AbaLancamentos`, `CartaoDeConferencias`) — commit: —
- [x] 2. `ui/Tela.useFaixaDaTela` e `PainelDaCobranca` na `AbaCobrancas` (folha abaixo da ultralarga) — commit: —
- [x] 3. Grade de Planos com regra pura e teste (`gradeDosPlanos.test.ts`) — commit: —
- [x] 4. E2e `e2e/financeiro-tela-larga.spec.ts` e capturas em 1920 e 2560, escuro (fora do repositório) — commit: —

## Fora do escopo
- Número de alunos ativos por plano: o `PlanoResponse` da API não traz; precisa de campo novo na API.
- Linha aberta marcada na tabela enquanto o painel mostra a cobrança: pede uma prop na `ui/Tabela` (peça compartilhada).

## O que ficou para trás
- Não conferido: 2560 no claro, Areia e contraste alto, menu no trilho (tablet), app nativo.
