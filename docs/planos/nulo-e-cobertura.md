# Nulo, zero e cobertura: o que cada indicador sabe dizer

**Frente entregue: "Correção das quatro contagens sem permissão"** (commit `765335a5`). Cobertura (Financeiro, Interessados) e os demais indicadores são **pendências separadas**, listadas em "O que ficou para trás".

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
| D6 | **Decidida em 13/11 e esclarecida no mesmo dia.** O problema é converter ausência **ambígua** em zero, não usar zero para soma vazia válida. (a) Consulta válida sem registro aplicável = 0 (R$ 0,00 é o certo). (b) Falha ou falta de permissão nunca é zero. (c) Histórico removido, ou cálculo com componente indisponível, exige tratamento específico, sem virar zero em silêncio. (d) Cobrança ainda não gerada não entra no previsto, e previsto e atraso seguem descritos como "das cobranças já geradas". Registro manual não invalida a soma dos registros existentes. Não trocar todo `SUM` vazio nem todo zero por nulo. O app (`somaOuZero`) **não muda** nesta rodada: ele já lê como 0 o que é 0 certo; quem passa a dizer 0 é a API | Decidida | Gustavo, 13/11 |
| D8 | **Decidida em 13/11: o Financeiro não adota `COMPLETA` nem afirma cobertura desde a criação.** Os indicadores representam **os registros disponíveis no sistema**. Zero confirmado = consulta concluída sem registro aplicável, sem condição conhecida de indisponibilidade que invalide essa leitura. A evidência está na seção própria abaixo | Decidida | Gustavo, 13/11 |
| D9 | **"Tudo em dia"** (Início do treinador) só aparece quando as fontes necessárias foram consultadas com sucesso e não apontaram pendência. Sem acesso a nenhuma fonte: "Você não tem acesso aos dados deste resumo". Verificação parcial (alguma fonte sem acesso ou que falhou): informar que não foi possível conferir tudo | Decidida | Gustavo, 13/11 |
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
5. **"Tudo em dia"** (D9; revisão, I5): `proximoPassoDoInicio` devolve `null` quando todas as entradas são nulas (`app/src/dominio/inicioTreinador.ts:31-42`) e a tela mostra `TUDO_EM_DIA` (`index.tsx:75,209`). Passa a ter três saídas: todas as fontes consultadas com sucesso e sem pendência = "Nada pede sua atenção agora"; nenhuma fonte acessível = "Você não tem acesso aos dados deste resumo"; verificação parcial (falha ou sem acesso a parte) = aviso de que não foi possível conferir tudo. Os cartões com nulo sem leitura segura mostram "—" com "Dados indisponíveis para este período" (D6).
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
| Financeiro: `recebido`, `aReceber`, atrasadas, `receitaRecorrente` | **Sem alegação até a evidência (D8).** Hipótese a provar: `COMPLETA` desde a criação, com consulta concluída e vazia valendo **0** (hoje o `sum` JPQL devolve nulo e o app o soma como 0: contrato a corrigir, D6) | decisão de modelagem depois da evidência | Se a evidência não sustentar, o motivo candidato é `RECURSO_DESLIGADO` (pergunta aberta 2) |
| Financeiro: movimento de alunos | sem alegação (0 por mês desde a criação é verdadeiro) | nada | Antes da criação da consultoria destoa das entradas; alinhar ao `desde` |
| Painel/Números: contagens por permissão | não precisa de `cobertura`: o nulo já é o contrato (D3) | nada | — |
| Painel: `sessoesConcluidas7Dias` com retorno desligado | nulo hoje; o motivo `RECURSO_DESLIGADO` não está na lista, decidir | pergunta aberta 2 | — |
| Execuções (`sem registro`, recordes) | sem alegação (nenhum job apaga `execucao_serie`) | nada | — |

Fora desta rodada: criar o campo `cobertura`, os tipos do app e as telas que o leem; o texto "motivo por indicador" nas telas; separar "consulta vazia" de "sem dado" no Financeiro (`recebido`, `aReceber`, `receitaRecorrente`: hoje nulos onde o certo é 0); trocar o `nz` do `resultado`; alinhar o movimento de alunos com a criação; as duas listas (`ultimasExecucoes`, `planosTerminando`) que ficam vazias sem permissão; `GET /financeiro/cobrancas`, `/visao-geral` e demais rotas (não verificado).

