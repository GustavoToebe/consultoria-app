# Início e Agenda do treinador: semana à vista e avisos

Situação: Planejando (plano pronto, esperando o Gustavo confirmar as recomendações; nenhum código) · Onde: main · Atualizado: 16/11/2026

Fonte: pedidos da reunião de 15/11 (IDs R1115-Cxx) e leitura do código em 16/11/2026. Validade: vale enquanto `painelBlocos.ts`, `painelDoInicio.ts`, `lembretesCompromisso.ts`, `filtrosDaAgenda.ts` e `PainelService` não mudarem; se mudarem, refazer "Conferido no código". Frente média: vem depois da dieta e do `editor-e-modelos-achar-as-coisas.md`.

## Objetivo
Na reunião o treinador do piloto mostrou a agenda do celular dele e a de um concorrente e pediu: ver a semana no Início (quantos compromissos em cada dia), aviso 30 minutos antes do compromisso, aviso de aniversário de aluno e uma Agenda mais simples com filtro por aluno. Também viu dois possíveis defeitos na Agenda (o detalhe "pisca" ao clicar em Editar; espaço vazio embaixo da grade em tela grande). Ao fim: o Início mostra a semana com a contagem de cada dia e quem faz aniversário nos próximos 7 dias; o aluno recebe um lembrete 30 minutos antes do compromisso; a Agenda filtra por aluno; os dois defeitos foram reproduzidos e, se existirem, corrigidos.

## Conferido no código (16/11/2026)
- Confirmado: `BLOCOS_DO_PAINEL` tem 8 blocos, incluindo `agenda` (`app/src/dominio/painelBlocos.ts:7`), e `TAMANHO_PADRAO_DO_BLOCO` é `Record` exaustivo (`:17`); o cartão "Agenda" é `blocoAgenda`, só o total da semana (`dominio/painelDoInicio.ts:612,698-711`, `compromissosDaSemana`); `segundaDaSemana`/`domingoDaSemana` (`dominio/agendaCalendario.ts:40-41`); `AntecedenciaDoLembrete = '1d' | '2h'` e os textos fixos sem horário (`dominio/lembretesCompromisso.ts:18-23`); `LIMITE_DE_NOTIFICACOES_LOCAIS` e `NOTIFICACOES_DA_ATUALIZACAO` no teste (`lembretesCompromisso.test.ts:3,72`); `FiltrosDaAgenda` só com `responsavel` e `situacoes` (`dominio/filtrosDaAgenda.ts:9-13`); painel "Filtros da agenda" em `app/treinador/agenda.tsx:221`; `Parametros` da Agenda com `visao`, `data` e `meus` (`:51`); desconto fixo de 320 px em `treinador/agenda/GradeDeHorarios.tsx:54`; `listarAlunos` usado em `CamposDoCompromisso.tsx:7`; `GET /agenda/resumo` existe (`api/rotas.test.ts:162`); `FiltrosDaListaDeAlunos.Plano { COM, SEM }` (`api/.../alunos/FiltrosDaListaDeAlunos.java:43`) e `planoAtivo` (`:140`); `PainelService` tem `pastasParaRenovar` (`:69,87`); `dataNascimento` é DTO de entrada na ficha (`alunos/dto/AlunoDtos.java:89`) e `RegrasDoPerfil.maiorDeIdade` existe (`comunidade/RegrasDoPerfil.java:35`); `TREINOS_PUSH_HABILITADO` padrão `false` (`application.yml:116`); `ALVO_TOQUE = 44` (`tokens.ts:563`); `api/agendaTipos.ts` (os tipos, em `app/src/api/`, não em `dominio/`); `treinador/painel/BlocoDoPainel.tsx` e `treinador/agenda/ResumoDoCompromisso.tsx` existem; o arquivo de regra da semana (`semanaDoInicio.ts`) **ainda não existe**.
- **Não conferido** (linhas do rascunho, base antiga): `ResumoDoCompromisso.tsx:50,101-132`, `agenda.tsx:110,189-199,291-296,320-345`, `GradeDeHorarios.tsx:160-164`, `historicoDasFolhas.ts:289-298`, `painelDoInicio.ts` (`TITULOS_DOS_BLOCOS`, `blocoDisponivel`, `consultasDoBloco`, `enderecoDoBloco`, `montarBloco`, `folhaPastasARenovar`), `preferencias.ts:144-158`, todas as contagens de blocos nos testes e e2e (`painel.spec.ts:202,205,216,222,379`), os mocks tipados do app com `pastasParaRenovar`, `AlunoService.java:155`, `PainelContagensIntegrationTest`, `lembretes.web.ts`, `JANELA_DA_LISTAGEM`, `AGENTS.md` (linhas dos blocos do Início e da Agenda presencial), `docs/planos/agenda-calendario.md` (D8, D13 e Fora do escopo, que o rascunho diz desatualizados desde a V070), `docs/planos/contato-da-consultoria.md:69`.

