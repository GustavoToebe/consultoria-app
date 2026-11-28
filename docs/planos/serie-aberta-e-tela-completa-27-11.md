# Montar treino (tela completa e série aberta) e folhas da Biblioteca e do Planejamento (leva 3, 27/11)

Situação: Em andamento (peças e fiação feitas sem commit, F-005/F-006 inclusive, mais a rodada de correções de 28/11; faltam capturas, relatório e verificação, com e2e e `mvn verify` a rodar) · Onde: branch `leva-3` (worktree `consultoria-app-leva-3`, sem commit) · Atualizado: 28/11/2026

## Objetivo
Plano A: o editor "Montar treino" ganha cabeçalho único, configuração do plano recolhível, sessões com contagem, três
colunas com o resumo fixo e a série aberta em linhas de configuração com a prévia do aluno ao lado. Plano B: as folhas de
criar modelo, os filtros de exercícios com os grupos musculares parecidos agrupados e unidos, o formulário do exercício e
as telas de avaliação física, foto de evolução, pasta do aluno, "Usar semana de treino" e seletor do questionário.

Fonte: a proposta do Gustavo de 27/11 (`SERIE-ABERTA.md` e as imagens da pasta `serie-aberta`, fora do repositório,
seções 0 a 6) e os pedidos 34 a 38 da noite de 27/11. Escopo: só o app, menos o endpoint de unir grupos (B-005). Push
autorizado se tudo ficar verde, com a suíte e2e completa (a série do treino é peça compartilhada com o app do aluno, e o
B-005 muda o contrato da API).

## Validade deste registro
- **28/11/2026:** as linhas marcadas "em 28/11, SEM commit (leva-3)" foram conferidas por grep no código nesse dia por
  uma unidade de documentação, sem `git status` novo e sem rodar teste; valem até o primeiro commit da leva.
- Fotografia da `git status` da worktree em 27/11/2026, **23:16** (antes, 22:38), branch `leva-3` sobre `4dc1cbc9`, árvore
  sem commit (197 arquivos na `git status`). A coluna "Situação" foi relida no código nessa hora (importações e arquivos de
  teste), sem rodar teste. `EditorDoGrupoDeSeries.tsx` mudou às 23:15 e `EditorSeries.tsx` às 23:04: o F-006 (agente
  `ae42d531`) estava escrevendo; os passos dele ficavam "em andamento" (superado pela leitura de 28/11 nas linhas marcadas).
- Outros agentes escrevem na mesma worktree agora: a coluna "Situação" dos passos fica **vencida** a cada `git status`
  novo e no primeiro commit da leva. Antes de reaproveitar, rode `git status` e confira cada arquivo citado.
- Nenhum teste foi rodado para este registro (só leitura da árvore). Nenhum passo está "verde": todos com `commit/run: —`.
- A tabela abaixo foi relida às 23:16 (as linhas marcadas "em 28/11" foram relidas nesse dia); o B-005 inclui a revisão do coordenador no `GruposMuscularesService` (lida no
  código nessa hora).
- **Os IDs A-T012 a A-T020, F-001 a F-006, E-001 a E-006, T-030 a T-032, T-040 e B-001 a B-011 foram distribuídos por
  este registro a partir do briefing** (não havia mapa deles na árvore nem nas notas da sessão): a confirmar pelo
  coordenador. T-010, T-011 e T-016 vieram do briefing com o assunto.

