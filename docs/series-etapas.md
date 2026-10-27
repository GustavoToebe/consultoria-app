# Séries por etapas: Cluster e Rest-pause (27/10/2026)

Implementação da "Análise 2 — Cluster, Rest-pause e execução do treino" (reunião de 26/10). Este documento é o mapa de
impacto e o registro das decisões. O contrato geral de séries, tipos e técnicas continua em `docs/series-tipos-tecnicas.md`.

## Princípios que não mudam

- Cluster e Rest-pause continuam **técnicas de uma série**. Bloco ou retomada é uma **etapa** da série: nunca vira série
  completa, nunca conta na frequência e nunca ganha `uid` próprio. A posição (1, 2, 3...) na versão publicada identifica a
  etapa; a versão é imutável, então a posição é estável.
- Nenhum padrão global muda (FS, WS, pausas, esforço, percentuais da metodologia).
- A regra da carga de trabalho não muda: `CARGA_TRABALHO` sugere a base do dia; só os modos que já dizem "da WS" usam a WS
  anterior.
- Previsto (prescrição publicada) e realizado (o que o aluno informou) nunca se substituem.

## Decisões do Gustavo (27/10)

1. Não há cliente real nem dado a preservar: o contrato pode mudar sem compatibilidade com o que está em produção.
2. Ciclo menstrual: o módulo fica no código, **desligado** por `TREINOS_CICLO_HABILITADO` (padrão `false`).
3. Percentual por bloco segue a regra escrita na análise (seção 6): todos os percentuais sobre a **mesma referência
   externa** da série, referência **congelada** ao registrar a primeira etapa, carga realizada editável.
4. Entram também: o progresso conta a série de trabalho com técnica ou em percentual (papel `TRABALHO` na metodologia da
   versão) e o histórico mostra o volume de carga registrado (carga × repetições, etapa por etapa).

## Divergências em relação à análise

- **Representação canônica (seção 8):** `Tecnica.blocos` (repetições de cada bloco) continua sendo a única fonte das
  repetições do cluster. A carga de cada bloco fica numa lista paralela opcional, `cargasDosBlocos`, com o mesmo tamanho de
  `blocos` (conferido na publicação). As retomadas do Rest-pause ficam em `retomadas`, com o tamanho de `pausas`. Não há um
  segundo campo para as mesmas repetições; o par lista + tamanho conferido evita migrar o JSON das versões já gravadas.
- **Payload sem etapas:** como não há cliente antigo, a série com etapas **exige** a lista `etapas` no envio (lista vazia
  = nada registrado). Assim um envio sem detalhe nunca apaga um detalhe já gravado.
- **Ciclo:** a análise pedia para não mexer; o Gustavo pediu para desligar (o código e os dados ficam).

## Contrato

### Prescrição (Lote C)

`Tecnica` (Java `ConteudoTreino.Tecnica`, app `api/tipos.ts`) ganha dois campos opcionais:

| Campo | Técnica | Regra |
|---|---|---|
| `cargasDosBlocos: CargaDaEtapa[]` | só `CLUSTER` | mesmo tamanho de `blocos`; nulo = todos os blocos seguem a carga da série |
| `retomadas: Retomada[]` | só `REST_PAUSE` | mesmo tamanho de `pausas` (vazio = 1); nulo = "continue com a mesma carga até a falha" (a etapa mostra "Meta até a falha") |

- `CargaDaEtapa = { modo: 'DA_SERIE' | 'PERCENTUAL_WS', percentual }`. `DA_SERIE` herda a carga da série (o percentual
  fica nulo); `PERCENTUAL_WS` exige percentual de 1 a 200, sobre a **referência externa da série** (`referenciaDaSerie` no
  app): na série de carga de trabalho, a base do dia; em "% da WS" e "mesma carga", a última série de carga de trabalho
  registrada antes no exercício hoje (sem ela, a base do dia); nos modos sem referência própria ("acima da anterior",
  "abaixo da referência", sem carga), a mesma referência da WS, só quando há etapa em %. É a referência congelada na
  primeira etapa. Nunca percentual sobre percentual. Campo vazio no modo percentual é erro, nunca herança.
- Nenhuma das duas listas entra no padrão da metodologia (dependem dos blocos e das pausas de cada série): o padrão com
  elas é recusado (`problemasDosValores`). Em outra técnica são ignoradas, como os demais campos de outra técnica.
- Editor: "Personalizar carga por bloco" (Cluster) e "Definir a meta das retomadas" (Rest-pause). A lista acompanha a
  quantidade de blocos ou de pausas (o item novo herda a carga da série; a retomada nova é AMRAP com a carga da série).
- Aluno: cada etapa mostra a meta e a carga própria ("Bloco 3 · Meta 2 reps · 80% da WS") e a carga sugerida dela; a
  referência aparece antes da primeira etapa quando há etapa em %. Prévia do editor e PDF trazem uma linha por etapa e a
  linha "Percentuais da …, fixada ao registrar a primeira etapa".
- `Retomada = { repsMin, repsMax, amrap, carga: CargaDaEtapa }`: quantidade exata (mínimo = máximo), faixa ou AMRAP,
  sempre escolhida; a carga é obrigatória (herdar ou percentual). A etapa inicial do Rest-pause é a própria série (as
  repetições e a carga da série).
