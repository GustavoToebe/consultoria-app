# Trocar exercício (Lote B)

Situação: Planejando (plano-trio feito, esperando as decisões do Gustavo; nenhum código) · Onde: main · Atualizado: 16/11/2026

Fonte: plano-trio (Arquiteto, Guardião e Enxuto) e leitura do código em 16/11/2026, base 1f33299d. Validade: vale enquanto `ConteudoTreino.ExercicioPlano`, `SincronizacaoService`, `ExecucaoUpsert` e `app/src/offline/formatoDoPacote.ts` não mudarem. Uma migration só entra se a decisão 1 for a opção B.

## Objetivo
O aluno troca um exercício só naquele dia, entre alternativas que o treinador definiu, e continua registrando carga e repetições (inclusive offline). O treinador define as alternativas no editor, troca um exercício em todas as sessões do rascunho e vê "Trocado por X neste dia". Recordes e "Anterior" nunca podem ficar falsos.

## Pedido do Gustavo (decidido)
- Treinador: "Trocar em todas as sessões deste plano" altera o rascunho (o publicado é imutável).
- Aluno: "Trocar só hoje", só entre as alternativas do treinador; campo novo no `ConteudoTreino`, editado no inspetor; sem alternativa o botão não aparece.
- O servidor confere se a alternativa existe na versão publicada; se não existe, RECUSA (não grava).
- O treinador vê "Trocado por X neste dia". Idempotente e offline. Entra na exportação LGPD e na anonimização. Migration com o próximo número livre (V080 em diante) **se houver tabela**. `revisao-trio` no fim.

## O que existe hoje (conferido)
- `ConteudoTreino.ExercicioPlano` (`treino/ConteudoTreino.java`, construtor de 12 argumentos, `comSeries`/`comGrupoUid`/`comUidsNovos`) não tem alternativas. O construtor de 12 argumentos tem muitos chamadores (importação, `SemanasPadrao`, `SeedDemo`, e vários testes).
- A série do aluno grava `execucao_serie.exercicio_id` tirado do índice da versão (`SincronizacaoService.java:71-76`, `IndiceVersao`), e o `ExecucaoUpsert` (`execucao/ExecucaoUpsert.java:48-57`) **não** atualiza `exercicio_id` no `do update`. Recordes, "Anterior" e progresso agrupam por `exercicioId` (`RecordesService:57-64`, `SeriesAnterioresService:56-57`, `GET /aluno/progresso?exercicioId=`).
- O pacote traz `recordes` e `anteriores` só para `exerciciosDaBiblioteca(treino.conteudo())` (`execucao/AlunoAppService.java:97,100`) e as imagens só do que está no plano (`biblioteca/DemonstracaoDoAlunoService`).
- `app/src/offline/formatoDoPacote.ts:132-141` confere as chaves de `ExercicioPlano` por uma lista (`campos`): campo novo precisa entrar na lista; pelo comentário, pacote ilegível é descartado e baixado de novo (inferência: chave desconhecida recusa o pacote).
- A carga de trabalho do aluno é guardada por `exercicioUid|data` (`repositorioLocal.ts:440`).
- `RECUSADO` da fila vira `FALHOU` e só volta por "tentar de novo".
- **O `ValidadorTreino` e o `PlanoTreinoService` não conferem o `exercicioId` contra a biblioteca da consultoria** (nem o do exercício principal; busca sem resultado). Achado à parte, vai para Pendências soltas.
- Maior migration SQL: V079; os dois testes de migration pedem 78 hoje. A V078 só existe no worktree da N2.

## Síntese do trio

### Contrato (consenso)
- Campo `alternativas: List<Alternativa>` em `ExercicioPlano`, **até 3**, `@JsonInclude(NON_EMPTY)` (o APK instalado confere as chaves, como no `valorKg`). `Alternativa` = `{exercicioId, nome, videoUrl}`, cópia da biblioteca no salvar (o aluno lê offline), sem texto livre (então `TextoLivreDosPlanos` e a anonimização dos planos não mudam).
- A alternativa **herda o resto do exercício**: uid, séries, unidade, modalidade e grupo. `comSeries`, `comGrupoUid` e `comUidsNovos` passam a lista adiante (senão replicar, copiar e aplicar perdem as alternativas sem avisar).
- Validação no salvar/publicar (`ValidadorTreino`, 422 `PLANO_INVALIDO` no campo): até 3, sem repetir, diferente do principal, nome obrigatório, exercício **existe na biblioteca da consultoria** (JPA com tenant, não arquivado) e é do **mesmo tipo** do principal (cardio só por cardio; mesma unidade). Rascunho aceita incompleto, como hoje.
- No servidor (`SincronizacaoService.motivoParaRecusar`): a alternativa tem de estar em `alternativasDe(exercicioUid)` da **versão** do registro; senão `RECUSADO` com motivo fixo, sem gravar. `IndiceVersao` ganha as alternativas.
- Recorde, "Anterior" e progresso do dia trocado contam **no exercício da alternativa** (recomendado por todos): sem isso, 200 kg no leg press virariam recorde falso do agachamento, também visível aos colegas. O pacote passa a trazer `recordes`/`anteriores`/imagens também para os ids das alternativas.
- Nada vai a log nem auditoria; "Trocar em todas" usa o salvar do rascunho (versão otimista, `TREINO_ALTERAR`, aluno anonimizado recusado) com resumo fixo, sem o nome do exercício.
- Revisão final: `revisao-trio` (tenant, SQL nativo, offline, LGPD).