Legenda da situação: **feito sem commit** (peça na árvore e ligada numa tela; "+ teste" quando há teste unitário);
**em andamento** (arquivo sendo escrito por outro agente nesta hora); **falta** (nada na árvore). e2e e testes de
integração: **escritos, a rodar pela sessão principal**. Nenhum passo tem commit nem run.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| S1 | Primeiro nome no push | Não é desta frente (foi da leva 2) | sessão principal (padrão), a confirmar pelo Gustavo |
| S2 | O que a prévia da série mostra | O cartão de hoje do aluno (a mesma peça da tela do exercício) | sessão principal (padrão), a confirmar pelo Gustavo |
| S3 | WS de referência da prévia | `wsDeReferenciaKg` | sessão principal (padrão), a confirmar pelo Gustavo |
| S4 | Descanso do cluster vazio | Entra como aviso (pontos para revisar e selo), não trava o salvar | sessão principal (padrão), a confirmar pelo Gustavo |
| S5 | Faixa única do cabeçalho | Só no modelo | sessão principal (padrão), a confirmar pelo Gustavo |
| S6 | "● Falta o descanso" | Nos dois modos (modelo e plano do aluno) | sessão principal (padrão), a confirmar pelo Gustavo |
| S7 | Três colunas a partir de 1600 px | Vale também na faixa "limitada" | sessão principal (padrão), a confirmar pelo Gustavo |
| S8 | "Semana aplicada" | Mantém a faixa (superada na árvore: o "Usar semana de treino" já avisa em toast com "Desfazer", `comDesfazerNoAviso`, `FolhasDoTreino.tsx`) | sessão principal (padrão), a confirmar pelo Gustavo |
| S9 | Carga em kg do documento | Continua texto | sessão principal (padrão), a confirmar pelo Gustavo |
| S10 | Defeito dos botões + e − dos blocos | Já corrigido na árvore; falta blindar (chave estável pelo uid da série aberta em `EditorSeries.tsx`, com o teste vermelho antes) | contexto da leva 3 |
| S11 | "Trocar exercício" no cabeçalho do editor do exercício | `acao` (uma vez na área); repetido nos cartões, `secundario`; nota no `docs/design-e-front.md` | Gustavo (pedido 36) |

### Decisões abertas (esperam o Gustavo)
- **A1. Três `acao` no painel do exercício.** O pedido 36 põe "Trocar exercício" em `acao`, e a proposta mantém "Usar
  receita de séries" em `acao` no cabeçalho da seção Séries (e "Adicionar exercício" em `acao` na coluna Exercícios,
  logo ao lado). Isso bate na regra "um `acao` por área" do `docs/design-e-front.md`. Até a resposta, segue o pedido do
  Gustavo.
- **A2. Âmbar do "Alterações não salvas".** A proposta (0.1) pede âmbar só na faixa do modelo; a regra D12 do
  `docs/design-e-front.md` diz neutro com lápis ("não é erro"). **Na árvore (23:16) já está âmbar** na faixa única
  (`AcoesDoModelo`, web ≥ 768 px); a `BarraDoModelo` segue neutra. Falta o Gustavo confirmar; se ficar a D12, é uma cor
  em `AcoesDoModelo`.
- **A3. Respirações na pausa e RPE.** Conferido em 27/11: o contrato já tem `Tecnica.pausaRespiracoes` e `Esforco.rpe`
  (`api/.../treino/ConteudoTreino.java`) e não há migration na árvore. Sem migration; a decisão perde o objeto, salvo
  pedido novo do Gustavo.

## Passos

### Plano A: Montar treino (seções 0 a 6 da proposta)
Dono: `executor-front` por peça; a fiação na tela (F) tem um dono só por arquivo (`TelaDoEditor.tsx` e
`EditorSeries.tsx` são compartilhados).

