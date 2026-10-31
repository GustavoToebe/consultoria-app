# Atualização visual do app inteiro e pendências da análise de 29/10

Situação: Planejando (o Claude local implementa) · Onde: branch `atualizacao-visual-app-full` (renomeada da `claude/saraiva-api-direcionamento-treinos-dv10io`) · Atualizado: 30/10/2026

## Objetivo
Levar todas as telas do app (treinador, aluno e públicas) para o estilo do editor de treino (`docs/design-e-front.md`,
seção 4.1) e fechar as pendências da análise do vídeo de 29/10 que ficaram fora da frente
[clareza-do-treinador.md](clareza-do-treinador.md). O editor de treino ([editor-de-treino-visual.md](editor-de-treino-visual.md))
e as telas de aluno do treinador ([telas-do-aluno-visual.md](telas-do-aluno-visual.md)) têm frente própria e ficam fora daqui.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Nome da branch | `atualizacao-visual-app-full` (sem acento nem espaço); a antiga só é apagada depois de o Claude da nuvem conferir | Gustavo, 30/10 |
| D2 | Como levar o estilo às telas | Primeiro pelas peças comuns de `app/src/ui/` (vale para todas as telas de uma vez); depois tela por tela, só arrumação (blocos, faixas, selos com ícone, ações na faixa). Nenhuma regra, rota, permissão ou texto de negócio muda por causa do visual | Gustavo, 30/10 |
| D3 | Telas novas de desenho (painel novo e orientação do primeiro uso) | Protótipo em HTML em `docs/prototipos/` (dados fictícios) aprovado pelo Gustavo antes do código, como foi com o editor e os alunos | Gustavo, 30/10 |
| D4 | A12, categorias dos suplementos | Migration nova troca "Suplementos / X" por "X" só onde a categoria ainda é exatamente a do catálogo padrão (o que o treinador editou fica); o `heavysuppz.json` passa a vir sem o prefixo para as consultorias novas | Análise de 29/10 |
| D5 | A02, importar plano de PDF ou Google Docs | Nesta rodada só o plano escrito (opções, riscos de LGPD, o que fica no servidor); sem código até o Gustavo decidir | Gustavo, 30/10 |
| D6 | Passo 7, formato da configuração | Só o formato novo `linhaDoCabecalho` (`2d31c558`), sem ler o antigo `cabecalho`: a SARAIVA TEAM é o primeiro treinador (piloto), mas ainda não conta como o "primeiro cliente" da regra de compatibilidade; vai para a `main` junto com o resto | Gustavo, 30/10 |
| D7 | Passo 8, painel novo do Início | Painel em blocos; cada bloco com faixa de título e três ícones (abrir a tela, atualizar, filtro Todos/Meus); dentro, mini-cartões com número grande e cor com significado (vermelho problema, âmbar atenção, verde positivo), cada um abre a lista filtrada; embaixo, linha "nos próximos 7 dias" em cor neutra. Blocos: Atualizações (para revisar, atrasadas, próximos 7 dias), Interessados (novos, em contato ou negociação, retornos atrasados ou de hoje), Treinos (concluídos na semana, sem registro há N dias, recordes da semana), Pastas (a renovar em 7 dias, sem pasta com período), Agenda (hoje, próximos 7 dias), Financeiro só com o financeiro ligado e a permissão (vencidas em R$, vencendo, recebido no mês), gráficos (rosca dos alunos por situação, barras do recebido × lançamentos por mês). Só contagens, sem nome de aluno, cada bloco com a permissão dele. "Editar" (escolher e ordenar blocos) salvo no aparelho, nas preferências. Só rotas que já existem: bloco que precisar de rota nova volta ao Gustavo antes. Protótipo `docs/prototipos/painel.html` antes do código. A referência foi um print de outro sistema, que não entra no repositório | Gustavo, 30/10 |
| D8 | Passo 9, primeiros passos (respostas ao `primeiro-uso.html`) | Cartão "Primeiros passos" vira bloco do painel (D7), no topo, enquanto não estiver concluído. Aberto, toma o lugar do "Próximo passo" sem repetir item nem botão; dispensado ou concluído, o Próximo passo volta. Progresso "3 de 6". Dispensar com painel de confirmação. Concluído vira linha "Concluídos", que dá para fechar. O passeio pelo menu abre antes, sozinho, como hoje, com um passo novo no fim apontando a lista. Metodologia e modelos ficam como itens com "Já conferi". Início sem alunos: enxuto, só uma frase, sem contadores zerados. "Já conferi", "Agora não" do link, dispensado e concluído ficam no aparelho, por usuário, como o `passeioVisto` (sobrevivem ao Sair), sem API nova; trocar de computador e a lista voltar é aceito (os itens automáticos continuam certos). "Agora não" do link de inscrição conta como resolvido e mostra "Deixado para depois", com desfazer. Membro com perfil restrito só vê os itens que pode fazer. Consulta que falhou deixa o item "Sem informação", nunca "Feito" | Gustavo, 30/10 |
| D9 | Passos 8 e 9, aprovação do painel e do primeiro uso | Título "Início", igual ao menu (a Ajuda, os guias e o passeio usam esse nome). Escolhas de desenho aprovadas: botões "Editar" e "Novo aluno" secundários, o único vermelho é o do Próximo passo ou do item aberto dos Primeiros passos; Todos/Meus em cada bloco; grade de 4 colunas (Agenda e Financeiro 2, barras 3 com a rosca ao lado); Primeiros passos fixo no topo e fora do "Editar"; R$ sem centavos no cartão e valor completo no leitor de tela; zero em cinza e consulta que falhou "não carregou", nunca zero. A rosca tem uma visão só: ativos, inativos e sem acesso (sem "por responsável", sem "por situação da atualização", sem alternador). Cartões: "Sem registro há N dias" abre uma `Folha` com a lista que o `/painel` já devolve, com "Mostrando 20 de N" acima de 20; "A renovar em 7 dias" abre uma `Folha` com a lista nova do `/painel` (aluno e fim, até 20, mesma regra da contagem, mesmas permissões da `planosTerminando`, que não é reaproveitada), também com "Mostrando 20 de N"; "Recordes da semana" abre uma `Folha` com o `GET /recordes/semana`; "Sem pasta com período" e "Concluídos na semana" abrem a lista de alunos sem filtro (filtro de servidor `GET /alunos?grupo=` nas pendências). Cada item das Folhas abre a ficha do aluno. Primeiros passos: os feitos ficam recolhidos numa linha "N feitos", que abre ao tocar; à vista só os que faltam. **Ajustes de 30/10 (depois da conferência dos números):** (1) "Vencidas" do Financeiro usa `GET /financeiro/inadimplentes?meus=` (quantidade e soma de todas as vencidas, a mesma consulta da lista `?situacao=VENCIDA`), não o `cartoes.emAtraso` do `/financeiro/painel`, que recorta o período (6 meses) e continua assim na tela do Financeiro; "Vencendo em 7 dias" (`proximosRecebimentos.em7Dias`, em aberto de hoje a hoje+7) já bate com a lista `?situacao=ABERTA&vencimento=PROXIMOS_7_DIAS`; teste de integração prova cartão = lista, com "Meus" e com uma vencida há mais de 6 meses. (2) Treinos: "Concluídos" conta as sessões concluídas, completas e parciais, nos últimos 7 dias (hoje de Brasília e os 6 antes, a janela do `GET /recordes/semana`), nulo com o retorno desligado; a faixa do bloco diz o período uma vez só ("Últimos 7 dias") e os cartões ficam "Concluídos" e "Recordes"; "Sem registro há N dias" continua com o N da preferência. (3) Agenda: o cartão vira "Esta semana" (segunda a domingo) e abre a Semana da Agenda, sem mudar a Agenda (filtro de próximos 7 dias descartado) | Gustavo, 30/10 |

