# Importação manual e assistida: correções e melhorias da revisão de 28/11

Situação: Em execução (worktree `consultoria-app-importacao`, branch `importacao-28-11`, saída da `leva-2`) · Atualizado: 28/11/2026 · lotes 0 a 3 feitos sem commit; 1.8 só o esqueleto; lote B (1.5, 1.9 a 1.12) feito em 27/11 sem commit; 4.1 e 4.2 feitos em 28/11 sem commit (chave desligada); a guarda de origem no `MESMO_NOME_NA_SESSAO` (lacuna do 1.5) está no código; **nada vai para a `main` antes do `mvn verify`, da integração com Docker e do e2e completo (lotes 1.6, 2 e 4 mudam DTO)**.

## Objetivo
Deixar a importação assistida mais certeira e mais fácil para o treinador (a IA devolve mais do que lê, a tela mostra o que foi lido e nunca deixa sem saída) e tirar da importação manual um erro que derruba a API e as recusas de planilha comum (CSV do Excel, CPF e CEP sem zero, datas).

## De onde veio
Revisão de leitura de código em 28/11/2026, sobre o commit `c9d16c8`, sem rodar `mvn verify` nem e2e. Três frentes: IA e serviço da assistida (Claude, sessão principal), importação manual na API e telas do app (dois revisores em paralelo). Os números de linha abaixo valem para esse commit.

- **Conferido** = lido no código pela sessão principal.
- **Da revisão** = apontado por um revisor e não reconferido linha a linha: reler o trecho antes de mexer.
- **Medido** = rodado num programa isolado pelo revisor (só os dois tempos do passo 0.1 e o do 3.7c).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | PDF e imagem direto ao provedor | Sim, só como reserva (quando a extração de texto falha, e para prints), com chave própria desligada por padrão, aviso na tela e aviso de privacidade ajustado antes de ligar. Só depois do conjunto de avaliação (passo 1.8). | Gustavo, 28/11 |
| D2 | Cliente da API do Claude | Manter o `HttpClient` do JDK; streaming feito à mão; trocar a ferramenta por saída estruturada (`output_config.format`). Sem o SDK oficial. Rever se a importação passar a usar envio de arquivos ou lotes. | Gustavo, 28/11 |
| D3 | "O que importar" (três cartões) | Remover agora. "Só o cadastro" volta, se fizer falta, como caixas por aluno na revisão (cadastro, treino, dieta, pesos), depois do passo 2.2. | Gustavo, 28/11 |
| D4 | MCP, lotes com desconto, agente com ferramenta de busca | Não entram: a importação é uma chamada só, com o treinador esperando na tela. | Gustavo, 28/11 |
| D5 | Carga em kg escrita no documento | **Continua em texto** (observação do exercício), não vira `CARGA_FIXA`: carga fixa não é série de trabalho nem referência de percentual, então transformaria a WS do documento numa série sem a cadeia WS → Back off. Viram campo: RIR, RPE, AMRAP e "% da WS". | Recomendação do Claude em 28/11, **a confirmar pelo Gustavo** (corrige a sugestão inicial de "acrescentar carga ao formato") |
| D6 | Mesmo aluno em dois arquivos da mesma sessão | Juntar sozinho só com o mesmo nome **lido do conteúdo nos dois grupos** (origem `CONTEUDO`; sem acento nem caixa) **e** sem conflito de conteúdo (um tem treino, o outro dieta). Nome substituto (nome do arquivo, título padrão do texto colado, "Aluno N") nunca conta como nome lido e é escrito num lugar só, no serviço. Nos demais casos, a tela oferece "Juntar com…". | Recomendação do Claude, a confirmar; implementada em 27/11, SEM commit (importacao-28-11; passo 1.5) |
| D7 | Status desconhecido na aba de alunos da planilha completa | Entra **ativo** com o problema `STATUS_NAO_RECONHECIDO` na linha (hoje entra inativo sem aviso). Inativo só com palavra conhecida. | Recomendação do Claude, a confirmar |
| D8 | Nome da chave da D1 | `TREINOS_IA_ENVIAR_ARQUIVO_AO_PROVEDOR`, **padrão `true`** desde 28/11 (regra "tudo liberado"); só vale com `TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR=true`, `TREINOS_IA_PROVEDOR=claude` e `TREINOS_IA_CLAUDE_API_KEY`; faltando algum, a API sobe e a leitura por imagem fica indisponível. | Gustavo, 28/11 (ligar sem esperar a revisão jurídica) |
| D10 | Nome substituto ("Aluno N", nome do arquivo) | A API devolve `origemDoNome` no grupo (não é dado pessoal); o cartão diz "Nome não encontrado no documento" e o "Gravar" fica travado para esse aluno até digitar o nome (`PUT` do grupo marca `DIGITADO`), vincular a um existente, salvar como modelo ou ignorar. A API recusa a confirmação com 422 `NOME_DO_ALUNO_PENDENTE` (`grupos.<id>.nome`, "Informe o nome do aluno, vincule a um existente ou ignore."). `DIGITADO` não junta sozinho nem entra na trava por nome. | Gustavo, 28/11 |
| D11 | Partes do mesmo PDF sem nome | A tela oferece "Juntar as N partes" num toque, na primeira parte; nunca junta sozinha. `POST .../juntar` aceita `comGruposIds`; partes de um arquivo só (um único arquivo com esse nome na sessão, nenhum grupo com o nome lido) somam treinos e dietas na ordem da sessão (fora disso, dois treinos seguem 409). Sem desfazer: o servidor apaga as partes juntadas. | Gustavo, 28/11 |
| D9 | Coluna `importacao_sessao.objetivo` depois da D3 | Fica com o valor padrão, sem migration só para apagá-la; sai na próxima migration que já mexer na tabela. | Recomendação do Claude, a confirmar |

## Ordem e tamanho
| Lote | O que é | Parte | Contrato da API muda? | Tamanho |
| --- | --- | --- | --- | --- |
| 0 | Urgente: erro que derruba a API, sessão presa, leitura sem "tentar de novo", envio no celular, D3 | `api/` e `app/` | Não (o app só deixa de mandar um campo) | Pequeno |
| 1 | IA: formato, streaming, documento grande, mesmo aluno, registro de uso, avaliação | `api/` | Sim, pouco (campos novos no resumo do arquivo) | Médio |
| 2 | Assistida: tela (ver o que foi lido, depois de gravar, termos, espera, textos) | `app/` e `api/` | Sim (resultado da confirmação, edição do grupo) | Médio a grande |
| 3 | Manual: recusas de planilha comum, desempenho da completa, duplicação | `api/` | Não | Médio |
| 4 | D1: PDF e imagem como reserva | `api/` e `app/` | Sim (formatos aceitos, chave nova) | Médio |