| ID | Entrega | Aceitação | Arquivos | Situação |
| --- | --- | --- | --- | --- |
| T-010 | 0.1 Cabeçalho único | Lápis "Editar nome" ao lado do título com o ⓘ; subtítulo do modelo no lugar da linha com o livro; "Alterações não salvas", "Aplicar ao aluno" (secundário) e "Salvar modelo" (primário) na mesma faixa, fixa ao rolar; "Salve o modelo antes." como motivo do "Aplicar" desabilitado na dica | `treinador/treino/AcoesDoModelo.tsx`, `ui/DicaDoBotao.tsx` (+ teste), `ui/Cabecalho.tsx`, `e2e/editor-cabecalho-unico.spec.ts` | **feito sem commit**: `AcoesDoModelo` ligada pelo `EditorDeTreino` (`acoesNaLinha`, só web ≥ 768 px, `cabecalhoUnico`), sem teste unitário; `DicaDoBotao` + teste; e2e escrito; A2 (âmbar) já no código |
| T-011 | 0.2 Configuração do plano | Seção recolhível com o resumo à direita; Metodologia num seletor com dica curta (sai o texto longo e o "Vincular"); Objetivo (~40%) e Orientações gerais (~60%) lado a lado, crescendo com o texto | `treinador/treino/ConfiguracaoDoTreino.tsx`, `e2e/editor-configuracao-do-plano.spec.ts` | **feito sem commit**, sem teste unitário (Objetivo e Orientações em `ui/CampoQueCresce`); e2e escrito |
| A-T012 | 0.3 Sessões | "Sessões" com "N sessões · N exercícios · N séries"; selo "✓ Sem pendências" ou "● N pendências" (clicável) e "Colar treino"; abas com ícone, dia, nome e contagem; descanso discreto; "+ Sessão" tracejado | `dominio/abasDasSessoes.ts` (+ teste), `dominio/contagemDoTreino.ts` (+ teste), `treinador/treino/SeletorDeSessoes.tsx`, `ContadoresDoTreino.tsx` | **feito sem commit** + teste (`SeletorDeSessoes` e `ContadoresDoTreino` usam a regra; `SeletorDeSessoes.test`, `ContadoresDoTreino.test`) |
| A-T013 | 0.4 Cabeçalho da sessão | Nome e, embaixo, "Dia · Tipo · N exercícios · N séries · N de trabalho"; "Editar sessão" (secundário), ← →, ⋯ e "Excluir sessão" (perigo) juntos | `dominio/abasDasSessoes.ts` (`partesDaSessao`, `diaETipoDaSessao`, `linhaDaSessao`), `contagemDoTreino.ts` (`textoDosTotaisDaSessao`) | **feito sem commit** + teste (`CartaoSessao` usa `abasDasSessoes`; `CartaoSessao.test`) |
| A-T014 | 0.5 Três colunas e resumo fixo | Exercícios (300), editor (flexível) e Resumo (320, fixo ao rolar) a partir de 1600 px (S7); pontos para revisar abrem a série; abaixo de 1600, faixa compacta e detalhe recolhível; some o bloco "Séries por tipo / grupo" do meio | `dominio/colunasDoEditor.ts` (+ teste), `inspetorDoTreino.ts` (+ teste), `treinador/treino/ListaDeExercicios.tsx` (+ teste), `ResumoDaSessao.tsx` (+ teste), `colunasDasSeries.ts` | **feito sem commit** + teste (a `TelaDoEditor` mantém o padrão `tresDesde='ultralarga'` e o `EditorDeTreino` passa `'larga'`; `ListaDeExercicios.test`, `ResumoDaSessao.test`, `colunasDoEditor.test`) |
| T-016 | Cartão do exercício | Cabeçalho "Exercício N de M · grupo · modalidade" + nome, com Trocar exercício (`acao`, S11), ⋯ e Excluir exercício | `treinador/treino/CartaoExercicio.tsx` (+ teste), `e2e/editor-exercicio-cabecalho.spec.ts`, `docs/design-e-front.md` (nota) | **feito sem commit** + teste; e2e escrito; A1 aberta |
| A-T015 | 0.6 Pendências na linha | Série (e cluster) sem descanso: "● Falta o descanso" na coluna Descanso, nos pontos para revisar e no selo das Sessões, nos dois modos (S6); cardio e membro de grupo com descanso só do grupo não acusam; no cluster, a pendência âmbar "Defina o descanso. Sem ele, o aluno não tem o timer entre as séries." (`MENSAGEM_DESCANSO_DO_CLUSTER`), sem erro no campo e sem travar o salvar (S4) | `dominio/pontosParaRevisar.ts` (+ teste), `editorDeTreino.ts` (`resumoDoBloco` com `ignorarDescanso`) | **feito sem commit** + teste (regra em `ListaDeExercicios`, `ResumoDaSessao`, `ContadoresDoTreino`, `TabelaDeBlocos` e `LinhasDaSerie`); a linha dentro do `EditorDoGrupoDeSeries` e o texto do cluster: em 28/11, SEM commit (leva-3) |
| A-T016 | 1 Regra geral da série aberta | Formulário à esquerda e prévia à direita (abaixo de ~900 px, embaixo); linhas de configuração com nome à esquerda (~124 px) e divisória; o mesmo seletor de 46 px com rótulo dentro para Tipo (com bolinha), Técnica, Séries, Descanso ("75", "1:30", "2 min") e RIR/RPE; segmento só onde muda os campos; números de 46 × ~64 em negrito; dica única embaixo da linha; Repetições com largura fixa; rodapé "Excluir série" e "Fechar edição" | `treinador/treino/LinhaDoFormulario.tsx` (+ teste), `CamposBasicos.tsx`, `dominio/camposDaSerie.ts` (+ teste), `ui/EscolhaSuspensa.tsx` (+ teste), `ui/Campo.tsx`, `ui/Campos.tsx` (+ teste) | **feito sem commit** + teste nas peças (`LinhaDoFormulario` em `CamposBasicos`, `CamposDaTecnica`, `CamposDoCluster`, `CargaERirDaSerie` e `LinhasDaSerie`); o casco `EditorDoGrupoDeSeries`: em 28/11, SEM commit (leva-3); Observação da série sempre multilinha (trocar `multiline` remonta o campo na web); desvio: o seletor tem 52 px (`ALVO_TOQUE + 8`, igual ao Tipo), a proposta dizia 46 |
| A-T017 | 2 Valores diferentes por série | "Mesmo valor para todas" ligado quando as séries são iguais; desligado, uma linha por série; RIR mostra só o valor; a prévia com um cartão por série e só o da vez na cor de ação | `dominio/camposDaSerie.ts` | **feito sem commit** + teste ("Mesmo valor para todas" em `CargaERirDaSerie`; `CargaERirDaSerie.test`); trocar RIR · RPE com valor gravado abre `PainelConfirmacao` (em 28/11, SEM commit, leva-3) |
| A-T018 | 3 Cluster | Volume com Descanso obrigatório (erro no campo; S4: aviso); Blocos iguais · diferentes com B1, B2… e os botões-ícone − e + no fim ("Remover um bloco" / "Adicionar um bloco"); resumo "N blocos · N reps por série · Digitar como texto"; pausa `[s] · [respirações] (opcional)`; segmento RIR · RPE para todas as séries; "Carga diferente por bloco"; linha fechada "N séries · cluster" e "5 × 5 (25)". + e − atualizam na hora e o bloco novo entra focado | `dominio/blocos.ts` (+ teste), `pausaDaTecnica.ts` (+ teste), `agrupamento.ts` (+ teste), `treinador/treino/EditorSeries.tsx` | **feito sem commit** + teste (`CamposDoCluster` + teste; chave do editor pela série aberta com teste vermelho antes, `EditorSeries.chave.test.tsx`, S10); e2e do cluster em `editor-serie-aberta.spec.ts` a rodar; A3 fechada sem migration |
| A-T019 | 4 Prévia para o aluno | A mesma peça da série do app do aluno: cabeçalho "Série N ·" tipo na cor e ⓘ; − / kg / + / reps / ✓ tracejado; "Último registro –"; cluster com um campo por bloco e a linha da pausa; borda da vez na cor de ação | `dominio/previaDaSerie.ts` (+ teste), `treinador/treino/PreviaDaSerie.tsx` (+ teste) | **feito** em 28/11, SEM commit (leva-3): `PreviaDaSerie` + teste no `EditorDoGrupoDeSeries`; ao lado do formulário com a coluna das séries ≥ 920 px (base 340, até 420; antes da primeira medida abre embaixo); a linha da pausa diz "(o timer conta)" só com segundos (`textoPausaComTimer`), no cartão do aluno e na prévia |
| A-T020 | 5 Séries fechadas e "Nova série" | Linha fechada: alça · "Série N / qtd" · selo do tipo · carga · reps · descanso · ⌄ · ⋯, cartão pintado com a faixa reta; "+ Nova série" tracejada na última linha, abre já em edição; "SÉRIES · N no total" no cabeçalho, sem a palavra "blocos" | `dominio/contagemDoTreino.ts` (`textoDosTotaisDoPlano`), `treinador/treino/EditorSeries.tsx` | **feito** em 28/11, SEM commit (leva-3): linhas fechadas na `TabelaDeBlocos` (cartão pintado com a faixa reta), "+ Nova série" como última linha (adiciona e abre em edição) e "SÉRIES · N no total" no `CartaoExercicio`; a alça não foi conferida |
| T-030 | 6 item 8: seções recolhíveis | "Nome de exibição e instruções" e "Alternativas de troca · N de 3" recolhíveis, com resumo fechadas e campos em grade abertas | `treinador/treino/CartaoExercicio.tsx` | **feito sem commit** (conferido: as duas `SecaoRecolhivel` em `CartaoExercicio`) |
| T-031 | 6 item 9: "Escolher exercício" igual à Biblioteca | Linhas com a bolinha da modalidade, filtros em chips, "Mostrar N exercícios"; ao trocar, pré-filtrado pelo grupo do atual | `treinador/treino/FolhaBiblioteca.tsx`, `dominio/painelDeExercicios.ts` (+ teste), `e2e/escolher-exercicio-filtros.spec.ts` | **feito sem commit** + teste (troca pré-filtrada por `preFiltroDaTroca`); e2e escrito |
| T-032 | 6 item 10: fim da lista de séries | Como a seção 5 (A-T020) | `treinador/treino/EditorSeries.tsx` | **feito** junto do A-T020 (em 28/11, SEM commit, leva-3) |