## Rotas do painel (D7, conferido em 30/10)
Já existem, com contagem ou `total`:
- Atualizações: `GET /painel` (`atualizacoesParaRevisar`, `atualizacoesAtrasadas`, `atualizacoesProximas`), com `meus`; abre `/treinador/atualizacoes?situacao=…`; a linha "nos próximos 7 dias" abre `?situacao=PROXIMAS`, não a Agenda (Gustavo, 30/10).
- Interessados: `GET /inscricoes/contagens` (`porSituacao.NOVA`, `EM_CONTATO`, `EM_NEGOCIACAO`, `retornosAtrasados`, `retornosHoje`), com `meus`.
- Recordes da semana: `GET /recordes/semana?meus=` (só com o retorno ligado).
- Agenda: `GET /agenda/resumo?de=&ate=&responsavel=` (soma de `dias[].compromissos` no app).
- Financeiro: `GET /financeiro/painel` (`cartoes.emAtraso`, `proximosRecebimentos.em7Dias`, `cartoes.recebidoCentavos`, `serie[]`), com `meus`; ligado por `GET /eu` `pagamentosHabilitados` e `FINANCEIRO_LER`.
- Alunos por situação: `GET /alunos?situacao=ATIVO|INATIVO` (`total`), com `meus`.

Não existiam como contagem; entram no `GET /painel`, sem rota nova, com o mesmo `meus` e as mesmas permissões, só números, ausência `null` e nunca zero (Gustavo, 30/10; `executor`, com teste de integração de cada número):
- Treinos concluídos na semana (`null` com o retorno desligado).
- Pastas a renovar em 7 dias, com a lista dessas pastas (aluno e fim, até 20; o `planosTerminando` é de plano e continua como está).
- Alunos sem pasta com período.
- "Sem registro há N dias" como contagem, sem o teto de 20 (a lista com teto continua).
- Alunos sem acesso, para a rosca (ativos, inativos e sem acesso).

