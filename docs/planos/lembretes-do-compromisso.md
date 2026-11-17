# Lembretes do compromisso (antecedências escolhidas)

Situação: Em andamento (API na Onda 1B, app na Onda 2E da sessão de 17/11/2026) · Onde: main · Atualizado: 17/11/2026 · Base: `e6537dc3`

Fonte: decisões do Gustavo de 17/11/2026. Validade: vale enquanto `dominio/lembretesCompromisso.ts` usar antecedências fixas ('1d'/'2h'); depois da entrega, ela é a fonte.

## Objetivo
Quem marca o compromisso escolhe quando ser lembrado, no estilo do Google Agenda: até 5 notificações, cada uma com número e unidade (minutos, horas, dias), padrão 30 minutos antes.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Dado | uma coluna no compromisso com até 5 antecedências em minutos, de 1 a 40320, padrão `[30]`; migration **V084** | Gustavo, 17/11 |
| D2 | Validação | 422 no campo, sem repetir o valor | Gustavo, 17/11 |
| D3 | API | `GET /aluno/compromissos` passa a trazer as antecedências | Gustavo, 17/11 |
| D4 | Formulário | "Adicionar notificação": número + minutos/horas/dias + X para remover; até 5; padrão 30 min | Gustavo, 17/11 |
| D5 | Texto da notificação | sem horário e sem nome | Gustavo, 17/11 |
| D6 | Quem recebe | alunos e o treinador responsável, por notificação local no celular | Gustavo, 17/11 |
| D7 | Interruptor | o aluno desliga no que já existe (Conta); o treinador ganha o mesmo no app do celular | Gustavo, 17/11 |
| D8 | Web | não há notificação | Gustavo, 17/11 |
| D9 | APK | notificação local e interruptor novo exigem APK novo | decorrência |
| D10 | Numeração | V083 é o Café, V084 é este plano; a N2 do contato vai para a próxima migration livre na hora do merge (V085 ficou com o nome exibido do aluno e V086 com o CHECK de kcal) | Gustavo, 17/11 |
| D11 | Sem compatibilidade | `'1d'`/`'2h'` fixos saem, sem flag | regra do projeto |

## Passos
- [x] B2. API: V084, pedido, resposta, validação, GET do aluno; testes de Agenda, Flyway e Papéis (total 83 com a V084) e lista de migrations no `AGENTS.md` — executor · feito em 17/11/2026 · commit: `324023a6` (V084, API) e `66acd38f` (V083, Café) · evidência: ver "Contrato final da API" e o relatório da Onda 1B
- [ ] E. App: formulário, `dominio/lembretesCompromisso.ts` lendo a lista (teste primeiro), Conta do aluno, interruptor do treinador — executor-front para o formulário/telas e executor para a regra, na mesma frente (um responsável por arquivo) · depende de B2 · commit: `87368655` (regra, notificações, Conta do aluno, interruptor do treinador) e `d0378d7c` (formulário)
  - Formulário feito (commit `d0378d7c`), 17/11/2026, executor-front: "Notificações" só no formulário completo (fim de "Detalhes"; o painel rápido diz "notificações" na linha do rodapé quando não é a padrão), linha = número + unidade (`EscolhaEmFolha` minutos/horas/dias) + X, até 5, padrão `[30]`, nova linha com a primeira livre de 10 min, 30 min, 1 h, 2 h, 1 dia, 2 dias; **ordem digitada** (a API não reordena e o `lembretesMinutos[i]` do 422 aponta a linha enviada); exibição na maior unidade exata (1440 → 1 dia, 120 → 2 horas, 90 → 90 minutos); trocar a unidade mantém o número (29 dias é erro). Regra em `dominio/antecedenciaDoLembrete.ts` (+ teste), estado e pedido em `dominio/agendaPresencial.ts` (o pedido manda sempre `lembretesMinutos`, no POST e no PUT, também `[]`), tela em `treinador/agenda/ListaDeNotificacoes.tsx`, `CamposDoCompromisso.tsx`, `FolhaCompromisso.tsx` (422 nos lembretes vai ao campo e abre o completo). E2e novo em `e2e/agenda-composicao.spec.ts` ("Notificações do compromisso", 390 e 1280) e corpos do POST ajustados em `agenda-presencial.spec.ts`: **escritos, não rodados** (Onda 5). Verificado: typecheck (sem erro nos arquivos da frente), lint e jest dos arquivos tocados. Não conferido renderizado.

- [x] E (regra e notificações, executor) — feito em 17/11/2026 · commit: `87368655` · evidência: `npm run typecheck` sem erro nos arquivos tocados, `npm run lint` 0 erros, jest de `dominio/lembretesCompromisso`, `aluno/compromissos` e `treinador/agenda/lembretes` verdes (39 testes). Notificação real no celular **não conferida** (pede APK).