Fiação na tela (um dono por arquivo, depois das peças):

| ID | Entrega | Arquivo de escrita | Situação |
| --- | --- | --- | --- |
| F-001 | `AcoesDoModelo` no cabeçalho do modelo (T-010) | `treinador/plano/TelaDoEditor.tsx` | **feito sem commit** (pelo `EditorDeTreino`, não pela `TelaDoEditor`, que só recebe `acoesNaLinha`) |
| F-002 | Abas e cabeçalho da sessão com `abasDasSessoes` (A-T012, A-T013) | `treinador/treino/SeletorDeSessoes.tsx` e o cabeçalho da sessão | **feito sem commit** |
| F-003 | Três colunas e resumo fixo (A-T014) | `treinador/plano/TelaDoEditor.tsx` | **feito sem commit** |
| F-004 | `LinhaDoFormulario` em toda a série aberta, valores por série e cluster (A-T016 a A-T018) | `treinador/treino/EditorSeries.tsx` | **feito** em 28/11, SEM commit (leva-3) |
| F-005 | `PreviaDaSerie` ao lado do formulário (A-T019) | `treinador/treino/EditorSeries.tsx` | **feito** em 28/11, SEM commit (leva-3) |
| F-006 | "Falta o descanso" na coluna, linha fechada e "+ Nova série" (A-T015, A-T020, T-032) | `treinador/treino/EditorSeries.tsx` | **feito** em 28/11, SEM commit (leva-3); a cor do Tipo em `opcoesDeTipo` não foi conferida por este registro |