### Divergência real: onde guardar a troca do dia
| | **A. Na própria série (Enxuto, recomendada)** | **B. Tabela `troca_exercicio` (Arquiteto)** |
| --- | --- | --- |
| Como | o registro da série leva `exercicioId` opcional (nulo = o principal); o servidor confere em {principal ∪ alternativas da versão} e grava esse id; `ExecucaoUpsert` passa a atualizar `exercicio_id` | tabela nova (V080, chave aluno+versão+exercicioUid+data, desfazer = alternativa nula, último `alteradoNoAparelhoEm` vence), rota POST/GET, UPDATE retroativo de `execucao_serie.exercicio_id` na troca |
| Migration | nenhuma | V080, entidade, upsert nativo (exceção no `ArquiteturaTest`), totais 78→79 nos dois testes |
| Exportação e anonimização | já cobertas (a série já é exportada e mantida) | seção `trocasDeExercicio` nova e decisão de manter na anonimização |
| Troca sem série marcada | só no aparelho (nada foi executado; o treinador não vê) | aparece para o treinador e em outro aparelho |
| Troca e desfazer | trocar só antes de marcar série; desfazer = voltar ao principal antes da primeira série | troca e desfazer a qualquer momento |
| Custo | menor (2 a 3 commits) | maior (5 passos, duas camadas offline novas: fila e esquema SQLite 5) |
Risco de A: série de principal e série da alternativa no mesmo dia só se o cliente forjar (cada linha é conferida, então os recordes continuam verdadeiros). Risco de B: duas fontes de verdade (a troca e a série) que precisam concordar em qualquer ordem de chegada.

### Riscos do Guardião
- **Bloqueantes (tratados acima):** recorde falso (R1); troca que muda o tipo (R2); carga sugerida e "Anterior" errados (R3, ver abaixo); alternativa forjada pelo treinador (R4) e pelo aluno (R5).
- **R3, carga de trabalho e `% da WS`:** a carga de trabalho do próximo treino é por `exercicioUid|data`. No dia trocado, a série de trabalho da alternativa não pode virar a sugestão do original: pular a gravação de `trabalho` e da base do dia quando houver troca, e a referência `WS_ANTERIOR` da alternativa sai do histórico dela ("—" sem histórico). Teste obrigatório no app.
- **Aceitáveis:** replay offline depois de republicar (a chave tem a versão imutável; aceito, como as sessões concluídas); data fora de ±60 dias (a série já recusa); DoS (3 alternativas, lote de 300, corpo de 1 MiB); app antigo apagando `alternativas` ao salvar (a regra "sem compatibilidade" aceita); auditoria da troca do aluno (não é auditada, como as séries).
- **Ordem de publicação:** se o app instalado recusa chave desconhecida, um plano com alternativas só deve ser publicado depois de os alunos terem o APK novo.

## Decisões para o Gustavo
Recomendada primeiro.

