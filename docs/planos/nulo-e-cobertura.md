# Nulo, zero e cobertura: o que cada indicador sabe dizer

Situação: Em andamento (passos 1 a 3 feitos, local sem commit; 4 e 5 pendentes) · Onde: `main`, trabalho local, sem commit nem push · Atualizado: 13/11/2026

## Objetivo
Nenhum indicador pode mostrar **0 que mente**: sem permissão, com cobertura incompleta ou desconhecida, ou sem base de cálculo, a API devolve nulo e a tela diz a condição; zero só quando a consulta concluiu, a cobertura vale e não há registro. Fonte: decisão do Gustavo de 13/11/2026 ("corrigir a ausência de permissão sem apresentar zero e propor um contrato explícito para os indicadores com cobertura incompleta ou desconhecida; limitar aos casos necessários, com revisão independente, sem inventar cobertura que o servidor não consegue comprovar; registrar o motivo por indicador e distinguir permissão, retenção, falha, filtro incompatível e cálculo sem base").

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Regra de leitura: consulta concluída + cobertura válida + nenhum registro = 0; falha, indisponível ou sem cobertura = dizer a condição; média, conversão e mediana sem base = "—" com motivo | Já confirmada | Gustavo, 13/11 |
| D2 | Nunca aplicar `COALESCE(…,0)` como correção automática; nunca converter caso inseguro para zero | Já confirmada | Gustavo, 13/11 |
| D3 | Só a correção mínima entra agora: as quatro contagens de atualização do `/painel` (nulo sem `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`, como o `NumerosService`). O resto fica na tabela e no contrato proposto | Escopo desta rodada | Gustavo, 13/11 |
| D4 | O contrato `cobertura` (abaixo) é **proposta em texto**: nenhum código, endpoint nem tipo foi criado | Aguarda aprovação | Pendente: Gustavo |
| D5 | Registro de 13/11: **a entrega atual corrige só as quatro contagens de atualização sem permissão**. A cobertura e a retenção dos demais indicadores (Financeiro, Interessados e os outros da tabela) **continuam pendentes onde não foram esclarecidas**; nada nesta rodada afirma que estejam resolvidas | Escopo e estado | Gustavo, 13/11 |
| D6 | **A decidir.** O app já soma o nulo como 0 em `recebido`, `aReceber` e `receitaRecorrente` (`somaOuZero`, `app/src/dominio/financeiro.ts:508-513,546-551,640` e `painelDoInicio.ts:716-719`, comentário "Gustavo, 13/11"). Na prática é um `COALESCE` feito no app, e o comentário se apoia no `nz` do servidor. Não está registrado como decisão e conflita com D2 se o 0 puder mentir; trocar o `nz` tira a justificativa do app. Não mexer em nenhum dos dois antes de o Gustavo decidir | Pendente | Gustavo |
| D7 | Revisão independente (`revisor`, 13/11): **nenhum bloqueante no código**; a correção das quatro contagens está certa e completa. Ajustes pedidos na tabela e na proposta foram aplicados abaixo. Não rodou `git diff` nem `mvn` (sem shell): os 57 testes são do executor | Concluída | revisor |

Motivos usados na tabela (os cinco do pedido, mais um; `FALHA` é estado do app, "Não carregou": **nenhum endpoint responde 200 com falha**, por isso ela não entra no enum da API): `PERMISSAO`, `RETENCAO`, `FALHA`, `FILTRO_INCOMPATIVEL`, `SEM_BASE`, `NENHUM` (cobertura comprovável: o 0 é de verdade) e `RECURSO_DESLIGADO` (**fora das cinco**, aparece só no retorno desligado; precisa de decisão se vira motivo próprio ou se entra em `FILTRO_INCOMPATIVEL`).

## Tabela por indicador
Lida no código em 13/11/2026 (base: `main` local, sem commit). "Não verificado" = não li o suficiente para afirmar.

