# Agenda presencial do consultório

Situação: Código pronto, falta rodar os testes de integração e o e2e no checkout principal · Onde: branch `evo-agenda` (worktree `wt-evo-agenda`) · Atualizado: 28/10/2026

## Objetivo
A equipe marca compromissos presenciais com os alunos (consulta, retorno, avaliação) e vê, na tela Agenda, os
compromissos e as atualizações juntos, por dia ou por semana. O aluno vê os próprios próximos compromissos no Início.
Referência: "Minha Agenda" do concorrente (calendário com consultas, retornos e compromissos).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Quem marca | Só a equipe; o aluno não escolhe horário | Gustavo |
| 2 | Campos | Aluno (ativo, não anonimizado), responsável (membro ativo), início, duração 5 a 480 min, local até 120, observação até 500, situação `AGENDADO`/`REALIZADO`/`CANCELADO`/`FALTOU`, `versao` | Gustavo |
| 3 | Fora do escopo | Recorrência, lembrete, Google Agenda | Gustavo |
| 4 | Conflito | Mesmo responsável, dois não cancelados sobrepostos = 409 `HORARIO_OCUPADO`; encostar (10:00 termina, 10:00 começa) não é conflito; realizado e falta continuam ocupando o horário | Gustavo (encostar e realizado/falta: Claude) |
| 5 | Trava contra reserva simultânea | `ConsultoriaRepository.travar` antes de contar, em toda escrita (criar, remarcar, mudar situação). Escolhida no lugar da linha do responsável porque remarcar pode trocar o responsável e a agenda tem pouco movimento; a mesma trava já serializa membros e plano aplicado | Claude |
| 6 | Fuso | Sempre America/Sao_Paulo: o pedido traz `data` + `hora` de Brasília, o banco guarda `timestamptz`, a resposta traz `inicio`/`fim` (instantes) e `data`/`hora`/`horaFim` de Brasília. A listagem pega o que **toca** o período (o das 23:30 de 60 min aparece também no dia seguinte) | Gustavo (sobreposição na listagem: Claude) |
| 7 | Permissões | `AGENDA_LER` (depende de `ALUNO_LER`, porque a agenda mostra o nome do aluno) e `AGENDA_ALTERAR` (depende de `AGENDA_LER`); não sensíveis; Treinador, Nutricionista e Assistente recebem as duas por gatilho próprio (`consultoria_perfis_padrao_agenda`), como as da inscrição | Gustavo (dependência de `ALUNO_LER`: Claude) |
| 8 | Observação | Dado sensível: nunca em log nem na auditoria; lida só com `ALUNO_SENSIVEL_LER` (senão `null`) e gravada só com `ALUNO_SENSIVEL_ALTERAR` (sem ela, ignorada e a gravada fica, como CPF e endereço). O Assistente marca sem ver nem apagar a observação | Claude |
| 9 | Situação | Mesma situação = nada muda e não audita; realizado e falta só depois do início (409 `COMPROMISSO_NO_FUTURO`); sair do cancelado volta a ocupar o horário e confere aluno, responsável e conflito de novo | Claude |
| 10 | Remarcar (PUT) | Exige aluno ativo (409 `ALUNO_INATIVO`/`ALUNO_ANONIMIZADO`) e responsável ativo; mudar a situação não exige (dá para cancelar o compromisso de quem saiu) | Claude |
| 11 | O que o aluno vê | `GET /aluno/compromissos`: os ainda não terminados, `AGENDADO` e `CANCELADO` (para saber que não vai acontecer), até 20; data, hora, duração, local, situação e o **nome** do responsável (precisa saber com quem vai se encontrar). Sem observação (texto de trabalho da equipe, como o nome do questionário) e sem ids | Claude |
| 12 | Privacidade | Exportação: seção `compromissos` com `AGENDA_LER` (com a observação: quem exporta já tem `ALUNO_SENSIVEL_LER`). Anonimizar e "Excluir minha conta" apagam todos os compromissos do aluno. Inativar não mexe | Gustavo (inativar: Claude) |
| 13 | Tela | Visões Dia e Semana (Semana = o dia de referência e os 7 seguintes, como a agenda de antes: o padrão segue igual), setas de 1 em 1 dia ou de 7 em 7. Mês ficou de fora | Claude |
| 14 | Atualizações na tela | Seguem as permissões de antes (`ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`) e só existem de hoje a hoje + 7 (`PROXIMAS`); a tela abre também só com `AGENDA_LER` | Gustavo (janela: Claude) |