| # | Pergunta | Opções |
| --- | --- | --- |
| 1 | Onde guardar a troca do dia? | **(a) Na própria série, sem tabela nem migration (recomendada)**; (b) tabela `troca_exercicio` (V080), que mostra a troca ao treinador mesmo sem série marcada |
| 2 | Quantas alternativas por exercício? | **(a) Até 3 (recomendada)**; (b) até 5 |
| 3 | A alternativa pode ser de outro tipo (cardio no lugar de carga)? | **(a) Não, 422 na publicação (recomendada: recordes continuam verdadeiros)**; (b) sim, com regra própria de recorde |
| 4 | Dá para trocar depois de marcar uma série do exercício? | **(a) Não: o app bloqueia, o aluno desmarca antes (recomendada)**; (b) sim (exige a opção B, tabela, e o UPDATE das séries já gravadas) |
| 5 | No "Trocar em todas as sessões", o que acontece com o principal antigo? | **(a) Ele ocupa o lugar da alternativa escolhida, então a lista continua com 3 (recomendada)**; (b) vira uma alternativa a mais (a lista cheia dá 422 e o treinador tem de apagar uma) |
| 6 | A alternativa herda a carga fixa e o percentual da WS do original? | **(a) Herda tudo, e a referência da WS sai do histórico da alternativa, "—" sem histórico (recomendada)**; (b) a alternativa começa sem prescrição de carga |
| 7 | A alternativa mostra imagem ou GIF? | **(a) Sim: `/aluno/exercicios/demonstracoes` passa a liberar os exercícios das alternativas do plano publicado (recomendada)**; (b) sem imagem na alternativa |
| 8 | O treinador vê a troca mesmo sem série marcada? | **(a) Não, só "Trocado por X neste dia" quando há série feita (recomendada, nada foi executado)**; (b) sim (exige a opção B) |
| 9 | Ordem de publicação com APK antigo | **(a) Liberar o campo no editor só depois do APK novo nos alunos (recomendada)**; (b) liberar já e aceitar o aluno com app antigo sem ver as alternativas |

## Passos (depois das respostas; considera a recomendação A)
- [ ] 0. Este plano e a entrada no README — commit: —
- [x] 1. API (`executor`, sem migration): `ConteudoTreino.Alternativa` + campo + `comSeries`/`comGrupoUid`/`comUidsNovos`; validação (`ValidadorTreino`) com biblioteca, tipo, limite; `IndiceVersao`/`alternativasDe`; `SincronizacaoService` aceita `exercicioId` opcional na série e recusa o que não está na versão; `ExecucaoUpsert` atualiza `exercicio_id`; ids das alternativas em `recordes`, `anteriores` e `demonstracoes`; DTO das execuções do treinador traz o `exercicio_id`; testes de integração (alternativa aceita, fora da lista recusada, reenvio sem duplicar, outro aluno, versão antiga depois de republicar, recorde do principal ignora a alternativa) e `ValidadorTreinoTest`. Tem de rodar `mvn verify` completo — feito (16/11): `Alternativa`, validação com biblioteca/tipo/limite, `exercicioId` na série (`RECUSADO` fora das alternativas da versão), `execucao_serie.exercicio_id` atualizado no reenvio, `GET /alunos/{id}/trocas-de-exercicio` (`REGISTRO_LER`, ainda sem campo `visto`); sem migration (V080 não usada) — commit: ver `git log` ("Trocar exercício: alternativas na API e regra no app")
- [x] 2. App, regra e offline (`executor`): `api/tipos.ts` e `'alternativas'` em `formatoDoPacote.ts`; `dominio/exercicioDoDia.ts` (mesmo uid e séries, com `exercicioId`, nome e vídeo trocados); `dominio/trocarEmTodasAsSessoes.ts` (principal antigo ocupa o lugar da alternativa); carga de trabalho e `WS_ANTERIOR` pulados no dia trocado; o registro da série leva `exercicioId`; testes de domínio e de fila. Se o `RegistroLocal` do SQLite guarda colunas, sobe o esquema (a confirmar na execução) — feito (16/11): `formatoDoPacote` (até 3, estrito), `exercicioDoDia`, `trocarEmTodasAsSessoes`, `useSessaoDoDia`, `exercicioId` no envio. Decisões: troca sem série marcada não persiste no aparelho; no dia trocado `chaveDaBaseDoDia` devolve nulo (sem carga de trabalho/base) e o `trabalho:true` do registro é mantido; `equipamento` da alternativa vira nulo — commit: ver `git log` ("Trocar exercício: alternativas na API e regra no app")
- [ ] 3. App, telas (`executor-front`, depende de 1 e 2; o 3a pode andar com o 2): (a) alternativas no inspetor do editor (busca na biblioteca, até 3) e botão "Trocar em todas as sessões deste plano"; (b) "Trocar só hoje" no exercício do aluno (`IconeBotao` + `Folha`, só com alternativa e sem série marcada), nome, vídeo e recordes pelo exercício do dia; "Trocado por X neste dia" na ficha e no histórico do treinador; e2e em 390 e 1280 — commit: —
  - 16/11 (3a feito, sem e2e rodado): seção "Alternativas de troca" no `CartaoExercicio` (até 3, busca na biblioteca pela `FolhaBiblioteca` com a variante `alternativaDe`, mesmo tipo), painel "Trocar em todas as sessões" (`dominio/trocarEmTodasAsSessoes`), `Trocar` o exercício limpa as alternativas; regra pura `dominio/alternativasDoExercicio`; e2e `editor-alternativas` escrito e NÃO rodado. **Decisão 9 (pendência de lançamento):** o campo só deve ser liberado ao treinador depois do APK novo do aluno (sem `expo-updates`). Commit: ver `git log` ("Trocar exercício: alternativas no editor")
  - 16/11 (3b feito, sem e2e rodado): "Trocar só hoje" (`aluno/TrocarSoHoje`), "Equipamentos para hoje" e folha "Histórico" (`aluno/HistoricoDoExercicio`, `dominio/historicoDoExercicio`); troca presa depois da primeira série marcada; escolha só em estado da tela; e2e `trocar-exercicio-aluno` e `treino-do-aluno-lacunas` rodaram em 16/11 e passam em 390 e 1280 (o teste de trocar trocou o `goto` por "Voltar" por causa de `ERR_ABORTED` intermitente a 390 px). Riscos: linha de ícones a 320 px, foco do teclado depois de trocar. Commit: ver `git log` ("Trocar só hoje, equipamentos e histórico")