### Painel do Início (`GET /painel`, `PainelService.painel`)
| Indicador | Origem | Nulo quando | Zero quando | Motivo da ausência | O 0 pode mentir? | Proposta |
| --- | --- | --- | --- | --- | --- | --- |
| `atualizacoesParaRevisar`, `atualizacoesAtrasadas`, `atualizacoesAvisaramAtraso`, `atualizacoesProximas` | `PainelService.java:151,175-176` (antes `getOrDefault(…,0L)` em `long`) | sem `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER` (**passou a ser nulo nesta rodada**) | com as duas permissões e nada a contar | PERMISSAO | Era sim (mentia sem permissão) | **Corrigido agora** |
| `pastasARenovar`, `pastasParaRenovar` | `PainelService.java:159-167,177`; `PastaRepository.aRenovar` | sem `TREINO_LER` (lista vem vazia, contagem nula) | com `TREINO_LER` e nenhuma pasta | PERMISSAO | Não: contagem é nula; a lista vazia vem junto com a contagem nula | Deixar (já correto) |
| `alunosSemPastaComPeriodo` | `PainelService.java:169,194-199` | sem `TREINO_LER` | com `TREINO_LER` e todos com pasta | PERMISSAO | Não | Deixar |
| `alunosSemRegistroTotal`, `alunosSemRegistro` (lista) | `PainelService.java:178`; `ExecucaoSerieRepository.ultimoRegistro` | sem `REGISTRO_LER` (lista vazia, total nulo) | com `REGISTRO_LER` e todos registraram há menos de N dias | PERMISSAO (retenção das execuções: não há `@Scheduled` que apague `execucao_serie`; NENHUM) | Não | Deixar |
| `sessoesConcluidas7Dias` | `PainelService.java:172,182-187` | sem `REGISTRO_LER` ou com `treinos.retorno.habilitado` falso | com as duas condições e nenhuma sessão em 7 dias | PERMISSAO / RECURSO_DESLIGADO | Não | Deixar (precisa de decisão do motivo `RECURSO_DESLIGADO`) |
| `alunosAtivos`, `alunosInativos`, `alunosSemAcesso` | `PainelService.java:170,179` | nunca (sem permissão além de `PAINEL_VER`) | consultoria sem alunos | NENHUM | Não | Deixar |
| `planosTerminando` (lista) | `PainelService.java:142-149` | lista vazia sem `TREINO_LER` | com a permissão e nada terminando | PERMISSAO | Lista vazia não distingue "sem permissão" de "nenhum" (a lista é do painel antigo; a contagem de pastas a substitui) | Deixar; só entra no contrato se a lista seguir em uso |
| `ultimasExecucoes` (lista) | `PainelService.java:173,202-226` | lista vazia sem `REGISTRO_LER` | com a permissão e nenhum registro | PERMISSAO | Mesma ambiguidade da lista acima | Deixar |

### Números (`GET /numeros`, `NumerosService`)
| Indicador | Origem | Nulo quando | Zero quando | Motivo da ausência | O 0 pode mentir? | Proposta |
| --- | --- | --- | --- | --- | --- | --- |
| `atualizacoesNoPrazo`, `atualizacoesAtrasadas` por mês | `NumerosService.java:118,134-135` | sem as duas permissões; mês sem atualização contável | contagem real zero | PERMISSAO / SEM_BASE | Não (já segue a regra) | Deixar |
| `alunosAtivos` por mês | `NumerosService.java:129-131` | mês anterior a `consultoria.criado_em` | contagem real zero | SEM_BASE (desde a criação, comprovável) | Não; aproximação conhecida do reativado, já documentada | Deixar |
| tabela da equipe (`equipe`, `semResponsavel`) | `NumerosService.java:139,173-181` | sem `EQUIPE_LER` (tabela inteira); `atrasadas`/`paraRevisar` sem as duas permissões | contagem real zero | PERMISSAO | Não | Deixar |

