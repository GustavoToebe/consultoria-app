# Engajamento: retorno imediato, conquistas e mural

Situação: Etapa 0 feita na branch (0.1 a 0.6); falta o portão (linha de base com os 5 alunos e 2 semanas ligada) · Onde: branch `gamificacao` (worktree `../consultoria-gamificacao`) · Atualizado: 28/10/2026

Explicação completa (opinião sobre a proposta, princípios, onde fica no app): documento "Consultoria: engajamento,
conquistas e comunidade" no Claude (https://claude.ai/artifact/7NuC2i7ycFBvpYSZok3fCT). **Este arquivo é a fonte do status.**

## Objetivo
O aluno sentir o próprio progresso e o acompanhamento do treinador, para seguir o plano e renovar a pasta. Recompensar
constância e esforço feito; nunca corpo, dieta restritiva ou tempo de uso.

## Regras da frente
- Tudo atrás de `TREINOS_RETORNO_HABILITADO` (padrão false). Nada vai para a `main` sem aprovação do Gustavo.
- Branch com merge da `main` antes de cada passo (nunca rebase). Migration da branch é renumerada se a `main` ganhar outra.
- Passa-se de etapa só pelo portão.

## Decisões (provisórias da Etapa 0)
| # | Decisão | Valor |
| --- | --- | --- |
| P1 | Treino cumprido | "Concluir treino" declarado pelo aluno; o app sugere "Fiz tudo" (todas as séries marcadas) ou "Fiz em parte" |
| P2 | Desfazer | "Reabrir treino" = mesmo registro com concluida=false |
| P3 | Recorde pessoal | Três tipos, só em série simples (sem cluster, rest-pause nem etapas): maior carga no exercício, mais repetições com a mesma carga e maior volume da série (carga × repetições). Primeiro registro do exercício não conta. O aluno vê; o treinador vê os da semana |
| P4 | Reação do treinador | Uma só, "Visto", sem texto; permissão `REGISTRO_REAGIR` |
| P5 | Semana completa | Conta do "Sua semana"; plano sem dia fixo não comemora |
| P6 | Chave | `TREINOS_RETORNO_HABILITADO`, 503 `RETORNO_INDISPONIVEL` desligada |
| P7 | 1RM estimado | Não entra: a metodologia do Saraiva não usa 1RM (o % é da WS) e seria uma conta nova. Só se o Saraiva pedir |
| P8 | Cartão para compartilhar | Calendário do mês com os dias treinados, nº do treino e a marca da consultoria. Sem peso corporal, foto, medidas ou dieta; volume só se o aluno ligar |
| P9 | Duração | Começa na primeira série marcada e termina no "Concluir treino"; abaixo de 10 min o app pergunta se quer ajustar |
| P10 | Recordes sem internet | A lista de recordes de cada exercício do plano vem junto do pacote do aluno, então o aviso aparece offline; o servidor confirma depois |

## Decisões abertas
- [ ] Plano sem dia fixo: "treinos por semana" na pasta? (Etapa 1)
- [ ] Copo de 250 ml no Registro do dia? (Etapa 1)
- [ ] Medalhas e nomes (Etapa 2)
- [ ] O Saraiva modera um mural? (Etapa 3)
- [ ] Comunidade como adicional pago na Central? (Etapa 3)
- [ ] Temporada e empate dos desafios (Etapa 4)
- [ ] Push do servidor: serviço e avisos (antes da Etapa 3)

## Etapas e passos
Portões: 0→1 linha de base dos 5 alunos com a chave desligada e 2 semanas com a Etapa 0 ligada · 1→2 registros
confiáveis e números comparados · 2→3 moderação, push e adicional decididos · 3→4 mural em uso e moderação sustentável ·
4→5 só se 3 e 4 provarem valor.