Perguntas abertas (fora do alcance desta rodada):
1. A anonimização apaga a inscrição aceita (e os eventos) sem deixar rastro: o contrato deve declarar isso como limite fixo ("indicadores não contam quem foi anonimizado") ou fica fora por LGPD? Responsável: Gustavo.
2. `RECURSO_DESLIGADO` vira um sexto motivo ou entra em `FILTRO_INCOMPATIVEL`? Responsável: Gustavo.

## Evidência da cobertura do Financeiro (D8; mapa de leitura de 13/11, sem executar build nem testes)
**Nada nesta seção é aprovação de `COMPLETA`.** Fatos, com caminho:linha (`api/.../pagamentos/` salvo indicação):
- Nenhuma rotina apaga cobrança nem contratação: não há `@Scheduled` que as remova; a retenção só apaga avisos APLICADO, IGNORADO e CONFERIDO após 180 dias (`AvisoDePagamentoRepositorio.java:239-242`), e o painel não lê `aviso_de_pagamento`. Retenção de `lembrete_cobranca`: não achei.
- Saída do aluno (inativar, anonimizar, excluir a conta): contratação ENCERRADA e cobrança ABERTA vira CANCELADA, a PAGA não muda (`PagamentosDoAluno.java:81-88`); a anonimização só limpa texto e link (`:98-104`). O painel **não filtra** aluno inativo nem anonimizado (`CobrancaAlunoRepository.java:181-227`): as pagas dele seguem em `recebido`.
- Situações: `recebido` = só PAGA; `aReceber` e atrasadas = só ABERTA; CANCELADA fica fora de tudo; ESTORNADA e CONTESTADA ficam fora do recebido e **entram** no denominador da inadimplência (`CobrancaAlunoRepository.java:187-190`, `situacao <> CANCELADA`); `receitaRecorrente` só lê contratação ATIVA não parcela única (`ContratacaoAlunoRepository.java:43-48`).
- **Não há agendador de cobranças** (`GeradorDeCobrancas.java:11,35`; comentário `FinanceiroService.java:45`): `aReceber`, previsto e atrasadas contam só o que já foi gerado; uma contratação com cobrança aberta vencida não gera a próxima até baixa ou cancelamento.
- Datas: a baixa manual aceita de 2000-01-01 até hoje (`CobrancaService.java:41,176`); o lançamento avulso, de hoje − 10 anos até hoje + 1 ano (`LancamentoService.java:102`). Só entradas e saídas **avulsas** são cortadas em mês anterior à criação (`FinanceiroService.java:166-184`); as séries de recebido e previsto **não** são (`:186-216`).
- Lançamento avulso é apagado fisicamente pelo treinador (`LancamentoService.java:90-95`, com auditoria): edição do dado, não retenção.
- Módulo desligado: rotas dão 503 e a conciliação sai cedo (`ConciliadorInfinitePay.java:62-74`); `encerrarPorSaida` e `apagarDoAluno` rodam sempre. Guarda do job de lembretes no corpo: não conferido.
- V059 (05/11) apagou cobranças, contratações, lembretes e avisos da consultoria do Saraiva e mantém lançamentos e planos (`V059__limpeza_da_producao.java:63`); a de teste do Gustavo foi apagada inteira (`:70-77`). Evento único e já executado, mas o Financeiro dessa consultoria **não tem histórico anterior** a ele.
- Não conferido: `PAUSADA` no enum, corpo de `ExclusaoDeContaService`, guarda de flag em `LembretesDeCobranca`, se a V059 já rodou em produção e quando.