## Passos
- [x] 1. API: V036, `agenda/` (entidade, repositório, serviço, controllers), permissões, exportação, anonimização, auditoria — commit d9c24b9
- [x] 2. Testes da API: `AgendaPresencialIntegrationTest` (escrito, **não rodou aqui: sem Docker**), `AgendaFusoTest`, `CatalogoPermissoesTest`, `ArquiteturaTest` (verdes) — commit d9c24b9
- [x] 3. App do treinador: tela Agenda com Dia/Semana, filtros (Todos/Meus, Membro, situação), `FolhaCompromisso`, atalho no Perfil — commit seguinte
- [x] 4. App do aluno: `aluno/CartaoCompromissos` no Início ("Seus compromissos", só leitura) — commit seguinte
- [x] 5. Regras puras `dominio/agendaPresencial.ts` com testes, e2e `agenda-presencial.spec.ts`, ajuda (treinador e aluno), `telas.ts` ("Novo compromisso" na busca), espelhos (`perfilEquipe.ts`, `acoesAuditoria.ts`, `permissoes.ts`) — commit seguinte

## Fora do escopo
- Recorrência, lembrete (push ou e-mail), integração com Google Agenda (decisão 3).
- Visão Mês.

## O que ficou para trás
- Rodar `AgendaPresencialIntegrationTest` (e a suíte toda, pelos totais 34 → 35 de migrations) com Docker. Escrito, compila; aqui não roda.
- Rodar o e2e `app/e2e/agenda-presencial.spec.ts` no checkout principal. Aqui ele passou (5/5, e mais 56 de `inicio-aluno`,
  `links-do-menu`, `listas-em-linha`, `financeiro` e `anamnese` sem regressão) só com o cache do Metro isolado
  (`TMPDIR` próprio) e porta própria: sem isso o `expo export` do worktree empacota as telas de `Saraiva-api` (o
  `node_modules` é link para lá) e o resultado não vale.
- Inativar o aluno não cancela os compromissos futuros dele (só anonimizar e "Excluir minha conta" apagam). Decidir se inativar deve cancelar.
- Com um membro escolhido no filtro, as atualizações somem da tela (a lista `PROXIMAS` só sabe filtrar "Meus").
- Visão Mês, lembrete e recorrência: fora do escopo.
- O app converte instante para Brasília com UTC−3 fixo (o Brasil não tem horário de verão desde 2019; o mesmo de
  `hojeEmBrasilia` do financeiro). A API usa a zona `America/Sao_Paulo` de verdade. Se o horário de verão voltar, só o
  app precisa mudar (`dominio/agendaPresencial.ts`).
- Compromisso de membro removido fica sem responsável; remarcar ou reativar pede um responsável ativo.