Filtros novos de endereço (só front, cada tela de destino lê o filtro como já lê `?situacao=`, com e2e de cada um; Gustavo, 30/10): retornos e em contato (Interessados), vencidas e vencendo (Financeiro), próximos 7 dias (Agenda). Feitos 4 de 5, ainda sem commit (`treinador/FiltroDoEndereco`, `e2e/filtros-do-endereco.spec.ts`; endereços no AGENTS.md); o da Agenda saiu: o cartão virou "Esta semana" e abre a Semana, que já existe (D9).

Para onde abrem os cartões: ver a D9. Não existem `/treinador/recordes` nem `/treinador/treinos-concluidos`, e a lista de alunos não ganha filtro novo.

## Passos
- [x] 0. Renomear a branch (D1) e atualizar o "Onde" dos planos que citam a antiga — commit/run: push da branch nova em 30/10 (os "Onde" vão no próximo commit)
- [x] 1. Peças comuns no estilo novo (`Cartao`, `Tabela`, `LinhaDaLista`, `ItemDeLista`, `Abas`, `FaixaDeChips`, `Campo`, `EscolhaEmFolha`, `Folha`, `PainelConfirmacao`, `Estados`, `Cabecalho`), com capturas antes e depois — commit/run: `bc33fc6b` (com o ⋯ de mais ações em moldura e o `bordaCampo` do escuro em `#707078`, aprovados em 30/10; depois, o rótulo dos grupos de escolha (`Escolha`, `GradeDeOpcoes`, `EscalaDeNota`, número grande) na cor `texto`, como o do `Campo`, pedido em 30/10, ainda sem commit; a moldura do `IconeBotao` em `bordaCampo` e o `bordaCampo` claro `#80808A` e escuro `#76767E` (3:1 contra a faixa `superficie3`), aprovados em 30/10, ainda sem commit; lista em linha de tabela `33e4d888`; jest, lint, typecheck e e2e completo, 359, passaram)
- [ ] 2. Telas do treinador (lista na mensagem), em lotes paralelos — commit/run: —
- [ ] 3. Telas do aluno e telas públicas, em lotes paralelos — commit/run: —
- [ ] 4. A06: textos da dieta (modelo × plano do aluno, nome dos complementos) — commit/run: —
- [ ] 5. Lista de compras: rótulos "Conforme a dieta" e "Estimativa para compra" (D7 de clareza-do-treinador, que ficou só nos selos) — commit/run: —
- [x] 6. A12: migration das categorias dos suplementos (D4), com teste de integração — commit/run: `faca6070` (V047)
- [x] 7. Importação: escolher a linha do cabeçalho (API, tela e testes) — commit/run: `2d31c558` (só o formato novo `linhaDoCabecalho`, sem transição: app antigo que manda `cabecalho` recebe 422)
- [x] 8. Painel novo do Início do treinador (D7), junto com o bloco de primeiros passos: protótipo `docs/prototipos/painel.html` **aprovado para código (Gustavo, 30/10)**, com os ajustes da D9; o código começa depois das contagens do `/painel` (`executor`) — commit/run: `d53a3696` (com `alunosInativos` no `GET /painel`; PR `painel-novo`)
- [x] 9. A01: orientação guiada no primeiro uso (D8): protótipo `primeiro-uso.html` **aprovado (Gustavo, 30/10)**, com as respostas da D8 e os feitos recolhidos (D9); código junto do passo 8 — commit/run: `d53a3696` (PR `painel-novo`; o que ficou de fora está nas Pendências soltas do README)
- [x] 8b. Ajustes do painel (decisões do Gustavo, 31/10): Todos/Meus gravado em `Preferencias.painelDoInicio.meus` (o Voltar ao padrão limpa); item de acesso "Um aluno já tem acesso ao app" (convite pendente não conta); "Ver retornos" do Próximo passo com `retornos=ATE_HOJE`; "20 ou mais" nos planos terminando; Números no celular fica como está — commit/run: `0a5d1a12` (PR `painel-ajustes`)
- [x] 10. A02: plano escrito em `docs/planos/importar-plano-de-documento.md` (D5) — commit/run: — (perguntas para o Gustavo no próprio plano)
- [ ] 11. Ajuda, guias PDF, AGENTS.md, Jest, lint, typecheck, `mvn verify` (passos 6 e 7), e2e completo em 390 e 1280 — commit/run: —