### Financeiro (`GET /financeiro/painel`, `FinanceiroService`)
| Indicador | Origem | Nulo quando | Zero quando | Motivo da ausência | O 0 pode mentir? | Proposta |
| --- | --- | --- | --- | --- | --- | --- |
| entradas e saídas avulsas do mês (`MesDoPainel`) | `FinanceiroService.java:176-184,209-210` | mês futuro, mês anterior à criação da consultoria, ou filtro "Meus" (lançamento avulso não tem aluno) | mês da criação até o corrente sem lançamento | SEM_BASE (criação, comprovável) / FILTRO_INCOMPATIVEL (`meus`) | Não; o 0 só vale a partir de `consultoria.criado_em` | Deixar; vira `cobertura` no contrato |
| `resultado` do mês (série) | `FinanceiroService.java:213,329-339` (`nz`) | só quando as três fontes são nulas (e "Meus", direto) | quando soma 0 | SEM_BASE | **Sim, só na série, nos meses anteriores a `consultoria.criado_em` com `recebido` presente** (a baixa manual aceita data desde 01/01/2000, `CobrancaService.java:41,176`): entrada e saída vêm nulas, o `nz` as trata como 0 e o resultado sai como se fosse completo. **Não mente** com "Meus" (a série devolve `resultado` nulo direto, `FinanceiroService.java:209-213`) nem em `resultadoDoMes` (sempre o mês corrente; as avulsas dão 0, não nulo, `:177-184,261-262`). "Nulo antes da criação" quer dizer "nenhum lançamento registrado": o avulso aceita até 10 anos atrás (`LancamentoService.java:102`) | **Contrato novo** (próxima rodada): resultado nulo com motivo se algum componente não tem cobertura; sem trocar `nz` por zero nem por `COALESCE` |
| `recebido` do mês (série e cartão) | `FinanceiroService.java:127-128,206` (`sum` em JPQL devolve nulo sem linhas) | consulta concluída sem nenhum pagamento (mês ou período) | nunca aparece | NENHUM | **Inverso na API**: a consulta concluiu e não há registro, deveria ser 0 e vem nulo; **na tela já aparece 0** (`somaOuZero`, ver D6) | Contrato novo: distinguir "consulta concluída vazia" de "sem dado" (mesma frente do `cobertura`); não é correção desta rodada |
| `aReceber`, atrasadas (valor), `receitaRecorrente` | `FinanceiroService.java:130-131,134,315-327` | sem nenhuma linha (soma nula; `receitaRecorrente` nula sem contratações) | atrasadas: quantidade 0 | NENHUM | **Inverso na API** (igual ao `recebido`); a tela já mostra 0 (D6) | Contrato novo, mesma frente |
| `ticket médio` (valor médio); `pagantes` é contagem (não é `SEM_BASE`) | `FinanceiroService.java:136-139` | valor médio sem pagamento ou `pagantes` = 0 | contagem real | SEM_BASE (só o valor médio) | Não | Deixar (já "—" com motivo implícito; o motivo explícito entra no contrato) |
| inadimplência (percentual) | `FinanceiroService.java:218-225` | nada cobrado no período | percentual real | SEM_BASE | Não (nulo, não zero) | Deixar |
| movimento de alunos (novas e encerradas por mês) | `FinanceiroService.java:227-237` (`getOrDefault(mes,0L)`) | nunca | mês sem contratação criada ou encerrada | NENHUM (a contratação não é apagada por retenção; não li o caminho de aluno excluído) | Não para meses desde a criação; para meses **antes** da consultoria existir o 0 é verdadeiro, mas destoa de entradas e saídas (nulas por D19) | Deixar; alinhar no contrato (`desde`) |
| atrasadas (quantidade) e `proximosRecebimentos` | `FinanceiroService.java:134,142-143`; `app/src/dominio/financeiro.ts:549`; `painelDoInicio.ts:712` | valor nulo | quantidade 0 literal quando a consulta nem roda (período todo no futuro) | NENHUM | Não: nada no futuro pode estar vencido; o app usa o 0 como confirmação | **Deixar** (registrado para ninguém "corrigir" depois) |
| `liquido` | `FinanceiroService.java:157-158` | sempre `disponivel=false` | nunca | SEM_BASE (taxas não informadas) | Não (diz "indisponível") | Deixar |
| `GET /financeiro/cobrancas`, `/visao-geral`, `/inadimplentes` | não li nesta rodada além de `visaoGeral` e `inadimplentes` | — | — | não verificado | — | não verificado |