- [x] 0.1 Chave e "Concluir treino": botão no topo e no rodapé da tela do dia, duração (P9), "Como foi seu treino?" opcional (até 300, sensível, o treinador vê) — API V035, fila offline — commit: `5de8d16` (branch `gamificacao`, 28/10/2026; `mvn verify` 1419 testes, app 2143 testes depois do merge da `main`, e2e `concluir-treino` 8/8; falta só a tela do treinador, que é o 0.5). Ajuste de 28/10 (chave desligada no meio do uso, padrão do ciclo, `f6f4749`): com o merge da `main` (`4a2f883`, que trouxe "Meus dados do aluno") `mvn verify` 1434 testes, app 2181 testes em 159 suítes, e2e 218 passando (inclui o caso do 503 em `concluir-treino`)
- [x] 0.2 Recordes pessoais (P3, P10): baixados com o pacote, aviso no topo na hora em que a série é marcada (miniatura do exercício, "Maior carga · 70 kg"), medalha no lugar do número da série, contagem no resumo — commit: `4564f1c` (branch `gamificacao`, 28/10/2026, sem migration). Verificado aqui: app `typecheck` e `lint` limpos, `jest` 2205 testes em 161 suítes; API `compile`, `test-compile` e `ArquiteturaTest` (16) + `RecordesPessoaisTest` (6) verdes. **Não rodou aqui:** `mvn verify` (sem Docker: `RecordesNoPacoteIntegrationTest` e o caso novo do `RetornoDesligadoIntegrationTest` só foram compilados). E2E rodado depois pelo coordenador com `node_modules` próprio e cache do Metro isolado: `concluir-treino` + `recordes-pessoais` 13/13
- [x] 0.3 Treino ao vivo: faixa no topo com duração, volume e séries feitas; coluna "Anterior" por série (a mesma série da última vez: "40 kg × 10") — commit: `2cd5e48` (branch `gamificacao`, 28/10/2026, sem migration). Verificado aqui: app `typecheck` e `lint` limpos, `jest` 2219 testes em 163 suítes; e2e `treino-ao-vivo` + `recordes-pessoais` + `concluir-treino` + `exercicio-aluno` 19/19; API `compile`, `test-compile` e `ArquiteturaTest` (16) + `SeriesAnterioresTest` (4) + `RecordesPessoaisTest` (6) verdes. **Não rodou aqui:** `mvn verify` (sem Docker: `AnterioresNoPacoteIntegrationTest` e a linha nova do `RetornoDesligadoIntegrationTest` só foram compilados)
- [x] 0.4 Tela "Bom trabalho!": "Este é o seu 12º treino", resumo, recordes do dia e o cartão para compartilhar (P8: Stories, baixar, compartilhar) — commit: `41e2fa2` (branch `gamificacao`, 28/10/2026, só app, sem migration). Verificado aqui: `typecheck` e `lint` limpos, `jest` 2223 testes em 164 suítes; e2e `bom-trabalho` + `concluir-treino` 13/13 (o PNG baixado conferido: assinatura e 1080 × 1920; capturas a 390 px da tela e do cartão vistas). **Não verificado:** a imagem no celular (`toDataURL` do `react-native-svg` + compartilhar do sistema) e a logo dentro do cartão (o e2e não tem logo)
- [x] 0.5 Treinador: reação "Visto" (V036, `REGISTRO_REAGIR`) e "Recordes da semana" no Início e na ficha — commit: `566cb1f` (branch `gamificacao`, 28/10/2026). Verificado aqui: app `typecheck`/`lint` limpos, `jest` 2227 em 165 suítes; e2e `visto-e-semana` + `bom-trabalho` + `concluir-treino` + `treino-ao-vivo` + `recordes-pessoais` + `inicio-aluno` + `cargas-por-divisao` + `acesso-aluno` 48/48; API `test-compile`, `ArquiteturaTest` (16), `CatalogoPermissoesTest` (7), `RecordesDaSemanaTest` (3), `RecordesPessoaisTest` (6), `SeriesAnterioresTest` (4). **Não rodou aqui:** `mvn verify` (sem Docker: `VistoERecordesDaSemanaIntegrationTest`, a V036 e as linhas novas de `SessaoConcluidaIntegrationTest`, `RetornoDesligadoIntegrationTest`, `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` só foram compilados)
- [x] 0.6 Semana completa no Início — commit: `566cb1f` (mesmo commit; só app)
- [ ] 1.1 Meta semanal da pasta
- [ ] 1.2 Registro do dia: água (copos de 250 ml) e "Como foi seguir o plano hoje?" (mensagem já escrita em 27/10)
- [ ] 1.3 Aba Progresso: Meu progresso, 28 dias contra os 28 anteriores
- [ ] 1.4 Ficha: cartão "Acompanhamento" com abas
- [ ] 2.1 Medalhas de constância e retomada
- [ ] 3.1 Push do servidor
- [ ] 3.2 Mural: publicar, reagir, comentar, denunciar, ocultar, bloquear
- [ ] 3.3 Compartilhar conquista com prévia
- [ ] 3.4 Funcionalidade `COMUNIDADE` na Central
- [ ] 4.1 Desafio mensal e ranking opcional
- [ ] 5.1 Feed aberto e avaliações estruturadas