## Fora do escopo
- Editor de treino e telas de aluno do treinador (frentes próprias).
- Comunidade, ranking e XP.
- A04 (falha da planilha na reunião): espera os nomes das colunas e abas.

## O que ficou para trás
- (nada ainda)

## Passagem para a nuvem (30/10)

Situação no fim do dia 30/10, na branch `atualizacao-visual-app-full`, com todos os agentes parados. Nada ficou só no PC. As capturas ficaram fora do repositório: o Gustavo manda por fora.

### O que está pronto e o que falta, por frente

- **Tokens e moldura.**
  - `bordaCampo` claro passou de `#8A8A93` para `#80808A`, e o escuro de `#707078` para `#76767E`. Fica ≥ 3:1 contra o fundo, o cartão e a faixa `superficie3`.
  - O espelho está em `app/global.css` e nos protótipos. O areia não mudou.
  - `IconeBotao moldura` com borda `bordaCampo`: o ⋯ de mais ações e o X da Folha.
  - Rótulo dos grupos de escolha (`Escolha`, `GradeDeOpcoes`, `EscalaDeNota`, número grande do `Campo`) na cor `texto`.
  - Teste novo em `ui/contrasteDasPecas.test.ts`. Capturas antes e depois aprovadas pelo Gustavo.
  - Falta: nada.