O lote 0 pode sair sozinho. Os lotes 1 e 3 são só `api/` e não têm migration: cabem num lote de integração. O lote 2 depende do 1.6 (modo por arquivo) só no texto do aviso. O lote 4 espera o 1.8.

## Passos

### Lote 0: urgente

- [x] **0.1 Número com expoente gigante derruba a API** (conferido no código; tempos medidos pelo revisor) — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `api/.../importacao/LeitorDePlanilha.java:455-457` (`new BigDecimal(t).stripTrailingZeros().toPlainString()`) e `GravadorDaImportacao.java:1009-1016` (`setScale` chamado duas vezes).
  - O que acontece: célula numérica `1E+999999999` num xlsx tenta alocar 1 GB (`OutOfMemoryError` em 34 ms) e, com `-XX:+ExitOnOutOfMemoryError` (`api/Dockerfile:40`), a JVM sai para todas as consultorias. No CSV, `1E-30000000` custa 17 s de CPU por chamada de `setScale`. Vale em toda rota que lê arquivo: `/reconhecer`, `/colunas`, `/previa`, `/diagnostico`, planilha completa e o `ExtratorXlsxCsv` da assistida.
  - O que fazer: um auxiliar único (`NumeroDeCelula.seguro(BigDecimal)` ou dentro do `ValoresDeCelula` do passo 3.4) que recusa como **célula com erro** (`Celula` com erro, motivo fixo `GravadorDaImportacao.CELULA_COM_ERRO`) o número com `precision() > 30` ou `Math.abs(scale()) > 30`, **antes** de `toPlainString` e de `setScale`. Conferir também `MontagemDeSeries.numero` e `AnaliseDaPlanilha` (conversores próprios, passo 3.4).
  - Teste: `LeitorDePlanilhaTest` com `1E+999999999` (xlsx) e `GravadorDaImportacao` com `1E-30000000` (CSV): vira célula com erro, sem exceção, em menos de 1 s.

- [x] **0.2 Sessão da assistida presa em "Processando" depois de a API reiniciar** (conferido) — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `assistida/ProcessamentoAssincronoImportacao.java` (a tarefa só existe na memória; `iniciar` devolve sem redisparar quando o estado já é `PROCESSANDO`, linhas 91-93) e `ImportacaoAssistidaService.exigirNaoEncerrada` (toda ação responde 409 `SESSAO_PROCESSANDO`). Todo push na `main` reinicia a API.
  - O que fazer: (a) gravar `processandoDesde` (instante) no `progressoJson` ao marcar `PROCESSANDO`; (b) `SessaoJson.estadoEfetivo` devolve `ERRO` quando `PROCESSANDO` e `processandoDesde` é mais antigo que `limiteDaSessaoEmSegundos(aLer)` + folga (a conta já existe); (c) na subida da API (`ApplicationReadyEvent`), uma rotina por consultoria (molde do `ImportacaoAssistidaRetencao`: `TenantContext.executarComo` com a transação dentro, `consultoria_id` explícito) marca `erroProcessamento` e volta para `RECEBENDO` toda sessão `PROCESSANDO`, porque nenhuma tarefa sobrevive ao reinício. Sem migration.
  - Teste: integração que deixa uma sessão `PROCESSANDO`, roda a rotina e confere `ERRO` com os arquivos ainda `RECEBIDO`; unitário do `estadoEfetivo` com `processandoDesde` velho.

- [x] **0.3 Leitura que falhou não tem "Tentar ler de novo"** (conferido) — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `app/src/treinador/importacao/PainelImportacaoAssistida.tsx:455` (`podeLer` só aceita `RECEBENDO` e `RASCUNHO`). O servidor aceita reler a partir de `ERRO`.
  - O que fazer: incluir `ERRO` em `podeLer`; `Alerta` de atenção "A leitura não terminou. Seus arquivos continuam aqui." e o botão "Tentar ler de novo" (`acao`). Regra do rótulo em `dominio/importacaoAssistida.ts`.
  - Teste: caso novo em `e2e/importacao-assistida.spec.ts` (sessão em `ERRO` mostra o botão e ele dispara o POST), 390 e 1280.

- [x] **0.4 No celular o envio de arquivo da assistida usa o atalho que o projeto documenta como quebrado** (conferido por leitura; **não testado em aparelho**) — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `PainelImportacaoAssistida.tsx:250-253` monta `{ uri, name, type } as Blob`; `app/src/api/anexarArquivoDoAparelho.ts:12-20` explica que isso cai em "Unsupported FormDataPart implementation" (mostrado como "sem conexão"). A importação manual já usa o auxiliar (`formularioDaImportacao.ts`).
  - O que fazer: em `servicos/importacaoAssistida.ts` `adicionarArquivo`, usar `anexarArquivoDoAparelho` fora da web, como a manual.
  - Teste: jest do serviço (como `formularioDaImportacao.test.ts`); conferir no APK na próxima build.

- [x] **0.5 Limite de 15 s no app para envio e confirmação da importação** (da revisão) — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `app/src/api/cliente.ts` (`TIMEOUT_MS`, `limiteMs`); nenhuma rota de importação (assistida, manual, planilha completa) passa `limiteMs`.
  - O que fazer: `limiteMs` de 60 s nos envios de arquivo e 120 s nas confirmações, em `servicos/importacaoAssistida.ts` e nas rotas de importação de `api/rotas.ts`.

- [x] **0.6 Remover "O que importar" (D3)** (conferido: a escolha não muda nada no servidor) — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - App: tirar `EscolhaDoQueImportar` do `PainelImportacaoAssistida` (linhas 102 e 514), apagar o componente e `OPCOES_DO_OBJETIVO`/`ObjetivoImportacao`; `criarSessao()` sem corpo. Ajustar `e2e/importacao-assistida.spec.ts` e o item "Importação assistida, tela" do `AGENTS.md`.
  - API: tirar `objetivo` do `ContextoIa` e do `PreparoProcessamento`; o `POST` da sessão ignora o campo; a coluna fica (D9).

- [x] **0.7 Teste intermitente já anotado no README** (`ImportacaoIntegrationTest.previaNaoGravaECsvEXlsxCriamAluno`: montar o `.xlsx` uma vez e reusar os bytes) — aproveitar o lote. — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados

