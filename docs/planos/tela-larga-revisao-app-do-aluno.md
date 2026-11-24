# Tela larga: revisão do app do aluno na web (7b)

Situação: Concluída em 24/11/2026 (sem commit; a sessão principal commita) · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`) · Atualizado: 24/11/2026

## Objetivo
No monitor grande (1920, 2560 e 3440 px, menu aberto), as telas do aluno na web deixam de ser uma faixa de 1120 px no meio
com dois terços vazios: da faixa `larga` em diante o espaço vira colunas (4.10), sem esticar cartão, botão ou campo. Até a
faixa `normal` (celular, tablet, PC de 1280) nada muda.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Teto das telas do aluno por faixa | 1120 até a `normal`; 1688 (três faixas de 552) na `larga` e na `ultralarga`; nunca quatro | Agente (noite de 24/11), pelo padrão de 4.10 |
| D2 | Onde mora a regra | `dominio/telaLargaDoAluno.ts` (pura, com teste) e `aluno/TelaDoAluno.tsx` (a faixa medida pela `Tela`, `useFaixaDaTela`) | Agente |
| D3 | Grade de cartões na tela larga | `colunasDaGradeDoAluno`: célula mínima 360; numa linha, as colunas que cabem; em mais de uma, iguais sem cartão sozinho (`colunasDaGradeDeIndicadores`); sem divisão possível, as que cabem | Agente |
| D4 | Peças reusadas na prévia do treinador (`DietaDoAluno`, `ExerciciosDoDia`) | Arranjo largo só por prop `largo` que só a rota do aluno passa; a folha "Ver como o aluno" não muda | Agente (folhas não mudam, 4.10) |
| D5 | Início | Três colunas (Dieta/Água/Hoje · pendências/compromissos/semana · nível/vitrine) só quando a terceira tem conteúdo: nível (retorno e internet) ou itens na vitrine (`faixasDoInicio`); sem isso, duas colunas em 1120 | Agente; corrigido na revisão independente (antes dependia só do retorno) |
| D7 | Mapa de treinos | Passo máximo 24 (célula de 22, a do celular) em vez de 18: a grade ocupa ~78% do cartão de 1688 | Agente, revisão independente |
| D6 | Conta | Sem mudança: 320 + 640 é a regra de formulário (4.10) | Agente |

## Passos
- [x] 1. Capturas "antes" (1920, 2560, 3440; menu aberto; escuro) — `capturas/24-11/tela-larga/aluno-*/antes`
- [x] 2. Regra pura e teste (`dominio/telaLargaDoAluno.ts`, `.test.ts`) — commit: `7b9d9a46`
- [x] 3. Treino (lista e mobilidade), sessão do dia, Dieta, Histórico, Início, Comunidade — commit: `7b9d9a46`
- [x] 4. Capturas "depois" + 1280/390, claro/Areia/texto grande; e2e `e2e/tela-larga-app-do-aluno.spec.ts` (9/9, build limpa) — commit: `7b9d9a46`
- [x] 5. Correções da revisão independente: terceira coluna do Início pelo conteúdo, mapa com célula de 22, dieta 6 = 3 + 3 conferida, casos de 390 e 1280 que rodam sempre; e2e 25/25 e jest 9504/9504 em build limpa — commit: —

## Fora do escopo
- Ficha do aluno, telas do treinador e peças compartilhadas (`ui/*`, `comunidade/CartaoDoPost`): sugestões no relatório
  `capturas/24-11/tela-larga/app-do-aluno-relatorio.md`.
- Tela do exercício (`/aluno/sessao/[uid]/[exercicio]`), lista de compras, ciclo, vitrine e "Bom trabalho!": continuam em 1120.

## O que ficou para trás
- Ver o relatório (seções "Sugestões" e "O que encontrei e não mexi").
- `e2e/treino-do-aluno-lacunas.spec.ts`: 5 casos do histórico do exercício falham também no HEAD `bf60dd22` (botão duplicado); dono: quem mexeu na tela do exercício.
- A skill `web-design-guidelines` **não foi rodada** nos arquivos tocados (pendente; dono: sessão principal ou próxima revisão de front).