### Interessados (`GET /inscricoes/indicadores`, `IndicadoresDeInscricoes`; retenção `InscricaoRetencao`)
| Indicador | Origem | Nulo quando | Zero quando | Motivo da ausência | O 0 pode mentir? | Proposta |
| --- | --- | --- | --- | --- | --- | --- |
| `entradas`, `pessoas` | `IndicadoresDeInscricoes.java:67-68` | nunca | nenhuma inscrição sobrou no período | RETENCAO | **Sim**: recusada ou desistente com última atividade anterior a hoje − 180 dias é apagada (`InscricaoRetencao.java:23,36`, `InscricaoRepository.apagarEncerradas:93-95`); o período que começa antes do corte conta menos do que houve | **Contrato novo** (`cobertura` PARCIAL, `RETENCAO`, `desde` = hoje − 179 dias) |
| `recusadas`, `desistencias`, `porMotivo`, `reaberturas` | `IndicadoresDeInscricoes.java:72-83` (eventos apagados junto) | nunca | nenhum evento restou | RETENCAO | **Sim**, mesma causa | Contrato novo, mesma `cobertura` |
| `conversao`, `aceitesDasEntradas` | `IndicadoresDeInscricoes.java:99` | sem entradas (conversão nula) | nenhum aceite entre as entradas | SEM_BASE / RETENCAO | **Sim e para cima**: com `entradas` menor pelo corte, a conversão sai inflada | Contrato novo; com `cobertura` PARCIAL a tela deve avisar que a conversão pode estar alta |
| `aceites`, `diasAteAceite` (mediana e média) | `IndicadoresDeInscricoes.java:70,104-113` | sem aceite no período | contagem real | SEM_BASE (nulo) | Menos: a aceita não é apagada pela retenção por prazo; **a anonimização do aluno apaga a inscrição dele** (`InscricaoDoAluno`) e não deixa rastro de data, então nenhuma `cobertura` por data a prova | Deixar; registrar a anonimização como limite declarado (pergunta aberta abaixo) |
| `porOrigem` | `IndicadoresDeInscricoes.java:90-97` | — | — | RETENCAO (as entradas contadas por origem seguem as `entradas`) | **Sim**, mesma causa | Contrato novo |
| Período padrão e o botão "ano" | `IndicadoresDeInscricoes.java:56-66` (até 366 dias); `app/src/treinador/interessados/Indicadores.tsx:57-59` (texto fixo "períodos antigos mostram menos do que houve") | — | — | RETENCAO | O período de um ano é **sempre** parcial (366 > 180); hoje a tela só tem um aviso textual fixo, a API não diz | Contrato novo: o aviso passa a vir da `cobertura` |

### Atualizações e tela do app que só leem (sem mudança nesta rodada)
| Indicador | Origem | Observação | Proposta |
| --- | --- | --- | --- |
| `AtualizacaoService.contar` (as abas) | `AtualizacaoService.java:288-297` | permissão da rota `ATUALIZACAO_LER`; sem permissão é 403, não contagem | Deixar |
| Agenda (`resumoDeAtrasadas`) | `app/src/dominio/agenda.ts:103-106` | nulo, zero e indefinido viram "sem texto"; não confunde com zero mostrado | Deixar |
| `app/src/dominio/financeiro.ts`, `inscricoes.ts`, `numeros.ts` | lidos só no que importa | `financeiro.ts:25-27`: "null da API é sem dado e aparece como —"; `inscricoes.ts:633-639`: conversão e dias nulos = "—"; `numeros.ts:43-68`: total do mês nulo se uma das parcelas é nula | Deixar; o texto do motivo entra com o contrato |
| Retenção das execuções (`execucao_serie`, `sessao_concluida`) | busca por `@Scheduled` em `api/src/main/java` | não há job que as apague (os jobs de retenção são auditoria, importações, avisos de compromisso, inscrições, fotos) | NENHUM; a anonimização mantém execuções (AGENTS.md) |
| Consultas JPQL com `COALESCE` | busca em `painel`, `atualizacoes`, `numeros`, `pastas`, `pagamentos`, `inscricoes`, `sessoesconcluidas`, `execucao` | **nenhum `COALESCE`/`coalesce` de contagem**; o único `coalesce` é de id de pasta em `AtualizacaoRepository.linhasDoPainel:25` (não é número) | Nada a corrigir ali |

