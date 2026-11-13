# Filtros laterais em todo o sistema

Situação: Em andamento (fase 1: componente + Cobranças e Biblioteca) · Onde: `main` · Atualizado: 12/11/2026

## Objetivo
Todo filtro do sistema passa a seguir um padrão lateral: botão "Filtros" com contador, painel que entra pela direita
(rascunho, Aplicar/Cancelar/Limpar), etiquetas removíveis dos filtros aplicados na página. O conteúdo ganha espaço e a
tela fica menos desorganizada. Fonte: guia "Filtros laterais em todo o sistema" (PDF do Gustavo, 12/11/2026), que
substitui as propostas anteriores de filtros avançados como cartões no corpo da página e de filtros de escopo espalhados
em barras; os campos e regras já pedidos continuam valendo, muda a apresentação e o momento de aplicar.

## Decisões (do guia; "proposta" = pode ser ajustada com motivo registrado aqui)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Painel modal sobreposto, entra pela direita; página ao fundo visível e inerte; a tabela não muda de largura e o painel fechado não reserva faixa | pedido | Gustavo, 12/11 |
| D2 | Anatomia: cabeçalho fixo (título "Filtros de <assunto>" + fechar com nome acessível), corpo rolável em uma coluna agrupado por assunto (Identificação, Situação, Datas, Outros), rodapé fixo (Limpar filtros secundário, Cancelar, Aplicar filtros); a última opção rola acima do rodapé | pedido | Gustavo, 12/11 |
| D3 | Largura 400–480 px no desktop e margem interna 20–24 px (celular 16–20 px): **proposta**; no celular o painel ocupa a largura, sem gaveta estreita com a página espremida; sem reduzir fonte; sem cartão dentro de cartão | proposta | guia |
| D4 | Fluxo: abrir copia o aplicado para o rascunho; alterar só mexe no rascunho; Aplicar valida, aplica de uma vez, fecha e carrega; Cancelar, X, Esc e clique no fundo descartam o rascunho sem confirmação; marcar caixa/escolher data não fecha o painel | pedido | guia |
| D5 | "Limpar filtros" dentro do painel limpa só o rascunho (aplica no Aplicar); não toca na busca principal nem em permissão/consultoria/contexto obrigatório; remover etiqueta na página aplica na hora; "Limpar filtros" na página limpa tudo de uma vez (busca continua independente); período obrigatório: Limpar restaura o padrão da tela e o período efetivo fica visível | pedido | guia |
| D6 | Contador no botão = critérios que restringem (dois status = 1; um intervalo = 1); nenhuma restrição = "Todos"; etiquetas com contraste e botão de remover acessível; poucas linhas: quebrar ou "+N filtros", nunca só um número; lista vazia nunca esconde condições ativas | pedido | guia |
| D7 | Datas: cada critério temporal com rótulo e resumo próprios (competência = mês/ano; vencimento, emissão e pagamento = datas completas), De ≤ Até validado, critérios independentes combinam por interseção; calendário abre acima do painel; Esc fecha primeiro o calendário | pedido | guia |
| D8 | Foco: ao abrir vai para o painel, preso nele e nas camadas; ao fechar volta ao botão que abriu; `role=dialog` com nome; rolagem da página bloqueada e restaurada; lista aberta acima do painel e do rodapé; sem overlay aplicado duas vezes | pedido | guia |
| D9 | Estado: rascunho separado do aplicado; nada de rascunho na URL; filtros aplicados continuam na URL onde já estavam; sem empilhar histórico por caixa marcada (Agenda: Voltar não desfaz filtro); CPF/CNPJ e dado sensível nunca em URL nem log; aplicar reinicia paginação; resposta antiga não substitui a nova; filtrar com seleção em lote pede regra explícita | pedido | guia |
| D10 | Abrangência: só filtros (restringem resultado ou período). Abas, Lista/Kanban/Indicadores, Dia/Semana/Mês, hoje/anterior/próximo, mini calendário, edição e preferências ficam onde estão; a busca por texto pode ficar visível. Sem filtros novos só para completar a lista; sem "Meus filtros", sem exportação; área do aluno só adapta os filtros que existem | pedido | guia |
| D11 | Ordem: inventariar → componente validado em Cobranças (datas + múltipla seleção) e Biblioteca (simples), escuro/claro/celular → só então migrar o resto → testes dos contratos → Ajuda e docs | pedido | guia |
| D12 | Já existe `ui/BarraDeFiltros` (busca + "Filtros" com contador + painel "Filtros avançados" no PC com efeito na hora + `Folha` "Filtros" com rascunho no celular + chips "Filtrando:" com ✕ e "Limpar filtros"): é a base a evoluir, não um segundo componente paralelo | decisão da sessão principal a partir do inventário | Claude, 12/11 |

## Inventário (explorador, 12/11/2026, a partir do código; ✔ = lido, ? = a confirmar na migração de cada tela)
Base: `ui/BarraDeFiltros.tsx` (contador = `chips.length`), `ui/Folha.tsx`, `ui/SelecaoMultiplaSuspensa.tsx`, `ui/Escolha.tsx`/`EscolhaEmFolha`, `ui/FaixaDeChips.tsx`, `treinador/SeletoresDeFiltro.tsx` (`CamposDePeriodo`), `treinador/financeiro/FiltrosEmGrade.tsx` (`PeriodoDoFiltro`), `treinador/interessados/PeriodoDoFiltro.tsx`, `treinador/FiltroDoEndereco.tsx`, `treinador/agenda/FiltroDaAgenda.tsx`, regras puras `dominio/filtros*.ts`.