## Passo 0.2: como ficou (28/10)
- **Regra pura espelhada:** `api/.../recordes/RecordesPessoais` e `app/src/dominio/recordesPessoais.ts` (mesmos casos em `RecordesPessoaisTest` e `recordesPessoais.test.ts`). Três tipos: `MAIOR_CARGA`, `MAIS_REPETICOES` (só com a MESMA carga; carga nova não conta aqui) e `MAIOR_VOLUME` (carga × repetições da série). Empate não é recorde. Sem histórico do exercício não há recorde (o primeiro dia inteiro não conta, não só a primeira série). No dia, as séries comparam na ordem do plano com o histórico e as anteriores do mesmo dia.
- **Série simples (decisão):** sem técnica **nenhuma** (estruturada ou descritiva: drop-set, myo-reps e parciais também mudam o que as repetições significam), sem etapas, exercício com carga em kg e que não é cardio, feita, carga e repetições maiores que zero. API: `IndiceVersao.LocalSerie.simples`; app: `serieSimples`.
- **Pacote (P10):** `PainelAluno.recordes` = `{ate, exercicios: {exercicioId: {maiorCarga, maiorVolume, repeticoesPorCarga[]}}}`, só com `TREINOS_RETORNO_HABILITADO` (desligada, o campo nem vai no JSON, `@JsonInclude(NON_NULL)`), só dos exercícios do plano e só de séries feitas **antes de hoje** (Brasília; `ate` exclusivo), lidas por `ExecucaoSerieRepository.findBy...EtapasIsNullAndDataBefore` e filtradas pela versão executada (`RecordesService`). O corte em "antes de hoje" faz o pacote baixado de novo no meio do treino (o app rebaixa depois de cada envio) não apagar as medalhas do dia. Exercício sem `exercicioId` (fora da biblioteca) nunca tem recorde.
- **No app:** `useSessaoDoDia.recordesDe(e)` soma à base do pacote o que o app conhece depois do corte (aparelho e servidor) e decide na hora; registro de outra versão do plano ou outra linha do mesmo exercício no dia entra na base mesmo sem saber se era simples ("na dúvida não comemora": só pode impedir um recorde). Dia anterior ao `ate` do pacote não mostra medalha. `formatoDoPacote` confere a forma de `recordes` (ilegível = pacote baixado de novo).
- **Tela:** `aluno/AvisoDeRecorde` no topo da tela do exercício (miniatura ou medalha, "Recorde pessoal · <exercício>", uma linha por recorde, 5 s, fecha no X, região viva; só ao marcar como feita, editar uma série já feita não repete); no `CartaoSerie` a medalha + selo "Recorde" no lugar de "Série N" (o leitor de tela ouve "Série N, recorde pessoal: ...") e a linha "Maior carga · 70 kg"; "N recordes pessoais" no resumo da lista do dia e no rodapé do último exercício. Contagem = séries com medalha. Cor de sucesso, nunca a da marca. Chave desligada: nada aparece (gate também no app pelo `retornoHabilitado`).
- **Não feito (de propósito):** tela do treinador (0.5), o servidor não grava nem "confirma" recordes ainda (a regra pura em Java está pronta para o 0.4/0.5), sem 1RM (P7).

### Commits do 0.2
- `78545e7` conclusões LOCAL fora da janela de 60 dias saem na retomada da chave (pendência do 0.1).
- `557c2ca` teste da retomada sem remontar o `AlunoProvider` (pendência do 0.1).
- `4564f1c` recordes pessoais (0.2).

## Passo 0.3: como ficou (28/10)
- **Faixa (`aluno/FaixaDoTreino`):** Duração, Volume e Séries ("1/3") num cartão no topo de cada exercício e dentro do cartão de resumo da lista do dia (lá no lugar do "N de M séries feitas"). Só com `retornoHabilitado`. Regras puras em `dominio/treinoAoVivo.ts`.
  - Duração (decisão): conta desde a primeira série marcada **neste aparelho** (o mesmo início do P9), só no dia de hoje e até concluir; concluído, mostra a duração declarada; outra data, sem início ou acima de 6 h (`duracaoDoTreino`), "—". Relógio "m:ss" / "h:mm:ss" atualizado a cada segundo só dentro da faixa (o resto da tela não redesenha); o leitor de tela ouve "Duração do treino: 5 minutos" e o relógio não é região viva (não anuncia cada segundo).
  - Volume: carga × repetições do que foi marcado (etapas feitas, uma a uma), sem exercício sem carga e sem cardio, pelo mesmo `volumeDaSerie` do histórico; nada com número = "—". Milhar com ponto ("1.100 kg").
  - Não ficou fixa ao rolar (sticky): o exercício cabe em poucas telas; fica para depois se o Saraiva pedir.
- **Coluna "Anterior" (decisão: linha "Anterior 60 kg × 8" no cartão da série, abaixo da meta, e "Anterior: o que você fez em 16/10." sobre as séries):** no celular de 360 px não cabe uma quarta coluna ao lado de peso, reps e ✓. Também no cartão da série com etapas ("40 kg × 4+4+2", "4+4 (carga variável)"). Cardio não tem. Exercício nunca feito: sem a linha (não "—" em todas). Série que não casa ou não foi feita da última vez: "—". Só mostra; tocar não preenche os campos (o "Repetir" da série anterior do dia continua).
  - **"A mesma série" (decisão):** mesmo código de tipo e mesma ordem dentro dele no exercício (a 2ª WS com a 2ª WS). Assim casa depois de o plano mudar de versão ou de pasta (uids novos) e não desalinha quando o treinador põe ou tira um aquecimento na frente.
  - **"Última vez":** a data mais recente, antes do dia na tela, com série feita do exercício (pelo `exercicioId` da biblioteca; exercício fora dela, só a mesma linha do plano no aparelho); com o exercício em duas linhas no mesmo dia (duas sessões ou versões), vale a primeira na ordem do plano.
  - **Pacote (como o P10):** `PainelAluno.anteriores` = `{ate, exercicios: {exercicioId: {data, series: [{tipo, ordem, carga, repeticoes, etapas}]}}}`, só com `TREINOS_RETORNO_HABILITADO` (`@JsonInclude(NON_NULL)`), só dos exercícios do plano e só de antes de hoje (Brasília). API: `anteriores/SeriesAnteriores` (regra pura) e `SeriesAnterioresService` (duas consultas JPQL fixas: `ExecucaoSerieRepository.ultimaVezDosExercicios` e `findByAlunoIdAndExercicioIdInAndConcluidaTrueAndDataIn`; a série é localizada pela versão executada, `IndiceVersao.LocalSerie` ganhou `codigo` e `ordemNoTipo`). App: `dominio/seriesAnteriores.ts` (`ultimaVez`, `anteriorDaSerie`, `textoDoAnterior`) junta o pacote com o que conhece da versão em uso (aparelho e servidor) e fica com o mais recente; registro de outra versão fora do pacote não entra (sem o conteúdo dela não dá para saber qual série era). `formatoDoPacote` confere a forma de `anteriores`.