**O que a evidência sustenta:** o sistema só conhece o que foi **registrado** (baixa manual, lançamento, link pago); `recebido` não perde cobrança paga por retenção, exclusão de aluno ou módulo desligado. Logo, "0 = nenhum pagamento **registrado** no período" é verdadeiro quando a consulta conclui; isso não é "cobertura completa do dinheiro que entrou".
**O que impede `COMPLETA`:** o dado depende de registro manual do treinador; o lançamento avulso pode ser apagado; as séries aceitam data anterior à criação (então "desde a criação" não é o limite do `recebido`); o previsto e as atrasadas dependem de cobranças que só existem depois de uma ação; a V059 truncou o histórico do Saraiva.
**Recomendação (a decidir pelo Gustavo, D8):** não adotar `COMPLETA`; contrato sem alegação de cobertura para o Financeiro, com o significado escrito: valor `0` = consulta concluída sem registro aplicável, nulo = sem permissão, falha ou sem base (D6). Isso exige corrigir o servidor onde ele já converte ausência em zero (`nz` do `resultado` na série; `sum` vazio que vem nulo em `recebido`, `aReceber` e `receitaRecorrente`), para o app deixar de adivinhar (`somaOuZero`).

## Correção pontual da API do Financeiro (PLANO; nada implementado)
Fonte: inventário de 13/11 (`explorador`) **conferido por mim linha a linha** em `FinanceiroService.java:77-359` e nos repositórios (`CobrancaAlunoRepository.java:181-227`, `LancamentoFinanceiroRepository.java:48-51`, `ContratacaoAlunoRepository.java:43-59`). Estado: local, base `1c629a8c`, sem commit desta correção. Vale até o código dessas linhas mudar.

### Regra aplicada (D6 esclarecida)
Quatro classes: **(a)** conjunto vazio válido → **0**; **(b)** dado indisponível (futuro, "Meus" sem lançamento avulso, antes da criação, líquido sem taxa, média sem base) → **nulo**, como já é; **(c)** histórico removido (V059) → tratamento próprio, abaixo; **(d)** cálculo com componente ausente → **nulo**, nunca soma com zero.
Não se troca `SUM` vazio nem zero em bloco: cada ponto abaixo tem a sua classe e a sua decisão.

### Cada `nz` (há um só) e cada soma composta
| Ponto | Hoje | Classe | Decisão |
| --- | --- | --- | --- |
| `nz` em `resultado()` (`:330-339`), usada em `serie` (`:213`) e em `resultadoDoMes` (`:263-264`) | `recebido + entradas − saídas` tratando nulo como 0, só nulo se os três são nulos | **(d)** | `resultado` passa a ser nulo se **qualquer** componente é nulo; `nz` sai. Os casos reais: mês anterior à `consultoria.criado_em` com baixa retroativa (entrada e saída nulas, `recebido` presente: hoje o resultado sai como se fosse completo) e mês futuro. Com `recebido` corrigido para 0 no mês válido (abaixo), nenhum mês válido perde o resultado. "Meus" já devolve nulo direto (`:213`, `:252`) e não muda |
| `valorMedioPorAlunoCentavos` (`:138`, recebido ÷ pagantes) | nulo se recebido nulo, pagantes nulo ou 0 | **(d)** média sem base | **Deixar**: com 0 pagantes a média não existe; o nulo é o "—" certo (D1) |
| `inadimplencia.percentual` (`:218-225`, vencido ÷ cobrado) | nulo se cobrado nulo ou 0; `vencido` nulo vira 0 só quando há cobrado | **(d)** conversão sem base | Percentual **deixar** (sem base é nulo). `vencido` e `cobrado` passam a 0 quando a consulta rodou e não há registro (ver abaixo) |
| `Numeros.inadimplenciaPercentual` (`:94-104`) | nulo se `ate<de` ou nenhuma cobrança cobrada | **(d)** | **Deixar** (sem base) |
| `receitaRecorrente` (`:315-327`) | nulo se não há contratação ATIVA recorrente | **(a)** | Passa a **0** (soma vazia válida) |
| `Liquido.brutoCentavos` (`:157-158`) | herda `recebidoTotal` | — | Herda o 0 corrigido; `disponivel=false` e o motivo não mudam |