| Tela | Onde | Critérios | Situação |
| --- | --- | --- | --- |
| Financeiro › Cobranças | `financeiro/AbaCobrancas.tsx` | Responsável (meus/todos), Situação (múltipla), Forma da baixa, Vencimento (modo + próximos 7 dias), Emissão, Pagamento; busca por aluno | fase 1 |
| Biblioteca › Alimentos / Exercícios | `biblioteca/AbaAlimentos.tsx`, `AbaExercicios.tsx`, `BarraDaBiblioteca.tsx` | Grupo, Unidade, Fonte, Preparo; Modalidade | fase 1 |
| Financeiro › Lançamentos | `AbaLancamentos.tsx` | Tipo, Categoria (múltipla), Data do lançamento | pendente |
| Financeiro › Visão geral | `VisaoGeral.tsx`, `ResultadoDoMes.tsx` | responsável e período (?) | pendente (confirmar) |
| Alunos | `alunos/index.tsx` | Mostrar alunos (atalho), Situação, Responsável; avançados na URL | pendente |
| Atualizações | `atualizacoes/index.tsx` (+ Kanban/indicadores ?) | Responsável (múltipla), Data da atualização | pendente |
| Interessados | `interessados.tsx` | Retornos, Responsável, Etapas, Situação, Origem, Entrada, Última atividade (+ Indicadores: período) | pendente |
| Auditoria | `auditoria.tsx` | Pessoa, Ação, Período | pendente |
| Equipe | `equipe/UsuariosEquipe.tsx` | Situação, Perfil | pendente |
| Biblioteca › Importar/Outros/Suplementos | `AbaCatalogo`, `AbaErgogenicos`, `AbaSuplementos` | ? | confirmar |
| Planejamento | `planejamento/index.tsx` | tipo (chips, `?tipo=`) e Coleção | avaliar (tipo é navegação; coleção é filtro) |
| Comunidade (treinador) | `comunidade.tsx`, `BarraDoMural.tsx` | Categoria do aulão, Tipo de publicação, Denunciados | pendente |
| Agenda | `agenda.tsx`, `FiltroDaAgenda.tsx` | Responsável, Compromissos (situação), "Minhas agendas" (agendas visíveis ?) | pendente |
| Início | `treinador/index.tsx` | Dias sem registro e demais blocos (?) | pendente |
| Importação | `importacao/TelaImportacao.tsx` | ? (`filtrosDaImportacao`) | confirmar |
| Ficha do aluno | `CartaoRegistros`, `CartaoProgresso`, `CartaoPastas` | período, plano, grupo muscular, situação da pasta | avaliar (escolha local de visualização × filtro) |
| Aluno | `aluno/historico.tsx`, `ListaDeComprasDoAluno`, Comunidade › Colegas | período; busca | avaliar (só adaptar o que existe) |
| Números, Ajuda, Inscrição pública | — | sem filtro (Ajuda: busca textual; Inscrição: campos de formulário) | fora |

Filtros do guia que **não existem** hoje (só entram se houver fonte de dado e o Gustavo já tiver pedido; "sem fonte" fica registrado, não inventado): Cobranças: aluno/pagador como seletor (hoje só busca por nome), plano, responsável como pessoa, competência, CPF/CNPJ (dado sensível; nunca na URL), ID, crédito em conta; Agenda: agendas visíveis (a confirmar); Visão geral: responsável e período (a confirmar).

## Passos
- [ ] 1. Componente compartilhado `PainelDeFiltros` (rascunho/aplicado, Aplicar/Cancelar/Limpar, foco, Esc, rolagem, camada para lista e calendário, escuro/claro/celular), evoluindo `BarraDeFiltros`; testes de contrato — commit: —
- [ ] 2. Cobranças migrada (dois status + aluno + vencimento; lote x filtro; cobrança sem data de pagamento; documentar a regra de seleção em lote) e Biblioteca (nome + categoria/modalidade; voltar de uma edição; sem resultado); capturas 390/1280/1440/1920, escuro e claros — commit: —
- [ ] 3. Revisão independente do componente (foco, camadas, estado) antes de espalhar — revisor/advisor — —
- [ ] 4. Financeiro (Lançamentos, Visão geral), Alunos, Atualizações, Interessados (+ Indicadores), Auditoria, Equipe — commit: —
- [ ] 5. Agenda, Comunidade, Planejamento, Início, Importação, Biblioteca (resto), filtros dentro de editores, ficha e aluno (o que for filtro) — commit: —
- [ ] 6. Ajuda e guias PDF (instruções que ensinam filtros no corpo da tela), `docs/design-e-front.md`, `AGENTS.md` — commit: —

## Fora do escopo
- "Meus filtros", exportação, cadastros e funções bancárias da referência; filtros novos sem fonte de dado; redesenho geral da área do aluno; mover navegação temporal e modos de visualização da Agenda para o painel.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
