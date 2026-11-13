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
| D13 | D3 resolvida: 460 px no PC (margem 24 px; o rodapé de três botões cabe numa linha); celular (abaixo de 768 px) mantém a folha de baixo na largura toda, com cabeçalho e rodapé fixos e os botões empilhados (Aplicar em cima) | decisão de implementação, fase 1 | Claude, 12/11 |
| D12 | Já existe `ui/BarraDeFiltros` (busca + "Filtros" com contador + painel "Filtros avançados" no PC com efeito na hora + `Folha` "Filtros" com rascunho no celular + chips "Filtrando:" com ✕ e "Limpar filtros"): é a base a evoluir, não um segundo componente paralelo | decisão da sessão principal a partir do inventário | Claude, 12/11 |

## Inventário (explorador, 12/11/2026, a partir do código; ✔ = lido, ? = a confirmar na migração de cada tela)
Base: `ui/BarraDeFiltros.tsx` (contador = `chips.length`), `ui/Folha.tsx`, `ui/SelecaoMultiplaSuspensa.tsx`, `ui/Escolha.tsx`/`EscolhaEmFolha`, `ui/FaixaDeChips.tsx`, `treinador/SeletoresDeFiltro.tsx` (`CamposDePeriodo`), `treinador/financeiro/FiltrosEmGrade.tsx` (`PeriodoDoFiltro`), `treinador/interessados/PeriodoDoFiltro.tsx`, `treinador/FiltroDoEndereco.tsx`, `treinador/agenda/FiltroDaAgenda.tsx`, regras puras `dominio/filtros*.ts`.

| Tela | Onde | Critérios | Situação |
| --- | --- | --- | --- |
| Financeiro › Cobranças | `financeiro/AbaCobrancas.tsx` | Responsável (meus/todos), Plano (já existia), Situação (múltipla), Forma da baixa, Vencimento (modo + próximos 7 dias), Emissão, Pagamento; busca por aluno | migrada (fase 1) |
| Biblioteca › Alimentos / Exercícios | `biblioteca/AbaAlimentos.tsx`, `AbaExercicios.tsx`, `BarraDaBiblioteca.tsx` | Alimentos: Grupo, Unidade, Fonte, Preparo; Exercícios: Grupo muscular (não há Modalidade) | migrada (fase 1) |
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

Filtros do guia que **não existem** hoje (só entram se houver fonte de dado e o Gustavo já tiver pedido; "sem fonte" fica registrado, não inventado): Cobranças (confirmado na fase 1, **sem fonte**, não criados): aluno/pagador como seletor (hoje só busca por nome e `alunoId` pelo endereço), responsável como pessoa, competência, CPF/CNPJ (dado sensível; nunca na URL), ID, crédito em conta; o Plano já existia e ficou; Agenda: agendas visíveis (a confirmar); Visão geral: responsável e período (a confirmar).

## Passos
- [x] 1. Componente compartilhado, evoluindo `BarraDeFiltros` (sem peça paralela, D12): prop opcional `painelLateral={{ titulo }}` (shortcut: o modo antigo sai nos passos 4 e 5), `Folha lateral` (460 px à direita no PC, `LARGURA_PAINEL_LATERAL`; celular = folha de baixo na largura toda), `GrupoDoPainel`, `useProblemaNoPainel`; regras puras `dominio/painelDeFiltros.ts` (`resultadoDoAplicar`, `errosDoPeriodoDigitado`, `selecaoDepoisDosFiltros`) com `painelDeFiltros.test.ts` (7 testes); camadas pela pilha de `Modal` (lista e calendário acima, Esc fecha a de cima). **Desvio do D1:** sem animação de entrada (a de 180 ms não assentava em 0 sob o relógio fixo dos e2e e deixava o painel 0,7 px fora; o painel aparece pronto à direita; volta, se o Gustavo quiser, com o teste de posição em movimento reduzido). Folha aberta de dentro de outra não pinta segundo véu (D8; vale para toda folha aninhada do sistema, medido na captura de 390 px). Evidência: `e2e/filtros-laterais.spec.ts` (38 casos, API simulada) — commit: —
- [x] 2. Cobranças (`AbaCobrancas`, grupos Identificação · Situação · Datas; `PeriodoDoFiltro` marca o erro no painel) e Biblioteca (`AbaExercicios`, `AbaAlimentos`, `BarraDaBiblioteca`) migradas; API, endereço e permissões iguais; resposta de outra chave com erro não mostra a lista velha (`dadosDeOutraChave`); "Limpar filtros" do vazio não apaga mais a busca (D5). **Regra do lote (D9):** Aplicar com filtros diferentes limpa a seleção e avisa quantas saíram; Aplicar sem mudar nada, Cancelar, X, Esc e fundo mantêm; a busca continua limpando como antes. Casos e2e: duas situações + vencimento, cobrança sem data de pagamento, lote, Aplicar/Cancelar/X/Esc/fundo, Esc no calendário, datas inválidas e foco, várias caixas, contador/chips/resultado, vazio com chips, voltar da edição mantém o filtro (Exercícios). Capturas antes-/depois- em 390/1024/1280/1440/1920 e temas (fora do repositório). Antigos que passaram: 341 casos em 19 specs — commit: —
- [ ] 3. Revisão independente do componente (foco, camadas, estado) antes de espalhar — revisor/advisor — —
- [ ] 4. Financeiro (Lançamentos, Visão geral), Alunos, Atualizações, Interessados (+ Indicadores), Auditoria, Equipe — commit: —
- [ ] 5. Agenda, Comunidade, Planejamento, Início, Importação, Biblioteca (resto), filtros dentro de editores, ficha e aluno (o que for filtro) — commit: —
- [ ] 6. Ajuda e guias PDF (instruções que ensinam filtros no corpo da tela), `docs/design-e-front.md`, `AGENTS.md` — commit: —

## Fora do escopo
- "Meus filtros", exportação, cadastros e funções bancárias da referência; filtros novos sem fonte de dado; redesenho geral da área do aluno; mover navegação temporal e modos de visualização da Agenda para o painel.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
- Fase 1 (12/11): passo 3 (revisão independente do componente) ainda por fazer antes dos passos 4 e 5.
- Fase 1: não conferido com leitor de tela nem no app nativo (Android/iOS); só web (Chromium) com API simulada.