### Cada soma, uma a uma (campo × situação × hoje × decisão)
| Campo (DTO) | Linha | Situação | Hoje | Classe | Decisão |
| --- | --- | --- | --- | --- | --- |
| `Cartoes.recebidoCentavos` | `:127-128` | período com início ≤ hoje, sem pagamento | nulo (`SUM` vazio) | (a) | **0** |
| idem | `:127` | período inteiro no futuro | nulo | (b) | **Deixar** nulo |
| `Cartoes.aReceberCentavos` | `:130-131` | consulta rodou, sem aberta | nulo | (a) | **0** |
| idem | `:130` | período inteiro já passado (`aVencerDe>fim`) | nulo | (b) | **Deixar** nulo |
| `emAtraso.valorCentavos` | `:134,142` | consulta rodou, sem atrasada | nulo | (a) | **0** (quantidade já é 0) |
| idem | `:133` | nada pode estar vencido (período todo no futuro, ou só hoje) | nulo | (b) | **Deixar** nulo (o app já usa o 0 da quantidade como confirmação: registrado para ninguém "corrigir") |
| `Cartoes.alunosPagantes` | `:136-137` | recebido consultado, 0 pagantes | nulo | (a) contagem | **0** |
| `Cartoes.receitaRecorrenteMensalCentavos` | `:144,315` | sem contratação recorrente ativa | nulo | (a) | **0** |
| `inadimplencia.cobradoCentavos` e `vencidoCentavos` | `:219-224` | consulta rodou, nada cobrado ou vencido | nulo / 0 misto | (a) | **0** nos dois; percentual segue nulo sem base |
| idem | `:133,135` | `haAtraso=false` | nulo | (b) | **Deixar** nulo |
| `proximosRecebimentos.em7Dias/em30Dias.valorCentavos` | `:244-247` | sem aberta na janela | nulo (`SUM` vazio) com `cobrancas=0` | (a) | **0** |
| `serie[].recebidoCentavos` | `:206` | mês até o corrente, sem pagamento | nulo | (a) | **0** |
| idem | `:206` | mês depois do corrente | nulo | (b) | **Deixar** nulo |
| `serie[].previstoCentavos` | `:212` | mês corrente ou futuro, sem aberta | nulo | (a) | **0** |
| idem | `:212` | mês já encerrado | nulo | (b) por regra (o que venceu aparece em atraso) | **Deixar** nulo |
| `serie[].entradasAvulsasCentavos` e `saidas...` | `:177-184,209-210` | mês dentro da cobertura sem lançamento | 0 | (a) | **Já certo** |
| idem | `:183,209` | antes da criação, futuro ou "Meus" | nulo | (b) | **Deixar** |
| `resultadoDoMes.recebidoCentavos` | `:250` | mês corrente, sem pagamento | nulo | (a) | **0** |
| `inadimplentes.valorTotalCentavos` | `:308` | sem cobrança vencida | nulo | (a) | **0** (itens e total já são 0 e lista vazia) |
| `Numeros.meses[].recebidoCentavos` | `:84-87` | mês do intervalo (termina no corrente), sem pagamento | nulo | (a) | **0** |
| `Numeros.previstoCentavos` | `:89` | sem aberta de hoje em diante | nulo | (a) | **0** |
| `Numeros.receitaRecorrenteMensalCentavos` | `:90-91,315` | sem recorrente | nulo | (a) | **0** (mesma função) |
| `movimentoDeAlunos[]` (`novas`, `encerradas`) | `:230-235` | mês sem contratação criada ou encerrada | 0 | (a) | **Já certo**. Mês futuro também dá 0 (nada aconteceu ainda): **registrado, não alterado**. Mês de histórico removido: ver V059 |
| `porForma`, `porPlano`, `inadimplentes.itens`, `visaoGeral` | `:148-151,305,272-294` | vazio | lista vazia ou 0 | (a) | **Já certo**; `visaoGeral` não filtra por "Meus" (pergunta aberta abaixo) |
| `Liquido` | `:157` | sempre | `disponivel=false` | (b) | **Deixar** |