## Correção entregue nesta rodada (API)
- `PainelService.PainelTreinador`: as quatro contagens de atualização passam de `long` para `Long`; `painel(...)` devolve `contagem.get(...)` (a chave existe quando há permissão, e o mapa vazio dá nulo sem ela). Sem `getOrDefault`, sem `COALESCE`.
- Teste: `PainelContagensIntegrationTest.contagensDeAtualizacaoSaoNullSemAsDuasPermissoesEZeroComElasESemNada` (sem permissão e só com `ALUNO_SENSIVEL_LER` = nulo nas quatro; com as duas e sem atualização = 0 numérico; `ATUALIZACAO_LER` sozinha não existe, porque ela depende de `ALUNO_SENSIVEL_LER` no `CatalogoPermissoes`).
- Verificação: `mvn -q -Dtest=PainelContagensIntegrationTest,PainelEListaDeAtualizacoesIntegrationTest,PainelAtividadeRecenteIntegrationTest,PainelSessoesConcluidasRetornoDesligadoIntegrationTest,AtualizacoesIntegrationTest,ArquiteturaTest test` em `api/`: 57 testes, 0 falhas (10 + 5 + 1 + 1 + 23 + 17).

## Mudança do app que ficou para a frente B (não aplicada aqui)
O app **não quebra** com a mudança (TypeScript segue compilando e, em tempo de execução, `index.tsx:191-195` e `_layout.tsx:70-77` já só leem o campo com as duas permissões; `agenda.ts` trata nulo). O que falta é dizer a condição:
1. `app/src/api/tipos.ts` (`PainelTreinador`, linhas 1051-1054): os quatro campos viram `number | null`, com o comentário "nulo sem `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`".
2. `app/src/dominio/painelDoInicio.ts` (`cartao`, em torno de 397-405; cartões de atualização em 596-599): hoje valor nulo ou não numérico vira "Não carregou". Para o nulo **de permissão** o cartão deve dizer **"Sem permissão"** (texto neutro, `enfase: 'indisponivel'`, nunca número, nunca cor de função: nada de âmbar, vermelho ou azul), sem abrir folha e sem "Tentar de novo"; "Não carregou" fica só para a falha de carregamento. Na prática o bloco já some quando falta permissão (`blocoDisponivel`), então o texto vale se um perfil ficar com um dos dois lados; conferir se `blocoDisponivel` exige as **duas** permissões.
3. `app/e2e/*.spec.ts` que simulam `GET /painel` com `atualizacoesParaRevisar: 0`: nenhum precisa mudar para compilar; um caso novo no e2e do Início com o painel nulo e o cartão "Sem permissão" fecha a frente.
4. `app/src/dominio/painelDoInicio.ts:96`: o comentário "sem elas o `/painel` devolve 0" ficou falso; corrigir junto.
5. **"Tudo em dia" sem base** (revisão, I5): `proximoPassoDoInicio` devolve `null` quando todas as entradas são nulas (`app/src/dominio/inicioTreinador.ts:31-42`) e a tela mostra `TUDO_EM_DIA` ("Nada pede sua atenção agora", `index.tsx:75,209`); um perfil só com `PAINEL_VER` vê isso sem que nenhuma fonte tenha sido consultada. Com todas as fontes nulas por permissão a tela não afirma "em dia".
6. `app/src/app/treinador/_layout.tsx:72,77` usa `?? 0`: o ponto de aviso fica apagado com nulo, o que é o certo (não afirma zero nem sinaliza); manter.
Responsável: executor-front (frente B, dono de `painelDoInicio.ts`, `index.tsx`, `treinador/painel/*`).

## Proposta de contrato: `cobertura` (somente texto, sem código)
Campo **opcional** `cobertura` por bloco de indicadores (não por número), que a API só preenche quando consegue **comprovar**; ausente = "sem alegação" (a tela não afirma nada além do que já mostra).