### Lote 1: IA (só `api/`, pacote `importacao/assistida/ia/`)

- [x] **1.1 Saída estruturada e streaming no Claude (D2)** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje (`InterpretadorClaude.java`): ferramenta `propor_importacao` com `tool_choice` forçado só quando o nome do modelo contém "haiku"; nos outros fica `auto` e, se o modelo responder sem chamar a ferramenta, cai nas regras sem nova tentativa. Sem streaming, `max_tokens` 32000, tempo de 5 min.
  - O que fazer no pedido: tirar `tools` e `tool_choice`; `output_config: {"effort": <config>, "format": {"type": "json_schema", "schema": EsquemaDaProposta.paraClaude()}}`; `"stream": true`; `max_tokens` 64000. Manter o `cache_control` no `system` e o cabeçalho `anthropic-version: 2023-06-01`. Tirar do prompt "Sempre acione a ferramenta" e pôr "Responda só com o JSON do formato".
  - Pensamento: hoje a ferramenta forçada faz o Haiku 5.5 responder sem pensar antes. Para não mudar tempo nem custo sem medir, começar com `"thinking": {"type": "disabled"}` **só quando o modelo for o Haiku 5.5** (aceito com esforço `high` ou menor; Opus 5.5 e Sonnet 5.5 recusam `disabled`) e comparar com o adaptativo no passo 1.8.
  - Leitura da resposta: `HttpResponse.BodyHandlers.ofLines()`; para cada linha `data: {...}`: `content_block_delta` com `delta.type == "text_delta"` acrescenta `delta.text` (ignorar os outros tipos de delta); `message_delta` traz `delta.stop_reason` e `usage`; `message_start` traz o `usage` de entrada (tokens de cache); evento `error` vira `FalhaPassageiraDoProvedor` se `overloaded_error` ou `api_error`, senão `IllegalStateException`. No fim: `max_tokens` → `RespostaCortada`; `refusal` → erro; senão `json.readTree(texto)` e `DecodificadorDaProposta.decodificar`.
  - Tempo: o `timeout` do `HttpRequest` deixa de cobrir a resposta inteira quando o corpo é lido em fluxo (conferir na documentação do JDK 25); o teto por arquivo continua sendo o corte da sessão por interrupção. Rever `TIMEOUT_HTTP` e `RoteadorInterpretadorIa.TEMPO_MAXIMO_POR_ARQUIVO`.
  - Esquema: o de hoje já tem `additionalProperties: false` e não usa mínimo, máximo nem tamanho. Se a API recusar o esquema por causa dos muitos campos `["tipo", "null"]` (limite não confirmado nesta revisão), trocar o anulável por campo opcional ausente.
  - Teste: `InterpretadorClaudeTest` novo com servidor de mentira do JDK (molde do `SiteverifyFalso`): fluxo normal, cortado por `max_tokens`, `refusal`, evento `error`, 429 com `retry-after`, JSON inválido. **Chamada real** com chave: só o Gustavo (pendência que já existe no README).

- [x] **1.2 Nova tentativa que respeita o provedor** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - `RoteadorInterpretadorIa`: hoje espera 2 s fixos. Ler `retry-after` (segundos) do 429 e do 529 e esperar esse tempo, com teto de 30 s; manter 2 tentativas. Resposta que não decodifica continua sem repetir.

- [x] **1.3 Documento grande: dividir antes de cair nas regras** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje: resposta cortada (`RESPOSTA_CORTADA`) faz o arquivo **inteiro** ser lido pelas regras fixas. O PDF pode ter até 500.000 caracteres (`ExtratorPdf.CARACTERES_MAXIMOS`).
  - O que fazer: no roteador, ao receber `RespostaCortada`, dividir o texto pelas marcas que os extratores já põem (`=== ABA: ... ===` na planilha, `=== PÁGINA n ===` no PDF, em blocos de umas 10 páginas), chamar a IA por parte (em série, com o mesmo `system` em cache) e juntar os grupos de mesmo `nomeAluno` (regra do passo 1.5). Só se uma parte ainda cortar, regras fixas para aquela parte. Registrar o aviso fixo "Documento grande: lido em N partes." no grupo.
  - Preço: o Haiku 5.5 cobra 5 vezes mais quando o pedido passa de 100 mil tokens; dividir também evita isso. Considerar dividir já na ida quando o texto passar de ~250.000 caracteres.

- [x] **1.4 Campos novos no formato pedido à IA** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados (sem o 1.4b dos conjugados)
  - Hoje (`DecodificadorDaProposta.java:236`): a série nasce com `amrap`, `carga` e `esforco` nulos; RIR, RPE e "% da WS" do documento se perdem ou viram texto.
  - Acrescentar em `FORMATO_DA_RESPOSTA` e em `EsquemaDaProposta`, por série: `rir` (0 a 10), `rpe` (1 a 10, de meio em meio), `amrap` (verdadeiro só se escrito), `percentualMin` e `percentualMax` (1 a 200, "% da carga de trabalho"). Regras no decodificador: nunca RIR e RPE juntos (fica o RIR e o RPE vai para a observação); `amrap` zera as repetições; percentual vira `Carga` `PERCENTUAL_WS`. Carga em kg continua em `observacao` (D5), com a instrução "carga em kg: escreva na observação como 'Carga no documento: 60 kg'".
  - Depois: `TiposDaMetodologia.normalizar` não muda. Conferir que o `ValidadorTreino` aceita o que sai (teste com o validador).
  - **1.4b (separado, depois):** exercícios conjugados (bi-set, tri-set, circuito). Campo `grupo` no exercício (`{"tipo": "SUPERSET"|"TRI_SET"|"CIRCUITO"|..., "id": número}`), montado em `Sessao.grupos` só quando a combinação existe na metodologia e as regras de `dominio/combinacoes` fecham (membros contíguos, tamanho); senão, nota fixa na observação.
  - Teste: `DecodificadorDaPropostaTest` (cada campo, os conflitos, valor fora da faixa fica nulo).