Nenhum campo vira nulo por esta correção; **o único trecho que passa de número para nulo é o `resultado` (d)**, e só onde hoje ele soma ausência como zero. Nenhum nulo de falha ou de permissão existe nessas rotas (a recusa é 403 pelo `@PreAuthorize` e o módulo desligado é 503 `FINANCEIRO_INDISPONIVEL`: não verificado em execução, vem das anotações).

### Cobranças ainda não geradas (limitação explícita)
Não há agendador de cobranças (`GeradorDeCobrancas.java:11,35`; comentário em `FinanceiroService.java:45`): `aReceber`, previsto e atraso contam só o que já foi gerado. **Isso não muda.** O texto na tela já diz "considera as cobranças já geradas" (`app/src/dominio/financeiro.ts:33,57`, legenda "Previsto (cobranças já geradas)" em `app/src/ui/GraficoBarras.tsx:65`, ajuda em `app/src/ajuda/conteudo.ts:357`). O executor do app confere se a tela e o cartão do Início também dizem isso e só acrescenta o que faltar.

### V059 (05/11): o que foi afetado e como informar
- **O que apagou** (`V059__limpeza_da_producao.java:36-153`): na consultoria do **Saraiva**, `cobranca_aluno`, `contratacao_aluno`, `aviso_de_pagamento` e `lembrete_cobranca` (e o resto do conteúdo, como os alunos). Manteve `lancamento_financeiro`, `plano_comercial`, `credencial_pagamento` e `lembrete_configuracao`. A consultoria de teste do Gustavo foi apagada inteira (sem tela para ninguém ler). As demais não foram tocadas.
- **Indicadores afetados (só a consultoria do Saraiva):** tudo o que lê cobrança ou contratação para datas **anteriores à limpeza**: `recebido`, previsto (já fica nulo em mês encerrado), `aReceber`, atraso, inadimplência, `receitaRecorrente`, `alunosPagantes`, valor médio, `porForma`, `porPlano`, `movimentoDeAlunos`, `Numeros` inteiro e `inadimplentes`. **O resultado de meses anteriores à limpeza mostra só os lançamentos avulsos** (preservados), sem `recebido`, e parece completo (classes (c) e (d)).
- **Período:** do começo do uso do Financeiro até a data em que a V059 rodou **em produção**. Essa data **não foi confirmada**: o código só grava um log (`:86-87`), e o `flyway_schema_history` está fechado ao papel do app (`afterMigrate__revogar_historico_do_app.sql`). Também não sei se o Financeiro estava ligado para ele antes de 05/11 nem se havia cobrança real (não consultei o banco).
- **Proposta (a decidir):**
  - **A (recomendada, sem código novo de dado):** manter D8 como está, "os indicadores representam os registros disponíveis", e **dizer isso em texto fixo na tela do Financeiro** ("Os valores consideram os registros disponíveis no sistema; cobranças ainda não geradas não entram."), junto da nota "cobranças já geradas" que já existe. A V059 fica documentada aqui como evento único. É verdadeira para todas as consultorias e não promete cobertura.
  - **B (só se o histórico anterior importar):** uma coluna `consultoria.financeiro_historico_desde` (data, nula = sem corte conhecido), gravada por **uma migration nova** só para a consultoria do Saraiva (por id, como a V059) com a data real da limpeza em produção; a API a devolve no painel e a tela mostra "Histórico do Financeiro anterior a DD/MM/AAAA foi removido" e passa a tratar os meses anteriores com `resultado` nulo. Exige: a data real, saber se havia uso, nova migration (total 73) e tela. **Não recomendo agora**: o Saraiva ainda não usa o Financeiro e o Gustavo reseta o banco dele, então o histórico removido não tem consumidor.
  - Em qualquer caso o **código** desta correção não depende da escolha: ela só mexe no que a API devolve para consulta válida e no `resultado`.