Verificação, capturas e relatório:

| ID | Entrega | Aceitação | Dono | Situação |
| --- | --- | --- | --- | --- |
| E-001 | e2e do cabeçalho, da configuração e do cartão | `editor-cabecalho-unico`, `editor-configuracao-do-plano`, `editor-exercicio-cabecalho` verdes em 390 e 1280 | sessão principal | escritos, a rodar |
| E-002 | e2e da série simples | Faixa, Exata e AMRAP, dica da carga com WS e dica de repetições vazias | `executor-front` | existe em `editor-serie-aberta.spec.ts` (Faixa, Exata e AMRAP; spec ajustado nesta leva), a rodar |
| E-003 | e2e de valores por série | Interruptor ligado e desligado, prévia com um cartão por série | `executor-front` | escrito em parte no 1º teste de `editor-serie-aberta.spec.ts` (carga e RIR com "Mesmo valor para todas"), a rodar; a prévia com um cartão por série não conferida no spec |
| E-004 | Teste do + e − dos blocos | Unitário e e2e: adicionar, remover e editar, com o teste vermelho antes da blindagem (S10) | `executor` | unitário feito (`EditorSeries.chave.test.tsx`); e2e do cluster em `editor-serie-aberta.spec.ts` a rodar |
| E-005 | Capturas | 1280, 1920 e 3440×1440, escuro e claro: tela inteira (configuração aberta e fechada), série simples, valores por série, cluster antes e depois de um bloco com RPE, prévia ao lado; app do aluno em 390; lado a lado com as imagens da proposta | sessão principal | **falta** |
| E-006 | Relatório | Tabela item \| status das seções 0 a 6 | sessão principal | **falta** |
| T-040 | Verificação do lote e push | `typecheck`, `lint`, `jest`, `mvn verify` (B-005) e a suíte e2e completa; push só verde | sessão principal | **falta** — commit/run: — (docs deste lote: `AGENTS.md`, `docs/design-e-front.md`, `avaliacao-fisica-visual.md` e README atualizados sem commit) |