- **Agenda (b), celular pela janela.**
  - `agendaNoCelular` em `dominio/agendaCalendario`: janela < 768 (`LARGURA_MENU_LATERAL`), com teste.
  - `agenda.tsx` usa a largura da janela. A D1 do `agenda-calendario.md` está atualizada.
  - Os e2e trocaram `< 760` por `< 768`.
  - Falta: as capturas em 768, 900 e 1024 px (Semana e Mês, com o menu de ícones e com o menu aberto) não foram tiradas. O spec temporário está só no PC (`zz-captura-agenda-b.spec.ts`, fora do repositório).
- **Agenda, estilo novo (lote A).**
  - Peças: `MiniCalendario`, `PainelDeAgendas`, `MenuCriar` (setas, Home e End no teclado), `BarraDoCalendario`, `GradeDeHorarios`, `VisaoDoMes`, `VisaoDoAno`, `itemDaAgenda`, `ListaDoCalendario`, `DetalheDoCompromisso`.
  - Falta: nada de código.
  - Risco: a visão Ano em 1280 px fica com 2 meses por linha e uns 10 px de folga.
- **(c) Cruzamentos.**
  - Rota `POST /agenda/eventos/cruzamentos`: só leitura, `AGENDA_LER`; outro membro ou outra consultoria recebe 404.
  - Pega a repetição do evento que está sendo montado, por 1 ano, e cruza com os outros eventos pessoais do membro e com os compromissos não cancelados em que ele é o responsável (critério do `HORARIO_OCUPADO`).
  - A resposta é só `{quantidade, datas (até 5), incompleto}`.
  - Ligada na `FolhaEvento` por `treinador/agenda/useAvisoDeCruzamento`: espera 400 ms, descarta resposta atrasada, fica em silêncio sem rede ou com falha e nunca impede o salvar.
  - A conferência local (`itensQueSobrepoem`, `textoDoAvisoDeSobreposicao`, `intervaloDoEvento`) foi apagada.
  - Falta: nenhum teste cobre a espera de 400 ms nem o descarte da resposta atrasada.
  - Risco 1: na edição de uma série com fim "N vezes" aberta numa ocorrência posterior, a conta parte da ocorrência aberta.
  - Risco 2: em "Somente este", o aviso ainda considera a regra da série.
- **(d) Folha perdendo a escolha.**
  - Em `ui/historicoDasFolhas`, quem espera o histórico só corre quando a volta chega (`voltaPendente === null`), ou depois de 5 s.
  - Dois testes novos simulam o navegador lento.
  - Falta: nada.
- **Filtros na URL.**
  - `treinador/FiltroDoEndereco`: faixa com "Limpar filtro".
  - Interessados: `?retornos=ATE_HOJE` e `?visao=kanban&etapas=EM_CONTATO,EM_NEGOCIACAO`.
  - Financeiro: `?aba=cobrancas&situacao=VENCIDA` e `&situacao=ABERTA&vencimento=PROXIMOS_7_DIAS`.
  - e2e `filtros-do-endereco.spec.ts`, com 11 casos.
  - A Agenda não ganhou filtro: o cartão virou "Esta semana" e abre a Semana (D9).
  - Falta: os cartões do painel que usam esses endereços (passo 8).
- **Contagens e lista de pastas do `/painel`.**
  - Campos novos:
    - `alunosSemRegistroTotal`;
    - `alunosSemPastaComPeriodo`;
    - `pastasARenovar`, com a lista `pastasParaRenovar` (até 20);
    - `alunosSemAcesso`;
    - `sessoesConcluidas7Dias`.
  - Testes: `PainelContagensIntegrationTest` e `PainelSessoesConcluidasRetornoDesligadoIntegrationTest`.
  - Espelho em `app/src/api/tipos.ts` e nos `PAINEL` falsos dos e2e.
  - Falta 1: o front do painel (passos 8 e 9), que ainda não começou.
  - Falta 2: decidir de onde vem o número de inativos da rosca: `GET /alunos?situacao=INATIVO` ou um campo novo. A decisão é do Gustavo.
  - Riscos: "a renovar" não tem limite para trás e pode se sobrepor ao "sem pasta". Além disso, conta pastas, então o mesmo aluno pode contar duas vezes.