- [x] **1.5 Mesmo aluno em dois arquivos (D6)** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit (importacao-28-11); testes unitários verdes (`ImportacaoAssistidaServiceTest`, `RoteadorInterpretadorIa*Test`, `InterpretadorClaude*Test`, `InterpretadorGeminiTest`, `ProcessamentoAssincronoImportacaoTest`, `DecodificadorDaPropostaTest`, `InterpretadorPorRegras*Test`, `SessaoJsonTest`, `ArquiteturaTest`: 142 testes); integração escrita e NÃO rodada (sem Docker), `mvn verify` ainda não rodado. Origem do nome gravada no grupo da sessão (`GrupoImportavel.origemDoNome`, fora da resposta); substituto só em `ImportacaoAssistidaService.nomeDeExibicao` (nome do arquivo, senão "Aluno N"; título padrão do texto = "Aluno N"); junção do serviço e `juntarPorNome` só com `CONTEUDO` nos dois. "Juntar com…" (manual) e a pista `possivelMesmoAluno` continuam sem exigir a origem (são a saída da D6). **Lacuna:** `MESMO_NOME_NA_SESSAO` (`ConfirmacaoDaImportacaoAssistida`, outro dono) ainda compara o nome de exibição: dois arquivos sem nome com o mesmo nome de arquivo viram dois grupos, mas o segundo leva 409 ao gravar; conserto: conferir e registrar o nome só quando a origem do grupo for `CONTEUDO` (no código em 28/11, sem commit: `GrupoImportavel.nomeLidoDoConteudo` no `gravarGrupo`)
  - Hoje (`ImportacaoAssistidaService.aplicarResultadoNaSessao`, linhas 412-448): um grupo por arquivo; `PistaDeIdentidade` só tira o nome do nome do arquivo. Treino em um PDF e dieta em outro viram dois "Criar aluno" e, sem e-mail, dois alunos com o mesmo nome (a confirmação só confere e-mail igual, `ConfirmacaoDaImportacaoAssistida.java:355-361`).
  - O que fazer: **regras e IA devolvem o nome do aluno NULO junto com a origem (`OrigemDoNome`: `CONTEUDO`, `NOME_DO_ARQUIVO`, `TITULO_DO_TEXTO`, `AUSENTE`); o substituto (nome do arquivo para exibir, título padrão do texto colado, "Aluno N") é escrito num lugar só, no `ImportacaoAssistidaService`, e nenhum substituto chega à junção parecendo nome lido** (hoje nasce em `InterpretadorPorRegras.java:101` e `:104`, `DecodificadorDaProposta.java:157`, `ImportacaoAssistidaService.java:459` e `:461`, números do `c9d16c8`). Depois de montar os grupos do lote, juntar os de mesma `chaveDoNome` **só quando os DOIS têm origem `CONTEUDO`** e não há conflito (no máximo um treino e uma dieta entre eles; pesos somam sem repetir a data; e-mail e telefone só se iguais ou só um preenchido). O grupo junto guarda os dois em `arquivos`. Com conflito, não junta e marca `possivelMesmoAluno` (a tela oferece "Juntar com…", passo 2.2). Na confirmação, dois grupos "Criar aluno" com o mesmo nome na mesma sessão: o segundo recebe o erro fixo `MESMO_NOME_NA_SESSAO` em vez de criar outro.
  - Teste: `ImportacaoAssistidaServiceTest` (junta, não junta com conflito) e integração da confirmação.
  - Teste obrigatório, um por caminho (regras e IA): dois arquivos sem nome no texto e com o MESMO nome de arquivo, e dois textos colados com o título padrão ("Texto livre do WhatsApp"), continuam DOIS grupos; e `RoteadorInterpretadorIa.juntarPorNome` (partes de um documento grande) também só junta origem `CONTEUDO`.

- [x] **1.6 Registro de uso e modo por arquivo** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje: o pacote `assistida/` não tem nenhum log; o modo (IA ou regras) é um só por sessão (`consolidarModo`), então a tela não sabe qual arquivo caiu nas regras.
  - O que fazer: (a) uma linha de log por arquivo, **sem conteúdo, nome de arquivo nem nome de aluno**: consultoria, sessão, provedor, modelo, duração, `stop_reason`, tokens de entrada, de saída, de cache lido e gravado, modo efetivo, motivo da queda e tentativas; (b) gravar `modo` e `motivoFallback` no JSON de metadados do arquivo (`extracaoJson`, sem migration) e devolver no `ArquivoResumo`.
  - Teste: unitário do que entra no log (lista fechada de campos).

- [x] **1.7 Limpezas pequenas** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados (sem o aquecimento do cache; `responseSchema` do Gemini não conferido na documentação)
  - `ConfiguracaoIaImportacao`: `modeloForte` não é usado em lugar nenhum (apagar a propriedade, a linha do `application.yml` e a do `.env.example`); `modeloPadrao` é só do Gemini (renomear para `geminiModelo`).
  - Gemini: `responseSchema` (pendência que já está no README) e o mesmo tratamento de `retry-after`.
  - Cache: com 3 arquivos em paralelo os três primeiros pagam a gravação do cache. Ler o **primeiro arquivo sozinho** e só então abrir os outros em paralelo (`executarProcessamentoSemTransacao`). Confirmar pelo log do 1.6 (`cache_read` maior que zero do segundo arquivo em diante).
  - Prompt: envolver o texto do arquivo em `<documento>` e dizer no `system` que o conteúdo do documento é dado a extrair, nunca instrução.
  - Biblioteca com mais de 1.500 nomes é cortada em ordem (`MAXIMO_DE_NOMES_DA_BIBLIOTECA`, já marcado `shortcut:`): deixar como está.

- [ ] **1.8 Conjunto de avaliação** — commit/run: —
  - 10 a 20 documentos **fictícios** (PDF de treino em tabela, PDF de dieta com opções, planilha com vários alunos, DOCX, texto de WhatsApp, documento longo, um com RIR e técnica, um com conjugados) em `api/src/test/resources/importacao-assistida/avaliacao/`, cada um com o JSON esperado.
  - Teste `AvaliacaoDaIaRealTest`, que **pula sem a chave** no ambiente (molde do `TurnstileCloudflareRealTest`) e fica fora do `mvn verify`: chama o provedor de verdade e imprime por documento: alunos, sessões, exercícios (nome igual), séries (quantidade e repetições), refeições e itens, e **campos preenchidos que não estão no documento (tem de ser zero)**.
  - Cada rodada gasta dinheiro de verdade: só com o Gustavo pedindo. Usar para decidir: pensamento ligado ou desligado (1.1), esforço, Haiku 5.5 ou Sonnet 5.5, e antes do lote 4.