```
cobertura: {
  situacao: "COMPLETA" | "PARCIAL" | "DESCONHECIDA",
  motivo?:  "PERMISSAO" | "RETENCAO" | "FALHA" | "FILTRO_INCOMPATIVEL" | "SEM_BASE",   // ausente em COMPLETA
  desde?:   "AAAA-MM-DD"                                                                // só quando comprovável
}
```
Regras:
- `COMPLETA`: o servidor consegue provar que nada do período foi cortado por prazo, filtro ou apagamento. Nunca se afirma por "não há erro". Nos Interessados **não é emitida** enquanto a anonimização apagar inscrição sem rastro (a conversão cai por esse lado, enquanto a retenção a infla).
- `PARCIAL` + `RETENCAO` + `desde`: só quando o corte é uma regra de data do próprio servidor (hoje: os 180 dias dos Interessados; `desde` = hoje (Brasília) − 179 dias, porque o job apaga às 03:35 pelo instante; o javadoc de `InscricaoRetencao.java:41` ainda diz `atualizada_em`, mas a consulta usa `ultimaAtividadeEm`).
- `DESCONHECIDA` + motivo: quando há razão para duvidar e o servidor **não** comprova o limite; **sem `desde`, sem data inventada**.
- Valor continua nulo (nunca zero) quando `PERMISSAO`, `FALHA`, `FILTRO_INCOMPATIVEL` ou `SEM_BASE` impedem o cálculo; o 0 só aparece com `COMPLETA` ou sem alegação, consulta concluída e nenhum registro.
- Campo novo e opcional: o app antigo ignora; sem versionamento nem camada de compatibilidade (regra "sem legado" do AGENTS.md).

| Bloco / indicador | `cobertura` proposta | O que a API preenche | Fica `DESCONHECIDA` |
| --- | --- | --- | --- |
| Interessados: `entradas`, `pessoas`, `recusadas`, `desistencias`, `porMotivo`, `reaberturas`, `porOrigem`, `conversao` | `PARCIAL` + `RETENCAO` + `desde` quando o início do período é anterior ao corte; **sem alegação** (nunca `COMPLETA`) dentro do prazo enquanto a pergunta aberta 1 (anonimização) não for respondida | `desde` = hoje − **179** dias (o job das 03:35 usa `Instant.now() − 180d` e apaga o que tem `ultimaAtividadeEm` anterior: uma recusada com atividade à 01:00 do dia hoje − 180 já foi apagada, `InscricaoRetencao.java:23,36-38`, `InscricaoRepository.java:93-95`) | A anonimização do aluno também apaga a inscrição (sem rastro de data): não entra no `desde`; ver pergunta aberta 1 |
| Interessados: `aceites`, `diasAteAceite` | sem alegação por prazo (a aceita não sai pela retenção de 180 dias) | nada | Idem anonimização |
| Financeiro: entradas e saídas avulsas por mês | `SEM_BASE` com valor nulo nos meses anteriores a `consultoria.criado_em` (não há dado parcial: não há base); `FILTRO_INCOMPATIVEL` no "Meus" | `desde` = `consultoria.criado_em` (já usado no código: `FinanceiroService.mesDaCriacao`) | — |
| Financeiro: `resultado` do mês e `resultadoDoMes` | `SEM_BASE` com `resultado` nulo, na série, quando entrada ou saída é nula e há `recebido` (mês anterior à criação); nulo em vez de somar com `nz` | motivo e `desde` = `consultoria.criado_em` | — |
| Financeiro: `recebido`, `aReceber`, atrasadas, `receitaRecorrente` | Proposta: `COMPLETA` desde a criação da consultoria, com consulta concluída e vazia valendo **0**, não nulo (hoje o `sum` JPQL devolve nulo). Base (revisão de 13/11): cobrança paga não sai por retenção (só os avisos saem, depois de 180 dias) e, com o módulo desligado, as rotas dão 503 e nada é gravado nem apagado. Depende de separar "sem linha" de "sem dado" e de D6 | decisão de modelagem, a aprovar com o contrato | Nada fica `DESCONHECIDA` aqui sem um motivo definido; se o Gustavo não aprovar a base acima, o motivo candidato é `RECURSO_DESLIGADO` (pergunta aberta 2) |
| Financeiro: movimento de alunos | sem alegação (0 por mês desde a criação é verdadeiro) | nada | Antes da criação da consultoria destoa das entradas; alinhar ao `desde` |
| Painel/Números: contagens por permissão | não precisa de `cobertura`: o nulo já é o contrato (D3) | nada | — |
| Painel: `sessoesConcluidas7Dias` com retorno desligado | nulo hoje; o motivo `RECURSO_DESLIGADO` não está na lista, decidir | pergunta aberta 2 | — |
| Execuções (`sem registro`, recordes) | sem alegação (nenhum job apaga `execucao_serie`) | nada | — |