- **Cartão igual à lista.**
  - Teste: `CartoesDoInicioBatemComAListaIntegrationTest`.
  - Confere que `GET /financeiro/inadimplentes` = `?situacao=VENCIDA` e que `proximosRecebimentos.em7Dias` = `?situacao=ABERTA&de=hoje&ate=hoje+7`, com e sem `meus`.
  - Cenário: uma vencida há mais de 6 meses entra; hoje+8 fica fora; paga e cancelada ficam fora; outra consultoria não vaza.
  - Nenhuma regra mudou.
  - Falta: nada.
- **Lote A, tela por tela.**
  - **Início:** não foi tocado, de propósito, porque será substituído pelo painel dos passos 8 e 9. Só há capturas "antes".
  - **Atualizações, lista:**
    - o cartão ganhou título com a contagem ("4 atualizações") e a faixa;
    - a descrição "Da mais antiga para a mais nova." agora aparece (o `Cartao` sem título a jogava fora);
    - os selos das linhas ganharam ícone (`treinador/iconesDosSelos`).
  - **Atualizações, detalhe:**
    - selos com ícone no resumo e no "Aguardando envio";
    - 24 px entre os blocos da coluna da direita;
    - "Enviar feedback" e "Cancelar edição" lado a lado;
    - no `ResumoDaAtualizacao`, cada número (peso, variação, destaques) fica num bloco `superficie2` com borda.
  - **Números:** o "até hoje" do mês corrente virou selo cinza com ícone. A tabela ficou como estava.
  - **Agenda:** ver "Agenda, estilo novo" acima.
  - **Não feito:**
    - o "Editar feedback" na faixa do cartão, que pede `acoes` no `aluno/atualizacao/FeedbackAtualizacao` (peça do aluno);
    - juntar o `ICONE_DO_SELO`, que está repetido em `alunos/index.tsx` e em `treinador/iconesDosSelos.ts`, talvez em `ui/`;
    - `Cartao` sem padding no corpo e `motivo` no `IconeBotao`: ficaram só como proposta.
  - **Risco:** no celular, os cinco números do resumo ficam 2, 2 e 1. O aviso "Received `false` for a non-boolean…" em Atualizações já existia antes.

### Testes (código final desta rodada)

- `app/`: `npm run typecheck` sem erro; `npm run lint` sem erro; `npm test` com 188 suítes e 2721 testes, 0 falhas. Rodados de novo antes dos commits.
- `app/`: `npx playwright test`, o e2e completo com build novo do `dist-e2e`: 383 passaram, 0 falhas, em 2,8 min.
- `api/`: `mvn verify` com 1737 testes, 0 falhas e 0 erros. Rodado pelo executor depois da última mudança da API, e a API não mudou depois disso.

### Textos dos agentes para o AGENTS.md e o `agenda-calendario.md` (aplicados pelo Claude da nuvem em 30/10, numa edição só)

**1. Do executor da API.** AGENTS.md, item "Calendário e eventos pessoais", na frase da rota `POST /agenda/eventos/cruzamentos`. Essa frase o mesmo agente já tinha posto na primeira tarefa e está no arquivo. São duas trocas:
- trocar "`EventoAgendaService.cruzamentos`; ainda não ligada à `FolhaEvento`)" por "`EventoAgendaService.cruzamentos`; ligada à `FolhaEvento` por `treinador/agenda/useAvisoDeCruzamento`)";
- trocar "que cruzam alguma de OUTRO evento pessoal do membro (exceções aplicadas; dia inteiro fora; encostar não cruza), até 5 datas e nunca texto de outro evento; compromissos não entram, como no aviso de hoje; tetos 400 ocorrências do pedido e 20.000 dos outros eventos (estourado: `incompleto`)." por "que cruzam alguma de OUTRO evento pessoal do membro (exceções aplicadas) ou algum compromisso não cancelado em que ele é o responsável (só o horário, pelo mesmo critério do `HORARIO_OCUPADO`: `CompromissoRepository.horariosNaoCanceladosDoResponsavel`; dia inteiro fora; encostar não cruza), até 5 datas e nunca texto, aluno, local, observação nem id de outro evento ou compromisso; tetos 400 ocorrências do pedido e 20.000 entre os outros eventos e os compromissos (estourado: `incompleto`). Teste: `EventoCruzamentosIntegrationTest`."