### Commits do 0.3
- `aee3ed1` merge da `main` (só documentação).
- `2cd5e48` treino ao vivo (0.3).

## Passo 0.4: como ficou (28/10)
- **Quando abre:** logo depois de "Concluir treino" (a Folha fecha, o aviso "Treino concluído." aparece e o app vai para `/aluno/sessao/<sessão>/concluido?data=`; o voltar retorna à tela de onde veio) e pelo botão "Ver resumo" ao lado de "Reabrir" no treino concluído. Treino não concluído (reaberto, recusado pelo servidor) ou chave desligada: "Este treino não está concluído." e "Voltar à lista do dia".
- **Tela:** "Bom trabalho!" (h1) com o treino e a data; frase do número; selo "Treino concluído" com resultado e duração; a mesma faixa do 0.3 (duração declarada, volume, séries); "Recordes pessoais" do dia (do 0.2); cartão "Compartilhar" com a prévia, "Mostrar o volume no cartão" (desligado) e os botões; "Voltar à lista do dia".
- **Número do treino (decisão):** é o `totalConcluidos` (todo o histórico do servidor + o que o aparelho ainda não confirmou). Hoje: "Este é o seu 12º treino."; outra data: "Você já concluiu 12 treinos." (o total não diz a posição de um treino antigo); sem total (nunca baixou): nenhuma frase, e o cartão diz "Treino concluído".
- **Cartão (P8):** SVG 1080 × 1920 (Stories) em `aluno/CartaoDoTreino`: faixa com a cor da marca, logo (se já em memória ou com internet, a mesma do PDF) e nome da consultoria; "12º treino"; o treino e a data; calendário do mês com os dias treinados marcados (dia com treino concluído ou com série feita que o app conhece; a cor da marca, ou branco se ela some no fundo) e o dia do treino com anel; "2 dias treinados em outubro"; volume só ligado. Sem nome do aluno, peso, foto, medidas ou dieta. Cores e fonte fixas (é uma imagem; não segue o tema). Regras puras em `dominio/cartaoDoTreino.ts`.
- **Imagem (decisão: no aparelho, sem servidor):** a imagem de produção da API não tem fontes (a comparação de fotos não escreve texto), e o cartão é quase só texto. Web (`aluno/cartao/exportarCartao.web.ts`): o `<svg>` da prévia é serializado, vira `data:` numa `<img>` (a CSP já permite em `img-src`; nenhum `fetch`) e é desenhado num canvas 1080 × 1920 → PNG; "Baixar imagem" sempre, "Compartilhar" só onde o navegador compartilha arquivo (`navigator.canShare`). Celular (`exportarCartao.ts`): `toDataURL` do `Svg` → PNG na pasta dos temporários (`novoArquivoTemporario`, apagada no próximo arquivo e no "Sair") → `Sharing.shareAsync` (o menu do sistema tem "Salvar imagem"). Erro mostra só os textos próprios (`ErroDoCartao`), senão "Não foi possível gerar a imagem agora.". Arquivo `treino-AAAA-MM-DD.png`.
- **`AlunoProvider`:** expõe `conclusoes` (as fundidas, as mesmas de `sessaoConcluidaDe`).

### Commits do 0.4
- `41e2fa2` tela "Bom trabalho!" e cartão (0.4).