### Decisões de 13/11 sobre a aprovação e a V059
- **Implementação aprovada** (Gustavo, 13/11): zero para consulta válida e vazia; `resultado` nulo quando algum componente necessário está indisponível, **com motivo compreensível no app**; conferir gráficos, totais e exportações que consomem o campo (a exportação CSV da API não lê `resultado`: conferido por busca em `api/src/main`; os consumidores no app são `treinador/financeiro/ResultadoDoMes.tsx`, a série em `VisaoGeral` e `AbaLancamentos.tsx`, via `dominio/financeiro.ts`).
- **V059: sem migration de data de corte por enquanto.** Mantém-se o texto geral (registros disponíveis; cobranças já geradas) e, **para a consultoria afetada**, a ressalva: "Parte do histórico financeiro foi removida em uma limpeza anterior. Os valores exibidos consideram os registros preservados e podem não representar todo o movimento dos períodos afetados." **Não inventar a data** nem tratar o histórico como irrelevante por suposição de que não havia uso real; a data não confirmada continua registrada, e o aviso não torna os dados completos.
- **Mecanismo para direcionar o aviso: não existe** (busca em 13/11): `Consultoria` não tem campo para isso, `direitos_locais` é do plano comercial e `lembrete_configuracao`/`inscricao_configuracao`/`comunidade_configuracao` são de outras funções; o id do Saraiva só aparece em `V059__limpeza_da_producao.java` (e num doc). **Solução mínima APROVADA em 13/11 e em implementação** (número confirmado: V072 é a da Comunidade, a próxima é a V073; a coluna sai em `Painel` e `Numeros`, informativa: não altera valores, fórmulas nem permissões e não declara períodos completos; a V059 não muda): uma coluna `consultoria.historico_financeiro_parcial boolean not null default false` numa migration nova (V073) que a liga só para essa consultoria reaproveitando o id e a conferência que a V059 já tem (o id continua em um lugar só, na migration); a API devolve o booleano no painel; o app mostra a ressalva quando verdadeiro. Sem data, sem período, sem nome no código de tela.

### O que o app muda (já em execução pelo executor do app, não aqui)
Nada de `somaOuZero` nem de `resultado`. Tipos, "Sem permissão" e D9 seguem o plano dele. Quando a API passar a devolver 0, o app já mostra R$ 0,00; os pontos em que o app trata `null` do `recebidoCentavos` por mês (gráfico de barras, `Numeros`) precisam do e2e conferir que **0 vira barra zerada com valor "R$ 0,00" e não "sem dado"**.

### Testes exigidos da correção
Por campo da tabela marcado **0** ou **Já certo**: um caso de consulta válida e vazia devolvendo 0 (período passado, corrente e misto); por campo **Deixar nulo**: o caso (b) continua nulo (período futuro, "Meus", antes da criação); `resultado`: mês antes da criação com baixa retroativa e entrada e saída nulas → **nulo**, mês válido sem lançamento → número, mês futuro → nulo, "Meus" → nulo; `valorMedio` e `percentual` sem base → nulos; registro manual (baixa) numa consultoria com cobranças geradas não zera a soma dos existentes. Consultoria **sem** nenhuma cobrança: painel e `/numeros` com 0 nos cartões (não nulo). Isolamento: o 0 de uma consultoria não vem de outra. `mvn verify` completo (Maven um por vez, depois que a API da Comunidade terminar).

### Perguntas que continuam abertas
1. ~~`GET /financeiro/visao-geral` ignora "Meus"~~ **Resolvida em 13/11 (só leitura, sem furo):** `FinanceiroController.java:57-59` e `VisaoGeral.tsx:53-58,124-125` só buscam e mostram a visão geral com `!meus` (com "Meus" ligado ela nem aparece), então nenhum número da consultoria inteira é exibido como "meu". `GET /financeiro/cobrancas` também confere: o controller passa `meus ? eu.usuarioId() : null` a `CobrancaService.listar` (`CobrancaController.java:53-69`, `CobrancaService.java:86-133`), o repositório filtra `responsavelId` (`CobrancaAlunoRepository`) e a aba manda `meus` (`AbaCobrancas.tsx:313`).
2. `movimentoDeAlunos` de meses futuros devolve 0: aceito por ora.
3. ~~V059: escolher A ou B~~ **Resolvida em 13/11:** vale a ressalva por consultoria da V073 (`historico_financeiro_parcial`, só informativa; ver "Decisões de 13/11"). A data em que a V059 rodou em produção continua não confirmada e o aviso não declara período completo; conferir a coluna em produção com `claude_leitura` depois do deploy.