**2. Do executor da API.** AGENTS.md, item "Início do treinador", na lista das contagens do `GET /painel`. Trocar "e `alunosSemAcesso` (ativos com `usuarioId` nulo = `!temAcesso`; subconjunto de `alunosAtivos`, sem permissão extra)." por "`alunosSemAcesso` (ativos com `usuarioId` nulo = `!temAcesso`; subconjunto de `alunosAtivos`, sem permissão extra) e `sessoesConcluidas7Dias` (treinos concluídos, completos e parciais, de `sessao_concluida` ACEITO nos últimos `RecordesDaSemanaService.DIAS` (7) dias de Brasília, dos mesmos alunos ativos do escopo; só o número, sem nome nem id; `null` com `TREINOS_RETORNO_HABILITADO` desligado ou sem `REGISTRO_LER`, 0 com o retorno ligado e nenhuma sessão; teste do retorno desligado: `PainelSessoesConcluidasRetornoDesligadoIntegrationTest`). Os cartões Vencidas e Vencendo em 7 dias do Início têm o número das listas que o toque abre (`GET /financeiro/inadimplentes` = `?situacao=VENCIDA`; `proximosRecebimentos.em7Dias` = `?situacao=ABERTA&de=hoje&ate=hoje+7`), com e sem `meus`; teste: `CartoesDoInicioBatemComAListaIntegrationTest`."
- Se o "e" antes de `alunosSemAcesso` já estiver na frase, manter o "e" só antes de `sessoesConcluidas7Dias`.
- Nota minha: "ACEITO" é a situação de sincronização do registro, a mesma que o app já usa para contar as sessões do aluno.

**3. Do executor-front (FolhaEvento).** AGENTS.md, item "Calendário e eventos pessoais", na parte "App:", logo antes de "Teste de tela: `e2e/agenda-calendario.spec.ts`.". Inserir: "O aviso de cruzamento da `FolhaEvento` vem de `POST /agenda/eventos/cruzamentos` (`treinador/agenda/useAvisoDeCruzamento`: 400 ms depois da última mudança no horário ou na repetição; sem pedido no dia inteiro nem com campo incompleto; resposta atrasada descartada; na edição vai o `eventoId`; pedido e texto em `dominio/agendaEvento.ts`, `pedidoDeCruzamento` e `textoDoCruzamento`: "Cruza com N horários: 20/10, 21/10 e 22/10", com "pode haver mais" quando `incompleto` e nenhum aviso com zero). É só aviso: nunca impede nem atrasa o salvar. Sem internet (sessão aberta offline) o app não pergunta, e a falha da rota ou da rede some em silêncio, sem aviso e sem erro. A conferência local, que só via o período carregado (`itensQueSobrepoem`), saiu em 30/10."

**4. Do executor-front (FolhaEvento).** `docs/planos/agenda-calendario.md`, linha "Telas do calendário (passo 13)". Trocar exatamente "aviso de sobreposição ignora a repetição;" por "aviso de sobreposição: desde 30/10 vem da rota `POST /agenda/eventos/cruzamentos` e considera a repetição por 1 ano (antes ignorava a repetição e só via o período carregado);".

**Do agente do lote A:** nenhum texto.