## Passos 0.5 e 0.6: como ficou (28/10)
- **"Visto" (P4):** tabela `sessao_concluida_visto` (V036; uma linha por sessão concluída, `@TenantId`, chave = id da sessão concluída, quem e quando). Fica fora da `sessao_concluida` porque aquela é gravada pelo upsert do aparelho e é `@Immutable`. `PUT /alunos/{alunoId}/sessoes-concluidas/{id}/visto` (idempotente, devolve `{vistoEm}`) e `DELETE` no mesmo caminho (desfaz, 204 mesmo sem marca), com `REGISTRO_REAGIR` e `@ExigeRetorno`; sessão de outro aluno, de outra consultoria ou recusada = 404; reaberta = 409 `TREINO_NAO_CONCLUIDO`; a sessão é travada (`SessaoConcluidaRepository.travar`) para duas marcações juntas não colidirem. A lista (`GET /aluno/sessoes-concluidas` e a do treinador) passou a trazer `id` (o do aparelho), `sessaoNome` (da versão executada) e `vistoEm`.
- **Decisões do "Visto":** sem auditoria (é só um toque, sem texto, e cada um viraria uma linha); reabrir ou concluir de novo no aparelho **não** apaga o "Visto"; só o perfil Treinador padrão ganha `REGISTRO_REAGIR` (a Nutricionista lê registros mas não reage a treino; o Administrador tem tudo), por gatilho próprio como na V012. Permissão não sensível, depende de `REGISTRO_LER` (espelho em `dominio/perfilEquipe.ts`).
- **Aluno:** selo "Visto pelo treinador" na linha do treino concluído (lista do dia e último exercício) e no "Bom trabalho!". A fusão aparelho + servidor (`fundirConclusoes`) mantém o `vistoEm` do servidor enquanto a conclusão do aparelho é concluída. Chega quando o app baixa as conclusões de novo (abertura e depois de enviar).
- **Treinador, ficha:** `treinador/CartaoTreinosConcluidos` (últimos 14 dias, só os concluídos, com resultado, duração e o comentário quando a API manda, e "Marcar como visto"/"Visto" que desfaz; sem `REGISTRO_REAGIR`, só o selo) e `treinador/CartaoRecordesDaSemana` com o `alunoId`, depois da Frequência. Só com `REGISTRO_LER` e a chave.
- **Recordes da semana (P3, decisão: últimos 7 dias, hoje incluído, não a semana de segunda a domingo, para não zerar na segunda):** calculados a cada leitura em `recordes/RecordesDaSemanaService` (regra pura `RecordesDaSemana.doPeriodo`, a mesma `RecordesPessoais` do aluno, dia a dia na ordem do plano; base = melhores de antes do período; sem histórico o primeiro dia não conta). `GET /recordes/semana?meus=` (alunos ativos; "Meus" como o painel) e `GET /alunos/{id}/recordes/semana`, com `REGISTRO_LER` e `@ExigeRetorno`; resposta `{de, ate, total, series[≤50]}` com aluno, data, exercício e os recordes. Início do treinador: o cartão só aparece com algum recorde (como os contadores), 5 linhas que abrem a ficha e "E mais N". Nada é gravado.
- **Semana completa (0.6, P5):** no "Sua semana" do Início do aluno, com a chave ligada, quando todos os treinos com dia fixo da semana têm registro (`dominio/progressoSemana.semanaCompleta`, a mesma conta do cartão): faixa verde com troféu, selo "Semana completa" e "Você fez todos os treinos desta semana." (entra com fade, sem animação com movimento reduzido). Plano sem dia fixo (nada previsto) nunca comemora.

### Commits do 0.5 e do 0.6
- `566cb1f` "Visto", recordes da semana e semana completa.

