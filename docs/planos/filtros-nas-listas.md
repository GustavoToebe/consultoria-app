# Filtros nas listas (barra de filtros em todas as telas)

Situação: Lote 1 pronto na branch (só app); Lote 2 (API) planejado · Onde: branch `claude/filtros-nas-listas-lote1` (31/10) · Atualizado: 01/11/2026

## Objetivo
Levar a barra de filtros da lista de alunos (`ui/BarraDeFiltros`: busca, botão "Filtros" com a contagem, painel no PC,
folha no celular, "Filtrado por" com ✕) às outras listas do treinador, cada uma com os filtros que fazem sentido nela.
Lote 1 usa só o que a API já aceita hoje; o que pediria parâmetro novo fica no Lote 2.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo do lote 1 | Só app, sem parâmetro novo na API. Filtro que a rota não aceita só entra quando a lista vem inteira (filtrar uma página de uma lista paginada esconderia o que está nas outras) | Gustavo (pedido), Claude (regra da página) |
| D2 | Onde mora o filtro | Listas que a API filtra (Atualizações, Interessados, Cobranças, Lançamentos, Auditoria, Importação): no endereço, trocado por `router.setParams` (sem passo no histórico, volta à página 1), como na lista de alunos. Listas que filtram o que já veio inteiro e moram numa aba (Biblioteca, Questionários, Membros): estado da tela, porque trocar de aba já começa do zero | Claude |
| D3 | Busca | Opcional na barra (`busca` deixou de ser obrigatória): Lançamentos, Auditoria e Importação não têm busca útil na API | Claude |
| D4 | Período | Peça única `treinador/SeletoresDeFiltro` › `CamposDePeriodo` (De/Até em `CampoData`): só aplica quando os dois campos fazem sentido (vazio ou data válida, fim depois do início); data pela metade não apaga o filtro em vigor. Chip "Período: 01/10 a 31/10" | Claude |
| D5 | Atualizações | As abas de situação continuam (com a contagem, `?situacao=` com push). A barra traz busca local pelo nome (a lista vem inteira), Responsável (Todos, Meus alunos, uma pessoa: a API aceita uma) e Período (`de`/`ate`). Com pessoa ou período a contagem das abas some (o `/painel` só conhece o Meus); a revisão em fila ("Próxima ›") segue os mesmos filtros | Claude |
| D6 | Interessados | Lista e Kanban: busca (API), Responsável (Todos, Meus, Sem responsável, uma pessoa), Origem e, só na Lista, Situação (com a contagem). Situação, responsável e origem no endereço (`?situacao=&meus=&responsavel=&origem=`); `?retornos=ATE_HOJE` e `?visao=kanban&etapas=` continuam como estavam | Claude |
| D7 | Cobranças | Responsável (Todos/Meus), Situação e Vencimento (Qualquer, Próximos 7 dias = `?vencimento=PROXIMOS_7_DIAS`, ou um período `de`/`ate`). A faixa "Filtro: Vencimento de hoje até…" vira o chip "Vencimento: próximos 7 dias" | Claude |
| D8 | Lançamentos | Período (`de`/`ate`, pela data do lançamento) | Claude |
| D9 | Auditoria | Pessoa, Ação e Período passam do cartão "Filtros" para a barra, no endereço (`?usuarioId=&acao=&de=&ate=`) | Claude |
| D10 | Importação | Destino, Situação e Arquivo (Excel ou CSV: o histórico só guarda a extensão, então a antiga "busca pelo nome do arquivo" só achava a extensão). Período fica para o Lote 2: a lista é paginada | Claude |
| D11 | Membros da equipe | Busca local (nome ou e-mail), Situação (Ativos, Inativos, Convite pendente) e Perfil (vários) | Claude |
| D12 | Questionários | Busca local (já existia), Situação (Ativos/Arquivados, pela API) e Publicação (Publicados, Nunca publicados, Alterados desde a publicação; local) | Claude |
| D13 | Biblioteca | Exercícios: busca e grupo muscular; Alimentos: busca e fatores; Suplementos: busca; Outros: busca e categoria; Catálogo: busca e grupo. Tudo filtrado no que já veio (o catálogo pela API, como antes) | Claude |

