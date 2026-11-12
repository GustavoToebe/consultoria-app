# Composição de telas: editores da Biblioteca, instruções do catálogo e Visão geral do Financeiro

Situação: Concluída em 12/11/2026 (verificações verdes) · Onde: `main`, commit ee2824d3 · Atualizado: 12/11/2026

## Objetivo
Dar a três telas a mesma composição de "Editar alimento" e organizar o que estava solto: editores de exercício e de item com seções,
colunas responsivas e rodapé fixo; instruções do catálogo numa região identificada; Visão geral financeira sem colunas vazias,
tabelas mensais lado a lado e "Como calculamos" como glossário; filtros da Agenda em uma linha, com menus ancorados, e lateral mais leve.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Referência dos editores | `FolhaAlimento` (`biblioteca/AbaAlimentos.tsx`): seções em cartão com título, 2 colunas quando couber, rodapé Cancelar/Salvar fixo; campos e comportamento de cada folha não mudam | Gustavo (12/11) |
| 2 | "Editar item" = Biblioteca › Outros (`AbaErgogenicos`); o "Editar item" da lista de compras do aluno não muda | só o treinador | Claude (premissa a confirmar) |
| 3 | Instruções do catálogo | um bloco "Instruções de execução" com "Recolher", passos numerados neutros, sem cartão por passo e sem cor; conteúdo e ordem originais | Gustavo |
| 5 | Filtros da Agenda | "Responsável: …" (seleção única) e "Compromissos: …" (seleção múltipla, sem busca), menus ancorados ao botão no PC, "Todos" explícito; lateral com seções leves; peças compartilhadas só com prop opcional | Gustavo (12/11) |
| 4 | Visão geral do Financeiro | cartões por largura medida (2 → metade, 3 → três colunas se couberem), tabelas mensais lado a lado no PC largo, glossário em duas colunas + "Períodos e limites dos dados"; fórmulas, filtros e a distinção zero/indisponível intactos | Gustavo |

## Passos
- [x] 1. Editar exercício e Editar item (Biblioteca: `AbaExercicios`, `AbaErgogenicos`; `e2e/composicao-rodape`, `biblioteca-outros`); commit: —
- [x] 2. Instruções de execução (`AbaCatalogo`, `e2e/biblioteca-catalogo`); commit: —
- [x] 3. Visão geral do Financeiro (`VisaoGeral`, `ResultadoDoMes` com prop opcional, `dominio/financeiro.ts` com as constantes separadas, `financeiro.tsx` com a descrição no subtítulo; `e2e/financeiro`); commit: —
- [x] 3b. Filtros e lateral da Agenda (`FiltroDaAgenda.tsx` novo, `PainelDeAgendas`, `agenda.tsx`; `e2e/agenda-calendario`); commit: —
- [x] 4. Verificações em 12/11: tsc, lint (0 erros), Jest 298 suítes/6473, e2e 452/452 das telas mexidas; capturas de cada tela em claro/escuro, 390 a 1440 px (scratchpad) — commit: —

## Fora do escopo
- "Editar item" da lista de compras do aluno; `CartaoExercicio` do treino.
- Agenda: resumo do compromisso junto ao evento e criar compromisso clicando num horário vazio (o Gustavo os citou como prioridade futura).

## O que ficou para trás
- Web local (8088, demonstração, 12/11/2026): Números, Financeiro, Agenda, Comunidade e Biblioteca conferidos em 1280, 1440 e 390 px, menu aberto e recolhido, sem rolagem horizontal nem texto de erro. Agenda: seleção múltipla sem fechar o menu, Esc, persistência após recarregar e avançar restaurando os filtros ✓; "voltar" sai da Agenda porque o filtro não empilha histórico (decisão mantida). Temas areia e contraste alto, barra de rolagem real do Windows, app nativo e leitor de tela real não conferidos.
- Editores da Biblioteca: o erro de envio fica no corpo, como em "Editar alimento" (se for para o rodapé, mudar as três de uma vez); a seção "Observação" do item repete o rótulo do campo.
- Instruções do catálogo: um controle só ("Ver/Recolher instruções"), sem segundo "Recolher" no cabeçalho do bloco; o "Como fazer" do aluno e o `ModoDePreparo` têm bloco parecido (peça `ui/ListaDePassos` possível).
- Agenda: `router.replace` virou `router.setParams` na gravação do filtro (o menu não fecha a cada caixa); `SelecaoMultiplaSuspensa` em Auditoria e listas pode ter o mesmo efeito, a conferir; mini calendário (moldura e largura de ~310 px da lateral) não mexido; resumo do compromisso e criar clicando no horário vazio ficam para depois.
- Financeiro: com "Meus", o cartão Renovações passou a sumir (antes mostrava números da consultoria inteira). Isso só tira o dado de escopo errado; **falta oferecer as renovações do responsável**. O dado existe: `FinanceiroService.visaoGeral()` percorre as contratações ATIVAS sem filtro e `ContratacaoAlunoRepository` já filtra por `responsavelId` em `recorrentes(...)` (usado em `receitaRecorrente`). Caminho: `GET /financeiro/visao-geral?responsavelId=` (ou `meus`) com a mesma regra de escopo do painel, teste de integração no `NumerosIntegrationTest`-estilo (outro responsável não entra) e o app passar o filtro em vez de esconder o cartão. É mudança de API: vai ao `executor`, não ao front. Registrado em 12/11/2026 a pedido do Gustavo, sem implementar.