Fora desta rodada: criar o campo `cobertura`, os tipos do app e as telas que o leem; o texto "motivo por indicador" nas telas; separar "consulta vazia" de "sem dado" no Financeiro (`recebido`, `aReceber`, `receitaRecorrente`: hoje nulos onde o certo é 0); trocar o `nz` do `resultado`; alinhar o movimento de alunos com a criação; as duas listas (`ultimasExecucoes`, `planosTerminando`) que ficam vazias sem permissão; `GET /financeiro/cobrancas`, `/visao-geral` e demais rotas (não verificado).

Perguntas abertas (fora do alcance desta rodada):
1. A anonimização apaga a inscrição aceita (e os eventos) sem deixar rastro: o contrato deve declarar isso como limite fixo ("indicadores não contam quem foi anonimizado") ou fica fora por LGPD? Responsável: Gustavo.
2. `RECURSO_DESLIGADO` vira um sexto motivo ou entra em `FILTRO_INCOMPATIVEL`? Responsável: Gustavo.

## Passos
- [x] 1. Mapa e tabela por indicador (este arquivo) — responsável: executor — commit: — (local, sem commit)
- [x] 2. Correção mínima da API: as quatro contagens de atualização do `/painel` nulas sem permissão; teste novo; `ArquiteturaTest` verde — responsável: executor — commit: — (local, sem commit)
- [x] 3. Revisão independente (`revisor`) da correção e da tabela — responsável: sessão principal — evidência: sem bloqueante; ajustes na tabela aplicados em 13/11 (D7); `git diff` e `mvn` não rodados por ele
- [ ] 4. Frente B aplica a mudança do app (tipos, "Sem permissão", "Tudo em dia" sem base, comentário de `painelDoInicio.ts:96`, e2e) — responsável: executor-front — commit: —
- [ ] 5. Decisões do Gustavo: D6 (`somaOuZero`), pergunta 1 (anonimização), pergunta 2 (`RECURSO_DESLIGADO`) e aprovação do contrato `cobertura`; só então plano de implementação (API, tipos, telas) — responsável: Gustavo — commit: —

## Fora do escopo
- Qualquer indicador além das quatro contagens do `/painel`; qualquer mudança de `/numeros`, `/financeiro/painel` ou `/inscricoes/indicadores`.
- Código do contrato `cobertura`, migration, endpoint novo.
- Arquivos do app (`painelDoInicio.ts`, `index.tsx`, `treinador/painel/*` são da frente B).

## O que ficou para trás
- Não verificado: `GET /financeiro/visao-geral` ignora o responsável e devolve primitivos (`FinanceiroService.java:270-295`); se a tela o mostra com "Meus" ligado, é candidato a `FILTRO_INCOMPATIVEL`. `GET /financeiro/cobrancas` segue não verificado.
- Teste opcional: incluir as quatro contagens no laço da outra consultoria (consultoria sem aluno ativo) em `PainelContagensIntegrationTest.java:191`.
- Cobertura e retenção dos indicadores além das quatro contagens (D5): `resultado` e `nz` do Financeiro, recebido/a receber/receita recorrente, Interessados com retenção de 180 dias, e os "não verificados" da tabela.
- Passos 3 a 5 acima; cada sobra vai também para "Pendências soltas" no README com a origem "nulo-e-cobertura".
