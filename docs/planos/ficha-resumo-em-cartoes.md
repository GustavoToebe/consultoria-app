# Ficha › Resumo em cartões

Situação: Concluída em 24/11/2026 (falta commit) · Onde: branch ficha-24-11 · Atualizado: 24/11/2026

## Objetivo
No Resumo da ficha, o bloco "Próximo passo" mostra os três fatos (Atualização, Treinos registrados, Último registro) como cartões
de indicador lado a lado, na mesma grade e com a mesma altura. "Treinos registrados" volta a ter cor (era azul até o commit
`328df011`, de 23/11, que o deixou neutro).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Causa da perda | Não foi contraste: o `328df011` trocou `NumeroDeDestaque` (`enfaseDoNumero('azul', n)`, `ResumoDoAluno.tsx` antes: linhas 137-138) por `CartaoDeIndicador` neutro (depois: linhas 138-139) porque a regra de 23/11 derrubou as cores de "indicador" (azul, ciano, violeta: medida sem juízo). A D12 de `cores-de-destaque.md` pedia "treinos registrados na semana azul/ciano" | Arqueologia, 24/11 |
| D2 | Treinos é categoria | Pintado de azul, com a cor de destaque de indicador (`useDestaques().azul.cor`) passada como `corDeCategoria`, o mesmo caminho das Entradas avulsas do Resultado do mês. O app não tem token de categoria "treino": é a cor que ele já tinha. Zero fica neutro | Executor, na dúvida (noite de 24/11) |
| D3 | Atualização | Valor = o estado que o app já mostra (selo da lista de alunos). A situação vence a categoria, como no Início e nos Números (D13: mesma informação, mesma cor): "Para revisar" `atencao`, "Atrasada há N dias" `perigo`, "Revisada" `sucesso`. Sem situação ("Em N dias", "Adiada para…") e "Sem atualização pendente" levam a categoria atualização, o ciano de destaque (`useDestaques().ciano.cor`). Fonte que falhou ou ainda carrega: neutro | Executor, na dúvida |
| D4 | "—" | Onde havia "—" (atualização consultada sem data), o texto passa a ser "Sem atualização pendente" (`SEM_ATUALIZACAO_PENDENTE`) | Pedido |
| D5 | Último registro | Neutro, valor em fonte normal ("Ontem") e o escopo embaixo ("nesta semana" ou "desde dd/mm", que o app já usava). `treinosDoResumo` devolve `{ semana, ultimo, escopo }` em vez de "Ontem · desde 01/10". Nova prop `textual` do `CartaoDeIndicador` (padrão igual) | Pedido |
| D6 | Grade | Os três são filhos diretos da `GradeDeIndicadores` (`minimo={211}`, como as grades de 4: 3 colunas, ou 1 quando não cabem; com o mínimo padrão de 250 o texto grande empilhava os três). Sem permissão de ver atualização ou registro, a grade tem os que sobram (nunca um sozinho por escolha: um só ocupa a linha) | Pedido |

## Passos
- [x] 1. Regras puras em `dominio/resumoDoAluno.ts` (`fatoDaAtualizacao`, `corDosTreinosDoResumo`, `SEM_ATUALIZACAO_PENDENTE`, `treinosDoResumo` com escopo) e testes "ficha: resumo em cartões (24/11)" — commit/run: —
- [x] 2. `CartaoDeIndicador` com `textual`; `ResumoDoAluno` com os três cartões na `GradeDeIndicadores` — commit/run: —
- [x] 3. `ui/contrasteDasPecas.test.ts`: azul e ciano de destaque como categoria no poço, nos 9 temas, com contraste alto e bordas reforçadas — commit/run: —
- [x] 4. E2e `e2e/ficha-resumo-em-cartoes.spec.ts` (390 e 1280, pendente, atrasada, data próxima, sem pendente, sem dado, texto grande) e o caso de `ficha-em-abas.spec.ts` que dizia "treinos neutros" — commit/run: —
- [x] 5. Capturas em `capturas/24-11/item-2-resumo/` (1280 e 390; Escuro, Claro e Areia; texto grande) — commit/run: —
- [ ] 6. Commit pela sessão principal — commit/run: —

## Fora do escopo
- Auditoria dos outros cartões que perderam cor no `328df011` (Início, Números, Financeiro, Interessados, Resumo da sessão, peso, atualização, importação): `docs/planos/cartoes-cores-restauradas.md`.
- Criar tokens de categoria para treino e atualização (hoje são o azul e o ciano de destaque).

## O que ficou para trás
- Decidir se treino e atualização ganham tokens de categoria próprios (hoje usam o azul e o ciano de destaque, que a regra de 23/11 chama de "medida sem juízo").
- Degradê no nativo (Android e iOS) segue sem ser visto, como no plano do cartão pintado.