- [x] **1.9 Leitura antiga não sobrescreve a nova** — recuperar sessão presa (0.2) e "Tentar ler de novo" abrem a porta de a tarefa antiga terminar depois de a nova começar (`ProcessamentoAssincronoImportacao`, `concluirProcessamentoEmTransacao`, `aplicarResultadoNaSessao`). Gravar um identificador da leitura (`leituraId`, UUID) no progresso ao marcar `PROCESSANDO`; conferi-lo ao concluir e ao contar arquivo lido; resultado de leitura com outro identificador é descartado (e arquivo que não está `RECEBIDO` é pulado); `findByConsultoriaIdAndEstado` com trava. Teste: duas leituras da mesma sessão, a primeira conclui por último e não grava nada. — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit (importacao-28-11); testes unitários verdes (`ImportacaoAssistidaServiceTest`, `RoteadorInterpretadorIa*Test`, `InterpretadorClaude*Test`, `InterpretadorGeminiTest`, `ProcessamentoAssincronoImportacaoTest`, `DecodificadorDaPropostaTest`, `InterpretadorPorRegras*Test`, `SessaoJsonTest`, `ArquiteturaTest`: 142 testes); integração escrita e NÃO rodada (sem Docker), `mvn verify` ainda não rodado. `aplicarResultadoNaSessao` pula arquivo que não está `RECEBIDO`; o `processar` síncrono grava a marca; o progresso no fim da leitura mantém `alunosCriados` e `confirmacoes` (antes era recriado)
- [x] **1.10 Corte da sessão calculado das partes e tentativas** — o teto por arquivo e o corte da sessão saem da MESMA conta que o número de partes e de tentativas (partes máximas × tentativas × tempo por chamada, e o primeiro arquivo lido sozinho: `1 + ceil((n-1)/3)` rodadas), nunca de número fixo (`RoteadorInterpretadorIa.TEMPO_MAXIMO_POR_ARQUIVO`, `ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos`, `SessaoJson.leituraPresa`); o `prazo` do `InterpretadorClaude` começa antes do `http.send`; alinhar o `InterpretadorGemini.TIMEOUT_HTTP` ao do Claude (3 min até responder, 10 min por chamada). Teste: `limiteDaSessaoEmSegundos(2) >= 2 × TEMPO_MAXIMO_POR_ARQUIVO`. — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit (importacao-28-11); testes unitários verdes (`ImportacaoAssistidaServiceTest`, `RoteadorInterpretadorIa*Test`, `InterpretadorClaude*Test`, `InterpretadorGeminiTest`, `ProcessamentoAssincronoImportacaoTest`, `DecodificadorDaPropostaTest`, `InterpretadorPorRegras*Test`, `SessaoJsonTest`, `ArquiteturaTest`: 142 testes); integração escrita e NÃO rodada (sem Docker), `mvn verify` ainda não rodado. Decisão do Gustavo (27/11): no lugar da soma de piores casos, UM orçamento de 15 min por arquivo (`RoteadorInterpretadorIa.ORCAMENTO_POR_ARQUIVO`); cada chamada tem como prazo o que sobra dele (a chamada roda numa thread virtual e é interrompida no fim do orçamento, vale para Claude e Gemini), nova tentativa só se couber, parte que não coube vai às regras com aviso fixo e motivo `TEMPO_ESGOTADO`; corte da sessão = rodadas × (15 min + 30 s de folga da rodada) + 2 min (1 arquivo: 17,5 min; 20 arquivos: 126 min; `leituraPresa` soma mais 2 min). `TEMPO_MAXIMO_POR_ARQUIVO` e a conta de 4 argumentos saíram; o prazo do Claude conta desde antes do `http.send`
- [x] **1.11 Fila de leitura justa entre consultorias** — o pool é fixo de 4 para todas (`ProcessamentoAssincronoImportacao.java:71`): limitar quantas leituras uma consultoria ocupa ao mesmo tempo (no máximo 2 de 4, as demais esperam em fila sem ocupar thread), o relógio do vigia só corre depois que a leitura começa. — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit (importacao-28-11); testes unitários verdes (`ImportacaoAssistidaServiceTest`, `RoteadorInterpretadorIa*Test`, `InterpretadorClaude*Test`, `InterpretadorGeminiTest`, `ProcessamentoAssincronoImportacaoTest`, `DecodificadorDaPropostaTest`, `InterpretadorPorRegras*Test`, `SessaoJsonTest`, `ArquiteturaTest`: 142 testes); integração escrita e NÃO rodada (sem Docker), `mvn verify` ainda não rodado. Fila de 2 por consultoria coberta por teste (a 3ª espera, outra consultoria não); a sessão na fila fica `aguardando` no progresso (`SessaoDetalhe.leitura.aguardando`, campo novo: o app ainda não o usa), sem relógio; tem fim porque cada leitura da frente tem corte, e a rotina da subida (`soltarSessoesEmLeitura`, já por consultoria) solta também as da fila (estão `PROCESSANDO`)
- [x] **1.12 Achados menores da revisão independente (27/11)** — fechar a caixa `<documento>` repetindo a remoção até não mudar (`</docu</documento>mento>`); apelidos do dicionário e nomes da biblioteca em bloco delimitado como dado; `regrasDaParte` com aba fatiada; `MESMO_NOME_NA_SESSAO` sob duas confirmações simultâneas (ler `nomesJaCriados` dentro da trava e registrar o aluno criado na mesma transação de `gravarAluno`); status HTTP/tipo do erro na linha de log de uso (sem conteúdo); `interpretarComModo(contexto, sessaoId)` no serviço; `comBiblioteca` de volta dentro do `try`. — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit (importacao-28-11); testes unitários verdes (`ImportacaoAssistidaServiceTest`, `RoteadorInterpretadorIa*Test`, `InterpretadorClaude*Test`, `InterpretadorGeminiTest`, `ProcessamentoAssincronoImportacaoTest`, `DecodificadorDaPropostaTest`, `InterpretadorPorRegras*Test`, `SessaoJsonTest`, `ArquiteturaTest`: 142 testes); integração escrita e NÃO rodada (sem Docker), `mvn verify` ainda não rodado. Lote B: `regrasDaParte` lê só o pedaço da aba fatiada daquela parte; erro (classe) e status HTTP na linha de log de uso; `interpretarComModo(contexto, sessaoId)` no serviço; `comBiblioteca` dentro do `try`. `soltarSessoesEmLeitura` já roda por consultoria (sem mudança)

### Lote 2: assistida, tela (da revisão das telas; os itens 0.3 e 0.4 saíram daqui)