**Já aplicado antes da regra da edição única** (está nos commits, para conferir):
- No AGENTS.md:
  - a Agenda com a janela abaixo de 768 (`agendaNoCelular`);
  - a linha "Filtros vindos do endereço";
  - a moldura do `IconeBotao` em `bordaCampo`, com os valores novos;
  - a espera do histórico das Folhas (`voltaPendente === null`, `ESPERA_MAXIMA_DA_VOLTA` 5 s);
  - o parágrafo "Início do treinador" com as contagens novas, do executor do painel;
  - a frase da rota de cruzamentos da primeira tarefa, que o texto 1 acima atualiza.
- Nos planos: os ajustes da D9, a linha dos filtros, a nota do passo 1, as pendências do README e a D1 do `agenda-calendario.md`.

### Decisões desta rodada (Gustavo, 30/10)

- **Datas do aviso de cruzamento:** a data curta da Agenda ("20/10"). A data que não é do ano atual sai com o ano ("04/01/2027"), porque uma série pode passar da virada do ano. `textoDoCruzamento` usa `dataSemAnoCorrente`. Há um teste próprio em `dominio/agendaEvento.test.ts`, com 28/12 e 04/01/2027.
- **Frase final do aviso:** "Dá para salvar mesmo assim." fica.
- **Janela do "Concluídos":** de hoje − 6 até hoje, com o hoje de Brasília.
  - O código usa `LocalDate.now(Fuso.BRASILIA)` e vai de `hoje.minusDays(RecordesDaSemanaService.DIAS - 1)` até `hoje`, a mesma conta do `GET /recordes/semana`.
  - Bate com a faixa "Últimos 7 dias" do bloco Treinos: são 7 dias corridos contando hoje.
- **Também desta rodada, já na D9:**
  - "Vencidas" do Início vem do `GET /financeiro/inadimplentes`;
  - "Concluídos" conta sessões completas e parciais, e é nulo com o retorno desligado;
  - a Agenda ganha "Esta semana" e nenhum filtro novo;
  - a rota de cruzamentos inclui os compromissos.

### O que ainda ia conferir e não deu tempo

- **Revisão do código:** a do diff pelo `revisor` foi parada no meio, sem achados, e a final pelo `advisor` não foi feita. Vale uma revisão antes do PR, com atenção a:
  - consultas novas do `/painel` (cláusula `in` com muitos alunos);
  - custo da expansão de 1 ano nos cruzamentos;
  - corrida em `ui/historicoDasFolhas`.
- **Capturas finais do lote A:** Início, Atualizações, Agenda e Números, em 390 e 1280 px, claro e escuro, lado a lado, com o código final. As que existem são das etapas intermediárias.
- **Capturas da Agenda (b):** em 768, 900 e 1024 px.
- **Aviso de cruzamento no tema escuro:** os e2e rodaram só no claro.

### Conferência na nuvem (30/10)

- Os textos 1 a 4 acima foram aplicados no `AGENTS.md` e no `agenda-calendario.md` numa edição só.
- `npm run typecheck`, `npm run lint` e `npm test` (188 suítes, 2721 testes) rodados de novo na nuvem: verdes. O `mvn verify` vale o do PC (a nuvem não tem Docker); a CI do PR roda de novo.
- Capturas do lote A, da Agenda, dos filtros e do protótipo do painel recebidas e conferidas: Atualizações (lista e detalhe), Agenda (Semana no escuro, Mês em 390) seguem o estilo novo, sem problema à vista.
- Os dois riscos do aviso de cruzamento (série "N vezes" aberta numa ocorrência posterior; "Somente este" ainda olhando a regra da série) ficam como pendência: o escopo só é escolhido ao salvar, então a folha não sabe qual será. Só afeta o texto do aviso, que nunca impede salvar.
- Continuam pendentes: capturas da Agenda em 768, 900 e 1024 px; o aviso de cruzamento no tema escuro; os passos 8 e 9 (código do painel e do primeiro uso).