## Itens da reunião cobertos
| ID | Pedido | Situação hoje | Tipo de mudança | Passo |
| --- | --- | --- | --- | --- |
| R1115-C03 | Semana no Início do treinador com contagem por dia | Parcial (o cartão "Agenda" só mostra o total da semana) | apresentação + regra; sem API, sem migration | 3, 4 |
| R1115-C08 | Aviso de aniversário de aluno | Falta (V070 guarda a data; nada a usa) | contrato leve (campo no `/painel`) + tela | 5, 6, 7 |
| R1115-C10 | Filtro da lista de alunos por tipo de plano (só tags ficam fora) | Parcial (hoje só "com/sem treino ativo"); pedido sem aceite | contrato leve (enum e parâmetro) | 10 (opcional) |
| R1115-C16 | Detalhe "pisca" ao clicar em Editar | Testar de novo (causa não confirmada; sem teste) | comportamento, só app | 1, 2 |
| R1115-C17 | Espaço vazio embaixo da grade em tela grande | Testar de novo (causa não confirmada) | apresentação, só app | 1, 2 |
| R1115-C18 | Compromisso é com um aluno só | Respondido (aceita de 1 a 20 alunos desde a V042) | nenhuma | 12 |
| R1115-C19 | Compromisso sem aluno | Respondido (Criar > Evento já é o compromisso sem aluno) | nenhuma | 12 |
| R1115-C20 | Conferir se o aviso chega ao aluno | Testar de novo (aviso interno e push existem; chave de push em produção não conferida) | nenhuma (conferência) | 12 |
| R1115-C21 | Aviso 30 minutos antes | Falta (só 1 dia e 2 h, local, só no celular do aluno) | comportamento; APK novo | 8 |
| R1115-C22 | Agenda mais simples, com filtro por aluno | Parcial (sem filtro por aluno; "mais simples" sem detalhe) | comportamento, só app | 9 |

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | C16 e C17: reproduzir antes de mexer; as causas do consolidado são hipótese; só vira conserto o que reproduzir | Passos 1 e 2 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D2 | C20: o Gustavo confere o aviso ao aluno (aviso interno em "Para fazer" e push no APK); o push depende de `TREINOS_PUSH_HABILITADO` (padrão `false`, valor em produção não conferido); nada em produção neste plano | Passo 12 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D3 | C03, forma: bloco da semana no Início com os sete dias e a contagem de cada um, usando `GET /agenda/resumo` (sem API nova); tocar no dia abre a Agenda naquele dia | Passos 3 e 4 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D4 | C03, semana de segunda a domingo, igual à Agenda, sem mês no topo (o pedido da reunião foi domingo a sábado com mês no topo; mostrar na validação, trocar é só regra pura) | `agendaCalendario.ts:40-41` | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D5 | C03, onde mora: bloco novo no Início editável (tamanho, ocultar, ordem); regra de datas em `dominio/` com teste antes da tela; a tela é do executor-front | `AGENTS.md` (Início do treinador, não reconferido) | Regra do projeto |
| D6 | C21, quem avisa: só o aluno, acrescentando 30 minutos aos lembretes locais de 1 dia e 2 h; aviso ao treinador é contrato grande (push, token, fila, permissão, migration) e fica fora, em frente própria | Passo 8 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D7 | C08, forma: bloco "Aniversários" no Início do treinador (hoje e próximos 7 dias), pela data de nascimento que o aluno já tem (V070); sem mensagem automática ao aluno | Passos 5 a 7 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D8 | C22, menor versão: filtro por aluno no painel "Filtros da agenda", filtrando no app a lista já carregada; "mais simples" não tem detalhe, perguntar na validação com o filtro à vista | Passo 9 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D9 | C10: só o filtro por tipo de plano (treino, dieta, os dois, nenhum), no lugar de "com/sem treino ativo"; tags ficam fora; passo opcional, só se sobrar tempo | Passo 10 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D10 | C18 e C19: nada a fazer, só explicar ao treinador | Passo 12 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D11 | O bloco do Início não mostra nome de aluno: só contagens; nomes só na Folha | `AGENTS.md` (não reconferido) | Regra do projeto |
| D12 | Data de nascimento é dado pessoal: a API só a entrega com `ALUNO_LER`, nunca vai a log, auditoria nem DTO de outro aluno; o campo novo do `/painel` devolve só nome e o próximo aniversário (nunca data de nascimento, ano nem idade); o bloco exige a mesma permissão | `AGENTS.md` (item de data de nascimento, V070) | Regra do projeto |
| D13 | Sem camada de compatibilidade nem migração de legado | `AGENTS.md` | Regra do projeto |
| D14 | Cartão "Agenda" que já existe no Início: tirar e deixar só o bloco novo (os dois leem a mesma consulta e o novo já mostra o total) | Passo 3 retira o bloco `agenda` antigo e seus testes | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D15 | O número de cada dia soma compromissos e eventos pessoais (o Evento é o compromisso sem aluno, C19); o Todos/Meus filtra só compromissos | Passo 3 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D16 | Aniversário de menor de idade entra, mostrando só nome e dia (nunca idade nem ano); a alternativa é tirar menores em uma linha | Passo 5 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D17 | Aluno nascido em 29/02, em ano sem 29/02, avisa em 28/02 | Passo 5 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D18 | Filtro por aluno: com aluno escolhido só compromissos e atualizações daquele aluno (eventos pessoais fora); na visão Ano o filtro não vale (a contagem vem de `/agenda/resumo`, que não aceita aluno) e a tela diz isso. A alternativa, `alunoId` na API, é contrato e fica fora | Passo 9 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D19 | Aniversário: aviso só para o treinador, nos próximos 7 dias, sem mensagem ao aluno | Passo 6 em diante | Decidido pela recomendação em 16/11, conferir com o Gustavo |