## Texto para o AGENTS.md (proposta; entra no último passo da frente, junto do item "Retorno imediato")
- Recordes pessoais (`recordes/`, Engajamento 0.2, sem migration): só com `TREINOS_RETORNO_HABILITADO`; o `GET /aluno/painel` traz `recordes {ate, exercicios}` (`RecordesService.doPacote`, `@JsonInclude(NON_NULL)`: desligada, o campo não vai): os melhores (`maiorCarga`, `maiorVolume`, `repeticoesPorCarga`) de cada exercício do plano, só de séries **simples** (`IndiceVersao.LocalSerie.simples`: sem técnica nenhuma, sem etapas, kg, não cardio) feitas antes de hoje (Brasília). Regra pura `RecordesPessoais` espelhada em `dominio/recordesPessoais.ts` (maior carga, mais repetições com a mesma carga, maior volume da série; empate não conta; sem histórico, o primeiro dia não conta; séries do dia na ordem do plano). O app decide offline (`useSessaoDoDia.recordesDe`; registro de outra versão entra na base) e mostra `aluno/AvisoDeRecorde` no topo ao marcar, a medalha no lugar de "Série N" e a contagem no resumo do dia. Sem 1RM. Testes: `RecordesPessoaisTest`, `RecordesNoPacoteIntegrationTest`, `RetornoDesligadoIntegrationTest`, `recordesPessoais.test.ts`, `formatoDoPacote.test.ts`, `e2e/recordes-pessoais.spec.ts`.
- Treino ao vivo (Engajamento 0.3, sem migration): só com `TREINOS_RETORNO_HABILITADO`. `aluno/FaixaDoTreino` (Duração desde a primeira série marcada neste aparelho, só hoje e até concluir, depois a declarada; Volume = carga × repetições marcadas pelo `volumeDaSerie`; Séries "N/M"; regras em `dominio/treinoAoVivo.ts`) no topo do exercício e no resumo da lista do dia. Coluna "Anterior" (`aluno/LinhaDoAnterior`, "Anterior 60 kg × 8"): o `GET /aluno/painel` traz `anteriores {ate, exercicios}` (`anteriores/SeriesAnterioresService`, `@JsonInclude(NON_NULL)`): a última vez antes de hoje (Brasília) de cada exercício do plano, série a série com o código do tipo e a ordem dentro dele (`IndiceVersao.LocalSerie.codigo/ordemNoTipo`); "a mesma série" = mesmo código e mesma ordem (casa entre versões e pastas). Regra pura `SeriesAnteriores` espelhada em `dominio/seriesAnteriores.ts` (o app junta o que conhece da versão em uso e fica com o mais recente). Testes: `SeriesAnterioresTest`, `AnterioresNoPacoteIntegrationTest`, `RetornoDesligadoIntegrationTest`, `seriesAnteriores.test.ts`, `treinoAoVivo.test.ts`, `formatoDoPacote.test.ts`, `e2e/treino-ao-vivo.spec.ts`.
- "Bom trabalho!" (Engajamento 0.4, só app): com `TREINOS_RETORNO_HABILITADO`, concluir o treino abre `app/aluno/sessao/[uid]/concluido.tsx` (também pelo "Ver resumo" do `ConcluirTreino`): número do treino (`totalConcluidos`; `dominio/cartaoDoTreino.fraseDoNumero`), resumo, `FaixaDoTreino`, recordes do dia e o cartão para compartilhar `aluno/CartaoDoTreino` (SVG 1080 × 1920 com a marca, o número e o calendário do mês com os dias treinados; nunca nome, peso, foto, medidas ou dieta; volume só com o interruptor). A imagem sai no aparelho (`aluno/cartao/exportarCartao`: canvas na web, `toDataURL` + `expo-sharing` no celular, temporário apagado no "Sair"), sem servidor. Testes: `cartaoDoTreino.test.ts`, `e2e/bom-trabalho.spec.ts`, `e2e/concluir-treino.spec.ts`.
- "Visto" e recordes da semana (Engajamento 0.5, V036): com `TREINOS_RETORNO_HABILITADO`, `PUT`/`DELETE /alunos/{alunoId}/sessoes-concluidas/{id}/visto` (`REGISTRO_REAGIR`, nova, depende de `REGISTRO_LER`; o Treinador padrão ganha por gatilho; idempotente; reaberta 409 `TREINO_NAO_CONCLUIDO`; outra consultoria 404) gravam em `sessao_concluida_visto`; a lista das conclusões traz `id`, `sessaoNome` e `vistoEm` (o aluno vê "Visto pelo treinador"). `GET /recordes/semana?meus=` e `GET /alunos/{id}/recordes/semana` (`REGISTRO_LER`): séries simples dos últimos 7 dias que bateram recorde, calculadas a cada leitura (`RecordesDaSemanaService`, regra pura `RecordesDaSemana`). App: `treinador/CartaoTreinosConcluidos` e `CartaoRecordesDaSemana` (ficha e Início). Semana completa (0.6): `dominio/progressoSemana.semanaCompleta` no "Sua semana" do aluno. Testes: `VistoERecordesDaSemanaIntegrationTest`, `RecordesDaSemanaTest`, `CatalogoPermissoesTest`, `retornoDoTreinador.test.ts`, `sessoesConcluidas.test.ts`, `progressoSemana.test.ts`, `e2e/visto-e-semana.spec.ts`.
- Aluno offline (acréscimo): com a chave ligada, a abertura e a retomada descartam da fila as conclusões `LOCAL` com data anterior a hoje de Brasília - 60 (`descartarSessoesConcluidasAntesDe`, `inicioDaJanelaDeConclusao`); teste da retomada sem remontar: `offline/AlunoProvider.retomada.test.tsx`.

## Referência: Hevy (prints de 27/10)
O que veio dos prints do Hevy e onde entrou:

| No Hevy | Aqui | Passo |
| --- | --- | --- |
| Aviso de recorde no topo ao marcar a série ("Maior peso · 70 kg", "Melhor volume de série") | Aviso de recorde pessoal, offline | 0.2 |
| Medalha no lugar do número da série | Igual | 0.2 |
| "Melhor 1RM" | Não entra (P7) | — |
| Coluna "Anterior" por série | Coluna "Anterior" | 0.3 |
| Duração, volume e séries no topo durante o treino | Faixa do treino ao vivo | 0.3 |
| "Concluir" no topo | "Concluir treino" no topo e no rodapé | 0.1 |
| "Duração de treino incomum" | Aviso abaixo de 10 min (P9) | 0.1 |
| "Salvar treino" com descrição | "Como foi seu treino?" opcional | 0.1 |
| "Bom trabalho! Esse é o seu 4º treino" + cartão com calendário | Tela "Bom trabalho!" + cartão com a marca da consultoria | 0.4 |
| Compartilhar no Stories, baixar, copiar | Compartilhar e baixar o cartão (fora do app, sem moderação) | 0.4 |
| Feed com tempo, volume, recordes, curtir e comentar | Mural (só se o aluno escolher publicar) | 3.2, 3.3 |
| Foto e vídeo no treino, academia, visibilidade | Não entra agora (foto é dado sensível; mural depois) | — |
| Atletas sugeridos, seguir pessoas | Não entra (comunidade só dentro da consultoria) | — |

