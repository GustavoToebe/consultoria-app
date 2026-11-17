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
| D10 | Numeração | V083 é o Café, V084 é este plano; a N2 do contato vai para V085 | Gustavo, 17/11 |
| D11 | Sem compatibilidade | `'1d'`/`'2h'` fixos saem, sem flag | regra do projeto |

## Passos
- [x] B2. API: V084, pedido, resposta, validação, GET do aluno; testes de Agenda, Flyway e Papéis (total 83 com a V084) e lista de migrations no `AGENTS.md` — executor · feito (sem commit) em 17/11/2026 · commit: — · evidência: ver "Contrato final da API" e o relatório da Onda 1B
- [ ] E. App: formulário, `dominio/lembretesCompromisso.ts` lendo a lista (teste primeiro), Conta do aluno, interruptor do treinador — executor-front para o formulário/telas e executor para a regra, na mesma frente (um responsável por arquivo) · depende de B2 · commit: —

## Contrato final da API (B2, feito sem commit, 17/11/2026)
Para o app (passo E) usar; a fonte é o código (`agenda/AgendaDtos`, `agenda/LembretesDoCompromisso`) e `LembretesDoCompromissoIntegrationTest`.
- **Campo:** `lembretesMinutos`, `number[]` (inteiros, minutos antes do início), no pedido e nas respostas. Banco: `compromisso.lembretes_minutos integer[] NOT NULL DEFAULT '{30}'` (V084), CHECK de 0 a 5 itens, cada um de 1 a 40320, sem nulo; compromissos antigos ficaram com `[30]`.
- **Regra decidida (a pergunta do pedido):** a lista aceita **0 a 5 itens**; **lista vazia = sem lembrete** (nenhum agendamento). Sem repetir. A ordem é a recebida (o app ordena como quiser; a API não reordena).
- **Pedido** (`POST /agenda/compromissos` e `PUT /agenda/compromissos/{id}`, `CompromissoRequest`): `lembretesMinutos` opcional. No POST, ausente/`null` = `[30]`. No PUT, ausente/`null` = **mantém a lista gravada** (a remarcação preserva); presente (inclusive `[]`) substitui, e com `escopo` `SEGUINTES`/`TODAS` vale para todas as ocorrências do escopo. O app deve mandar sempre a lista que a tela mostra.
- **Resposta da equipe** (`CompromissoResponse`, lista, detalhe, criar, alterar, situação): `lembretesMinutos` sempre presente (array, pode ser `[]`). Compromisso com vários alunos (V042) e cada ocorrência de série têm a própria lista, igual para todos os participantes.
- **Resposta do aluno** (`GET /aluno/compromissos`, `CompromissoDoAluno`): `lembretesMinutos` presente, mesma regra. Os avisos (`/aluno/avisos-de-compromisso`) não mudam.
- **Validação:** 422 `COMPROMISSO_INVALIDO` com `fieldErrors`: `lembretesMinutos` (mais de 5 itens ou itens repetidos) e `lembretesMinutos[i]` (item `i`, base 0, nulo ou fora de 1 a 40320); a mensagem nunca traz o valor enviado. Valor que não é inteiro ou estoura o `int` cai no 400 padrão de JSON malformado. Outra consultoria: 404, como o resto da agenda.
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