## App: regra e notificações (passo E, parte do executor, 17/11/2026)
- **Regra** (`dominio/lembretesCompromisso.ts`, teste primeiro): lê `compromisso.lembretesMinutos`; `'1d'`/`'2h'` e `AntecedenciaDoLembrete` saíram sem compatibilidade (D11). Chave `<id>:<minutos>`, identificador `treinos:compromisso:<usuarioId>:<id>:<minutos>`; lista vazia = nada; passado descartado; ordem por disparo e corte em 64 menos as reservadas (com 5 por compromisso o corte já aparece com 13 compromissos).
- **Texto único** (D5): "Você tem um compromisso chegando. Abra o app para ver." Os dois textos antigos ("amanhã", "daqui a pouco") saíram porque a antecedência agora é livre.
- **Aluno:** `CompromissosDoAlunoProvider` reagenda também quando só as antecedências mudam (a assinatura da lista inclui `lembretesMinutos`); `aluno/compromissos/lembretes.ts` aceita `CompromissoParaLembrete[]`.
- **Treinador responsável (D6):** `treinador/agenda/lembretes/LembretesDoTreinador.tsx`, montado no layout do treinador; reaproveita `aluno/compromissos/lembretes.ts` (o prefixo já leva o id do usuário). Busca `GET /agenda/compromissos?responsavel=<ele>&situacao=AGENDADO` dos próximos 60 dias (a API limita a 62), ao abrir, a cada troca de tela e quando o app volta para a frente; o compromisso lembra se não está cancelado e algum aluno segue `AGENDADO` (`compromissosDoResponsavelParaLembrete`). Só com `AGENDA_LER`, preferência `lembretesCompromisso` ligada e fora da web (D8). Sair da conta apaga (`aoSair`).
- **Interruptor do treinador (D7):** o mesmo `InterruptorDeLembretesDeCompromisso` do aluno em `app/treinador/ajustes.tsx` via `extras` (com `AGENDA_LER`; some na web). O texto do interruptor ficou genérico ("na antecedência escolhida em cada compromisso"); o painel "Restaurar padrão" avisa do lembrete também ao treinador no celular.
- **Fixtures:** `lembretesMinutos: [30]` nos mocks de `agendaTipos` em e2e e testes (só o que o typecheck pediu).
- **Limites conhecidos:** o treinador só agenda compromissos dos próximos 60 dias; sessão do treinador recusada com o app fechado não apaga os lembretes dele (só o "Sair" e a recusa com o app aberto passam por `aoSair`); sem `AGENDA_LER` depois de ter ligado, o que já estava agendado fica até o próximo "Sair".
- **Exige APK novo (D9):** `expo-notifications` do treinador (primeira vez que a área do treinador agenda notificação local), o interruptor novo no celular e a regra nova de antecedência no aluno. Na web nada muda além do formulário.

## Contrato final da API (B2, feito em 17/11/2026, commits `324023a6` e `66acd38f`)
Para o app (passo E) usar; a fonte é o código (`agenda/AgendaDtos`, `agenda/LembretesDoCompromisso`) e `LembretesDoCompromissoIntegrationTest`.
- **Campo:** `lembretesMinutos`, `number[]` (inteiros, minutos antes do início), no pedido e nas respostas. Banco: `compromisso.lembretes_minutos integer[] NOT NULL DEFAULT '{30}'` (V084), CHECK de 0 a 5 itens, cada um de 1 a 40320, sem nulo; compromissos antigos ficaram com `[30]`.
- **Regra decidida (a pergunta do pedido):** a lista aceita **0 a 5 itens**; **lista vazia = sem lembrete** (nenhum agendamento). Sem repetir. A ordem é a recebida (o app ordena como quiser; a API não reordena).
- **Pedido** (`POST /agenda/compromissos` e `PUT /agenda/compromissos/{id}`, `CompromissoRequest`): `lembretesMinutos` opcional. No POST, ausente/`null` = `[30]`. No PUT, ausente/`null` = **mantém a lista gravada** (a remarcação preserva); presente (inclusive `[]`) substitui, e com `escopo` `SEGUINTES`/`TODAS` vale para todas as ocorrências do escopo. O app deve mandar sempre a lista que a tela mostra.
- **Resposta da equipe** (`CompromissoResponse`, lista, detalhe, criar, alterar, situação): `lembretesMinutos` sempre presente (array, pode ser `[]`). Compromisso com vários alunos (V042) e cada ocorrência de série têm a própria lista, igual para todos os participantes.
- **Resposta do aluno** (`GET /aluno/compromissos`, `CompromissoDoAluno`): `lembretesMinutos` presente, mesma regra. Os avisos (`/aluno/avisos-de-compromisso`) não mudam.
- **Validação:** 422 `COMPROMISSO_INVALIDO` com `fieldErrors`: `lembretesMinutos` (mais de 5 itens ou itens repetidos) e `lembretesMinutos[i]` (item `i`, base 0, nulo ou fora de 1 a 40320); a mensagem nunca traz o valor enviado. Mais de 5 itens recusa logo, só com o erro `lembretesMinutos` (sem um erro por item; o DTO não tem `@Size`, então uma lista enorme não gera resposta enorme). Coerção do Jackson 3 (testada em `LembretesDoCompromissoIntegrationTest`): `30.5` é truncado para 30 e `"30"` é aceito como 30 (padrão do Jackson, não rejeitado: o app só manda inteiro, e mudar isso pede configuração do mapper, fora do escopo); texto que não é número (`"abc"`) e objeto dão 400 de JSON ilegível. Outra consultoria: 404, como o resto da agenda.
- **Não mudou:** exportação LGPD (`CompromissoExportado`) não leva a lista (preferência de aviso, não dado pessoal; o app pode pedir se quiser); `AgendaCalendario` e `ResumoDaAgenda` não expõem compromisso por esse DTO. Texto da notificação, quem recebe e interruptor seguem no app (D5 a D7).
- **Junto (V083):** o tema Café saiu (`Consultoria.Tema` sem `CAFE`; quem usava passou a `ESCURO`); `GET /consultoria` e a marca pública nunca mais devolvem `CAFE`. O app precisa tirar `CAFE` das paletas (lado da Onda 2).

## Critérios de aceite
- Teste da regra: lista vazia, 5 itens, duplicados, valores nos limites 1 e 40320, compromisso remarcado.
- 422 sem eco do valor; GET do aluno traz a lista; migration cobre compromissos existentes com `[30]`.
- Verificado só na web (sem notificação); o resto fica para o APK, listado no relatório.

## Fora do escopo
- Notificação por e-mail ou WhatsApp (é o N2 do plano de contato).

## O que ficou para trás
- (nada ainda)
