# Seções recolhíveis nascem fechadas

Situação: Em andamento · Onde: main · Atualizado: 18/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa). Base: `main` em `9443481e`. Validade: vale enquanto os lugares do inventário (passo 1) não mudarem; refazer o inventário se a lista de telas mudar. **Amplia e substitui as decisões D6 e D11 de [editor-e-modelos-achar-as-coisas.md](editor-e-modelos-achar-as-coisas.md)** (atualizadas lá).

## Objetivo
Em todo o app, seção que abre e fecha começa fechada, para a tela abrir enxuta; a busca, o item recém-criado, o erro apontado e o link abrem o que importa. Só app: sem API, sem migration.

## Conferido no código (18/11/2026)
- O inventário (passo 1, 18/11) lista cada lugar com arquivo, linha e estado inicial de hoje. Exemplos já vistos: `FolhaReceitas`, Planejamento por coleção, `CartaoMetodologia`, `SecoesDeMobilidade`, `EditorQuestionario`, `EditorDeDieta`, `TelaAjuda`, Biblioteca › Outros.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Regra | Seção que abre e fecha (`CabecalhoDeGrupo` com `aoAlternar`, cartão recolhível, "Mostrar mais") **começa fechada** | Gustavo, 18/11 |
| D2 | Uma seção só | Se há uma seção só, ela começa aberta | Gustavo, 18/11 |
| D3 | Busca | Buscar abre as seções com resultado; limpar a busca volta ao estado de antes da busca | Gustavo, 18/11 |
| D4 | Abrem sozinhos | O item recém-criado, o que tem erro apontado por "ir ao primeiro" e o destino de um link (`?secao=`, `?pastaId=`) | Gustavo, 18/11 |
| D5 | Exceção | Telas de uso do aluno (treino do dia, dieta, lista de compras, histórico) ficam como estão | Gustavo, 18/11 |
| D6 | Persistência | Não guardar no aparelho: cada vez que a tela abre, começa fechada | Gustavo, 18/11 |
| D7 | Menu lateral do treinador | **Fora desta regra por ora:** o pedido de 18/11 dos grupos recolhíveis do menu ([menu-grupos-recolhiveis.md](menu-grupos-recolhiveis.md)) manda "tudo aberto" e preferência guardada no aparelho, o que contraria D1 e D6. Navegação não é seção de conteúdo; o Gustavo confirma se quer o menu também nascendo fechado | Sessão principal, a confirmar com o Gustavo |
| D8 | Regra pura e hook | Só se tirar repetição de verdade (3 ou mais lugares iguais); sem abstração para dois usos | Gustavo, 18/11 |

## Passos
Subagentes não comitam; a sessão principal comita e anota o commit aqui.