## Passos
- [ ] 1. Reproduzir C16 e C17 e registrar o que se viu — executor: executor (Playwright local; o Gustavo na janela do treinador se não reproduzir) · tamanho: P · migration: não · APK: não · API: nenhuma (só medição) · commit: —
  - C16, em largura de PC (janela ≥ 768 px, comparar com janela estreita), com a aba Rede aberta: cada clique em "Editar" no resumo do compromisso dispara nova busca `GET /agenda/compromissos`? O cartão ancorado some antes de a folha abrir? Há dois `role="dialog"` ao mesmo tempo? Gravar no DevTools (Performance).
  - Hipóteses a separar (nenhuma provada): (1) o foco devolvido ao item da grade expande o rótulo quando a folha abre; (2) `useFocusEffect` refaz as consultas quando o histórico muda; (3) medição inicial do cartão (altura 0 para real). Só a reprodução diz qual.
  - C17, a 1920, 2560 e 3440 px de largura (altura útil da janela anotada), medir o fim da grade contra o fim da janela e a altura do que fica acima, para comparar com o desconto fixo de 320 px (`GradeDeHorarios.tsx:54`). Hipótese: o desconto fixo é maior que o real.
  - Saída: duas linhas por defeito em "O que ficou para trás" ou aqui: reproduziu ou não, em que largura, qual hipótese.