- [x] **2.1 Acrescentar arquivos e texto com a sessão aberta; envio que não para no primeiro recusado** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje: a área de envio só existe antes da sessão (`PainelImportacaoAssistida.tsx:508-561`); o laço de envio para no primeiro erro sem dizer qual arquivo (linhas 230-233). O servidor aceita arquivo novo em sessão aberta.
  - O que fazer: manter a `AreaDeSoltarArquivos` e "Colar texto" enquanto a sessão não está lendo; enviar todos e listar por arquivo "enviado" ou "recusado: motivo"; conferir no app, antes de subir, extensão, 900 KB por arquivo, 20 arquivos e 8 MB no total (`File.size`); não listar sessão com 0 arquivos em "Importações em aberto".
  - API: `SESSOES_ABERTAS_POR_USUARIO` conta toda sessão criada em 7 dias, concluída e cancelada inclusive: contar só as abertas.

- [x] **2.2 "Ver o que foi lido" e correção do cadastro antes de gravar** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje: o cartão do aluno só mostra contagens (`dominio/importacaoAssistida.ts` `linhasDoGrupo`); nome lido errado não se corrige na tela (o `PUT` do grupo já aceita `nome`).
  - O que fazer: seção recolhível por aluno, só leitura, com treino e dieta (reaproveitar as peças de `planilhaCompleta/EtapaDaAmostra.tsx`); nome, e-mail e WhatsApp editáveis (API: `AtualizarGrupoRequisicao` passa a aceitar `email` e `telefone`, validados como no aceite); "Juntar com…" quando `possivelMesmoAluno` (passo 1.5). A correção fina de série e alimento continua no editor do rascunho.
  - Texto colado: trocar "Título ou origem" (padrão "Texto livre do WhatsApp", que vira nome de aluno) por "Nome do aluno (se o texto é de um aluno só)", sem valor padrão.

- [x] **2.3 Aluno que deu erro na gravação continua editável** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje: vira linha sem Destino nem Ignorar; só "Tentar de novo", que repete o erro. O servidor já aceita mudar o destino de grupo com erro.
  - O que fazer: cartão normal com o motivo no topo, Destino, cadastro editável e Ignorar.

- [x] **2.4 Termos para conferir mais rápidos** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Melhor sugestão como botão na própria linha ("Usar Supino reto") e "Manter como está", um clique cada; campo com busca na biblioteca no lugar do texto livre; coluna Arquivo ou Aluno (`arquivoOrigem` já vem da API); trecho que expande; frase fixa "Termo não conferido entra com o nome do documento, sem vínculo com a biblioteca."; não mostrar "(87%)" como "Sugestões do catálogo" quando a sugestão não é item da biblioteca.
  - API: o grupo nasce sempre `PRONTO`; marcar `COM_DUVIDAS` quando tem termo aberto, para "Selecionar prontos" não o incluir sem aviso.

- [x] **2.5 Depois de gravar** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje: a tela final só mostra contagens; a assistida não entra no Histórico da tela Importação.
  - API: `ConfirmacaoResultado` passa a trazer `alunos: [{alunoId, nome, criado, pastaId, treinoId, dietaId}]` (só para quem tem `ALUNO_LER`); registrar uma linha em `importacao` (destino `assistida`, sem nome de arquivo) na conclusão. Conferir se `importacao.destino` tem CHECK; se tiver, é migration (próximo número livre, subir os totais dos dois testes).
  - App: lista "Abrir ficha" e "Abrir rascunho do treino" por aluno; "Fazer outra importação" continua.
  - **Desfazer** da assistida (carimbar `importacao_id` no que foi criado e reaproveitar `DesfazerDaPlanilha`) fica para depois: ver "Fora do escopo".

- [x] **2.6 Espera da leitura** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Gravar o `sessaoId` no endereço (`router.setParams`) para o F5 voltar à sessão; texto "Pode sair desta tela: a leitura continua."; depois de 5 falhas seguidas do polling ou do teto de tempo, aviso com "Continuar esperando" e "Cancelar"; mostrar "Importações em aberto" na tela Importação (hoje são 4 cliques para retomar).

- [x] **2.7 Estado da tela** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Contador de pedido (como o `pedido` do assistente manual) ou controles desabilitados durante uma ação, para a resposta mais antiga não vencer; se o `obterSessao` falhar depois de gravar, manter a sessão em vez de mostrar a tela final; `revogando` por linha; seleção já nasce com os prontos marcados; uma frase ao lado de "Gravar selecionados" ("vai criar N alunos novos").

- [x] **2.8 Textos, dicionário e Ajuda** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - "Grupo" → "aluno"; "Revogar" → "Desfazer resposta"; modo de leitura em uma frase sem infraestrutura (sem "contingência", "neste servidor", "falta a chave do serviço"); usar o modo por arquivo do passo 1.6 ("2 de 5 arquivos foram lidos sem IA: confira com atenção").
  - Tela simples do dicionário da consultoria (`listarApelidos` e `removerApelido` já existem no serviço, sem uso), como item do hub de Configurações (entra no catálogo `dominio/configuracoes.ts` com teste).
  - `ajuda/conteudo.ts`: a Ajuda ainda manda tocar em "Planilha completa" e "escolha Alunos, baixe o modelo"; atualizar e rodar `node scripts/guias/gerar.mjs`.

### Lote 3: importação manual (só `api/`, da revisão da API; reler cada trecho antes)

- [x] **3.1 "x" vira célula vazia para todo mundo** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados (marcador num campo próprio da célula, o texto fica vazio)
  - Onde: `LeitorDePlanilha.java:88-104` (`deTextoLido` troca "x", "X" e traços por vazio; conferido) e `completa/MontagemDeSeries.java` (`SIM` contém "x", que nunca chega).
  - Efeito: na planilha completa, coluna TS ou BO marcada com "x" não gera série e coluna "Ativo" da rotina com "x" tira o treino, sem aviso.
  - O que fazer: guardar o marcador na `Celula` (flag `marcador`) e tratá-lo como vazio só na leitura do `GravadorDaImportacao`; a completa passa a ver o "x". Os testes da completa montam `Celula` direto (`PlanilhaDeTeste`): acrescentar um que passe por `deTextoLido`.

- [x] **3.2 CSV em Windows-1252** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `LeitorDePlanilha.java:629-638` (só UTF-8 estrito; conferido). O "CSV (separado por vírgulas)" do Excel no Windows sai em Windows-1252 e qualquer acento recusa o arquivo.
  - O que fazer: se o UTF-8 estrito falhar, decodificar em `windows-1252`; reconhecer BOM de UTF-16. O hash é sobre os bytes e não muda.

