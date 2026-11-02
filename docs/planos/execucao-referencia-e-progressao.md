# Execução do aluno: carga como dica, ✓ com painel, meta, contador e retestes

Situação: Planejando · Onde: branch `execucao-do-aluno` (worktree `wt-execucao`), **depois do merge da Frente B** (usa a carga fixa) · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C31, C39, C36, C37, C32/C40, C30, C33, C26 · Frente C da leva 2

## Objetivo
Na hora de registrar, o aluno vê o que fez da última vez, a meta de repetições junto do campo de carga, e a carga
sugerida deixa de vir escrita no campo (o app não inventa carga nem repetição). O contador do dia conta só as séries de
trabalho.

## O que o código faz hoje (main 19b1fd6)
- "Anterior kg × reps" e "Último registro" existem (`aluno/PartesDaSerie.tsx`, `aluno/ExercicioAluno.tsx`, pacote
  `anteriores` de `SeriesAnterioresService`), mas atrás de `TREINOS_RETORNO_HABILITADO` (desligada em produção). Não está
  confirmado que a chave explique a carga que não apareceu no período novo; o "Sem registro anterior" visto na reunião é
  do cartão Carga de trabalho (`p.ultima`), que não depende da chave.
- A meta tem bloco próprio (`MetaDaSerie`), longe do campo de carga.
- O contador "x de y séries" conta todas as séries (`aluno/useSessaoDoDia.ts:45`, `dominio/conclusaoDoTreino.ts:54`).
- Concluir uma série sem carga nem repetições é permitido (`ExercicioAluno.tsx:396`), e o histórico mostra "× —".
- Regra de 31/10: carga digitada sem ✓ não conta (afeta o Back off que recalcula a partir da WS).

## Decisões (Gustavo, 02/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | C31 | a carga sugerida (MESMA_CARGA, percentual, base do dia, carga fixa) é **dica**, não valor escrito no campo: "Sugestão: 60 kg · Última vez: 60 kg × 7". Aluno sem WS anterior vê "Primeira vez: escolha a carga" | Gustavo |
| D2 | C39 | ✓ com a carga vazia e com sugestão abre um painel **na tela** (nunca `alert`): "Fez com 60 kg?" → [Sim, 60 kg] [Outra carga] [Sem carga]. Funciona offline | Gustavo |
| D3 | Repetições | nunca preenchidas pelo app, a não ser pelo "Repetir", que copia o que o próprio aluno registrou | Gustavo |
| D4 | Histórico | "Feito, sem carga" ou "sem repetições" em vez de "—" | Gustavo |
| D5 | C36 | meta de repetições maior e ao lado do campo de carga | Gustavo |
| D6 | C37 | "x de y séries" conta só as séries de papel TRABALHO e POS_TRABALHO (sem aquecimento e preparação); conferir juntos a faixa do treino ao vivo, o "Bom trabalho" e o PDF | Gustavo |
| D7 | C32/C40 | descobrir se "Última vez", "Anterior" e "Bom trabalho" dependem só de `TREINOS_RETORNO_HABILITADO` (portão em `docs/planos/engajamento.md`). **Não mexer na VPS.** Trazer o que ligar a chave liga junto e uma alternativa (separar os "anteriores" do resto do retorno). O Gustavo decide | Gustavo |
| D8 | C30 | reproduzir no e2e. Se o Back off só recalcula depois do ✓ da WS por causa da regra de 31/10, **manter a regra** e deixar o aviso visível na própria série; se for defeito, corrigir | Gustavo |
| D9 | C33 | reproduzir no e2e a digitação da carga na web e o "0 kg" no aquecimento | Gustavo |
| D10 | C26 | reproduzir no e2e as cargas do período anterior no período novo | Gustavo |

## Passos
- [ ] 1. Domínio: contagem só de trabalho (D6), dica de carga e painel do ✓ como regras puras em `dominio/`, com teste — executor — commit: —
- [ ] 2. Descobrir o portão de C32/C40 e escrever o relatório para o Gustavo (D7), sem mexer na VPS — explorador + executor — commit: —
- [ ] 3. Tela: dica "Sugestão · Última vez", meta maior ao lado do campo, painel do ✓ (offline), histórico "Feito, sem carga"; e2e — executor-front — commit: —
- [ ] 4. Reproduzir C30, C33 e C26 no e2e (e corrigir só se for defeito) — executor — commit: —
- [ ] 5. Ajuda, guias regerados, `AGENTS.md` só no item da execução — commit: —
- [ ] 6. Revisão do Opus (offline, idempotência) antes do PR — advisor/revisor — commit: —

## Critérios de aceite
- O campo de carga nunca vem preenchido pela sugestão; a dica aparece ao lado.
- ✓ sem carga e com sugestão abre o painel; "Sem carga" grava "Feito, sem carga"; tudo funciona sem internet.
- Um treino com 2 aquecimentos e 4 de trabalho conta "x de 4".

## Fora do escopo
- Sugerir quanto subir de carga; aviso de teto da meta; RPE/1RM (decidido não mudar); mexer na VPS.

## O que ficou para trás
- —
