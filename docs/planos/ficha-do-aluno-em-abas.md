# Ficha do aluno em abas e atividade recente

Situação: Planejando · Onde: `main` (mesmo lote do perfil estilo Steam, push único) · Atualizado: 10/11/2026

## Objetivo
A ficha do aluno do treinador hoje é uma página longa de 17 blocos empilhados. Passa a ter cinco abas (Resumo, Planos, Acompanhamento, Evolução, Ficha do aluno), com o Resumo curto, só com o que decide a próxima ação, e uma "Atividade recente" com os últimos 5 acontecimentos do aluno, vinda de uma rota nova da API. Proposta e desenho de abas do Gustavo (10/11).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Abas e conteúdo | **Resumo** (alerta, plano em uso, última atualização, indicadores, atividade recente); **Planos** (pastas com treino, dieta e mobilidade: criar, renovar, consultar anteriores); **Acompanhamento** (atualizações respondidas, frequência, água, mobilidade, treinos concluídos, recordes da semana, respostas dos questionários); **Evolução** (peso, avaliação física, fotos comparativas, progresso nos exercícios); **Ficha do aluno** (cadastro, dados pessoais, acesso ao app, ciclo, plano contratado, anamnese, lesões, configurações do acompanhamento) | Gustavo (10/11) |
| 2 | Resumo curto | Mostra só o necessário para decidir; tabelas e gráficos ficam nas abas. Indicadores pequenos lado a lado, sem bloco enorme para "nenhum registro", fotos maiores em grade. Tema escuro e vermelho nas ações principais; identidade visual preservada | Gustavo (10/11) |
| 3 | Alerta do Resumo | "Próximo passo" atual (revisar atualização, renovar pasta) continua e é separado do aviso de lesões | Gustavo (10/11) |
| 4 | Aviso de lesões | Aviso discreto com a contagem e link para a aba Ficha do aluno, só com `ALUNO_SENSIVEL_LER`, sem nenhum detalhe sensível; se a lesão tiver situação (ativa/encerrada) conta só as ativas, senão "Lesões registradas" sem presumir que continuam ativas | Gustavo (10/11) |
| 5 | Feed na API em três etapas | **Simples agora** (passos 1 e 2); intermediária e avançada só documentadas aqui | Gustavo (10/11) |
| 6 | Momento | Junto do lote atual, um push só; commits separados por passo | Gustavo (10/11) |
| 7 | Dado inventado | Nunca: só entram eventos que os dados atuais comprovam; sem evento, estado vazio discreto | AGENTS.md |

## Etapa simples (esta entrega)
Contrato proposto (o executor confere no código e ajusta com a evidência; qualquer desvio volta aqui):
- `GET /alunos/{id}/atividade-recente?limite=5` (padrão 5, máximo 20) → `{itens: [{tipo, titulo, quando (instante ISO), destino {tipo, id}|null}]}`, do mais novo ao mais antigo. A rota exige `ALUNO_LER`; **cada tipo de evento só entra se o treinador tem a permissão que já o mostra na ficha**.
- Tipos desta etapa e a permissão de cada um: `ATUALIZACAO_ENVIADA` (`ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`; o peso e as fotos enviados na mesma atualização **entram nesse item**, sem evento próprio); `TREINO_CONCLUIDO` (`REGISTRO_LER`, só com `retornoHabilitado`); `PLANO_PUBLICADO` (treino e mobilidade: `TREINO_LER`; dieta: `DIETA_LER`); `PESO_REGISTRADO` (`ALUNO_SENSIVEL_LER`, só o peso que **não** veio de uma atualização, por exemplo o lançado pelo treinador).
- Títulos fixos em português, sem valor de peso, sem texto de resposta, comentário, lesão ou nome de exercício (o feed nunca carrega dado sensível além do fato de o evento ter ocorrido). `destino` leva só tipo e id para a tela abrir o detalhe quando existir.
- Só consulta registros existentes, com data comprovada (`enviada_em`, `concluida`, `publicado_em`, `criado_em` do peso conforme o caso); evento sem data confiável não entra. Outra consultoria = 404; aluno anonimizado = mesmo tratamento das outras leituras da ficha; nada vai a log nem auditoria; SQL só JPQL com `@TenantId` (nativo, só com `consultoria_id` e `aluno_id` explícitos e exceção no `ArquiteturaTest`).
- App: `dominio/fichaDoAluno.ts` (regra pura: abas visíveis por permissão, aba inicial, `?aba=`, texto e destino de cada evento) com teste; `treinador/AtividadeRecente` (lista curta, estado vazio discreto, erro e carregando); `?aba=resumo|planos|acompanhamento|evolucao|ficha` na URL (padrão das telas do Planejamento e do Financeiro); aba sem nenhum bloco permitido não aparece; `?pastaId=` abre a aba Planos e `?editar=1` a aba Ficha; erro de um bloco não derruba os outros.