### Plano B: folhas e telas (pedidos 35, 38 e o briefing da leva 3)

| ID | Entrega | Aceitação | Arquivos | Situação |
| --- | --- | --- | --- | --- |
| B-001 | Folhas "Nova semana de treino", dieta, mobilidade e modelo | Nome focado e Enter cria; descrição de 2 linhas crescendo, sem alça, com contador; Coleção num seletor com busca e "+ Nova coleção…", já marcada quando aberta dentro de uma coleção; rodapé Cancelar / Criar e editar; erro no campo | `treinador/planejamento/FolhaNovoModelo.tsx`, `SeletorDeColecao.tsx`, `app/treinador/planejamento/index.tsx`, `e2e/planejamento-novo-modelo.spec.ts` | **feito sem commit**, sem teste unitário; e2e escrito |
| B-002 | Folha "Filtros de exercícios" | Folha média (800) em 2 colunas; Grupo muscular com busca e lista em 2 colunas, selecionados no topo; Modalidade em chips compactos; Vídeo e Imagem na mesma linha (Todos · Com · Sem); rodapé "Limpar filtros", "Cancelar", "Mostrar N exercícios" | `dominio/painelDeExercicios.ts` (+ teste), `ui/BarraDeFiltros.tsx`, `treinador/biblioteca/AbaExercicios.tsx`, `e2e/biblioteca-filtros-exercicios.spec.ts`, `e2e/filtros-laterais-cartoes.spec.ts` | **feito sem commit** + teste; e2e escrito |
| B-003 | Grupos parecidos agrupados no filtro | Um item com o total e as variações no ⓘ | `dominio/gruposMusculares.ts` (+ teste), `ui/DicaDeTexto.tsx` | **feito sem commit** + teste |
| B-004 | "Organizar grupos musculares" no ⋯ da aba Exercícios | "Unir" com confirmação que mostra quantos exercícios mudam (prévia da API) | `treinador/biblioteca/FolhaOrganizarGruposMusculares.tsx`, `dominio/unirGruposMusculares.ts` (+ teste), `api/gruposMusculares.ts`, `e2e/biblioteca-grupos-musculares.spec.ts` | **feito sem commit** + teste; e2e escrito; em 28/11, SEM commit (leva-3): a origem vai como o servidor compara (`nomeDoGrupoNoServidor`: só o espaço comum das pontas, como o `trim` do JPQL; NBSP fica); o destino e o `contagemDosGrupos` ainda usam o `trim()` do JS (pendência abaixo) |
| B-005 | Endpoint de unir grupos | `POST /exercicios/grupos-musculares/unir/previa` (só leitura) e `POST /exercicios/grupos-musculares/unir`, ambos `PERM_BIBLIOTECA_ALTERAR`, pelo `@TenantId` do `Exercicio` (sem SQL nativo sem `consultoria_id`), auditoria `GRUPOS_MUSCULARES_UNIDOS` com resumo fixo (espelho em `acoesAuditoria.ts`, categoria Planos em `categoriasDeAuditoria.ts`); nenhum dado de consultoria real lido | `biblioteca/GruposMuscularesService.java`, `ExercicioController.java`, `ExercicioRepository.java`, `Exercicio.java`, `dto/BibliotecaDtos.java`, `GruposMuscularesIntegrationTest.java` | **feito sem commit**; revisado (nada a unir = 0 sem gravar nem auditar, `registrarEvento`, 409 `CONFLITO_EDICAO`, `origem[i]` até 60); teste de integração escrito, a rodar com `mvn verify` pela sessão principal |
| B-006 | Formulário Editar / Novo exercício | Modalidade · Grupo muscular · Equipamento no mesmo seletor de 46 px com rótulo dentro e "(opcional)"; Grupo com busca, contagem e "+ Usar '<texto>'", sugerindo o parecido primeiro; Equipamento com busca e criação; cardio com as regras do lote do cardio; vídeo e imagem da mesma altura (vídeo vazio tracejado com o campo dentro; preenchido em 16:9 com "Abrir no YouTube" e "Remover vídeo"; link inválido com erro no campo), botões das duas colunas alinhados; Observações crescendo (3 linhas), sem alça, contador no canto | `treinador/biblioteca/FolhaExercicio.tsx` (+ teste), `dominio/opcoesDoExercicio.ts` (+ teste), `areaDaMidia.ts`, `ImagemDoExercicioEditor.tsx`, `VideoDoExercicioEditor.tsx`, `ModalidadeDoExercicio.tsx`, `CamposDoCardio.tsx`, `e2e/biblioteca-exercicios-midia.spec.ts`, `e2e/biblioteca-cardio.spec.ts` | **feito sem commit** + teste; e2e alterados; desvio: seletores com 52 px (`ui/EscolhaSuspensa`), a proposta dizia 46; em 28/11, SEM commit (leva-3): a folha recebe `todos` e `erroDaBiblioteca` por prop e não faz GET próprio (a `AbaExercicios` liga `querContagem` ao abrir; o e2e que abre a folha ainda mocka `GET /exercicios`, porque a aba o faz na primeira abertura) |
| B-007 | Avaliação física: histórico em tabela e folha | a detalhar (do briefing: histórico em tabela e a avaliação numa folha) | `dominio/avaliacaoFisica.ts`, `comparacaoDeAvaliacoes.ts` | **feito sem commit** (detalhe na seção "Leva 3" de [avaliacao-fisica-visual.md](avaliacao-fisica-visual.md)); regra + teste alterados, `PesoDaData` sem teste unitário; e2e alterado; comparação de 3 a 4 datas perdida (decisão aberta); em 28/11, SEM commit (leva-3): variação numa regra só para tela, folha e PDF (L2 e L-6 do plano da avaliação) |
| B-008 | Visualizador de foto de evolução | a detalhar (do briefing: visualizador da foto de evolução) | `dominio/visualizadorDeFotos.ts` (+ teste), `fotos/VisualizadorDeFotos.tsx`, `CompararFotos.tsx`, `FotoNoPalco.tsx` | **feito sem commit** + teste (`CartaoFotos` abre o `VisualizadorDeFotos`); e2e escrito; sem Baixar/Excluir (falta API) nem sobreposição; em 28/11, SEM commit (leva-3): `ImagemProtegida` com `useEnderecoDoBlob` (o `blob:` nasce e morre num efeito ligado ao Blob) e `dentroDeBotao` ("Não carregou" sem botão), seta desabilitada `CAMADA_DA_FOTO.iconeDesabilitado` (#BDBDBD, sem opacidade), Comparar com entrada própria no histórico (`usePassoNoHistorico`) e palco que só baixa depois de 200 ms parado (`useAtrasado`) |
| B-009 | Folha da pasta do aluno | Cabeçalho, "Planos desta pasta" e rodapé de publicação; a detalhar a partir do bloco F de [atualizacao-pasta-e-questionarios.md](atualizacao-pasta-e-questionarios.md) | — | **feito sem commit** + teste (`dominio/folhaDaPasta.ts`, `usePublicarDaPasta` no rodapé, selos de `linhaDoPlano`); e2e alterado; sem API nova (`PublicarPastaRequest` já tem `liberarEm` e `avisarAluno`); em 28/11, SEM commit (leva-3): o selo segue a regra da lista (`prazoDaPasta`): "Vigente" só quando a API diz que é a vigente, "Vencida" vermelho só para a vigente vencida ou que ainda pede renovação, antiga já renovada neutra "Período encerrado em dd/mm" |
| B-010 | Folha "Usar semana de treino" | a detalhar | — | **feito sem commit** + teste da regra (`FolhaUsarSemana`, `PreviaDaSemana`, `dominio/listaDeSemanas.ts`); "Desfazer" em toast; e2e escrito |
| B-011 | Seletor do questionário | a detalhar (peça atual: `treinador/questionarios/SeletorDeQuestionario`) | — | **feito sem commit** (`SeletorDeQuestionario` com `ui/EscolhaSuspensa`), sem teste unitário novo |

Capturas do plano B (pedidos 35 e 38): 1280 e 390, escuro e claro, das folhas B-001 e B-002, filtros com 2 grupos
marcados e o Organizar; 1280 escuro e claro do B-006 (vazio, preenchido, link inválido, seletor aberto digitando
"pantu"). Dono: sessão principal.

## Fora do escopo
- Contagem dos grupos musculares parecidos nos dados reais: não entra aqui (dado de cliente); segue a pendência
  "Grupos musculares parecidos no catálogo" em Pendências soltas do README.
- As sobras da série aberta da leva 1 (bolinha de cor no Tipo, RIR sem rótulo, prévia em kg da WS, "Editar sessão"
  recolhível) ficam na pendência própria do README e em [editor-de-treino-e-dieta-27-11.md](editor-de-treino-e-dieta-27-11.md);
  este plano as cobre em A-T016 (bolinha), A-T017 (RIR só com o valor), A-T019 (prévia) e A-T013 ("Editar sessão") quando
  a fiação fechar; até lá a pendência continua aberta.

## O que ficou para trás
- `AGENTS.md` (itens Biblioteca, Série aberta, Avaliação física, Comparação de fotos, Pastas e a contagem Planos 25) e
  `docs/design-e-front.md` (`CampoQueCresce`, `DicaDeTexto`, A2 na 4.7, linha da leva 3 na 5.6, exceção da seta da foto
  na linha "Desabilitado") atualizados em 27 e 28/11, sem commit.
- Confirmar o mapa de IDs deste registro (coordenador) e detalhar a aceitação de B-007 a B-011.
- Decisões abertas A1 e A2 (A3 fechada sem migration); avaliação física com duas datas só e cor da meta (L1 e L2 em
  [avaliacao-fisica-visual.md](avaliacao-fisica-visual.md)); "Rascunho" âmbar na pasta (decidido em 29/11, feito).

### Pendências soltas (relatório de revisão de 28/11; também no README)
Decisões abertas (Gustavo):
- Borda de ação na série aberta: o quadro da proposta tem borda; o código usa fundo tingido ("um destaque por vez").
- RPE como o mesmo seletor do RIR (hoje segmento RIR · RPE).
- "Carga diferente por bloco" com os campos em lista.
- Faixa compacta abaixo de 1600 px sem os totais.
- A1 (três `acao` no painel do exercício) e A2 (âmbar do "Alterações não salvas") do design.
- "(o timer conta)" também na pausa do Rest-pause (hoje sai nos dois).
- Avaliação física: perda da comparação de 3 a 4 datas (L1).
- Foto de evolução: Baixar/Excluir (falta API e as ações `FOTO_BAIXADA`/`FOTO_EXCLUIDA`) e sobreposição no Comparar.

Para fazer (`executor-front`/`executor`):
- ~45 seletores antigos "Rótulo: valor ⌄" a trocar por `ui/EscolhaSuspensa`/`ui/EscolhaEmFolha`: a lista com arquivo e
  linha está no scratchpad da sessão de 27–28/11 (fora do repositório) e deve ser movida para este plano.
- Design system: `ui/Selo` sem tom `informacao`; `ui/EscolhaSuspensa` sem estado ocupado nem desabilitado e com 52 px;
  `ui/Botao` com `aria-disabled` que não perde o foco.
- Exportar `semPapelNoModal` de `ui/Folha.tsx` e tirar a cópia do `VisualizadorDeFotos` (`shortcut:` lá).
- Cache dos blobs das miniaturas das fotos.
- `ui/DemonstracaoDoExercicio` e `ui/FotoDePerfil` ainda criam o `blob:` dentro da busca (vazamento antigo); passar
  para `useEnderecoDoBlob`.
- Acrescentar a seta desabilitada (`CAMADA_DA_FOTO.iconeDesabilitado`) em `ui/contrasteDasPecas.test.ts`.
- `contagemDosGrupos` (`dominio/exerciciosDaBiblioteca.ts`) e o destino do unir (`dominio/unirGruposMusculares.ts`)
  ainda usam o `trim()` do JS (tira NBSP; o servidor não): alinhar com `nomeDoGrupoNoServidor`.
- Aviso "Seu novo plano" não anuncia o primeiro plano: pendência de
  [atualizacao-pasta-e-questionarios.md](atualizacao-pasta-e-questionarios.md).