- [x] **3.3 CPF e CEP digitados como número** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `GravadorDaImportacao.java` (CPF, CEP, chave de pesos por CPF). O Excel guarda CPF e CEP só com dígitos como número e corta o zero à esquerda.
  - O que fazer: célula numérica só com dígitos é completada com zeros até 11 (CPF) ou 8 (CEP) antes de `Formatos`. O dígito verificador do CPF continua valendo.

- [x] **3.4 Um conversor só de data, número e sim/não (`ValoresDeCelula`)** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Hoje há três conversores com regras diferentes (`GravadorDaImportacao`, `AnaliseDaPlanilha`, `MontagemDeSeries`).
  - Data: aceitar dia e mês com 1 ou 2 dígitos, separadores `/`, `-` e `.`, ano com 2 dígitos e hora no fim; avisar na prévia quando a coluna parece mês/dia/ano; número sem formato de data **não** vira data (hoje o ano "2025" vira 17/07/1905 em silêncio); usar o `Celula.data()` que o leitor já calcula.
  - Número: "80,5 kg" e "1.234,56" com a mesma regra nas duas trilhas; tirar resíduo de conta também em `MontagemDeSeries.numero`; a guarda do passo 0.1 mora aqui.
  - Sim/não: aceitar "ativa", "s", "n", "verdadeiro" e "falso" (o próprio leitor gera os dois últimos).

- [x] **3.5 Status desconhecido (D7)** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Onde: `completa/MontagemDaImportacao.java` (por volta da linha 484): só `ativo`/`ativa` conta como ativo; "Sim", "Pago", "Em dia" criam o aluno inativo sem problema na linha.

- [x] **3.6 Responsável por nome; nascimento e sexo** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - `GravadorDaImportacao` `responsavelFinal` só procura por e-mail, mas a sugestão de colunas casa a coluna "Responsável" (que costuma trazer o nome): aceitar o nome quando casa com um único membro ativo (`Buscas.semAcento`) e trocar a mensagem para "Use o e-mail ou o nome de um membro da equipe."
  - Campos novos na importação de alunos: data de nascimento e sexo (hoje quem migra por planilha fica sem Aniversários). Atualizar `SugestaoDeColunas`, os modelos (`scripts/importacao/gerar-modelos.mjs`) e `dominio/mapeamentoDaImportacao.ts`.

- [x] **3.7 Desempenho da planilha completa** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - (a) `GravacaoDaPlanilha`: `pesos.findAll()` no contexto e `saveAndFlush` por linha, com a consultoria travada. Trocar por projeção `(alunoId, data)`, `save` sem flush, `setJdbcBatchSize(500)` e um flush no fim com o mesmo tratamento do `descarregar()` da importação de uma aba (pendência que já está no README). Peso gravado por fora no mesmo dia hoje dá 500 aqui e 409 na de uma aba: igualar.
  - (b) `LeituraDasAbas`: o xlsx é reaberto e reanalisado para cada aba (até 40 vezes por pedido) e, na prévia e na confirmação, dentro da transação. Criar `LeitorDePlanilha.lerTodas(bytes)` e ler antes de abrir a transação.
  - (c) `MontagemDaImportacao`: o casamento aproximado de nomes roda de novo a cada linha (2,3 ms por nome contra 800 exercícios, medido). Guardar o resultado por nome num mapa dentro da montagem; normalizar as bibliotecas de suplemento uma vez; balde próprio de tentativas para as páginas da amostra (`inicio > 0` hoje não passa por limite).
  - (d) `DesfazerDaPlanilha`/`LinhasDaImportacao`: carrega todos os JSON de treino da consultoria para procurar ids. Consultar por id ou percorrer em fluxo, sem acumular.

- [x] **3.8 Efeitos por linha na confirmação de alunos** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - Inativar pela planilha encerra as sessões do aluno na hora; se a confirmação recua depois, ele continua ativo mas já foi deslogado. Acumular as mudanças de situação e aplicar depois do flush final. `plano.exigirVagaDeAluno()` por linha (com `TREINOS_PLANO_APLICAR`) dispara flush e desfaz o lote: chamar uma vez (não executado pela revisão; conferir).

- [x] **3.9 Um dicionário só de sinônimos de coluna** — commit/run: feito em 27/11 na worktree `consultoria-app-importacao` (branch `importacao-28-11`), SEM commit; testes unitários verdes, integração e `mvn verify` ainda não rodados
  - `SugestaoDeColunas` e `completa/Campo` têm listas diferentes ("zap", "notas" só numa; "documento", "fabricante" só na outra). Uma tabela por conceito, com cada trilha mapeando para o seu campo. A distância de edição também está duplicada (`SugestaoDeColunas` e `CasamentoDeNomes`).

- [ ] **3.10 Estrutura das classes grandes** (só quando for mexer nelas) — commit/run: —
  - `GravadorDaImportacao` (1.366 linhas): linha corrente e regra num `ThreadLocal`; trocar por um objeto `LinhaEmLeitura(linha, config, regra)` e um arquivo por destino.
  - `MontagemDaImportacao` (1.541 linhas): pares `Object[] {aba, linha}` com cast; trocar por `record LinhaDaAba` e `record PesoInicial`.

### Lote 4: PDF e imagem como reserva (D1, depois do 1.8)