- [ ] 2. Corrigir só o que o passo 1 reproduziu — executor: executor (C16) e executor-front (C17, ajuste de layout) · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Correção provável, hipótese: C16, não devolver o foco ao item quando a ação é Editar, ou abrir a folha antes de remover o cartão; C17, trocar o desconto fixo por medida real (`onLayout` ou `flex: 1` com `minHeight`).
  - Não quebrar "Abrir detalhes" e "Cancelar" do mesmo resumo; `Folha` e `historicoDasFolhas` são do app inteiro (não mexer sem necessidade); `GradeDeHorarios` serve Dia e Semana no PC.
  - Teste: e2e do Editar a 1280 px em `app/e2e/agenda-composicao.spec.ts` (existe), ampliado para o sintoma achado (nenhum segundo diálogo, nenhuma nova busca, foco certo); para C17, e2e medindo o vão em 1920 e 2560 px. Passo sem efeito se nada reproduziu.
- [ ] 3. Regra da semana e registro do bloco `semana` — executor: executor · tamanho: M · migration: não · APK: não · API: nenhuma (usa `GET /agenda/resumo`) · commit: —
  - Regra pura em `dominio/` (arquivo novo, ex.: `semanaDoInicio.ts`, para não engordar `painelDoInicio.ts`): os 7 dias de segunda a domingo, contagem de cada dia a partir de `ResumoDaAgenda.dias` (dia que não vem é zero de verdade, como em `compromissosDaSemana`), rótulo curto do dia, o "hoje" e o destino de cada dia: `/treinador/agenda?visao=dia&data=AAAA-MM-DD` (mais `meus=true` em Meus). Teste de unidade antes da tela (virada de semana e de mês, domingo, dia zerado, resumo vazio, "Meus").
  - Registro: `BLOCOS_DO_PAINEL` (no começo da lista, para ver a semana ao abrir) e `TAMANHO_PADRAO_DO_BLOCO` (2, como a Agenda); em `painelDoInicio.ts` títulos, descrições, disponibilidade (`AGENDA_LER`), consultas (reusa a consulta da agenda, uma chamada só), endereço e montagem, com formato novo em `BlocoDoPainel` (lista de 7 dias no lugar de `cartoes`). Os `Record` exaustivos falham no typecheck e guiam.
  - Conferir sem mudar: `preferencias.ts` (id novo entra no fim da ordem salva), `grade.ts`, `EditarPainel.tsx`. Retirar o bloco `agenda` antigo e seus testes (D14); ajustar `painelDoInicio.test.ts`, `preferencias.test.ts`, `grade.test.ts`.
- [ ] 4. Tela do bloco da semana — executor: executor-front · tamanho: M · migration: não · APK: não · API: depende de `GET /agenda/resumo` (já existe) · commit: —
  - Peça nova dentro de `treinador/painel/BlocoDoPainel.tsx` (novo ramo ao lado de `cartoes`, `RoscaDosAlunos`, `BarrasDoRecebido`); faixa, Todos/Meus, atualizar e abrir iguais aos outros blocos. Cada dia é um alvo de toque ≥ 44 px (`ALVO_TOQUE`) com o dia e o número; o rótulo falado diz "quinta-feira, 3 compromissos. Abrir o dia". Hoje com a marca (lista fechada de `docs/design-e-front.md`, "dia de hoje"); número neutro, sem cor por quantidade (cor é sinal); zero em cinza com o "0".
  - A 390 px sete células de 44 px não cabem lado a lado com espaço: escolher entre uma linha de dias que cabe (alvo menor que 44 não vale) ou lista de uma linha por dia no tamanho Pequeno, sem rolagem horizontal. Estados: carregando (esqueleto), "Não carregou" com Atualizar, semana vazia (frase, não 7 zeros soltos).
  - e2e novo (`painel.spec.ts` ou arquivo próprio): contagem de cada dia com dados fictícios, toque leva a `visao=dia&data=`, Meus, Pequeno/Médio/Grande, ocultar no Editar; ajustar as contagens de blocos e de "Só os meus alunos" de `painel.spec.ts`.