- Exercício sem carga (`unidade = 'nenhuma'`) não aceita `cargasDosBlocos` nem retomada em percentual.

### Execução (Lote B)

O registro da série (`RegistroEnvio` / `ExecucaoDtos.RegistroExecucao`) ganha:

| Campo | Regra |
|---|---|
| `etapas: EtapaRegistrada[]` | obrigatória nas séries com etapas (Cluster com blocos, Rest-pause), proibida nas outras |
| `referenciaCarga`, `referenciaOrigem` | a referência congelada ao registrar a primeira etapa (`WS_ANTERIOR` ou `BASE_DO_DIA`); só leitura depois |

- `EtapaRegistrada = { posicao, repeticoes, carga, situacao: 'FEITA' | 'NAO_REALIZADA' }`. Posição de 1 a N, sem repetir (N =
  número de blocos, ou pausas + 1). Etapa ausente = ainda não feita. Repetições de 0 a 500 (vazio = não informado), carga de
  0 a 2000 com 2 casas. O servidor não recusa por passar da meta.
- O servidor **recalcula** o total da série: repetições = soma das etapas feitas, só quando nenhuma está pendente e toda
  etapa feita tem repetições (senão, nulo = parcial). Carga = a carga comum das etapas feitas; com cargas diferentes, nula
  ("carga variável"). O total e a carga que o cliente manda são ignorados nessas séries.
- `concluida = true` exige todas as posições presentes (feita ou não realizada). Parcial salva com `concluida = false`.
- O registro antigo, só com o total, continua sendo "registro por série, sem detalhe de blocos": nada é redistribuído.
- Banco: `execucao_serie.etapas` (jsonb), `referencia_carga`, `referencia_origem` e `conta_no_progresso` (V033). O upsert
  troca as etapas junto com o resto da linha, na mesma precedência por `alterado_no_aparelho_em`.

### Progresso e volume

- `execucao_serie.conta_no_progresso`: a série tem papel `TRABALHO` na metodologia da versão executada (ou carga de
  trabalho). O progresso ("maior carga do dia") usa este campo. A **última carga** (base sugerida para o próximo treino)
  continua só com `serie_trabalho` (carga de trabalho): uma série em 80% não vira base.
- Volume de carga registrado = soma de carga × repetições de cada etapa (ou da série sem etapas). Faltou carga em alguma
  parte: o volume completo fica indisponível. Exercício sem carga não tem volume. Aparece no histórico e no relatório de cargas (tela e PDF), sem gamificação.
- Cargas por divisão (tela e PDF de cargas): a linha do dia continua sendo a série de trabalho de maior carga única. A série
  registrada por etapa mostra os blocos com o total do servidor ("4+4+4+2 = 14"), "parcial" quando faltou etapa e, com
  cargas diferentes, "Carga variável" no lugar do "—" (nunca a maior nem a última). Etapa feita sem carga fica "—", com os
  blocos. Toda linha traz o volume de carga do exercício no dia, o mesmo `volumeDoExercicio` do histórico. Série sem etapas
  e registro antigo seguem como antes. "Séries" conta a série com ao menos uma etapa feita (a parcial entra).
- Limitação conhecida, mantida de propósito: a coluna de carga das "Cargas por divisão" conta só a série de carga de
  trabalho (`serie_trabalho`). A WS com técnica em "% da WS" entra no progresso (`conta_no_progresso`), mas não nessa
  coluna.

## Mapa de impacto

| Área | Arquivos | Lote |
|---|---|---|
| Ciclo desligado | `ciclo/CicloProperties`, `CicloConfiguracao`, `auth/AuthService`, `dto/EuResponse`; app `sessao/SessaoProvider`, `aluno/useCicloDaAluna`, `treinador/ciclo/CicloNaFicha`, `aluno/CartaoCiclo`, `app/aluno/ciclo.tsx`, `marca/FormMarca`, `ajuda/conteudo.ts` | — |
| Texto e prévia | `dominio/agrupamento.ts`, `treinador/treino/EditorSeries.tsx`, `opcoesDoEditor.ts`, `dominio/validacaoDeSerie.ts`, `validacaoDoTreino.ts`, Java `ConteudoTreino`, `ValidadorTreino` | A |
| PDF | `pdf/pdfTreino.ts` | A, C |
| Execução (API) | `execucao/dto/ExecucaoDtos`, `SincronizacaoService`, `ExecucaoUpsert`, `ExecucaoSerie`, `IndiceVersao`, `HistoricoService`, migration V033 | B |
| Execução (app) | `api/tipos.ts`, `offline/repositorioLocal.ts`, `repositorioSqlite.ts`, `banco.ts`, `execucoesDoServidor.ts`, `aluno/useSessaoDoDia.ts`, `aluno/ExercicioAluno.tsx`, `dominio/etapas.ts` (novo) | B |
| Histórico | `dominio/relatorio.ts`, `pdf/pdfCargas.ts`, telas de registros | B |
| Prescrição por etapa | Java `ConteudoTreino.Tecnica`, `ValidadorTreino`; app `CamposDaPrescricao.tsx`, `dominio/validacaoDeSerie.ts`, `dominio/cargas.ts`, `agrupamento.ts` | C |
