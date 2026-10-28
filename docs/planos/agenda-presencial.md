# Agenda presencial do consultório

Situação: Em andamento · Onde: branch `evo-agenda` (worktree `wt-evo-agenda`) · Atualizado: 28/10/2026

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
- [x] 1. API: V036, `agenda/` (entidade, repositório, serviço, controllers), permissões, exportação, anonimização, auditoria — commit: (ver abaixo)
- [x] 2. Testes da API: `AgendaPresencialIntegrationTest` (escrito, não rodou aqui: sem Docker), `AgendaFusoTest`, `CatalogoPermissoesTest`, `ArquiteturaTest`
- [ ] 3. App do treinador: tela Agenda com Dia/Semana, filtros e a Folha do compromisso
- [ ] 4. App do aluno: cartão no Início
- [ ] 5. Regras puras `dominio/agendaPresencial.ts` com testes, e2e, ajuda e `telas.ts`

## Fora do escopo
- Recorrência, lembrete (push ou e-mail), integração com Google Agenda (decisão 3).
- Visão Mês.

## O que ficou para trás
- (preencher ao concluir)

## Texto para o AGENTS.md
(preencher ao concluir)
