# Execução do aluno: carga como dica, ✓ com painel, meta, contador e retestes

Situação: Em revisão (PR aberto, passos 1 a 6 feitos) · Onde: branch `execucao-referencia-e-progressao` (worktree `wt-execucao`) · Atualizado: 03/11/2026 · Registro: reunião de 30/10, C31, C39, C36, C37, C32/C40, C30, C33, C26 · Frente C da leva 2

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
| D11 | Progressão (Gustavo, 03/11/2026) | **agora, nesta frente:** aviso "passou de N repetições" na execução do aluno, só texto e nunca um valor em kg; regra pura em `dominio/` com jest e um caso no e2e da execução. **Depois:** os critérios da sugestão de progressão esperam os dados dos 5 alunos; até lá a carga fica só como dica (D1, C31) | Gustavo |
| D12 | Alcance do aviso D11 (Gustavo, 03/11/2026) | só nas séries de papel trabalho e pós-trabalho (as do contador, D6). Fora: AMRAP e cardio (sem teto), aquecimento (passar do teto não importa), técnica ou etapas (repetições por bloco/etapa) | Gustavo |

## Passos
- [x] 1. Domínio: contagem só de trabalho (D6), dica de carga e painel do ✓ como regras puras em `dominio/`, com teste — executor — commit: 75e9f519
- [x] 2. Descobrir o portão de C32/C40 e escrever o relatório para o Gustavo (D7), sem mexer na VPS — explorador + executor — commit: c97da7d2
- [x] 3. Tela: dica "Sugestão · Última vez", meta maior ao lado do campo, painel do ✓ (offline), histórico "Feito, sem carga"; e2e — executor-front — commit: 75e9f519, 2a9ea98a
- [x] 3b. Aviso "passou de N repetições" (D11): regra pura em `dominio/` com jest, texto na execução e um caso no e2e da execução — executor (regra) + executor-front (tela) — commit: 02733e9a
- [x] 4. Reproduzir C30, C33 e C26 no e2e (e corrigir só se for defeito) — executor — commit: d9f1de3a (`e2e/execucao-retestes.spec.ts`: nenhum defeito reproduzido; C30 é a regra de 31/10, mantida, com o aviso na própria WS; na tabela "Por divisão" só "Feito, sem carga" foge do "—")
- [x] 5. Ajuda, guias regerados, `AGENTS.md` só no item da execução — commit: d0934a3f, 63bb379c
- [x] 6. Revisão do Opus (offline, idempotência) antes do PR — advisor/revisor — commit: 58178e5c

## Relatório do passo 2 (C32/C40, D7): o que a chave `TREINOS_RETORNO_HABILITADO` liga (para o Gustavo decidir)
- **A chave não liga só "Última vez", "Anterior" e "Bom trabalho"**: liga todo o retorno. Junto vêm: rotas `@ExigeRetorno`
  (recordes da semana, sessões concluídas, "Visto"), `recordes` e `anteriores` no pacote do aluno, botão Concluir treino,
  faixa do treino ao vivo, "Bom trabalho", medalha de recorde, fila offline das conclusões, semana completa e os cartões
  do treinador (recordes da semana, treinos concluídos, `sessoesConcluidas7Dias` do painel), mais as seções `soComRetorno` da Ajuda.
- **Com a chave desligada o aluno vê:** o cartão "Carga de trabalho" com "Última vez: X kg × Y em data" (vem de `ultimasCargas`,
  que **não** depende da chave; foi o "Sem registro anterior" visto na reunião quando não há registro no período). Não vê a
  linha "Anterior" por série nem a "Última vez" da sessão (vêm de `anteriores`, com a chave).
- **Alternativa (separar os "anteriores" do resto do retorno), ~80 a 150 linhas, sem migration:** propriedade nova
  `treinos.anteriores.habilitado` (padrão `false`), `AlunoAppService` passa a chamar `anteriores.doPacote` por ela,
  `GET /eu` ganha `anterioresHabilitado`, `SessaoProvider`/`useSessaoDoDia` trocam o portão e `formatoDoPacote` aceita `anteriores`
  ausente. Pede variável de ambiente nova no deploy (a VPS não foi tocada). Risco: "Anterior" e "Última vez" do cartão usam
  fontes diferentes e podem divergir.
- **Pendente de confirmar na implementação:** se `formatoDoPacote.ts` (l.187 e 204) rejeita pacote sem `recordes`/`anteriores` quando a chave está desligada.
- **Decisão do Gustavo (02/11/2026): não ligar a chave e não separar os "anteriores".** A dica da C31 usa o "Última vez" que já
  existe (`ultimasCargas`, o mesmo do cartão "Carga de trabalho", independente da chave) e fica ao lado do campo de carga:
  "Sugestão: 60 kg · Última vez: 60 kg × 7". Com a chave ligada no futuro, continua igual (uma fonte só para essa linha).
  A linha "Anterior" por série e o "Bom trabalho" seguem atrás de `TREINOS_RETORNO_HABILITADO`, no portão do `engajamento.md`
  (linha de base com os 5 alunos, depois 2 semanas ligada; testar a imagem do "Bom trabalho" no APK antes).

## Critérios de aceite
- O campo de carga nunca vem preenchido pela sugestão; a dica aparece ao lado.
- ✓ sem carga e com sugestão abre o painel; "Sem carga" grava "Feito, sem carga"; tudo funciona sem internet.
- Um treino com 2 aquecimentos e 4 de trabalho conta "x de 4".

## Fora do escopo
- Sugerir quanto subir de carga e os critérios da sugestão de progressão (esperam os dados dos 5 alunos, D11); RPE/1RM
  (decidido não mudar; Powerlifting não se faz, ver o README); mexer na VPS.

## O que ficou para trás
- Conferência da C31 contra a prévia da Frente G (4bad4704, 03/11): a dica já batia no texto; ajustado o visual (a "Sugestão" em destaque e "Última vez" em peso normal, `partesDaDica`). A prévia mostra "Primeira vez" sempre que falta a última vez, mas nunca a mostra com sugestão e sem última vez; o app segue dizendo só "Sugestão: X kg" nesse caso (não esconde a sugestão).
- Alcance do aviso D11: decidido na D12.
- **Pendência (Gustavo, 03/11: fora desta frente, porque abrir o painel a cada etapa atrapalha no meio de um Cluster com pausas de 15 s):** o cartão da série com etapas (Cluster, Rest-pause; `CartaoSerieComEtapas`/`LinhaDaEtapa`) ainda **preenche o campo de peso com a sugestão**. Pede regra própria; a regra proposta, para decidir depois: o peso da etapa nasce vazio com "Sugestão: X kg", como nas outras séries; o painel "Fez com X kg?" aparece **uma vez por série**, no primeiro ✓ de etapa com o peso vazio; o peso confirmado preenche as etapas vazias daquela série; nunca grava peso sem confirmação.
