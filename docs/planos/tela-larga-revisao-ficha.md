# Tela larga (7b): revisão das abas da Ficha do aluno

Situação: Concluída em 24/11/2026 (falta commit) · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`) · Atualizado: 24/11/2026

Fonte: pedido do Gustavo (item 7b, varredura de tela larga) passado pela sessão principal; base `b6206ee9` (a ficha-24-11 já
mesclada). Relatório com capturas: `capturas/24-11/tela-larga/ficha-relatorio.md` (fora do git). Validade: refazer os passos
se `dominio/colunasDaFicha`, `BlocosDaFicha`, `ui/Tela`, `ListaEmColunas`, `CartaoLesoes` ou as faixas de `tema/tokens.ts` mudarem.

## Objetivo
No monitor grande (1920, 2560 e 3440 com o menu aberto) as abas da ficha usam o espaço extra em colunas, sem esticar cartão,
linha, campo nem tabela (4.10 de `docs/design-e-front.md`). A aba Dados segue o critério do Gustavo: as mesmas duas colunas,
sem esticar, até `LARGURA_EDITOR_DE_CAMPOS` (1400), à esquerda.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Teto dos Dados | `larguraMaximaDasColunas` devolve `LARGURA_EDITOR_DE_CAMPOS` sempre que há duas colunas (faixa `normal` em diante), não só na `ultralarga`. Sem efeito abaixo de 1400 px de aba (1280); 1920 passa de ~1630 para 1400 e 2560 de ~2270 para 1400. Some o salto entre `larga` e `ultralarga` | Gustavo (critério) e executor-front |
| D2 | Lesões na coluna de 1400 | `LARGURA_EM_COLUNAS` do `CartaoLesoes` de 800 para 760 (a soma dos mínimos das colunas; a mesma da Auditoria): a tabela tem ~785 px na coluna da esquerda e fica tabela em 1920, 2560 e 3440 (antes era tabela em 1920 e 2560, cartões em 3440). Em 1280 continuam os cartões | Executor-front |
| D3 | Resumo | Atividade recente como 3ª coluna quando cabem três de 640 px (`resumoEmTresColunas`), pela largura medida na ficha (prop `largura`), não pela faixa `ultralarga`: abre em 2560, não em 1920, e a Atividade recente não remonta | Executor-front (advisor) |
| D4 | Planos | As linhas das pastas numa `ListaEmColunas` com `MINIMO_DA_COLUNA_COM_ACOES` (720): 1 coluna em 1280, 2 em 1920, 3 (teto) em 2560 e 3440; com poucas pastas a vaga fica vazia à direita | Executor-front (peça já existente) |
| D5 | Acompanhamento e Evolução | Duas pilhas independentes 1:1 quando cada uma tem ≥ 1000 px (`pilhasDaAba`, a régua dos grupos de Alunos): 2560 e 3440; 1920 segue numa coluna. Acompanhamento: Frequência, Treinos concluídos, Recordes, Trocas à esquerda; Água e Evolução das respostas à direita. Evolução: Peso, Progresso, Fotos à esquerda; Avaliação física à direita. Pilha vazia de um lado = uma coluna | Executor-front |
| D6 | Medição sem remontar | A largura das pilhas e do Resumo é medida no cabeçalho da ficha (que existe antes de o aluno chegar), para os cartões já nascerem no arranjo certo e não buscarem tudo de novo; o e2e conta os pedidos | Executor-front |
| D7 | Campo "Medida" | O seletor e o interruptor da Evolução por medida param em `LARGURA_FORMULARIO` (640) | Executor-front |

## Passos
- [x] 1. Capturas "antes" (1920, 2560, 3440; escuro, menu aberto) da build de `bc12d415` (mesmo código de `b6206ee9`, só docs no meio) com `expo export --clear` e TEMP próprio — commit/run: —
- [x] 2. Regras puras em `dominio/colunasDaFicha.ts` (`larguraMaximaDasColunas`, `resumoEmTresColunas`, `pilhasDaAba`) com 4 casos novos em `colunasDaFicha.test.ts` — commit/run: —
- [x] 3. Telas: `app/treinador/alunos/[id].tsx` (pilhas, medida no cabeçalho), `ResumoDoAluno`, `CartaoPastas`, `CartaoLesoes`, `avaliacao/EvolucaoDaMedida`, comentário do `BlocosDaFicha` — commit/run: —
- [x] 4. E2e `e2e/tela-larga-ficha.spec.ts`: geometria em 1280, 1920, 2560 e 3440 (Dados ≤ 1400 e 3:2, Planos em colunas, Resumo em 3 colunas só de 2560, pilhas só de 2560, "Medida" ≤ 640) e capturas com `CAPTURAS_TELA_LARGA_GRUPO` — commit/run: —
- [x] 5. Capturas "depois" (1920, 2560, 3440, 1280, 390, texto Extra em 2560) e verificações (tsc, lint, jest, e2e do grupo e vizinhos em build limpa) — commit/run: —
- [ ] 6. Commit pela sessão principal — commit/run: —

## Fora do escopo
- Peças compartilhadas (`ui/Tabela`, `ui/ListaDeDados`, `CartaoAgua` por dentro): não mexidas.
- Painel de detalhe ou conteúdo novo para ocupar a sobra à direita dos Dados (decisão de produto; sugestão no relatório).

## O que ficou para trás
- Texto para o `AGENTS.md` (linha da Ficha › Dados: "na `ultralarga` a aba inteira não passa de `LARGURA_EDITOR_DE_CAMPOS`") e a 4.10: no relatório, seção "Texto proposto".
- Sugestões que dependem do Gustavo: no relatório (S1 a S3).