## Métricas
Treinos com registro e concluídos por semana, semanas seguidas no combinado, atualizações no prazo, pastas renovadas,
retomadas depois de 2 semanas. Antes e depois nas mesmas pessoas, períodos iguais. Tempo de uso não conta.

## O que ficou para trás
Do 0.1 (revisão de 28/10/2026), nada disso bloqueia a branch; confira antes de ligar `TREINOS_RETORNO_HABILITADO`:
- Texto da Ajuda (`ajuda/conteudo.ts` + guias) e o item "Retorno imediato" do `AGENTS.md` (inclui `concluir-treino.spec.ts` na lista de testes de tela): ficam para o último passo da frente.
- Capturas 390/1280, claro e escuro, da Folha "Concluir treino": o tema escuro não foi conferido na tela (só tokens) e o nativo (foco do "Ajustar duração", vibração, Folha) não foi testado no celular.
- Duração: o início vem da primeira série marcada **neste aparelho**; treino marcado em outro aparelho ou só no servidor abre sem duração e o aluno digita (ou deixa em branco).
- Colisão com a `main`: **V035 e SQLite 4 podem colidir com a main. Renumerar no merge para a main.**
- Chave desligada no meio do uso (resolvido em 28/10, padrão da frente do ciclo): um 503 `RETORNO_INDISPONIVEL` de qualquer rota de conclusões avisa a sessão, que põe `retornoHabilitado=false` no estado e no perfil salvo. Com ela falsa, as conclusões da fila ficam `LOCAL` (não viram `FALHOU`) e o Sincronizador não as envia; Selo, Conta, aviso de "Sair" e `CartaoExcluirConta` não as contam. Quando a abertura da sessão regrava o `retornoHabilitado` do `/eu` como verdadeiro, o envio retoma sozinho, com o mesmo id. Itens que já estavam `FALHOU` antes do desligamento ficam escondidos enquanto a chave estiver falsa e voltam a aparecer quando ela volta.
- Revisão do ajuste da chave desligada (28/10), nada bloqueia o push:
  - ~~Chave desligada por mais de 60 dias com uma conclusão `LOCAL` na fila~~ (resolvido em 28/10, `78545e7`): com a chave ligada, a abertura da sessão e a retomada (ramo `virouLigada` do `AlunoProvider`) chamam `RepositorioLocal.descartarSessoesConcluidasAntesDe(inicioDaJanelaDeConclusao(hojeDoCiclo()))` antes de enviar: as conclusões `LOCAL` (concluídas ou reabertas) com data anterior a hoje de Brasília - 60 saem da fila sem envio. Decisão: só o passado sai (`conclusaoForaDaJanela`); data futura por relógio adiantado fica, porque vira válida com o tempo; `FALHOU` e `ENVIADO` não mudam (a `FALHOU` antiga continua com "Tentar de novo", como antes). Teste na bateria das duas implementações (`offline.test.ts`) e em `conclusaoDoTreino.test.ts`.
  - ~~Falta um teste da retomada sem remontar o provider~~ (resolvido em 28/10, `557c2ca`): `offline/AlunoProvider.retomada.test.tsx` monta o `AlunoProvider` de verdade (repositório chave-valor em memória; API, sessão, rede e lembretes simulados), abre com a chave falsa e troca para verdadeira com `update` na mesma árvore (uma montagem só, `abrirRepositorio` chamado uma vez): a conclusão `LOCAL` sai com o mesmo id, a `FALHOU` escondida volta em `falhasDeConclusao`, a de fora da janela de 60 dias some sem envio e `pendentes` fica 0; um segundo caso prova que o 503 na retomada deixa a conclusão `LOCAL` com o mesmo id. Conferido que o teste falha sem o ramo `virouLigada`. As checagens "sem falha" do e2e continuam fracas (passariam com `FALHOU` escondido); o que prova `LOCAL` lá é o segundo POST com o mesmo id.
  - Com a chave falsa, "Sair" e "Excluir minha conta" apagam as conclusões `LOCAL` (comentário incluído) sem avisar; o aviso de "Sair" não as conta. É o que a decisão pede.
  - A retomada só acontece numa abertura de sessão (`abrir`); app vivo na memória com a chave falsa só volta na próxima abertura (igual ao ciclo).
  - `AGENTS.md` ("Aluno offline": depósitos da fila agora são três, as conclusões só contam com a chave ligada; regra do 503 `RETORNO_INDISPONIVEL` no molde do ciclo): fica com o item "Retorno imediato" do último passo.