- [x] **4.1 API** — commit/run: feito em 28/11, SEM commit (importacao-28-11); testes unitários da API verdes; NÃO rodaram: integração, Docker, `mvn verify` e e2e. Chave `TREINOS_IA_ENVIAR_ARQUIVO_AO_PROVEDOR` (`ConfiguracaoIaImportacao.arquivoVaiAoProvedor`: com o envio de dados, provedor `claude` e a chave do Claude); V117 refaz `ck_importacao_arquivo_formato` com JPG e PNG (`NOT VALID`; totais 116); 900 KB conferido antes de detectar o formato; portão único `RoteadorInterpretadorIa.comArquivoSeCouber` (cobertura `SEM_TEXTO`/`PARCIAL`, PDF/JPG/PNG, até 5 MB); `ArquivoResumo.enviadoComoArquivo`; `GET /eu` com `importacaoPorImagemHabilitada`. **Falta:** revisão do `revisor` antes do commit
  - Chave nova (D8), desligada por padrão; ligada sem a de envio de dados não faz nada. `.env.example` só com o nome.
  - `ContextoIa` ganha os bytes do arquivo só para o conector do Claude, e o roteador só os entrega quando a chave está ligada **e** a cobertura da extração é `SEM_TEXTO` ou `PARCIAL`. No pedido, antes do texto: `{"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": ...}}`. Limites da API: 32 MB por pedido e 600 páginas; os do app (900 KB, 200 páginas) ficam bem abaixo.
  - Imagem (JPG e PNG): aceitar em `detectarFormato` pelos bytes; passar por `JpegSemMetadados` ou `PngSemMetadados` (tira EXIF e GPS) antes de guardar; com a chave desligada, recusar com mensagem clara ("Envie o texto ou um PDF"). Bloco `{"type": "image", ...}`.
  - O nome do arquivo continua sem sair. Marcar no metadados do arquivo `enviadoComoArquivo: true`.
  - Revisão do `revisor` antes do commit (importação sensível, LGPD).
  - 28/11 (D8): padrão `true` no `application.yml` e no `.env.example` (vazio = ligado). Conferido no código: `ConfiguracaoIaImportacao.arquivoVaiAoProvedor` exige também o envio de dados, o provedor `claude` e a chave; sem eles a subida não muda (não há verificação na subida) e o `GET /eu` traz `importacaoPorImagemHabilitada=false`. O `docker-compose.yml` não passa nenhuma variável `TREINOS_IA_*` (vale o padrão do yml). Sem teste que assumisse o padrão desligado.

- [x] **4.2 App e textos** — commit/run: feito em 28/11, SEM commit (importacao-28-11); jest, `tsc` (typecheck) e eslint do app verdes; NÃO rodaram: e2e (suíte completa exigida por mudar DTO). "Lido pela imagem do documento" por arquivo, `FORMATOS_E_LIMITES_COM_IMAGEM` e `AVISO_DA_LEITURA_POR_IMAGEM` só com `importacaoPorImagemHabilitada`, Ajuda atualizada. **Não feito, por decisão do Gustavo:** aviso de privacidade e `Termos.VERSAO` não mudaram; a chave passou a ligada por padrão em 28/11 sem esperar a revisão jurídica (D8)
  - Aviso por arquivo "Lido pela imagem do documento"; `FORMATOS_E_LIMITES` e a `AreaDeSoltarArquivos` com JPG e PNG só quando o `GET /eu` (campo novo) disser que a chave está ligada.
  - Aviso de privacidade: dizer que o arquivo inteiro pode ser enviado ao provedor de IA; subir `Termos.VERSAO`. Entra na revisão jurídica que já está pendente; o Gustavo mandou ligar antes dela (28/11).
  - Risco a deixar escrito: PDF de evolução pode trazer foto de corpo, que é dado sensível.

## Como verificar cada lote
- `api/`: `mvn verify` (JDK 25, Docker). Classes novas de teste citadas em cada passo.
- `app/`: `npm run typecheck && npm run lint && npm test`.
- E2e: lotes 0 e 3 rodam só `importacao`, `importacao-assistida`, `importacao-modal`, `importacao-planilha-completa`, `migracao-assistida*` e as que abrem folha e mostram toast. Lotes 1.6, 2 e 4 mudam DTO: **suíte completa** (regra do e2e de 24/11).
- Nenhum teste chama provedor de IA de verdade, fora o `AvaliacaoDaIaRealTest`, que só roda com a chave e a pedido.
- Dados de teste sempre fictícios; nenhuma planilha ou PDF de aluno no repositório.
- A cada entrega: marcar o passo com o commit, atualizar o item correspondente do `AGENTS.md` e, se a tela mudou o que o guia descreve, `ajuda/conteudo.ts` e os guias em PDF.

## Fora do escopo
- Servidor MCP, lotes com 50% de desconto e agente com ferramenta de busca na biblioteca (D4).
- SDK oficial da Anthropic (D2).
- Subir o `anthropic-version` para `2026-10-21`: é uma migração à parte, com regras próprias.
- Desfazer da importação assistida (passo 2.5): precisa carimbar `importacao_id` em tudo o que a confirmação cria; fica para depois dos links.
- Caixas por aluno "cadastro, treino, dieta, pesos" (D3): depois do passo 2.2.
- Importar cargas e registros antigos do aluno: não há destino para isso hoje.
- Heurísticas de `ReconhecimentoDeAbas`, `FormatoDasAbas`, `LigacaoDeAbas` e a lógica interna do `LeitorDePrescricao`: a revisão não entrou nelas.

### Lote 5: nome substituto e partes (D10, D11, 28/11)

- [x] **5.1 API** — commit/run: feito em 28/11, SEM commit (importacao-28-11). `OrigemDoNome.DIGITADO`; `GrupoImportavel.paraLeitura` leva `origemDoNome`; `nomeSubstituto()`; `atualizarGrupo` marca `DIGITADO`; `ConfirmacaoDaImportacaoAssistida.exigirNomeDosAlunosNovos` (fase 1, 422) e a mesma recusa na gravação do grupo (corrida entre as fases); `juntarGrupos(lista)` com `partesDoMesmoArquivo`. Testes: `ConfirmacaoDaImportacaoAssistidaTest`, `ImportacaoAssistidaServiceTest` (partes), `ImportacaoAssistidaIntegrationTest` (substituto recusa, digitado e confirmado gravam, vincular e ignorar gravam). Rodaram focados (ver relatório da sessão); falta o `mvn verify` completo.
- [x] **5.2 App** — commit/run: feito em 28/11, SEM commit. Regras em `dominio/importacaoAssistida.ts` (`nomeTravado`, `avisoDoNome`, `nomeNoCampo`, `partesParaJuntar`, `textoDosTravados`) com `importacaoAssistidaNome.test.ts`; cartão (`AlunoParaConferir`: aviso, "Usar este nome", caixa desabilitada com o motivo, "Juntar as N partes") e painel (contagem dos travados junto do "Gravar"). jest, `tsc` e eslint dos arquivos tocados verdes. E2e novos em `importacao-assistida.spec.ts` (descrição "nome não encontrado no documento"), NÃO rodados.

## O que ficou para trás
- (preencher a cada entrega; cada sobra também vai para "Pendências soltas" no README)
- Desfazer do "Juntar as N partes": o servidor não guarda as partes; precisaria de rota nova.
- Sem `origemDoNome` na resposta (sessão anterior ao campo) o app não trava; a API recusa com 422.