## Passos
- [x] 1. Mapa e tabela por indicador (este arquivo) — responsável: executor — commit: — (local, sem commit)
- [x] 2. Correção mínima da API: as quatro contagens de atualização do `/painel` nulas sem permissão; teste novo; `ArquiteturaTest` verde — responsável: executor — commit: — (local, sem commit)
- [x] 3. Revisão independente (`revisor`) da correção e da tabela — responsável: sessão principal — evidência: sem bloqueante; ajustes na tabela aplicados em 13/11 (D7); `git diff` e `mvn` não rodados por ele
- [x] 4. Frente B aplica a mudança do app (tipos, "Sem permissão", "Tudo em dia" sem base, comentário de `painelDoInicio.ts:96`, e2e) — responsável: executor-front — commits: `8819fd65`, `e0eb0eb7`, `a9a61a12` (13/11; ressalva do histórico parcial em todas as abas do Financeiro, "Recurso desativado" distinto de zero, falha e sem permissão; evidências em `scratchpad\final-13-11\financeiro\`, fora do repositório)
- [ ] 4b. Correção pontual da API do Financeiro (seção própria acima: 0 onde a consulta é válida e vazia, `resultado` nulo com componente ausente, `nz` removido) — responsável: executor — evidência: —; começa depois da API da Comunidade (Maven um por vez) e passa por `revisor`
- [ ] 5. Perguntas abertas de nulo, **registradas separadamente** (Gustavo, 13/11); cada uma continua pendência enquanto não for resolvida:
  - **5a. Anonimização/remoção:** esclarecer quais contagens históricas (atualizações, alunos ativos, atrasadas, financeiro) são afetadas por anonimizar ou remover um aluno e como a tela deve dizer isso. **Não mudar a retenção** nesta frente.
  - **5b. Recurso desligado:** mostrar "Recurso desativado" (distinto de zero, de falha e de sem permissão) onde o estado for conhecido. Feito nas telas do Financeiro que recebem o 503 `FINANCEIRO_INDISPONIVEL`/`RECEBIMENTO_ONLINE_INDISPONIVEL`; **resta** o Início, onde `pagamentosHabilitados=false` esconde os blocos pela regra "recurso que não existe não aparece" (mudar isso é decisão do Gustavo).
  - **5c. Cobertura:** manter as limitações documentadas em "Evidência da cobertura do Financeiro" e **não emitir `COMPLETA` sem evidência**; o contrato `cobertura` segue sem aprovação.

## Fora do escopo
Atualizado em 13/11 (o que antes estava aqui contradizia a V073 e as mudanças do Financeiro, já feitas e aprovadas):
- Código do contrato `cobertura` (segue sem aprovação) e endpoint novo; `COMPLETA` nunca é emitida sem evidência.
- Mudar a retenção ou a anonimização (5a só esclarece contagens afetadas).
- Pagamento parcial, pagador separado e mudança na geração das cobranças.
- Fazem parte do que foi feito, **não** são mais "fora do escopo": a migration V073 (`historico_financeiro_parcial`, só informativa), a correção dos zeros e do `resultado` nulo em `/financeiro/painel` e `/numeros` (4b), a ressalva e o "Recurso desativado" no app do Financeiro (passo 4) e a coluna `historico_financeiro_parcial` no fim do CSV da exportação.

## O que ficou para trás
- Resolvido em 13/11 (só leitura): `GET /financeiro/visao-geral` e `GET /financeiro/cobrancas` com "Meus" estão coerentes (ver pergunta aberta 1).
- Teste opcional: incluir as quatro contagens no laço da outra consultoria (consultoria sem aluno ativo) em `PainelContagensIntegrationTest.java:191`.
- Cobertura e retenção dos indicadores além das quatro contagens (D5): `resultado` e `nz` do Financeiro, recebido/a receber/receita recorrente, Interessados com retenção de 180 dias, e os "não verificados" da tabela.
- Passos 3 a 5 acima; cada sobra vai também para "Pendências soltas" no README com a origem "nulo-e-cobertura".