- [ ] 5. API: aniversários no `/painel` — executor: executor · tamanho: M · migration: não · APK: não · API: sim, campo novo `aniversariantes` no DTO `PainelTreinador` (contrato leve) e tipo espelhado em `app/src/api/tipos.ts`; exige revisão independente · commit: —
  - A lista de alunos (`GET /alunos`) não traz `dataNascimento` (só a ficha, e é paginada), então calcular no app não serve; o `/painel` já carrega os alunos ativos do escopo e respeita Todos/Meus, no molde de `pastasParaRenovar` (`PainelService.java:69,87`).
  - Campo `aniversariantes`: lista (até 20; `// shortcut: teto de 20 sem total, trocar se alguma consultoria passar disso`) de `{ aluno: {id, nome}, data }`, onde `data` é o próximo aniversário (AAAA-MM-DD, fuso de Brasília) dentro de hoje + 7 dias, ordenada por data. **Nunca** devolver a data de nascimento, o ano nem a idade. Lista vazia sem `ALUNO_LER`. Regras de D16 e D17 aqui. Erro do cálculo não pode virar 500 do painel inteiro.
  - Testes: unidade da regra (virada de ano, 29/02, hoje, dia 7, dia 8, sem data, inativo) e caso em `PainelContagensIntegrationTest` (escopo `meus`, sem `ALUNO_LER`, aluno de outra consultoria não aparece). Mocks tipados do app que têm `pastasParaRenovar` ganham o campo.
- [ ] 6. Regra e registro do bloco `aniversarios` no app — executor: executor · tamanho: M · migration: não · APK: não · API: depende do passo 5 (campo `aniversariantes`) · commit: —
  - Mesmos lugares do passo 3, com disponibilidade `PAINEL_VER` e `ALUNO_LER`, consulta da fonte `painel` já existente. Bloco só com contagens ("Hoje: N", "Próximos 7 dias: N"), sem nome; o toque abre uma **Folha** com os nomes e o dia ("hoje", "amanhã", "em 3 dias"), cada linha abre a ficha (função de Folha no molde de `folhaPastasARenovar`).
  - Testes de unidade da contagem e da Folha (vazia, 1, 20, hoje, "Meus", `aniversariantes` ausente = "Não carregou", nunca zero). Ajustar de novo as contagens de blocos dos testes (somam-se ao passo 3).
- [ ] 7. Tela do bloco "Aniversários" e da Folha — executor: executor-front · tamanho: M · migration: não · APK: não · API: depende do passo 5 · commit: —
  - Reaproveitar `CartaoMini` e `FolhaDoPainel` (nada de peça nova se der). Cor contida: nada de balão, confete ou cor de festa; zero em cinza. Estados: carregando, "Não carregou", nenhum aniversário (texto, bloco continua visível), sem permissão (bloco some). e2e no mesmo arquivo do passo 4 e Ajuda do Início (`ajuda/conteudo.ts`, o texto dos blocos) com Semana e Aniversários.
- [ ] 8. Lembrete de 30 minutos para o aluno (C21) — executor: executor · tamanho: P · migration: não · APK: **sim** (notificação local; sem `expo-updates` em `app/package.json` e `app/app.json`, então vale APK novo; só em aparelho) · API: nenhuma · commit: —
  - `dominio/lembretesCompromisso.ts`: `AntecedenciaDoLembrete` ganha `'30m'` e a lista `ANTECEDENCIAS` uma linha, com texto sem horário (ex.: "Você tem um compromisso em 30 minutos. Abra o app para ver."); atualizar o comentário de cabeçalho que diz "1 dia e 2 h". O identificador e o cancelamento por prefixo não mudam.
  - Limite: 20 compromissos × 3 + as 3 da atualização = 63, cabe nos 64 do iOS (`LIMITE_DE_NOTIFICACOES_LOCAIS`); Android não tem teto. Se outro lembrete entrar depois, rever as reservadas.
  - Testes: `lembretesCompromisso.test.ts` (compromisso daqui a 40 min só ganha o de 30 min; daqui a 20 min nenhum; o teste dos 20 compromissos passa de 40 para 60) e `aluno/compromissos/lembretes.test.ts`. Texto do interruptor, Ajuda e `preferencias.ts` passam a dizer "1 dia, 2 horas e 30 minutos antes". Na web nada muda (lembrete local é no-op; hipótese do rascunho, não reconferida).
