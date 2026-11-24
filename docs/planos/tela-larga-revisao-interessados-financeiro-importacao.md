# Tela larga: revisão de Interessados, Financeiro e Importação (24/11)

Situação: Pronto para revisão (sem commit) · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`) · Atualizado: 24/11/2026

## Objetivo
Em 1920, 2560 e 3440 px (menu aberto, escuro), o espaço extra dessas telas vira colunas, nunca elemento esticado, seguindo
`docs/design-e-front.md` 4.10. Modais e folhas não mudam. Relatório com as capturas antes e depois em
`capturas/24-11/tela-larga/interessados-financeiro-importacao-relatorio.md` (fora do git).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Interessados › Indicadores: os oito números numa linha só quando a grade tem ~1840 px (×`fatorTexto`); 4, 2 e 1 como antes, nunca 3 | `dominio/colunasDeInteressados.ts` | executor-front (noite, padrão do app) |
| D2 | Interessados › Indicadores: Perdas, Origem, Como contamos e Limites numa linha só a partir de 2448 px de área (3440 com o menu aberto; colunas de ~600 px, a tabela segue em colunas); glossário em 1 a 4 colunas como o "Como calculamos" do Financeiro; texto corrido em `LARGURA_TEXTO_CORRIDO` | idem | executor-front |
| D3 | Financeiro › Visão geral: com o contêiner ≥ 1800 + 16 + 480 px, duas colunas (Inadimplência, mês a mês e quebras à esquerda, até 1800; renovações, próximos, líquido e resultado do mês empilhados à direita). Medido pelo contêiner, então "Limitada" não abre a coluna | `dominio/colunasDaVisaoGeral.ts` | executor-front |
| D4 | Financeiro › Planos: teto de 5 colunas a partir de 2000 px de grade e 6 a partir de 2400 (antes parava em 4) | `dominio/gradeDosPlanos.ts` | executor-front |
| D5 | Importação (assistente de uma aba nas etapas sem tabela, planilha completa e assistida): conteúdo até `LARGURA_EDITOR_DE_CAMPOS` (1400), alinhado à esquerda; só o Mapeamento segue largo (a planilha precisa da largura); as etapas no topo ficam sempre em 1400; busca dos nomes em `LARGURA_FORMULARIO` | telas da importação | executor-front |
| D6 | Fica como está: tabela das Cobranças e dos Lançamentos sem teto (decisão de 23/11), Lembretes e Recebimento (formulários de 640, regra 4.10) | — | Gustavo (23/11) / 4.10 |

## Passos
- [x] 1. Capturas "antes" (1920, 2560, 3440; menu aberto; escuro) — fora do git
- [x] 2. Interessados › Indicadores (D1, D2) — `Indicadores.tsx`, `dominio/colunasDeInteressados.ts` (+ teste) — commit: — (sem commit, 24/11)
- [x] 3. Financeiro › Visão geral (D3) e Planos (D4) — `VisaoGeral.tsx`, `dominio/colunasDaVisaoGeral.ts` (+ teste), `dominio/gradeDosPlanos.ts` (+ teste), `e2e/financeiro-tela-larga.spec.ts` — commit: —
- [x] 4. Importação (D5) — `TelaImportacao.tsx`, `planilhaCompleta/AssistenteDaPlanilha.tsx`, `app/treinador/importacao/assistida.tsx` — commit: —
- [x] 5. Capturas "depois", 1280/390, claro/Areia/texto grande, e2e `tela-larga-interessados-financeiro-importacao.spec.ts` (11 casos) — refeitos em build limpa (`expo export --clear`, TEMP próprio); "antes" refeitos de `git archive HEAD` — commit: —

## Fora do escopo
- Painel fixo da inscrição (Interessados › Lista e Kanban) e do detalhe da importação (Histórico) na ultralarga: painel novo, decisão do Gustavo (sugestões no relatório).

## O que ficou para trás
- Sugestões S1 a S4 (painel da inscrição, Kanban com encerradas, painel do Histórico da importação, terceira coluna no
  Recebimento): decisão do Gustavo, capturas no relatório.
- Texto do `design-e-front.md` 4.10 e do `AGENTS.md` (Planos de 1 a 6 colunas, coluna de apoio da Visão geral): proposto no
  relatório, não aplicado (fora do escopo desta unidade).
- Frases soltas da planilha completa acima de 72ch dentro do teto de 1400; `tela-larga.spec.ts` com pasta de capturas
  padrão de outra máquina (passa com `CAPTURAS_TELA_LARGA`).
- Situação ao fechar: estado local sem commit, base HEAD 7b492aa3 da branch `tela-larga-revisao` (24/11); vale enquanto
  `TelaDoEditor`, `Grade`, `Tabela` e `LinhaDeBlocos` não mudarem.