- [ ] 4. `revisao-trio` e correções; Ajuda, `AGENTS.md` e `docs/design-e-front.md` se mexer — commit: —
- APK novo: sim para o aluno (fila e botão); editor do treinador na web, não.
- Não anda em paralelo com outra frente que tenha migration (só vale se a opção B vencer).

## Fora do escopo
- Troca de exercício pelo treinador num dia específico do aluno; trocar o tipo (cardio); alternativas com prescrição própria; sugestão automática de alternativa; alertas ao treinador (plano [alertas-de-troca.md](alertas-de-troca.md)).

## O que ficou para trás
- **Pendência 213 (decidida pelo Gustavo em 17/11/2026; feita em 17/11, commit `559e7b4e`):** na publicação, todo `exercicioId` **não nulo** do exercício **principal** tem de existir na biblioteca da própria consultoria. Contrato: `PlanoTreinoService.validar` lê os ids distintos do plano (principais e alternativas) numa consulta só (`findByIdIn`, filtrada pelo `@TenantId`: id de outra consultoria conta como inexistente) e repassa `ativos` e `arquivados` ao `ValidadorTreino.validar(conteudo, inicio, fim, ativos, arquivados)`. Inexistente ou de outra consultoria: 422 `PLANO_INVALIDO` em `sessoes[i].exercicios[j].exercicioId`, mensagem fixa "Exercício não encontrado na biblioteca." (nunca o id). Arquivado: só aviso (`CONFIRMAR_AVISOS`, "Exercício arquivado na biblioteca."), publica ao confirmar. Nulo = exercício livre digitado, vale. O rascunho continua aceitando qualquer id (só publicar confere). Origens conferidas: `SeedDemo` (cria o exercício na biblioteca e usa o id), planilha completa (o id vem da biblioteca ativa da consultoria; "criar" liga o id do exercício recém-criado), importação assistida e "colar treino" (`exercicioId` nulo), modelos de semana padrão (`SemanasPadraoService`, id da biblioteca da consultoria, ativo ou arquivado), aplicar modelo, copiar para outro aluno e replicar pasta (copiam o conteúdo da mesma consultoria): nenhuma precisou de correção. Testes: `ExercicioPrincipalNaBibliotecaIntegrationTest` (válido, nulo, inexistente, outra consultoria, arquivado, modelo aplicado, copiado, replicado e publicar tudo da pasta, 422 em `treino.sessoes[i].exercicios[j].exercicioId`) e `ValidadorTreinoTest`. `ApiDeTeste`: ao enviar um corpo com `sessoes[].exercicios[].exercicioId`, cria na biblioteca da consultoria do login uma linha com esse mesmo id (JDBC no Postgres da suíte, nome `<nome> (<id>)`, sem grupo); `treino()` e os ~83 chamadores não mudaram; `semBibliotecaAutomatica()` desliga isso para testar o 422. Risco em produção: rascunho ou modelo antigo cujo id deixou de existir passa a recusar na publicação com a mensagem acima (o treinador troca o exercício). Excluir na biblioteca só inativa (vira aviso); apagam a linha a limpeza V059 e o Desfazer da planilha completa, e este só apaga exercício que nenhum rascunho, versão ou modelo de treino da consultoria cita (`DesfazerDaPlanilha.exercicios`, `EM_USO`), então não deixa id pendurado. Não conferido: dados reais do Saraiva em produção (só leitura de código e testes).
- Não conferido nesta leitura: o corpo de `exerciciosDaBiblioteca`/`exerciciosDosPlanos`, o formato do `RegistroLocal` no SQLite, o cálculo de `WS_ANTERIOR` no app e o que `/aluno/progresso` lê. O executor confere antes de codar.