- Conclusão ou reabertura de um dia perto do limite de 60 dias, feita offline por mais de um dia: o servidor recusa por data e o item fica com falha (igual à mobilidade; o prazo de 60 dias só limpa o que já foi enviado).
- Reabrir uma conclusão que só existe no servidor, com o relógio do aparelho atrasado: o servidor responde "antigo" e o app mostra reaberto enquanto o treinador vê concluído (o último vence, por desenho).
- `api/rotas.ts` `sessoesConcluidasDoAlunoParaTreinador` ainda não tem tela: é do 0.5.

Do 0.5 e 0.6 (28/10/2026):
- `mvn verify` não rodou aqui (sem Docker): a V036 e o `VistoERecordesDaSemanaIntegrationTest` só foram compilados. Rodar antes do merge.
- **Migration:** a branch tem V035 (sessão concluída) e V036 ("Visto"); a branch da evolução usa V035 a V038. Quem chegar depois à `main` renumera as suas (e os totais dos dois testes de migration).
- Recordes da semana são recalculados a cada leitura sobre todo o histórico dos alunos e exercícios do período: barato para a consultoria do Saraiva; se crescer muito, gravar os recordes (o 0.4 também queria isso para dias passados).
- O aluno só vê o "Visto" quando o app baixa as conclusões de novo; sem push (a Etapa 3 decide o push do servidor).
- "Visto" não é auditado; se o Saraiva quiser saber quem viu, o dado já está na tabela (`usuario_id`).
- Texto da Ajuda (`ajuda/conteudo.ts`) e do `AGENTS.md` sobre tudo da Etapa 0: ficam para quando a frente for à `main`.

Do 0.4 (28/10/2026):
- A imagem no celular (Android e iOS: `toDataURL` do `react-native-svg`, a logo dentro do SVG e o compartilhar do sistema) não foi testada: só a web, no Chromium. Testar no APK antes de ligar a chave.
- A logo no cartão não foi vista em teste (o e2e não tem logo); sem internet e sem a logo em memória o cartão sai só com o nome.
- Na web a fonte do cartão é a do sistema (o SVG como imagem não usa as fontes da página); no Safari o canvas com SVG pode recusar a exportação (o aluno vê "Não foi possível gerar a imagem agora."): conferir no iPhone.
- O calendário só marca os dias que o app conhece (conclusões dos últimos 60 dias do servidor, o que está no aparelho e as séries baixadas do período do plano); no começo de uma pasta nova o mês pode ter dias treinados em outro plano sem marca.
- O número de um treino concluído em data passada é o total ("Você já concluiu 12 treinos."), não a posição.
- Sem "Copiar" (só imagem; o texto do Hevy ficou de fora) e sem formato Feed: decidir se precisa.

Do 0.3 (28/10/2026):
- `mvn verify` não rodou nesta máquina (sem Docker): `AnterioresNoPacoteIntegrationTest` e a linha nova do `RetornoDesligadoIntegrationTest` só foram compilados.
- Duração só conta no aparelho em que a primeira série foi marcada (igual ao 0.1); trocar de aparelho no meio do treino mostra "—".
- "Anterior" de um exercício fora da biblioteca (sem `exercicioId`) só usa o que o aparelho conhece da mesma linha do plano; o pacote não o traz.
- Registrar um dia passado (data na tela antes do corte do pacote) usa só o que o app conhece da versão em uso; a última vez de outra versão antes daquele dia não aparece.
- Não conferido no celular de verdade (Android/iOS) nem com leitor de tela; tema escuro só pelos tokens.
- Tocar no "Anterior" para preencher peso e reps (o Hevy faz) ficou de fora: decidir com o Saraiva.

Do 0.2 (28/10/2026):
- `mvn verify` não rodou nesta máquina (sem Docker). Rodar antes do merge. (O e2e `concluir-treino` + `recordes-pessoais` passou 13/13 em 28/10.)
- Recorde de um dia anterior ao corte do pacote (registrar ontem depois que o pacote de hoje chegou) não ganha medalha; o resumo de dias passados também não. Fica para o 0.4/0.5, que precisam do recorde no servidor.
- Base "na dúvida": o mesmo exercício em outra linha do dia (ou de outra versão do plano) conta como anterior, então se a outra linha é feita depois, nenhuma das duas comemora. Raro (exercício repetido no mesmo dia).
- O aviso usa a miniatura do exercício quando há demonstração; sem ela, a medalha. Não conferido no celular de verdade (Android/iOS), nem a região viva com leitor de tela.
- Série simples exclui toda técnica, inclusive as descritivas (pirâmide, dupla progressão...). Se o Saraiva quiser recorde nelas, é mudar `simples` nos dois lados.
- Texto da Ajuda (`ajuda/conteudo.ts`) sobre recordes: fica para o último passo, com o do 0.1.
- `AnonimizacaoService`/`receber` não conferem `aluno.anonimizado` (igual a execuções e mobilidade); só uma requisição que já passou do filtro poderia regravar um comentário depois da anonimização.
- Ambiente: `app/node_modules` do worktree é uma junction para o checkout principal. O `npm run e2e` puro pode abrir em branco por causa do cache do Metro; usar `expo export --clear` antes. Nunca `rm -rf` na junction (usar `cmd /c rmdir`).