## Etapa intermediária (planejada, fora desta entrega)
- Histórico paginado com "Ver todas as atividades" (`{itens,total}`, 30 por página, no formato de `GET /atualizacoes/pagina`), filtros por período e por tipo (`PERIODO_INVALIDO` 400 como nas outras listas).
- Novos tipos: revisão de atualização, renovação de plano e avaliação física. Dependências: gravar as datas que hoje não existem de forma confiável (`revisada_em`, renovação da pasta, `criado_em` da avaliação) e, se a consulta direta às tabelas ficar lenta ou incompleta, uma tabela de eventos persistida (`atividade_aluno`, `@TenantId`, só tipo, alvo e instante, retenção definida, anonimização apaga) escrita na mesma transação de cada ação; migration nova com total nos testes e nos papéis do banco.
- Critério de conclusão: lista paginada e filtrável sem N+1; nenhum evento sem data; teste de isolamento por consultoria e por permissão; exportação LGPD e anonimização cobrem a tabela nova, se criada.

## Etapa avançada (planejada, fora desta entrega)
- Atualização do feed em tempo real (ou sondagem curta), preferências de notificação por tipo de acontecimento (depende do push do Expo ligado, `docs/planos/push-do-expo.md`, e de preferência por treinador).
- Alertas de acompanhamento (período do plano encerrado, atualização pendente, ausência de registros) com regras configuráveis, **separados do histórico de acontecimentos** (alerta é estado atual, atividade é fato passado).
- Critério de conclusão: regra configurável por consultoria, sem mensagem com dado de saúde, testes de que alerta desligado não notifica, e decisão do Gustavo sobre canal (tela, push, e-mail).

## Passos
- [ ] 1. API (`executor`): rota `GET /alunos/{id}/atividade-recente` da etapa simples, com teste de integração (tipos, ordem, limite, agrupamento atualização + peso + fotos, permissão por tipo, isolamento por consultoria, aluno anonimizado, retorno desligado, estado vazio), `ArquiteturaTest` e espelho em `api/tipos`. Aceitação: `mvn verify` verde — commit/run: —
- [ ] 2. App, regra pura (`executor`): `dominio/fichaDoAluno.ts` com teste (abas por permissão, aba inicial, `?aba=`, evento → texto e destino, aviso de lesões) — commit/run: —
- [ ] 3. App, telas (`executor-front`): a ficha em cinco abas e o Resumo novo (alerta, aviso de lesões, plano em uso, última atualização, indicadores, atividade recente), mapeando os blocos atuais para as abas (decisão 1), estados carregando/vazio/erro/offline, largura (indicadores lado a lado, grade de fotos), temas claro, escuro, areia e contraste alto, celular e PC; ajuste dos e2e que tocam a ficha (`api-falsa` ganha a rota nova) e e2e novo `ficha-em-abas.spec.ts`. Depende de 1 (contrato) e 2 — commit/run: —
- [ ] 4. Documentação: `AGENTS.md` (uma frase na ficha e a rota nova), `docs/design-e-front.md` se surgir peça compartilhada, este plano e o README — commit/run: —
- [ ] 5. Verificação: `mvn verify`, `npm run typecheck`, `npm run lint`, `npm test`, e2e das telas tocadas; conferir no local e no Expo Go. Push junto do lote (um só) — commit/run: —

## Fora do escopo
- Etapas intermediária e avançada acima.
- Mudar o conteúdo dos cartões em si (só mudam de lugar); nova regra de permissão; novo evento além dos quatro.
- Subtítulo "Hipertrofia · Treinador" do desenho: só aparece com dado que a ficha já traz (responsável e, com `ALUNO_SENSIVEL_LER`, o objetivo); nada inventado.

## O que ficou para trás
- Nada ainda. Sobras vão para "Pendências soltas" no README.