## Passos
- [x] 1. Barra: busca opcional e `treinador/SeletoresDeFiltro` (célula, uma opção, período) — commit: e09489a
- [x] 2. Atualizações — commit: 9c62a92
- [x] 3. Interessados — commit: bd07885
- [x] 4. Financeiro › Cobranças e Lançamentos — commit: a7e9635
- [x] 5. Auditoria — commit: 632f3c4
- [x] 6. Importação (histórico) — commit: ac33488
- [x] 7. Equipe › Membros — commit: 5fb0fee
- [x] 8. Planejamento › Atualização e Anamnese — commit: 61221b5
- [x] 9. Biblioteca — commit: 29ad7e1
- [x] 10. No PC, escolha feita numa Folha (`EscolhaEmFolha`, como Pessoa e Ação da Auditoria) grava depois que ela fecha; e2e `filtros-nas-listas.spec.ts` — commit: 5f6c307
- [x] 11. AGENTS.md, Ajuda e guia do treinador — commit: o seguinte a 5f6c307

## Lote 2 (API)
Filtros que fazem sentido nas telas mas que a rota ainda não aceita (nada disso foi feito no lote 1):

| Tela | Filtro | Parâmetro proposto |
| --- | --- | --- |
| Atualizações | Busca pelo nome no servidor (hoje é local; a lista vem inteira, então não falta nada) | `busca` em `GET /atualizacoes` |
| Atualizações | Mais de um responsável, e "Sem responsável" | `responsavel` repetível com `nenhum`, como em `GET /alunos` |
| Interessados | Mais de um responsável ou origem de uma vez | `responsavel` e `origem` repetíveis em `GET /inscricoes` e `/contagens` |
| Interessados | Período de entrada e de última atividade | `de`/`ate` (entrada) e `atividadeDe`/`atividadeAte` em `GET /inscricoes` |
| Financeiro › Cobranças | Busca pelo aluno e um aluno só (a consulta já tem o `alunoId`, sempre nulo) | `busca` e `alunoId` em `GET /financeiro/cobrancas` |
| Financeiro › Cobranças | Várias situações; plano; forma de pagamento (manual ou online) | `situacao` repetível, `planoId`, `forma` |
| Financeiro › Lançamentos | Tipo (entrada ou saída), categoria e busca na descrição (a lista é paginada: filtrar a página esconderia o resto) | `tipo`, `categoria`, `busca` em `GET /financeiro/lancamentos` |
| Auditoria | Mais de uma pessoa ou ação | `usuarioId` e `acao` repetíveis em `GET /auditoria` |
| Importação | Período (a lista é paginada) | `de`/`ate` em `GET /importacoes` |
| Importação | Trocar a `busca` (só acha a extensão, o nome não é guardado) por um filtro explícito | `arquivo=xlsx|csv` |
| Planejamento › questionários | Ativos e arquivados juntos | `arquivados=todos` em `GET /questionarios` |

## Fora do escopo
- Agenda, Números e Modelos do Planejamento (pedido do Gustavo).
- Interessados › Indicadores (tem o próprio período) e a fila de retornos `?retornos=ATE_HOJE` (fica com a faixa do endereço e o Todos/Meus).
- Financeiro › Visão geral, Planos, Lembretes e Recebimento online: não são listas filtráveis.

## O que ficou para trás
- Os filtros da Biblioteca, dos Questionários e dos Membros ficam no estado da tela (não no endereço): trocar de aba já começa do zero, e a lista vem inteira (D2). Se o Gustavo quiser o link com o filtro, é só levar para o endereço como nas outras.
- Na Biblioteca o filtro do catálogo e o de exercícios só têm teste de tela em 1280 px (o spec da Biblioteca roda numa largura só).
- A contagem das abas de Atualizações some com uma pessoa ou uma data escolhida: o `/painel` só conhece Todos/Meus (contagem por filtro seria parâmetro novo, Lote 2).