## Texto para o AGENTS.md
- Agenda presencial (`agenda/`, V036; plano `docs/planos/agenda-presencial.md`): compromissos que só a equipe marca com um aluno (ativo e não anonimizado, senão 409 `ALUNO_INATIVO`/`ALUNO_ANONIMIZADO`) e um responsável (membro ativo, `Usuario` conferido à mão; senão 404): início (`timestamptz`; o pedido traz `data` + `hora` **de Brasília**, `AgendaService.inicioEmBrasilia`, nunca o fuso do servidor; a resposta traz `inicio`/`fim` e `data`/`hora`/`horaFim` de Brasília), `duracao_minutos` 5–480, `fim` guardado, `local` ≤ 120, `observacao` ≤ 500 (dado sensível: nunca em log nem na auditoria; lida só com `ALUNO_SENSIVEL_LER`, senão `null`; gravada só com `ALUNO_SENSIVEL_ALTERAR`, senão ignorada e a gravada fica), situação `AGENDADO|REALIZADO|CANCELADO|FALTOU`, `versao`. Sem recorrência, lembrete nem Google. Conflito: o mesmo responsável não tem dois não cancelados sobrepostos (`inicio < fim do outro e fim > inicio`; encostar não conflita; realizado e falta ocupam) = 409 `HORARIO_OCUPADO`, sem nada do outro compromisso; toda escrita trava a consultoria (`ConsultoriaRepository.travar`) antes de contar, então duas reservas simultâneas ficam em série. Rotas (`AGENDA_LER`, que depende de `ALUNO_LER`; `AGENDA_ALTERAR`, que depende de `AGENDA_LER`; não sensíveis; Treinador, Nutricionista e Assistente recebem as duas pelo gatilho `consultoria_perfis_padrao_agenda`, como as da inscrição): `GET /agenda/compromissos?de=&ate=&responsavel=&situacao=` (dias de Brasília, o que **toca** o período, até 62 dias, 400 `PERIODO_INVALIDO` fora disso), `GET /agenda/compromissos/{id}`, `POST /agenda/compromissos`, `PUT /agenda/compromissos/{id}` (com `versao`, 409 `CONFLITO_EDICAO`; mesma conferência de horário, menos o cancelado) e `POST /agenda/compromissos/{id}/situacao {situacao, versao}` (mesma situação não muda nem audita; realizado/falta só depois do início, 409 `COMPROMISSO_NO_FUTURO`; sair do cancelado confere aluno, responsável e horário de novo). Aluno: `GET /aluno/compromissos` (`hasRole('ALUNO')`, os ainda não terminados, `AGENDADO` e `CANCELADO`, até 20; sem observação nem ids, com o nome do responsável). Outra consultoria = 404. Auditoria `COMPROMISSO_CRIADO/ALTERADO/SITUACAO_ALTERADA` com resumo fixo (espelho em `acoesAuditoria.ts`). Exportação: seção `compromissos` com `AGENDA_LER` (com a observação); anonimização e "Excluir minha conta" apagam os compromissos do aluno (`AgendaService.apagarDoAluno`, `MANDATORY`). Testes: `AgendaPresencialIntegrationTest` (conflito, duas threads, meia-noite, permissões, outra consultoria, aluno, privacidade), `AgendaFusoTest`. App: tela `treinador/agenda` (abre com as permissões das Atualizações **ou** `AGENDA_LER`, `podeAcessarTela`; cada parte só a quem pode vê-la): visões Dia e Semana (o dia e os 7 seguintes, como antes; setas de 1 ou 7 dias), filtros no endereço (`meus`, `membro`, `visao`, `data`, `situacao`; `novo=1` da busca abre o formulário e sai do endereço), um cartão por dia com os compromissos ("Compromisso · 09:00–10:00 · Sala 2 · com Ana", `Selo` da situação: Agendado âmbar, Realizado verde, Faltou vermelho, Cancelado cinza) e as atualizações ("Atualização"); "Novo compromisso" (primário, `AGENDA_ALTERAR`) e o toque no compromisso abrem `treinador/agenda/FolhaCompromisso` (detalhe com Editar, realizado/falta, cancelar com `PainelConfirmacao`; formulário com aluno em `EscolhaEmFolha`, responsável, `CampoData`, hora digitada HH:MM, duração, local, observação; aviso de sobreposição com a lista carregada e o 409 no formulário). Aluno: `aluno/CartaoCompromissos` ("Seus compromissos" no Início, depois das pendências, só leitura; some sem compromisso, offline ou com erro; nada fica no aparelho). Regras puras em `dominio/agendaPresencial.ts` (Brasília = UTC−3, sobreposição, dias da agenda, ações de situação, formulário). Atalho "Agenda" em Perfil › Atalhos e "Novo compromisso" na busca (`dominio/telas.ts`). Teste de tela: `e2e/agenda-presencial.spec.ts`.