- [ ] 0. Plano, índice, regra no `docs/design-e-front.md` e D6/D11 de `editor-e-modelos-achar-as-coisas.md` atualizadas — sessão principal — commit: —
- [x] 1. Inventário de todos os lugares com seção recolhível (só leitura, seis explorações em 18/11; parcial em partes: o que ficou sem leitura completa cada lote confere antes de mudar) — explorador — commit: n/a
- [x] 2. **Lote A** (primeiro, sozinho): regra pura `dominio/secoesAbertas.ts` + hook `ui/useSecoesAbertas` (fechado, uma só = aberta, busca abre as com resultado e limpar restaura, seção que chega depois entra fechada), `ui/Cartao` com `recolhivel` fechado por padrão (e a lista de quem muda), `ajuda/TelaAjuda.tsx` como primeiro uso (+ `ajuda.spec.ts`) e os usos das telas de uso do aluno que precisam continuar abertos — executor — commit: `08ec72e6` (jest 1.884, eslint, typecheck ✅; e2e da Ajuda ajustado por leitura, não rodado)
- [x] 3. Aplicar, depois do A, em lotes de arquivos disjuntos, em paralelo (cada lote: jest e eslint dos seus arquivos; **e2e só na passada única do passo 4**, para não competir por CPU; "ir ao primeiro problema", item recém-criado e destino de link continuam abrindo o item certo):
  - **Lote B** (planejamento e receitas): `app/src/app/treinador/planejamento/index.tsx` (coleções hoje abertas; a busca zera o Set e não restaura), `treinador/FolhaReceitas.tsx` (idem), `treinador/CargasPorDivisao.tsx` e `BlocoDaDivisao.tsx`, `treinador/planejamento/EditorModelo.tsx`; e2e `planejamento-colecoes.spec.ts` — executor — commit: `da01327a` (+ `historico.tsx` do aluno com `nascemAbertas`, exceção D5)
  - **Lote C** (dieta, mobilidade, plano): `treinador/dieta/*` (hoje: refeições fechadas; Orientações, Observações, Suplementação, Outros, "Observação ou modo de preparo" e "Mais detalhes" abrem se já têm conteúdo; `unica` e inspetor forçam aberto e ficam), `treinador/mobilidade/*`, `treinador/plano/ConfiguracaoDoPlano.tsx`, `CabecalhoDoItem.tsx`; e2e `dieta-ajustes`, `dieta-opcoes-e-preparo`, `dieta-editor-melhorias`, `editor-mobilidade`. **Só depois do C** a frente da fibra mexe em `treinador/dieta/*` — executor — commit: `dd1df104` (Configuração do plano deixou de abrir em duas colunas na mobilidade; erros de `aguaLitros`/`dataInicio`/`inicio`/`fim` não abrem a Configuração: já era assim)
  - **Lote D** (treino): `treinador/treino/*` (hoje: "Editar sessão", extras, Alternativas, nome do modelo abrem pelo conteúdo ou por erro); e2e `editor-de-treino-reorganizado`, `editor-inspetor`, `editor-inspetor-sobras`, `editor-alternativas`, `grupos-e-cardio-treino` — executor — commit: `0684ba48` (só "Nome de exibição e instruções" e "Alternativas" mudaram; o resto do treino já cumpria a regra)
  - **Lote E** (questionários e marca): `treinador/questionarios/*` (perguntas já nascem fechadas por Set vazio; `mostrarErros` e a pergunta nova abrem), `treinador/marca/*` (`CartaoMetodologia`, `CartaoDoTipo`, `FormMarca`); e2e `metodologia`, `series-metodologia` — executor — commit: `da590859` (já nasciam fechados; migrados para o hook; pergunta duplicada continua nascendo fechada)
  - **Lote F** (ficha, raiz de `treinador/`, biblioteca e importação): `CartaoPastas`, `CartaoRegistros`, `CartaoProgresso`, `ciclo/CicloNaFicha`, `painel/BlocoPrimeirosPassos` (conferir onde guarda `usePrimeirosPassosGuardados`: se for no aparelho, conflita com D6), `app/src/app/treinador/alunos/[id].tsx` (destinos `?pastaId=`, `?secao=acesso|trocas` precisam abrir o cartão), `biblioteca/AbaCatalogo`, `biblioteca/AbaErgogenicos` (Outros: categorias hoje fixas abertas e sem botão; passam a recolhíveis, fechadas, e a busca abre), `importacao/planilhaCompleta/EtapaDaAmostra` (hoje o primeiro aluno nasce aberto); e2e `biblioteca-catalogo`, `acesso-aluno`, `alertas-de-troca` — executor — commit: `54ca33d2` (CartaoPastas aberto por ser a seção única da aba Planos; Primeiros passos do Início continua aberto: guia de onboarding, decisão do Gustavo)
  - Arquivos de e2e de dono compartilhado (`editor-clareza.spec.ts`, `ver-como-aluno.spec.ts`) e a conferência do Planejamento×`AGENTS.md`: ficam para a passada final (passo 4), com um dono só.
  - Fora: `ui/Navegacao`, `ui/Passeio` (menu, D7), telas de uso do aluno (D5).
- [ ] 4. Passada final: e2e que esperavam seção aberta (os acima, mais `editor-clareza` e os que a execução apontar), uma suíte de cada vez e a saída filtrada pelo executor-rapido; `AGENTS.md` onde diz "abertas" ou "recolhidas por padrão"; Ajuda, se citar; `npm run typecheck && npm run lint && npm test`; capturas de 2 ou 3 telas em 390 e 1280 px — sessão principal, executor-rapido e executor-front — commit: ca0fd337 (só os e2e de dono compartilhado; AGENTS.md e Ajuda em andamento por outro agente, sem commit; suíte e2e inteira passou em 18/11 com 2279 passed e 186 skipped, antes do Kiwify e da Renegociar-API)

## Critérios de aceite
- Cada tela do inventário abre com as seções fechadas (uma só = aberta); busca abre as com resultado e restaura ao limpar; item novo, erro apontado e link abrem o que devem.
- Telas de uso do aluno não mudam.
- Nada do estado fica no aparelho.
- typecheck, lint, `npm test` e os e2e mexidos verdes; capturas de 2 ou 3 telas em 390 e 1280 px.

## Fora do escopo
- Menu lateral do treinador (D7), até o Gustavo confirmar.
- Telas de uso do aluno (D5).

## O que ficou para trás
- Primeiros passos do Início continua aberto (guia de onboarding, decisão do Gustavo). O menu lateral segue fora desta regra (D7) até o Gustavo confirmar.