- [ ] 9. Filtro por aluno na Agenda (C22) — executor: executor · tamanho: M · migration: não · APK: não · API: nenhuma (a API não aceita aluno em `GET /agenda/compromissos`; filtra no cliente pelos participantes) · commit: —
  - `dominio/filtrosDaAgenda.ts`: `FiltrosDaAgenda` ganha `aluno` (id ou vazio); ler do endereço (`?aluno=<id>`), chip "Aluno: …" e remoção do filtro. O filtro só se aplica depois da carga (compromissos pelo participante; atualizações pelo aluno; eventos fora, D18), então a chave de cache não muda e não há busca nova. Na visão Ano o filtro não vale e a tela diz.
  - Seletor no painel "Filtros da agenda" reaproveitando `EscolhaEmFolha` e `listarAlunos` como em `CamposDoCompromisso.tsx` (extrair a busca de aluno para peça compartilhada em vez de copiar). O nome do aluno é dado pessoal: só na tela, nunca em endereço de log (o endereço leva só o id).
  - Testes: unidade de `filtrosDaAgenda.test.ts` e do filtro de itens; e2e em `filtros-laterais-fase-c.spec.ts` (existe) a 390 e 1280 px.
- [ ] 10. (Opcional, só com o aceite do Gustavo) Filtro da lista de alunos por tipo de plano (C10) — executor: executor · tamanho: M · migration: não · APK: não · API: sim, enum `Plano` (de `COM|SEM` para treino, dieta, ambos, nenhum) e parâmetro `plano`, com tipos espelhados (contrato leve); exige `mvn verify` · commit: —
  - API: `FiltrosDaListaDeAlunos.Plano` e a subconsulta `planoAtivo` (existe para o treino; ganha a irmã para a dieta). Permissão do filtro segue "cada filtro pede a permissão de quem já vê o dado": exigir `TREINO_LER` e `DIETA_LER`; o app esconde o filtro sem as duas. Sem legado: os valores antigos somem.
  - App: `filtrosDeAlunos.ts`, `SeletoresDosFiltrosDeAlunos.tsx`, chave de endereço, `pedidoDaApi` e chips; ajustar `filtrosDeAlunos.test.ts`, `lista-alunos-filtros.spec.ts` e `AlunoFiltrosIntegrationTest.java` (linhas não reconferidas).
- [ ] 11. Atualizar os documentos — executor: executor-rapido (texto já decidido; arquivo gerado nunca à mão) · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - `docs/planos/agenda-calendario.md`: o rascunho diz que D8 e a linha de Fora do escopo ("o aluno não guarda data de nascimento") estão desatualizados desde a V070: reescrever dizendo que o aniversário entrou no Início (este plano); D13 ganha o lembrete de 30 minutos e as contas do limite. `AGENTS.md`: lista de blocos do Início (hoje oito) e Agenda presencial (lembretes 1 dia e 2 h); `docs/planos/inicio-editavel.md`; `docs/planos/README.md`. Informar quais arquivos de `docs/planos/` foram tocados.
- [ ] 12. Conferências e conversa com o treinador — executor: Gustavo · tamanho: P · migration: não · APK: sim (push e lembrete no aparelho) · API: nenhuma · commit: —
  - C20: criar compromisso para um aluno de teste, ver o aviso em "Para fazer" na web e, no APK, o push (só com `TREINOS_PUSH_HABILITADO` ligada; conferir o valor em produção é dele, sem escrita neste plano). E-mail de aviso de compromisso não existe.
  - C18 e C19: explicar que o compromisso aceita de 1 a 20 alunos e que Criar > Evento é o compromisso sem aluno, na mesma grade.
  - Validar com o treinador a semana (segunda a domingo, sem mês no topo), os aniversários, o filtro por aluno, e perguntar o que ele quer dizer com "Agenda mais simples" e a quem avisar 30 minutos antes.

## Critérios de aceite
- Cada passo conferido a 390 px e a 1280 px, web e APK (o passo 8 só no APK, porque notificação local não existe na web), nos temas claro, escuro, areia e contraste alto, com dados fictícios.
- Início com `AGENDA_LER`: o bloco da semana mostra os sete dias de segunda a domingo, a contagem certa de cada dia (compromissos mais eventos) e o dia de hoje marcado; tocar no dia abre a Agenda em Dia naquela data; em Meus o destino leva `meus=true`; sem a permissão o bloco some.
- O bloco da semana e o de aniversários aparecem no Editar do Início, mudam de tamanho, sobem, descem e se ocultam; a preferência já salva continua valendo e o bloco novo entra no fim.
- Aniversários: aparece quem faz aniversário hoje e nos próximos 7 dias (alunos ativos do escopo Todos/Meus); o bloco mostra só contagens e a Folha mostra nome e dia; nenhum campo da API traz data de nascimento, ano ou idade; sem `ALUNO_LER` o bloco some e a API devolve lista vazia; aluno de outra consultoria nunca aparece.
- Lembrete: compromisso daqui a mais de 30 min ganha o lembrete de 30 min; 20 compromissos ficam em 60 notificações mais as 3 da atualização, sem passar de 64; texto sem horário nem nome.
- Agenda: com aluno escolhido só aparecem os compromissos e atualizações dele, o chip tira o filtro, o endereço leva `aluno=<id>` e a visão Ano diz que não filtra; sem filtro nada muda.
- C16 e C17: cada um está reproduzido (largura, passo e hipótese registrados) ou registrado como "não reproduziu"; o que reproduziu está corrigido com teste.
- `npm run typecheck`, `npm run lint`, `npm test` em `app/` e os e2e das telas mexidas; `mvn verify` em `api/` nos passos 5 e 10.
- O treinador diz "resolvido" quando abre o Início e vê a semana com quantos compromissos tem em cada dia (tocar cai naquele dia da Agenda), vê quem faz aniversário na semana, escolhe um aluno na Agenda e vê só os dele, o detalhe não pisca e a grade não deixa vão (se reproduzido), e o aluno de teste recebe o aviso 30 minutos antes.

## Riscos e revisão
- Passo 5 (dado pessoal no `/painel`, escopo Todos/Meus, permissão, isolamento por consultoria): pede **revisão independente** (segurança e LGPD). Os demais passos pedem só a revisão do diff.
- O pedido foi domingo a sábado com o mês no topo; o plano segue segunda a domingo, igual à Agenda. Mostrar na validação; trocar é só regra pura.
- `painel.spec.ts` e outras specs contam blocos e "Só os meus alunos": o bloco novo muda essas contagens; ajustar junto, sem relaxar a conferência.
- O campo novo não pode atrasar nem derrubar o `/painel`: lista vazia é valor válido.
- Aviso de 30 minutos vira falso se o compromisso for remarcado sem o aluno abrir o app (mesmo limite já aceito para o de 2 h); o push, se ligado, não cancela lembrete local.
- Filtro por aluno no cliente só vale para a janela já carregada; a visão Ano não filtra.
- C16 e C17 podem não reproduzir em lugar nenhum; nesse caso ficam registrados e o plano não inventa conserto.
- Não conferido: valor de `TREINOS_PUSH_HABILITADO` em produção; comportamento no iPhone (sem aparelho).

## Fora do escopo
- C23 (notificações em massa agendadas): declarado fora em `docs/planos/contato-da-consultoria.md` (linha não reconferida).
- C09 (Kanban de alunos): sem colunas definidas. C04 e C05 (painéis novos sem definição).
- Tags de aluno (parte de C10): campo, migration e tela de gestão. **Aceito pelo Gustavo em 18/11/2026**; plano em [tags-de-aluno.md](tags-de-aluno.md).
- Aviso de 30 minutos ao treinador (parte de C21): contrato grande (push ao treinador), D6.
- Mensagem automática de aniversário ao aluno e aniversário na Agenda (C08): só o bloco no Início.
- "Agenda mais simples" além do filtro (C22): sem definição do treinador.
- E-mail de aviso de compromisso (C20): não existe; pedido só se alguém quiser.

## O que ficou para trás
- (nada ainda)
